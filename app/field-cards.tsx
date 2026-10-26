'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldCards, fieldCardTabs, fieldCardText, type FieldCard, type FieldCardType } from './field-card-data';
import './field-cards.css';

type Props = { type?: FieldCardType; onNavigate?: (href: string) => void };
type ExportFile = { url: string; file: File; cardId: string };
type VoiceState = 'idle' | 'starting' | 'speaking' | 'unavailable';

function getVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const normalized = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace('_', '-');
  const rank = (voice: SpeechSynthesisVoice) => {
    const value = normalized(voice);
    const languageRank = lang === 'ko-KR'
      ? value === 'ko-kr' ? 0 : value.startsWith('ko') ? 1 : 20
      : value === 'zh-tw' ? 0 : value.startsWith('zh-hant') && !value.includes('hk') ? 1 : value === 'zh-cn' || value === 'cmn-cn' || value === 'cmn-tw' ? 2 : 20;
    return languageRank * 2 + (voice.localService ? 0 : 1);
  };
  return voices.filter(voice => rank(voice) < 20).sort((a, b) => rank(a) - rank(b))[0];
}

async function makeCardImage(card: FieldCard): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1580;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 카드 이미지를 만들 수 없어요. 큰 글씨 화면을 캡처해 주세요.');
  const font = '-apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = '#f7f4ef'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fffefc'; ctx.fillRect(54, 54, 972, 1472);
  let y = 126;
  function lines(text: string, size: number, weight = '400', color = '#302c2d', lineHeight = size * 1.5) {
    ctx!.font = `${weight} ${size}px ${font}`;
    ctx!.fillStyle = color;
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (ctx!.measureText(line + character).width > 860 && line) {
          ctx!.fillText(line, 110, y); y += lineHeight; line = character;
        } else line += character;
      }
      ctx!.fillText(line, 110, y); y += lineHeight;
    }
  }
  lines('OUR TAIWAN 2026', 28, '650', '#934758'); y += 28;
  lines(card.status === 'candidate' ? '후보 카드 · 예약 전' : card.statusLabel, 34, '700', '#934758'); y += 50;
  lines(card.destination, 74, '700', '#302c2d', 108); y += 30;
  lines(card.address, 39, '500', '#52494d', 60); y += 50;
  ctx.strokeStyle = '#e8deda'; ctx.beginPath(); ctx.moveTo(110, y); ctx.lineTo(970, y); ctx.stroke(); y += 62;
  lines(card.date, 31, '600', '#934758', 49); y += 25;
  for (const detail of card.details) { lines(detail, 30, '400', '#52494d', 46); y += 13; }
  y += 22;
  lines(card.note, 27, '400', '#75666c', 42);
  ctx.font = `400 24px ${font}`; ctx.fillStyle = '#8b8082';
  ctx.fillText(`저장일 ${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())} · 저장 시점의 여행 계획`, 110, 1400);
  ctx.fillText('운항·예약 정보는 자동 갱신되지 않습니다.', 110, 1440);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 생성에 실패했어요. 다시 시도해 주세요.')), 'image/png'));
}

