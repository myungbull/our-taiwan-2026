'use client';
import { useMemo, useState } from 'react';
import { tipGroups, type Tip } from './tips-data';

function TipCard({ tip, group }: { tip: Tip; group: string }) {
  const [open, setOpen] = useState(false);
  const long = tip.body.length > 70;
  return <article className="tip-card">
    <div className="tip-card-top"><small>{group}</small><span className={'status-pill ' + (tip.accuracy === '정확' ? 'complete' : 'pending')}>{tip.accuracy}</span></div>
    <h3>{tip.title}</h3>
    <p className={open || !long ? '' : 'is-clamped'}>{tip.body}</p>
    {long && <button type="button" className="text-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '접기' : '더보기'}</button>}
    {open && tip.sources.length > 0 && <div className="tip-sources">{tip.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} ↗</a>)}</div>}
  </article>;
}

// Category chips + search over every tip; bodies preview two lines and expand on tap.
export default function TipsView() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const total = tipGroups.reduce((sum, group) => sum + group.tips.length, 0);
  const shown = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return tipGroups
      .filter((group) => category === 'all' || group.id === category)
      .flatMap((group) => group.tips.map((tip) => ({ tip, group: group.title })))
      .filter(({ tip }) => words.every((word) => `${tip.title} ${tip.body}`.toLocaleLowerCase().includes(word)));
  }, [category, query]);
  return <section className="tips-view">
    <label className="tips-search"><span className="visually-hidden">꿀팁 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="팁 검색 · 예: 현금, 이지카드" autoComplete="off" /></label>
    <div className="tips-chips" role="group" aria-label="꿀팁 카테고리">
      <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>전체 <i>{total}</i></button>
      {tipGroups.map((group) => <button type="button" key={group.id} aria-pressed={category === group.id} onClick={() => setCategory(group.id)}>{group.title} <i>{group.tips.length}</i></button>)}
    </div>
    <div className="tip-list">{shown.map(({ tip, group }) => <TipCard key={tip.title} tip={tip} group={group} />)}</div>
    {shown.length === 0 && <p className="empty-state">‘{query}’에 맞는 팁이 없어요.</p>}
  </section>;
}
