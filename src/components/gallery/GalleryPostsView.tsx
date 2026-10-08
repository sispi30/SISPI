'use client';
// 갤러리 사진 묶음 보기 — 캐릭터 상세 GALLERY 탭과 자관 갤러리 페이지가 같이 쓴다.
// 갤러리 게시판과 같은 카드(.g3) · 단일 유형은 전체화면 뷰어 · 로그/단일(세로)는 패널 안 상세
import React, { useState } from 'react';
import { GalleryPost } from '@/lib/charStore';
import type { BackupPost } from '@/lib/galleryStore';
import { useBlobUrl } from '@/lib/blobStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { GalleryViewer } from '@/components/gallery/GalleryViewer';

/** 갤러리 탭 내용 — TRPG 탭과 같은 방식으로 우측 패널만 교체해 보여준다 (v3.1).
 *  좌측 아이콘 탭·아트·상단 버튼은 그대로 PROFILE 화면과 같은 자리에 있다 */
export function GalleryPanel({ posts, ph, canSeePrivate, loggedIn }: {
  posts: GalleryPost[]; ph: string; canSeePrivate: boolean; loggedIn: boolean;
}) {
  const [viewId, setViewId] = useState<string | null>(null);     // 단일 유형 — 전체화면 뷰어
  const [openId, setOpenId] = useState<string | null>(null);     // 로그/단일(세로) 유형 — 패널 안 상세
  const [unveiled, setUnveiled] = useState<Record<string, boolean>>({});

  // 공개범위 — 전체공개 / 멤버공개(로그인) / 나만보기(관리자·편집 권한자)
  const shown = posts.filter(p => p.visibility === 'public' || (p.visibility === 'member' && loggedIn) || canSeePrivate);
  if (shown.length === 0) {
    return <p className="hint">아직 등록된 사진이 없습니다</p>;
  }
  const opened = shown.find(p => p.id === openId);
  const dateOf = (p: GalleryPost) => {
    const d = new Date(p.madeDate ? p.madeDate + 'T00:00:00' : p.date);
    return isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const foldLabel = (p: GalleryPost) =>
    p.fold ? (p.fold.type === 'custom' ? (p.fold.label || '접힘') : p.fold.type === 'adult' ? '수위 주의' : '스포일러') : '';

  // 뷰어에서 이전/다음 글로 넘길 수 있는 묶음 — 같은 방식(단일 유형), 접힘이 풀린 것만
  const viewable: BackupPost[] = shown
    .filter(p => p.type === 'single' && p.images.length > 0 && (!p.fold || unveiled[p.id]))
    .map(p => ({
      id: p.id, title: p.title, type: 'single', images: p.images.map(g => g.ref), phList: [],
      desc: p.desc, category: '', tags: p.tags, madeDate: p.madeDate, date: p.date,
      author: '', authorId: '', visibility: 'public', fold: null,
    }));

  // 로그/단일(세로) 상세 — 패널 안에서 사진을 세로로 나열 (로그는 이어 붙이고, 세로는 갭을 둔다)
  if (opened) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setOpenId(null)}>‹ 목록</button>
        <h3 className="tab-tt" style={{ marginTop: 12 }}>{opened.title}</h3>
        <div className="sub">
          {dateOf(opened)}{(opened.tags ?? []).map(t => <i key={t} className="tag-in">#{t}</i>)}
        </div>
        {opened.desc && <div className="prose" style={{ marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(opened.desc) }} />}
        <div style={{ display: 'grid', gap: opened.type === 'vlist' ? 14 : 0 }}>
          {opened.images.map((g, i) => <StackImg key={g.ref + i} fileRef={g.ref} />)}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 홈페이지 갤러리 게시판(/gallery)과 같은 카드 — 4:3 썸네일 + 제목 + 'N장 · 날짜', 3열 */}
      <div className="g3">
        {shown.map(p => {
          const folded = !!p.fold && !unveiled[p.id];
          return (
            <div key={p.id} className="panel g-item"
              onClick={() => {
                if (folded) return;
                if (p.type === 'single' && p.images.length > 0) setViewId(p.id);
                else setOpenId(p.id);
              }}>
              <div className={`thumb ${folded ? 'veil' : ''}`}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {p.images[0] && <CroppedBlobImg fileRef={p.images[0].ref} crop={p.images[0].crop} ph={ph} />}
                </div>
                {folded && (
                  <div className="cover" onClick={e => { e.stopPropagation(); setUnveiled(u => ({ ...u, [p.id]: true })); }}>
                    <div><b>{foldLabel(p)}</b><br /><span>클릭하여 표시</span></div>
                  </div>
                )}
              </div>
              <div className="info">
                <b>{p.title}</b>
                <small>
                  {p.images.length}장{dateOf(p) ? ` · ${dateOf(p)}` : ''}
                  {p.visibility !== 'public' && <> · {p.visibility === 'member' ? '멤버공개' : '나만보기'}</>}
                  {(p.tags ?? []).map(t => <i key={t} className="tag-in">#{t}</i>)}
                </small>
              </div>
            </div>
          );
        })}
      </div>
      {/* 갤러리 게시판 '단일' 글과 같은 전체화면 뷰어 */}
      {viewId && viewable.some(v => v.id === viewId) && (
        <GalleryViewer posts={viewable} postId={viewId}
          onClose={() => setViewId(null)} onChangePost={setViewId} />
      )}
    </>
  );
}

function StackImg({ fileRef }: { fileRef: string }) {
  const url = useBlobUrl(fileRef);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />;
}

