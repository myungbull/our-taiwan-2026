import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { ACCUWEATHER_SWITCH_DATE, dayRegions, shiftWeatherDate, taipeiDate } from '../app/weather-data.ts';
import { ACCUWEATHER_FRESH_MS, readWeatherState, refreshWeather, resultFromState } from '../app/api/weather/service.ts';
import { normalizeAccuWeatherData, normalizeAccuWeatherHourly } from '../app/api/weather/accuweather.ts';

// Fake key used only by this test; it must never appear in URLs, logs or stored errors.
const KEY = 'test-accuweather-key-not-real';
const BEFORE_SWITCH = Date.parse('2026-11-07T15:59:59Z'); // 2026-11-07 23:59:59 Asia/Taipei
const AT_SWITCH = Date.parse('2026-11-07T16:00:00Z'); // 2026-11-08 00:00:00 Asia/Taipei
const MINUTE = 60_000;

// Minimal D1 adapter over node:sqlite with the real drizzle migrations applied.
function createDb() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, dir), 'utf8'));
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind: (...values) => ({ run: async () => statement.run(...values), first: async () => statement.get(...values) ?? null }) };
    },
  };
}

function openMeteoBody(start, days = 16) {
  const time = Array.from({ length: days }, (_, index) => shiftWeatherDate(start, index));
  return {
    timezone: 'Asia/Taipei',
    current: { time: start + 'T09:00', temperature_2m: 22, apparent_temperature: 23, is_day: 1, weather_code: 3, precipitation: 0, wind_speed_10m: 9 },
    daily: { time, weather_code: time.map(() => 3), temperature_2m_min: time.map(() => 18), temperature_2m_max: time.map(() => 24), precipitation_probability_max: time.map(() => 30) },
  };
}

function accuWeatherForecast(start, days = 15) {
  return {
    DailyForecasts: Array.from({ length: days }, (_, index) => ({
      Date: shiftWeatherDate(start, index) + 'T07:00:00+08:00',
      Temperature: { Minimum: { Value: 19 }, Maximum: { Value: 25 } },
      Day: { IconPhrase: '구름 많음', PrecipitationProbability: 40 },
      Night: { IconPhrase: '비', PrecipitationProbability: 60 },
    })),
  };
}

const accuWeatherCurrent = [{
  LocalObservationDateTime: '2026-11-08T09:00:00+08:00',
  Temperature: { Metric: { Value: 21 } }, RealFeelTemperature: { Metric: { Value: 22 } },
  IsDayTime: true, WeatherText: '흐림', Precip1hr: { Metric: { Value: 0 } }, Wind: { Speed: { Metric: { Value: 10 } } },
}];

// 120 hourly rows from 09:00 Taipei on `start`, in AccuWeather's +08:00 format.
function accuWeatherHourly(start, hours = 120) {
  const first = Date.parse(start + 'T01:00:00Z');
  return Array.from({ length: hours }, (_, index) => ({
    DateTime: new Date(first + index * 3_600_000 + 8 * 3_600_000).toISOString().slice(0, 19) + '+08:00',
    Temperature: { Value: 20 + (index % 5), Unit: 'C' },
    PrecipitationProbability: index % 100,
    IconPhrase: index % 2 ? '소나기' : '흐림',
  }));
}

// Routes requests by provider/path; `fail` overrides AccuWeather daily responses, `failHourly` the hourly ones.
function createFetch({ start, fail, failHourly } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), authorization: init.headers.get('Authorization') });
    if (url.hostname === 'api.open-meteo.com') return Response.json(openMeteoBody(start));
    if (url.pathname.includes('/locations/')) return Response.json({ Key: '315078' });
    if (url.pathname.includes('/forecasts/v1/daily/15day/')) return fail ? fail() : Response.json(accuWeatherForecast(start));
    if (url.pathname.includes('/currentconditions/')) return Response.json(accuWeatherCurrent);
    if (url.pathname.includes('/forecasts/v1/hourly/120hour/')) return failHourly ? failHourly() : Response.json(accuWeatherHourly(start));
    throw new Error('unexpected url ' + url);
  };
  return { fetch, calls };
}

