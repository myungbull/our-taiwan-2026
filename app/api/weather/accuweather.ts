import { WEATHER_TIMEZONE, type WeatherData, type WeatherRegionId } from '../../weather-data';

type FetchJson = (url: URL, provider: 'AccuWeather', region: WeatherRegionId, apiKey?: string) => Promise<unknown>;
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function number(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

function measurement(value: unknown, minimum: number, maximum: number): number | null {
  const row = object(value);
  const direct = number(row?.Value, minimum, maximum);
  if (direct !== null) return direct;
  return number(object(row?.Metric)?.Value, minimum, maximum);
}

function taipeiDateTime(value: unknown): { date: string; time: string } | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEATHER_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find(part => part.type === type)?.value;
  const year = pick('year'), month = pick('month'), day = pick('day'), hour = pick('hour'), minute = pick('minute');
  if (!year || !month || !day || !hour || !minute) return null;
  return { date: year + '-' + month + '-' + day, time: year + '-' + month + '-' + day + 'T' + hour + ':' + minute };
}

function probability(value: unknown): number | null {
  return number(value, 0, 100);
}

export function normalizeAccuWeatherData(forecastRaw: unknown, currentRaw: unknown, fetchedAt: string): WeatherData {
  const forecast = object(forecastRaw);
  const rawDays = forecast?.DailyForecasts;
  if (!forecast || forecast.error || !Array.isArray(rawDays) || rawDays.length < 1 || rawDays.length > 15) throw new Error('invalid-data');

  const daily = rawDays.map((rawDay): WeatherData['daily'][number] => {
    const day = object(rawDay);
    const localized = taipeiDateTime(day?.Date);
    const temperature = object(day?.Temperature);
    const daytime = object(day?.Day);
    const nighttime = object(day?.Night);
    if (!day || !localized || !temperature || !daytime || !nighttime) throw new Error('invalid-data');

    const minimum = measurement(temperature.Minimum, -90, 65);
    const maximum = measurement(temperature.Maximum, -90, 65);
    const inverted = minimum !== null && maximum !== null && minimum > maximum;
    const phrases = [daytime.IconPhrase, nighttime.IconPhrase]
      .filter((phrase): phrase is string => typeof phrase === 'string' && phrase.trim().length > 0)
      .map(phrase => phrase.trim());
    const probabilities = [probability(daytime.PrecipitationProbability), probability(nighttime.PrecipitationProbability)]
      .filter((value): value is number => value !== null);

    return {
      date: localized.date,
      code: null,
      minimum: inverted ? null : minimum,
      maximum: inverted ? null : maximum,
      rainProbability: probabilities.length ? Math.max(...probabilities) : null,
      summary: [...new Set(phrases)].join(' · ') || '예보 설명 없음',
    };
  });

  if (daily.some((day, index) => index > 0 && day.date <= daily[index - 1].date)) throw new Error('invalid-data');

  const rawCurrent = Array.isArray(currentRaw) ? currentRaw[0] : currentRaw;
  const currentRow = object(rawCurrent);
  const currentTime = taipeiDateTime(currentRow?.LocalObservationDateTime);
  const current = currentRow && currentTime ? {
    time: currentTime.time,
    temperature: measurement(object(currentRow.Temperature)?.Metric, -90, 65),
    apparent: measurement(object(currentRow.RealFeelTemperature)?.Metric, -110, 80),
    isDay: currentRow.IsDayTime === true ? true : currentRow.IsDayTime === false ? false : null,
    code: null,
    precipitation: measurement(object(currentRow.Precip1hr)?.Metric, 0, 2000),
    wind: measurement(object(object(currentRow.Wind)?.Speed)?.Metric, 0, 500),
    summary: typeof currentRow.WeatherText === 'string' && currentRow.WeatherText.trim() ? currentRow.WeatherText.trim() : undefined,
  } : null;

  return { fetchedAt, timezone: WEATHER_TIMEZONE, current, daily };
}

async function getLocationKey(region: WeatherRegionId, apiKey: string, fetchJson: FetchJson, coordinates: { latitude: number; longitude: number }): Promise<string> {
  const url = new URL('https://dataservice.accuweather.com/locations/v1/cities/geoposition/search');
  url.search = new URLSearchParams({
    q: coordinates.latitude + ',' + coordinates.longitude,
    language: 'ko-kr',
  }).toString();
  const raw = await fetchJson(url, 'AccuWeather', region, apiKey);
  const first = Array.isArray(raw) ? object(raw[0]) : null;
  const key = first?.Key;
  if (typeof key !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(key)) throw new Error('invalid-location');
  return key;
}

export async function loadAccuWeather(
  region: WeatherRegionId,
  apiKey: string,
  cachedLocationKey: string | null,
  coordinates: { latitude: number; longitude: number },
  fetchJson: FetchJson,
  fetchedAt: string,
): Promise<{ data: WeatherData; locationKey: string }> {
  const locationKey = cachedLocationKey || await getLocationKey(region, apiKey, fetchJson, coordinates);
  const forecastUrl = new URL('https://dataservice.accuweather.com/forecasts/v1/daily/15day/' + encodeURIComponent(locationKey));
  forecastUrl.search = new URLSearchParams({ language: 'ko-kr', details: 'false', metric: 'true' }).toString();
  const currentUrl = new URL('https://dataservice.accuweather.com/currentconditions/v1/' + encodeURIComponent(locationKey));
  currentUrl.search = new URLSearchParams({ language: 'ko-kr', details: 'true' }).toString();
  const [forecast, current] = await Promise.all([
    fetchJson(forecastUrl, 'AccuWeather', region, apiKey),
    fetchJson(currentUrl, 'AccuWeather', region, apiKey),
  ]);
  return { data: normalizeAccuWeatherData(forecast, current, fetchedAt), locationKey };
}
