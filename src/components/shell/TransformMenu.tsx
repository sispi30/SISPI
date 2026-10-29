'use client';
// 트랜스폼 메뉴 위젯 (커스텀 요청) — 그누보드 「트랜스폼 메뉴 위젯」을 이 사이트 구조로 이식.
// 환경설정 > 메뉴 위젯에서 켜면 TopBar의 기존 메뉴 줄(gnb) 대신 이 컴포넌트가 그 자리에 쓰인다.
// · positionType 'static'  — 상단바 자리에 그대로, 배경/테두리는 상단바를 따름 (로고·로그인 버튼 없음)
// · positionType 'fixed'   — 화면에 고정된 독립 캡슐, 드래그로 옮길 수 있고 자체 배경/로고/로그인 버튼을 가짐
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { boardEntries, useMenuSettings, buildMenu, faClass } from '@/lib/menuStore';
import { useBoards } from '@/lib/boardStore';
import { useSections, sectionMenuEntries } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { useAuth } from '@/lib/auth';
import { useMainStore } from '@/lib/mainStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useFonts, deVarFamily } from '@/lib/fontStore';
import { refreshPage } from '@/lib/pageRefresh';
import {
  loadTfPosition, saveTfPosition, useTransformMenuSettings, TransformMenuSettings, tfEnglishLabel,
} from '@/lib/transformMenuStore';

/** 고정 위치일 때 anchor 기준 초기 좌표 — 드래그로 한 번이라도 옮기면 이후엔 저장된 %가 대신 쓰인다 */
function anchoredStyle(cfg: TransformMenuSettings): React.CSSProperties {
  const style: React.CSSProperties = { position: 'fixed' };
  style.left = cfg.anchorX === 'right' ? `calc(100vw - ${cfg.posX}vw)` : `${cfg.posX}vw`;
  style.top = cfg.anchorY === 'bottom' ? `calc(100vh - ${cfg.posY}vh)` : `${cfg.posY}vh`;
  const tx = cfg.anchorX === 'right' ? '-100%' : cfg.anchorX === 'center' ? '-50%' : '0';
  const ty = cfg.anchorY === 'bottom' ? '-100%' : cfg.anchorY === 'center' ? '-50%' : '0';
  style.transform = `translate(${tx}, ${ty})`;
  return style;
}