function runtime(db, now, options = {}) {
  const logs = [];
  const mock = createFetch({ start: taipeiDate(new Date(now)), fail: options.fail, failHourly: options.failHourly });
  return { logs, calls: mock.calls, value: { db, key: options.key, fetch: mock.fetch, now: () => now, sleep: async () => {}, log: event => logs.push(event) } };
}

test('the AccuWeather switch happens at 2026-11-08 00:00 Asia/Taipei, not UTC midnight', () => {
  assert.equal(ACCUWEATHER_SWITCH_DATE, '2026-11-08');
  assert.equal(taipeiDate(new Date(BEFORE_SWITCH)), '2026-11-07');
  assert.equal(taipeiDate(new Date(AT_SWITCH)), '2026-11-08');
});

test('before the switch only Open-Meteo is called, even when a key exists', async () => {
  const db = createDb(), run = runtime(db, BEFORE_SWITCH, { key: KEY });
  const state = await refreshWeather(run.value, 'taipei');
  assert.ok(run.calls.length > 0);
  assert.ok(run.calls.every(call => call.url.startsWith('https://api.open-meteo.com/')));
  const result = resultFromState(state, 'taipei', '2026-11-20', BEFORE_SWITCH, true);
  assert.equal(result.provider, 'Open-Meteo');
  assert.equal(result.refresh.switchState, 'scheduled');
});

test('from the switch AccuWeather is called with a Bearer header and the key never appears in URLs', async () => {
  const db = createDb(), run = runtime(db, AT_SWITCH, { key: KEY });
  const state = await refreshWeather(run.value, 'taipei');
  assert.equal(run.calls.length, 4, 'location + daily + current + hourly');
  assert.ok(run.calls.every(call => new URL(call.url).hostname === 'dataservice.accuweather.com'));
  assert.equal(run.calls.filter(call => new URL(call.url).pathname === '/forecasts/v1/hourly/120hour/315078' && new URL(call.url).searchParams.get('metric') === 'true').length, 1);
  assert.ok(run.calls.every(call => call.authorization === 'Bearer ' + KEY && !call.url.includes(KEY)));
  assert.equal(state.accuweather_location_key, '315078');
  const result = resultFromState(state, 'taipei', '2026-11-20', AT_SWITCH, true);
  assert.equal(result.provider, 'AccuWeather');
  assert.equal(result.refresh.switchState, 'active');
  assert.equal(result.current.kind, 'observation');
  assert.equal(result.selectedForecast.rainProbability, 60);
});

test('on 11/8 the 15-day AccuWeather forecast covers every trip day 11/18–11/22 and nothing later', async () => {
  const db = createDb();
  for (const [date, regions] of Object.entries(dayRegions)) {
    for (const region of regions) {
      const state = await refreshWeather(runtime(db, AT_SWITCH, { key: KEY }).value, region);
      const result = resultFromState(state, region, date, AT_SWITCH, true);
      assert.equal(result.availability, 'available', `${region} ${date}`);
      assert.equal(result.selectedForecast.source, 'AccuWeather');
    }
  }
  const state = await readWeatherState(db, 'taipei');
  assert.equal(resultFromState(state, 'taipei', '2026-11-23', AT_SWITCH, true).availability, 'not-yet');
});

test('before the switch, trip days beyond the 16-day Open-Meteo window are reported as not yet available', async () => {
  const now = Date.parse('2026-11-02T01:00:00Z'), db = createDb();
  const state = await refreshWeather(runtime(db, now).value, 'taipei');
  const result = resultFromState(state, 'taipei', '2026-11-18', now, false);
  assert.equal(result.forecastEnd, '2026-11-17');
  assert.equal(result.selectedForecast, null);
  assert.equal(result.availability, 'not-yet');
  assert.equal(result.availableFrom, '2026-11-03');
});

