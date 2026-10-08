'use client';
// 갤러리 사진 묶음 편집 — 캐릭터 편집(CharEditForm)과 자관 갤러리 페이지가 같이 쓴다.
// 갤러리 게시판 글쓰기(BackupForm)와 같은 방식: 묶음 목록 → 묶음 편집(제목·유형·이미지·설명·태그·제작일·공개범위·접기)
import React, { useState } from 'react';
import { GalleryImg, GalleryPost } from '@/lib/charStore';
import { newId, FoldType } from '@/lib/postStore';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { KInput, KSelect, KCheck, KRadio, KDate } from '@/components/ui/Kit';
import { RichEditor } from '@/components/ui/RichEditor';
import { CropEditor, CropValue } from '@/components/ui/CropEditor';
import { DragList } from '@/components/ui/DragList';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/** 갤러리 사진 첨부 — 갤러리 게시판 글쓰기(BackupForm)와 같은 방식 (v3.3 사용자 요청):
 *  끌어다 놓기/클릭 업로드 영역 · 여러 장 · ⠿ 드래그 순서 · 원본/최적화 · ✂ 썸네일(4:3) · ✕ 제거(확인).
 *  이 화면은 선택 즉시 IndexedDB에 저장하고(putBlob), 프로필 [SAVE] 때 목록만 함께 저장된다.
 *  작가 표기(artist)는 사진마다 입력 — 카드 제목과 뷰어 하단에 표시된다 */
function GalleryCropModal({ g, onClose, onApply }: { g: GalleryImg; onClose: () => void; onApply: (c: CropValue) => void }) {
  const src = useBlobUrl(g.ref);
  if (!src) return null;
  return <CropEditor open src={src} aspect="4:3" initial={g.crop} onClose={onClose} onApply={onApply} />;
}

function GalleryRowPreview({ fileRef }: { fileRef: string }) {
  const src = useBlobUrl(fileRef);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" />;
}

function GalleryArtEditor({ images, onChange }: { images: GalleryImg[]; onChange: (images: GalleryImg[]) => void }) {
  const [cropFor, setCropFor] = useState<number | null>(null);
  const del = useConfirmDelete();
  const toast = useToast();
  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const refs = await Promise.all(Array.from(list).map(f => putBlob(f)));
    onChange([...images, ...refs.map(ref => ({ ref, original: true }))]);
  };
  return (
    <div>
      <div className="upzone" onClick={() => document.getElementById('galleryArtsF')?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); add(e.dataTransfer.files); }}>
        <b style={{ display: 'block', marginBottom: 3 }}>
          {images.length === 0 ? '이미지를 끌어다 놓거나 클릭해서 선택' : '＋ ADD IMAGE'}
        </b>
        여러 장 선택 가능 · ⠿ 드래그로 순서 조정
      </div>
      <input id="galleryArtsF" type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { add(e.target.files); e.target.value = ''; }} />
      {images.length > 0 && <div className="upfile-count">✓ {images.length}장 — 아래 순서대로 게시됩니다</div>}
      {images.length > 0 && (
        <DragList items={images.map((g, i) => ({ ...g, _k: i }))} keyOf={a => a.ref + a._k}
          onReorder={list => onChange(list.map(({ _k, ...g }) => g))}
          render={(a, i) => (
            <div className="upfile-row" style={{ width: '100%' }}>
              <span className="drag-h">⠿</span>
              <span className="mw-no">{i + 1}</span>
              <div className="pv"><GalleryRowPreview fileRef={a.ref} /></div>
              <div className="nm">
                <b>이미지 {i + 1}</b>
                <small>저장된 이미지{a.crop ? ' · 썸네일 지정됨' : ''}</small>
                <KInput placeholder="작가 표기 (선택)" value={a.artist ?? ''}
                  style={{ fontSize: 12, padding: '5px 9px', marginTop: 4 }}
                  onChange={e => onChange(images.map((g, idx) => (idx === i ? { ...g, artist: e.target.value } : g)))} />
              </div>
              <div className="mini-seg">
                <button className={a.original !== false ? 'on' : ''}
                  onClick={() => onChange(images.map((g, idx) => (idx === i ? { ...g, original: true } : g)))}>원본</button>
                <button className={a.original === false ? 'on' : ''}
                  onClick={() => onChange(images.map((g, idx) => (idx === i ? { ...g, original: false } : g)))}>최적화</button>
              </div>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 10, whiteSpace: 'nowrap' }}
                onClick={() => setCropFor(i)}>✂ 썸네일</button>
              <span className="fx" data-tip="제거"
                onClick={() => del.ask('이 이미지를 목록에서 빼시겠습니까?',
                  () => onChange(images.filter((_, idx) => idx !== i)), `이미지 ${i + 1}`)}>✕</span>
            </div>
          )} />
      )}
      {del.element}
      {cropFor != null && images[cropFor] != null && (
        <GalleryCropModal g={images[cropFor]} onClose={() => setCropFor(null)}
          onApply={c => {
            onChange(images.map((g, idx) => (idx === cropFor ? { ...g, crop: c } : g)));
            setCropFor(null);
            toast('썸네일 영역이 저장되었습니다 (원본 유지)');
          }} />
      )}
    </div>
  );
}

