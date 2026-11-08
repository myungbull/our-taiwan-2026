'use client';
import { useState } from 'react';
import type { TripStop } from './travel-data';
import { StopWeather } from './stop-weather';
import Icon from './ui-icons';

// "12:50 집결" → ["12:50", "집결"], "15:30–18:00" → ["15:30", "–18:00"], "오전" → ["오전", ""]
function splitTime(time: string): [string, string] {
  const match = time.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
  return match ? [match[1], match[2]] : [time, ''];
}

export default function ItineraryStop({ stop, mapHref }: { stop: TripStop; mapHref: string }) {
  const [open, setOpen] = useState(false);
  const [main, sub] = splitTime(stop.time);
  const booked = /예약|확정/.test(stop.time) || /예약 완료|예약 \d|확정\./.test(stop.description);
  const long = stop.description.length > 60;
  return <article className={'itinerary-row' + (booked ? ' is-booked' : '')}>
    <div className="itinerary-time"><b>{main}</b>{sub && <small>{sub}</small>}</div>
    <div className="itinerary-body">
      <div className="itinerary-head"><h3>{stop.name}</h3><a href={mapHref} target="_blank" rel="noreferrer" aria-label={`${stop.name} 지도 길찾기`}><Icon name="pin" />지도</a></div>
      <StopWeather region={stop.region} hour={stop.hour} />
      <p className={open || !long ? '' : 'is-clamped'}>{stop.description}</p>
      {long && <button type="button" className="text-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '접기' : '더보기'}</button>}
      <div className="itinerary-tags">{booked && <span className="tag-booked">예약</span>}<span>{stop.transport}</span><span>{stop.duration}</span></div>
    </div>
  </article>;
}
