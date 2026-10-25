/**
 * Conservative, client-safe idea placement suggestions for the Taiwan trip.
 * Suggestions are separate records; this module never edits the fixed itinerary.
 */

export type PlannerStop = {
  time?: string;
  name: string;
  query?: string;
  duration?: string;
  description?: string;
};

export type PlannerDay = {
  date: string;
  title?: string;
  stops: readonly PlannerStop[];
};

export type IdeaSlotInput = {
  placeName: string;
  durationMinutes: number;
  preferredDate?: string;
  itinerary?: readonly PlannerDay[];
  tripStartDate?: string;
  tripEndDate?: string;
};

export type IdeaSlotSuggestion = {
  /** Stable for the same place and slot; suitable as a client-side proposal key. */
  id: string;
  date: string;
  /** Local Taipei time, 24-hour HH:mm; this is the proposed arrival/start time. */
  time: string;
  durationMinutes: number;
  conflict: {
    hasConflict: false;
    note: string;
  };
  estimatedTravelMinutes: number;
  travelTimeIsEstimate: true;
  mapUrl: string;
  reason: string;
  /** Tour-date uncertainty is surfaced even though 11/19 itself is excluded. */
  tourTimingUnconfirmed: boolean;
  timingUncertainty: string | null;
};

type SlotTemplate = {
  date: string;
  time: string;
  maxDurationMinutes: number;
  estimatedTravelMinutes: number;
  origin: string;
  nextStop: string;
  reason: string;
};

const TRIP_START = '2026-11-18';
const TRIP_END = '2026-11-22';
const TOUR_DATE = '2026-11-19';

// Deliberately limited to windows with room around the fixed route. Arrival,
// activity duration, and city travel are estimates and must be checked in Maps.
const SAFE_WINDOWS: readonly SlotTemplate[] = [
  {
    date: '2026-11-18',
    time: '12:15',
    maxDurationMinutes: 45,
    estimatedTravelMinutes: 25,
    origin: 'Taipei Main Station',
    nextStop: 'Dihua Street Taipei',
    reason: '호텔에 짐을 맡긴 뒤 14시 디화제 산책 전에 짧게 들를 수 있는 시간대입니다. 체류 45분 이하이며 장소가 메인역·디화제 동선에 맞을 때 추천합니다.',
  },
  {
    date: '2026-11-20',
    time: '18:40',
    maxDurationMinutes: 120,
    estimatedTravelMinutes: 30,
    origin: 'Taipei 101 Observatory',
    nextStop: 'Taipei Main Station',
    reason: '15:30~18:00 타이베이 101 관람이 끝난 뒤 저녁 시간입니다. 다음 날 우라이 이동 전 일정에 여유를 남기도록 늦은 밤 방문은 피했습니다.',
  },
];

const FORBIDDEN_PLACE_MARKERS = ['단수이', '淡水', 'tamsui', 'danshui'];

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function hasForbiddenPlace(value: string): boolean {
  const text = normalized(value);
  return FORBIDDEN_PLACE_MARKERS.some((marker) => text.includes(marker));
}

function mapDirections(origin: string, destination: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'transit',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function containsStop(day: PlannerDay | undefined, matcher: RegExp): boolean {
  return Boolean(day?.stops.some((stop) => matcher.test(`${stop.name} ${stop.query ?? ''}`)));
}

function slotIsSupportedByItinerary(template: SlotTemplate, day: PlannerDay | undefined): boolean {
  if (!day) return false;
  if (template.date === '2026-11-18') {
    return containsStop(day, /타이베이 호텔|Taipei Main Station/i)
      && containsStop(day, /디화제|Dihua Street/i)
      && containsStop(day, /닝샤|Ningxia/i);
  }
  if (template.date === '2026-11-20') {
    return containsStop(day, /101 전망대|Taipei 101 Observatory/i);
  }
  return false;
}

/**
 * Return up to three conservative placements for an idea. This is a heuristic,
 * not a routing service: travel minutes are estimates, and exact destination
 * routing and day-of timing need a human check. No slot is emitted on 11/19
 * because the tour operator's complete schedule has not been confirmed.
 */
export function suggestIdeaSlots(input: IdeaSlotInput): IdeaSlotSuggestion[] {
  const placeName = input.placeName.trim();
  const durationMinutes = Math.round(input.durationMinutes);
  if (!placeName || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];
  if (hasForbiddenPlace(placeName)) return [];

  const startDate = input.tripStartDate ?? TRIP_START;
  const endDate = input.tripEndDate ?? TRIP_END;
  const itinerary = input.itinerary;
  const ordered = [...SAFE_WINDOWS]
    .filter((window) => window.date >= startDate && window.date <= endDate)
    // Prefer the requested day when there is a usable window, without excluding
    // other dates if the requested day is full or falls on the unverified tour.
    .sort((a, b) => {
      const aPreferred = a.date === input.preferredDate ? 0 : 1;
      const bPreferred = b.date === input.preferredDate ? 0 : 1;
      return aPreferred - bPreferred || a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });

  const result: IdeaSlotSuggestion[] = [];
  for (const window of ordered) {
    if (durationMinutes > window.maxDurationMinutes) continue;
    const day = itinerary?.find((candidate) => candidate.date === window.date);
    if (itinerary && !slotIsSupportedByItinerary(window, day)) continue;

    const dayHasTour = Boolean(day && containsStop(day, /예스지 투어|예류|스펀 천등|지우펀 야경/i));
    // The 11/19 tour is an all-day reservation candidate with unconfirmed
    // gathering/return times, so it is intentionally never treated as open.
    if (window.date === TOUR_DATE || dayHasTour) continue;

    const nextStopName = window.nextStop;
    const uncertainty = '이동시간은 장소의 정확한 주소·교통 상황을 조회하지 않은 추정치입니다. Google 지도에서 출발지와 다음 일정까지의 경로를 확인하세요.';
    result.push({
      id: `${window.date}-${window.time}-${normalized(placeName).replace(/\s+/g, '-')}`,
      date: window.date,
      time: window.time,
      durationMinutes,
      conflict: {
        hasConflict: false,
        note: '등록된 확정 일정의 시간대와 겹치지 않는 제안입니다. 장소 위치와 실제 이동 경로에 따른 충돌 여부는 지도에서 최종 확인해야 합니다.',
      },
      estimatedTravelMinutes: window.estimatedTravelMinutes,
      travelTimeIsEstimate: true,
      mapUrl: mapDirections(window.origin, placeName),
      reason: `${window.reason} ${uncertainty} 다음 동선: ${nextStopName}.`,
      tourTimingUnconfirmed: true,
      timingUncertainty: `11/19 예스지 투어의 집결·복귀·세부 방문 시간이 미확정이라 그 날짜는 제안에서 제외했습니다. ${uncertainty}`,
    });
    if (result.length === 3) break;
  }

  return result;
}
