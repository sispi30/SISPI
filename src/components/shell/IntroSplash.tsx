'use client';
// 인트로 화면 — 처음 들어올 때: 점무늬 바탕에 별·물체 장식, 작은 LOADING 숫자가 100까지 차오르면 「CLICK TO ENTER」.
// 클릭(또는 Enter·스페이스)해야 화면이 위로 걷히며 메인 페이지가 나온다. 한 탭에서 한 번만 뜬다.
// 바탕(색·그라데이션·이미지)·점무늬 색·글씨 색은 환경설정 > 디자인 > 인트로 화면에서 정한다. 장식은 그대로.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 2400;

const DIAS: { s: number; x: string; y: string; d: string }[] = [
  { s: 104, x: '1.5%', y: '8%', d: '.2s' },
  { s: 84, x: '96%', y: '44%', d: '.5s' },
  { s: 96, x: '76%', y: '80%', d: '.35s' },
  { s: 56, x: '14%', y: '74%', d: '.7s' },
];
const STARS: { x: string; y: string; d: string }[] = [
  { x: '38%', y: '70%', d: '0s' }, { x: '62%', y: '30%', d: '.8s' }, { x: '24%', y: '26%', d: '1.4s' },
  { x: '88%', y: '18%', d: '.4s' }, { x: '52%', y: '88%', d: '1.1s' },
];

export function IntroSplash() {
  const [site, , loaded] = useSiteSettings();
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

  const enter = useCallback(() => {
    if (phase !== 'ready') return;
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* 무시 */ }
    setPhase('out');
    setTimeout(() => setPhase('gone'), 1300);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, enter]);

  if (phase === 'gone') return null;
  const bg1 = site.introBg ?? '#f3f6f6';
  const bgc = site.introBg2 ? `linear-gradient(180deg,${bg1},${site.introBg2})` : bg1;
  const vars = {
    ['--is-bgc' as string]: bgc,
    ...(site.introDot ? { ['--is-dot' as string]: site.introDot } : {}),
    ...(site.introFg ? { ['--is-fg' as string]: site.introFg } : {}),
  } as React.CSSProperties;
  const ready = phase === 'ready' || phase === 'out';
  return (
    <div className={`intro-splash ${phase}`} style={vars} onClick={enter} role="dialog" aria-label="인트로">
      {img && <div className="is-bgimg" style={{ backgroundImage: `url("${img}")` }} />}
      <div className="is-dots" />
      <div className="is-cloud" />
      {DIAS.map((d, i) => <i key={i} className="is-dia" style={{ left: d.x, top: d.y, ['--s' as string]: `${d.s}px`, ['--d' as string]: d.d } as React.CSSProperties} />)}
      <div className="is-obj"><i /><i /><i /><i /></div>
      {STARS.map((t, i) => <i key={i} className="is-star" style={{ left: t.x, top: t.y, ['--d' as string]: t.d } as React.CSSProperties} />)}
      <div className="is-center">
        <div className="is-load">{ready ? 'CLICK TO ENTER' : 'LOADING…'}</div>
        <div className="is-oval" />
        <div className="is-pill"><i>{ready ? '→' : '·'}</i><span>{ready ? 'ENTER' : pct}</span></div>
        <div className="is-name">{site.title}</div>
      </div>
    </div>
  );
}