export function TransformMenu() {
  const [cfg, , loaded] = useTransformMenuSettings();
  const { user, isAdmin } = useAuth();
  const { guardNav } = useMainStore();
  const router = useRouter();
  const pathname = usePathname();

  // TopBar와 동일한 방식으로 메뉴 트리 구성 (5.2 — 메뉴 관리 설정을 그대로 따른다)
  const [menuSet, , menuLoaded] = useMenuSettings();
  const { boards, loaded: boardsLoaded } = useBoards();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  const ready = menuLoaded && boardsLoaded;
  const menu = ready
    ? buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)], { loggedIn: !!user, isAdmin })
    : [];

  const logoUrl = useBlobUrl(cfg.logoBlobId);

  const nav = (href: string) => {
    if (guardNav(href)) return;
    const cur = pathname + window.location.search;
    if (href === cur) { refreshPage(); return; }
    router.push(href);
  };

  // ---------- 드래그(fixed 모드 전용) ----------
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  useEffect(() => {
    if (cfg.positionType === 'fixed' && cfg.draggable && cfg.savePosition) {
      setPos(loadTfPosition());
    } else {
      setPos(null);
    }
  }, [cfg.positionType, cfg.draggable, cfg.savePosition]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cfg.draggable) return;
    const el = wrapRef.current;
    if (!el) return;
    dragging.current = true;
    setIsDragging(true);
    const r = el.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const el = wrapRef.current;
    if (!el) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const xPct = Math.max(0, Math.min(95, ((start.current.left + dx) / window.innerWidth) * 100));
    const yPct = Math.max(0, Math.min(95, ((start.current.top + dy) / window.innerHeight) * 100));
    el.style.left = `${xPct}%`;
    el.style.top = `${yPct}%`;
    el.style.transform = 'none';
    lastPos.current = { x: xPct, y: yPct };
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (lastPos.current) {
      setPos(lastPos.current);
      if (cfg.savePosition) saveTfPosition(lastPos.current.x, lastPos.current.y);
    }
  };

  // 위젯이 화면 아래쪽에 있으면 서브메뉴를 위로 펼침 (커스텀 요청) — 실제 렌더된 위치를 재서 판단하므로
  // 앵커·드래그 어느 쪽으로 옮겨져 있어도, 화면 크기가 바뀌어도 항상 맞게 따라간다.
  const [openUp, setOpenUp] = useState(false);
  useEffect(() => {
    if (cfg.positionType !== 'fixed') return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setOpenUp(r.top > window.innerHeight / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.positionType, cfg.anchorX, cfg.anchorY, cfg.posX, cfg.posY, cfg.direction, cfg.gap, pos, menu.length]);

  const fxUid = useId();   // 조기 반환보다 앞에 — 훅 순서가 바뀌지 않게
  if (!loaded || !cfg.enabled) return null;

  // 하위 메뉴 열림 상태 — 순수 CSS :hover는 버튼→서브메뉴 사이 틈을 지날 때 hover가 끊겨
  // 깜빡이며 사라지는 문제가 있어, JS로 직접 열고 살짝의 유예 시간을 두고 닫는다.
  const openSub = (label: string) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setOpenGroup(label);
  };
  const scheduleCloseSub = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenGroup(null), 180);
  };

  // 상위 메뉴 사이 구분선 (커스텀 요청 — none/line/dot)
  const withDividers = (nodes: React.ReactNode[]): React.ReactNode[] => {
    if (cfg.dividerStyle === 'none') return nodes;
    const out: React.ReactNode[] = [];
    nodes.forEach((n, i) => {
      if (i > 0) {
        out.push(
          <span key={`tf-div-${i}`} aria-hidden className={`tf-divider-${cfg.dividerStyle}`}
            style={{ color: cfg.dividerColor || 'var(--line)' }} />,
        );
      }
      out.push(n);
    });
    return out;
  };

  // 아이콘 (커스텀 요청) — 메뉴 관리에서 항목별로 지정한 Font Awesome 아이콘을 이 위젯에 표시할지.
  // text: 기존과 동일(글자만) · icon-text: 아이콘+글자 · icon: 아이콘만(아이콘이 없는 항목은 글자로 대체)
  const lineMode = cfg.iconMode === 'line';
  const showTopIcon = cfg.iconMode === 'icon-text' || cfg.iconMode === 'icon';
  const topIconOnly = cfg.iconMode === 'icon';
  // 라인 방식 — 영문 라벨(작게) 위, 한글 이름 아래. 현재 위치 항목은 가로선 위에 마커가 뜬다
  const pathOnly = (h?: string) => (h ?? '').split('?')[0];
  const isOn = (item: { href?: string; children?: { href: string }[] }) =>
    item.href ? pathOnly(item.href) === pathname : !!item.children?.some(c => pathOnly(c.href) === pathname);
  const topLabel = (icon: string | undefined, label: string, en?: string) => {
    if (lineMode) return <><small className="tf-en">{en || '\u00a0'}</small><span>{label}</span></>;
    const c = showTopIcon ? faClass(icon) : null;
    return (
      <>
        {c && <i className={c} aria-hidden style={{ marginRight: topIconOnly ? 0 : 6 }} />}
        {(!topIconOnly || !c) && <span>{label}</span>}
      </>
    );
  };
  // 서브메뉴(드롭다운)는 공간이 넉넉하므로 아이콘이 있으면 항상 아이콘+글자로 표시
  const subMode = cfg.subIconMode ?? 'icon-text';
  const subLabel = (icon: string | undefined, label: string) => {
    const c = subMode === 'text' ? null : faClass(icon);
    if (subMode === 'icon' && c) return <i className={c} aria-hidden />;
    return <>{c && <i className={c} aria-hidden style={{ marginRight: 6 }} />}<span>{label}</span></>;
  };

  const menuNodes = menu.map(item => (
    item.children ? (
      <div className={`tf-grp${openGroup === item.label ? ' open' : ''}`} key={item.label}
        onMouseEnter={() => openSub(item.label)} onMouseLeave={scheduleCloseSub}>
        <button className={lineMode ? `tf-ln${isOn(item) ? ' on' : ''}` : undefined} onClick={() => nav(item.children![0].href)} title={topIconOnly ? item.label : undefined}>
          {topLabel(item.icon, item.label, tfEnglishLabel(item, cfg.lineEn))}
        </button>
        <div className="tf-sub" onMouseEnter={() => openSub(item.label)} onMouseLeave={scheduleCloseSub}>
          {item.children.map(c => (
            <button key={c.href} onClick={() => nav(c.href)} title={subMode === 'icon' ? c.label : undefined}>{subLabel(c.icon, c.label)}</button>
          ))}
        </div>
      </div>
    ) : (
      <button key={item.label} className={lineMode ? `tf-ln${isOn(item) ? ' on' : ''}` : (pathname === item.href ? 'on' : '')} onClick={() => nav(item.href!)}
        title={topIconOnly ? item.label : undefined}>
        {topLabel(item.icon, item.label, tfEnglishLabel(item, cfg.lineEn))}
      </button>
    )
  ));

  const { familyOf } = useFonts();
  const menuFam = cfg.menuFontId ? familyOf(cfg.menuFontId) : undefined;
  const enFam = cfg.lineFontId ? familyOf(cfg.lineFontId) : undefined;
  const fxRaw = Math.min(200, Math.max(0, cfg.itemShadow));
  const fxOl = Math.max(0, cfg.itemOutlineWidth);
  const hasFx = fxRaw > 0 || fxOl > 0;
  const fxId = 'tf-fx-' + fxUid.replace(/[^a-zA-Z0-9_-]/g, '');
  const fxNode = hasFx ? (
    <ItemFx id={fxId} outline={fxOl} outlineColor={cfg.itemOutlineColor || 'var(--accent)'}
      glow={fxRaw} glowSize={cfg.itemShadowSize ?? 6} glowColor={cfg.itemShadowColor || '#000000'} />
  ) : null;
  const fontVars: React.CSSProperties = {
    ...(menuFam ? { ['--tf-font' as string]: deVarFamily(menuFam) } : {}),
    ...(enFam ? { ['--tf-en-font' as string]: deVarFamily(enFam) } : {}),
    ...(cfg.menuFontWeight ? { ['--tf-fw' as string]: String(cfg.menuFontWeight) } : {}),
    ['--tf-menu-fs' as string]: `${+(cfg.menuFontSize * (cfg.menuFontScale ?? 100) / 100).toFixed(2)}px`,
    ['--tf-menu-fg' as string]: cfg.menuFontColor || 'var(--top-fg)',
    ['--tf-menu-hv' as string]: cfg.menuHoverColor || 'var(--top-hv)',
    ['--tf-menu-ls' as string]: `${cfg.menuLetterSpacing}px`,
    ['--tf-sub-fs' as string]: `${+(cfg.subFontSize * (cfg.menuFontScale ?? 100) / 100).toFixed(2)}px`,
    ['--tf-sub-align' as string]: cfg.subAlign ?? 'left',
    ['--tf-sub-fg' as string]: cfg.subFontColor || 'var(--dd-fg)',
    ['--tf-sub-hv' as string]: cfg.subHoverColor || 'var(--accent)',
    ['--tf-sub-hvbg' as string]: cfg.subHoverBg || 'var(--dd-hv)',
    ['--tf-sub-bg' as string]: cfg.subBgColor || 'var(--dd-bg)',
    ['--tf-sub-radius' as string]: `${cfg.subBorderRadius}px`,
    ['--tf-sub-shadow' as string]: cfg.subShadow ? 'var(--sh-dd)' : 'none',
    // 항목 외곽선 — 아이콘·글자 자체에 두르는 윤곽선. 글자 윤곽선(text-stroke)은 선의 절반이 글자 안쪽을 먹으므로,
    // 선을 글자 뒤에 깔고(paint-order) 두께를 두 배로 그려서 바깥으로 보이는 두께가 설정값과 같게 한다.
    // 윤곽선·외부 광선은 SVG 필터로 그린다 (아래 <ItemFx/>) — text-stroke는 모서리가 뾰족하고, 겹쳐 찍은 그림자는 작은 글씨에서 자글거렸다.
    // 글자를 흐린 뒤 문턱값으로 잘라 내면 어느 방향으로든 같은 거리만큼 부드럽게 둥근 윤곽이 생긴다.
    ['--tf-item-ol' as string]: '0px',
    ['--tf-item-olc' as string]: cfg.itemOutlineColor || 'var(--accent)',
    ['--tf-item-sh' as string]: '0 0 0 transparent',
    ['--tf-item-filter' as string]: hasFx ? `url(#${fxId})` : 'none',
  };

  // ---------- static: 상단바 자리에 그대로 (배경/로고/로그인은 상단바가 담당) ----------
  if (cfg.positionType === 'static') {
    return (
      <nav
        className={`gnb tf-static${lineMode ? ' tf-line' : ''}${cfg.menuFontWeight ? ' tf-fw' : ''}`}
        style={{
          ...fontVars,
          display: 'flex', flexDirection: cfg.direction, justifyContent: cfg.justify,
          alignItems: cfg.align, flexWrap: 'wrap', gap: cfg.gap,
        }}
      >
        {fxNode}
        {withDividers(menuNodes)}
      </nav>
    );
  }

  // ---------- fixed: 독립적인 플로팅 캡슐 (드래그 가능) ----------
  if (typeof document === 'undefined') return null;

  const positionStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'none' }
    : anchoredStyle(cfg);

  const bg = cfg.bgTransparent ? 'transparent' : (cfg.bgColor || 'var(--top-bg)');

  return createPortal(
    <div
      ref={wrapRef}
      className={`tf-fixed ${isDragging ? 'is-dragging' : ''} ${openUp ? 'tf-up' : ''}`}
      style={{
        ...positionStyle,
        background: bg,
        backdropFilter: cfg.bgTransparent ? undefined : 'blur(12px)',
        border: cfg.borderWidth ? `${cfg.borderWidth}px solid ${cfg.borderColor || 'var(--line-dark)'}` : 'none',
        borderRadius: cfg.borderRadius,
        padding: cfg.padding,
        boxShadow: cfg.bgShadow ? 'var(--sh-md)' : 'none',
        // 외곽선 효과 — 테두리 바깥으로 3px 띄운 선. 둥근 모서리를 그대로 따라간다
        outline: cfg.outlineWidth > 0 ? `${cfg.outlineWidth}px solid ${cfg.outlineColor || 'var(--accent)'}` : 'none',
        outlineOffset: 3,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {cfg.draggable && (
        <span className="tf-drag" onPointerDown={onPointerDown} title="드래그로 위치 이동">⋮⋮</span>
      )}
      {cfg.showLogo && logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="tf-logo" src={logoUrl} alt="" style={{ width: cfg.logoWidth }} onClick={() => nav('/')} />
      )}
      <div
        className={`tf-items${lineMode ? ' tf-line' : ''}${cfg.menuFontWeight ? ' tf-fw' : ''}`}
        style={{
          ...fontVars,
          display: 'flex', flexDirection: cfg.direction, justifyContent: cfg.justify,
          alignItems: cfg.align, flexWrap: 'wrap', gap: cfg.gap,
        }}
      >
        {fxNode}
        {withDividers(menuNodes)}
      </div>
      {cfg.showLoginBtn && !user && (
        <button className="tf-login" onClick={() => nav('/login')}>로그인</button>
      )}
      {cfg.showAdminBtn && isAdmin && (
        <button className="tf-admin" onClick={() => nav('/settings')} title="환경설정">⚙</button>
      )}
    </div>,
    document.body,
  );
}


