'use client';
// EditableDesc 주입
// 캐릭터 리스트 (4.4) — 한 줄 5개 · 3:4 썸네일(크롭 반영) · 전용 폰트 · ＋ ADD CHARACTER
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, charPath } from '@/lib/charStore';
import { backend, isServerMode } from '@/lib/backend';
import { useSectionParam, filterSection, sectionSetter, secQuery } from '@/lib/sectionStore';
import { SearchBar, FitText } from '@/components/ui/Kit';
import { RxCard } from '@/components/rels/RxCard';

import { useToast } from '@/components/ui/Toast';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useMainStore } from '@/lib/mainStore';
import { useCardSort, mergeOrder } from '@/lib/cardSort';

function CharsInner() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { editOn } = useMainStore();
  const [charsAll, setCharsAll] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  // 여러 개로 만든 캐릭터 목록 (v2.0 사용자 요청) — 주소의 ?s= 가 가리키는 것만
  const sec = useSectionParam('chars');
  const chars = filterSection(charsAll, sec.id);
  // 저장은 이 목록 자리만 교체 — 걸러진 목록을 그대로 넘겨도 다른 목록이 지워지지 않는다
  const setChars = sectionSetter(charsAll, sec.id, setCharsAll);
  const [q, setQ] = useState('');

  /* 편집 권한 문서 자가 치유 (v2.0 포크 제보 — 「권한을 줬는데 그 회원의 저장이 거부된다」).
     업데이트 전에 준 권한은 문서에 규칙이 읽는 평평한 목록(editorIds)이 없어, 최신 규칙을
     넣어도 서버가 그 회원의 저장을 계속 거부한다. 관리자가 이 목록을 열면 권한 있는 캐릭터의
     editorIds를 서버에서 한 번 다시 계산해 둔다 — 세션당 1회, 조용히. */
  useEffect(() => {
    if (!isAdmin || !isServerMode()) return;
    const withGrants = charsAll.filter(c => c.grants?.some(g => g.level === 'edit'));
    if (!withGrants.length) return;
    try {
      if (sessionStorage.getItem('ohome.editorids.healed') === '1') return;
      sessionStorage.setItem('ohome.editorids.healed', '1');
    } catch { /* 무시 */ }
    void backend()?.refreshVis('characters', withGrants as unknown as { id: string }[], null)
      .catch(() => { /* 무시 — 다음 세션에 다시 */ });
  }, [isAdmin, charsAll]);

  const visible = chars
    .filter(c => c.own)
    .filter(c => isAdmin || c.visibility === 'public')
    .filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.sub.includes(q));

  // 편집모드 카드 드래그 정렬 (v1.9)
  const sort = useCardSort(visible, next => setChars(mergeOrder(chars, next)), editOn && isAdmin);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>{sec.id === 'main' ? 'CHARACTERS' : sec.name}</PageTitle>
        <EditableDesc k="chars-desc" def="운영자의 자캐 목록 · 3:4 두상 썸네일 · 클릭 시 프로필로 이동" />
        <div className="head-actions">
          <SearchBar onSearch={setQ} />
          {isAdmin && <button className="btn btn-dark" onClick={() => router.push('/chars/new' + secQuery('chars', sec.id))}>＋ ADD CHARACTER</button>}
        </div>
      </div>
      {/* 캐릭터 인덱스 — 자관 목록과 같은 화면 틀(모서리 표식·머리줄·바닥줄·큰 배경 글씨) 안에 카드가 놓인다 */}
      <div className="rx">
        <i className="rx-fr tl" /><i className="rx-fr tr" /><i className="rx-fr bl" /><i className="rx-fr br" />
        <div className="rx-headline">
          <span className="rx-cap">CHARACTER ARCHIVE // CHARACTER INDEX</span>
          <span className="rx-count"><em>CHARACTER</em><b>{String(visible.length).padStart(2, '0')}</b></span>
        </div>
        <div className="rx-ghost" aria-hidden="true">CHARACTER</div>
      <div className="g5 chars-grid rx-pad">
        {visible.map((c, i) => {
          const priv = c.visibility === 'private';
          const sp = sort(i) as { style?: React.CSSProperties };
          return (
            <RxCard adaptive key={c.id} {...(sort(i) as Record<string, unknown>)} no={i + 1} anim={i % 10}
              fileRef={c.arts?.[0] ?? c.thumbId} crop={c.thumbCrop} ph={c.thumbClass} phLabel={priv ? '비공개' : '3:4'}
              tc={c.color || 'var(--accent,#7fd6d0)'} fileText={'CHARACTER\nFILE'} small={c.sub} title={c.name}
              who={[{ name: '', color: c.color || 'var(--accent,#7fd6d0)' }]} priv={priv}
              style={{ aspectRatio: '214/325', ...sp.style }}
              onClick={() => { if (!editOn) router.push(charPath(c)); }} />
          );
        })}
        {visible.length === 0 && (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--page-desc)', fontSize: 13, padding: 40 }}>
            표시할 캐릭터가 없습니다
          </p>
        )}
      </div>
        <div className="rx-foot">
          <span className="rx-bar" aria-hidden="true" />
          <span className="rx-cap">CHARACTER FILE // {String(visible.length).padStart(2, '0')}</span>
          <span className="rx-chev" aria-hidden="true">›››</span>
        </div>
      </div>
    </section>
  );
}

export default function CharsPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><CharsInner /></Suspense>;
}
