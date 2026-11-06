'use client';
// 작은 화면(모바일) 전용 메인 뷰 — 인트로 화면처럼 동그란 원(스테이지)이 배경을 가리고,
// 메뉴가 별자리처럼 떠 있다: 별 + 「01 · logged / 이름 / 부제」, 별끼리 가는 선으로 이어진다. 별을 누르면 팝업(또는 이동).
// 메뉴 항목 = 메인에 둔 「팝업 버튼」 위젯들(번호 순). 하나도 없으면 사이트 메뉴(상위 항목)를 쓴다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WidgetConf } from '@/lib/mainStore';
import { useMenuSettings, buildMenu, boardEntries } from '@/lib/menuStore';
import { useBoards } from '@/lib/boardStore';
import { useSections, sectionMenuEntries } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useFonts } from '@/lib/fontStore';
import { INTRO_RINGS, INTRO_CONS, INTRO_SPARKS, INTRO_PLANETS, introSparkle } from '@/lib/introSky';
import { PopBtnCard, PopStar, playPianoNote, useRecentRows, useDiaryRows } from '@/components/main/widgets';

interface Item { children?: { label: string; href: string }[]; key: string; num: string; suffix: string; label: string; sub: string; color: string; conf: WidgetConf | null; href?: string; fontId?: string }

const STAR_D = 'M0 -96Q1.6 -1.6 96 0Q1.6 1.6 0 96Q-1.6 1.6 -96 0Q-1.6 -1.6 0 -96ZM0 -30Q-3 -3 -30 0Q-3 3 0 30Q3 3 30 0Q3 -3 0 -30Z';