test('a missing key after the switch makes no request, keeps old Open-Meteo data marked stale and reports missing-key', async () => {
  const db = createDb();
  await refreshWeather(runtime(db, BEFORE_SWITCH).value, 'taipei');
  const later = AT_SWITCH + 30 * MINUTE;
  for (const key of [undefined, '', '   ']) {
    const run = runtime(db, later, { key });
    const state = await refreshWeather(run.value, 'taipei');
    assert.equal(run.calls.length, 0);
    const result = resultFromState(state, 'taipei', '2026-11-20', later, Boolean(key?.trim()));
    assert.equal(result.refresh.switchState, 'missing-key');
    assert.equal(result.refresh.needed, false);
    assert.equal(result.provider, 'Open-Meteo');
    assert.equal(result.stale, true);
    assert.ok(result.daily.every(day => day.source === 'Open-Meteo' && day.stale));
  }
});

test('a fresh AccuWeather cache is reused for two hours, then the cached location key skips the lookup', async () => {
  assert.equal(ACCUWEATHER_FRESH_MS, 120 * MINUTE);
  const db = createDb();
  await refreshWeather(runtime(db, AT_SWITCH, { key: KEY }).value, 'taipei');
  const cached = runtime(db, AT_SWITCH + 119 * MINUTE, { key: KEY });
  await refreshWeather(cached.value, 'taipei');
  assert.equal(cached.calls.length, 0);
  const due = runtime(db, AT_SWITCH + ACCUWEATHER_FRESH_MS, { key: KEY });
  await refreshWeather(due.value, 'taipei');
  assert.equal(due.calls.length, 3, 'daily + current + hourly');
  assert.ok(due.calls.every(call => !call.url.includes('/locations/')));
});

test('an AccuWeather outage keeps the last snapshot, marks it stale, backs off two hours and never logs the key', async () => {
  const db = createDb();
  await refreshWeather(runtime(db, AT_SWITCH, { key: KEY }).value, 'taipei');
  const now = AT_SWITCH + ACCUWEATHER_FRESH_MS;
  const run = runtime(db, now, { key: KEY, fail: () => new Response('down', { status: 503 }) });
  const state = await refreshWeather(run.value, 'taipei');
  assert.equal(run.calls.filter(call => call.url.includes('/15day/')).length, 2, '503 is retried once');
  assert.equal(state.accuweather_failures, 1);
  assert.equal(state.accuweather_next_at, now + ACCUWEATHER_FRESH_MS);
  assert.equal(state.last_error, 'AccuWeather:http-error:503');
  assert.equal(state.lease_until, 0);
  assert.ok(!JSON.stringify(run.logs).includes(KEY) && !JSON.stringify(run.logs).includes('accuweather.com'));
  const result = resultFromState(state, 'taipei', '2026-11-20', now, true);
  assert.equal(result.refresh.switchState, 'unavailable');
  assert.equal(result.provider, 'AccuWeather');
  assert.equal(result.stale, true);
  assert.equal(result.availability, 'available');
});

test('an authorization error (e.g. a plan without the 15-day endpoint) is not retried', async () => {
  const db = createDb(), run = runtime(db, AT_SWITCH, { key: KEY, fail: () => new Response('{"Code":"Unauthorized"}', { status: 401 }) });
  const state = await refreshWeather(run.value, 'taipei');
  assert.equal(run.calls.filter(call => call.url.includes('/15day/')).length, 1);
  assert.equal(state.accuweather_failures, 1);
  assert.equal(state.accuweather_json, null);
  const result = resultFromState(state, 'taipei', '2026-11-20', AT_SWITCH, true);
  assert.equal(result.refresh.switchState, 'unavailable');
  assert.equal(result.selectedForecast, null);
});

test('malformed AccuWeather data is rejected instead of stored', async () => {
  const db = createDb(), run = runtime(db, AT_SWITCH, { key: KEY, fail: () => Response.json({ DailyForecasts: [] }) });
  const state = await refreshWeather(run.value, 'taipei');
  assert.equal(state.accuweather_json, null);
  assert.equal(state.last_error, 'AccuWeather:invalid-data:0');
});

