import { env } from 'cloudflare:workers';
import { requireAllowedMember, isResponse, sameOrigin } from '../_lib/auth';
import { isValidWeatherDate, isWeatherRegion } from '../../weather-data';
import { readWeatherState, refreshWeather, resultFromState } from './service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
async function handle(request: Request, refresh: boolean) {
  const member = await requireAllowedMember();
  if (isResponse(member)) return member;
  if (refresh && !sameOrigin(request)) return Response.json({ error: '같은 사이트에서 다시 시도해 주세요.' }, { status: 403, headers });
  const params = new URL(request.url).searchParams, region = params.get('region'), date = params.get('date');
  if (!isWeatherRegion(region) || !isValidWeatherDate(date)) return Response.json({ error: '올바른 여행 지역과 날짜를 선택해 주세요.' }, { status: 400, headers });
  if (!env.DB) return Response.json({ error: '날씨 저장소 연결을 확인하고 있어요.' }, { status: 503, headers });
  try {
    const apiKey = env.ACCUWEATHER_API_KEY;
    const state = refresh ? await refreshWeather({ db: env.DB, key: apiKey, log: event => console.warn(JSON.stringify(event)) }, region) : await readWeatherState(env.DB, region);
    const result = resultFromState(state, region, date, Date.now(), Boolean(apiKey?.trim()));
    if (refresh && !result.current && result.daily.length === 0 && (state.primary_failures > 0 || state.accuweather_failures > 0) && !result.refresh?.inProgress) return Response.json({ ...result, error: '날씨 연결이 지연되고 있어요. 잠시 후 다시 확인해 주세요.' }, { status: 503, headers });
    return Response.json(result, { headers });
  } catch {
    console.warn(JSON.stringify({ event: 'weather-cache-error', region }));
    return Response.json({ error: '날씨 저장소 연결이 지연되고 있어요. 다시 시도해 주세요.' }, { status: 503, headers });
  }
}
// Fast cached response followed by an awaited refresh; no detached Worker promise.
export function GET(request: Request) { return handle(request, false); }
export function POST(request: Request) { return handle(request, true); }
