'use client';
// 페어 옷장 — 캐릭터 두 명에게 옷을 입혀 보는 페이지 (원본: 우초맨 「페어의 옷장 ver2」)
// 페어를 여러 개 두고 칩으로 바꿔 가며 입힐 수 있다. 옷·대사·디자인은 관리자가 이 페이지에서 직접 고친다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCloset, itemsForPair } from '@/lib/closetStore';
import { ClosetStage, type StageSaved } from '@/components/closet/ClosetStage';
import { ClosetAdmin } from '@/components/closet/ClosetAdmin';

const PAIR_KEY = 'ohome.closet.pair';

export default function ClosetPage() {
  const { isAdmin } = useAuth();
  const [data, save, loaded] = useCloset();
  const [edit, setEdit] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  // 페어를 바꿔 입히는 동안 각 페어의 입은 모습을 보관 (페어 id → 상태)
  const memo = useRef<Record<string, StageSaved>>({});

  // 처음 보일 페어: 주소의 ?p= → 지난번에 본 페어 → 첫 페어
  useEffect(() => {
    if (!loaded) return;
    let want: string | null = null;
    try { want = new URLSearchParams(window.location.search).get('p') || localStorage.getItem(PAIR_KEY); } catch { /* 무시 */ }
    setPairId(data.pairs.some(p => p.id === want) ? want : data.pairs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const pair = data.pairs.find(p => p.id === pairId) ?? data.pairs[0];
  const items = useMemo(() => (pair ? itemsForPair(data.items, pair.id) : []), [data.items, pair]);

  const pick = (id: string) => {
    setPairId(id);
    try {
      localStorage.setItem(PAIR_KEY, id);
      const u = new URL(window.location.href);
      u.searchParams.set('p', id);
      window.history.replaceState(null, '', u);
    } catch { /* 무시 */ }
  };

  if (!loaded || !pair) return <section className="page" />;

  return (
    <section className="page">
      {data.pairs.length > 1 && (
        <div className="closet-pairs narrow-only">
          {data.pairs.map(p => (
            <button key={p.id} type="button" className={p.id === pair.id ? 'on' : ''} onClick={() => pick(p.id)}>{p.name}</button>
          ))}
        </div>
      )}

      {/* key — 페어가 바뀌면 화면을 새로 세운다 (입은 모습은 memo 로 이어 간다) */}
      <ClosetStage key={pair.id} pair={pair} items={items} isAdmin={isAdmin} onEdit={() => setEdit(true)} pairs={data.pairs} onPick={pick}
        saved={memo.current[pair.id]} onSave={s => { memo.current[pair.id] = s; }} />

      {isAdmin && (
        <ClosetAdmin open={edit} data={data} pairId={pair.id} onClose={() => setEdit(false)}
          onSave={d => {
            // 편집한 뒤에는 보관해 둔 입은 모습이 옛 설정 기준이라 비운다
            memo.current = {};
            save(d);
            if (!d.pairs.some(p => p.id === pair.id)) pick(d.pairs[0].id);
            setEdit(false);
          }} />
      )}
    </section>
  );
}
