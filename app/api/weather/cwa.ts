import { isValidWeatherDate, shiftWeatherDate, taipeiDate, WEATHER_TIMEZONE, weatherRegions, type WeatherCurrent, type WeatherData, type WeatherDay, type WeatherRegionId } from '../../weather-data';

// Official 7-day township datasets. These are fixed destinations, never visitor GPS.
const destinations: Record<WeatherRegionId, { dataset: string; location: string }> = {
  taipei: { dataset: 'F-D0047-063', location: '信義區' },
  yehliu: { dataset: 'F-D0047-071', location: '萬里區' },
  shifen: { dataset: 'F-D0047-071', location: '平溪區' },
  jiufen: { dataset: 'F-D0047-071', location: '瑞芳區' },
  wulai: { dataset: 'F-D0047-071', location: '烏來區' },
  taoyuan: { dataset: 'F-D0047-007', location: '大園區' },
};
type JsonObject = Record<string, unknown>;
type Period = { start: number; end: number; value: JsonObject };
type FetchJson = (url: URL, provider: 'CWA', region: WeatherRegionId) => Promise<unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function number(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}
function timestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !isValidWeatherDate(value.slice(0, 10))) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function localTime(time: number): string {
  // Fixed UTC+08:00, the timezone used by this trip and all CWA forecast periods.
  return new Date(time + 8 * 3600000).toISOString().slice(0, 19);
}
function records(raw: unknown): JsonObject {
  const response = object(raw);
  if (!response || ![true, 'true'].includes(response.success as boolean | string) || !object(response.records)) throw new Error('invalid-data');
  return response.records as JsonObject;
}
function cleanText(value: unknown, limit = 100): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text && text.length <= limit ? text : null;
}

// CWA numeric codes are NOT WMO codes. Convert only broad textual conditions.
function condition(value: unknown): { code: number | null; summary: string | null } {
  const text = cleanText(value);
  if (!text || text === '-' || text === '-99') return { code: null, summary: null };
  if (text.includes('雷')) return { code: 95, summary: '뇌우' };
  if (text.includes('雪')) return { code: 71, summary: '눈' };
  if (text.includes('雨')) return { code: 61, summary: text.includes('短暫') ? '한때 비' : '비' };
  if (text.includes('霧')) return { code: 45, summary: '안개' };
  if (text.includes('陰')) return { code: 3, summary: '흐림' };
  if (text.includes('多雲')) return { code: 2, summary: '구름 많음' };
  if (text.includes('晴')) return { code: 0, summary: '맑음' };
  return { code: null, summary: `CWA 원문: ${text}` };
}
function periods(element: unknown): Period[] {
  return list(object(element)?.Time).flatMap(raw => {
    const time = object(raw), start = timestamp(time?.StartTime), end = timestamp(time?.EndTime);
    const values = list(time?.ElementValue), value = object(values[0]);
    if (start === null || end === null || !value || end <= start || end - start > 24 * 3600000) return [];
    return [{ start, end, value }];
  }).sort((a, b) => a.start - b.start);
}
function extremes(values: Array<number | null>, kind: 'minimum' | 'maximum'): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? kind === 'minimum' ? Math.min(...present) : Math.max(...present) : null;
}

export function normalizeCwaForecast(raw: unknown, region: WeatherRegionId, now: number): WeatherDay[] {
  const destination = destinations[region];
  const places = list(records(raw).Locations).flatMap(group => list(object(group)?.Location));
  const location = places.map(object).find(place => place?.LocationName === destination.location);
  if (!location) throw new Error('invalid-data');
  const elements = list(location.WeatherElement).map(object);
  const byName = (name: string) => periods(elements.find(element => element?.ElementName === name));
  const lows = byName('最低溫度'), highs = byName('最高溫度');
  const weather = byName('天氣現象'), rain = byName('12小時降雨機率');
  if (!lows.length || !highs.length || lows.length > 32 || highs.length > 32) throw new Error('invalid-data');
  const today = taipeiDate(new Date(now)), lastDate = shiftWeatherDate(today, 6);
  const dates = [...new Set([...lows, ...highs].map(period => localTime(period.start).slice(0, 10)))].filter(date => date >= today && date <= lastDate).sort();
  const fetchedAt = new Date(now).toISOString();
  const daily = dates.flatMap(date => {
    // CWA publishes day 06–18 and night 18–06. Pair periods starting on this
    // date; do not assign a whole overnight range to both calendar dates.
    // The UI identifies this as a day/night range, not a 00–24 observation.
    const startsOn = (period: Period) => localTime(period.start).slice(0, 10) === date;
    const minimum = extremes(lows.filter(startsOn).map(period => number(period.value.MinTemperature, -90, 65)), 'minimum');
    const maximum = extremes(highs.filter(startsOn).map(period => number(period.value.MaxTemperature, -90, 65)), 'maximum');
    if (minimum === null || maximum === null || minimum > maximum) return [];
    const summaries = weather.filter(startsOn).map(period => condition(period.value.Weather)).filter(item => item.summary);
    // Keep the broadest adverse condition for the icon and both daytime/night
    // descriptions in text. No CWA WeatherCode is passed through as WMO.
    const severity = (code: number | null) => code === 95 ? 6 : code === 71 ? 5 : code === 61 ? 4 : code === 45 ? 3 : code === 3 ? 2 : code === 2 ? 1 : 0;
    const primary = [...summaries].sort((a, b) => severity(b.code) - severity(a.code))[0];
    // Available PoP is a maximum of supplied 12-hour probabilities, not a
    // computed 24-hour probability. CWA only supplies it within three days.
    const rainProbability = date <= shiftWeatherDate(today, 2) ? extremes(rain.filter(startsOn).map(period => number(period.value.ProbabilityOfPrecipitation, 0, 100)), 'maximum') : null;
    return [{ date, minimum, maximum, rainProbability, code: primary?.code ?? null, summary: [...new Set(summaries.map(item => item.summary))].join(' / ') || 'CWA 날씨 설명 없음', source: 'CWA' as const, fetchedAt }];
  });
  if (!daily.length) throw new Error('invalid-data');
  return daily;
}

