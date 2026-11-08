'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PhotoEntry } from './collaboration';
import { canvasToBlob, photoToCanvas } from './image-canvas';

type Template = 'postcard' | 'place' | 'day' | 'doodle' | 'watercolor';
type Props = {
  photo?: PhotoEntry;
  sourceFile?: File;
  sourceDate?: string;
  sourcePlace?: string;
  sourceCaption?: string;
  viewerLabel?: string;
  onAddEdited: (file: File) => void;
};
// A claude.ai Code session in the cloud environment that holds the Cloudflare token
// (docs/CLOUD_PHOTO_EDIT.md). The link only pre-fills the composer; the user still taps send.
const CLAUDE_REPO = 'myungbull/our-taiwan-2026';
const CLAUDE_BRANCH = 'handoff/weather-tests';
const CLAUDE_ENVIRONMENT = 'taiwan-photo-import';
const templateLabels: Record<Template, string> = { postcard: '여행 엽서', place: '장소 안내', day: '하루 요약', doodle: '컬러 낙서 페인팅', watercolor: '수채화 배경' };
const templateDescriptions: Record<Template, string> = {
  postcard: '차분한 여행 엽서처럼 날짜와 장소를 담아요.',
  place: '장소 이름과 짧은 설명을 정보 카드로 정리해요.',
  day: '그날의 장면을 포토 저널 인포그래픽으로 남겨요.',
  doodle: '옷·소품 같은 일부를 선명한 물감으로 꽉 채워 칠하고, 사진에 맞는 손글씨 낙서를 더해요.',
  watercolor: '사람은 사진 그대로 두고, 배경만 번지는 수채화 그림으로 바꿔요.',
};
const IMAGE_LIMIT = 5_000_000;

// Every template is refined by the cloud session after it looks at the photo (docs/CLOUD_PHOTO_EDIT.md),
// so the wording here describes the style and leaves photo-specific details to that analysis.
const PHOTO_ANALYSIS = '편집 전에 사진을 먼저 살펴보고 장소·주요 사물·인물의 표정과 행동을 파악한 뒤, 그 사진에 맞게 아래 요청을 구체화해 주세요.';

function makePrompt(photo: Pick<PhotoEntry, 'date' | 'place' | 'caption'>, template: Template) {
  const instructions: Record<Template, string> = {
    postcard: '따뜻하고 차분한 커플 여행 엽서로 편집해 주세요. 사진 아래에 작은 날짜와 장소, 한 줄 메모를 넣어 주세요.',
    place: '여행 장소를 소개하는 인포그래픽으로 편집해 주세요. 원본 사진을 중심에 두고 장소 이름, 날짜, 짧은 설명을 정돈된 작은 정보 상자로 배치해 주세요.',
    day: '하루의 여행을 기억하는 포토 저널 인포그래픽으로 편집해 주세요. 날짜, 장소, 오늘의 한 장면을 제목과 짧은 메모로 정리해 주세요.',
    doodle: '요즘 유행하는 "컬러 낙서 페인팅" 사진 꾸미기로 편집해 주세요. 사진 속 옷·모자·가방·음료·간판 같은 사물이나 팔·머리카락 같은 신체 일부 2~4곳을 골라, 굵은 검정 마커 윤곽선 안을 선명한 원색 물감(코발트 블루·레드·옐로·핑크·그린)으로 사진 질감이 보이지 않게 꽉 채워 칠해 주세요. 마치 사진 위에 직접 크레용과 마커로 칠한 것처럼 납작하고 진한 색면이어야 해요. 그 주변에 사진의 분위기에 맞는 별·하트·꽃·반짝임·화살표·말풍선 낙서와 짧은 영어 손글씨 문구 1~2개를 더해 주세요. 문구는 인물의 표정과 행동, 장소에 맞게 정해 주세요(예: 먹고 있으면 음식 관련, 웃고 있으면 기분 관련). 얼굴(눈·코·입·피부)은 칠하지 말고 사진 그대로 두며, 인물의 정체성·표정·포즈는 바꾸지 마세요. 인스타그램 화면이나 소셜 앱 UI, 아이콘, 계정명, 테두리, 워터마크는 넣지 마세요.',
    watercolor: '배경만 수채화 그림으로 바꿔 주세요. 인물은 사진 그대로(얼굴·피부·머리카락·옷·표정·포즈와 사진 질감) 유지하고 인물 윤곽을 깔끔하게 분리해 주세요. 인물 뒤의 배경은 원래 장소의 구도와 주요 형태(건물·하늘·나무·간판 등)를 살린 채, 종이 질감이 보이는 맑은 수채화로 다시 그려 주세요. 물감이 번지고 겹치는 부드러운 가장자리, 사진의 빛과 시간대에 맞는 색감을 써 주세요. 인물과 배경의 경계에는 수채화 물감이 살짝 번진 느낌을 주되 인물을 침범하지 않게 해 주세요. 글자·테두리·워터마크는 넣지 마세요.',
  };
  const textGuard = '날짜·장소·메모에 쓰인 것 외의 사실이나 개인정보를 만들지 마세요.';
  const styleGuard = template === 'doodle' || template === 'watercolor'
    ? textGuard
    : `크림색 #F6F2ED, 장미색 #94505D, 진한 글자색 #332B30을 사용하고 한국어 문구는 또렷하게 써 주세요. ${textGuard}`;
  const place = photo.place || '(비어 있음 · 사진에서 확실히 알 수 있을 때만 쓰고, 아니면 장소 글자는 넣지 마세요)';
  const caption = photo.caption || '(비어 있음 · 사진 속 장면에 맞는 짧은 한 줄을 지어 주세요)';
  return `${PHOTO_ANALYSIS}\n\n${instructions[template]}\n\n날짜: ${photo.date}\n장소: ${place}\n메모: ${caption}\n\n원본 인물의 얼굴은 알아볼 수 있게 유지해 주세요. ${styleGuard}`;
}

