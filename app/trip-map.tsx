'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { days, type TripStop } from './travel-data';

const DAY_COLORS = ['#c0504d', '#d08a2c', '#3f7f5f', '#3d6aa8', '#7b4f9d'];
type Pin = TripStop & { date: string; dayIndex: number; order: number };

// Taiwan pins only (the return flight's Incheon stop is excluded); consecutive stops at the
// same spot share one pin so the numbers stay readable.
function pinsFor(filter: string): Pin[] {
  const pins: Pin[] = [];
  days.forEach((day, dayIndex) => {
    if (filter !== 'all' && filter !== day.date) return;
    let order = 0;
    day.stops.forEach((stop) => {
      if (stop.lat > 30) return;
      const previous = pins.at(-1);
      if (previous && previous.date === day.date && previous.lat === stop.lat && previous.lng === stop.lng) return;
      order += 1;
      pins.push({ ...stop, date: day.date, dayIndex, order });
    });
  });
  return pins;
}

const googleMaps = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const googleDirections = (query: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]!));

// One folder (= My Maps layer) per day, so the pins can be imported into Google My Maps and
// opened in the Google Maps app next to its downloaded offline area.
function downloadKml() {
  const folders = days.map((day, index) => {
    const marks = pinsFor(day.date).map((pin) => `<Placemark><name>${escapeXml(`${pin.order}. ${pin.name}`)}</name><description>${escapeXml(`${pin.time} · ${pin.transport} · ${pin.duration}${pin.approx ? ' · 위치 추정' : ''}`)}</description><Point><coordinates>${pin.lng},${pin.lat},0</coordinates></Point></Placemark>`).join('');
    return `<Folder><name>${escapeXml(`${dayLabel(day.date)} ${day.title}`)}</name>${marks}</Folder>`;
  }).join('');
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>우리 대만 여행 2026</name>${folders}</Document></kml>`;
  const url = URL.createObjectURL(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'our-taiwan-2026.kml';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const dayLabel = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;

export default function TripMap() {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Pin | null>(null);
  const [failed, setFailed] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const pins = useMemo(() => pinsFor(filter), [filter]);
  const filterRef = useRef(filter);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import('leaflet').then((module) => {
      const L = (module as unknown as { default?: typeof import('leaflet') }).default ?? module;
      if (disposed || !element.current) return;
      leaflet.current = L;
      map.current = L.map(element.current, { zoomControl: true, attributionControl: true, zoomSnap: 0.25 }).setView([25.04, 121.55], 10);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setFailed(false);
      // The container can still be settling (fonts, sticky bars) when Leaflet measures it.
      observer = new ResizeObserver(() => map.current?.invalidateSize());
      observer.observe(element.current);
      requestAnimationFrame(() => { map.current?.invalidateSize(); draw(); });
    }).catch(() => setFailed(true));
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const L = leaflet.current, target = layer.current, current = map.current;
    if (!L || !target || !current) return;
    target.clearLayers();
    const currentPins = pinsFor(filterRef.current);
    days.forEach((day, dayIndex) => {
      const route = currentPins.filter((pin) => pin.date === day.date).map((pin) => [pin.lat, pin.lng] as [number, number]);
      if (route.length > 1) L.polyline(route, { color: DAY_COLORS[dayIndex], weight: 3, opacity: 0.55, dashArray: '6 6' }).addTo(target);
    });
    currentPins.forEach((pin) => {
      const stay = /호텔|홈스테이|Hotel|Trio/i.test(pin.name);
      const icon = L.divIcon({
        className: 'trip-pin-wrap',
        html: `<span class="trip-pin${stay ? ' is-stay' : ''}" style="--pin:${DAY_COLORS[pin.dayIndex]}">${stay ? '★' : pin.order}</span>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      L.marker([pin.lat, pin.lng], { icon, title: pin.name }).on('click', () => setSelected(pin)).addTo(target);
    });
    if (currentPins.length) current.fitBounds(L.latLngBounds(currentPins.map((pin) => [pin.lat, pin.lng] as [number, number])), { padding: [36, 36], maxZoom: 15 });
  }

  useEffect(() => { filterRef.current = filter; setSelected(null); draw(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="trip-map">
    <div className="trip-map-filters" role="group" aria-label="지도 날짜 선택">
      <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>전체</button>
      {days.map((day, index) => <button type="button" key={day.date} aria-pressed={filter === day.date} onClick={() => setFilter(day.date)} style={{ ['--pin' as string]: DAY_COLORS[index] }}><i aria-hidden="true" />{dayLabel(day.date)}</button>)}
    </div>
    <div ref={element} className="trip-map-canvas" aria-label="여행지 지도" />
    {failed && <p className="error" role="alert">지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>}
    {selected ? <article className="trip-map-card">
      <small style={{ color: DAY_COLORS[selected.dayIndex] }}>{dayLabel(selected.date)} · {selected.time}</small>
      <h2>{selected.name}</h2>
      <p>{selected.transport} · {selected.duration}{selected.approx ? ' · 핀 위치 추정' : ''}</p>
      <div className="trip-map-actions"><a className="outline-action" href={googleMaps(selected.query)} target="_blank" rel="noreferrer">구글 지도에서 보기</a><a className="outline-action" href={googleDirections(selected.query)} target="_blank" rel="noreferrer">길찾기</a></div>
    </article> : <p className="trip-map-hint">핀을 누르면 시간과 길찾기가 나와요. 숫자는 그날 순서, ★는 숙소·온천이에요. 점선은 순서를 이은 선이고 실제 경로가 아니에요.</p>}
    <ul className="trip-map-list">{pins.map((pin) => <li key={`${pin.date}-${pin.order}`}><button type="button" onClick={() => { setSelected(pin); map.current?.setView([pin.lat, pin.lng], 16); }}><span style={{ background: DAY_COLORS[pin.dayIndex] }}>{pin.order}</span><strong>{pin.name}</strong><small>{dayLabel(pin.date)} {pin.time}</small></button></li>)}</ul>
    <section className="trip-map-offline">
      <h2>데이터 없이 보려면 · 구글 지도 오프라인</h2>
      <ol>
        <li><b>오프라인 지역 받기</b>: 구글 지도 앱 → 프로필 → <b>오프라인 지도</b> → 내 지도 선택에서 타이베이, 지우펀, 우라이를 각각 받아 두기(와이파이에서).</li>
        <li><b>우리 핀 넣기</b>: 아래 버튼으로 KML 파일을 받고, PC에서 <a href="https://www.google.com/maps/d/" target="_blank" rel="noreferrer">구글 내 지도</a> → 새 지도 → 가져오기로 올리기. 날짜별 레이어로 들어가요.</li>
        <li><b>앱에서 열기</b>: 구글 지도 앱 → 저장됨 → <b>지도</b>에서 이 지도를 한 번 열어 두기. 출발 전에 비행기 모드로 핀이 보이는지 꼭 확인하세요(내 지도 레이어의 오프라인 표시는 공식 보장이 아니에요).</li>
      </ol>
      <button type="button" className="outline-action" onClick={downloadKml}>구글 내 지도용 KML 받기</button>
    </section>
    <p className="footnote">지도: OpenStreetMap(인터넷 필요). 핀 위치는 OpenStreetMap 검색 기준이고, 일부는 근처 지점으로 추정했어요. 데이터가 없는 곳을 대비해 출발 전에 구글 지도 앱에서 <strong>오프라인 지도</strong>로 타이베이·지우펀·우라이를 받아 두세요.</p>
  </section>;
}
