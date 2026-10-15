'use client';
// 별자리 궤도 — 메인 「별자리 궤도」 위젯. 혼천의(Armillary Sphere)처럼 여러 고리가 서로 다른 축으로 입체적으로 돈다.
// · 가운데 별은 제자리에 고정 — 인트로의 별처럼 마우스가 움직이는 방향을 따라 제자리에서만 돈다.
// · 고리만 3D로 돈다. 고리마다 [회전축 기울기 → 축을 중심으로 회전 → 고리 면의 기울기 → 면 안에서 흐름]을 겹쳐 쌓아 두어서
//   자오선은 뒤집히며 돌고, 황도는 흔들리며 돌고, 안쪽 고리는 다른 축으로 돈다. 마우스를 움직이면 고리 전체가 그쪽으로 기운다.
// · 별자리·반짝이는 고리 뒤에 평면으로 깔린 별 지도 (천천히 돌기만 한다).
// · 크기(위젯 칸 대비 %)와 색(선·포인트·반짝이)을 바꿀 수 있다. 색을 비우면 사이트 포인트색을 따른다.
// · 도형은 lib/orbitSky.ts — 인트로(lib/introSky.ts)와 따로 관리한다.
import React, { useEffect, useRef } from 'react';
import { ARM_BOX, ARM_C, ARM_RINGS, ARM_DEFAULT_COUNT, ARM_CONS, ARM_SPARKS, ARM_STAR_PATH, armSparkle, ArmRing } from '@/lib/orbitSky';

export interface OrbitSkySettings {
  size?: number;          // 위젯 칸에 꽉 찬 크기를 100으로 본 % (기본 100)
  lineColor?: string;     // 고리·별자리 선 (비우면 포인트색)
  pointColor?: string;    // 알갱이(행성)·점선 고리
  sparkColor?: string;    // 반짝이·가운데 별
  tilt?: number;          // 마우스를 따라 고리 전체가 기우는 세기 0~100 (기본 60, 0이면 안 기운다)
  starSize?: number;      // 가운데 별 크기 % (기본 100)
  ringCount?: number;     // 선(고리) 개수 — 기본 8개, 최대 ARM_RINGS.length개
  boldWidth?: number;     // 진한 선(굵고 밝은 고리) 굵기 % (기본 100)
  thinWidth?: number;     // 얇은 선(보통·가는 고리, 별자리 선) 굵기 % (기본 100)
  dashWidth?: number;     // 점선(긴 점선·점점이 고리, 눈금) 굵기 % (기본 100)
}
export const ORBIT_DEFAULT_SIZE = 100;
export const ORBIT_DEFAULT_TILT = 60;
export const ORBIT_DEFAULT_STAR = 100;
export const ORBIT_DEFAULT_COUNT = ARM_DEFAULT_COUNT;
export const ORBIT_MAX_COUNT = ARM_RINGS.length;
export const ORBIT_DEFAULT_WIDTH = 100;

const BASE_RX = -22;   // 마우스가 가운데 있을 때 앞쪽으로 기울어 보이는 정도(°) — 가로 고리가 납작한 타원으로 보인다
const RING_R = 340;    // 고리 그림(700 상자) 안의 원 반지름 — 고리 크기는 지름(d)으로 정하므로 모든 고리가 같은 그림을 쓴다
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const cssVars = (o: Record<string, string | number>) => o as unknown as React.CSSProperties;

