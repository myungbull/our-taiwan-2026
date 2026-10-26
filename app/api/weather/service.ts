import { normalizeWeatherData, shiftWeatherDate, taipeiDate, weatherRegions, weatherResultForDate, type WeatherData, type WeatherProvider, type WeatherRegionId, type WeatherResult } from '../../weather-data';
import { loadCwaWeather } from './cwa';

export const FRESH_MS = 15 * 60_000;
const LEASE_MS = 90_000;
type Snapshot = { data: WeatherData; savedAt: number };
export type WeatherState = { region: WeatherRegionId; primary_json: string | null; fallback_json: string | null; primary_failures: number; primary_next_at: number; fallback_next_at: number; lease_token: string | null; lease_until: number; last_error: string | null };
export type WeatherRuntime = { db: D1Database; key?: string; fetch?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; log?: (event: Record<string, unknown>) => void };

export class WeatherUpstreamError extends Error {
  constructor(public code: string, public status = 0, public retryAfterMs = 0) { super(code); }
}
export function retryDelay(value: string | null, now: number): number {
  if (!value) return 0;
  const seconds = Number(value), date = Date.parse(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - now : 0;
  return Math.max(0, Math.min(delay, 60 * 60_000));
}
function snapshot(value: string | null): Snapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Snapshot;
    return Number.isFinite(parsed.savedAt) && parsed.data?.timezone === 'Asia/Taipei' && Array.isArray(parsed.data.daily) ? parsed : null;
  } catch { return null; }
}
export async function readWeatherState(db: D1Database, region: WeatherRegionId): Promise<WeatherState> {
  await db.prepare('INSERT OR IGNORE INTO weather_cache (region) VALUES (?)').bind(region).run();
  const row = await db.prepare('SELECT * FROM weather_cache WHERE region = ?').bind(region).first<WeatherState>();
  if (!row) throw new Error('weather-cache-unavailable');
  return row;
}
export function resultFromState(state: WeatherState, region: WeatherRegionId, date: string, now: number, hasKey: boolean): WeatherResult {
  const primary = snapshot(state.primary_json), fallback = snapshot(state.fallback_json);
  const active = state.primary_failures >= 3 && hasKey && fallback !== null;
  const provider: WeatherProvider = active ? 'CWA' : 'Open-Meteo';
  const today = taipeiDate(new Date(now));
  const decorateDays = (entry: Snapshot | null, source: WeatherProvider) => entry?.data.daily.map(day => ({ ...day, source, fetchedAt: entry.data.fetchedAt, stale: now - entry.savedAt >= FRESH_MS || (source === 'Open-Meteo' && state.primary_failures > 0) })) ?? [];
  const days = new Map(decorateDays(primary, 'Open-Meteo').filter(day => day.date >= today).map(day => [day.date, day]));
  if (active) for (const day of decorateDays(fallback, 'CWA')) if (day.date >= today) days.set(day.date, day);
  const currentSnapshot = active && fallback?.data.current ? fallback : primary;
  const currentSource: WeatherProvider = currentSnapshot === fallback ? 'CWA' : 'Open-Meteo';
  const current = currentSnapshot?.data.current ? { ...currentSnapshot.data.current, source: currentSource, kind: currentSource === 'CWA' ? 'observation' as const : 'model' as const, fetchedAt: currentSnapshot.data.fetchedAt, stale: now - currentSnapshot.savedAt >= FRESH_MS || (currentSource === 'Open-Meteo' && state.primary_failures > 0) } : null;
  const latest = active ? fallback : primary;
  const data: WeatherData = { fetchedAt: latest?.data.fetchedAt ?? '', timezone: 'Asia/Taipei', current, daily: [...days.values()].sort((a,b) => a.date.localeCompare(b.date)) };
  const result = weatherResultForDate(data, region, date, today, latest ? now - latest.savedAt >= FRESH_MS || (!active && state.primary_failures > 0) : false);
  if (!result.selectedForecast && date > shiftWeatherDate(today, 15)) result.availability = 'not-yet';
  const due = now >= state.primary_next_at || (state.primary_failures >= 3 && hasKey && now >= state.fallback_next_at);
  const next = Math.max(state.lease_until, Math.min(state.primary_next_at, state.primary_failures >= 3 && hasKey ? state.fallback_next_at : Infinity));
  return { ...result, provider, refresh: { needed: due, inProgress: state.lease_until > now, nextAttemptAt: next > now && Number.isFinite(next) ? new Date(next).toISOString() : null, primaryFailures: state.primary_failures, fallback: state.primary_failures < 3 ? 'standby' : !hasKey ? 'missing-key' : active ? 'active' : 'unavailable' } };
}

