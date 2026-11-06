'use client';
// 작은 화면(모바일) 전용 메인 뷰 — 인트로 화면처럼 동그란 원(스테이지)이 배경을 가리고,
// 메뉴가 별자리처럼 떠 있다: 별 + 「01 · logged / 이름 / 부제」, 별끼리 가는 선으로 이어진다. 별을 누르면 팝업(또는 이동).
// 메뉴 항목 = 메인에 둔 「팝업 버튼」 위젯들(번호 순). 하나도 없으면 사이트 메뉴(상위 항목)를 쓴다.
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WidgetConf } from '@/lib/mainStore';
import { useMenuSettings, buildMenu, boardEntries } from '@/lib/menuStore';
import { useBoards } from '@/lib/boardStore';
import { useSections, sectionMenuEntries } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/siteStore';
import { useFonts } from '@/lib/fontStore';
import { INTRO_RINGS, INTRO_CONS, INTRO_SPARKS, introSparkle } from '@/lib/introSky';
import { PopBtnCard, PopStar, playPianoNote } from '@/components/main/widgets';

interface Item { key: string; num: string; suffix: string; label: string; sub: string; color: string; conf: WidgetConf | null; href?: string; fontId?: string }

const STAR_D = 'M0 -96Q1.6 -1.6 96 0Q1.6 1.6 0 96Q-1.6 1.6 -96 0Q-1.6 -1.6 0 -96ZM0 -30Q-3 -3 -30 0Q-3 3 0 30Q3 3 30 0Q3 -3 0 -30Z';

export function MobileStage() {
  const router = useRouter();
  const { familyOf } = useFonts();
  const [site] = useSiteSettings();
  const [menuSet] = useMenuSettings();
  const { boards } = useBoards();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState<{ conf: WidgetConf; origin: { x: number; y: number } } | null>(null);

  // 메뉴 = 홈페이지에 등록된 메뉴(메뉴 관리 · 공개범위 반영) — 상위 항목 그대로. 묶음은 누르면 하위 메뉴 팝업, 단일 항목은 바로 이동.
  const items: Item[] = useMemo(() => {
    const menu = buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)], { loggedIn: !!user, isAdmin, id: user?.id });
    return menu.map((m, i) => ({
      key: m.label + i, num: String(i + 1).padStart(2, '0'), suffix: '', label: m.label,
      sub: m.children ? `${m.children.length} ITEMS` : '', color: '#4a63d8', href: m.href,
      conf: m.children ? ({ id: 'ms' + i, type: 'popbtn', col: 1, enabled: true, tx: 0, ty: 0, settings: { mode: 'menu', label: m.label, heading: m.label, num: String(i + 1), hrefs: m.children.map(c => c.href), width: 520 } } as WidgetConf) : null,
    }));
  }, [menuSet, boards, secMap, links, user, isAdmin]);

  const [active, setActive] = useState(0);
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const go = (it: Item, e: React.MouseEvent<HTMLButtonElement>) => {
    const s = (it.conf?.settings ?? {}) as { sound?: boolean; soundVol?: number; num?: string };
    if (s.sound) playPianoNote(s.num, s.soundVol ?? 60);
    if (it.href && (!it.conf || it.conf.settings.mode === 'link')) { if (/^https?:\/\//.test(it.href)) window.open(it.href, '_blank'); else router.push(it.href); return; }
    if (!it.conf) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOpen({ conf: it.conf, origin: { x: r.left + 24, y: r.top + r.height / 2 } });
  };

  return (
    <section className="ms-stage" aria-label="메뉴">
      {/* 왼쪽(위) — 인트로 화면과 같은 디자인: 겹겹의 원 · 별자리 · 반짝이 · 가운데 파란 원과 네 갈래 별 */}
      <div className="ms-vis" aria-hidden="true">
        <svg className="ms-sky" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
          <g className="rings">{INTRO_RINGS.map(c => <circle key={c.r} cx="640" cy="360" r={c.r} className={c.cls} />)}</g>
          <g className="cons">
            {INTRO_CONS.map((d, i) => <polyline key={i} points={d} />)}
            {INTRO_CONS.flatMap((d, i) => d.split(' ').map((pt, j) => { const [x, y] = pt.split(',').map(Number); return <path key={`c${i}-${j}`} className="cs" d={introSparkle(x, y, 3 + ((i + j) % 3))} />; }))}
          </g>
          <g className="orbs">
            <ellipse cx="640" cy="360" rx="700" ry="150" transform="rotate(-17 640 360)" />
            <ellipse cx="640" cy="360" rx="720" ry="210" transform="rotate(14 640 360)" />
          </g>
          <g className="sparks">{INTRO_SPARKS.map(([x, y, r], i) => <path key={i} className="sp" d={introSparkle(x, y, r * 2)} />)}</g>
        </svg>
        <div className="ms-core"><svg viewBox="-100 -100 200 200"><path fillRule="evenodd" transform="rotate(-32)" d={STAR_D} /></svg></div>
        <div className="ms-vtitle">{site.title}</div>
        <i className="ms-cn tl" /><i className="ms-cn br" />
      </div>

      {/* 오른쪽(아래) — 큰 번호 목록 메뉴 */}
      <div className="ms-panel">
        <div className="ms-bar"><span><i />{site.subtitle}</span><span>{dateStr}</span></div>
        <ul className="ms-list">
          {items.map((it, i) => (
            <li key={it.key} className={i === active ? 'on' : ''} style={{ animationDelay: `${0.7 + i * 0.07}s` }}>
              <button type="button" onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={e => { setActive(i); go(it, e); }}>
                <em>{it.num}</em>
                <b style={it.fontId && it.fontId !== 'default' ? { fontFamily: familyOf(it.fontId) } : undefined}>{it.label}</b>
                <span>{i === active && <small>▼ PRESS</small>}{it.sub}</span>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="ms-empty">표시할 메뉴가 없습니다</li>}
        </ul>
        <div className="ms-stat"><div><small>MENU</small><b>{String(items.length).padStart(2, '0')}</b></div><div><small>SECTOR</small><b>07</b></div><div><small>STATUS</small><b>LIVE</b></div></div>
      </div>
      {open && <PopBtnCard conf={open.conf} origin={open.origin} onClose={() => setOpen(null)} />}
    </section>
  );
}
