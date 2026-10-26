'use client';
import { useEffect, useRef, useState } from 'react';
import { dayRegions, shiftWeatherDate, taipeiDate, weatherLabel, weatherRegions, type WeatherRegionId, type WeatherResult } from './weather-data';
import './weather.css';

const REFRESH_MS = 15 * 60 * 1000;
function dateLabel(date: string) { return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`; }
function value(number: number | null | undefined, suffix: string, digits = 0) { return typeof number === 'number' && Number.isFinite(number) ? `${number.toFixed(digits)}${suffix}` : '—'; }
function fetchedLabel(time: string) {
  const date = new Date(time);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) : '시각 확인 필요';
}
function sourceLabel(source: string) { return source === 'CWA' ? '대만 기상청' : 'Open-Meteo'; }
function pause(signal: AbortSignal, delay = 1500) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, delay);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
function WeatherSymbol({ code }: { code: number | null }) {
  const sunny = code === 0 || code === 1;
  const raining = code !== null && [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,97,99].includes(code);
  return <svg className="weather-symbol" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{sunny ? <><circle cx="20" cy="20" r="7"/><path d="M20 4v4m0 24v4M4 20h4m24 0h4M9 9l3 3m16 16 3 3M9 31l3-3m16-16 3-3"/></> : <><path d="M11 28a7 7 0 0 1-1-14 10 10 0 0 1 19-2 8 8 0 0 1 0 16H11Z"/>{raining && <path d="m13 32-2 4m11-4-2 4m11-4-2 4"/>}{code === null && <path d="M17 20h7"/>}</>}</svg>;
}

export default function WeatherPanel({ date, compact = false }: { date: string; compact?: boolean }) {
  const regions = dayRegions[date] ?? Object.keys(weatherRegions) as WeatherRegionId[];
  const [choice, setChoice] = useState<{ date: string; region: WeatherRegionId } | null>(null);
  const region = choice?.date === date && regions.includes(choice.region) ? choice.region : regions[0];
  const [result, setData] = useState<WeatherResult | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  const data = result?.region.id === region && result.requestedDate === date ? result : null;
  const lastRequest = useRef(0);
  const snapshots = useRef(new Map<string, WeatherResult>());
  useEffect(() => {
    const controller = new AbortController();
    let leaseRetry: ReturnType<typeof setTimeout> | undefined;
    const key = `${region}:${date}`;
    setData(previous => previous?.region.id === region && previous.requestedDate === date ? previous : snapshots.current.get(key) ?? null);
    setError(''); setLoading(true); lastRequest.current = Date.now();
    const remember = (next: WeatherResult) => {
      if (controller.signal.aborted) return;
      const previous = snapshots.current.get(key);
      const shown = !next.current && next.daily.length === 0 && (previous?.current || previous?.daily.length) ? { ...previous, stale: true, refresh: next.refresh } : next;
      snapshots.current.set(key, shown);
      if (snapshots.current.size > 50) snapshots.current.delete(snapshots.current.keys().next().value!);
      setData(shown);
    };
    const request = async (method: 'GET' | 'POST') => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const network = new AbortController();
      const cancel = () => network.abort();
      controller.signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, method === 'POST' ? 45000 : 10000);
      try {
        const response = await fetch(`/api/weather?${new URLSearchParams({ region, date })}`, { method, cache: 'no-store', signal: network.signal });
        if (response.status === 401 || response.status === 403) throw new Error('허용된 계정으로 로그인한 뒤 날씨를 확인해 주세요.');
        const next = await response.json().catch(() => null) as WeatherResult | null;
        const valid = next && ['Open-Meteo', 'CWA'].includes(next.provider) && next.region?.id === region && next.requestedDate === date && Array.isArray(next.daily);
        if (!response.ok) {
          if (response.status === 503 && valid) remember(next);
          throw new Error('날씨 연결이 잠시 지연되고 있어요. 잠시 후 다시 시도해 주세요.');
        }
        if (!valid) throw new Error('날씨 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
        return next;
      } catch (reason) {
        if (network.signal.aborted && !controller.signal.aborted) throw new Error('날씨 연결이 오래 걸리고 있어요. 마지막 정상 정보를 유지해요.');
        throw reason;
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', cancel);
      }
    };
    void (async () => {
      try {
        let next = await request('GET');
        remember(next);
        if (next.refresh?.needed && !next.refresh.inProgress) {
          next = await request('POST');
          remember(next);
        }
        const pollingDeadline = Date.now() + 45_000;
        for (let poll = 0; poll < 15 && next.refresh?.inProgress && Date.now() < pollingDeadline; poll++) {
          await pause(controller.signal, Math.min(1500 + poll * 500, 4000));
          next = await request('GET');
          remember(next);
        }
        if (next.refresh?.inProgress && next.refresh.nextAttemptAt) {
          const delay = Math.max(1000, Date.parse(next.refresh.nextAttemptAt) - Date.now() + 250);
          leaseRetry = setTimeout(() => { if (!controller.signal.aborted) setAttempt(number => number + 1); }, Math.min(delay, 90_000));
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '날씨를 불러오지 못했어요.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); clearTimeout(leaseRetry); };
  }, [region, date, attempt]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && Date.now() - lastRequest.current >= REFRESH_MS) setAttempt(number => number + 1); };
    const interval = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const selected = data?.selectedForecast;
  const current = data?.current;
  const hasWeather = !!current || !!data?.daily.length;
  const currentSource = current?.source ?? data?.provider ?? 'Open-Meteo';
  const observed = current?.kind === 'observation';
  const selectedSource = selected?.source ?? data?.provider ?? 'Open-Meteo';
  const delayed = hasWeather && (data?.stale || !!error);
  const sources = new Set([...(current ? [currentSource] : []), ...(data?.daily.map(day => day.source ?? data.provider) ?? [])]);
  const beyondWindow = date > shiftWeatherDate(taipeiDate(), 15);
  return <section className={`weather-panel${compact ? ' weather-compact' : ''}`} aria-label={`${weatherRegions[region].name} 날씨`}>
    <div className="weather-heading"><div><span className="weather-eyebrow">여행지 날씨</span><h2>{weatherRegions[region].name}</h2></div>{compact ? <a className="weather-more" href={`/weather?date=${date}`}>날씨 자세히 <span aria-hidden="true">↗</span></a> : <button className="weather-refresh" type="button" disabled={loading} onClick={() => setAttempt(number => number + 1)} aria-label="날씨 새로고침"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></svg></button>}</div>
    {!compact && <div className="weather-regions" aria-label="날씨를 볼 여행 지역">{regions.map(id => <button key={id} type="button" aria-pressed={region === id} onClick={() => setChoice({ date, region: id })}>{weatherRegions[id].name}</button>)}</div>}
    {loading && <p className="weather-loading" role="status">{hasWeather ? '저장된 날씨를 보면서 최신 정보를 확인하고 있어요.' : '최신 지역 날씨를 확인하고 있어요.'}</p>}
    {error && <div className="weather-error" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(number => number + 1)}>다시 시도</button></div>}
    {data && <>
      {!hasWeather && data.refresh && data.refresh.primaryFailures > 0 && !error && <p className="weather-source-status" role="status">날씨 제공기관의 응답이 지연되고 있어요. 정상 자료를 받으면 여기에 표시해요.</p>}
      {!loading && data.refresh?.nextAttemptAt && data.refresh.primaryFailures > 0 && <p className="weather-source-time">다시 확인 가능한 시각 {fetchedLabel(data.refresh.nextAttemptAt)} · 대만 시간</p>}
      {delayed && <p className="weather-stale" role="status">갱신 지연 · 마지막 확인 {fetchedLabel(data.fetchedAt)} · 대만 시간</p>}
      {data.refresh?.fallback === 'active' && <p className="weather-source-status">대만 기상청 예보로 연결했어요. 장기 예보는 마지막 정상 정보를 함께 표시해요.</p>}
      {data.refresh?.fallback === 'missing-key' && <p className="weather-source-status">대만 기상청 연결 설정이 필요해요. 제공 가능한 마지막 정상 정보를 유지해요.</p>}
      {data.refresh?.fallback === 'unavailable' && <p className="weather-source-status">대만 기상청 연결도 잠시 지연되고 있어요. 마지막 정상 정보를 유지해요.</p>}
      <div className="weather-current"><WeatherSymbol code={current?.code ?? null}/><div className="weather-current-main"><span>현재 날씨 · {observed ? '관측값' : current ? '모델 추정' : '정보 대기'}</span><div><strong>{value(current?.temperature, '°')}</strong><span>{weatherLabel(current?.code ?? null)}</span></div></div><div className="weather-feels"><span>체감</span><strong>{value(current?.apparent, '°')}</strong></div></div>
      <p className="weather-model-time">{current ? `${dateLabel(current.time.slice(0,10))} ${current.time.slice(11,16)} 기준 · 대만 현지시간 · ${sourceLabel(currentSource)}${current.station ? ` / ${current.station}` : ''}${current.stale ? ' · 갱신 지연' : ''}` : '현재 날씨 정보가 제공되지 않았어요. 예보와 관측값은 별도로 표시해요.'}</p>
      {!compact && current?.fetchedAt && <p className="weather-source-time">현재 날씨 마지막 확인 {fetchedLabel(current.fetchedAt)} · 대만 시간</p>}
      {!compact && current && <dl className="weather-current-details"><div><dt>강수량</dt><dd>{observed && current.precipitation === null ? '미제공' : value(current.precipitation, ' mm', 1)}</dd><small>{observed ? '현재 구간 누적량 미제공' : '모델 직전 구간 누적'}</small></div><div><dt>풍속</dt><dd>{value(current.wind, ' km/h', 1)}</dd><small>{observed ? '관측 지점 기준' : '지상 10m 기준'}</small></div></dl>}
      <div className="weather-trip"><h3>{dateLabel(date)} 여행일 예보</h3>{selected ? <><div className="weather-forecast-line"><span>{selected.summary || weatherLabel(selected.code)}</span><strong><span className="weather-low">{value(selected.minimum, '°')}</span><span aria-hidden="true"> / </span>{value(selected.maximum, '°')}</strong></div><p className="weather-rain">최저 / 최고 · {selectedSource === 'CWA' ? '12시간 구간 최대 강수확률' : '최대 강수확률'} {value(selected.rainProbability, '%')}</p><p className="weather-source-time">{sourceLabel(selectedSource)} · 마지막 확인 {fetchedLabel(selected.fetchedAt ?? data.fetchedAt)}{selected.stale ? ' · 갱신 지연' : ''}</p>{!compact && <p className="weather-hint">{selectedSource === 'CWA' ? '대만 시간 06시~다음 날 06시의 주야간 예보를 묶었어요. 강수확률은 12시간 구간 중 최댓값이며 하루 강수확률과 달라요.' : '하루 전체의 지역 예보예요. 방문 시각의 날씨와 다를 수 있어요.'}</p>}</> : <><p className="weather-unavailable">{data.availability === 'past' ? '예보 제공 기간이 지난 날짜예요.' : beyondWindow ? '아직 예보 제공 범위 밖이에요.' : '해당 날짜의 예보가 제공되지 않았어요.'}</p>{beyondWindow && <p className="weather-hint">최대 16일 예보 · {dateLabel(data.availableFrom)}경부터 확인 가능{compact ? '' : '해요. 제공되면 이곳에 자동으로 표시해요.'}</p>}{!beyondWindow && data.availability !== 'past' && data.provider === 'CWA' && <p className="weather-hint">대만 기상청은 최대 7일 예보를 제공해요. 16일 예보 연결이 복구되면 장기 예보도 확인할 수 있어요.</p>}{data.availability === 'past' && !compact && <p className="weather-hint">과거 관측 자료는 이 화면에서 제공하지 않아요.</p>}</>}</div>
      {!compact && hasWeather && <p className="weather-fetched">마지막 확인 {fetchedLabel(data.fetchedAt)} · 대만 시간{data.forecastEnd ? ` / 예보 ~${dateLabel(data.forecastEnd)}` : ''}</p>}
      {!compact && <p className="weather-hint weather-range">Open-Meteo 최대 16일 · 대만 기상청 최대 7일 / 강수확률 최대 3일. 먼 날짜의 예보는 바뀔 수 있어요.</p>}
    </>}
    {sources.size > 0 && <p className="weather-attribution">{sources.has('Open-Meteo') && <><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></>}{sources.has('CWA') && <>{sources.has('Open-Meteo') && <span aria-hidden="true" className="weather-source-divider"> / </span>}<a href="https://opendata.cwa.gov.tw/" target="_blank" rel="noreferrer">대만 중앙기상서 CWA</a></>}<span>출처·확인 시각은 각 정보에 표시 · 한국어 표현·반올림</span></p>}
    {!compact && <p className="weather-privacy">여행지 대표 좌표만 조회해요. 휴대폰 위치 권한이나 현재 위치 전송은 필요 없어요.</p>}
  </section>;
}
