'use client';
// 캐릭터 상세 REL(관계) 탭 — 그룹 라벨(+개수) 아래에 세로로 긴 카드를 가로로 나열 (OC-homepage 관계 탭 방식).
// 카드: 위쪽에 이미지, 왼쪽 위 꼬리표, 아래쪽 이름·영문(보조) — 누르면 그 자관/캐릭터 페이지로
import React from 'react';
import { useRouter } from 'next/navigation';
import type { RelCardInfo, RelGroupInfo } from '@/lib/charStore';
import { RxCard } from '@/components/rels/RxCard';
import { useToast } from '@/components/ui/Toast';

function Card({ c, no }: { c: RelCardInfo; no: number }) {
  const router = useRouter();
  const toast = useToast();
  const go = () => { if (c.blocked) { toast('공개되지 않은 캐릭터라 프로필로 이동할 수 없습니다'); return; } router.push(c.href); };
  const isChar = c.shape === 'char';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <RxCard drawer no={no} tall={isChar} fileRef={c.thumbRef} crop={c.thumbCrop} ph={c.thumbClass}
      tc={c.themeColor ?? 'var(--accent,#7fd6d0)'}
      tag={isChar ? c.label : c.tag} meta={isChar ? undefined : `${pad(c.memberCount ?? 0)} MEMBERS`}
      fileText={isChar ? 'CHAR\nFILE' : (c.memberCount ?? 0) >= 3 ? 'GROUP\nFILE' : 'PAIR\nFILE'}
      small={isChar ? (c.sub ?? '') : (c.catchphrase ?? '').replace(/ /g, '')}
      title={c.name} who={c.who ?? []}
      tabIndex={0} onClick={go}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') go(); }} />
  );
}

/** 카드 옆 설명 박스 — 관계명 · 관계 캐릭터 이름 · CP/NCP · 간단한 관계 설명 */
function Note({ c }: { c: RelCardInfo }) {
  return (
    <div className="rc-note" style={{ '--rn': c.themeColor ?? 'var(--accent,#7fd6d0)' } as React.CSSProperties}>
      <div className="rc-note-head">
        <b>{c.name}</b>
        {c.names && <span>{c.names}</span>}
      </div>
      {c.cpTag && <p className="rc-note-tag"><i /><em>TYPE</em><strong>{c.cpTag}</strong></p>}
      <p className="rc-note-desc">{c.desc}</p>
    </div>
  );
}

/** 마우스 휠을 굴리면 가로로 넘어가게 (끝에 닿으면 원래대로 세로 스크롤) */
function Row({ cards, wrap }: { cards: RelCardInfo[]; wrap?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY > 0 && el.scrollLeft < max - 1) || (e.deltaY < 0 && el.scrollLeft > 0)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  // 직접 지정한 관계는 가로 스크롤 없이 카드(+설명)를 한 묶음으로 아랫줄에 이어 배치한다
  if (wrap) {
    return <div className="rc-row rc-wrap">{cards.map((c, i) => (
      <div key={c.key} className="rc-item">
        <Card c={c} no={i + 1} />
        {c.desc && <Note c={c} />}
      </div>
    ))}</div>;
  }
  return <div className="rc-row" ref={ref}>{cards.map((c, i) => (
    <React.Fragment key={c.key}>
      <Card c={c} no={i + 1} />
      {c.desc && <Note c={c} />}
    </React.Fragment>
  ))}</div>;
}

export function RelTab({ groups }: { groups: RelGroupInfo[] }) {
  if (groups.length === 0) {
    return <p className="hint">아직 표시할 관계가 없습니다 — 이 캐릭터가 멤버인 자관이 생기거나, 편집에서 관계를 지정하면 여기에 나타납니다</p>;
  }
  return (
    <div className="rc">
      {groups.map(g => (
        <div key={g.name} className="rc-group">
          <p className="rc-group-title"><span className="rc-group-name">{g.name}</span><span className="rc-group-count">{g.cards.length}</span></p>
          <Row cards={g.cards} wrap={g.cards.length > 0 && g.cards.every(c => c.shape === 'char')} />
        </div>
      ))}
    </div>
  );
}
