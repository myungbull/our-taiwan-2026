import { ACCUWEATHER_SWITCH_DATE, normalizeWeatherData, shiftWeatherDate, taipeiDate, weatherRegions, weatherResultForDate, type WeatherData, type WeatherProvider, type WeatherRegionId, type WeatherResult } from '../../weather-data';
import { loadAccuWeather } from './accuweather';

export const FRESH_MS = 15 * 60_000;
export const ACCUWEATHER_FRESH_MS = 60 * 60_000;
const LEASE_MS = 90_000;
type Snapshot = { data: WeatherData; savedAt: number };
export type WeatherState = {
  region: WeatherRegionId;
  primary_json: string | null;
  fallback_json: string | null;
  primary_failures: number;
  primary_next_at: number;
  fallback_next_at: number;
  accuweather_json: string | null;
  accuweather_failures: number;
  accuweather_next_at: number;
  accuweather_location_key: string | null;
  lease_token: string | null;
  lease_until: number;
  last_error: string | null;
};
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
  const primary = snapshot(state.primary_json);
  const accuweather = snapshot(state.accuweather_json);
  const today = taipeiDate(new Date(now));
  const switchActive = today >= ACCUWEATHER_SWITCH_DATE;
  const selectedSnapshot = switchActive && accuweather ? accuweather : primary;
  const provider: WeatherProvider = selectedSnapshot === accuweather && accuweather ? 'AccuWeather' : selectedSnapshot ? 'Open-Meteo' : switchActive ? 'AccuWeather' : 'Open-Meteo';

  const staleBySource = (source: WeatherProvider, entry: Snapshot) =>
    now - entry.savedAt >= (source === 'AccuWeather' ? ACCUWEATHER_FRESH_MS : FRESH_MS)
    || (source === 'Open-Meteo' && state.primary_failures > 0)
    || (source === 'AccuWeather' && state.accuweather_failures > 0);
  const daily = selectedSnapshot?.data.daily
    .filter(day => day.date >= today)
    .map(day => ({ ...day, source: provider, fetchedAt: selectedSnapshot.data.fetchedAt, stale: staleBySource(provider, selectedSnapshot) })) ?? [];

  const currentSnapshot = switchActive && accuweather?.data.current ? accuweather : primary;
  const currentSource: WeatherProvider = currentSnapshot === accuweather && accuweather ? 'AccuWeather' : 'Open-Meteo';
  const current = currentSnapshot?.data.current
    ? {
        ...currentSnapshot.data.current,
        source: currentSource,
        kind: currentSource === 'AccuWeather' ? 'observation' as const : 'model' as const,
        fetchedAt: currentSnapshot.data.fetchedAt,
        stale: staleBySource(currentSource, currentSnapshot),
      }
    : null;
  const latest = selectedSnapshot ?? currentSnapshot ?? primary ?? accuweather;
  const data: WeatherData = {
    fetchedAt: latest?.data.fetchedAt ?? '',
    timezone: 'Asia/Taipei',
    current,
    daily,
  };
  const result = weatherResultForDate(
    data, region, date, today,
    latest ? staleBySource(provider, latest) : false,
    provider,
  );
  if (!result.selectedForecast && date > shiftWeatherDate(today, provider === 'AccuWeather' ? 14 : 15)) result.availability = 'not-yet';

  const switchState: NonNullable<WeatherResult['refresh']>['switchState'] = !switchActive
    ? 'scheduled'
    : !hasKey
      ? 'missing-key'
      : state.accuweather_failures > 0
        ? 'unavailable'
        : accuweather
          ? 'active'
          : 'connecting';
  const failures = switchActive ? state.accuweather_failures : state.primary_failures;
  const nextAttempt = switchActive
    ? hasKey ? state.accuweather_next_at : 0
    : state.primary_next_at;
  const due = switchActive
    ? hasKey && now >= state.accuweather_next_at
    : now >= state.primary_next_at;
  return {
    ...result,
    provider,
    refresh: {
      needed: due,
      inProgress: state.lease_until > now,
      nextAttemptAt: nextAttempt > now ? new Date(nextAttempt).toISOString() : null,
      failures,
      switchDate: ACCUWEATHER_SWITCH_DATE,
      switchState,
    },
  };
}

// Fixed public coordinates only; diagnostics omit URLs, API keys and identities.
export function createWeatherFetcher(runtime: WeatherRuntime) {
  const clock = runtime.now ?? Date.now, request = runtime.fetch ?? fetch;
  const sleep = runtime.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  return async (url: URL, provider: WeatherProvider, region: WeatherRegionId, apiKey?: string): Promise<unknown> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000), started = clock();
      try {
        const headers = new Headers({ Accept: 'application/json' });
        if (provider === 'AccuWeather' && apiKey) headers.set('Authorization', 'Bearer ' + apiKey);
        const response = await request(url, { headers, signal: controller.signal });
        if (!response.ok) throw new WeatherUpstreamError('http-error', response.status, retryDelay(response.headers.get('retry-after'), clock()));
        try { return await response.json(); } catch { throw new WeatherUpstreamError('invalid-json'); }
      } catch (reason) {
        const error = reason instanceof WeatherUpstreamError ? reason : new WeatherUpstreamError(controller.signal.aborted ? 'timeout' : 'network-error');
        runtime.log?.({ event: 'weather-provider-failure', provider, region, code: error.code, status: error.status, durationMs: Math.max(0, clock() - started), attempt: attempt + 1 });
        if (attempt === 0 && error.retryAfterMs === 0 && (error.code === 'timeout' || error.code === 'network-error' || [502, 503, 504].includes(error.status))) { await sleep(400); continue; }
        throw error;
      } finally { clearTimeout(timeout); }
    }
    throw new WeatherUpstreamError('unavailable');
  };
}

