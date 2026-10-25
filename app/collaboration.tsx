'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { days } from './travel-data';

type Slot = {
  id: string;
  date: string;
  time: string;
  durationMinutes: number;
  conflict: { hasConflict: boolean; note: string };
  estimatedTravelMinutes: number;
  travelTimeIsEstimate: boolean;
  mapUrl: string;
  reason: string;
  timingUncertainty: string | null;
};
type SlotVote = { slotId: string; votes: Array<{ label: string; response: 'yes' | 'no' }>; myVote: 'yes' | 'no' | null; approved: boolean };
type Idea = { id: string; title: string; url: string; note: string; place: string; durationMinutes: number; preferredDate: string | null; suggestions: Slot[]; slotVotes: SlotVote[]; createdAt: string; updatedAt: string };
type ScheduleAddition = { id: string; title: string; place: string; note: string; date: string; time: string; durationMinutes: number; mapUrl: string };
type PhotoEntry = { id: string; date: string; place: string; caption: string; uploader: string; uploadedAt: string; byteSize: number; imageUrl: string };
type PlacePin = { id: string; name: string; date: string; query: string; lat: number; lng: number; mapUrl: string };

const photoDays = days.map((day, index) => ({ date: day.date, title: `11월 ${18 + index}일 · ${['수', '목', '금', '토', '일'][index]}` }));
const makePin = (id: string, name: string, date: string, query: string, lat: number, lng: number): PlacePin => ({ id, name, date, query, lat, lng, mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` });
const placePins: PlacePin[] = [
  makePin('dihua', '디화제', '2026-11-18', 'Dihua Street Taipei', 25.0594, 121.5097),
  makePin('dadaocheng', '다다오청 선착장', '2026-11-18', 'Dadaocheng Wharf Taipei', 25.0560, 121.5084),
  makePin('ningxia', '닝샤 야시장', '2026-11-18', 'Ningxia Night Market Taipei', 25.0560, 121.5152),
  makePin('yehliu', '예류 지질공원', '2026-11-19', 'Yehliu Geopark', 25.2052, 121.6904),
  makePin('shifen', '스펀 옛 거리', '2026-11-19', 'Shifen Old Street', 25.0426, 121.7762),
  makePin('jiufen', '지우펀 옛 거리', '2026-11-19', 'Jiufen Old Street', 25.1096, 121.8442),
  makePin('longshan', '용산사', '2026-11-20', 'Longshan Temple Taipei', 25.0372, 121.4997),
  makePin('bopiliao', '보피랴오 역사거리', '2026-11-20', 'Bopiliao Historical Block', 25.0368, 121.5007),
  makePin('cksmemorial', '중정기념당', '2026-11-20', 'Chiang Kai-shek Memorial Hall Taipei', 25.0348, 121.5218),
  makePin('fourfour', '사사남촌', '2026-11-20', 'Four Four South Village Taipei', 25.0311, 121.5619),
  makePin('taipei101', '타이베이 101', '2026-11-20', 'Taipei 101 Observatory', 25.0339, 121.5645),
  makePin('wulai-oldstreet', '우라이 옛 거리', '2026-11-21', 'Wulai Old Street', 24.8650, 121.5505),
  makePin('wulai-falls', '우라이 폭포', '2026-11-21', 'Wulai Falls', 24.8425, 121.5518),
  makePin('spring-spa', 'Spring Spa Hotel', '2026-11-21', 'Spring Spa Hotel Wulai', 24.8630, 121.5504),
  makePin('taoyuan', '타오위안공항 T1', '2026-11-22', 'Taiwan Taoyuan International Airport Terminal 1', 25.0797, 121.2342),
];

const dateLabel = (value: string) => photoDays.find((day) => day.date === value)?.title ?? value;
const distanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

async function compressPhoto(file: File): Promise<Blob> {
  let canvas: HTMLCanvasElement;
  let width: number;
  let height: number;
  let bitmap: ImageBitmap | undefined;
  if (typeof createImageBitmap === 'function') {
    try { bitmap = await createImageBitmap(file); } catch { bitmap = undefined; }
  }
  if (bitmap) {
    width = bitmap.width;
    height = bitmap.height;
    canvas = document.createElement('canvas');
    const scale = Math.min(1, 1800 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  } else {
    const source = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('이 사진 형식은 브라우저에서 읽을 수 없습니다.')); img.src = source;
      });
      width = image.naturalWidth; height = image.naturalHeight;
      const scale = Math.min(1, 1800 / Math.max(width, height));
      canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally { URL.revokeObjectURL(source); }
  }
  const webp = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('사진 크기를 줄이지 못했습니다.')), 'image/webp', 0.8));
  if (webp.type === 'image/webp') return webp;
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('사진 미리보기를 만들지 못했습니다.')), 'image/jpeg', 0.82));
}

export default function Collaboration({ onScheduleChange }: { onScheduleChange: (items: ScheduleAddition[]) => void }) {
  const [section, setSection] = useState<'ideas' | 'photos' | 'nearby'>('ideas');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaLoading, setIdeaLoading] = useState(true);
  const [ideaError, setIdeaError] = useState('');
  const [viewerLabel, setViewerLabel] = useState('');
  const [ideaForm, setIdeaForm] = useState({ title: '', url: '', note: '', place: '', durationMinutes: '45', preferredDate: '' });
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [ideaSaving, setIdeaSaving] = useState(false);
  const [photoDate, setPhotoDate] = useState('2026-11-18');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoPlace, setPhotoPlace] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locationOn, setLocationOn] = useState(false);
  const [locationStatus, setLocationStatus] = useState('꺼짐 · 현재 위치는 저장되지 않습니다.');
  const [radius, setRadius] = useState(200);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [selectedPins, setSelectedPins] = useState<string[]>([]);
  const [customPins, setCustomPins] = useState<PlacePin[]>([]);
  const [customName, setCustomName] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customDate, setCustomDate] = useState('2026-11-18');
  const [customPinError, setCustomPinError] = useState('');
  const [checkIns, setCheckIns] = useState<Array<{ id: string; time: string }>>([]);
  const [alertHistory, setAlertHistory] = useState<Array<{ id: string; time: string }>>([]);
  const [locationAlert, setLocationAlert] = useState('');
  const [notificationPermission, setNotificationPermission] = useState('default');
  const watchId = useRef<number | null>(null);
  const lastAlertByPlace = useRef<Record<string, number>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoPreview = useMemo(() => selectedPhoto ? URL.createObjectURL(selectedPhoto) : null, [selectedPhoto]);

  useEffect(() => {
    setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const publishApproved = useCallback((rows: Idea[]) => {
    onScheduleChange(rows.flatMap((idea) => idea.suggestions.flatMap((slot) => {
      const vote = idea.slotVotes.find((entry) => entry.slotId === slot.id);
      return vote?.approved ? [{ id: `${idea.id}-${slot.id}`, title: idea.title, place: idea.place, note: idea.note, date: slot.date, time: slot.time, durationMinutes: idea.durationMinutes, mapUrl: slot.mapUrl }] : [];
    })));
  }, [onScheduleChange]);

  const refreshIdeas = useCallback(async () => {
    try {
      const response = await fetch('/api/ideas', { cache: 'no-store' });
      if (!response.ok) throw new Error('공동 공간에 접속할 수 없습니다. 사이트 초대와 로그인을 확인해 주세요.');
      const data = await response.json() as { ideas: Idea[]; viewerLabel: string };
      setIdeas(data.ideas); setViewerLabel(data.viewerLabel); setIdeaError(''); publishApproved(data.ideas);
    } catch (error) { setIdeaError(error instanceof Error ? error.message : '공유 정보를 불러오지 못했습니다.'); }
    finally { setIdeaLoading(false); }
  }, [publishApproved]);

  useEffect(() => {
    void refreshIdeas();
    const timer = window.setInterval(() => void refreshIdeas(), 10000);
    return () => window.clearInterval(timer);
  }, [refreshIdeas]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('our-taiwan-custom-place-pins');
      if (saved) setCustomPins(JSON.parse(saved) as PlacePin[]);
    } catch { setCustomPins([]); }
  }, []);

  const refreshPhotos = useCallback(async () => {
    setPhotoLoading(true);
    try {
      const response = await fetch(`/api/photos?date=${photoDate}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('비공개 사진 기록에 접속할 수 없습니다.');
      const data = await response.json() as { photos: PhotoEntry[]; viewerLabel: string };
      setPhotos(data.photos); setViewerLabel(data.viewerLabel); setPhotoError('');
    } catch (error) { setPhotoError(error instanceof Error ? error.message : '사진 기록을 불러오지 못했습니다.'); }
    finally { setPhotoLoading(false); }
  }, [photoDate]);

  useEffect(() => {
    if (section !== 'photos') return;
    void refreshPhotos();
    const timer = window.setInterval(() => void refreshPhotos(), 15000);
    return () => window.clearInterval(timer);
  }, [section, refreshPhotos]);

  useEffect(() => {
    if (!locationOn) return;
    if (!('geolocation' in navigator)) { setLocationStatus('이 브라우저에서 위치 확인을 지원하지 않습니다.'); setLocationOn(false); return; }
    let disposed = false;
    const stop = () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); watchId.current = null; };
    const start = () => {
      if (document.hidden || disposed || watchId.current !== null) return;
      watchId.current = navigator.geolocation.watchPosition((position) => {
        if (disposed) return;
        setLocationStatus(`확인 중 · 정확도 약 ${Math.round(position.coords.accuracy)}m · 위치는 기기에만 머뭅니다.`);
        const match = [...placePins, ...customPins]
          .filter((pin) => selectedPins.includes(pin.id))
          .map((pin) => ({ pin, distance: distanceMeters(position.coords.latitude, position.coords.longitude, pin.lat, pin.lng) }))
          .filter((row) => row.distance <= radius)
          .sort((a, b) => a.distance - b.distance)[0];
        if (!match) return;
        const now = Date.now();
        if (now - (lastAlertByPlace.current[match.pin.id] ?? 0) < cooldownMinutes * 60000) return;
        lastAlertByPlace.current[match.pin.id] = now;
        const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }).format(new Date());
        setLocationAlert(`${match.pin.name} 근처예요 · 약 ${match.distance}m`);
        setAlertHistory((items) => [{ id: match.pin.id, time: `${time} · ${match.pin.name}` }, ...items].slice(0, 8));
        if (notificationPermission === 'granted' && 'Notification' in window) {
          try { new Notification('Our Taiwan 2026', { body: `${match.pin.name} 근처에 도착했어요. ${match.distance}m` }); } catch { /* in-page alert remains available */ }
        }
        if ('vibrate' in navigator) navigator.vibrate(80);
      }, (error) => {
        if (disposed) return;
        setLocationStatus(error.code === error.PERMISSION_DENIED ? '위치 권한이 거부됐어요. 브라우저 설정에서 허용하거나 수동 체크인을 이용해 주세요.' : '현재 위치를 확인하지 못했습니다. 수동 체크인을 이용해 주세요.');
        setLocationOn(false); stop();
      }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
      setLocationStatus('현재 화면을 열어둔 동안 위치를 확인합니다.');
    };
    const onVisibility = () => {
      if (document.hidden) { stop(); setLocationStatus('화면이 백그라운드에 있어 위치 확인을 멈췄습니다. 다시 열면 이어집니다.'); }
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => { disposed = true; document.removeEventListener('visibilitychange', onVisibility); stop(); };
  }, [locationOn, selectedPins, customPins, radius, cooldownMinutes, notificationPermission]);

  useEffect(() => {
    if (!locationAlert) return;
    const timer = window.setTimeout(() => setLocationAlert(''), 7000);
    return () => window.clearTimeout(timer);
  }, [locationAlert]);

  async function submitIdea(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIdeaSaving(true); setIdeaError('');
    try {
      const response = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: editingIdeaId, ...ideaForm, durationMinutes: Number(ideaForm.durationMinutes) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || '아이디어를 저장하지 못했습니다.');
      setIdeaForm({ title: '', url: '', note: '', place: '', durationMinutes: '45', preferredDate: '' }); setEditingIdeaId(null);
      await refreshIdeas();
    } catch (error) { setIdeaError(error instanceof Error ? error.message : '아이디어를 저장하지 못했습니다.'); }
    finally { setIdeaSaving(false); }
  }

  async function changeIdea(action: 'vote' | 'delete', data: Record<string, unknown>) {
    setIdeaError('');
    try {
      const response = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || '변경사항을 저장하지 못했습니다.');
      await refreshIdeas();
    } catch (error) { setIdeaError(error instanceof Error ? error.message : '변경사항을 저장하지 못했습니다.'); }
  }

  function beginEdit(idea: Idea) {
    setIdeaForm({ title: idea.title, url: idea.url, note: idea.note, place: idea.place, durationMinutes: String(idea.durationMinutes), preferredDate: idea.preferredDate ?? '' });
    setEditingIdeaId(idea.id); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPhoto) { setPhotoError('앨범에서 사진을 고르거나 카메라로 촬영해 주세요.'); return; }
    setUploading(true); setPhotoError('');
    try {
      const compressed = await compressPhoto(selectedPhoto);
      if (compressed.size > 5_000_000) throw new Error('축소 후에도 5MB를 넘습니다. 다른 사진을 선택해 주세요.');
      const body = new FormData(); body.set('date', photoDate); body.set('place', photoPlace); body.set('caption', photoCaption); body.set('image', compressed, compressed.type === 'image/webp' ? 'trip.webp' : 'trip.jpg');
      const response = await fetch('/api/photos', { method: 'POST', body });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || '사진을 저장하지 못했습니다.');
      setSelectedPhoto(null); setPhotoPlace(''); setPhotoCaption('');
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      await refreshPhotos();
    } catch (error) { setPhotoError(error instanceof Error ? error.message : '사진을 저장하지 못했습니다.'); }
    finally { setUploading(false); }
  }

  async function deletePhoto(photo: PhotoEntry) {
    if (!window.confirm('이 사진을 여행 기록에서 삭제할까요?')) return;
    try {
      const response = await fetch('/api/photos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: photo.id }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || '사진을 삭제하지 못했습니다.');
      await refreshPhotos();
    } catch (error) { setPhotoError(error instanceof Error ? error.message : '사진을 삭제하지 못했습니다.'); }
  }

  async function enableSystemNotifications() {
    if (!('Notification' in window)) { setNotificationPermission('unsupported'); return; }
    try { setNotificationPermission(await Notification.requestPermission()); } catch { setNotificationPermission('denied'); }
  }

  const allPins = useMemo(() => [...placePins, ...customPins], [customPins]);
  const selectedPlacePins = useMemo(() => allPins.filter((pin) => selectedPins.includes(pin.id)), [selectedPins, allPins]);

  function addCustomPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCustomPinError('');
    const direct = customLocation.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    const at = customLocation.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const point = customLocation.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const match = direct ?? at ?? point;
    if (!match) { setCustomPinError('Google Maps에서 복사한 좌표가 포함된 링크 또는 위도, 경도를 입력해 주세요.'); return; }
    const lat = Number(match[1]), lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20 || lat > 30 || lng < 118 || lng > 126) { setCustomPinError('대만 여행지 범위의 좌표인지 확인해 주세요.'); return; }
    const id = `custom-${crypto.randomUUID()}`;
    const query = `${lat},${lng}`;
    const pin = makePin(id, customName.trim().slice(0, 80), customDate, query, lat, lng);
    const next = [...customPins, pin];
    setCustomPins(next); localStorage.setItem('our-taiwan-custom-place-pins', JSON.stringify(next));
    setCustomName(''); setCustomLocation(''); setCustomPinError('');
  }

  function removeCustomPin(pin: PlacePin) {
    const next = customPins.filter((entry) => entry.id !== pin.id);
    setCustomPins(next); localStorage.setItem('our-taiwan-custom-place-pins', JSON.stringify(next));
    setSelectedPins((current) => current.filter((id) => id !== pin.id));
  }

  return <section className="collab-page">
    <div className="page-heading"><small>OUR SHARED JOURNAL</small><h1>둘이 함께 채우는 여행.</h1><p>{viewerLabel ? `${viewerLabel}로 접속 중 · 두 사람에게만 보이는 공동 공간` : '허용된 두 계정만 접속할 수 있는 공간'}</p></div>
    <nav className="collab-tabs" aria-label="공동 공간 메뉴">
      <button aria-pressed={section === 'ideas'} onClick={() => setSection('ideas')}>하고 싶은 것</button>
      <button aria-pressed={section === 'photos'} onClick={() => setSection('photos')}>사진 기록</button>
      <button aria-pressed={section === 'nearby'} onClick={() => setSection('nearby')}>근처 알림</button>
    </nav>

    {section === 'ideas' && <>
      <section className="collab-intro"><span>01 / IDEAS</span><h2>가고 싶은 곳을 모아두고,<br/>둘이 함께 날짜를 정해요.</h2><p>링크와 메모를 저장하면 현재 확정 일정 사이의 후보 시간을 보여줍니다. 두 사람 모두 같은 시간대에 찬성해야 일정에 반영됩니다.</p></section>
      <form className="idea-form" onSubmit={submitIdea}>
        <div className="row"><h2>{editingIdeaId ? '아이디어 수정' : '하고 싶은 것 추가'}</h2><span className="badge">공동 보관함</span></div>
        <label>제목<input required maxLength={100} value={ideaForm.title} onChange={(event) => setIdeaForm({ ...ideaForm, title: event.target.value })} placeholder="예: 용캉제 망고빙수" /></label>
        <label>장소<input required maxLength={120} value={ideaForm.place} onChange={(event) => setIdeaForm({ ...ideaForm, place: event.target.value })} placeholder="장소명 또는 지역" /></label>
        <div className="row idea-fields"><label>예상 체류시간<select value={ideaForm.durationMinutes} onChange={(event) => setIdeaForm({ ...ideaForm, durationMinutes: event.target.value })}>{[30,45,60,90,120,180].map((value) => <option value={value} key={value}>{value}분</option>)}</select></label><label>희망 날짜<select value={ideaForm.preferredDate} onChange={(event) => setIdeaForm({ ...ideaForm, preferredDate: event.target.value })}><option value="">날짜 미정</option>{photoDays.map((day) => <option value={day.date} key={day.date}>{day.title}</option>)}</select></label></div>
        <label>링크<input type="url" maxLength={500} value={ideaForm.url} onChange={(event) => setIdeaForm({ ...ideaForm, url: event.target.value })} placeholder="https://… · 선택" /></label>
        <label>간단한 메모<textarea maxLength={500} rows={2} value={ideaForm.note} onChange={(event) => setIdeaForm({ ...ideaForm, note: event.target.value })} placeholder="먹고 싶은 메뉴, 꼭 보고 싶은 것 등" /></label>
        <p className="form-hint">저장된 링크와 메모는 두 허용 계정만 볼 수 있어요. 예약번호, 카드 정보, 여권 정보는 적지 마세요.</p>
        {ideaError && section === 'ideas' && <p className="error" role="alert">{ideaError}</p>}
        <div className="row form-actions"><button className="primary" type="submit" disabled={ideaSaving}>{ideaSaving ? '저장 중…' : editingIdeaId ? '수정 저장' : '보관함에 추가'}</button>{editingIdeaId && <button type="button" className="quiet-button" onClick={() => { setEditingIdeaId(null); setIdeaForm({ title: '', url: '', note: '', place: '', durationMinutes: '45', preferredDate: '' }); }}>취소</button>}</div>
      </form>
      <div className="sectionline"><h2>우리의 보관함</h2><span>{ideas.length}개</span></div>
      {ideaLoading ? <div className="empty-state">공동 보관함을 불러오는 중…</div> : ideas.length === 0 ? <div className="empty-state"><strong>아직 담긴 장소가 없어요.</strong><p>첫 번째로 가고 싶은 곳을 적어 두세요.</p></div> : <div className="idea-list">{ideas.map((idea) => <article className="idea-item" key={idea.id}>
        <div className="row idea-title"><div><small>{idea.preferredDate ? dateLabel(idea.preferredDate) : '희망 날짜 미정'} · 약 {idea.durationMinutes}분</small><h3>{idea.title}</h3></div><span className="badge">{idea.place}</span></div>
        {idea.note && <p>{idea.note}</p>}
        <div className="links">{idea.url && <a href={idea.url} target="_blank" rel="noreferrer">참고 링크 ↗</a>}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(idea.place)}`} target="_blank" rel="noreferrer">Google 지도에서 찾기 ↗</a><button onClick={() => beginEdit(idea)}>수정</button><button onClick={() => { if (window.confirm('이 아이디어와 찬성 기록을 모두 삭제할까요?')) void changeIdea('delete', { ideaId: idea.id }); }}>삭제</button></div>
        <div className="proposal-heading"><strong>일정에 넣기 좋은 시간</strong><span>추천은 추정 · 둘 다 승인 전</span></div>
        {idea.suggestions.length === 0 ? <p className="form-hint">현재 확정 일정 사이에 무리 없이 넣을 후보를 찾지 못했어요. 체류시간을 줄이거나 장소를 더 정확히 적어 보세요. 11/19 투어 시간은 확정 전이라 그날은 추천에서 제외합니다. 단수이 일정은 여행 계획에서 제외되어 있어요.</p> : idea.suggestions.map((slot) => {
          const vote = idea.slotVotes.find((entry) => entry.slotId === slot.id);
          const voteLabel = ['나', '동행인'].map((label) => { const response = vote?.votes.find((entry) => entry.label === label)?.response; return `${label} ${response === 'yes' ? '찬성' : response === 'no' ? '보류' : '미응답'}`; }).join(' · ');
          return <div className={'proposal ' + (vote?.approved ? 'proposal-approved' : '')} key={slot.id}>
            <div className="row"><strong>{dateLabel(slot.date)} · {slot.time}</strong><span className={'badge ' + (vote?.approved ? 'confirmed' : '')}>{vote?.approved ? '둘 다 승인 · 일정 반영' : voteLabel}</span></div>
            <p>{slot.conflict.note}</p><p>예상 이동 약 {slot.estimatedTravelMinutes}분 · 체류 {slot.durationMinutes}분 · 이동시간은 추정</p>
            <p>{slot.reason}</p>{slot.timingUncertainty && <p className="form-hint">{slot.timingUncertainty}</p>}
            <div className="links"><a href={slot.mapUrl} target="_blank" rel="noreferrer">출발지와 이동 동선 지도 ↗</a><button disabled={vote?.myVote === 'yes'} onClick={() => void changeIdea('vote', { ideaId: idea.id, slotId: slot.id, response: 'yes' })}>이 시간에 찬성</button><button disabled={vote?.myVote === 'no'} onClick={() => void changeIdea('vote', { ideaId: idea.id, slotId: slot.id, response: 'no' })}>보류</button></div>
          </div>;
        })}
      </article>)}</div>}
      {ideaError && <p className="error" role="alert">{ideaError}</p>}
      <aside className="notice"><b>동의 방식</b><p>각 시간대는 두 계정이 모두 찬성한 뒤에만 일자별 일정에 ‘공동 승인’ 항목으로 추가됩니다. 시간 후보와 이동 소요는 실제 교통정보가 아닌 계획용 추정입니다.</p></aside>
    </>}

    {section === 'photos' && <>
      <section className="collab-intro"><span>02 / PHOTO DIARY</span><h2>오늘의 장면을<br/>날짜에 남겨요.</h2><p>사진은 자동 축소해 비공개 저장소에 올립니다. 사진 파일은 공개 URL로 제공하지 않고, 두 허용 계정의 로그인 요청을 통해서만 열립니다.</p></section>
      <div className="date-tabs photo-date-tabs">{photoDays.map((day) => <button key={day.date} aria-pressed={photoDate === day.date} onClick={() => setPhotoDate(day.date)}><small>{['수','목','금','토','일'][new Date(`${day.date}T12:00:00`).getDay() === 0 ? 4 : new Date(`${day.date}T12:00:00`).getDay() - 3]}</small><b>{Number(day.date.slice(-2))}</b></button>)}</div>
      <form className="photo-form" onSubmit={uploadPhoto}>
        <div className="row"><h2>{dateLabel(photoDate)}의 기록</h2><span className="badge">{selectedPhoto ? `${(selectedPhoto.size / 1024 / 1024).toFixed(1)}MB 원본` : '사진 선택'}</span></div>
        <div className="file-pickers"><button type="button" className="outline-button" onClick={() => photoInputRef.current?.click()}>앨범에서 사진 고르기</button><button type="button" className="outline-button" onClick={() => cameraInputRef.current?.click()}>카메라로 찍기</button>
          <input ref={photoInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => setSelectedPhoto(event.target.files?.[0] ?? null)} />
          <input ref={cameraInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => setSelectedPhoto(event.target.files?.[0] ?? null)} />
        </div>
        {selectedPhoto && photoPreview && <img className="photo-preview" src={photoPreview} alt="업로드 전 선택한 사진 미리보기" />}
        <label>장소<input maxLength={120} value={photoPlace} onChange={(event) => setPhotoPlace(event.target.value)} placeholder="예: 지우펀 홍등 골목" /></label>
        <label>짧은 메모<textarea rows={2} maxLength={240} value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} placeholder="그날 기억하고 싶은 한 문장" /></label>
        <p className="form-hint">업로드한 계정과 대만 현지 시각을 함께 기록합니다. 사진을 올린 사람만 해당 사진을 삭제할 수 있어요.</p>
        {photoError && <p className="error" role="alert">{photoError}</p>}
        <button className="primary" type="submit" disabled={uploading || !selectedPhoto}>{uploading ? '크기를 줄여 비공개 업로드 중…' : '이 날짜 기록에 올리기'}</button>
      </form>
      <div className="sectionline"><h2>이날의 사진</h2><span>{photoLoading && photos.length === 0 ? '불러오는 중' : `${photos.length}장`}</span></div>
      {photoLoading && photos.length === 0 ? <div className="empty-state">사진 기록을 불러오는 중…</div> : photos.length === 0 ? <div className="empty-state"><strong>아직 기록된 사진이 없어요.</strong><p>사진 한 장과 짧은 메모로 첫날을 남겨 보세요.</p></div> : <div className="photo-grid">{photos.map((photo) => <figure className="photo-entry" key={photo.id}><img src={photo.imageUrl} alt={`${photo.place || '대만 여행'} ${photo.caption}`} loading="lazy"/><figcaption><strong>{photo.place || '장소 미입력'}</strong>{photo.caption && <p>{photo.caption}</p>}<small>{photo.uploader} · {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(photo.uploadedAt))}</small>{photo.uploader === viewerLabel && <button className="delete-photo" onClick={() => void deletePhoto(photo)}>내 사진 삭제</button>}</figcaption></figure>)}</div>}
      {photoError && <p className="error" role="alert">{photoError}</p>}
    </>}

    {section === 'nearby' && <>
      <section className="collab-intro"><span>03 / NEARBY</span><h2>여는 동안에만,<br/>근처 장소를 알려줘요.</h2><p>위치 권한은 아래에서 직접 켜야 합니다. 현재 좌표는 브라우저 안에서 거리 계산에만 쓰고 서버에 보내거나 저장하지 않습니다.</p></section>
      <aside className="notice location-limits"><b>iPhone 백그라운드 안내</b><p>일반 웹사이트는 iPhone에서 백그라운드 위치 추적과 지오펜스 알림을 안정적으로 보장할 수 없습니다. 이 기능은 사이트가 화면에 열려 있는 동안만 작동하며, 화면을 벗어나면 위치 확인을 멈춥니다. 현장에서는 수동 체크인을 사용할 수 있어요.</p></aside>
      <div className="location-controls">
        <div className="row"><div><small>위치 알림</small><strong>{locationOn ? '켜짐' : '꺼짐'}</strong></div><button className={locationOn ? 'quiet-button' : 'primary small-primary'} onClick={() => { if (!locationOn && selectedPins.length === 0) { setLocationStatus('먼저 근처에서 알림 받을 장소를 선택해 주세요.'); return; } setLocationOn(!locationOn); setLocationAlert(''); if(locationOn)setLocationStatus('꺼짐 · 현재 위치는 저장되지 않습니다.'); }}>{locationOn ? '알림 끄기' : '위치 권한 허용하고 시작'}</button></div>
        <p className="location-status" role="status">{locationStatus}</p>
        <label>알림 반경<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{[150,200,300,500].map((value) => <option value={value} key={value}>{value}m</option>)}</select></label>
        <label>같은 장소 다시 알림<select value={cooldownMinutes} onChange={(event) => setCooldownMinutes(Number(event.target.value))}>{[15,30,60,120,240].map((value) => <option value={value} key={value}>{value < 60 ? `${value}분` : `${value / 60}시간`}</option>)}</select></label>
        <div className="notification-setting"><span>{notificationPermission === 'granted' ? '시스템 알림 허용됨' : notificationPermission === 'denied' ? '시스템 알림 꺼짐 · 화면 알림은 사용 가능' : notificationPermission === 'unsupported' ? '이 브라우저는 시스템 알림을 지원하지 않음' : '시스템 알림은 선택 사항'}</span>{notificationPermission === 'default' && <button className="quiet-button" onClick={() => void enableSystemNotifications()}>시스템 알림 허용</button>}</div>
      </div>
      <form className="idea-form custom-pin-form" onSubmit={addCustomPin}>
        <div className="row"><h2>관심 장소 직접 등록</h2><span className="badge">이 기기에만 저장</span></div>
        <label>장소 이름<input required maxLength={80} value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="예: 둘째 날 들를 찻집" /></label>
        <label>방문 날짜<select value={customDate} onChange={(event) => setCustomDate(event.target.value)}>{photoDays.map((day) => <option value={day.date} key={day.date}>{day.title}</option>)}</select></label>
        <label>Google Maps 좌표 링크 또는 위도, 경도<textarea required rows={2} value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} placeholder="예: 25.0339, 121.5645 또는 좌표가 포함된 지도 링크" /></label>
        <p className="form-hint">Google 지도에서 장소를 열고 공유 링크에 좌표가 들어 있는지 확인하세요. 입력한 장소 좌표만 이 기기에 저장되며 현재 위치는 저장하지 않습니다.</p>
        {customPinError && <p className="error" role="alert">{customPinError}</p>}
        <button className="primary" type="submit">알림 장소 등록</button>
      </form>
      <div className="sectionline"><h2>알림 받을 장소</h2><span>지점 좌표는 근접 기준점</span></div>
      <div className="pin-list">{allPins.map((pin) => <div className="pin-row" key={pin.id}><input id={`pin-check-${pin.id}`} type="checkbox" checked={selectedPins.includes(pin.id)} onChange={(event) => setSelectedPins((current) => event.target.checked ? [...current, pin.id] : current.filter((id) => id !== pin.id))}/><label htmlFor={`pin-check-${pin.id}`}><small>{dateLabel(pin.date)}</small><strong>{pin.name}</strong></label><a href={pin.mapUrl} target="_blank" rel="noreferrer" aria-label={`${pin.name} Google 지도에서 열기`}>지도 ↗</a><button type="button" className="manual-checkin" onClick={() => setCheckIns((items) => [{ id: pin.name, time: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }).format(new Date()) }, ...items].slice(0, 8))}>체크인</button>{pin.id.startsWith('custom-') && <button type="button" className="remove-pin" onClick={() => removeCustomPin(pin)}>삭제</button>}</div>)}</div>
      {locationAlert && <div className="location-toast" role="status"><strong>근처 도착</strong><span>{locationAlert}</span><button onClick={() => setLocationAlert('')}>확인</button></div>}
      {selectedPlacePins.length > 0 && <p className="form-hint">선택 장소 {selectedPlacePins.length}개 · 정확한 위치와 반경은 지도 및 현장 위치 편차에 영향을 받습니다. 대표 좌표는 알림 기준점입니다.</p>}
      <div className="sectionline"><h2>이 기기의 체크인 기록</h2><button className="quiet-button" onClick={() => { lastAlertByPlace.current = {}; setCheckIns([]); setAlertHistory([]); setLocationAlert(''); }}>기록 지우기</button></div>
      {[...checkIns.map((entry) => ({ ...entry, kind: '수동 체크인' })), ...alertHistory.map((entry) => ({ ...entry, kind: '근처 알림' }))].length === 0 ? <p className="form-hint">기록 없음 · 위치와 기록은 기기에 저장하지 않습니다.</p> : <div className="checkin-list">{[...checkIns.map((entry) => ({ ...entry, kind: '수동 체크인' })), ...alertHistory.map((entry) => ({ ...entry, kind: '근처 알림' }))].map((entry, index) => <p key={`${entry.kind}-${entry.id}-${entry.time}-${index}`}>{entry.time} · {entry.kind}</p>)}</div>}
    </>}
  </section>;
}