/** 항목 윤곽선 + 외부 광선(표준 혼합) 필터 — 글자(아이콘)에만 걸린다.
 *  윤곽선: 글자 모양(알파)을 흐린 뒤 문턱값으로 잘라 바깥으로 부풀리면 모서리가 둥글고 자글거림 없는 윤곽이 된다.
 *  외부 광선: 알파를 흐려 색을 입히고, 세기만큼 곱해 짙게 한다. */
function ItemFx({ id, outline, outlineColor, glow, glowSize, glowColor }: {
  id: string; outline: number; outlineColor: string; glow: number; glowSize: number; glowColor: string;
}) {
  const T = 0.08;   // 문턱 — 가장자리에서 흐림 폭(σ)만큼 떨어진 지점 (1-Φ(1.4)≈0.08)
  const K = 16;     // 가장자리 부드러움(기울기)
  const olSigma = Math.max(0.3, outline / 1.4);
  const alpha = 0.3 + Math.min(glow, 100) / 100 * 0.7;
  const n = 1 + Math.min(5, Math.floor(glow / 35));
  const gSigma = Math.max(0.3, glowSize / 2);
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
      <filter id={id} x="-80%" y="-200%" width="260%" height="500%" colorInterpolationFilters="sRGB">
        {glow > 0 && <>
          <feGaussianBlur in="SourceAlpha" stdDeviation={gSigma} result="gb" />
          <feComponentTransfer in="gb" result="ga"><feFuncA type="linear" slope={alpha * n} /></feComponentTransfer>
          <feFlood style={{ floodColor: glowColor }} />
          <feComposite in2="ga" operator="in" result="gl" />
        </>}
        {glow > 100 && <>
          <feGaussianBlur in="SourceAlpha" stdDeviation={0.9} result="tb" />
          <feComponentTransfer in="tb" result="ta"><feFuncA type="linear" slope={K} intercept={-K * T} /></feComponentTransfer>
          <feFlood style={{ floodColor: glowColor }} />
          <feComposite in2="ta" operator="in" result="tg" />
        </>}
        {outline > 0 && <>
          <feGaussianBlur in="SourceAlpha" stdDeviation={olSigma} result="ob" />
          <feComponentTransfer in="ob" result="oa"><feFuncA type="linear" slope={K} intercept={-K * T} /></feComponentTransfer>
          <feFlood style={{ floodColor: outlineColor }} />
          <feComposite in2="oa" operator="in" result="ol" />
        </>}
        <feMerge>
          {glow > 0 && <feMergeNode in="gl" />}
          {glow > 100 && <feMergeNode in="tg" />}
          {outline > 0 && <feMergeNode in="ol" />}
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}
