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

export default function HiggsfieldHandoff({ photo, onAddEdited }: Props) {
  const [template, setTemplate] = useState<Template>('postcard');
  const [prompt, setPrompt] = useState(() => makePrompt(photo, 'postcard'));
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
    const frame = window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function savePhoto() {
    setSaving(true); setStatus(''); setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!/^\/api\/photos\/[a-f0-9-]{36}$/i.test(photo.imageUrl)) throw new Error('비공개 사진 주소를 확인하지 못했습니다. 기록을 다시 열어 주세요.');
      const response = await fetch(photo.imageUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('사진을 가져오지 못했어요. 로그인 상태를 확인한 뒤 다시 시도해 주세요.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('사진 파일을 확인하지 못했습니다.');
      const source = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = source;
      anchor.download = `our-taiwan-${photo.date}-${photo.id.slice(0, 8)}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(source), 60000);
      setStatus('사진 저장을 요청했어요. iPhone에서는 다운로드한 파일을 확인해 주세요.');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '사진을 저장하지 못했습니다.');
    } finally { if (!controller.signal.aborted) setSaving(false); }
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
    <p>사진 저장 후 힉스필드에 직접 업로드해 편집하세요. 이 사이트에서 사진을 자동 전송하거나 공개하지 않습니다.</p>
    <ol className="handoff-steps"><li><strong>사진 저장</strong><span>아래 버튼으로 이 사진을 기기에 저장해요.</span></li><li><strong>문구 복사 · 힉스필드 열기</strong><span>사진을 직접 올리고 원하는 편집을 요청해요.</span></li><li><strong>편집본 다시 올리기</strong><span>완성한 이미지를 선택하고 확인 후 기록에 추가해요.</span></li></ol>
    <div className="handoff-template" aria-label="사진 편집 스타일">{(Object.keys(templateLabels) as Template[]).map((value) => <button type="button" key={value} aria-pressed={template === value} onClick={() => { setTemplate(value); setPrompt(makePrompt(photo, value)); setStatus(''); }}>{templateLabels[value]}</button>)}</div>
    <label htmlFor={promptId}>힉스필드에 보낼 편집 요청 문구</label>
    <textarea id={promptId} ref={promptRef} rows={8} maxLength={2400} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
    <div className="handoff-actions"><button type="button" disabled={saving} onClick={() => void savePhoto()}>{saving ? '사진 가져오는 중…' : '1. 사진 저장'}</button><button type="button" onClick={() => void copyPrompt()}>2. 문구 복사</button><a href="https://higgsfield.ai/layers" target="_blank" rel="noreferrer">힉스필드 편집기 열기 ↗</a></div>
    <button type="button" className="handoff-return" onClick={() => inputRef.current?.click()}>3. 편집본 선택해 기록에 추가</button>
    <input ref={inputRef} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-label="힉스필드에서 편집한 이미지 선택" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAddEdited(file); }} />
    <p className="handoff-footnote">원본 기록은 유지됩니다. 편집본은 미리보기에서 확인한 뒤 업로드하세요. 힉스필드 이용권·비용과 업로드한 사진의 처리는 해당 서비스 기준입니다.</p>
    {status && <p className="handoff-status" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}