async function loadPrimary(region: WeatherRegionId, fetchJson: ReturnType<typeof createWeatherFetcher>, now: () => number): Promise<Snapshot> {
  const place = weatherRegions[region], url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,is_day,weather_code,precipitation,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Asia/Taipei', forecast_days: '16', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
  }).toString();
  const raw = await fetchJson(url, 'Open-Meteo', region), savedAt = now();
  try { return { data: normalizeWeatherData(raw, new Date(savedAt).toISOString()), savedAt }; }
  catch { throw new WeatherUpstreamError('invalid-data'); }
}

export async function refreshWeather(runtime: WeatherRuntime, region: WeatherRegionId): Promise<WeatherState> {
  const clock = runtime.now ?? Date.now, now = clock(), apiKey = runtime.key?.trim() ?? '';
  const switched = taipeiDate(new Date(now)) >= ACCUWEATHER_SWITCH_DATE;
  const previous = await readWeatherState(runtime.db, region);
  if (previous.lease_until > now || (switched ? !apiKey || now < previous.accuweather_next_at : now < previous.primary_next_at)) return previous;

  const token = crypto.randomUUID();
  const lockQuery = switched
    ? 'UPDATE weather_cache SET lease_token = ?, lease_until = ? WHERE region = ? AND lease_until <= ? AND ? = 1 AND accuweather_next_at <= ? RETURNING *'
    : 'UPDATE weather_cache SET lease_token = ?, lease_until = ? WHERE region = ? AND lease_until <= ? AND primary_next_at <= ? RETURNING *';
  const lockValues = switched
    ? [token, now + LEASE_MS, region, now, apiKey ? 1 : 0, now]
    : [token, now + LEASE_MS, region, now, now];
  const state = await runtime.db.prepare(lockQuery).bind(...lockValues).first<WeatherState>();
  if (!state) return readWeatherState(runtime.db, region);
  const fetchJson = createWeatherFetcher(runtime);

  try {
    if (!switched) {
      try {
        const entry = await loadPrimary(region, fetchJson, clock);
        state.primary_json = JSON.stringify(entry);
        state.primary_failures = 0;
        state.primary_next_at = clock() + FRESH_MS;
        state.last_error = null;
      } catch (reason) {
        const error = reason instanceof WeatherUpstreamError ? reason : new WeatherUpstreamError('invalid-data');
        state.primary_failures = Math.min(state.primary_failures + 1, 1000);
        state.primary_next_at = clock() + Math.max(error.retryAfterMs, state.primary_failures >= 3 ? FRESH_MS : state.primary_failures * 30_000);
        state.last_error = 'Open-Meteo:' + error.code + ':' + error.status;
        runtime.log?.({ event: 'weather-refresh-failure', provider: 'Open-Meteo', region, code: error.code, status: error.status, accumulatedFailures: state.primary_failures });
      }
    } else if (apiKey) {
      try {
        const place = weatherRegions[region];
        const fetchedAt = new Date(clock()).toISOString();
        const loaded = await loadAccuWeather(region, apiKey, state.accuweather_location_key, place, fetchJson, fetchedAt);
        const savedAt = clock();
        state.accuweather_json = JSON.stringify({ data: loaded.data, savedAt });
        state.accuweather_location_key = loaded.locationKey;
        state.accuweather_failures = 0;
        state.accuweather_next_at = savedAt + ACCUWEATHER_FRESH_MS;
        state.last_error = null;
      } catch (reason) {
        const knownCode = reason instanceof Error && ['invalid-data', 'invalid-location'].includes(reason.message) ? reason.message : '';
        const error = reason instanceof WeatherUpstreamError ? reason : new WeatherUpstreamError(knownCode || 'invalid-data');
        state.accuweather_failures = Math.min(state.accuweather_failures + 1, 1000);
        state.accuweather_next_at = clock() + Math.max(ACCUWEATHER_FRESH_MS, error.retryAfterMs);
        state.last_error = 'AccuWeather:' + error.code + ':' + error.status;
        runtime.log?.({ event: 'weather-refresh-failure', provider: 'AccuWeather', region, code: error.code, status: error.status, accumulatedFailures: state.accuweather_failures });
      }
    }

    await runtime.db.prepare('UPDATE weather_cache SET primary_json = ?, primary_failures = ?, primary_next_at = ?, accuweather_json = ?, accuweather_failures = ?, accuweather_next_at = ?, accuweather_location_key = ?, last_error = ?, lease_token = NULL, lease_until = 0 WHERE region = ? AND lease_token = ?')
      .bind(state.primary_json, state.primary_failures, state.primary_next_at, state.accuweather_json, state.accuweather_failures, state.accuweather_next_at, state.accuweather_location_key, state.last_error, region, token)
      .run();
  } finally {
    await runtime.db.prepare('UPDATE weather_cache SET lease_token = NULL, lease_until = 0 WHERE region = ? AND lease_token = ?').bind(region, token).run();
  }
  return readWeatherState(runtime.db, region);
}
