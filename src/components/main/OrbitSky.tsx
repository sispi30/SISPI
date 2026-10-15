'use client';
// 별자리 궤도 — 인트로 화면의 겹겹의 원·궤도·별자리·행성·반짝이를 그대로 옮긴 장식 (메인 「별자리 궤도」 위젯이 쓴다).
// · 도형은 인트로와 같은 값(lib/orbitSky.ts)을 쓴다. 인트로는 화면 전체를 채우지만 여기서는 바깥 궤도 안쪽 정사각형만 보여 준다.
// · 크기(위젯 칸 대비 %)와 색(선·포인트·반짝이)을 바꿀 수 있다. 색을 비우면 사이트 포인트색을 따른다.
// · 마우스를 움직이면 입체적으로 기운다 — 궤도·별자리·행성·반짝이를 서로 다른 깊이의 층으로 쌓아 두어서,
//   기울 때 층마다 어긋나 보이며 진짜 입체처럼 보인다.
import React, { useEffect, useRef } from 'react';
import {
  SKY_CX, SKY_CY, SKY_RINGS, SKY_CONS, SKY_PLANETS, SKY_WIDGET_SPARKS, SKY_STAR_PATH, sparklePath,
} from '@/lib/orbitSky';

export interface OrbitSkySettings {
  size?: number;          // 위젯 칸에 꽉 찬 크기를 100으로 본 % (기본 100)
  lineColor?: string;     // 궤도·별자리 선 (비우면 포인트색)
  pointColor?: string;    // 행성·점선 고리
  sparkColor?: string;    // 반짝이·가운데 별
  tilt?: number;          // 마우스를 따라 기우는 세기 0~100 (기본 60, 0이면 안 기운다)
}
export const ORBIT_DEFAULT_SIZE = 100;
export const ORBIT_DEFAULT_TILT = 60;

// 바깥 고리(반지름 332)가 딱 들어오는 정사각형 — 인트로 좌표 그대로 쓰되 보이는 창만 이 상자로 자른다
const VB = `${SKY_CX - 350} ${SKY_CY - 350} 700 700`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// 위젯용 반짝이 — 각도·거리로 적은 값을 좌표로 한 번만 바꿔 둔다
const SPARKS = SKY_WIDGET_SPARKS.map(([a, r, arm]) => {
  const rad = a * Math.PI / 180;
  return { x: +(SKY_CX + r * Math.cos(rad)).toFixed(1), y: +(SKY_CY + r * Math.sin(rad)).toFixed(1), arm };
});