// Fixed public coordinates only; diagnostics omit URLs, API keys and identities.
export function createWeatherFetcher(runtime: WeatherRuntime) {
  const clock = runtime.now ?? Date.now, request = runtime.fetch ?? fetch;
  const sleep = runtime.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  return async (url: URL, provider: WeatherProvider, region: WeatherRegionId): Promise<unknown> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000), started = clock();
      try {
        const response = await request(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
        if (!response.ok) throw new WeatherUpstreamError('http-error', response.status, retryDelay(response.headers.get('retry-after'), clock()));
        try { return await response.json(); } catch { throw new WeatherUpstreamError('invalid-json'); }
      } catch (reason) {
        const error = reason instanceof WeatherUpstreamError ? reason : new WeatherUpstreamError(controller.signal.aborted ? 'timeout' : 'network-error');
        runtime.log?.({ event: 'weather-provider-failure', provider, region, code: error.code, status: error.status, durationMs: Math.max(0, clock() - started), attempt: attempt + 1 });
        if (attempt === 0 && error.retryAfterMs === 0 && (error.code === 'timeout' || error.code === 'network-error' || [502,503,504].includes(error.status))) { await sleep(400); continue; }
        throw error;
      } finally { clearTimeout(timeout); }
    }
    throw new WeatherUpstreamError('unavailable');
  };
}
async function loadPrimary(region: WeatherRegionId, fetchJson: ReturnType<typeof createWeatherFetcher>, now: () => number): Promise<Snapshot> {
  const place = weatherRegions[region], url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,apparent_temperature,is_day,weather_code,precipitation,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'Asia/Taipei', forecast_days: '16', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' }).toString();
  const raw = await fetchJson(url, 'Open-Meteo', region), savedAt = now();
  try { return { data: normalizeWeatherData(raw, new Date(savedAt).toISOString()), savedAt }; }
  catch { throw new WeatherUpstreamError('invalid-data'); }
}
export async function refreshWeather(runtime: WeatherRuntime, region: WeatherRegionId): Promise<WeatherState> {
  const clock = runtime.now ?? Date.now, now = clock(), hasKey = Boolean(runtime.key?.trim());
  const previous = await readWeatherState(runtime.db, region);
  if (previous.lease_until > now || (now < previous.primary_next_at && !(previous.primary_failures >= 3 && hasKey && now >= previous.fallback_next_at))) return previous;
  const token = crypto.randomUUID();
  const state = await runtime.db.prepare('UPDATE weather_cache SET lease_token = ?, lease_until = ? WHERE region = ? AND lease_until <= ? AND (primary_next_at <= ? OR (primary_failures >= 3 AND fallback_next_at <= ? AND ? = 1)) RETURNING *').bind(token, now + LEASE_MS, region, now, now, now, hasKey ? 1 : 0).first<WeatherState>();
  if (!state) return readWeatherState(runtime.db, region);
  const fetchJson = createWeatherFetcher(runtime);
  try {
    if (now >= state.primary_next_at) {
      try {
        const entry = await loadPrimary(region, fetchJson, clock);
        state.primary_json = JSON.stringify(entry); state.primary_failures = 0; state.last_error = null;
        state.primary_next_at = clock() + FRESH_MS;
      } catch (reason) {
        const error = reason instanceof WeatherUpstreamError ? reason : new WeatherUpstreamError('invalid-data');
        state.primary_failures = Math.min(state.primary_failures + 1, 1000);
        state.last_error = `Open-Meteo:${error.code}:${error.status}`;
        state.primary_next_at = clock() + Math.max(error.retryAfterMs, state.primary_failures >= 3 ? FRESH_MS : state.primary_failures * 30_000);
        runtime.log?.({ event: 'weather-refresh-failure', provider: 'Open-Meteo', region, code: error.code, status: error.status, accumulatedFailures: state.primary_failures });
      }
    }
    if (state.primary_failures >= 3 && hasKey && clock() >= state.fallback_next_at) {
      try {
        const data = await loadCwaWeather(region, runtime.key!.trim(), fetchJson, clock());
        state.fallback_json = JSON.stringify({ data, savedAt: clock() }); state.fallback_next_at = clock() + FRESH_MS;
      } catch (reason) {
        const error = reason instanceof WeatherUpstreamError ? reason : new WeatherUpstreamError('invalid-data');
        state.last_error = `CWA:${error.code}:${error.status}`; state.fallback_next_at = clock() + Math.max(FRESH_MS, error.retryAfterMs);
        runtime.log?.({ event: 'weather-refresh-failure', provider: 'CWA', region, code: error.code, status: error.status });
      }
    }
    await runtime.db.prepare('UPDATE weather_cache SET primary_json = ?, fallback_json = ?, primary_failures = ?, primary_next_at = ?, fallback_next_at = ?, last_error = ?, lease_token = NULL, lease_until = 0 WHERE region = ? AND lease_token = ?').bind(state.primary_json, state.fallback_json, state.primary_failures, state.primary_next_at, state.fallback_next_at, state.last_error, region, token).run();
  } finally {
    await runtime.db.prepare('UPDATE weather_cache SET lease_token = NULL, lease_until = 0 WHERE region = ? AND lease_token = ?').bind(region, token).run();
  }
  return readWeatherState(runtime.db, region);
}
