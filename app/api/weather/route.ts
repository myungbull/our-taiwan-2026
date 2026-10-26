import { requireAllowedMember, isResponse } from '../_lib/auth';
import { isValidWeatherDate, isWeatherRegion, normalizeWeatherData, taipeiDate, weatherRegions, weatherResultForDate, type WeatherData, type WeatherRegionId } from '../../weather-data';

export const dynamic = 'force-dynamic';
const CACHE_MS = 15 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const responseHeaders = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
type Cached = { data: WeatherData; savedAt: number; taipeiDay: string };
const cache = new Map<WeatherRegionId, Cached>();
const pending = new Map<string, Promise<Cached>>();

async function loadWeather(region: WeatherRegionId, today: string): Promise<Cached> {
  const key = `${region}:${today}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const place = weatherRegions[region];
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,apparent_temperature,is_day,weather_code,precipitation,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'Asia/Taipei', forecast_days: '16', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' }).toString();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // No identity headers, browser cookies, or user GPS are sent upstream.
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Weather provider unavailable');
      const savedAt = Date.now();
      const data = normalizeWeatherData(await response.json(), new Date(savedAt).toISOString());
      const entry = { data, savedAt, taipeiDay: today };
      cache.set(region, entry);
      return entry;
    } finally { clearTimeout(timeout); }
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

export async function GET(request: Request) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  const params = new URL(request.url).searchParams, region = params.get('region'), date = params.get('date');
  if (!isWeatherRegion(region) || !isValidWeatherDate(date)) return Response.json({ error: '올바른 여행 지역과 날짜를 선택해 주세요.' }, { status: 400, headers: responseHeaders });
  const now = Date.now(), today = taipeiDate(new Date(now)), previous = cache.get(region);
  if (previous && previous.taipeiDay === today && now - previous.savedAt < CACHE_MS) return Response.json(weatherResultForDate(previous.data, region, date, today), { headers: responseHeaders });
  try {
    const latest = await loadWeather(region, today);
    return Response.json(weatherResultForDate(latest.data, region, date, taipeiDate()), { headers: responseHeaders });
  } catch {
    if (previous && now - previous.savedAt <= STALE_MS) return Response.json(weatherResultForDate(previous.data, region, date, today, true), { headers: responseHeaders });
    return Response.json({ error: '날씨를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.' }, { status: 503, headers: responseHeaders });
  }
}
