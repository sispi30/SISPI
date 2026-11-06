'use client';
// 작은 화면(모바일) 전용 메인 뷰 — 인트로 화면처럼 동그란 원(스테이지)이 배경을 가리고,
// 메뉴가 별자리처럼 떠 있다: 별 + 「01 · logged / 이름 / 부제」, 별끼리 가는 선으로 이어진다. 별을 누르면 팝업(또는 이동).
// 메뉴 항목 = 메인에 둔 「팝업 버튼」 위젯들(번호 순). 하나도 없으면 사이트 메뉴(상위 항목)를 쓴다.
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMainStore, WidgetConf } from '@/lib/mainStore';
import { useMenuSettings, buildMenu, boardEntries } from '@/lib/menuStore';
import { useBoards } from '@/lib/boardStore';
import { useSections, sectionMenuEntries } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/siteStore';
import { useFonts } from '@/lib/fontStore';
import { INTRO_RINGS } from '@/lib/introSky';
import { PopBtnCard, PopStar, playPianoNote } from '@/components/main/widgets';

interface Item { key: string; num: string; suffix: string; label: string; sub: string; color: string; conf: WidgetConf | null; href?: string; fontId?: string }

/** 별 자리 — 위아래로 지그재그 (영상의 별자리 배치를 세로 화면에 맞춘 것). x·y는 스테이지 폭·높이의 % */
function spots(n: number): [number, number][] {
  const xs = [14, 52, 20, 56, 16, 50, 24, 54, 18, 48];
  return Array.from({ length: n }, (_, i) => [xs[i % xs.length], n === 1 ? 50 : 12 + (76 * i) / (n - 1)]);
}

export function MobileStage() {
  const router = useRouter();
  const { state } = useMainStore();
  const { familyOf } = useFonts();
  const [site] = useSiteSettings();
  const [menuSet] = useMenuSettings();
  const { boards } = useBoards();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState<{ conf: WidgetConf; origin: { x: number; y: number } } | null>(null);

  const items: Item[] = useMemo(() => {
    const pops = state.widgets.filter(w => w.type === 'popbtn' && w.enabled && !w.mOff)
      .sort((a, b) => (parseInt(String(a.settings.num ?? 0)) || 0) - (parseInt(String(b.settings.num ?? 0)) || 0));
    if (pops.length) {
      return pops.map(w => {
        const s = w.settings as Record<string, string | undefined>;
        return { key: w.id, num: String(s.num ?? '1').padStart(2, '0'), suffix: s.numSuffix ?? 'logged', label: s.label ?? '', sub: s.sub ?? '',
          color: s.starColor ?? '#4a63d8', conf: w, href: w.settings.mode === 'link' ? String(s.target ?? '') : undefined, fontId: s.labelFontId ?? s.fontId };
      });
    }
    const menu = buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)], { loggedIn: !!user, isAdmin, id: user?.id });
    return menu.map((m, i) => ({
      key: m.label + i, num: String(i + 1).padStart(2, '0'), suffix: 'menu', label: m.label, sub: '', color: '#4a63d8',
      href: m.href,
      conf: m.children ? ({ id: 'ms' + i, type: 'popbtn', col: 1, enabled: true, tx: 0, ty: 0, settings: { mode: 'menu', label: m.label, heading: m.label, num: String(i + 1), hrefs: m.children.map(c => c.href), width: 520 } } as WidgetConf) : null,
    }));
  }, [state.widgets, menuSet, boards, secMap, links, user, isAdmin]);

  const pos = spots(items.length);
  const go = (it: Item, e: React.MouseEvent<HTMLButtonElement>) => {
    const s = (it.conf?.settings ?? {}) as { sound?: boolean; soundVol?: number; num?: string };
    if (s.sound) playPianoNote(s.num, s.soundVol ?? 60);
    if (it.href && (!it.conf || it.conf.settings.mode === 'link')) { if (/^https?:\/\//.test(it.href)) window.open(it.href, '_blank'); else router.push(it.href); return; }
    if (!it.conf) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOpen({ conf: it.conf, origin: { x: r.left + 14, y: r.top + 14 } });
  };

  return (
    <section className="ms-stage" aria-label="메뉴">
      <svg className="ms-rings" viewBox="-400 -400 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {INTRO_RINGS.map(c => <circle key={c.r} r={c.r * 1.2} className={c.cls} />)}
      </svg>
      <div className="ms-orb" aria-hidden="true" />
      <svg className="ms-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {pos.slice(1).map(([x, y], i) => <line key={i} x1={pos[i][0]} y1={pos[i][1]} x2={x} y2={y} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="ms-head"><b>{site.title}</b><span>{site.subtitle}</span></div>
      {items.map((it, i) => (
        <button type="button" key={it.key} className="ms-item" style={{ left: `${pos[i][0]}%`, top: `${pos[i][1]}%`, animationDelay: `${i * 0.08}s` }} onClick={e => go(it, e)}>
          <PopStar color={it.color} />
          <span className="ms-txt">
            <span className="ms-num">{it.num}{it.suffix ? ` · ${it.suffix}` : ''}</span>
            <span className="ms-lb" style={it.fontId && it.fontId !== 'default' ? { fontFamily: familyOf(it.fontId), fontStyle: 'normal' } : undefined}>{it.label}</span>
            {it.sub && <span className="ms-sub">{it.sub}</span>}
          </span>
        </button>
      ))}
      {items.length === 0 && <p className="ms-empty">표시할 메뉴가 없습니다</p>}
      {open && <PopBtnCard conf={open.conf} origin={open.origin} onClose={() => setOpen(null)} />}
    </section>
  );
}
