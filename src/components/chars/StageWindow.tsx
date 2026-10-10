'use client';
// 캐릭터 상세(스테이지 레이아웃)에서 우측 항목(갤러리·관계·TRPG)을 누르면 뜨는 창 (v7.0 → v7.6 서랍형).
// 화면 오른쪽에 높이 전체로 펼쳐지는 서랍: 왼쪽 목록(ARCHIVE FILE · 캐릭터 이름 · 번호 붙은 항목)에서
// 다른 항목으로 바로 오갈 수 있고, 위쪽에 현재 항목 제목·CLOSE, 아래쪽에 PREV / NEXT.
// 오른쪽에서 옆으로 펼쳐지듯 열리고, 닫을 때는 반대로 접힌다.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type StageWindowItem = { key: string; title: string; sub: string };

export function StageWindow({ title, name, items, current, onSelect, onClose, children }: {
  title: string; name: string; items: StageWindowItem[]; current: string;
  onSelect: (key: string) => void; onClose: () => void; children: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 320);      // 접히는 모션(.32s)이 끝난 뒤 실제로 닫는다
  }, [onClose]);

  const idx = Math.max(0, items.findIndex(i => i.key === current));
  const cur = items[idx];
  const prev = items.length > 1 ? items[(idx - 1 + items.length) % items.length] : null;
  const next = items.length > 1 ? items[(idx + 1) % items.length] : null;
  const pad = (n: number) => String(n).padStart(2, '0');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && prev) onSelect(prev.key);
      else if (e.key === 'ArrowRight' && next) onSelect(next.key);
    };
    window.addEventListener('keydown', onKey);
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOv; };
  }, [close, prev, next, onSelect]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`sw-back${closing ? ' out' : ''}`} onClick={close}>
      <div className="sw-box" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <nav className="sw-nav">
          <div className="sw-nav-head">
            <small>ARCHIVE FILE</small>
            <b>{name}</b>
          </div>
          <div className="sw-nav-list">
            {items.map((it, i) => (
              <button key={it.key} type="button" className={it.key === current ? 'on' : ''} onClick={() => onSelect(it.key)}>
                <i>{pad(i + 1)}</i>
                <span><b>{it.title}</b><small>{it.sub}</small></span>
              </button>
            ))}
          </div>
          <div className="sw-nav-foot">ARCHIVE SYS.</div>
        </nav>
        <section className="sw-main">
          <header className="sw-head">
            <div className="sw-head-t"><small>SEC.{pad(idx + 1)}</small><b>{cur?.title ?? title}<em>{cur?.sub}</em></b></div>
            <button type="button" className="sw-x" aria-label="닫기" onClick={close}><span>✕</span> CLOSE</button>
          </header>
          <div className="sw-body">{children}</div>
          <footer className="sw-foot">
            <span className="sw-foot-t">{name.toUpperCase()} // SEC.{pad(idx + 1)} / {pad(items.length)}</span>
            {prev && <button type="button" onClick={() => onSelect(prev.key)}><small>PREV</small><b>{prev.title}</b></button>}
            {next && <button type="button" className="n" onClick={() => onSelect(next.key)}><small>NEXT</small><b>{next.title}</b></button>}
          </footer>
        </section>
      </div>
    </div>,
    document.body,
  );
}