function distanceKm(latitude: number, longitude: number, stationLatitude: number, stationLongitude: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(stationLatitude - latitude), deltaLongitude = radians(stationLongitude - longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(stationLatitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function normalizeCwaObservations(raw: unknown, region: WeatherRegionId, now: number): WeatherCurrent | null {
  const destination = weatherRegions[region];
  const stations = list(records(raw).Station).map(object).flatMap(station => {
    const time = timestamp(object(station?.ObsTime)?.DateTime), geo = object(station?.GeoInfo), weather = object(station?.WeatherElement);
    const wgs84 = list(geo?.Coordinates).map(object).find(coordinates => coordinates?.CoordinateName === 'WGS84');
    const latitude = number(wgs84?.StationLatitude, -90, 90), longitude = number(wgs84?.StationLongitude, -180, 180);
    const name = cleanText(station?.StationName, 50), temperature = number(weather?.AirTemperature, -90, 65);
    if (time === null || now - time > 90 * 60000 || time > now + 10 * 60000 || latitude === null || longitude === null || !name || !weather || temperature === null) return [];
    const distance = distanceKm(destination.latitude, destination.longitude, latitude, longitude);
    if (distance > 30) return [];
    const wind = number(weather.WindSpeed, 0, 140);
    return [{ distance, current: {
      time: localTime(time), temperature, apparent: null, isDay: null,
      code: condition(weather.Weather).code,
      // Now.Precipitation is an accumulation and cannot be presented as the
      // model's current precipitation amount. Preserve that distinction.
      precipitation: null, wind: wind === null ? null : Math.round(wind * 3.6 * 10) / 10,
      source: 'CWA' as const, kind: 'observation' as const,
      station: `${name} · 약 ${Math.round(distance)}km`, fetchedAt: new Date(now).toISOString(),
    } }];
  }).sort((a, b) => a.distance - b.distance);
  return stations[0]?.current ?? null;
}

export async function loadCwaWeather(region: WeatherRegionId, key: string, fetchJson: FetchJson, now: number): Promise<WeatherData> {
  if (!key.trim()) throw new Error('missing-key');
  const destination = destinations[region];
  const forecastUrl = new URL(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/${destination.dataset}`);
  forecastUrl.searchParams.set('Authorization', key);
  forecastUrl.searchParams.set('format', 'JSON');
  forecastUrl.searchParams.set('LocationName', destination.location);
  forecastUrl.searchParams.set('ElementName', '最高溫度,最低溫度,天氣現象,12小時降雨機率');
  forecastUrl.searchParams.set('sort', 'time');
  const observationUrl = new URL('https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001');
  observationUrl.searchParams.set('Authorization', key);
  observationUrl.searchParams.set('format', 'JSON');
  // Parallel bounded requests. A failed observation must not discard the
  // independently valid 7-day forecast. Neither URL is ever logged here.
  const [forecast, observation] = await Promise.allSettled([
    fetchJson(forecastUrl, 'CWA', region), fetchJson(observationUrl, 'CWA', region),
  ]);
  if (forecast.status === 'rejected') throw forecast.reason;
  const daily = normalizeCwaForecast(forecast.value, region, now);
  let current: WeatherCurrent | null = null;
  if (observation.status === 'fulfilled') {
    try { current = normalizeCwaObservations(observation.value, region, now); } catch { /* A forecast remains useful without a nearby observation. */ }
  }
  return { fetchedAt: new Date(now).toISOString(), timezone: WEATHER_TIMEZONE, current, daily };
}