function makeClaudeRequest(editPrompt: string, metadata: { date: string; place: string; caption: string }, uploader: string, photoId?: string, sourceId?: string) {
  return [
    `대만 여행 앱 사진 편집 요청이에요. 먼저 \`git checkout ${CLAUDE_BRANCH}\` 하고 docs/CLOUD_PHOTO_EDIT.md 절차대로 진행해 주세요.`,
    '',
    photoId ? `사진 ID: ${photoId}` : sourceId ? `편집용 원본 ID: ${sourceId} (아직 기록에 없는 사진)` : '원본: 이 메시지에 첨부한 사진',
    `날짜: ${metadata.date}`,
    `장소: ${metadata.place || '(비어 있음)'}`,
    `메모: ${metadata.caption || ''}`,
    `올리는 사람: ${uploader}`,
    '',
    '편집 요청:',
    editPrompt,
  ].join('\n');
}

function claudeLink(request: string) {
  const params = new URLSearchParams({ q: request, repo: CLAUDE_REPO, branch: CLAUDE_BRANCH, environment: CLAUDE_ENVIRONMENT });
  return `https://claude.ai/code/new?${params.toString()}`;
}

// Always re-encoded the right way up (selfies carry EXIF rotation), as a JPEG under 5 MB.
async function prepareImageFile(file: File, date: string) {
  const canvas = await photoToCanvas(file, 1800);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.84);
  if (blob.size > IMAGE_LIMIT) throw new Error('사진이 5MB를 넘어요. 해상도를 낮춰 다시 골라 주세요.');
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'travel';
  return new File([blob], `our-taiwan-${safeDate}-edit.jpg`, { type: 'image/jpeg' });
}

