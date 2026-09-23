'use client';
// 마이룸 방 편집/보기 (v1.2) — 고정 캔버스/흰 배경 없이 화면 전체를 편집 영역으로 쓴다.
// 편집 버튼 4개 + 화면비율 확대/축소는 화면 우측 상단에 고정된 바 하나로 모았다 (스크롤/캔버스
// 크기와 무관하게 항상 같은 자리에 떠 있음).
import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { useSectionParam, secQuery } from '@/lib/sectionStore';
import {
  MyRoomPost, MyRoomItem, MYROOM_SEED,
  MyRoomCategory, MYROOM_CATEGORY_SEED, MyRoomCatalogItem, MYROOM_CATALOG_SEED,
  newMyRoomItemId,
} from '@/lib/myroomStore';
import { RoomCanvas } from '@/components/myroom/RoomCanvas';
import { CatalogPanel } from '@/components/myroom/CatalogPanel';
import { getBlob } from '@/lib/blobStore';
import { KInput } from '@/components/ui/Kit';
import { Modal, useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/** 방 참조(blobStore ref) → 캔버스에 그릴 수 있는 <img> 엘리먼트로 (캡처/내보내기용) */
async function refToImage(ref: string): Promise<HTMLImageElement> {
  let src = ref;
  if (!/^(https?:|data:|blob:)/.test(ref)) {
    const blob = await getBlob(ref);
    if (!blob) throw new Error('no-blob');
    src = URL.createObjectURL(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load-failed'));
    img.src = src;
  });
}

function RoomEditorInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const sec = useSectionParam('myroom');

  const [rooms, setRooms, roomsLoaded] = useLocalList<MyRoomPost>('ohome.myroom.v1', MYROOM_SEED);
  const [cats, setCats, catsLoaded] = useLocalList<MyRoomCategory>('ohome.myroomcat.v1', MYROOM_CATEGORY_SEED);
  const [catalog, setCatalog, catalogLoaded] = useLocalList<MyRoomCatalogItem>('ohome.myroomcatalog.v1', MYROOM_CATALOG_SEED);

  const room = rooms.find(r => r.id === params.id);
  const canManage = !!room && !!user && (isAdmin || room.authorId === user.id);

  const [editMode, setEditMode] = useState(false);
  const [zoom, setZoom] = useState(1); // 30% ~ 200%, 화면비율 확대/축소
  const [items, setItems] = useState<MyRoomItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const del = useConfirmDelete();

  useEffect(() => {
    if (room) { setItems(room.items); setDirty(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  if (!roomsLoaded || !catsLoaded || !catalogLoaded) return <section className="page" />;

  if (!room) {
    return (
      <section className="page">
        <div className="page-head"><Link href={`/myroom${secQuery('myroom', sec.id)}`} className="mr-back-to-list">← 목록으로</Link></div>
        <div className="panel" style={{ textAlign: 'center', padding: 48 }}>존재하지 않는 방입니다.</div>
      </section>
    );
  }

  const patchItem = (id: string, patch: Partial<MyRoomItem>) => {
    setItems(cur => cur.map(it => (it.id === id ? { ...it, ...patch } : it)));
    setDirty(true);
  };
  const addFromCatalog = (ci: MyRoomCatalogItem) => {
    const maxZ = items.reduce((m, it) => Math.max(m, it.z), 0);
    const n = items.length % 8;
    const it: MyRoomItem = {
      id: newMyRoomItemId(), catalogId: ci.id, src: ci.src,
      x: 60 + n * 26, y: 60 + n * 22, w: ci.w, h: ci.h, rot: 0, z: maxZ + 1,
    };
    setItems(cur => [...cur, it]);
    setSelectedId(it.id);
    setDirty(true);
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    setItems(cur => cur.filter(it => it.id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  };
  const bringFront = () => {
    if (!selectedId) return;
    const maxZ = items.reduce((m, it) => Math.max(m, it.z), 0);
    patchItem(selectedId, { z: maxZ + 1 });
  };
  const sendBack = () => {
    if (!selectedId) return;
    const minZ = items.reduce((m, it) => Math.min(m, it.z), 0);
    patchItem(selectedId, { z: minZ - 1 });
  };

  const save = () => {
    setRooms(rooms.map(r => (r.id === room.id ? { ...r, items } : r)));
    setDirty(false);
    toast('저장되었습니다');
  };

  const deleteRoom = () => {
    del.ask(`「${room.title}」 방을 삭제하시겠습니까?`, () => {
      setRooms(rooms.filter(r => r.id !== room.id));
      router.push(`/myroom${secQuery('myroom', sec.id)}`);
    });
  };

  const openSettings = () => { setDraftTitle(room.title); setSettingsOpen(true); };
  const applySettings = () => {
    const title = draftTitle.trim().slice(0, 10) || room.title;
    setRooms(rooms.map(r => (r.id === room.id ? { ...r, title } : r)));
    setSettingsOpen(false);
    toast('방 설정을 수정했습니다');
  };

  const captureRoom = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const maxRight = items.reduce((m, it) => Math.max(m, it.x + it.w), 0);
      const maxBottom = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, maxRight + 40);
      cv.height = Math.max(1, maxBottom + 40);
      const ctx = cv.getContext('2d');
      if (!ctx) throw new Error('no-ctx');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      const sorted = [...items].sort((a, b) => a.z - b.z);
      for (const it of sorted) {
        const img = await refToImage(it.src);
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
        ctx.rotate(((it.rot || 0) * Math.PI) / 180);
        ctx.drawImage(img, -it.w / 2, -it.h / 2, it.w, it.h);
        ctx.restore();
      }
      const blob: Blob | null = await new Promise(resolve => cv.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('no-blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.title || 'myroom'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('이미지로 내보내기에 실패했습니다 (이미지 저장소 CORS 설정을 확인해주세요)');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <section className="page">
      <div className="mr-header">
        <Link href={`/myroom${secQuery('myroom', sec.id)}`} className="mr-header-icon" title="리스트로 돌아가기">⌂</Link>
        <div className="mr-header-text">
          <div className="mr-header-title">{room.title}</div>
          <div className="mr-header-author">{room.author}</div>
        </div>
      </div>

      <RoomCanvas
        items={items} editable={canManage && editMode} selectedId={selectedId}
        onSelect={setSelectedId} onChange={patchItem} zoom={zoom}
      />

      {canManage && (
        <div className="mr-fixed-rail">
          <div className="mr-fixed-zoom">
            <button type="button" onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>＋</button>
            <small>{Math.round(zoom * 100)}%</small>
            <button type="button" onClick={() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))}>－</button>
          </div>
          <button type="button" className="mr-float-btn cap" title="캡처(내보내기)" disabled={capturing} onClick={captureRoom}>
            {capturing ? '…' : '📷'}
          </button>
          <button type="button" className={`mr-float-btn edit${editMode ? ' on' : ''}`} title="편집모드"
            onClick={() => setEditMode(v => !v)}>🛋</button>
          <button type="button" className="mr-float-btn" title="방 설정 수정" onClick={openSettings}>⚙</button>
          <button type="button" className="mr-float-btn del" title="방 삭제" onClick={deleteRoom}>🗑</button>
        </div>
      )}

      {canManage && (
        <div className={`mr-edit-panel${editMode ? ' open' : ''}`}>
          <div className="mr-edit-panel-head">
            <b style={{ fontSize: 13 }}>꾸미기</b>
            <button type="button" onClick={() => setEditMode(false)} title="닫기">✕</button>
          </div>

          {selectedId && (
            <div className="mr-selected-bar">
              <button type="button" onClick={bringFront}>맨 앞으로</button>
              <button type="button" onClick={sendBack}>맨 뒤로</button>
              <button type="button" className="danger" onClick={deleteSelected}>삭제</button>
            </div>
          )}

          <CatalogPanel
            categories={cats} catalog={catalog} isAdmin={isAdmin}
            onAddToCanvas={addFromCatalog} onCategoriesChange={setCats} onCatalogChange={setCatalog}
          />

          <button type="button" className="btn btn-dark" disabled={!dirty} onClick={save}>저장</button>
        </div>
      )}

      <Modal open={settingsOpen} title="방 설정 수정" small onClose={() => setSettingsOpen(false)}
        actions={<>
          <button className="btn btn-dark" onClick={applySettings}>적용</button>
          <button className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>취소</button>
        </>}>
        <div className="mr-settings-field">
          <label>방 이름</label>
          <KInput value={draftTitle} onChange={e => setDraftTitle(e.target.value)} maxLength={10} />
        </div>
      </Modal>

      {del.element}
    </section>
  );
}

export default function RoomEditorPage() {
  return <Suspense fallback={<section className="page" />}><RoomEditorInner /></Suspense>;
}
