'use client';
// 마이룸 방 편집/보기 (v1.1) — 인터페이스 개선: 편집 인터페이스는 우측 하단 버튼으로 켜고 끄는
// 오버레이 패널로 바뀌었고, 캔버스는 항상 화면 전체 폭을 쓴다 (그누보드판의 ✧ 진입 버튼 + 
// 캡처(내보내기)/편집모드/설정/삭제 4버튼 리모콘을 참고).
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

  // 편집모드 — 우측 하단 소파 버튼으로 켜고 끈다. 꺼져 있으면 캔버스는 보기 전용(방문객과 동일)
  const [editMode, setEditMode] = useState(false);
  // 편집 중인 아이템 임시 상태 — 저장 버튼을 눌러야 rooms 목록에 반영된다
  const [items, setItems] = useState<MyRoomItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftW, setDraftW] = useState(2000);
  const [draftH, setDraftH] = useState(1500);
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
    const w = Math.min(ci.w, room.canvasW), h = Math.min(ci.h, room.canvasH);
    const it: MyRoomItem = {
      id: newMyRoomItemId(), catalogId: ci.id, src: ci.src,
      x: Math.round((room.canvasW - w) / 2), y: Math.round((room.canvasH - h) / 2),
      w, h, rot: 0, z: maxZ + 1,
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

  const openSettings = () => {
    setDraftTitle(room.title);
    setDraftW(room.canvasW);
    setDraftH(room.canvasH);
    setSettingsOpen(true);
  };
  const applySettings = () => {
    const title = draftTitle.trim().slice(0, 10) || room.title;
    const canvasW = Math.min(4000, Math.max(100, draftW || 2000));
    const canvasH = Math.min(4000, Math.max(100, draftH || 1500));
    setRooms(rooms.map(r => (r.id === room.id ? { ...r, title, canvasW, canvasH } : r)));
    setSettingsOpen(false);
    toast('방 설정을 수정했습니다');
  };

  const captureRoom = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const cv = document.createElement('canvas');
      cv.width = room.canvasW;
      cv.height = room.canvasH;
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

      <div className="mr-stage">
        <RoomCanvas
          canvasW={room.canvasW} canvasH={room.canvasH} items={items}
          editable={canManage && editMode} selectedId={selectedId} onSelect={setSelectedId} onChange={patchItem}
        />

        {canManage && (
          <>
            <div className="mr-float-toolbar">
              <button type="button" className="mr-float-btn cap" title="캡처(내보내기)" disabled={capturing} onClick={captureRoom}>
                {capturing ? '…' : '📷'}
              </button>
              <button type="button" className={`mr-float-btn edit${editMode ? ' on' : ''}`} title="편집모드"
                onClick={() => setEditMode(v => !v)}>🛋</button>
              <button type="button" className="mr-float-btn" title="방 설정 수정" onClick={openSettings}>⚙</button>
              <button type="button" className="mr-float-btn del" title="방 삭제" onClick={deleteRoom}>🗑</button>
            </div>

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
          </>
        )}
      </div>

      <Modal open={settingsOpen} title="방 설정 수정" small onClose={() => setSettingsOpen(false)}
        actions={<>
          <button className="btn btn-dark" onClick={applySettings}>적용</button>
          <button className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>취소</button>
        </>}>
        <div className="mr-settings-field">
          <label>방 이름</label>
          <KInput value={draftTitle} onChange={e => setDraftTitle(e.target.value)} maxLength={10} />
        </div>
        <div className="mr-settings-field">
          <label>캔버스 크기</label>
          <div className="mr-canvas-size-row">
            <input type="number" min={100} max={4000} value={draftW} onChange={e => setDraftW(Number(e.target.value))} />
            <span>×</span>
            <input type="number" min={100} max={4000} value={draftH} onChange={e => setDraftH(Number(e.target.value))} />
          </div>
        </div>
      </Modal>

      {del.element}
    </section>
  );
}

export default function RoomEditorPage() {
  return <Suspense fallback={<section className="page" />}><RoomEditorInner /></Suspense>;
}
