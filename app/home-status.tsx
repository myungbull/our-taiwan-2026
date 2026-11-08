'use client';
import { useEffect, useState } from 'react';
import { taipeiDate, weatherLabel, type WeatherResult } from './weather-data';

type Weather = { place: string; temperature: number | null; summary: string; source: string };
const PREFERS_HERE = 'our-taiwan:weather-here';

function clock(timeZone: string, now: Date) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

async function taipeiWeather(): Promise<Weather | null> {
  const response = await fetch(`/api/weather?${new URLSearchParams({ region: 'taipei', date: taipeiDate() })}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const result = await response.json() as WeatherResult;
  const current = result.current, today = result.selectedForecast;
  if (current) return { place: '타이베이', temperature: current.temperature, summary: current.summary ?? weatherLabel(current.code), source: result.provider };
  if (today) return { place: '타이베이', temperature: today.maximum, summary: today.summary ?? weatherLabel(today.code), source: result.provider };
  return null;
}

// Open-Meteo needs no key and keeps the AccuWeather trial quota for the trip regions.
async function hereWeather(): Promise<Weather> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 10 * 60_000, timeout: 10_000 }));
  const params = new URLSearchParams({
    latitude: position.coords.latitude.toFixed(2), longitude: position.coords.longitude.toFixed(2),
    current: 'temperature_2m,weather_code', timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error('weather');
  const body = await response.json() as { current?: { temperature_2m?: number; weather_code?: number } };
  return { place: '현재 위치', temperature: body.current?.temperature_2m ?? null, summary: weatherLabel(body.current?.weather_code ?? null), source: 'Open-Meteo' };
}

export default function HomeStatus({ countdown }: { countdown: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let wantsHere = false;
    try { wantsHere = localStorage.getItem(PREFERS_HERE) === '1'; } catch { /* storage blocked */ }
    const load = wantsHere && 'geolocation' in navigator ? hereWeather().catch(() => taipeiWeather()) : taipeiWeather();
    void load.then((next) => { if (!cancelled) setWeather(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Location is asked only when tapped, so opening the home screen never pops a permission prompt.
  async function useHere() {
    if (!('geolocation' in navigator)) { setNote('이 브라우저는 위치를 지원하지 않아요.'); return; }
    setLocating(true); setNote('');
    try {
      setWeather(await hereWeather());
      try { localStorage.setItem(PREFERS_HERE, '1'); } catch { /* storage blocked */ }
    } catch {
      setNote('위치를 확인하지 못해 타이베이 날씨를 보여 줘요.');
    } finally { setLocating(false); }
  }

  const temperature = weather?.temperature;
  return <section className="home-status" aria-label="여행 상태">
    <div className="home-status-count"><small>대만 여행</small><strong>{countdown}</strong></div>
    <div className="home-status-clock"><small>대만</small><strong>{now ? clock('Asia/Taipei', now) : '--:--'}</strong></div>
    <div className="home-status-clock"><small>한국 +1h</small><strong>{now ? clock('Asia/Seoul', now) : '--:--'}</strong></div>
    <button type="button" className="home-status-weather" onClick={() => void useHere()} disabled={locating} title={weather ? `${weather.source} 기준 · 눌러서 현재 위치로` : '눌러서 현재 위치 날씨 보기'}>
      <small>{locating ? '위치 확인 중' : weather?.place ?? '날씨'}</small>
      <strong>{typeof temperature === 'number' ? `${Math.round(temperature)}°` : '—'}</strong>
      <span>{weather?.summary ?? '불러오는 중'}</span>
    </button>
    {note && <p className="home-status-note" role="status">{note}</p>}
  </section>;
}
