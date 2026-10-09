'use client';
// 캐릭터 상세(스테이지 레이아웃)에서 우측 항목(노래·갤러리·관계·TRPG·추가 탭)을 누르면 뜨는 창 (v7.0).
// 오른쪽에서 옆으로 펼쳐지듯(슬라이드) 열리고, 닫을 때는 반대로 접힌다.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function StageWindow({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 320);      // 접히는 모션(.32s)이 끝난 뒤 실제로 닫는다
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`sw-back${closing ? ' out' : ''}`} onClick={close}>
      <div className="sw-box" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sw-head">
          <b>{title}</b>
          <button type="button" className="sw-x" aria-label="닫기" onClick={close}>✕</button>
        </div>
        <div className="sw-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
