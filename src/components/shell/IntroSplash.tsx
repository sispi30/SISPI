'use client';
// 인트로 화면 — 처음 들어올 때 어두운 화면에 큰 글자·희미한 그림·가운데 위 메뉴가 떠 있고,
// 숫자가 100까지 차오르면 「CLICK TO ENTER」. 화면을 클릭해야(또는 Enter·스페이스) 메인 페이지로 넘어간다.
// 위쪽 메뉴를 누르면 입장하면서 그 메뉴로 바로 간다. 한 탭에서 한 번만 뜬다. 마우스 반짝임은 사이트 효과 그대로 위에 나온다.
// 바탕(색·그라데이션·그림)·글씨 색은 환경설정 > 디자인 > 인트로 화면에서 바꾼다. 장식(큰 글자·메뉴)은 그대로.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useMenuSettings, buildMenu } from '@/lib/menuStore';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 2400;

export function IntroSplash() {
  const router = useRouter();
  const [site, , loaded] = useSiteSettings();
  const [menuSet, , menuLoaded] = useMenuSettings();
  const [phase, setPhase] = useState<'load' | 'ready' | 'out' | 'gone'>('load');
  const [pct, setPct] = useState(0);
  const raf = useRef(0);
  const img = useBlobUrl(site.introImage);

  useEffect(() => {
    if (!loaded) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === '1'; } catch { /* 무시 */ }
    if (seen || site.introSplash === false) setPhase('gone');
  }, [loaded, site.introSplash]);

  useEffect(() => {
    if (phase !== 'load' || !loaded) return;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 500 : LOAD_MS;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setPct(Math.round((1 - Math.pow(1 - k, 1.8)) * 100));
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else setPhase('ready');
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, loaded]);

  const enter = useCallback((href?: string) => {
    if (phase !== 'ready') return;
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* 무시 */ }
    setPhase('out');
    if (href) router.push(href);
    setTimeout(() => setPhase('gone'), 1100);
  }, [phase, router]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, enter]);

  if (phase === 'gone') return null;

  // 위쪽 메뉴 — 사이트 메뉴의 위쪽 항목들 (각 항목의 첫 번째 주소로 간다)
  const items = (menuLoaded ? buildMenu(menuSet, [], { loggedIn: false, isAdmin: false }) : [])
    .map(m => ({ label: m.label, href: m.href ?? m.children?.[0]?.href }))
    .filter((m): m is { label: string; href: string } => !!m.href)
    .slice(0, 4);

  const bg1 = site.introBg ?? '#06070a';
  const bgc = site.introBg2 ? `linear-gradient(180deg,${bg1},${site.introBg2})` : bg1;
  const vars = {
    ['--is-bgc' as string]: bgc,
    ...(site.introDot ? { ['--is-dot' as string]: site.introDot } : {}),
    ...(site.introFg ? { ['--is-fg' as string]: site.introFg } : {}),
    ['--is-op' as string]: (site.introImageOp ?? 14) / 100,
  } as React.CSSProperties;
  const ready = phase === 'ready' || phase === 'out';
  const title = site.title || 'HOME';
  return (
    <div className={`intro-splash ${phase}`} style={vars} onClick={() => enter()} role="dialog" aria-label="인트로">
      {img && <div className="is-art" style={{ backgroundImage: `url("${img}")` }} />}
      <div className="is-ghost" aria-hidden="true">{title.toUpperCase()}</div>
      <nav className="is-nav" onClick={e => e.stopPropagation()}>
        {items.map((m, i) => (
          <React.Fragment key={m.href + i}>
            {i === 2 && <span className="sl">/</span>}
            <button type="button" className={i < 2 ? 'main' : ''} disabled={!ready} onClick={() => enter(m.href)}>
              {i >= 2 && '‹ '}{m.label}{i < 2 && <sup>{String(i + 1).padStart(2, '0')}</sup>}
            </button>
          </React.Fragment>
        ))}
      </nav>
      <div className="is-foot">
        {ready ? <span className="blink">CLICK TO ENTER</span> : <span>LOADING {String(pct).padStart(3, '0')}</span>}
      </div>
    </div>
  );
}