export function FieldCards({ type = 'airport', onNavigate }: Props) {
  const [selectedId, setSelectedId] = useState('taoyuan-return');
  const options = fieldCards.filter(card => card.type === type);
  const card = options.find(item => item.id === selectedId) || options[0];
  const [largeOpen, setLargeOpen] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceHint, setVoiceHint] = useState('버튼을 누르면 목적지 안내를 읽어 드려요.');
  const [message, setMessage] = useState('');
  const [copyFallback, setCopyFallback] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<ExportFile | null>(null);
  const [canShareFile, setCanShareFile] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const utteranceSequence = useRef(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const currentCardRef = useRef(card.id);
  currentCardRef.current = card.id;

  const stopVoice = useCallback(() => {
    utteranceSequence.current += 1;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setVoiceState(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? 'idle' : 'unavailable');
  }, []);

  useEffect(() => {
    const available = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    setVoiceSupported(available);
    if (!available) { setVoiceState('unavailable'); setVoiceHint('이 브라우저에서는 음성을 지원하지 않아요. 큰 글씨와 문구 복사를 이용해 주세요.'); return; }
    function updateVoices() {
      const voices = window.speechSynthesis.getVoices();
      const voice = getVoice(voices, card.speechLang);
      if (voice) {
        setVoiceState(current => current === 'unavailable' ? 'idle' : current);
        setVoiceHint(card.speechLang === 'ko-KR' ? '기기의 한국어 음성으로 읽어요.' : /^zh[-_]tw$/i.test(voice.lang) || /^cmn[-_]tw$/i.test(voice.lang) ? '기기의 중국어(대만) 음성으로 읽어요.' : '기기의 중국어 음성으로 읽어요. 대만 발음과 다를 수 있어요.');
      }
      else setVoiceHint('기기의 음성 지원에 따라 재생 여부가 달라요. 재생되지 않으면 큰 글씨로 보여주세요.');
    }
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    const onVisibility = () => { if (document.hidden) stopVoice(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', updateVoices); document.removeEventListener('visibilitychange', onVisibility); stopVoice(); };
  }, [card.speechLang, stopVoice]);

  useEffect(() => {
    stopVoice(); setMessage(''); setCopyFallback(false); setAcknowledged(false); setPrepared(null); setCanShareFile(false);
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
  }, [card.id, stopVoice]);

  useEffect(() => () => { if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current); }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!largeOpen || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = previousOverflow; launchRef.current?.focus(); };
  }, [largeOpen]);

  function closeLarge() { stopVoice(); setLargeOpen(false); }

  function speakCard() {
    if (voiceState === 'speaking' || voiceState === 'starting') { stopVoice(); return; }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setVoiceState('unavailable');
      setVoiceHint('이 브라우저에서는 음성을 지원하지 않아요. 큰 글씨와 문구 복사를 이용해 주세요.');
      return;
    }
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const voice = getVoice(voices, card.speechLang);
    if (voices.length && !voice) {
      setVoiceState('unavailable');
      setVoiceHint(`이 기기에 ${card.speechLang === 'ko-KR' ? '한국어' : '중국어'} 음성이 없어요. 큰 글씨나 문구 복사를 이용해 주세요.`);
      return;
    }
    stopVoice();
    const sequence = utteranceSequence.current;
    const utterance = new SpeechSynthesisUtterance(card.speechText);
    utterance.lang = voice?.lang || card.speechLang;
    utterance.rate = 0.85;
    if (voice) utterance.voice = voice;
    utteranceRef.current = utterance;
    setVoiceState('starting');
    utterance.onstart = () => { if (sequence === utteranceSequence.current) { if (startTimerRef.current) clearTimeout(startTimerRef.current); setVoiceState('speaking'); } };
    utterance.onend = () => { if (sequence === utteranceSequence.current) { if (startTimerRef.current) clearTimeout(startTimerRef.current); setVoiceState('idle'); utteranceRef.current = null; } };
    utterance.onerror = event => {
      if (sequence !== utteranceSequence.current || event.error === 'canceled' || event.error === 'interrupted') return;
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      setVoiceState('idle'); utteranceRef.current = null;
      setVoiceHint('음성을 재생하지 못했어요. 기기 음량·지원 음성을 확인하거나 큰 글씨로 보여주세요.');
    };
    startTimerRef.current = setTimeout(() => {
      if (sequence === utteranceSequence.current) { stopVoice(); setVoiceHint('음성 재생이 시작되지 않았어요. 큰 글씨 또는 문구 복사를 이용해 주세요.'); }
    }, 6000);
    // Keep the call synchronous with the user's tap for iPhone audio restrictions.
    try { synth.speak(utterance); }
    catch { stopVoice(); setVoiceHint('음성을 재생하지 못했어요. 큰 글씨나 문구 복사를 이용해 주세요.'); }
  }

  async function copyCard() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(fieldCardText(card));
      setMessage('목적지와 여행 정보를 복사했어요.'); setCopyFallback(false);
    } catch { setCopyFallback(true); setMessage('아래 문구를 길게 눌러 복사해 주세요.'); requestAnimationFrame(() => { copyRef.current?.focus(); copyRef.current?.select(); }); }
  }

  async function prepareImage() {
    if (card.status === 'pending' || preparing || card.status === 'candidate' && !acknowledged) return;
    const cardId = card.id;
    setPreparing(true); setMessage('카드 이미지를 준비하고 있어요.');
    try {
      const blob = await makeCardImage(card);
      if (currentCardRef.current !== cardId) return;
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      const url = URL.createObjectURL(blob);
      exportUrlRef.current = url;
      const file = new File([blob], `our-taiwan-${card.id}.png`, { type: 'image/png' });
      setPrepared({ url, file, cardId });
      let shareable = false;
      try { shareable = !!navigator.share && !!navigator.canShare?.({ files: [file] }); } catch { /* Download remains available. */ }
      setCanShareFile(shareable);
      setMessage('미리보기를 확인한 뒤 아래 저장·공유 버튼을 눌러 주세요.');
    } catch (error) { setMessage(error instanceof Error ? error.message : '이미지를 준비하지 못했어요. 다시 시도해 주세요.'); }
    finally { setPreparing(false); }
  }

  async function shareImage() {
    if (!prepared || prepared.cardId !== card.id || !navigator.share) return;
    try { await navigator.share({ files: [prepared.file], title: card.title }); setMessage('공유 창을 닫았어요. 저장 여부는 선택한 앱에서 확인해 주세요.'); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('공유하지 못했어요. 이미지 다운로드를 이용해 주세요.'); }
  }

  const hasDestination = card.status !== 'pending';
  const mapUrl = card.mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.mapQuery)}` : '';
  const voiceLabel = card.speechLang === 'ko-KR' ? '한국어로 듣기' : '중국어로 듣기';
  const voiceButton = <button type="button" className="field-action field-action-primary" onClick={speakCard} disabled={!hasDestination || voiceSupported === false || voiceState === 'unavailable'} aria-pressed={voiceState === 'speaking' || voiceState === 'starting'}>{voiceState === 'speaking' ? '음성 중지' : voiceState === 'starting' ? '재생 준비 중 · 중지' : voiceLabel}</button>;

  return <section className="field-cards" aria-labelledby="field-cards-title">
    <div className="field-heading"><p className="field-eyebrow">보여주고, 들려주고</p><h1 id="field-cards-title">현장 여행 카드</h1><p>목적지 정보를 크게 보여주거나 음성으로 전하세요.</p></div>
    <nav className="field-tabs" aria-label="현장 카드 종류">{fieldCardTabs.map(tab => <a key={tab.type} href={`/field-cards?type=${tab.type}`} aria-current={type === tab.type ? 'page' : undefined} onClick={event => { if (onNavigate) { event.preventDefault(); stopVoice(); onNavigate(`/field-cards?type=${tab.type}`); } }}>{tab.label}</a>)}</nav>
    {options.length > 1 && <label className="field-select-label">{type === 'hotel' ? '숙소 후보 미리보기' : '공항 카드 선택'}<select value={card.id} onChange={event => { setSelectedId(event.target.value); stopVoice(); }}>{options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>}
    {card.status === 'candidate' && <div className="field-notice"><strong>아직 예약한 숙소가 아니에요.</strong><p>선택은 후보 미리보기용입니다. 예약·예산의 완료 체크와 연동해 숙소를 확정하지 않습니다.</p></div>}
    <article className={`field-destination field-status-${card.status}`}>
      <span className={`field-status ${card.status === 'confirmed' ? 'field-status-confirmed' : ''}`}>{card.statusLabel}</span>
      <p className="field-destination-date">{card.date}</p>
      <h2 lang={card.speechLang === 'zh-TW' && hasDestination ? 'zh-Hant-TW' : 'ko'}>{card.destination}</h2>
      {card.address && <p className="field-address" lang={card.speechLang === 'zh-TW' ? 'zh-Hant-TW' : 'ko'}>{card.address}</p>}
      {card.status === 'candidate' && <p className="field-candidate-watermark">후보 카드 · 예약 전</p>}
      <ul className="field-details">{card.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
      <p className="field-card-note">{card.note}</p>
    </article>
    {hasDestination ? <>
      <div className="field-actions"><button type="button" className="field-action field-action-primary" ref={launchRef} onClick={() => setLargeOpen(true)}>큰 글씨로 보여주기</button>{voiceButton}</div>
      <p className="field-voice-hint" role="status">{voiceHint} 음성 종류와 연결 상태에 따라 오프라인 재생은 제한될 수 있어요.</p>
      <div className="field-actions"><button type="button" className="field-action" onClick={copyCard}>문구 복사</button><a className="field-action" href={mapUrl} target="_blank" rel="noopener noreferrer">지도에서 보기</a></div>
      {copyFallback && <label className="field-copy-fallback">복사할 문구<textarea ref={copyRef} readOnly value={fieldCardText(card)} rows={7} onFocus={event => event.currentTarget.select()} /></label>}
      <section className="field-save" aria-labelledby="field-save-title"><h2 id="field-save-title">인터넷이 없어도 볼 수 있게</h2><p>카드 이미지를 미리 준비해 휴대폰 사진·파일 앱에 저장하세요. 저장한 이미지는 이후 변경 내용을 자동 반영하지 않아요.</p>
        {card.status === 'candidate' && <label className="field-confirm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />예약 전 후보 카드로 저장하는 것을 확인했어요.</label>}
        <button type="button" className="field-action field-action-wide" onClick={prepareImage} disabled={preparing || card.status === 'candidate' && !acknowledged}>{preparing ? '이미지 준비 중…' : prepared ? '이미지 다시 준비' : '카드 이미지 미리보기'}</button>
        {prepared?.cardId === card.id && <div className="field-export-preview"><img src={prepared.url} alt={`${card.title} 저장 이미지 미리보기${card.status === 'candidate' ? ' · 후보 카드, 예약 전' : ''}`} /><div className="field-actions">{canShareFile && <button type="button" className="field-action field-action-primary" onClick={shareImage}>저장·공유</button>}<a className="field-action" href={prepared.url} download={prepared.file.name} onClick={() => setMessage('다운로드가 열리면 사진·파일 앱에서 저장 위치를 확인해 주세요.')}>이미지 다운로드</a></div><p>아이폰에서는 저장·공유에서 이미지 저장을 선택하거나, 다운로드한 이미지를 길게 눌러 저장할 수 있어요.</p></div>}
        <p className="field-privacy-note">저장·공유한 이미지는 사이트의 두 사람 접근 제한 밖에서 관리됩니다. 삭제하려면 사진·파일 앱에서도 직접 지워 주세요. 예약번호·이메일·카드정보는 이미지에 넣지 않습니다.</p>
      </section>
    </> : <div className="field-pending"><strong>정확한 집결 정보 확인이 먼저예요.</strong><p>잘못된 장소로 안내하지 않도록 지도·음성·이미지 저장은 집결지 확인 전에는 제공하지 않아요.</p></div>}
    {message && <p className="field-message" role="status">{message}</p>}
    <details className="field-sources"><summary>정보 출처와 확인 범위</summary><p>장소 이름·주소: 공식 안내 확인(2026.10.26). 항공편·여행 시각: 두 사람이 제공한 여행 계획. 공항 도착 목표는 계획값이며, 투어 집결지와 숙소 예약은 미확정입니다.</p>{card.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}</details>
    {largeOpen && <dialog ref={dialogRef} className="field-large-dialog" aria-labelledby="field-large-title" onCancel={event => { event.preventDefault(); closeLarge(); }} onClick={event => { if (event.target === event.currentTarget) closeLarge(); }}><div className="field-large-inner"><div className="field-large-toolbar"><span>{card.statusLabel}</span><button type="button" onClick={closeLarge} aria-label="큰 글씨 카드 닫기" autoFocus>닫기</button></div><p className="field-destination-date">{card.date}</p><h2 id="field-large-title" lang={card.speechLang === 'zh-TW' ? 'zh-Hant-TW' : 'ko'}>{card.destination}</h2><p className="field-large-address" lang={card.speechLang === 'zh-TW' ? 'zh-Hant-TW' : 'ko'}>{card.address}</p>{card.status === 'candidate' && <p className="field-candidate-watermark">후보 카드 · 예약 전</p>}<div className="field-large-controls">{voiceButton}<button type="button" className="field-action" onClick={copyCard}>문구 복사</button></div><p className="field-voice-hint" role="status">{voiceHint}</p>{message && <p className="field-message" role="status">{message}</p>}{copyFallback && <textarea className="field-dialog-copy" readOnly value={fieldCardText(card)} rows={5} aria-label="복사할 목적지 문구" onFocus={event => event.currentTarget.select()} />}</div></dialog>}
  </section>;
}

export default FieldCards;

