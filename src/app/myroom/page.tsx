'use client';
// 마이룸 목록 (v1) — 그누보드판 list.skin.php에 해당. 방 카드 그리드 + 작은 미리보기.
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { useSectionParam, filterSection, sectionSetter, secQuery } from '@/lib/sectionStore';
import { MyRoomPost, MYROOM_SEED } from '@/lib/myroomStore';
import { BlobImg } from '@/lib/blobStore';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { useConfirmDelete } from '@/components/ui/Modal';

function RoomPreview({ room }: { room: MyRoomPost }) {
  if (!room.items.length) return <div className="mr-preview-empty">방 미리보기</div>;
  const minX = Math.min(...room.items.map(it => it.x));
  const minY = Math.min(...room.items.map(it => it.y));
  const maxX = Math.max(...room.items.map(it => it.x + it.w));
  const maxY = Math.max(...room.items.map(it => it.y + it.h));
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const scale = Math.min(180 / bw, 148 / bh);
  const sorted = [...room.items].sort((a, b) => a.z - b.z);
  return (
    <div className="mr-preview-frame">
      <div className="mr-preview-canvas" style={{ width: bw, height: bh, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {sorted.map(it => (
          <div key={it.id} className="mr-preview-item"
            style={{ left: it.x - minX, top: it.y - minY, width: it.w, height: it.h, transform: `rotate(${it.rot || 0}deg)` }}>
            <BlobImg fileRef={it.src} imgStyle={{ objectFit: 'contain' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MyRoomPageInner() {
  const router = useRouter();
  const { user } = useAuth();
  const [roomsAll, setRoomsAll, loaded] = useLocalList<MyRoomPost>('ohome.myroom.v1', MYROOM_SEED);
  const sec = useSectionParam('myroom');
  const rooms = filterSection(roomsAll, sec.id);
  const setRooms = sectionSetter(roomsAll, sec.id, setRoomsAll);
  const del = useConfirmDelete();
  const [busy, setBusy] = useState(false);

  const createRoom = () => {
    if (!user || busy) return;
    const title = window.prompt('방 이름을 입력하세요 (최대 10자)')?.trim().slice(0, 10);
    if (!title) return;
    setBusy(true);
    const id = `room-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setRooms([...rooms, {
      id, title, author: user.nickname, authorId: user.id, date: new Date().toISOString(),
      items: [],
    }]);
    router.push(`/myroom/${id}${secQuery('myroom', sec.id)}`);
  };

  if (!loaded) return <section className="page" />;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>{sec.id === 'main' ? 'MYROOM' : sec.name}</PageTitle>
        <EditableDesc k="myroom-desc" def="아이템을 배치해서 나만의 방을 꾸며보세요" />
      </div>

      <div className="toolrow" style={{ marginBottom: 16, justifyContent: 'flex-end' }}>
        {user
          ? <button className="btn btn-dark" disabled={busy} onClick={createRoom}>＋ 새 방 만들기</button>
          : <small style={{ color: 'var(--faint)' }}>로그인하면 방을 만들 수 있어요</small>}
      </div>

      {rooms.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: 13, color: 'var(--faint)' }}>아직 등록된 방이 없습니다</p>
        </div>
      ) : (
        <div className="mr-room-grid">
          {rooms.map(r => {
            const canDelete = user && (user.id === r.authorId);
            return (
              <div key={r.id} className="panel mr-room-card">
                <Link href={`/myroom/${r.id}${secQuery('myroom', sec.id)}`} className="mr-room-card-link">
                  <RoomPreview room={r} />
                  <div className="mr-room-info">
                    <div className="mr-room-title">{r.title}</div>
                    <div className="mr-room-writer">{r.author}</div>
                  </div>
                </Link>
                {canDelete && (
                  <div className="hv-actions">
                    <button className="del" onClick={() => del.ask(`「${r.title}」 방을 삭제하시겠습니까?`,
                      () => setRooms(rooms.filter(x => x.id !== r.id)))}>DELETE</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {del.element}
    </section>
  );
}

export default function MyRoomPage() {
  return <Suspense fallback={<section className="page" />}><MyRoomPageInner /></Suspense>;
}
