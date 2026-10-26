export const weatherRegions = {
  taipei: { id: 'taipei', name: '타이베이', latitude: 25.0339, longitude: 121.5645 },
  yehliu: { id: 'yehliu', name: '예류', latitude: 25.2052, longitude: 121.6904 },
  shifen: { id: 'shifen', name: '스펀', latitude: 25.0426, longitude: 121.7762 },
  jiufen: { id: 'jiufen', name: '지우펀', latitude: 25.1096, longitude: 121.8442 },
  wulai: { id: 'wulai', name: '우라이', latitude: 24.8650, longitude: 121.5505 },
  taoyuan: { id: 'taoyuan', name: '타오위안공항', latitude: 25.0797, longitude: 121.2342 },
} as const;
export type WeatherRegionId = keyof typeof weatherRegions;
export const dayRegions: Record<string, readonly WeatherRegionId[]> = {
  '2026-11-18': ['taipei', 'taoyuan'],
  '2026-11-19': ['yehliu', 'shifen', 'jiufen'],
  '2026-11-20': ['taipei'],
  '2026-11-21': ['wulai', 'taipei'],
  '2026-11-22': ['wulai', 'taoyuan'],
};
export const WEATHER_TIMEZONE = 'Asia/Taipei';
export type WeatherProvider = 'Open-Meteo' | 'CWA';
export type WeatherCurrent = {
  time: string; temperature: number | null; apparent: number | null;
  isDay: boolean | null; code: number | null; precipitation: number | null; wind: number | null;
  source?: WeatherProvider; kind?: 'model' | 'observation'; station?: string; fetchedAt?: string; stale?: boolean;
};
export type WeatherDay = { date: string; code: number | null; minimum: number | null; maximum: number | null; rainProbability: number | null; source?: WeatherProvider; fetchedAt?: string; stale?: boolean; summary?: string };
export type WeatherData = { fetchedAt: string; timezone: typeof WEATHER_TIMEZONE; current: WeatherCurrent | null; daily: WeatherDay[] };
export type WeatherResult = WeatherData & {
  provider: WeatherProvider; region: { id: WeatherRegionId; name: string }; requestedDate: string;
  selectedForecast: WeatherDay | null; availability: 'available' | 'not-yet' | 'past' | 'unavailable';
  forecastStart: string | null; forecastEnd: string | null; availableFrom: string; stale: boolean;
  refresh?: { needed: boolean; inProgress: boolean; nextAttemptAt: string | null; primaryFailures: number; fallback: 'standby' | 'active' | 'missing-key' | 'unavailable' };
};

export function isWeatherRegion(value: unknown): value is WeatherRegionId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(weatherRegions, value);
}
export function isValidWeatherDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function taipeiDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: WEATHER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)?.value).join('-');
}
export function shiftWeatherDate(date: string, amount: number): string {
  if (!isValidWeatherDate(date) || !Number.isInteger(amount)) throw new Error('Invalid weather date');
  return new Date(Date.parse(date + 'T00:00:00Z') + amount * 86400000).toISOString().slice(0, 10);
}
function numeric(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}
function code(value: unknown): number | null {
  const number = numeric(value, 0, 99);
  return number !== null && Number.isInteger(number) ? number : null;
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// Pure normalization: missing data stays null, never an invented 0 °C / 0%.
export function normalizeWeatherData(raw: unknown, fetchedAt: string): WeatherData {
  const response = object(raw), daily = object(response?.daily), current = object(response?.current);
  if (!response || response.error || response.timezone !== WEATHER_TIMEZONE || !daily || !Array.isArray(daily.time) || daily.time.length < 1 || daily.time.length > 16) throw new Error('Invalid weather response');
  const fields = ['weather_code', 'temperature_2m_min', 'temperature_2m_max', 'precipitation_probability_max'];
  if (!fields.every(field => Array.isArray(daily[field]) && (daily[field] as unknown[]).length === (daily.time as unknown[]).length)) throw new Error('Incomplete weather days');
  const dates = daily.time as unknown[];
  if (!dates.every(isValidWeatherDate) || new Set(dates).size !== dates.length || !dates.every((date, index) => index === 0 || (date as string) > (dates[index - 1] as string))) throw new Error('Invalid weather dates');
  const resultDays = (dates as string[]).map((date, index) => {
    const minimum = numeric((daily.temperature_2m_min as unknown[])[index], -90, 65);
    const maximum = numeric((daily.temperature_2m_max as unknown[])[index], -90, 65);
    const inverted = minimum !== null && maximum !== null && minimum > maximum;
    return { date, code: code((daily.weather_code as unknown[])[index]), minimum: inverted ? null : minimum, maximum: inverted ? null : maximum, rainProbability: numeric((daily.precipitation_probability_max as unknown[])[index], 0, 100) };
  });
  const validTime = typeof current?.time === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(current.time) && isValidWeatherDate(current.time.slice(0, 10));
  return {
    fetchedAt, timezone: WEATHER_TIMEZONE, daily: resultDays,
    current: current && validTime ? {
      time: current.time as string, temperature: numeric(current.temperature_2m, -90, 65), apparent: numeric(current.apparent_temperature, -110, 80),
      isDay: current.is_day === 1 ? true : current.is_day === 0 ? false : null, code: code(current.weather_code), precipitation: numeric(current.precipitation, 0, 2000), wind: numeric(current.wind_speed_10m, 0, 500),
    } : null,
  };
}
export function weatherResultForDate(data: WeatherData, region: WeatherRegionId, date: string, today: string, stale = false): WeatherResult {
  const selectedForecast = data.daily.find(day => day.date === date) ?? null;
  const forecastStart = data.daily[0]?.date ?? null, forecastEnd = data.daily[data.daily.length - 1]?.date ?? null;
  const availability = selectedForecast ? 'available' : date < today ? 'past' : forecastEnd && date > forecastEnd ? 'not-yet' : 'unavailable';
  return { ...data, provider: 'Open-Meteo', region: { id: region, name: weatherRegions[region].name }, requestedDate: date, selectedForecast, availability, forecastStart, forecastEnd, availableFrom: shiftWeatherDate(date, -15), stale };
}
export function weatherLabel(value: number | null): string {
  if (value === null) return '정보 없음';
  if (value === 0) return '맑음';
  if (value === 1) return '대체로 맑음';
  if (value === 2) return '구름 조금';
  if (value === 3) return '흐림';
  if (value === 45 || value === 48) return '안개';
  if ([51, 53, 55, 56, 57].includes(value)) return '이슬비';
  if ([61, 63, 65, 66, 67].includes(value)) return '비';
  if ([71, 73, 75, 77, 85, 86].includes(value)) return '눈';
  if ([80, 81, 82].includes(value)) return '소나기';
  if ([95, 96, 97, 99].includes(value)) return '뇌우';
  return '상태 확인 필요';
}
