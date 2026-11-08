'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { WeatherRegionId, WeatherResult } from './weather-data';

type Forecasts = Partial<Record<WeatherRegionId, WeatherResult | null>>;
const StopWeatherContext = createContext<{ date: string; forecasts: Forecasts }>({ date: '', forecasts: {} });

async function load(region: WeatherRegionId, date: string, signal: AbortSignal): Promise<WeatherResult | null> {
  const ask = async (method: 'GET' | 'POST') => {
    const response = await fetch(`/api/weather?${new URLSearchParams({ region, date })}`, { method, cache: 'no-store', signal });
    const body = await response.json().catch(() => null) as WeatherResult | null;
    return body && Array.isArray(body.daily) && body.region?.id === region ? body : null;
  };
  let result = await ask('GET');
  // The day's main weather panel refreshes only its selected region, so refresh the others here.
  if (result?.refresh?.needed && !result.refresh.inProgress) result = await ask('POST').catch(() => result);
  return result;
}

// Loads each region of the day once and shares it with every stop of that day.
export function StopWeatherProvider({ date, regions, children }: { date: string; regions: readonly WeatherRegionId[]; children: ReactNode }) {
  const [forecasts, setForecasts] = useState<Forecasts>({});
  const regionKey = regions.join(',');
  useEffect(() => {
    const controller = new AbortController();
    setForecasts({});
    for (const region of new Set(regionKey.split(',') as WeatherRegionId[])) {
      void load(region, date, controller.signal)
        .then((result) => { if (!controller.signal.aborted) setForecasts((previous) => ({ ...previous, [region]: result })); })
        .catch(() => { if (!controller.signal.aborted) setForecasts((previous) => ({ ...previous, [region]: null })); });
    }
    return () => controller.abort();
  }, [date, regionKey]);
  return <StopWeatherContext.Provider value={{ date, forecasts }}>{children}</StopWeatherContext.Provider>;
}

const degrees = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}°` : '';
const rain = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `비 ${Math.round(value)}%` : '';

export function stopWeatherText(result: WeatherResult | null | undefined, date: string, hour: number): { text: string; detail: string } | null {
  if (!result) return null;
  const time = `${date}T${String(hour).padStart(2, '0')}:00`;
  const hourly = result.hourly?.find((entry) => entry.time === time);
  if (hourly) {
    return { text: [`${hour}시`, degrees(hourly.temperature), hourly.summary, rain(hourly.rainProbability)].filter(Boolean).join(' · '), detail: `${result.provider} 시간별 예보` };
  }
  const day = result.daily.find((entry) => entry.date === date);
  if (day) {
    const daytime = hour >= 7 && hour < 19;
    const half = daytime ? day.day : day.night;
    const range = day.minimum !== null && day.maximum !== null ? `${Math.round(day.minimum)}~${Math.round(day.maximum)}°` : '';
    return { text: [daytime ? '낮' : '밤', range, half?.summary ?? day.summary, rain(half?.rainProbability ?? day.rainProbability)].filter(Boolean).join(' · '), detail: `${result.provider} 일별 예보 · 시간별은 5일 전부터` };
  }
  if (result.availability === 'not-yet') return { text: '예보 대기', detail: '여행일이 예보 범위에 들어오면 표시돼요' };
  return null;
}

export function StopWeather({ region, hour }: { region: WeatherRegionId; hour: number }) {
  const { date, forecasts } = useContext(StopWeatherContext);
  if (!(region in forecasts)) return <span className="stop-weather is-loading" aria-hidden="true">날씨…</span>;
  const shown = stopWeatherText(forecasts[region], date, hour);
  if (!shown) return null;
  return <span className="stop-weather" title={shown.detail}>{shown.text}</span>;
}
