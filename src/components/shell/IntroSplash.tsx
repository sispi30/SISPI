'use client';
// 인트로 화면 — 처음 들어올 때: 천구(별자리 관측의) 느낌의 로딩 화면.
// 가운데 네 갈래 별과 겹겹의 원·궤도, 위·아래로 잘려 보이는 큰 제목 글자(마지막 줄은 로딩 따라 포인트색이 차오름), 퍼센트 눈금과 상태 글씨.
// 100%가 되면 「ACCESS GRANTED」가 뜨고, 클릭(또는 Enter·스페이스)하면 원들이 확대되며 가운데에서 원 모양으로 열리며 메인 페이지가 나온다.
// 위쪽 가운데 메뉴를 누르면 입장하면서 그 메뉴로 바로 간다. 한 탭에서 한 번만 뜬다.
// 환경설정 > 디자인 > 인트로 화면에서 바탕·그림·포인트색·제목 색·글귀를 바꾼다. 장식(격자·상태 글씨·모서리 표식 등)은 그대로.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useMenuSettings, buildMenu } from '@/lib/menuStore';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 3200;

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
    setTimeout(() => setPhase('gone'), 2200);
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
  const bg1 = site.introBg ?? '#050716';
  const bgc = site.introBg2 ? `linear-gradient(180deg,${bg1},${site.introBg2})` : bg1;
  const vars = {
    ['--is-bgc' as string]: bgc,
    ...(site.introDot ? { ['--is-ac' as string]: site.introDot } : {}),
    ...(site.introGold ? { ['--is-gold' as string]: site.introGold } : {}),
    ...(site.introFg ? { ['--is-fg' as string]: site.introFg } : {}),
    ['--is-op' as string]: (site.introImageOp ?? 100) / 100,
    ['--is-p' as string]: `${pct}%`,
  } as React.CSSProperties;
  const log = [`BOOT ${title}.OS 4.1.7`, 'MOUNT /ARCHIVE/MAIN', 'HANDSHAKE ........ OK', `TRACE ${title}-2`, 'AWAIT CREDENTIAL'];
  const shown = Math.min(log.length, 1 + Math.floor(pct / 22));
  const SP: [number, number, number][] = [[88, 242, 5], [138, 103, 4], [78, 388, 4], [103, 534, 4], [1112, 52, 3], [1203, 330, 4], [1190, 478, 3], [1142, 616, 4], [1226, 660, 4], [290, 86, 3], [980, 150, 3], [420, 640, 3]];
  // 별자리 선 — 고리 사이 띠에 흩어 놓은 가는 선 (고정 값)
  const CONS = [
    '470,214 520,192 566,214 590,176', '760,200 812,230 850,214 884,252', '905,352 940,392 912,440 936,480',
    '742,566 700,540 650,572 604,548', '420,470 466,512 440,556', '392,330 430,296 408,254',
    '560,128 604,96 650,118', '830,520 790,556 744,540',
  ];
  const PL = [
    { r: 300, s: 9, a: 0, t: 400, w: 100 }, { r: 300, s: 8, a: 38, t: 400, w: 100, half: true }, { r: 300, s: 8, a: 82, t: 400, w: 100, ring: true },
    { r: 268, s: 13, a: -24, t: 46, w: 85 }, { r: 246, s: 7, a: 52, t: 60, w: 60 },
    { r: 218, s: 9, a: -62, t: 78, w: 50, rev: true }, { r: 168, s: 8, a: -108, t: 95, w: 40 },
  ];
  return (
    <div className={`intro-splash ${phase}`} style={vars} onClick={() => enter()} role="dialog" aria-label="인트로">
      {img && <div className="is-art" style={{ backgroundImage: `url("${img}")` }} />}
      <svg className="is-sky" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g className="rings">
          <circle cx="640" cy="360" r="332" style={{ ['--d' as string]: '0s' }} />
          <circle cx="640" cy="360" r="324" className="th" style={{ ['--d' as string]: '.08s' }} />
          <circle cx="640" cy="360" r="312" className="tick" style={{ ['--d' as string]: '.16s' }} />
          <circle cx="640" cy="360" r="296" className="gd" style={{ ['--d' as string]: '.24s' }} />
          <circle cx="640" cy="360" r="268" style={{ ['--d' as string]: '.32s' }} />
          <circle cx="640" cy="360" r="246" className="dot" style={{ ['--d' as string]: '.4s' }} />
          <circle cx="640" cy="360" r="218" style={{ ['--d' as string]: '.48s' }} />
          <circle cx="640" cy="360" r="196" className="dash" />
          <circle cx="640" cy="360" r="168" className="th" style={{ ['--d' as string]: '.56s' }} />
          <circle cx="640" cy="360" r="132" className="gd" style={{ ['--d' as string]: '.64s' }} />
        </g>
        <g className="rays">
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1="640" y1="228" x2="640" y2="28" transform={`rotate(${i * 30 + 7} 640 360)`} />)}
        </g>
        <g className="cons">
          {CONS.map((d, i) => <polyline key={i} points={d} />)}
        </g>
        <g className="orbs">
          <ellipse cx="640" cy="360" rx="700" ry="150" transform="rotate(-17 640 360)" className="gold" />
          <ellipse cx="640" cy="360" rx="720" ry="210" transform="rotate(14 640 360)" />
        </g>
        <g className="planets">
          {PL.map((p, i) => (
            <g key={i} transform={`rotate(${p.a} 640 360)`}>
              <g className={`spin${p.rev ? ' r' : ''}`} style={{ animationDuration: `${p.t}s` }}>
                {p.half
                  ? <><circle cx="640" cy={360 - p.r} r={p.s} className="pl ln" /><path d={`M640 ${360 - p.r - p.s}A${p.s} ${p.s} 0 0 1 640 ${360 - p.r + p.s}Z`} className="pl" /></>
                  : <circle cx="640" cy={360 - p.r} r={p.s} className={`pl${p.ring ? ' ln' : ''}`} style={{ fill: p.ring ? 'none' : `color-mix(in srgb, var(--is-gold) ${p.w}%, #fff)` }} />}
              </g>
            </g>
          ))}
        </g>
        {SP.map(([x, y, r], i) => <path key={i} className="sp" style={{ ['--d' as string]: `${(i % 5) * 0.4}s` }} d={`M${x} ${y - r * 2}Q${x} ${y} ${x + r * 2} ${y}Q${x} ${y} ${x} ${y + r * 2}Q${x} ${y} ${x - r * 2} ${y}Q${x} ${y} ${x} ${y - r * 2}Z`} />)}
      </svg>
      <div className="is-halo" />
      <div className="is-star" aria-hidden="true">
        <svg viewBox="-100 -100 200 200"><path fillRule="evenodd" transform="rotate(-32)" d="M0 -96Q1.6 -1.6 96 0Q1.6 1.6 0 96Q-1.6 1.6 -96 0Q-1.6 -1.6 0 -96ZM0 -30Q-3 -3 -30 0Q-3 3 0 30Q3 3 30 0Q3 -3 0 -30Z" /></svg>
      </div>
      <i className="is-frame" />
      <i className="is-cn tl" /><i className="is-cn tr" /><i className="is-cn bl" /><i className="is-cn br" />

      <div className="is-ghost top" aria-hidden="true">{t1} {t2}</div>
      <div className="is-ghost bot" aria-hidden="true">
        <span className="o">{t3}</span><span className="fill">{t3}</span>
      </div>
      <h1 className="is-sr">{t1} {t2} {t3}</h1>

      <nav className="is-nav" onClick={e => e.stopPropagation()}>
        {items.map((m, i) => (
          <React.Fragment key={m.href + i}>
            {i === 1 && <span className="sl">/</span>}
            <button type="button" disabled={!ready} onClick={() => enter(m.href)}>‹ {m.label}</button>
          </React.Fragment>
        ))}
      </nav>

      <div className="is-lbl l">{kick.toUpperCase()}</div>
      <div className="is-lbl r">{subline.toUpperCase()}</div>

      <div className="is-mid">
        <div className="acc">
          {ready ? <><span className="chip">ACCESS GRANTED</span><span className="hint">CLICK TO ENTER</span></> : <span className="hint">{'AUTH · VERIFYING'}</span>}
        </div>
      </div>

      <div className="is-top">
        <ul>{log.slice(0, shown).map((l, i) => <li key={l} className={i === shown - 1 ? 'on' : ''}>› {l}</li>)}</ul>
      </div>

      <div className="is-pct">
        <b>{String(pct).padStart(3, '0')}<small>%</small></b>
        <div className="sub">{title} / {sub}</div>
      </div>

      <div className="is-ruler"><i style={{ width: `${pct}%` }} /><span>{['IX', 'VX', '·', 'X', 'XX', 'XI'].map((t, i) => <em key={i}>{t}</em>)}</span></div>
      <div className="is-bl"><div>— AUTH · VERIFYING CLEARANCE</div><div>LINK · {title}-2</div></div>
      <div className="is-br"><div>SECTOR 07 · {sub}</div><div>LAT 37.54 / LON 126.97</div></div>
    </div>
  );
}
