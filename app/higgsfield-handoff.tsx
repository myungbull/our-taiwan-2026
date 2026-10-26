'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PhotoEntry } from './collaboration';

type Template = 'postcard' | 'place' | 'day';
type Props = { photo: PhotoEntry; onAddEdited: (file: File) => void };
const templateLabels: Record<Template, string> = { postcard: '여행 엽서', place: '장소 안내', day: '하루 요약' };

function makePrompt(photo: PhotoEntry, template: Template) {
  const instructions: Record<Template, string> = {
    postcard: '따뜻하고 차분한 커플 여행 엽서로 편집해 주세요. 사진 아래에 작은 날짜와 장소, 한 줄 메모를 넣어 주세요.',
    place: '여행 장소를 소개하는 인포그래픽으로 편집해 주세요. 원본 사진을 중심에 두고 장소 이름, 날짜, 짧은 설명을 정돈된 작은 정보 상자로 배치해 주세요.',
    day: '하루의 여행을 기억하는 포토 저널 인포그래픽으로 편집해 주세요. 날짜, 장소, 오늘의 한 장면을 제목과 짧은 메모로 정리해 주세요.',
  };
  return `${instructions[template]}\n\n날짜: ${photo.date}\n장소: ${photo.place || '대만 여행'}\n메모: ${photo.caption || '둘이 함께 남긴 여행의 순간'}\n\n원본 인물의 얼굴과 사진 속 장면은 유지해 주세요. 크림색 #F6F2ED, 장미색 #94505D, 진한 글자색 #332B30을 사용하고 한국어 문구는 또렷하게 써 주세요. 개인정보나 제공하지 않은 사실은 추가하지 마세요.`;
}

