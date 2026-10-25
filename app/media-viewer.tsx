'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PhotoEntry } from './collaboration';
import HiggsfieldHandoff from './higgsfield-handoff';

type MediaViewerProps = { photo: PhotoEntry; onClose: () => void; onEdit?: () => void; startWithHandoff?: boolean; onAddEdited: (file: File) => void };

export default function MediaViewer({ photo, onClose, onEdit, startWithHandoff = false, onAddEdited }: MediaViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [zoomed, setZoomed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(startWithHandoff);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(photo.uploadedAt));

  return <dialog
    ref={dialogRef}
    className="private-media-viewer"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className="media-viewer-shell">
      <header className="media-viewer-heading">
        <div><span>우리의 여행 기록</span><h2 id={titleId}>{photo.place || '대만에서 남긴 순간'}</h2></div>
        <button ref={closeRef} className="media-viewer-close" type="button" aria-label="사진 크게 보기 닫기" onClick={onClose}>×</button>
      </header>
      <div className={'media-viewer-canvas' + (zoomed ? ' is-zoomed' : '')}>
        {imageFailed ? <p role="alert">사진을 불러오지 못했어요. 로그인을 확인한 뒤 다시 열어 주세요.</p> : <img
          src={photo.imageUrl}
          alt={`${photo.place || '대만 여행'} ${photo.caption}`.trim()}
          onError={() => setImageFailed(true)}
        />}
      </div>
      <div className="media-viewer-details">
        {photo.caption && <p>{photo.caption}</p>}
        <small id={descriptionId}>{photo.uploader} · {time} (대만 시각)</small>
        <div className="media-viewer-actions">
          <button type="button" aria-pressed={zoomed} disabled={imageFailed} onClick={() => setZoomed(!zoomed)}>{zoomed ? '화면에 맞추기' : '저장 크기로 확대'}</button>
          <button type="button" className="media-viewer-edit" aria-expanded={onEdit ? undefined : handoffOpen} onClick={() => onEdit ? onEdit() : setHandoffOpen(!handoffOpen)}>힉스필드에서 편집하기 ↗</button>
        </div>
        <p className="media-viewer-hint">두 손가락으로 확대할 수 있어요. 사진은 허용된 두 계정만 볼 수 있습니다.</p>
        {handoffOpen && <HiggsfieldHandoff photo={photo} onAddEdited={onAddEdited} />}
      </div>
    </div>
  </dialog>;
}