function Ring({ g }: { g: ArmRing }) {
  const [ax, az] = g.axis ?? [0, 0];
  const spin = g.spin ?? 0, turn = g.turn ?? 0;
  return (
    // ① 회전축을 기울인다 → ② 그 축을 중심으로 돈다 → ③ 고리 면을 기울이고 높이를 옮긴다 → ④ 면 안에서 알갱이·점선이 흐른다
    <div className="ow-axis" style={cssVars({ '--ax': `${ax}deg`, '--az': `${az}deg` })}>
      <div className={`ow-spin${spin ? '' : ' still'}${spin < 0 ? ' rev' : ''}`}
        style={cssVars({ '--ts': `${Math.abs(spin) || 1}s`, '--ph': g.phase ?? 0 })}>
        <div className="ow-hold" style={cssVars({ '--rx': `${g.rx}deg`, '--y': g.y ?? 0 })}>
          <svg className={`ow-ring ${g.style}${turn ? ' turn' : ''}${turn < 0 ? ' rev' : ''}`}
            viewBox={`0 0 ${ARM_BOX} ${ARM_BOX}`} focusable="false"
            style={cssVars({ '--d': g.d, '--tt': `${Math.abs(turn) || 1}s` })}>
            <circle className="a" cx={ARM_C} cy={ARM_C} r={RING_R} />
            {g.style === 'band' && (
              <>
                <circle className="a" cx={ARM_C} cy={ARM_C} r={RING_R - 28} />
                <circle className="tk" cx={ARM_C} cy={ARM_C} r={RING_R - 14} />
              </>
            )}
            {g.beads?.map((b, i) => (
              <circle key={i} className={`bd${b.hollow ? ' hl' : ''}`} cx={ARM_C} cy={ARM_C - RING_R} r={b.s}
                transform={`rotate(${b.a} ${ARM_C} ${ARM_C})`} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

export function OrbitSky({
  size = ORBIT_DEFAULT_SIZE, lineColor, pointColor, sparkColor, tilt = ORBIT_DEFAULT_TILT,
  starSize = ORBIT_DEFAULT_STAR, ringCount = ORBIT_DEFAULT_COUNT,
  boldWidth = ORBIT_DEFAULT_WIDTH, thinWidth = ORBIT_DEFAULT_WIDTH, dashWidth = ORBIT_DEFAULT_WIDTH,
}: OrbitSkySettings) {
  const box = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const star = useRef<SVGSVGElement>(null);

  // 마우스를 따라 ① 고리 전체가 기울고 ② 가운데 별이 제자리에서 돈다. 둘 다 부드럽게 따라가도록 한 프레임에 조금씩 다가가고,
  // 마우스가 멈춰 다 따라잡으면 프레임 루프도 멈춘다.
  //  · 고리: 위젯 중심에서 마우스가 얼마나 떨어졌는지(화면 반 폭 기준)로 기울기를 정한다.
  //  · 별: 인트로와 같은 방식 — 위젯 중심을 기준으로 마우스가 도는 방향의 변화량을 쌓아 가며 돈다 (반 바퀴 넘게 튀지 않게 이어 붙인다).
  useEffect(() => {
    const wrap = box.current, rigEl = rig.current, starEl = star.current;
    if (!wrap || !rigEl || !starEl) return;
    const put = (rx: number, ry: number) => {
      rigEl.style.transform = `rotateX(${(BASE_RX + rx).toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };
    put(0, 0);
    starEl.style.transform = '';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const max = clamp(tilt, 0, 100) * 0.5;          // 고리가 가장 크게 기우는 각도(°) — 세기 100이면 50°
    const cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
    const aim = { target: 0, cur: 0, last: 0, init: false };
    let raf = 0;
    const step = () => {
      cur.x += (tgt.x - cur.x) * 0.09; cur.y += (tgt.y - cur.y) * 0.09;
      aim.cur += (aim.target - aim.cur) * 0.06;
      put(cur.x, cur.y);
      starEl.style.transform = `rotate(${aim.cur.toFixed(2)}deg)`;
      const busy = Math.abs(tgt.x - cur.x) > 0.02 || Math.abs(tgt.y - cur.y) > 0.02 || Math.abs(aim.target - aim.cur) > 0.02;
      raf = busy ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (max > 0) {
        tgt.y = clamp((e.clientX - cx) / (window.innerWidth / 2), -1, 1) * max;     // 마우스가 오른쪽이면 오른쪽을 향해 돈다
        tgt.x = -clamp((e.clientY - cy) / (window.innerHeight / 2), -1, 1) * max;   // 마우스가 아래면 아래를 향해 숙인다
      }
      const a = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      if (!aim.init) { aim.init = true; aim.last = a; }
      else {
        let d = a - aim.last;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        aim.last = a; aim.target += d;
      }
      if (!raf) raf = requestAnimationFrame(step);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
      rigEl.style.transform = '';
      starEl.style.transform = '';
    };
  }, [tilt]);

  const vars = cssVars({
    '--ow-k': clamp(size, 10, 400) / 100,
    '--ow-line': lineColor || 'var(--accent)',
    '--ow-pt': pointColor || 'var(--accent)',
    '--ow-sp': sparkColor || 'var(--accent)',
    '--ow-star': clamp(starSize, 10, 400) / 100,     // 별 크기 배율
    '--ow-wb': clamp(boldWidth, 10, 500) / 100,      // 진한 선 굵기 배율
    '--ow-wt': clamp(thinWidth, 10, 500) / 100,      // 얇은 선 굵기 배율
    '--ow-wd': clamp(dashWidth, 10, 500) / 100,      // 점선 굵기 배율
  });
  const rings = ARM_RINGS.slice(0, clamp(Math.round(ringCount), 1, ARM_RINGS.length));

  return (
    <div className="ow" ref={box} style={vars} aria-hidden="true">
      <div className="ow-stage">
        {/* 맨 뒤 — 평면 별 지도: 별자리(천천히 돎)와 반짝이 */}
        <svg className="ow-back" viewBox={`0 0 ${ARM_BOX} ${ARM_BOX}`} focusable="false">
          <g className="cons">
            {ARM_CONS.map((d, i) => <polyline key={i} points={d} />)}
            {ARM_CONS.flatMap((d, i) => d.split(' ').map((pt, j) => {
              const [x, y] = pt.split(',').map(Number);
              return <path key={`c${i}-${j}`} className="cs" d={armSparkle(x, y, 6 + ((i + j) % 3) * 1.5)}
                style={{ animationDelay: `${(((i * 3 + j * 5) % 11) * 0.3).toFixed(1)}s` }} />;
            }))}
          </g>
          <g className="sparks">
            {ARM_SPARKS.map((s, i) => <path key={i} className="sp" d={armSparkle(s.x, s.y, s.arm)} style={{ animationDelay: `${(i % 5) * 0.7}s` }} />)}
          </g>
        </svg>
        {/* 입체 무대 — 고리는 기울며 돌고, 가운데 별은 제자리에 평면으로 고정 (고리가 별의 앞뒤로 지나간다) */}
        <div className="ow-scene">
          <div className="ow-rig" ref={rig}>
            {rings.map((g, i) => <Ring key={i} g={g} />)}
          </div>
          <div className="ow-star">
            <svg ref={star} viewBox="-100 -100 200 200" focusable="false">
              <path transform="rotate(-32)" fillRule="evenodd" d={ARM_STAR_PATH} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
