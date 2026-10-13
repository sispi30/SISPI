'use client';
// 인트로 화면 — 처음 들어올 때 로딩이 차오른 뒤 「ENTER」를 눌러 입장한다.
// 한 번 입장하면 같은 탭에서는 다시 뜨지 않는다(새 탭·새 세션에서만). 환경설정 > 디자인 > 로고에서 끌 수 있다.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSiteSettings } from '@/lib/siteStore';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 2200;

export function IntroSplash() {
  const [site, , loaded] = useSiteSettings();
  const [phase, setPhase] = useState<'load' | 'ready' | 'out' | 'gone'>('load');
  const [pct, setPct] = useState(0);
  const raf = useRef(0);

  // 이미 입장했거나 꺼 둔 경우는 곧바로 치운다 — 설정을 읽기 전에는 가림막으로 첫 화면이 비치지 않게 유지
  useEffect(() => {
    if (!loaded) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === '1'; } catch { /* 무시 */ }
    if (seen || site.introSplash === false) setPhase('gone');
  }, [loaded, site.introSplash]);

  // 퍼센트 — 처음엔 빠르고 끝에서 느려지는 곡선
  useEffect(() => {
    if (phase !== 'load') return;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 400 : LOAD_MS;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setPct(Math.round((1 - Math.pow(1 - k, 2.2)) * 100));
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else setPhase('ready');
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase === 'load' && loaded]);   // eslint-disable-line react-hooks/exhaustive-deps

  const enter = useCallback(() => {
    if (phase !== 'ready') return;
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* 무시 */ }
    setPhase('out');
    setTimeout(() => setPhase('gone'), 800);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, enter]);

  if (phase === 'gone') return null;
  return (
    <div className={`intro-splash ${phase}`} onClick={enter} role="dialog" aria-label="인트로">
      <i className="is-fr tl" /><i className="is-fr tr" /><i className="is-fr bl" /><i className="is-fr br" />
      <div className="is-top"><span>{site.subtitle || 'PERSONAL ARCHIVE'}</span><span>{String(pct).padStart(3, '0')} / 100</span></div>
      <div className="is-mid">
        <h1 className="is-title">{site.title}</h1>
        <div className="is-bar"><b style={{ width: `${pct}%` }} /></div>
        <button type="button" className="is-enter" tabIndex={phase === 'ready' ? 0 : -1}>
          {phase === 'ready' || phase === 'out' ? 'ENTER' : 'LOADING'}
        </button>
      </div>
      <div className="is-bot"><span>CLICK OR PRESS ENTER</span><span>{new Date().getFullYear()}</span></div>
    </div>
  );
}
