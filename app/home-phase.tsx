'use client';
import type { MouseEvent } from 'react';
import { days } from './travel-data';

type Link = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => void;
type Todo = { id: string; label: string };
const directions = (query: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

function taipeiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { date: `${pick('year')}-${pick('month')}-${pick('day')}`, hour: Number(pick('hour')) + Number(pick('minute')) / 60 };
}

// The one card that matters most right now: what to finish before leaving, where to go next
// during the trip, or the photo album afterwards.
export default function HomePhase({ phase, todos, totalTodos, doneTodos, link }: { phase: 'before' | 'during' | 'after'; todos: Todo[]; totalTodos: number; doneTodos: number; link: Link }) {
  if (phase === 'during') {
    const now = taipeiNow();
    const day = days.find((item) => item.date === now.date) ?? days[0];
    const index = Math.max(0, day.stops.findIndex((stop) => stop.hour + 0.5 >= now.hour));
    const current = day.stops[index], next = day.stops[index + 1];
    return <section className="home-hero">
      <span className="home-hero-kicker">{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8, 10))} · {day.title}</span>
      <div className="home-hero-now">
        <span>{current.time}</span><div><b>{current.name}</b><p>{current.transport} · {current.duration}</p></div>
        {next && <><span className="is-next">{next.time}</span><div><b>{next.name}</b><p>다음 일정</p></div></>}
      </div>
      <div className="home-hero-actions"><a className="primary" href={directions(current.query)} target="_blank" rel="noreferrer">길찾기</a><a href={`/itinerary?date=${day.date}`} onClick={link(`/itinerary?date=${day.date}`)}>오늘 일정</a></div>
    </section>;
  }
  if (phase === 'after') {
    return <section className="home-hero">
      <span className="home-hero-kicker">다녀온 여행</span>
      <h2>4박 5일 사진 모아보기</h2>
      <p>날짜별 앨범으로 둘이 남긴 장면을 다시 봐요.</p>
      <div className="home-hero-actions"><a className="primary" href="/memories" onClick={link('/memories')}>날짜별 앨범</a><a href="/prepare" onClick={link('/prepare')}>예산 정산</a></div>
    </section>;
  }
  return <section className="home-hero">
    <span className="home-hero-kicker">출발 전 · 다음 할 일</span>
    <h2>{todos.length ? `먼저 끝낼 ${todos.length}가지` : '준비를 모두 마쳤어요'}</h2>
    {todos.length > 0 && <ul className="home-hero-todos">{todos.map((todo) => <li key={todo.id}><span aria-hidden="true" />{todo.label}</li>)}</ul>}
    <div className="home-hero-actions"><a className="primary" href="/prepare" onClick={link('/prepare')}>체크리스트 · {doneTodos}/{totalTodos}</a><a href="/prepare?section=budget" onClick={link('/prepare?section=budget')}>예산 보기</a></div>
  </section>;
}