export function OrbitSky({ size = ORBIT_DEFAULT_SIZE, lineColor, pointColor, sparkColor, tilt = ORBIT_DEFAULT_TILT }: OrbitSkySettings) {
  const box = useRef<HTMLDivElement>(null);
  const tiltEl = useRef<HTMLDivElement>(null);

  // 마우스를 따라 기울기 — 위젯 중심에서 마우스가 얼마나 떨어졌는지(화면 반 폭 기준)로 각도를 정하고,
  // 부드럽게 따라가도록 한 프레임에 조금씩 다가간다. 마우스가 멈추면 프레임 루프도 멈춘다.
  useEffect(() => {
    const el = tiltEl.current, wrap = box.current;
    if (!el || !wrap) return;
    el.style.transform = '';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (tilt <= 0 || reduce) return;
    const max = clamp(tilt, 0, 100) * 0.5;          // 최대 기울기(도) — 세기 100이면 50°
    const cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
    let raf = 0;
    const step = () => {
      cur.x += (tgt.x - cur.x) * 0.09; cur.y += (tgt.y - cur.y) * 0.09;
      el.style.transform = `rotateX(${cur.x.toFixed(2)}deg) rotateY(${cur.y.toFixed(2)}deg)`;
      raf = Math.abs(tgt.x - cur.x) > 0.02 || Math.abs(tgt.y - cur.y) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = wrap.getBoundingClientRect();
      const nx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
      const ny = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
      tgt.y = nx * max;      // 마우스가 오른쪽이면 오른쪽을 향해 돈다
      tgt.x = -ny * max;     // 마우스가 아래면 아래를 향해 숙인다
      if (!raf) raf = requestAnimationFrame(step);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [tilt]);

  const vars = {
    ['--ow-k' as string]: clamp(size, 10, 400) / 100,
    ['--ow-line' as string]: lineColor || 'var(--accent)',
    ['--ow-pt' as string]: pointColor || 'var(--accent)',
    ['--ow-sp' as string]: sparkColor || 'var(--accent)',
  } as React.CSSProperties;

  return (
    <div className="ow" ref={box} style={vars} aria-hidden="true">
      <div className="ow-stage">
        <div className="ow-tilt" ref={tiltEl}>
          {/* 맨 뒤 — 빛살과 겹겹의 원 */}
          <svg className="ow-l l0" viewBox={VB} focusable="false">
            <g className="rays">
              {Array.from({ length: 12 }, (_, i) => <line key={i} x1={SKY_CX} y1={SKY_CY - 132} x2={SKY_CX} y2={SKY_CY - 332} transform={`rotate(${i * 30 + 7} ${SKY_CX} ${SKY_CY})`} />)}
            </g>
            <g className="rings">
              {SKY_RINGS.map(c => <circle key={c.r} cx={SKY_CX} cy={SKY_CY} r={c.r} className={c.cls} />)}
            </g>
          </svg>
          {/* 가로지르는 두 타원 궤도 — 인트로에서는 화면 밖까지 뻗지만 여기서는 바깥 고리 안에서 끝난다 */}
          <svg className="ow-l l1" viewBox={VB} focusable="false">
            <g className="orbs">
              <ellipse cx={SKY_CX} cy={SKY_CY} rx="326" ry="74" transform={`rotate(-17 ${SKY_CX} ${SKY_CY})`} className="gold" />
              <ellipse cx={SKY_CX} cy={SKY_CY} rx="334" ry="104" transform={`rotate(14 ${SKY_CX} ${SKY_CY})`} />
            </g>
          </svg>
          {/* 별자리 — 천천히 돌며, 이은 점마다 작은 반짝이 */}
          <svg className="ow-l l2" viewBox={VB} focusable="false">
            <g className="cons">
              {SKY_CONS.map((d, i) => <polyline key={i} points={d} />)}
              {SKY_CONS.flatMap((d, i) => d.split(' ').map((pt, j) => {
                const [x, y] = pt.split(',').map(Number);
                return <path key={`c${i}-${j}`} className="cs" d={sparklePath(x, y, 7 + ((i + j) % 3) * 2)}
                  style={{ animationDelay: `${(((i * 3 + j * 5) % 11) * 0.3).toFixed(1)}s` }} />;
              }))}
            </g>
          </svg>
          {/* 궤도를 도는 행성 */}
          <svg className="ow-l l3" viewBox={VB} focusable="false">
            <g className="planets">
              {SKY_PLANETS.map((p, i) => (
                <g key={i} transform={`rotate(${p.a} ${SKY_CX} ${SKY_CY})`}>
                  <g className={`spin${p.rev ? ' r' : ''}`} style={{ animationDuration: `${p.t}s` }}>
                    {p.half
                      ? <><circle cx={SKY_CX} cy={SKY_CY - p.r} r={p.s} className="pl ln" /><path d={`M${SKY_CX} ${SKY_CY - p.r - p.s}A${p.s} ${p.s} 0 0 1 ${SKY_CX} ${SKY_CY - p.r + p.s}Z`} className="pl" /></>
                      : <circle cx={SKY_CX} cy={SKY_CY - p.r} r={p.s} className={`pl${p.ring ? ' ln' : ''}`}
                        style={p.ring ? undefined : { fill: `color-mix(in srgb, var(--ow-pt) ${p.w}%, transparent)` }} />}
                  </g>
                </g>
              ))}
            </g>
          </svg>
          {/* 맨 앞 — 떠 있는 반짝이와 가운데 별 */}
          <svg className="ow-l l4" viewBox={VB} focusable="false">
            <g className="sparks">
              {SPARKS.map((s, i) => <path key={i} className="sp" d={sparklePath(s.x, s.y, s.arm)} style={{ animationDelay: `${(i % 5) * 0.7}s` }} />)}
            </g>
            <g transform={`translate(${SKY_CX} ${SKY_CY}) rotate(-32) scale(.42)`}>
              <path className="star" fillRule="evenodd" d={SKY_STAR_PATH} />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
