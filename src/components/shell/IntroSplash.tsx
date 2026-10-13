'use client';
// 인트로 화면 — 처음 들어올 때: 어두운 보안 단말 느낌의 로딩 화면.
// 왼쪽에 큰 제목 3줄(마지막 줄은 윤곽선 + 로딩 따라 포인트색이 차오름), 퍼센트 숫자와 가는 막대, 위쪽·아래쪽 작은 상태 글씨,
// 오른쪽에는 올려 둔 그림. 100%가 되면 「ACCESS GRANTED」가 뜨고, 화면을 클릭(또는 Enter·스페이스)해야 글리치처럼 깜빡이며 메인 페이지로 넘어간다.
// 위쪽 가운데 메뉴를 누르면 입장하면서 그 메뉴로 바로 간다. 한 탭에서 한 번만 뜬다.
// 환경설정 > 디자인 > 인트로 화면에서 바탕·그림·포인트색·제목 색·글귀를 바꾼다. 장식(격자·상태 글씨·모서리 표식 등)은 그대로.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useMenuSettings, buildMenu } from '@/lib/menuStore';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 3000;

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
      // 중간에 잠깐 멈칫하는 곡선 — 단말이 인증하는 느낌
      const e = k < 0.5 ? 0.9 * k * k * 2 : 0.45 + (k - 0.5) * 1.1;
      setPct(Math.min(100, Math.round(e * 100)));
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else { setPct(100); setPhase('ready'); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, loaded]);

  const enter = useCallback((href?: string) => {
    if (phase !== 'ready') return;
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* 무시 */ }
    setPhase('out');
    if (href) router.push(href);
    setTimeout(() => setPhase('gone'), 950);
  }, [phase, router]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, enter]);

  if (phase === 'gone') return null;

  const items = (menuLoaded ? buildMenu(menuSet, [], { loggedIn: false, isAdmin: false }) : [])
    .map(m => ({ label: m.label, href: m.href ?? m.children?.[0]?.href }))
    .filter((m): m is { label: string; href: string } => !!m.href)
    .slice(0, 3);

  const title = (site.title || 'HOME').toUpperCase();
  const sub = (site.subtitle || 'PERSONAL ARCHIVE').toUpperCase();
  const t1 = (site.introT1?.trim() || title);
  const t2 = (site.introT2?.trim() || 'ARCHIVE');
  const t3 = (site.introT3?.trim() || 'LOGIN');
  const kick = site.introKick?.trim() || `${sub} · MEMBER · FILE`;
  const subline = site.introSub?.trim() || `${title} / ${sub}`;
  const ready = phase === 'ready' || phase === 'out';
  const bg1 = site.introBg ?? '#07080b';
  const bgc = site.introBg2 ? `linear-gradient(180deg,${bg1},${site.introBg2})` : bg1;
  const vars = {
    ['--is-bgc' as string]: bgc,
    ...(site.introDot ? { ['--is-ac' as string]: site.introDot } : {}),
    ...(site.introFg ? { ['--is-fg' as string]: site.introFg } : {}),
    ['--is-op' as string]: (site.introImageOp ?? 100) / 100,
    ['--is-p' as string]: `${pct}%`,
  } as React.CSSProperties;
  const log = [`BOOT ${title}.OS 4.1.7`, 'MOUNT /ARCHIVE/MAIN', 'HANDSHAKE ........ OK', `TRACE ${title}-2`, 'AWAIT CREDENTIAL'];
  const shown = Math.min(log.length, 1 + Math.floor(pct / 22));
  return (
    <div className={`intro-splash ${phase}`} style={vars} onClick={() => enter()} role="dialog" aria-label="인트로">
      <div className="is-grid" />
      {img && <div className="is-art" style={{ backgroundImage: `url("${img}")` }} />}
      <div className="is-vig" />
      <i className="is-diag" />
      <i className="is-cn tl" /><i className="is-cn tr" /><i className="is-cn bl" /><i className="is-cn br" />
      <div className="is-vert" aria-hidden="true">{title}</div>

      <nav className="is-nav" onClick={e => e.stopPropagation()}>
        {items.map((m, i) => (
          <React.Fragment key={m.href + i}>
            {i === 1 && <span className="sl">/</span>}
            <button type="button" disabled={!ready} onClick={() => enter(m.href)}>‹ {m.label}</button>
          </React.Fragment>
        ))}
      </nav>

      <div className="is-top">
        <div className="hd"><b>{title}</b><span>SYSTEM</span><em>SECURE CHANNEL — 07</em></div>
        <ul>{log.slice(0, shown).map((l, i) => <li key={l} className={i === shown - 1 ? 'on' : ''}>› {l}</li>)}</ul>
      </div>

      <div className="is-main">
        <div className="kick"><i />{kick.toUpperCase()}</div>
        <h1 className="is-h">
          <span className="l a">{t1}</span>
          <span className="l a">{t2}</span>
          <span className="l o" data-t={t3}>
            <em>{t3}</em>
            <span className="fill" aria-hidden="true">{t3}</span>
          </span>
        </h1>
        <div className="sub">{subline.toUpperCase()}</div>
        <div className="bar">
          <div className="ln"><i style={{ width: `${pct}%` }} /></div>
          <b>{String(pct).padStart(3, '0')}<small>%</small></b>
        </div>
        <div className="acc">
          {ready && <span className="chip">ACCESS GRANTED</span>}
          {ready && <span className="hint">CLICK TO ENTER</span>}
        </div>
      </div>

      <div className="is-bl"><div>— AUTH · VERIFYING CLEARANCE</div><div>LINK · {title}-2</div></div>
      <div className="is-br"><div>SECTOR 07 · {sub}</div><div className="bc" /><div>LAT 37.54 / LON 126.97</div></div>
      {phase === 'ready' && <i className="is-scan" />}
    </div>
  );
}
