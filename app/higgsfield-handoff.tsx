'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PhotoEntry } from './collaboration';

type Template = 'postcard' | 'place' | 'day';
type Props = {
  photo?: PhotoEntry;
  sourceFile?: File;
  sourceDate?: string;
  sourcePlace?: string;
  sourceCaption?: string;
  onAddEdited: (file: File) => void;
};
const templateLabels: Record<Template, string> = { postcard: '여행 엽서', place: '장소 안내', day: '하루 요약' };
const CHATGPT_IMAGE_LIMIT = 20_000_000;

function makePrompt(photo: Pick<PhotoEntry, 'date' | 'place' | 'caption'>, template: Template) {
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

async function prepareChatGPTImage(file: File, date: string, photoId: string) {
  const supportedType = ['image/jpeg', 'image/png'].includes(file.type.toLowerCase());
  let blob: Blob = file;
  let extension = file.type.toLowerCase() === 'image/png' ? 'png' : 'jpg';
  if (!supportedType || file.size > CHATGPT_IMAGE_LIMIT) {
    let bitmap: ImageBitmap | undefined;
    let image: HTMLImageElement | undefined;
    let objectUrl: string | undefined;
    try {
      if (typeof createImageBitmap === 'function') {
        try { bitmap = await createImageBitmap(file); } catch { bitmap = undefined; }
      }
      if (!bitmap) {
        objectUrl = URL.createObjectURL(file);
        image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error('이 사진 형식은 브라우저에서 JPEG로 변환할 수 없습니다.'));
          element.src = objectUrl!;
        });
      }
      const width = bitmap?.width ?? image?.naturalWidth ?? 0;
      const height = bitmap?.height ?? image?.naturalHeight ?? 0;
      if (!width || !height) throw new Error('사진 크기를 읽지 못했습니다.');
      const scale = Math.min(1, 1800 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('공유용 사진을 변환하지 못했습니다.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap ?? image!, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('공유용 JPEG를 만들지 못했습니다.')), 'image/jpeg', 0.84));
      extension = 'jpg';
    } finally {
      bitmap?.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
  if (blob.size > CHATGPT_IMAGE_LIMIT) throw new Error('공유용 사진이 20MB를 넘어요. 해상도를 낮춰 다시 저장해 주세요.');
  const fileExtension = extension;
  const mimeType = blob.type || (fileExtension === 'png' ? 'image/png' : fileExtension === 'gif' ? 'image/gif' : 'image/jpeg');
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'travel';
  return new File([blob], `our-taiwan-${safeDate}-${photoId.slice(0, 8)}.${fileExtension}`, { type: mimeType });
}

export default function HiggsfieldHandoff({ photo, sourceFile, sourceDate = '', sourcePlace = '', sourceCaption = '', onAddEdited }: Props) {
  const metadata = useMemo(() => ({ date: photo?.date ?? sourceDate, place: photo?.place ?? sourcePlace, caption: photo?.caption ?? sourceCaption }), [photo?.date, photo?.place, photo?.caption, sourceDate, sourcePlace, sourceCaption]);
  const [template, setTemplate] = useState<Template>('postcard');
  const [prompt, setPrompt] = useState(() => makePrompt(metadata, 'postcard'));
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPreparing(true); setPhotoFile(null); setShareAvailable(false); setError('');
    setTemplate('postcard'); setPrompt(makePrompt(metadata, 'postcard'));
    if (!sourceFile && !photo) {
      setPreparing(false);
      setError('사진 파일을 선택해 주세요.');
      return () => controller.abort();
    }
    const load = sourceFile ? Promise.resolve(sourceFile) : fetchPhotoFile(photo!.imageUrl, photo!.date, photo!.id, controller.signal);
    void load.then((file) => prepareChatGPTImage(file, metadata.date, photo?.id ?? 'upload')).then((file) => {
      if (controller.signal.aborted) return;
      setPhotoFile(file);
      try { setShareAvailable(typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })); }
      catch { setShareAvailable(false); }
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setPhotoFile(sourceFile ?? null);
        setShareAvailable(false);
        setError(cause instanceof Error ? cause.message : '공유용 사진을 준비하지 못했습니다. 아래 저장 후 직접 첨부 방법을 이용해 주세요.');
      }
    }).finally(() => { if (!controller.signal.aborted) setPreparing(false); });
    return () => controller.abort();
  }, [metadata, photo?.imageUrl, photo?.date, photo?.id, sourceFile]);
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
      setStatus('공유 메뉴를 닫았어요. ChatGPT를 선택했다면 사진이 대화에 첨부됐는지 확인한 뒤 Higgsfield에서 편집해 주세요.');
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
    <p>{sourceFile ? '기록에 업로드하기 전에 사진을 먼저 편집할 수 있어요. 원본은 사이트에 올리지 않고 기기에서 공유합니다.' : '별도 Higgsfield 앱 없이 iPhone 공유 메뉴로 사진과 편집 요청을 전달합니다.'}</p>
    <ol className="handoff-steps"><li><strong>사진과 요청문 보내기</strong><span>공유 메뉴에서 ChatGPT를 선택하고 대화가 열리면 Higgsfield에서 편집해 주세요.</span></li><li><strong>편집본 저장하기</strong><span>편집 결과를 기기에 저장해요. ChatGPT 실행, 이미지 생성, Higgsfield 선택은 자동화되지 않습니다.</span></li><li><strong>편집본 확인 후 올리기</strong><span>편집본을 선택해 미리본 뒤 이 날짜의 비공개 기록에 추가해요.</span></li></ol>
    <div className="handoff-template" aria-label="사진 편집 스타일">{(Object.keys(templateLabels) as Template[]).map((value) => <button type="button" key={value} aria-pressed={template === value} onClick={() => { setTemplate(value); setPrompt(makePrompt(metadata, value)); setStatus(''); }}>{templateLabels[value]}</button>)}</div>
    <label htmlFor={promptId}>힉스필드에 보낼 편집 요청 문구</label>
    <textarea id={promptId} ref={promptRef} rows={8} maxLength={2400} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
    <div className="handoff-share"><button type="button" className="handoff-share-primary" disabled={preparing || !shareAvailable} onClick={() => void shareToChatGPT()}>{preparing ? '공유용 사진 준비 중…' : shareAvailable ? '공유 메뉴 열기 · 사진+요청문' : '이 브라우저는 사진 공유를 지원하지 않아요'}</button><p>{shareAvailable ? '공유 메뉴에 ChatGPT가 보이면 선택하세요. 이 버튼은 공유 대상을 강제로 추가할 수는 없습니다.' : '아래에서 사진을 파일로 저장하고 요청문을 복사해 ChatGPT에 직접 첨부할 수 있어요.'}</p></div>
    <details className="handoff-fallback"><summary>공유 목록에 ChatGPT가 안 보이나요?</summary><ol><li>공식 ChatGPT 앱이 설치·최신 버전인지 확인한 뒤, 공유 창의 앱 아이콘 줄을 왼쪽으로 밀고 <strong>더 보기 → 편집</strong>에서 ChatGPT가 있으면 켜고 즐겨찾기에 추가해요.</li><li>목록에 없으면 이 사이트에서 앱을 추가할 수 없어요. 공유 창의 <strong>이미지 저장</strong> 또는 아래 <strong>사진 파일로 저장</strong>을 사용해 사진을 기기에 저장해 주세요.</li><li>ChatGPT를 열어 <strong>＋ → 사진 또는 파일</strong>에서 사진을 첨부하고, 요청문을 붙여 넣어요. 링크가 앱 대신 브라우저로 열리면 앱을 직접 실행해 주세요. 편집본은 저장한 뒤 아래에서 다시 선택해요.</li></ol><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT 열기 · 직접 첨부 ↗</a></details>
    <div className="handoff-actions"><button type="button" disabled={saving || preparing || !photoFile} onClick={() => void savePhoto()}>{saving ? '사진 저장 중…' : '사진 파일로 저장'}</button><button type="button" onClick={() => void copyPrompt()}>요청문 복사</button><a href="https://higgsfield.ai/layers" target="_blank" rel="noreferrer">Higgsfield 편집기 열기 ↗</a></div>
    <button type="button" className="handoff-return" onClick={() => inputRef.current?.click()}>편집본 선택해 기록에 추가</button>
    <input ref={inputRef} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-label="힉스필드에서 편집한 이미지 선택" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAddEdited(file); }} />
    <p className="handoff-footnote">사진을 외부로 보내면 ChatGPT/Higgsfield가 처리합니다. 편집본은 사용자가 선택해 비공개 여행 기록에 추가합니다. 외부 서비스의 이용권·비용과 데이터 처리는 각 서비스 기준입니다.</p>
    {status && <p className="handoff-status" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}