export default function HiggsfieldHandoff({ photo, sourceFile, sourceDate = '', sourcePlace = '', sourceCaption = '', viewerLabel, onAddEdited }: Props) {
  const metadata = useMemo(() => ({ date: photo?.date ?? sourceDate, place: photo?.place ?? sourcePlace, caption: photo?.caption ?? sourceCaption }), [photo?.date, photo?.place, photo?.caption, sourceDate, sourcePlace, sourceCaption]);
  const [template, setTemplate] = useState<Template>('postcard');
  const [prompt, setPrompt] = useState(() => makePrompt(metadata, 'postcard'));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(Boolean(sourceFile));
  const [staging, setStaging] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const promptId = useId();
  const titleId = useId();
  const uploader = viewerLabel || photo?.uploader || '여행자 A';
  const claudeRequest = useMemo(() => makeClaudeRequest(prompt, metadata, uploader, photo?.id, sourceId ?? undefined), [prompt, metadata, uploader, photo?.id, sourceId]);

  useEffect(() => {
    setTemplate('postcard'); setPrompt(makePrompt(metadata, 'postcard')); setError(''); setStatus('');
  }, [metadata]);
  // Only a photo that is not in the app yet has to be attached in Claude, so only that one is prepared for saving.
  useEffect(() => {
    setSourceId(null);
    if (!sourceFile) { setPhotoFile(null); setPreparing(false); return; }
    let cancelled = false;
    setPreparing(true);
    void prepareImageFile(sourceFile, metadata.date)
      .then((file) => { if (!cancelled) setPhotoFile(file); })
      .catch((cause) => { if (!cancelled) { setPhotoFile(null); setError(cause instanceof Error ? cause.message : '사진을 준비하지 못했어요.'); } })
      .finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; };
  }, [sourceFile, metadata.date]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // A photo that is not in the diary yet is staged privately so the cloud session can fetch it.
  async function stageSource() {
    if (!photoFile) { setError('사진을 준비하지 못했어요. 사진을 다시 선택해 주세요.'); return; }
    setStaging(true); setStatus(''); setError('');
    try {
      const form = new FormData();
      form.append('media', photoFile);
      const response = await fetch('/api/edit-sources', { method: 'POST', body: form, credentials: 'same-origin' });
      const body = await response.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!response.ok || !body?.id) throw new Error(body?.error || '편집할 사진을 올리지 못했어요. 다시 시도해 주세요.');
      setSourceId(body.id);
      setStatus('사진을 올렸어요. 이제 Claude로 보내기를 눌러 주세요.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '편집할 사진을 올리지 못했어요.');
    } finally { setStaging(false); }
  }

  async function copyRequest() {
    setError('');
    try {
      await navigator.clipboard.writeText(claudeRequest);
      setStatus('Claude 요청문을 복사했어요. 입력칸이 비어 있으면 붙여 넣어 주세요.');
    } catch {
      promptRef.current?.focus(); promptRef.current?.select();
      setStatus('복사하지 못했어요. 아래 편집 요청을 길게 눌러 복사해 주세요.');
    }
  }

  function openedClaude() {
    // Backup in case the app opens without the pre-filled text.
    void navigator.clipboard?.writeText(claudeRequest).catch(() => undefined);
    setStatus('Claude에서 보내기만 누르면 돼요. 완성되면 앱을 새로고침해 주세요.');
  }

  return <section ref={panelRef} className="higgsfield-handoff" aria-labelledby={titleId}>
    <div className="handoff-title"><span>PHOTO STUDIO</span><h3 id={titleId}>사진에 여행 이야기를 더해요</h3></div>
    <p>Claude가 힉스필드로 사진을 편집하고, 완성본을 이 날짜의 기록에 바로 추가해요. 원본 기록은 그대로 남아요.</p>
    <ol className="handoff-steps">
      <li><strong>스타일 고르기</strong><span>아래에서 스타일을 고르고, 필요하면 편집 요청을 고쳐요.</span></li>
      <li><strong>Claude로 보내기</strong><span>{photo ? 'Claude가 열리면 요청문이 채워져 있어요. 사진은 Claude가 기록에서 직접 가져오니 보내기만 누르면 돼요.' : '먼저 사진을 비공개로 올린 뒤 Claude로 보내요. Claude가 그 사진을 직접 가져가고, 원본은 기록에 추가되지 않아요.'}</span></li>
      <li><strong>완성되면 새로고침</strong><span>보통 몇 분 걸려요. Claude에 결과가 나오면 앱을 새로고침해 기록을 확인해요.</span></li>
    </ol>
    <div className="handoff-template" aria-label="사진 편집 스타일">{(Object.keys(templateLabels) as Template[]).map((value) => <button type="button" key={value} aria-pressed={template === value} onClick={() => { setTemplate(value); setPrompt(makePrompt(metadata, value)); setStatus(''); }}>{templateLabels[value]}</button>)}</div>
    <p className="handoff-template-description" aria-live="polite">{templateDescriptions[template]}</p>
    <label htmlFor={promptId}>편집 요청</label>
    <textarea id={promptId} ref={promptRef} rows={8} maxLength={2400} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
    <div className="handoff-share">
      {photo || sourceId
        ? <a className="handoff-share-primary" href={claudeLink(claudeRequest)} target="_blank" rel="noreferrer" onClick={openedClaude}>Claude로 보내기 ↗</a>
        : <button type="button" className="handoff-share-primary" disabled={preparing || staging || !photoFile} onClick={() => void stageSource()}>{preparing ? '사진 준비 중…' : staging ? '사진 올리는 중…' : '1. 사진 올리기 (Claude가 가져갈 수 있게)'}</button>}
      <p>환경 <strong>{CLAUDE_ENVIRONMENT}</strong>와 저장소가 자동으로 선택돼요. 다른 환경이 보이면 바꾼 뒤 보내 주세요. 한 장에 힉스필드 약 1크레딧이 들어요.</p>
    </div>
    <div className="handoff-actions">
      <button type="button" onClick={() => void copyRequest()}>Claude 요청문 복사</button>
    </div>
    <details className="handoff-fallback"><summary>다른 곳에서 편집한 사진이 있나요?</summary>
      <p className="handoff-footnote">힉스필드 웹이나 다른 앱에서 직접 편집했다면, 저장한 편집본을 골라 이 날짜의 기록에 추가할 수 있어요.</p>
      <button type="button" className="handoff-return" onClick={() => inputRef.current?.click()}>편집본 선택해 기록에 추가</button>
      <input ref={inputRef} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-label="편집한 이미지 선택" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAddEdited(file); }} />
    </details>
    <p className="handoff-footnote">사진은 Claude와 힉스필드로 보내져 처리돼요. 힉스필드 약관상 올린 사진과 결과가 모델 학습에 쓰일 수 있어요.</p>
    {status && <p className="handoff-status" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}
