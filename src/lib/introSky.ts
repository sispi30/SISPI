// 인트로 화면(IntroSplash) 전용 별자리 도형.
// 메인 「별자리 궤도」 위젯의 도형(lib/orbitSky.ts)과는 따로 관리한다 — 여기를 고쳐도 위젯은 바뀌지 않고, 반대도 마찬가지.
// 좌표는 인트로의 1280×720 화면 기준이고, 궤도의 중심은 (640, 360)이다.

export const INTRO_CX = 640;
export const INTRO_CY = 360;

/** 바깥 원형 궤도의 반지름 — 별자리·반짝이는 이 안쪽에만 둔다 */
export const INTRO_OUTER = 268;

export interface IntroRing { r: number; cls?: 'th' | 'tick' | 'gd' | 'dot' | 'dash'; d?: number }
/** 겹겹의 원 (바깥 → 안) — cls는 선 모양(th 가는 선 · tick 눈금 · gd 점선 · dot 점 · dash 긴 점선), d는 등장 지연(초) */
export const INTRO_RINGS: IntroRing[] = [
  { r: 332, d: 0 }, { r: 324, cls: 'th', d: 0.08 }, { r: 312, cls: 'tick', d: 0.16 }, { r: 296, cls: 'gd', d: 0.24 },
  { r: 268, d: 0.32 }, { r: 246, cls: 'dot', d: 0.4 }, { r: 218, d: 0.48 }, { r: 196, cls: 'dash' },
  { r: 168, cls: 'th', d: 0.56 }, { r: 132, cls: 'gd', d: 0.64 },
];

/** 별자리 — 천천히 돌기 때문에, 가장 먼 점이 INTRO_CONS_MAX를 넘으면 돌다가 바깥 궤도 밖으로 나간다.
 *  그래서 각 별자리를 중심 쪽으로 줄여 놓는다 (모양은 그대로, 크기만 조금 작아짐). */
export const INTRO_CONS_MAX = 248;
export const INTRO_CONS: string[] = [
  '470,214 520,192 566,214 590,176', '760,200 812,230 850,214 884,252', '905,352 940,392 912,440 936,480',
  '742,566 700,540 650,572 604,548', '420,470 466,512 440,556', '392,330 430,296 408,254',
  '560,128 604,96 650,118', '830,520 790,556 744,540',
].map(d => {
  const pts = d.split(' ').map(p => p.split(',').map(Number));
  const far = Math.max(...pts.map(([x, y]) => Math.hypot(x - INTRO_CX, y - INTRO_CY)));
  const k = far > INTRO_CONS_MAX ? INTRO_CONS_MAX / far : 1;
  return pts.map(([x, y]) => `${(INTRO_CX + (x - INTRO_CX) * k).toFixed(1)},${(INTRO_CY + (y - INTRO_CY) * k).toFixed(1)}`).join(' ');
});

export interface IntroPlanet { r: number; s: number; a: number; t: number; w: number; half?: boolean; ring?: boolean; rev?: boolean }
/** 궤도를 도는 행성 — r 궤도 반지름 · s 크기 · a 시작 각도 · t 한 바퀴 도는 초 · w 색 진하기(%) */
export const INTRO_PLANETS: IntroPlanet[] = [
  { r: 300, s: 9, a: 0, t: 400, w: 100 }, { r: 300, s: 8, a: 38, t: 400, w: 100, half: true }, { r: 300, s: 8, a: 82, t: 400, w: 100, ring: true },
  { r: 268, s: 13, a: -24, t: 46, w: 85 }, { r: 246, s: 7, a: 52, t: 60, w: 60 },
  { r: 218, s: 9, a: -62, t: 78, w: 50, rev: true }, { r: 168, s: 8, a: -108, t: 95, w: 40 },
];

/** 인트로 화면 곳곳에 흩어 놓은 반짝이 [x, y, 크기] */
export const INTRO_SPARKS: [number, number, number][] = [
  [88, 242, 5], [138, 103, 4], [78, 388, 4], [103, 534, 4], [1112, 52, 3], [1203, 330, 4],
  [1190, 478, 3], [1142, 616, 4], [1226, 660, 4], [290, 86, 3], [980, 150, 3], [420, 640, 3],
];

/** 네 갈래 반짝이 길 — 중심 (x, y), 팔 길이 arm */
export function introSparkle(x: number, y: number, arm: number): string {
  return `M${x} ${y - arm}Q${x} ${y} ${x + arm} ${y}Q${x} ${y} ${x} ${y + arm}Q${x} ${y} ${x - arm} ${y}Q${x} ${y} ${x} ${y - arm}Z`;
}