export function MobileStage({ mode = 'small' }: { mode?: 'small' | 'mid' }) {
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
      sub: '', color: '#4a63d8', href: m.href, children: m.children?.map(c => ({ label: c.label, href: c.href })),
      conf: m.children ? ({ id: 'ms' + i, type: 'popbtn', col: 1, enabled: true, tx: 0, ty: 0, settings: { mode: 'menu', label: m.label, heading: m.label, num: String(i + 1), hrefs: m.children.map(c => c.href), width: 520 } } as WidgetConf) : null,
    }));
  }, [menuSet, boards, secMap, links, user, isAdmin]);

  // 별은 저절로 돌지 않고, 마우스(손가락)가 움직이는 방향을 따라 부드럽게 돈다 — 인트로 화면과 같다
  const starRef = useRef<SVGGElement>(null);
  useEffect(() => {
    const aim = { target: 0, cur: 0, last: 0, init: false };
    const mv = (e: PointerEvent) => {
      const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2) * 180 / Math.PI;
      if (!aim.init) { aim.init = true; aim.last = a; aim.target = aim.cur = a; return; }
      let d = a - aim.last;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      aim.last = a; aim.target += d;
    };
    window.addEventListener('pointermove', mv);
    let id = 0;
    const loop = () => {
      if (Math.abs(aim.target - aim.cur) > 0.02) {
        aim.cur += (aim.target - aim.cur) * 0.06;
        if (starRef.current) starRef.current.style.transform = `rotate(${aim.cur}deg)`;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => { window.removeEventListener('pointermove', mv); cancelAnimationFrame(id); };
  }, []);
  const recent = useRecentRows(4);
  const diary = useDiaryRows(4);
  const [tab, setTab] = useState<'recent' | 'diary'>('recent');
  const [active, setActive] = useState<number | null>(null);   // 펼친 메뉴 — 평소엔 모두 접혀 있다
  // 메인 소형 뷰에서는 상단바를 숨기고 아래 내용을 위로 당긴다
  useEffect(() => { document.body.classList.add('ms-on'); return () => document.body.classList.remove('ms-on'); }, []);
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

  // 인트로 화면에서 설정한 배경색·그림·색을 그대로 쓴다 (IntroSplash와 같은 변수)
  const img = useBlobUrl(site.introImage);
  const bg1 = site.introBg ?? '#050716';
  const vars = {
    ['--is-bgc' as string]: site.introBg2 ? `linear-gradient(180deg,${bg1},${site.introBg2})` : bg1,
    ...(site.introDot ? { ['--is-ac' as string]: site.introDot } : {}),
    ...(site.introFg ? { ['--is-fg' as string]: site.introFg } : {}),
    ['--is-op' as string]: (site.introImageOp ?? 100) / 100,
  } as React.CSSProperties;
  const nav = (href: string) => { if (/^https?:\/\//.test(href)) window.open(href, '_blank'); else router.push(href); };
  return (
    <section className={`ms-stage ${mode}`} aria-label="메뉴" style={vars}>
      <div className="ms-left">
        <div className="ms-vtitle" aria-hidden="true">{(site.title || '').toUpperCase()}</div>

      {/* 가운데 — 인트로 화면과 같은 구성: 겹겹의 원 · 별자리 · 궤도 · 반짝이 · 파란 원과 네 갈래 별. 바탕은 비워 홈페이지 배경이 비친다 */}
      <div className="ms-vis" aria-hidden="true">
        <svg className="ms-sky" viewBox="300 20 680 680" preserveAspectRatio="xMidYMid slice">
          <g className="rings">{INTRO_RINGS.filter(c => c.cls !== 'dash').map(c => <circle key={c.r} cx="640" cy="360" r={c.r} className={c.cls} />)}</g>
          <g className="rays">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="640" y1="228" x2="640" y2="28" transform={`rotate(${i * 30 + 7} 640 360)`} />)}</g>
          <g className="orbs">
            <ellipse cx="640" cy="360" rx="700" ry="150" transform="rotate(-17 640 360)" />
            <ellipse cx="640" cy="360" rx="720" ry="210" transform="rotate(14 640 360)" />
          </g>
          <g className="sparks">{INTRO_SPARKS.map(([x, y, r], i) => <path key={i} className="sp" d={introSparkle(x, y, r * 2)} />)}</g>
        </svg>
        <svg className="ms-sky pls" viewBox="300 20 680 680" preserveAspectRatio="xMidYMid slice">
          <g className="dashring">{INTRO_RINGS.filter(c => c.cls === 'dash').map(c => <circle key={c.r} cx="640" cy="360" r={c.r} className="dash" />)}</g>
          <g className="cons">
            {INTRO_CONS.map((d, i) => <polyline key={i} points={d} />)}
            {INTRO_CONS.flatMap((d, i) => d.split(' ').map((pt, j) => { const [x, y] = pt.split(',').map(Number); return <path key={`c${i}-${j}`} className="cs" d={introSparkle(x, y, 3 + ((i + j) % 3))} />; }))}
          </g>
          <g className="planets">
            {INTRO_PLANETS.map((p, i) => (
              <g key={i} transform={`rotate(${p.a} 640 360)`}><g className={`spin${p.rev ? ' r' : ''}`} style={{ animationDuration: `${p.t}s` }}>
                <circle cx="640" cy={360 - p.r} r={p.s} className={`pl${p.ring || p.half ? ' ln' : ''}`} />
              </g></g>
            ))}
          </g>
        </svg>
        <div className="ms-halo" />
        {img && <div className="ms-art" style={{ backgroundImage: `url("${img}")` }} />}
        <div className="ms-core"><svg viewBox="-100 -100 200 200"><g ref={starRef}><path fillRule="evenodd" transform="rotate(-32)" d={STAR_D} /></g></svg></div>
      </div>

      </div>
      <div className="ms-right">
      <div className="ms-top"><span><i />{site.subtitle}</span><span>{dateStr}</span></div>
      <ul className="ms-list">
        {items.map((it, i) => (
          <li key={it.key} className={i === active ? 'on' : ''} style={{ animationDelay: `${0.5 + i * 0.07}s` }}>
            <button type="button" aria-expanded={it.children ? i === active : undefined}
              onClick={() => { if (it.children) setActive(a => (a === i ? null : i)); else if (it.href) { setActive(i); nav(it.href); } }}>
              <em>{it.num}</em>
              <b style={it.fontId && it.fontId !== 'default' ? { fontFamily: familyOf(it.fontId) } : undefined}>{it.label}</b>
              {it.children && <small>{i === active ? '▲' : '▼'}</small>}
            </button>
            {it.children && (
              <div className="ms-fold"><div className="ms-subs">
                {it.children.map(c => <button type="button" key={c.href} tabIndex={i === active ? 0 : -1} onClick={() => nav(c.href)}>{c.label}</button>)}
              </div></div>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="ms-empty">표시할 메뉴가 없습니다</li>}
      </ul>

      <div className="ms-stat"><div><small>MENU</small><b>{String(items.length).padStart(2, '0')}</b></div><div><small>SECTOR</small><b>07</b></div><div><small>STATUS</small><b>LIVE</b></div></div>
      <div className="ms-card ms-rec">
        <div className="ms-tabs">
          <button type="button" className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>RECENT ENTRIES</button>
          {diary.length > 0 && <button type="button" className={tab === 'diary' ? 'on' : ''} onClick={() => setTab('diary')}>MOOD DIARY</button>}
        </div>
        <ol className="ms-rows">
          {tab === 'recent' || diary.length === 0
            ? recent.map((r, i) => (
              <li key={r.key}><button type="button" onClick={() => router.push(r.href)}>
                <em>{String(i + 1).padStart(2, '0')}</em><span>{r.title}</span><i>{r.where} · {r.date.slice(5, 10).replace('-', '.')}</i>
              </button></li>))
            : diary.map(r => (
              <li key={r.key}><button type="button" onClick={() => router.push(r.href)}>
                <em className="mood" style={{ background: `color-mix(in srgb, ${r.color} 22%, transparent)`, color: r.color }}>{r.icon}</em><span>{r.title}</span><i>{r.mood ? `${r.mood} · ` : ''}{r.date.slice(5, 10).replace('-', '.')}</i>
              </button></li>))}
          {(tab === 'recent' || diary.length === 0) && recent.length === 0 && <li className="ms-empty">새 글이 없습니다</li>}
        </ol>
        <div className="ms-cf"><span>{dateStr.replace(/\./g, '/')} · {site.title}</span><span>● LIVE</span></div>
      </div>
      </div>
      {open && <PopBtnCard conf={open.conf} origin={open.origin} onClose={() => setOpen(null)} />}
    </section>
  );
}
