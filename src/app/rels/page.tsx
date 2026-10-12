'use client';
// EditableDesc 주입
// 자관 리스트 (4.5) — 4:3 가로 썸네일 · 공개범위 3단계 · 멤버 색 점
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Relation, REL_SEED, Character, CHAR_SEED, relPath } from '@/lib/charStore';
import { SearchBar } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { useBlobUrl } from '@/lib/blobStore';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useMainStore } from '@/lib/mainStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 카드 한 장 — 대표 아트를 한 번은 컬러로, 한 번은 흑백으로 겹쳐 대각선으로 가른다 (멤버 두 명이 나란히 선 느낌) */
function PairCard({ rel, no, locked, priv, members, onOpen, dragProps }: {
  rel: Relation; no: number; locked: boolean; priv: boolean;
  members: { name: string; color: string }[]; onOpen: () => void;
  dragProps: { style?: React.CSSProperties } & Record<string, unknown>;
}) {
  const url = useBlobUrl(locked ? undefined : (rel.arts?.[0] ?? rel.thumbId));
  const c1 = members[0]?.color ?? '#7fd6d0', c2 = members[1]?.color ?? c1;
  const tag = rel.cp === 'ncp' ? 'NCP' : rel.cp === 'cp' ? 'CP' : rel.kind === 'multi' ? 'MULTI' : 'PAIR';
  const { style: dstyle, ...drest } = dragProps;
  return (
    <div className={`rx-card${priv ? ' priv' : ''}`} {...drest} onClick={onOpen}
      style={{ ['--i' as string]: no - 1, ['--c1' as string]: c1, ['--c2' as string]: c2, ...(dstyle ?? {}) } as React.CSSProperties}>
      <div className="rx-art">
        {url ? (
          <>
            <img className="rx-img" src={url} alt="" draggable={false} />
            <img className="rx-img rx-gray" src={url} alt="" draggable={false} />
          </>
        ) : <div className={`rx-ph ph ${rel.thumbClass}`}><span>{priv ? '나만보기' : locked ? '멤버공개' : 'NO ART'}</span></div>}
        <svg className="rx-split" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id={`rxg${no}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
          <line x1="58" y1="0" x2="38" y2="100" stroke={`url(#rxg${no})`} strokeWidth="1.4" vectorEffect="non-scaling-stroke" pathLength={1} />
        </svg>
        <div className="rx-shade" />
      </div>
      <i className="rx-corner tr" /><i className="rx-corner bl" />
      <div className="rx-top">
        <span className="rx-no">{pad2(no)}</span>
        <span className="rx-file">PAIR<br />FILE</span>
        <span className="rx-meta"><b style={{ color: c1 }}>{tag}</b><em>{pad2(rel.members.length)} MEMBERS</em></span>
      </div>
      <div className="rx-bot">
        {rel.catchphrase && <small>{locked ? '' : rel.catchphrase.replace(/ /g, '')}</small>}
        <h3>{rel.name}{rel.visibility === 'member' && <span className="pill" style={{ marginLeft: 8, verticalAlign: 'middle' }}>멤버</span>}</h3>
        <div className="rx-who">
          {members.slice(0, 3).map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <u>×</u>}
              <span><i style={{ background: m.color }} />{m.name.toUpperCase()}</span>
            </React.Fragment>
          ))}
          {members.length > 3 && <u>+{members.length - 3}</u>}
        </div>
      </div>
    </div>
  );
}

export default function RelsPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { editOn } = useMainStore();
  const [rels, setRels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [q, setQ] = useState('');

  const memberOf = (id: string) => {
    const c = chars.find(x => x.id === id);
    return { name: c?.name || '—', color: c?.color ?? '#666' };
  };
  const visible = rels
    .filter(r => isAdmin || r.visibility !== 'private')
    .filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  // 편집모드 카드 드래그 정렬 (v1.9)
  const sort = useCardSort(visible, next => setRels(mergeOrder(rels, next)), editOn && isAdmin);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>RELATIONS</PageTitle>
        <EditableDesc k="rels-desc" def="자관 목록 · 4:3 가로 썸네일 · 공개범위: 전체공개/멤버공개/나만보기" />
        <div className="head-actions">
          <SearchBar onSearch={setQ} />
          {isAdmin && <button className="btn btn-dark" onClick={() => router.push('/rels/new')}>＋ ADD RELATION</button>}
        </div>
      </div>

      {/* 페어 인덱스 — 화면 틀(모서리 표식·머리줄·바닥줄) 안에 카드가 놓이는 구성 */}
      <div className="rx">
        <i className="rx-fr tl" /><i className="rx-fr tr" /><i className="rx-fr bl" /><i className="rx-fr br" />
        <div className="rx-headline">
          <span className="rx-cap">RELATION ARCHIVE // PAIR INDEX</span>
          <span className="rx-count"><em>PAIRS</em><b>{pad2(visible.length)}</b></span>
        </div>
        <div className="rx-ghost" aria-hidden="true">PAIRS</div>
        <div className="rx-grid">
          {visible.map((r, i) => {
            const memberLocked = r.visibility === 'member' && !user;
            const priv = r.visibility === 'private';
            return (
              <PairCard key={r.id} rel={r} no={i + 1} locked={memberLocked} priv={priv}
                members={r.members.map(m => memberOf(m.charId))}
                dragProps={sort(i) as { style?: React.CSSProperties } & Record<string, unknown>}
                onOpen={() => {
                  if (editOn) return;
                  if (memberLocked) { toast('멤버공개 — 로그인 후 열람할 수 있습니다'); return; }
                  router.push(relPath(r));
                }} />
            );
          })}
          {visible.length === 0 && <p className="rx-empty">표시할 자관이 없습니다</p>}
        </div>
        <div className="rx-foot">
          <span className="rx-bar" aria-hidden="true" />
          <span className="rx-cap">PAIR FILE // {pad2(visible.length)} PAIRS</span>
          <span className="rx-chev" aria-hidden="true">›››</span>
        </div>
      </div>
    </section>
  );
}