test('hourly AccuWeather rows are normalized to Taipei local time and invalid rows are dropped', () => {
  const hours = normalizeAccuWeatherHourly([
    { DateTime: '2026-11-08T09:00:00+08:00', Temperature: { Value: 21.4, Unit: 'C' }, PrecipitationProbability: 35, IconPhrase: ' 흐림 ' },
    { DateTime: '2026-11-08T02:00:00Z', Temperature: { Value: 22 }, PrecipitationProbability: 140, IconPhrase: '' },
    { DateTime: '2026-11-08T10:00:00+08:00', Temperature: { Value: 23 } }, // duplicate hour
    { DateTime: 'not-a-date', Temperature: { Value: 23 } },
    null,
    { DateTime: '2026-11-08T11:00:00+08:00', Temperature: { Value: 999 }, PrecipitationProbability: 0, IconPhrase: '비' },
  ]);
  assert.deepEqual(hours, [
    { time: '2026-11-08T09:00', temperature: 21.4, rainProbability: 35, summary: '흐림' },
    { time: '2026-11-08T10:00', temperature: 22, rainProbability: null, summary: undefined },
    { time: '2026-11-08T11:00', temperature: null, rainProbability: 0, summary: '비' },
  ]);
  assert.throws(() => normalizeAccuWeatherHourly({ error: true }), /invalid-data/);
});

test('a full refresh stores 120 hourly rows and resultFromState passes on only those from Taipei today onward', async () => {
  const db = createDb();
  const state = await refreshWeather(runtime(db, AT_SWITCH, { key: KEY }).value, 'taipei');
  assert.equal(JSON.parse(state.accuweather_json).data.hourly.length, 120);
  const result = resultFromState(state, 'taipei', '2026-11-08', AT_SWITCH, true);
  assert.equal(result.hourly.length, 120);
  assert.deepEqual(result.hourly[0], { time: '2026-11-08T09:00', temperature: 20, rainProbability: 0, summary: '흐림' });
  const nextDay = AT_SWITCH + 24 * 60 * MINUTE;
  const later = resultFromState(state, 'taipei', '2026-11-09', nextDay, true);
  assert.ok(later.hourly.length > 0 && later.hourly.every(hour => hour.time >= '2026-11-09'));
  assert.equal(later.hourly[0].time, '2026-11-09T00:00');
});

test('an hourly failure keeps the daily and current refresh and stores hourly as []', async () => {
  for (const failHourly of [() => new Response('down', { status: 503 }), () => new Response('{"Code":"Unauthorized"}', { status: 401 }), () => Response.json({ broken: true })]) {
    const db = createDb(), run = runtime(db, AT_SWITCH, { key: KEY, failHourly });
    const state = await refreshWeather(run.value, 'taipei');
    assert.equal(state.accuweather_failures, 0);
    assert.equal(state.last_error, null);
    assert.equal(state.accuweather_next_at, AT_SWITCH + ACCUWEATHER_FRESH_MS);
    assert.deepEqual(JSON.parse(state.accuweather_json).data.hourly, []);
    const result = resultFromState(state, 'taipei', '2026-11-20', AT_SWITCH, true);
    assert.equal(result.refresh.switchState, 'active');
    assert.equal(result.stale, false);
    assert.deepEqual(result.hourly, []);
    assert.equal(result.current.kind, 'observation');
    assert.equal(result.selectedForecast.rainProbability, 60);
    assert.ok(!JSON.stringify(run.logs).includes(KEY));
  }
});

test('AccuWeather daily forecasts keep day and night halves separately', () => {
  const forecast = accuWeatherForecast('2026-11-08', 2);
  forecast.DailyForecasts[1].Day = { IconPhrase: '  ', PrecipitationProbability: 120 };
  const data = normalizeAccuWeatherData(forecast, accuWeatherCurrent, '2026-11-08T01:00:00.000Z');
  assert.deepEqual(data.daily[0].day, { summary: '구름 많음', rainProbability: 40 });
  assert.deepEqual(data.daily[0].night, { summary: '비', rainProbability: 60 });
  assert.equal(data.daily[0].rainProbability, 60);
  assert.equal(data.daily[0].summary, '구름 많음 · 비');
  assert.deepEqual(data.daily[1].day, { summary: undefined, rainProbability: null });
  assert.equal(data.daily[1].summary, '비');
});

test('trip day regions include Taipei on 11/20 and 11/21', () => {
  assert.deepEqual(dayRegions['2026-11-20'], ['taipei', 'yehliu', 'shifen', 'jiufen']);
  assert.deepEqual(dayRegions['2026-11-21'], ['taipei', 'wulai']);
});
