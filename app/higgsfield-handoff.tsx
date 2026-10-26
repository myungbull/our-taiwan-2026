'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PhotoEntry } from './collaboration';

type Template = 'postcard' | 'place' | 'day' | 'doodle';
type Props = {
  photo?: PhotoEntry;
  sourceFile?: File;
  sourceDate?: string;
  sourcePlace?: string;
  sourceCaption?: string;
  onAddEdited: (file: File) => void;
};
const templateLabels: Record<Template, string> = { postcard: '여행 엽서', place: '장소 안내', day: '하루 요약', doodle: '컬러 낙서 스티커' };
const templateDescriptions: Record<Template, string> = {
  postcard: '차분한 여행 엽서처럼 날짜와 장소를 담아요.',
  place: '장소 이름과 짧은 설명을 정보 카드로 정리해요.',
  day: '그날의 장면을 포토 저널 인포그래픽으로 남겨요.',
  doodle: '사진은 그대로 두고 별·하트·꽃과 손글씨 낙서를 더해요.',
};
const CHATGPT_IMAGE_LIMIT = 20_000_000;

function makePrompt(photo: Pick<PhotoEntry, 'date' | 'place' | 'caption'>, template: Template) {
  const instructions: Record<Template, string> = {
    postcard: '따뜻하고 차분한 커플 여행 엽서로 편집해 주세요. 사진 아래에 작은 날짜와 장소, 한 줄 메모를 넣어 주세요.',
    place: '여행 장소를 소개하는 인포그래픽으로 편집해 주세요. 원본 사진을 중심에 두고 장소 이름, 날짜, 짧은 설명을 정돈된 작은 정보 상자로 배치해 주세요.',
    day: '하루의 여행을 기억하는 포토 저널 인포그래픽으로 편집해 주세요. 날짜, 장소, 오늘의 한 장면을 제목과 짧은 메모로 정리해 주세요.',
    doodle: '원본 사진 위에 요즘 여행 사진 꾸미기처럼 생동감 있는 핸드드로잉 낙서 스티커를 더해 주세요. 사진의 인물·장면·색감은 사진 그대로 유지하고, 인물 주변의 빈 공간에 거친 검정 펜 테두리와 선명한 코발트 블루·레드·옐로·핑크·그린 포인트로 별, 하트, 꽃, 반짝임, 밑줄, 화살표를 몇 개 그려 주세요. 사진 속 소품 한두 개를 손그림 선으로 가볍게 강조하고, 사진과 어울리도록 작은 손글씨 문구 “TAIWAN DAY!”와 “GOOD VIBES”만 배치해 주세요. 낙서가 얼굴·눈·몸을 가리지 않게 하고 사진을 다시 그리거나 인물의 정체성·표정·포즈·옷·배경을 바꾸지 마세요. 인스타그램 화면이나 소셜 앱 UI를 만들지 말고 좋아요·댓글·검색·프로필 아이콘, 계정명, 조회수, 테두리, 워터마크를 추가하지 마세요. 지정한 두 문구 외에는 글자나 사실을 만들지 마세요.',
  };
  const styleGuard = template === 'doodle'
    ? '낙서 포인트는 코발트 블루·레드·옐로·핑크·그린으로 생생하게 유지해 주세요. 메타데이터를 이미지에 별도로 덧붙이지 말고 개인정보나 제공하지 않은 사실은 추가하지 마세요.'
    : '크림색 #F6F2ED, 장미색 #94505D, 진한 글자색 #332B30을 사용하고 한국어 문구는 또렷하게 써 주세요. 개인정보나 제공하지 않은 사실은 추가하지 마세요.';
  return `${instructions[template]}\n\n날짜: ${photo.date}\n장소: ${photo.place || '대만 여행'}\n메모: ${photo.caption || '둘이 함께 남긴 여행의 순간'}\n\n원본 인물의 얼굴과 사진 속 장면은 유지해 주세요. ${styleGuard}`;
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
    <ol className="handoff-steps"><li><strong>사진과 요청문 보내기</strong><span>공유 메뉴에서 ChatGPT를 선택해요. Higgsfield 도구가 ChatGPT 계정에 보일 때만 직접 선택할 수 있고, 없으면 아래 편집기 링크에서 사진과 요청문을 사용해 주세요.</span></li><li><strong>Higgsfield에서 편집·저장하기</strong><span>편집기에서 사진을 열고 요청문을 붙여 넣어요. 서비스 전환과 결과 저장은 직접 해야 하며 자동화되지 않습니다.</span></li><li><strong>편집본 확인 후 올리기</strong><span>편집본을 선택해 미리본 뒤 이 날짜의 비공개 기록에 추가해요.</span></li></ol>
    <div className="handoff-template" aria-label="사진 편집 스타일">{(Object.keys(templateLabels) as Template[]).map((value) => <button type="button" key={value} aria-pressed={template === value} onClick={() => { setTemplate(value); setPrompt(makePrompt(metadata, value)); setStatus(''); }}>{templateLabels[value]}</button>)}</div>
    <p className="handoff-template-description" aria-live="polite">{templateDescriptions[template]}</p>
    <label htmlFor={promptId}>힉스필드에 보낼 편집 요청 문구</label>
    <textarea id={promptId} ref={promptRef} rows={8} maxLength={2400} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
    <div className="handoff-share"><button type="button" className="handoff-share-primary" disabled={preparing || !shareAvailable} onClick={() => void shareToChatGPT()}>{preparing ? '공유용 사진 준비 중…' : shareAvailable ? '공유 메뉴 열기 · 사진+요청문' : '이 브라우저는 사진 공유를 지원하지 않아요'}</button><p>{shareAvailable ? '공유 메뉴에 ChatGPT가 보이면 선택하세요. 이 버튼은 공유 대상을 강제로 추가할 수는 없습니다.' : '아래에서 사진을 파일로 저장하고 요청문을 복사해 ChatGPT에 직접 첨부할 수 있어요.'}</p></div>
    <details className="handoff-fallback"><summary>공유 목록에 ChatGPT가 안 보이나요?</summary><ol><li>공식 ChatGPT 앱이 설치·최신 버전인지 확인한 뒤, 공유 창의 앱 아이콘 줄을 왼쪽으로 밀고 <strong>더 보기 → 편집</strong>에서 ChatGPT가 있으면 켜고 즐겨찾기에 추가해요.</li><li>목록에 없으면 이 사이트에서 앱을 추가할 수 없어요. 공유 창의 <strong>이미지 저장</strong> 또는 아래 <strong>사진 파일로 저장</strong>을 사용해 사진을 기기에 저장하고 요청문을 복사해 주세요.</li><li>ChatGPT를 직접 쓰려면 <strong>＋ → 사진 또는 파일</strong>에서 첨부하고 요청문을 붙여 넣어요. Higgsfield 편집은 아래 편집기 링크를 열어 저장한 사진과 요청문으로 진행해 주세요. 어느 쪽이든 결과를 저장한 뒤 사이트에서 편집본을 다시 선택해요.</li></ol><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT 열기 · 직접 첨부 ↗</a></details>
    <div className="handoff-actions"><button type="button" disabled={saving || preparing || !photoFile} onClick={() => void savePhoto()}>{saving ? '사진 저장 중…' : '사진 파일로 저장'}</button><button type="button" onClick={() => void copyPrompt()}>요청문 복사</button><a href="https://higgsfield.ai/layers" target="_blank" rel="noreferrer">Higgsfield 편집기 열기 ↗</a></div>
    <button type="button" className="handoff-return" onClick={() => inputRef.current?.click()}>편집본 선택해 기록에 추가</button>
    <input ref={inputRef} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-label="힉스필드에서 편집한 이미지 선택" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAddEdited(file); }} />
    <p className="handoff-footnote">사진을 외부로 보내면 ChatGPT/Higgsfield가 처리합니다. 사이트가 ChatGPT 세션이나 Higgsfield를 자동 실행하거나 편집본을 자동으로 가져오지는 않아요. 결과는 직접 저장하고 선택해 비공개 여행 기록에 추가해 주세요. 외부 서비스의 이용권·비용과 데이터 처리는 각 서비스 기준입니다.</p>
    {status && <p className="handoff-status" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}
