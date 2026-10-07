'use client';
// 갤러리 단일형 전체화면 뷰어 — 그누보드 gallery.php 라이트박스 방식을 그대로 옮겼다.
//  · 사진 1장: 그림만 크게 · 좌우 화살표 = 이전/다음 글 (라벨 없음) · 하단에 제목·태그·날짜
//  · 사진 여러 장: 좌상단 "1 / N · 전체 보기", 하단 썸네일 스트립,
//      좌우 화살표 = 사진 넘김, 화살표 밑 "이전 글 / 다음 글" 버튼을 눌러야 실제 글 이동
//  · 그림을 누르면 하단 상세정보(썸네일·제목·날짜)가 사라지고 이미지만 보인다 (다시 누르면 복귀)
//  · 키보드: ← → (여러 장이면 사진, 1장이면 글) · ↑ ↓ (여러 장일 때 글) · Esc 닫기(전체 보기 중이면 그것부터)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlobUrl } from '@/lib/blobStore';
import type { BackupPost } from '@/lib/galleryStore';

/** 파일 id / URL / 이번 세션 blob: 주소 모두 처리 (Lightbox와 같은 규칙) */
function useImgUrl(raw?: string): string | undefined {
  const live = !!raw && raw.startsWith('blob:');
  const loaded = useBlobUrl(live ? undefined : raw);
  return live ? raw : loaded;
}

function Pic({ src, className }: { src: string; className?: string }) {
  const u = useImgUrl(src);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" className={className} draggable={false} /> : <span className={className} />;
}