export function GalleryEditView({ posts, onChange, onDelete, onBack, backLabel = '‹ 돌아가기' }: {
  posts: GalleryPost[];
  onChange: (posts: GalleryPost[]) => void;
  onDelete?: () => void;     // 없으면 「갤러리 삭제」 버튼을 두지 않는다 (자관 갤러리는 설정에서 끄는 방식)
  onBack: () => void;
  backLabel?: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const del = useConfirmDelete();
  const patch = (id: string, p: Partial<GalleryPost>) => onChange(posts.map(x => (x.id === id ? { ...x, ...p } : x)));
  const cur = posts.find(x => x.id === editId);
  const TYPE_LABEL = { log: '로그', single: '단일', vlist: '단일(세로)' } as const;
  const VIS_LABEL = { public: '전체공개', member: '멤버공개', private: '나만보기' } as const;

  /* ---------- 묶음 하나 편집 — 갤러리 게시판 글쓰기와 같은 항목 ---------- */
  if (cur) {
    const tagsText = (cur.tags ?? []).join(', ');
    const foldType: FoldType | 'none' = cur.fold?.type ?? 'none';
    return (
      <div>
        <div className="write-grid">
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <button className="btn btn-ghost" onClick={() => setEditId(null)}>‹ 묶음 목록</button>
              <b style={{ fontSize: 14 }}>사진 묶음 편집</b>
              <span className="hint" style={{ margin: 0 }}>프로필 [SAVE] 시 함께 저장됩니다</span>
            </div>
            <div className="form-row">
              <label className="k-label" style={{ width: 60 }}>제목</label>
              <KInput value={cur.title} onChange={e => patch(cur.id, { title: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="form-row">
              <label className="k-label" style={{ width: 60 }}>유형</label>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <KRadio name="gtype" value="log" current={cur.type} onChange={v => patch(cur.id, { type: v as GalleryPost['type'] })}
                  label={<span>로그 <span className="rd-desc">— 웹툰처럼 세로 스크롤</span></span>} />
                <KRadio name="gtype" value="single" current={cur.type} onChange={v => patch(cur.id, { type: v as GalleryPost['type'] })}
                  label={<span>단일 <span className="rd-desc">— 큰 이미지 + 좌우 넘김</span></span>} />
                <KRadio name="gtype" value="vlist" current={cur.type} onChange={v => patch(cur.id, { type: v as GalleryPost['type'] })}
                  label={<span>단일(세로) <span className="rd-desc">— 이미지 사이 갭을 두고 세로로 나열</span></span>} />
              </div>
            </div>
            <label className="k-label">이미지</label>
            <GalleryArtEditor images={cur.images} onChange={images => patch(cur.id, { images })} />
            <div style={{ marginTop: 14 }}>
              <label className="k-label">설명</label>
              <RichEditor value={cur.desc} onChange={desc => patch(cur.id, { desc })} placeholder="작품 설명을 작성하세요 (선택)" />
            </div>
          </div>

          <div>
            <div className="panel widget" style={{ marginBottom: 14 }}>
              <h4>설정</h4>
              <div className="form-row">
                <label className="k-label" style={{ width: 70 }}>태그</label>
                <KInput value={tagsText} placeholder="쉼표로 구분" style={{ flex: 1 }}
                  onChange={e => patch(cur.id, { tags: [...new Set(e.target.value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean))] })} />
              </div>
              <div className="form-row">
                <label className="k-label" style={{ width: 70 }}>제작일 (선택)</label>
                <KDate value={cur.madeDate ?? ''} onChange={v => patch(cur.id, { madeDate: v || undefined })} style={{ fontSize: 12, flex: 1 }} />
              </div>
              <div className="form-row">
                <label className="k-label" style={{ width: 70 }}>공개범위</label>
                <KSelect minWidth={120} value={cur.visibility} onChange={v => patch(cur.id, { visibility: v as GalleryPost['visibility'] })}
                  options={[
                    { value: 'public', label: '전체공개' },
                    { value: 'member', label: '멤버공개' },
                    { value: 'private', label: '나만보기' },
                  ]} />
              </div>
            </div>
            <div className="panel widget" style={{ marginBottom: 14 }}>
              <h4>접기</h4>
              <div style={{ display: 'grid', gap: 9 }}>
                {(['spoiler', 'adult', 'custom'] as const).map(t => (
                  <KCheck key={t} label={t === 'spoiler' ? '스포일러 접기' : t === 'adult' ? '수위 주의 접기' : '직접 입력 문구'}
                    checked={foldType === t}
                    onChange={v => patch(cur.id, { fold: v ? { type: t, label: t === 'custom' ? cur.fold?.label : undefined } : null })} />
                ))}
                {foldType === 'custom' && (
                  <KInput placeholder="접기 문구" value={cur.fold?.label ?? ''}
                    onChange={e => patch(cur.id, { fold: { type: 'custom', label: e.target.value } })} />
                )}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-accent" onClick={() => setEditId(null)}>완료 — 묶음 목록으로</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 묶음 목록 ---------- */
  return (
    <div className="panel" style={{ padding: 24, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={onBack}>{backLabel}</button>
        <b style={{ fontSize: 14 }}>갤러리 편집</b>
        <span className="hint" style={{ margin: 0 }}>이 화면의 내용은 프로필 [SAVE] 시 함께 저장됩니다</span>
        {onDelete && <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={onDelete}>갤러리 삭제</button>}
      </div>
      <label className="k-label" style={{ margin: 0 }}>
        사진 묶음 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— ⠿ 순서 변경 · 상세 화면 GALLERY 버튼으로 이동하는 화면에 갤러리 게시판과 같은 카드로 보여줍니다</span>
      </label>
      {posts.length === 0 && <p className="hint" style={{ margin: 0 }}>아직 묶음이 없습니다 — 아래 [＋ 새 묶음]으로 추가하세요</p>}
      {posts.length > 0 && (
        <DragList items={posts} keyOf={x => x.id} onReorder={onChange}
          render={x => (
            <div className="upfile-row" style={{ width: '100%' }}>
              <span className="drag-h">⠿</span>
              <div className="pv">{x.images[0] && <GalleryRowPreview fileRef={x.images[0].ref} />}</div>
              <div className="nm">
                <b>{x.title || '(제목 없음)'}</b>
                <small>{TYPE_LABEL[x.type]} · 사진 {x.images.length}장 · {VIS_LABEL[x.visibility]}{x.fold ? ' · 접힘' : ''}</small>
              </div>
              <button className="btn btn-dark" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setEditId(x.id)}>편집 ›</button>
              <span className="fx" data-tip="삭제"
                onClick={() => del.ask('이 사진 묶음을 삭제하시겠습니까?', () => onChange(posts.filter(p => p.id !== x.id)), x.title || '(제목 없음)')}>✕</span>
            </div>
          )} />
      )}
      <button className="btn btn-ghost" style={{ justifySelf: 'start', padding: '6px 14px', fontSize: 11 }}
        onClick={() => {
          const id = newId();
          onChange([{ id, title: '', type: 'log', images: [], desc: '', date: new Date().toISOString(), visibility: 'public', fold: null }, ...posts]);
          setEditId(id);
        }}>＋ 새 묶음</button>
      <button className="btn btn-dark" style={{ justifySelf: 'end' }} onClick={onBack}>완료 — 목록으로</button>
      {del.element}
    </div>
  );
}