async function fetchPhotoFile(imageUrl: string, date: string, photoId: string, signal: AbortSignal) {
  if (!/^\/api\/photos\/[a-f0-9-]{36}$/i.test(imageUrl)) throw new Error('비공개 사진 주소를 확인하지 못했습니다. 기록을 다시 열어 주세요.');
  const response = await fetch(imageUrl, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) throw new Error('사진을 가져오지 못했어요. 로그인 상태를 확인한 뒤 다시 시도해 주세요.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('사진 파일을 확인하지 못했습니다.');
  const extension = (blob.type.split('/')[1] || 'jpeg').toLowerCase().replace(/^jpeg$/, 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
  return new File([blob], `our-taiwan-${date}-${photoId.slice(0, 8)}.${extension}`, { type: blob.type });
}

export default function HiggsfieldHandoff({ photo, onAddEdited }: Props) {
  const [template, setTemplate] = useState<Template>('postcard');
  const [prompt, setPrompt] = useState(() => makePrompt(photo, 'postcard'));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [shareAvailable, setShareAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const promptId = useId();
  const titleId = useId();

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPreparing(true); setPhotoFile(null); setShareAvailable(false); setError('');
    void fetchPhotoFile(photo.imageUrl, photo.date, photo.id, controller.signal).then((file) => {
      if (controller.signal.aborted) return;
      setPhotoFile(file);
      try { setShareAvailable(typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })); }
      catch { setShareAvailable(false); }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '공유용 사진을 준비하지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setPreparing(false); });
    return () => controller.abort();
  }, [photo.imageUrl, photo.date, photo.id]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function savePhoto() {
    if (!photoFile) { setError('사진을 준비하지 못했어요. 기록을 다시 열어 주세요.'); return; }
    setSaving(true); setStatus(''); setError('');
    try {
      const source = URL.createObjectURL(photoFile);
      const anchor = document.createElement('a');
      anchor.href = source;
      anchor.download = photoFile.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(source), 60000);
      setStatus('사진 저장을 요청했어요. iPhone에서는 다운로드한 파일을 확인해 주세요.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '사진을 저장하지 못했습니다.');
    } finally { setSaving(false); }
  }

  async function shareToChatGPT() {
    setError(''); setStatus('');
    if (!photoFile || !shareAvailable || !navigator.share) {
      setError('이 브라우저에서 사진 공유를 지원하지 않습니다. 아래 저장·복사 방법을 이용해 주세요.');
      return;
    }
    try {
      await navigator.share({ files: [photoFile], title: 'Our Taiwan 2026 사진 편집', text: prompt });
      setStatus('공유 메뉴를 닫았어요. ChatGPT에서 Higgsfield 앱을 직접 선택해 편집을 이어가세요.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') setStatus('공유를 취소했어요. 원본 사진은 변경되지 않았습니다.');
      else setError(cause instanceof Error ? cause.message : '공유 메뉴를 열지 못했습니다. 아래 저장·복사 방법을 이용해 주세요.');
    }
  }

  async function copyPrompt() {
    setError('');
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus('편집 요청 문구를 복사했어요. 힉스필드에 사진과 함께 붙여 넣어 주세요.');
    } catch {
      promptRef.current?.focus(); promptRef.current?.select();
      setStatus('아래 문구를 선택했어요. 길게 눌러 복사한 뒤 힉스필드에 붙여 넣어 주세요.');
    }
  }

  return <section ref={panelRef} className="higgsfield-handoff" aria-labelledby={titleId}>
    <div className="handoff-title"><span>PHOTO STUDIO</span><h3 id={titleId}>사진에 여행 이야기를 더해요</h3></div>
    <p>별도 Higgsfield 앱 없이 iPhone 공유 메뉴를 이용해요. 공유를 누르면 원본 사진과 요청 문구가 전달되며, 목록에서 ChatGPT를 직접 선택해야 합니다.</p>
    <ol className="handoff-steps"><li><strong>사진과 요청문 보내기</strong><span>공유 메뉴에서 ChatGPT를 선택해요. 대화가 열린 뒤 Higgsfield 앱을 직접 실행해 주세요.</span></li><li><strong>편집본 저장하기</strong><span>ChatGPT에서 편집 결과를 기기에 저장해요. 생성과 Higgsfield 선택은 자동으로 실행되지 않습니다.</span></li><li><strong>편집본 다시 올리기</strong><span>아래에서 결과 이미지를 선택하면 미리보기 후 날짜 기록에 추가할 수 있어요.</span></li></ol>
    <div className="handoff-template" aria-label="사진 편집 스타일">{(Object.keys(templateLabels) as Template[]).map((value) => <button type="button" key={value} aria-pressed={template === value} onClick={() => { setTemplate(value); setPrompt(makePrompt(photo, value)); setStatus(''); }}>{templateLabels[value]}</button>)}</div>
    <label htmlFor={promptId}>힉스필드에 보낼 편집 요청 문구</label>
    <textarea id={promptId} ref={promptRef} rows={8} maxLength={2400} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
    <div className="handoff-share"><button type="button" className="handoff-share-primary" disabled={preparing || !shareAvailable} onClick={() => void shareToChatGPT()}>{preparing ? '공유용 사진 준비 중…' : shareAvailable ? 'ChatGPT로 사진·요청 보내기' : '이 브라우저는 사진 공유를 지원하지 않아요'}</button><p>{shareAvailable ? '공유 메뉴에서 ChatGPT를 선택하세요. ChatGPT가 목록에 없으면 아래 방법을 이용해 주세요.' : '사진이 준비되면 지원 여부를 확인합니다. 공유할 수 없으면 아래에서 사진을 저장하고 요청문을 복사할 수 있어요.'}</p></div>
    <div className="handoff-actions"><button type="button" disabled={saving || preparing || !photoFile} onClick={() => void savePhoto()}>{saving ? '사진 저장 중…' : '사진 파일로 저장'}</button><button type="button" onClick={() => void copyPrompt()}>요청문 복사</button><a href="https://higgsfield.ai/layers" target="_blank" rel="noreferrer">Higgsfield 편집기 열기 ↗</a></div>
    <button type="button" className="handoff-return" onClick={() => inputRef.current?.click()}>편집본 선택해 기록에 추가</button>
    <input ref={inputRef} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-label="힉스필드에서 편집한 이미지 선택" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAddEdited(file); }} />
    <p className="handoff-footnote">전송한 사진은 ChatGPT/Higgsfield가 처리합니다. 편집본은 비공개 여행 기록에 별도로 추가되며, 원본 기록은 유지돼요. 외부 서비스의 이용권·비용과 데이터 처리는 각 서비스 기준입니다.</p>
    {status && <p className="handoff-status" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}
