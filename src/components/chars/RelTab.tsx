'use client';
// 캐릭터 상세 REL(관계) 탭 — 그룹 라벨(+개수) 아래에 세로로 긴 카드를 가로로 나열 (OC-homepage 관계 탭 방식).
// 카드: 위쪽에 이미지, 왼쪽 위 꼬리표, 아래쪽 이름·영문(보조) — 누르면 그 자관/캐릭터 페이지로
import React from 'react';
import { useRouter } from 'next/navigation';
import { useBlobUrl } from '@/lib/blobStore';
import type { RelCardInfo, RelGroupInfo } from '@/lib/charStore';

function CardImg({ fileRef, ph }: { fileRef?: string; ph?: string }) {
  const url = useBlobUrl(fileRef);
  return <span className={`rc-img${url ? '' : ` ph ${ph ?? ''}`}`} style={url ? { backgroundImage: `url("${url}")` } : undefined} />;
}

function Card({ c }: { c: RelCardInfo }) {
  const router = useRouter();
  return (
    <div className={`rc-card${c.shape === 'char' ? ' rc-char' : ''}`} role="link" tabIndex={0} onClick={() => router.push(c.href)}
      onKeyDown={e => { if (e.key === 'Enter') router.push(c.href); }}>
      <CardImg fileRef={c.thumbRef} ph={c.thumbClass} />
      <span className="rc-shade" />
      {c.label && <span className="rc-label">{c.label}</span>}
      <span className="rc-text">
        <strong className="rc-name">{c.name}</strong>
        {c.sub && <span className="rc-sub">{c.sub}</span>}
      </span>
    </div>
  );
}

/** 마우스 휠을 굴리면 가로로 넘어가게 (끝에 닿으면 원래대로 세로 스크롤) */
function Row({ cards }: { cards: RelCardInfo[] }) {
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
  return <div className="rc-row" ref={ref}>{cards.map(c => <Card key={c.key} c={c} />)}</div>;
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
          <Row cards={g.cards} />
        </div>
      ))}
    </div>
  );
}
