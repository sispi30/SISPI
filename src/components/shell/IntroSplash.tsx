'use client';
// 인트로 화면 — 처음 들어올 때: 점무늬 바탕의 짧은 LOADING → 큰 제목 화면에서 글자 속 캡슐(없으면 원)이 퍼센트만큼 차오르고
// 하단 버튼이 LOADING n → ENTER 로 바뀐다. 누르면 화면이 위로 걷히며 입장한다.
// 한 탭에서 한 번만 뜬다(새 탭·새 접속에서만). 환경설정 > 디자인 > 로고에서 끌 수 있다. 색은 사이트 포인트색을 따른다.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSiteSettings } from '@/lib/siteStore';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 2600;
const PRE_MS = 700;

/** 제목에서 캡슐로 바꿀 글자(I) — 없으면 첫 O를 원으로 */
function splitTitle(t: string) {
  const up = t.toUpperCase();
  let i = up.search(/I/);
  let kind: 'cap' | 'ring' = 'cap';
  if (i < 0) { i = up.search(/O/); kind = 'ring'; }
  if (i < 0) return { a: up, b: '', kind: null as null };
  return { a: up.slice(0, i), b: up.slice(i + 1), kind };
}

export function IntroSplash() {
  const [site, , loaded] = useSiteSettings();
  const [phase, setPhase] = useState<'pre' | 'load' | 'ready' | 'out' | 'gone'>('pre');
  const [pct, setPct] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!loaded) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === '1'; } catch { /* 무시 */ }
    if (seen || site.introSplash === false) { setPhase('gone'); return; }
    const t = setTimeout(() => setPhase(p => (p === 'pre' ? 'load' : p)), PRE_MS);
    return () => clearTimeout(t);
  }, [loaded, site.introSplash]);

  useEffect(() => {
    if (phase !== 'load') return;
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
  }, [phase]);

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
  const title = site.title || 'HOME';
  const { a, b, kind } = splitTitle(title);
  const fill = <i style={{ height: `${pct}%` }} />;
  const sub = site.subtitle || 'PERSONAL ARCHIVE';
  const tick = `${sub} + ${title} + OPEN 24H + `.toUpperCase().repeat(8);
  const lit = Math.min(5, Math.floor(pct / 20));
  return (
    <div className={`intro-splash ${phase}`} onClick={enter} role="dialog" aria-label="인트로">
      <div className="is-pre"><span>LOADING</span></div>
      <div className="is-panel">
        <div className="is-nav">
          <div className="is-badge"><b>{title.toUpperCase()}</b><i>{sub.toUpperCase()}</i></div>
          <span>+ ARCHIVE</span><span>+ PROFILE</span><span>+ LOG</span>
        </div>
        <div className="is-dial">{title.replace(/[^A-Za-z0-9가-힣]/g, '').slice(0, 2).toUpperCase()}</div>
        <div className="is-title-wrap">
          <div className="is-title" aria-label={title}>
            {a}
            {kind === 'cap' && <span className="is-cap">{fill}</span>}
            {kind === 'ring' && <span className="is-ring">{fill}</span>}
            {b}
          </div>
        </div>
        <div className="is-band">
          <div><b>{title.toUpperCase()}</b><small>{sub}</small></div>
          <div className="r">{pct}%<small>OPEN 24H</small></div>
        </div>
        <div className="is-tick"><span>{tick}{tick}</span></div>
        <div className="is-dots">
          {[0, 1, 2, 3, 4].map(n => (
            <i key={n} style={{ ['--p' as string]: n < lit ? '100%' : n === lit ? `${((pct % 20) / 20) * 100}%` : '0%' } as React.CSSProperties} />
          ))}
          <span>{phase === 'load' || phase === 'pre' ? 'LOADING' : 'COMPLETE'}</span>
        </div>
        <button type="button" className="is-btn" style={{ ['--pw' as string]: `${pct}%` } as React.CSSProperties} tabIndex={phase === 'ready' ? 0 : -1}>
          <span>{phase === 'ready' || phase === 'out' ? 'ENTER' : `LOADING ${pct}`}</span><em>→</em>
        </button>
      </div>
    </div>
  );
}
