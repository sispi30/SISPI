'use client';
// 크리스탈 별 — 메인 화면 한가운데에 놓인 8갈래 수정 별. 마우스(손가락)를 따라 부드럽게 기울고 돈다.
// 환경설정 > 디자인에서 켜고 끄고 크기를 정한다. 위젯 위에 떠 있지만 마우스 클릭은 통과시킨다(pointer-events:none).
import React, { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from '@/lib/siteStore';
import { useMainStore } from '@/lib/mainStore';

const LONG = 200, SHORT = 138, RIN = 30;
type P = [number, number];
const at = (deg: number, r: number): P => { const a = deg * Math.PI / 180; return [+(Math.sin(a) * r).toFixed(1), +(-Math.cos(a) * r).toFixed(1)]; };

export function CrystalStar() {
  const [site, , loaded] = useSiteSettings();
  const path = usePathname();
  const { editOn } = useMainStore();
  const box = useRef<HTMLDivElement>(null);
  const st = useRef({ tx: 0, ty: 0, cx: 0, cy: 0 });
  const on = loaded && site.crystalStar !== false && path === '/' && !editOn;   // 위젯을 옮기는 편집모드에서는 숨김

  // 8갈래 — 가는 가지마다 왼쪽·오른쪽 두 면 (면마다 다른 빛깔의 그라데이션)
  const { facets, outline } = useMemo(() => {
    const facets: { d: string; f: string }[] = [];
    const outline: P[] = [];
    for (let k = 0; k < 8; k++) {
      const tip = at(k * 45, k % 2 === 0 ? LONG : SHORT);
      const nl = at(k * 45 - 22.5, RIN), nr = at(k * 45 + 22.5, RIN);
      const fl = k % 2 === 0 ? ['gA', 'gB'] : ['gD', 'gC'];
      facets.push({ d: `M${tip} L${nl} L0 0Z`, f: fl[0] });
      facets.push({ d: `M${tip} L${nr} L0 0Z`, f: fl[1] });
      outline.push(nl, tip);
    }
    return { facets, outline };
  }, []);

  useEffect(() => {
    if (!on) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const s = st.current;
    const mv = (e: PointerEvent) => {
      s.tx = (e.clientX / innerWidth - 0.5) * 2;   // -1 ~ 1
      s.ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', mv, { passive: true });
    let id = 0;
    const loop = () => {
      if (!reduce) {
        const dx = s.tx - s.cx, dy = s.ty - s.cy;
        if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
          s.cx += dx * 0.07; s.cy += dy * 0.07;
          const el = box.current;
          if (el) {
            el.style.transform = `perspective(1100px) rotateY(${(s.cx * 62).toFixed(2)}deg) rotateX(${(-s.cy * 44).toFixed(2)}deg) rotateZ(${(s.cx * 10).toFixed(2)}deg)`;
            el.style.setProperty('--sx', `${50 + s.cx * 40}%`);
            el.style.setProperty('--sy', `${50 + s.cy * 40}%`);
          }
        }
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => { window.removeEventListener('pointermove', mv); cancelAnimationFrame(id); };
  }, [on]);

  if (!on) return null;
  const size = Math.max(30, Math.min(160, site.crystalSize ?? 100)) / 100;
  const clip = `polygon(${outline.map(([x, y]) => `${(50 + x / (LONG * 2) * 100).toFixed(2)}% ${(50 + y / (LONG * 2) * 100).toFixed(2)}%`).join(',')})`;
  return (
    <div className="crystal-star" aria-hidden="true" style={{ ['--cs' as string]: `min(${size * 62}vh, ${size * 560}px)` } as React.CSSProperties}>
      <div className="cs-halo" />
      <div className="cs-body" ref={box}>
        <svg viewBox={`${-LONG} ${-LONG} ${LONG * 2} ${LONG * 2}`}>
          <defs>
            <linearGradient id="gA" gradientUnits="userSpaceOnUse" x1="-90" y1="-200" x2="60" y2="40"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#dcecff" /><stop offset="1" stopColor="#8fb8ee" /></linearGradient>
            <linearGradient id="gB" gradientUnits="userSpaceOnUse" x1="120" y1="-190" x2="-40" y2="30"><stop offset="0" stopColor="#a9cdf6" /><stop offset=".6" stopColor="#4f86d6" /><stop offset="1" stopColor="#1d3f86" /></linearGradient>
            <linearGradient id="gC" gradientUnits="userSpaceOnUse" x1="-80" y1="160" x2="80" y2="-60"><stop offset="0" stopColor="#0d2a66" /><stop offset=".55" stopColor="#3c78d0" /><stop offset="1" stopColor="#c7e0ff" /></linearGradient>
            <linearGradient id="gD" gradientUnits="userSpaceOnUse" x1="150" y1="-120" x2="-60" y2="80"><stop offset="0" stopColor="#fff3d6" /><stop offset=".5" stopColor="#bcdcff" /><stop offset="1" stopColor="#3a6fc4" /></linearGradient>
            <radialGradient id="gCore"><stop offset="0" stopColor="#fff" /><stop offset=".35" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#bfe0ff" stopOpacity="0" /></radialGradient>
          </defs>
          {facets.map((f, i) => <path key={i} d={f.d} fill={`url(#${f.f})`} stroke="rgba(255,255,255,.8)" strokeWidth=".7" strokeLinejoin="round" />)}
          <circle r="34" fill="url(#gCore)" />
        </svg>
        <div className="cs-sheen" style={{ clipPath: clip }} />
      </div>
    </div>
  );
}
