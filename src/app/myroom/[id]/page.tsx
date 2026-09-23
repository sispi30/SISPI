'use client';
// 마이룸 방 편집/보기 (v1) — 그누보드판 view.skin.php에 해당.
// 저장은 명시적으로 [저장] 버튼을 눌러야 반영된다 (편집 중 매 픽셀마다 서버에 쓰지 않는다).
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
import { KInput } from '@/components/ui/Kit';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

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
  const canEdit = !!room && !!user && (isAdmin || room.authorId === user.id);

  // 편집 중인 임시 상태 — 저장 버튼을 눌러야 rooms 목록에 반영된다
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<MyRoomItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const del = useConfirmDelete();

  useEffect(() => {
    if (room) { setTitle(room.title); setItems(room.items); setDirty(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  if (!roomsLoaded || !catsLoaded || !catalogLoaded) return <section className="page" />;

  if (!room) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={`/myroom${secQuery('myroom', sec.id)}`}>MYROOM</PageTitle></div>
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
    setRooms(rooms.map(r => (r.id === room.id ? { ...r, title: title.trim() || r.title, items } : r)));
    setDirty(false);
    toast('저장되었습니다');
  };

  const deleteRoom = () => {
    del.ask(`「${room.title}」 방을 삭제하시겠습니까?`, () => {
      setRooms(rooms.filter(r => r.id !== room.id));
      router.push(`/myroom${secQuery('myroom', sec.id)}`);
    });
  };

  return (
    <section className="page">
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href={`/myroom${secQuery('myroom', sec.id)}`} className="mr-back-to-list">← 목록으로</Link>
        {canEdit
          ? <KInput value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }} maxLength={10} style={{ maxWidth: 200 }} />
          : <PageTitle>{room.title}</PageTitle>}
      </div>

      <div className="mr-layout">
        <RoomCanvas
          canvasW={room.canvasW} canvasH={room.canvasH} items={items}
          editable={canEdit} selectedId={selectedId} onSelect={setSelectedId} onChange={patchItem}
        />

        {canEdit && (
          <div className="mr-side-slot">
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
            <div className="mr-remote-actions">
              <button type="button" className="btn btn-dark" disabled={!dirty} onClick={save}>저장</button>
              <button type="button" className="btn btn-ghost danger" onClick={deleteRoom}>방 삭제</button>
            </div>
          </div>
        )}
      </div>
      {del.element}
    </section>
  );
}

export default function RoomEditorPage() {
  return <Suspense fallback={<section className="page" />}><RoomEditorInner /></Suspense>;
}