const ymd = (p: BackupPost) => {
  const d = new Date(p.madeDate ? p.madeDate + 'T00:00:00' : p.date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

export function GalleryViewer({ posts, postId, startIndex = 0, onClose, onChangePost, detailHref, onOpenDetail }: {
  posts: BackupPost[];                 // 넘겨 볼 글 목록 (목록과 같은 순서 · 이미지가 있는 글만)
  postId: string;                      // 지금 보는 글
  startIndex?: number;                 // 처음 열 때 보여 줄 사진 순번 (상세 페이지에서 보던 사진)
  onClose: () => void;
  onChangePost: (id: string) => void;  // 이전/다음 글로 이동
  detailHref?: (p: BackupPost) => string;
  onOpenDetail?: (p: BackupPost) => void;
}) {
  const pi = Math.max(0, posts.findIndex(x => x.id === postId));
  const p = posts[pi];
  const first = useRef({ id: postId, idx: startIndex });
  const [i, setI] = useState(startIndex);
  const [grid, setGrid] = useState(false);
  const [bare, setBare] = useState(false);   // 그림을 누르면 하단 상세정보를 숨기고 이미지만 본다 (다시 누르면 복귀)
  const many = posts.length > 1;
  const n = p?.images.length ?? 0;

  // 글이 바뀌면 첫 사진 · 전체 보기 해제
  useEffect(() => { setI(postId === first.current.id ? first.current.idx : 0); setGrid(false); }, [postId]);

  const go = useCallback((d: number) => {
    if (posts.length < 2) return;
    onChangePost(posts[(pi + d + posts.length) % posts.length].id);
  }, [posts, pi, onChangePost]);
  const step = useCallback((d: number) => { if (n > 1) setI(x => (x + d + n) % n); }, [n]);
  const multi = n > 1;
  // 화살표: 여러 장이면 사진 넘김, 1장이면 글 이동
  const arrow = useCallback((d: number) => { if (multi) step(d); else go(d); }, [multi, step, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (grid) setGrid(false); else onClose(); }
      else if (e.key === 'ArrowLeft') arrow(-1);
      else if (e.key === 'ArrowRight') arrow(1);
      else if (e.key === 'ArrowUp' && multi) go(-1);
      else if (e.key === 'ArrowDown' && multi) go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grid, arrow, go, multi, onClose]);

  // 뷰어가 떠 있는 동안 뒤 페이지 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!p || typeof document === 'undefined') return null;
  const cur = Math.min(i, n - 1);

  return createPortal(
    <div className="gv" role="dialog" aria-modal="true" aria-label={p.title} onClick={onClose}>
      {/* 큰 그림 — 화면 가득. 여러 장이면 그림을 누르면 상세정보 숨김/표시 */}
      {!grid && (
        <div className="gv-stage" onClick={e => { e.stopPropagation(); setBare(b => !b); }}
          style={{ cursor: 'pointer' }}>
          <Pic key={p.id + ':' + cur} src={p.images[cur]} className="gv-img" />
        </div>
      )}

      {/* 전체 보기 — 첨부한 사진 전부를 격자로 */}
      {grid && (
        <div className="gv-grid" onClick={e => { e.stopPropagation(); setGrid(false); }}>
          <div className="gv-grid-in" onClick={e => e.stopPropagation()}>
            {p.images.map((src, k) => (
              <button key={k} type="button" className={k === cur ? 'on' : ''}
                onClick={() => { setI(k); setGrid(false); }}>
                <Pic src={src} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 좌상단: 순번 + 전체 보기 */}
      {multi && (
      <div className="gv-top" onClick={e => e.stopPropagation()}>
        <span className="gv-count">{cur + 1} / {n}</span>
        {(
          <button type="button" className="gv-all" onClick={() => setGrid(g => !g)}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
              <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
            </svg>
            {grid ? '돌아가기' : '전체 보기'}
          </button>
        )}
      </div>
      )}

      {/* 우상단 닫기 */}
      <button type="button" className="gv-x" aria-label="닫기" onClick={e => { e.stopPropagation(); onClose(); }}>✕</button>

      {/* 좌우 화살표 — 여러 장: 사진 넘김 + 밑의 '이전 글/다음 글' 버튼으로 글 이동 · 1장: 화살표가 곧 글 이동 */}
      {(multi || posts.length > 1) && !grid && (
        <>
          <div className="gv-nv l" onClick={e => e.stopPropagation()}>
            <button type="button" aria-label={multi ? '이전 사진' : '이전 글'} onClick={() => arrow(-1)}>❮</button>
            {multi && posts.length > 1 && <button type="button" className="gv-pill" onClick={() => go(-1)}>이전 글</button>}
          </div>
          <div className="gv-nv r" onClick={e => e.stopPropagation()}>
            <button type="button" aria-label={multi ? '다음 사진' : '다음 글'} onClick={() => arrow(1)}>❯</button>
            {multi && posts.length > 1 && <button type="button" className="gv-pill" onClick={() => go(1)}>다음 글</button>}
          </div>
        </>
      )}

      {/* 하단: 썸네일 스트립 + 제목 · 말머리 · 날짜 */}
      <div className={'gv-bottom' + (bare && !grid ? ' off' : '')} onClick={e => e.stopPropagation()}>
        {n > 1 && !grid && (
          <div className="gv-thumbs">
            {p.images.map((src, k) => (
              <button key={k} type="button" className={k === cur ? 'on' : ''} aria-label={`${k + 1}번째 사진`}
                onClick={() => setI(k)}>
                <Pic src={src} />
              </button>
            ))}
          </div>
        )}
        <div className="gv-cap">
          <b>{p.title}</b>
          {p.category && <i>{p.category}</i>}
        </div>
        {(p.tags ?? []).length > 0 && (
          <div className="gv-tags">{(p.tags ?? []).map(t => <span key={t}>#{t}</span>)}</div>
        )}
        <div className="gv-date">
          {ymd(p)}
          {(detailHref || onOpenDetail) && (
            <a href={detailHref ? detailHref(p) : '#'}
              onClick={e => { if (onOpenDetail) { e.preventDefault(); onOpenDetail(p); } }}>상세 보기 ›</a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
