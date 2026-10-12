'use client';
// 상세(스테이지) 배경 장식 — 게임 아트 소개 화면처럼 얇은 선·눈금·라벨·반짝이와,
// 캐릭터 이름의 다른 표기를 뒤에 크게 깐 「고스트 글씨」로 꾸민다. 늘 글자·그림보다 뒤(z-index 0)이고 클릭을 받지 않는다.
//
// 색
//  · 포인트색 = 페이지의 --accent (캐릭터 테마색 모드면 그 색으로 이미 바뀌어 있다)
//  · 바탕·선 색 = 밝은 테마는 흰색 계열, 어두운 테마는 검은색 계열 (tone — 배경 밝기에서 정한다)
// 배경 이미지를 등록한 경우 (mode)
//  · 'band' : 이미지를 뒤쪽의 큰 반원 안에 넣고, 나머지는 포인트색 장식 + 테마 바탕
//  · 'mono' : 이미지는 전체 배경 그대로, 장식 요소만 흰색/검은색(이미지 밝기에 맞춰)으로
import React, { useEffect, useRef, useState } from 'react';

/* ── 모션 ──
   · 처음 불러올 때: 조각들이 어긋난 자리에서 깜빡이며(적·청 색번짐) 제자리로 모인다 (.dc-i — globals.css)
   · 이후: 작은 장식만 반복 — 글자 스크램블, 쉐브론 깜빡임, 반짝이 맥동, 눈금 표식 이동, 십자 표식 점멸
   시스템의 「동작 줄이기」 설정에서는 전부 멈춘다. */
const SCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>=+*';
function scrambled(t: string, k: number) {   // 앞쪽 k글자는 제대로, 나머지는 무작위 글자
  let o = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    o += i < k || !/[A-Za-z0-9]/.test(ch) ? ch : SCR[Math.floor(Math.random() * SCR.length)];
  }
  return o;
}
/** 글자가 무작위 문자에서 한 글자씩 풀리며 나타나고, 이후 몇 초마다 다시 한 번 풀린다 */
function useScramble(text: string, delay: number, period: number) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let alive = true; const timers: number[] = [];
    const run = () => {
      let k = 0;
      const step = () => {
        if (!alive) return;
        setOut(scrambled(text, k));
        if (k >= text.length) { setOut(text); timers.push(window.setTimeout(run, period * (0.7 + Math.random() * 0.8))); return; }
        k += Math.max(1, Math.ceil(text.length / 9));
        timers.push(window.setTimeout(step, 60));
      };
      step();
    };
    setOut(scrambled(text, 0));
    timers.push(window.setTimeout(run, delay));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [text, delay, period]);
  return out;
}
function Scr({ text, delay, period, ...rest }: { text: string; delay: number; period: number } & React.SVGProps<SVGTextElement>) {
  const out = useScramble(text, delay, period);
  return <text {...rest}>{out}</text>;
}
/** 쉐브론 세 개가 대각선으로 놓여 차례로 깜빡이는 작은 표식 */
function Chev({ x, y, rot = 0, d = 0, acc }: { x: number; y: number; rot?: number; d?: number; acc: string }) {
  // 이미지 칠(패턴)이 화면 좌표를 따르도록 변환 없이 좌표를 직접 계산해 그린다
  const q = (rot * Math.PI) / 180, co = Math.cos(q), si = Math.sin(q);
  const P = (i: number, px: number, py: number) => {
    const ux = px + i * 9, uy = py + i * 9;
    return `${(x + ux * co - uy * si).toFixed(1)} ${(y + ux * si + uy * co).toFixed(1)}`;
  };
  return (
    <g className="dc-i" style={{ '--d': `${d}s`, '--dx': '40px', '--dy': '-30px' } as React.CSSProperties}>
      <g fill="none" strokeWidth="3" strokeLinecap="square">
        {[0, 1, 2].map(i => (
          <path key={i} className="dc-blink" d={`M${P(i, 0, 8)} L${P(i, 8, 0)} L${P(i, 16, 8)}`}
            stroke={i === 1 ? 'var(--d-line)' : acc} style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </g>
    </g>
  );
}
function TagText({ text }: { text: string }) {
  const out = useScramble(text, 700, 7000);
  return <>{out}</>;
}
const I = (d: number, dx = 0, dy = 0) => ({ '--d': `${d}s`, '--dx': `${dx}px`, '--dy': `${dy}px` }) as React.CSSProperties;

export type DecoMode = 'accent' | 'mono';

interface Props {
  mode: DecoMode;
  /** 장식 바탕·선의 계열 — 'light'=밝은(흰색 계열) 테마 · 'dark'=어두운(검은색 계열) 테마 */
  tone: 'light' | 'dark';
  /** mode='mono'일 때 장식 색 — 'dark'=검정 · 'light'=흰색 (이미지 밝기에 맞춘 값) */
  ink: 'light' | 'dark';
  /** mode='band'일 때 반원 안에 넣을 이미지와 블러(px) */
  image?: string;
  blur?: number;
  /** 뒤에 크게 깔 글씨 (이름의 다른 표기) — 비우면 깔지 않는다 */
  ghost?: string;
  ghostFont?: string;
  /** 하단 라벨에 적을 값 */
  name?: string;
  colorHex?: string;
  /** 큰 이름 글씨 위에 겹쳐 쓰는 필기체 글씨 (처음에 써 내려가는 효과) */
  /** 큰 이름 글씨 위치·크기 (x·y = 화면 %, scale = 기본 크기 대비 %) */
  ghostPos?: { x: number; y: number; scale: number };
  script?: { text: string; font?: string; color?: string; size: number; x: number; y: number; rot: number };
}

/** 큰 이름 글씨 크기(vw) — 화면 폭의 약 92%에 들어오게 (한글·한자는 글자 폭이 넓어 계수가 다르다). 편집 미리보기도 같은 식을 쓴다 */
export function ghostSizeVw(g: string): number {
  const wide = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3040-\u30ff\u3400-\u9fff]/.test(g);
  return g ? Math.min(30, 92 / Math.max(3, g.length * (wide ? 1.0 : 0.6))) : 0;
}

/** 필기체 글씨 — 글자를 지그재그 붓질 마스크로 왼쪽부터 쓸어 드러내, 쓰는 것처럼 나타낸다 */
function ScriptWrite({ t }: { t: NonNullable<Props['script']> }) {
  const ref = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const fs = t.size * 10.8, cx = t.x * 19.2, cy = t.y * 10.8;
  useEffect(() => {
    let alive = true;
    const measure = () => {
      const el = ref.current; if (!alive || !el) return;
      try { const b = el.getBBox(); if (b.width > 0) setBox({ x: b.x, y: b.y, w: b.width, h: b.height }); } catch { /* 무시 */ }
    };
    setBox(null);
    const go = () => requestAnimationFrame(measure);
    (document.fonts?.ready ?? Promise.resolve()).then(go);
    return () => { alive = false; };
  }, [t.text, t.font, t.size]);
  let d = '', sw = 0;
  if (box) {
    const step = Math.max(14, box.h * 0.4), pad = box.h * 0.1;
    const n = Math.ceil((box.w + pad * 2) / step) + 2;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const px = box.x - pad + i * step;
      const jit = ((i * 37) % 11) / 11 * box.h * 0.08;           // 붓질이 약간씩 달라 보이게
      pts.push(`${i ? 'L' : 'M'}${px.toFixed(1)} ${(i % 2 ? box.y - pad - jit : box.y + box.h + pad + jit).toFixed(1)}`);
    }
    d = pts.join(' '); sw = step * 1.2;
  }
  return (
    <g transform={`rotate(${t.rot} ${cx} ${cy})`}>
      <mask id="dc-wr" maskUnits="userSpaceOnUse" x="-400" y="-400" width="2800" height="1900">
        {d && <path className="dc-write" d={d} pathLength={1} fill="none" stroke="#fff" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />}
      </mask>
      <text ref={ref} x={cx} y={cy} textAnchor="middle" dominantBaseline="central" mask="url(#dc-wr)"
        fontSize={fs} fill={t.color || 'var(--d-acc)'} style={{ fontFamily: t.font ?? 'cursive' }}>{t.text}</text>
    </g>
  );
}

// 뒤쪽 큰 반원 (부채꼴) — 중심 (960,바닥선) · 반지름 610. 바닥선은 화면 아래에서 --cs-floor 만큼 위 (그림 하단도 같은 선에 선다)
const fanPath = (fy: number) => `M350 ${fy} A610 610 0 0 1 1570 ${fy} Z`;

export function StageDeco({ mode, tone, ink, image, blur = 0, ghost, ghostFont, ghostPos, name, colorHex, script }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ fy: 1015, sc: 1, ox: 0, oy: 0, W: 1920, H: 1080 });
  const fy = geo.fy;
  const bl = (geo.H - 30 - geo.oy) / geo.sc;   // 하단 라벨 글자 밑선 — 화면 맨 아래에서 30px 위 (viewBox 좌표)
                        // 바닥선의 viewBox y — 실제 화면 크기에 맞춰 아래에서 다시 잰다
  useEffect(() => {
    const el = root.current, pr = probe.current; if (!el || !pr) return;
    const calc = () => {
      const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
      const sc = Math.max(W / 1920, H / 1080), offX = (W - 1920 * sc) / 2, offY = (H - 1080 * sc) / 2;   // xMidYMid slice
      const v = Math.round((pr.offsetTop - offY) / sc);
      if (Number.isFinite(v)) setGeo({ fy: Math.min(1075, Math.max(700, v)), sc, ox: offX, oy: offY, W, H });
    };
    calc();
    const ro = new ResizeObserver(calc); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const FAN = fanPath(fy);
  const mono = mode === 'mono';
  const band = mode === 'accent' && !!image;
  // 포인트색으로 칠하는 장식의 칠 — 「장식 안에 이미지」면 같은 이미지를 화면 좌표 그대로 깔아, 반원과 이어지는 한 장의 배경처럼 보이게 한다
  const acc = band ? 'url(#dc-img)' : 'var(--d-acc)';
  const style = (mono
    ? { '--d-acc': ink === 'dark' ? '#111418' : '#ffffff', '--d-line': ink === 'dark' ? 'rgba(10,12,16,.5)' : 'rgba(255,255,255,.55)',
        '--d-ghost': ink === 'dark' ? 'rgba(10,12,16,.1)' : 'rgba(255,255,255,.14)' }
    : tone === 'light'
      ? { '--d-acc': 'var(--accent,#7fd6d0)', '--d-line': 'rgba(18,22,28,.4)',
          '--d-base': 'color-mix(in srgb,var(--accent,#7fd6d0) 4%,#f6f7f5)',
          '--d-ghost': 'color-mix(in srgb,var(--accent,#7fd6d0) 16%,rgba(255,255,255,0))' }
      : { '--d-acc': 'var(--accent,#7fd6d0)', '--d-line': 'rgba(255,255,255,.38)',
          '--d-base': 'color-mix(in srgb,var(--accent,#7fd6d0) 6%,#0b0d10)',
          '--d-ghost': 'color-mix(in srgb,var(--accent,#7fd6d0) 14%,rgba(0,0,0,0))' }) as unknown as React.CSSProperties;

  // 고스트 글씨 크기 — 화면 폭의 약 92%에 들어오게 (한글·한자는 글자 폭이 넓어 계수가 다르다)
  const g = (ghost ?? '').trim();
  const gsize = ghostSizeVw(g);

  return (
    <div ref={root} className="cs-deco" aria-hidden="true" style={style} data-mode={mode} data-tone={tone}>
      <div ref={probe} className="cs-deco-floor" />
      {/* CHARACTER FILE 표식 — 화면 비율에 따라 위가 잘리지 않게 viewBox가 아니라 화면 기준(BACK 줄 왼쪽)에 둔다 */}
      <div className="cs-deco-tag dc-i" style={I(0.3, 90, 0)}><TagText text="CHARACTER FILE" /></div>
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" focusable="false">
        <defs>
          <pattern id="dc-grid" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M96 0H0V96" fill="none" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </pattern>
          <pattern id="dc-dots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="var(--d-line)" />
          </pattern>
          <linearGradient id="dc-tag" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--d-acc)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--d-acc)" stopOpacity=".08" />
          </linearGradient>
          {band && (
            <>
              <pattern id="dc-img" patternUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
                <image href={image} x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"
                  filter={blur > 0 ? 'url(#dc-blur)' : undefined} />
                <rect width="1920" height="1080" fill="var(--d-acc)" opacity=".35" />
              </pattern>
              <clipPath id="dc-fan"><path d={FAN} /></clipPath>
              {blur > 0 && <filter id="dc-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={blur} /></filter>}
            </>
          )}
        </defs>

        {/* 바탕 — 이미지를 전체 배경으로 쓰는 경우(mono)에는 칠하지 않고 그대로 비친다 */}
        {!mono && <rect width="1920" height="1080" fill="var(--d-base)" />}
        {/* 아주 옅은 모눈 */}
        <rect width="1920" height="1080" fill="url(#dc-grid)" opacity=".13" />
      </svg>
      {/* 고스트 글씨 — 바탕·모눈 위, 나머지 장식(반원·선·라벨)과 그림 아래 */}
      {g && !band && (
        <div className="cs-deco-ghost" style={{ fontFamily: ghostFont ?? 'var(--serif)', fontSize: `${gsize * (ghostPos?.scale ?? 100) / 100}vw`,
          left: `${ghostPos?.x ?? 50}%`, top: `${ghostPos?.y ?? 30}%` }}>{g}</div>
      )}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" focusable="false"
        style={{ position: 'absolute', inset: 0 }}>

        {/* 큰 이름 글씨 — 「장식 안에 이미지」면 글자 속에 같은 이미지를 깐다 (화면 %를 viewBox 좌표로 옮겨 그린다) */}
        {g && band && (
          <g opacity=".5"><text className="cs-deco-ghost-svg" textAnchor="middle" dominantBaseline="central" fill="url(#dc-img)"
            x={(geo.W * (ghostPos?.x ?? 50) / 100 - geo.ox) / geo.sc} y={(geo.H * (ghostPos?.y ?? 30) / 100 - geo.oy) / geo.sc}
            fontSize={(gsize * (ghostPos?.scale ?? 100) / 100) * geo.W / 100 / geo.sc} fontWeight={800} letterSpacing="-0.02em"
            style={{ fontFamily: ghostFont ?? 'var(--serif)' }}>{g}</text></g>
        )}

        {/* 뒤쪽 큰 반원 — 이미지가 있으면(band) 그 안에 그림을, 없으면 포인트색을 옅게 */}
        <g className="dc-i" style={I(0.05, 0, 70)}>
        {band ? (
          <g clipPath="url(#dc-fan)">
            <image href={image} x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"
              filter={blur > 0 ? 'url(#dc-blur)' : undefined} />
            <rect width="1920" height="1080" fill="var(--d-acc)" opacity=".35" />
          </g>
        ) : (
          <path d={FAN} fill="var(--d-acc)" opacity={mono ? 0.1 : tone === 'light' ? 0.1 : 0.16} />
        )}
        </g>
        {/* 큰 이름 글씨가 반원과 겹치는 부분 — 반원 이미지와 같은 그림이라 묻히지 않게, 반원 안에서만 밝은(어두운) 글자로 한 번 더 */}
        {g && band && (
          <g clipPath="url(#dc-fan)">
            <text className="cs-deco-ghost-svg" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fillOpacity={tone === 'light' ? 0.5 : 0.34}
              x={(geo.W * (ghostPos?.x ?? 50) / 100 - geo.ox) / geo.sc} y={(geo.H * (ghostPos?.y ?? 30) / 100 - geo.oy) / geo.sc}
              fontSize={(gsize * (ghostPos?.scale ?? 100) / 100) * geo.W / 100 / geo.sc} fontWeight={800} letterSpacing="-0.02em"
              style={{ fontFamily: ghostFont ?? 'var(--serif)' }}>{g}</text>
          </g>
        )}
        <g className="dc-i" style={I(0.25, 0, 40)}>
          <path d={FAN} fill="none" stroke="var(--d-acc)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".75" />
          <path d={`M312 ${fy} A648 648 0 0 1 1608 ${fy}`} fill="none" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7" />
          <line x1="230" y1={fy} x2="1690" y2={fy} stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7" />
        </g>

        {script && script.text && <ScriptWrite t={script} />}

        {/* 왼쪽 가장자리 — 세로 줄 셋 + 포인트색 막대 */}
        <g className="dc-i" style={I(0.15, -60, 0)}>
          <g stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".75">
            <line x1="20" y1="170" x2="20" y2="930" /><line x1="27" y1="170" x2="27" y2="930" /><line x1="34" y1="170" x2="34" y2="930" />
          </g>
          <rect x="31" y="770" width="6" height="160" fill={acc} />
        </g>

        {/* 오른쪽 위 — 3x3 점 */}
        <g className="dc-i" style={I(0.4, 90, 40)} fill={acc} opacity=".85">
          {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => <rect key={r + '' + c} className="dc-blink slow" style={{ animationDelay: `${(r * 3 + c) * 0.37}s` }} x={1700 + c * 14} y={112 + r * 14} width="7" height="7" />))}
        </g>

        {/* 점 격자 · 십자 표식 · 반짝이 */}
        <g className="dc-i" style={I(0.45, -50, 20)}><rect x="46" y="640" width="168" height="96" fill="url(#dc-dots)" opacity=".65" /></g>
        <g className="dc-i" style={I(0.5, 60, 20)}><rect x="1700" y="560" width="168" height="96" fill="url(#dc-dots)" opacity=".5" /></g>
        {([[96, 560], [1264, 1010], [716, 112], [1856, 420], [330, 800]] as const).map(([x, y], i) => (
          <g key={x + '-' + y} className="dc-i" style={I(0.55 + i * 0.06, 0, 30)}>
            <path className="dc-flash" style={{ animationDelay: `${i * 1.3}s` }} stroke="var(--d-line)" strokeWidth="1.4" vectorEffect="non-scaling-stroke"
              d={`M${x - 8} ${y}h16M${x} ${y - 8}v16`} />
          </g>
        ))}
        {([[1180, 220, 15], [560, 330, 10], [1440, 760, 12], [440, 760, 9], [1110, 150, 8], [1660, 330, 10]] as const).map(([x, y, r], i) => (
          <g key={x + '-' + y} className="dc-i" style={I(0.6 + i * 0.07, (i % 2 ? 40 : -40), -30)}>
            <path className="dc-tw" style={{ animationDelay: `${i * 0.6}s` }} fill={acc}
              d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`} />
          </g>
        ))}
        <Chev x={1730} y={380} rot={0} d={0.7} acc={acc} />
        <Chev x={110} y={470} rot={90} d={0.8} acc={acc} />
        <Chev x={1040} y={1010} rot={180} d={0.9} acc={acc} />

        {/* 하단 라벨 — 점선으로 이어진 이름표. 하단 독·BGM 플레이어에 가리지 않게 화면 맨 아래에서 30px 위(독 바로 위 줄)에 둔다 */}
        <g className="dc-i" style={I(0.6, 90, 0)} fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" fontSize="12" letterSpacing="3">
          <rect x="1380" y={bl - 35} width="84" height="18" fill="var(--d-acc)" />
          <text x="1392" y={bl - 22} fill={mono ? (ink === 'dark' ? '#fff' : '#111') : (tone === 'light' ? '#fff' : '#0b0d10')} fontWeight="700">THEME</text>
          <line x1="1474" y1={bl - 26} x2="1556" y2={bl - 26} stroke="var(--d-line)" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <Scr text={(colorHex ?? '').replace('#', '').toUpperCase().slice(0, 6) || '------'} delay={1100} period={6000} x="1566" y={bl - 22} fill="var(--d-line)" textAnchor="start" />
          <rect x="1380" y={bl - 13} width="84" height="18" fill="none" stroke="var(--d-acc)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x="1392" y={bl} fill="var(--d-line)" fontWeight="700">NAME</text>
          <line x1="1474" y1={bl - 4} x2="1520" y2={bl - 4} stroke="var(--d-line)" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <Scr text={(name ?? '').toUpperCase().slice(0, 10) || '--'} delay={1300} period={8000} x="1530" y={bl} fill="var(--d-line)" />
        </g>
        <g className="dc-i" style={I(0.55, -80, 0)} fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" fill="var(--d-line)" letterSpacing="3">
          <Scr text="// ARCHIVE" delay={900} period={9000} x="60" y={bl - 18} fontSize="14" fontWeight="800" fill={acc} />
          <text x="60" y={bl} fontSize="10" letterSpacing="2">CHARACTER PROFILE · ALL RIGHTS RESERVED</text>
        </g>
        <g className="dc-i" style={I(0.45, 50, 0)}>
          <Scr text="STATUS" delay={800} period={5500} x="1262" y="132" fontSize="12" letterSpacing="3" fill="var(--d-line)"
            fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" />
          <g stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7">
            <line x1="1296" y1="140" x2="1296" y2="330" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={i} x1="1296" y1={150 + i * 24} x2={i % 2 ? 1303 : 1310} y2={150 + i * 24} />)}
          </g>
          <rect className="dc-scan" x="1290" y="146" width="22" height="4" fill={acc} />
        </g>
      </svg>
    </div>
  );
}
