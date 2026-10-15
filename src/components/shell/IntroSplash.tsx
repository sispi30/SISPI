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
import { useStageFit } from '@/lib/stageFit';
import { INTRO_RINGS, INTRO_CONS, INTRO_PLANETS, INTRO_SPARKS, introSparkle } from '@/lib/introSky';

const SEEN = 'ohome.intro.seen';
const LOAD_MS = 3200;

export function IntroSplash() {
  const router = useRouter();
  // 화면이 1920×1000보다 작으면 폭·높이 중 빡빡한 쪽에 맞춰 통째로 줄인다 (태블릿 가로에서 글씨·눈금이 겹치지 않게)
  useStageFit({ name: 'intro', minWidth: 760, designH: 1000 });
  const [site, , loaded] = useSiteSettings();
  const [menuSet, , menuLoaded] = useMenuSettings();
  const [phase, setPhase] = useState<'load' | 'ready' | 'out' | 'gone'>('load');
  const [pct, setPct] = useState(0);
  const raf = useRef(0);
  const starRef = useRef<SVGGElement>(null);
  const aim = useRef({ target: 0, cur: 0, last: 0, init: false });

  // 별은 저절로 돌지 않고 마우스(손가락)가 움직이는 방향을 따라 부드럽게 돈다
  useEffect(() => {
    if (phase === 'gone') return;
    const mv = (e: PointerEvent) => {
      const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2) * 180 / Math.PI;
      const m = aim.current;
      if (!m.init) { m.init = true; m.last = a; m.target = m.cur = a; return; }
      let d = a - m.last; // 반 바퀴 넘게 튀지 않게 이어 붙인다
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      m.last = a; m.target += d;
    };
    window.addEventListener('pointermove', mv);
    let id = 0;
    const loop = () => {
      const m = aim.current;
      if (Math.abs(m.target - m.cur) > 0.02) {
        m.cur += (m.target - m.cur) * 0.06;
        if (starRef.current) starRef.current.style.transform = `rotate(${m.cur}deg)`;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => { window.removeEventListener('pointermove', mv); cancelAnimationFrame(id); };
  }, [phase]);
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
    ...(site.introSpark ? { ['--is-sp' as string]: site.introSpark } : {}),
    ...(site.introTop ? { ['--is-top' as string]: site.introTop } : {}),
    ...(site.introPct ? { ['--is-pc' as string]: site.introPct } : {}),
    ...(site.introFg ? { ['--is-fg' as string]: site.introFg } : {}),
    ['--is-op' as string]: (site.introImageOp ?? 100) / 100,
    ['--is-p' as string]: `${pct}%`,
  } as React.CSSProperties;
  const log = [`BOOT ${title}.OS 4.1.7`, 'MOUNT /ARCHIVE/MAIN', 'HANDSHAKE ........ OK', `TRACE ${title}-2`, 'AWAIT CREDENTIAL'];
  const shown = Math.min(log.length, 1 + Math.floor(pct / 22));
  // 별자리·행성·반짝이·궤도 도형은 lib/introSky.ts에서 따로 관리한다 (메인 「별자리 궤도」 위젯은 lib/orbitSky.ts — 서로 영향 없음)
  // (별자리는 천천히 돌아도 바깥 원형 궤도 밖으로 나가지 않게 거기서 줄여 놓았다)
  const SP = INTRO_SPARKS, CONS = INTRO_CONS, PL = INTRO_PLANETS;
  return (
    <div className={`intro-splash ${phase}`} style={vars} role="dialog" aria-label="인트로">
      {img && <div className="is-art" style={{ backgroundImage: `url("${img}")` }} />}
      {/* 아주 옅은 모눈 — 캐릭터 화면(StageDeco)에 깔린 것과 같은 96px 격자 (1920×1080 기준, 화면에 꽉 차게) */}
      <svg className="is-grid" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="is-grid-p" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M96 0H0V96" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#is-grid-p)" />
      </svg>
      <svg className="is-sky" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g className="rings">
          {INTRO_RINGS.map(c => (
            <circle key={c.r} cx="640" cy="360" r={c.r} className={c.cls}
              style={c.d != null ? { ['--d' as string]: `${c.d}s` } : undefined} />
          ))}
        </g>
        <g className="rays">
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1="640" y1="228" x2="640" y2="28" transform={`rotate(${i * 30 + 7} 640 360)`} />)}
        </g>
        <g className="cons">
          {CONS.map((d, i) => <polyline key={i} points={d} />)}
          {/* 선이 이어지는 꼭짓점마다 별자리 같은 4각 반짝이 (별자리와 함께 천천히 돈다) */}
          {CONS.flatMap((d, i) => d.split(' ').map((pt, j) => {
            const [x, y] = pt.split(',').map(Number);
            // 마우스 이동 반짝이와 비슷한 아주 작은 크기 (화면 기준 약 4~6px)
            const r = 2.4 + ((i + j) % 3) * 0.7;
            return <path key={`c${i}-${j}`} className="cs" style={{ ['--d' as string]: `${(((i * 3 + j * 5) % 11) * 0.3).toFixed(1)}s` }}
              d={introSparkle(x, y, r)} />;
          }))}
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
        <g className="sparks">{SP.map(([x, y, r], i) => <path key={i} className="sp" style={{ ['--d' as string]: `${(i % 5) * 0.4}s` }} d={introSparkle(x, y, r * 2)} />)}</g>
      </svg>
      <div className="is-halo" />
      <div className={`is-star${ready ? " on" : ""}`} role="button" tabIndex={ready ? 0 : -1} aria-label="ARCHIVE ENTRY" onClick={() => enter()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } }}>
        <svg viewBox="-100 -100 200 200"><g ref={starRef}><path fillRule="evenodd" transform="rotate(-32)" d="M0 -96Q1.6 -1.6 96 0Q1.6 1.6 0 96Q-1.6 1.6 -96 0Q-1.6 -1.6 0 -96ZM0 -30Q-3 -3 -30 0Q-3 3 0 30Q3 3 30 0Q3 -3 0 -30Z" /></g></svg>
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
          {ready ? <><button type="button" className="chip" onClick={() => enter()}>ARCHIVE ENTRY</button><span className="hint">CLICK TO ENTER</span></> : <span className="hint">{'AUTH · VERIFYING'}</span>}
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
