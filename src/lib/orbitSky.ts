// 메인 「별자리 궤도」 위젯 전용 도형 — 혼천의(Armillary Sphere)처럼 여러 고리가 서로 다른 축으로 도는 모양.
// 인트로 화면의 도형(lib/introSky.ts)과는 따로 관리한다 — 여기를 고쳐도 인트로는 바뀌지 않고, 반대도 마찬가지.
// 좌표는 모두 700×700 상자(중심 350,350) 기준 — 위젯 한 변이 700이라고 보고 적은 값이고, 실제 크기에 맞게 비례해 줄고 늘어난다.

export const ARM_BOX = 700;
export const ARM_C = ARM_BOX / 2;

/** 고리 한 겹의 선 모양 — gold 굵고 밝은 고리 · band 눈금 띠 · line 보통 선 · th 가는 선 · dash 긴 점선 · dot 점점이 */
export type ArmStyle = 'gold' | 'band' | 'line' | 'th' | 'dash' | 'dot';

/** 고리 위를 도는 알갱이(행성) */
export interface ArmBead {
  a: number;          // 고리 위 시작 위치 (°, 위쪽이 0)
  s: number;          // 크기 (700 상자 기준 반지름)
  hollow?: boolean;   // 속이 빈 둥근 테두리 모양
}

export interface ArmRing {
  d: number;                    // 지름 — 위젯 한 변을 1로 본 값 (0.84면 칸의 84%). 바깥 구의 지름은 0.84
  rx: number;                   // 고리 면의 기울기(°) — 0 = 회전축을 지나는 세로 고리(자오선) · 90 = 축에 수직인 가로 고리(적도) · 66.5 = 적도에서 23.5° 기운 고리(황도)
  axis?: [number, number];      // 회전축을 기울이는 각 [앞뒤, 좌우] (°) — 없으면 똑바로 선 축. 고리마다 다른 축으로 돌아야 혼천의처럼 어긋나며 돈다
  spin?: number;                // 축을 중심으로 한 바퀴 도는 초 (음수면 반대 방향, 없으면 축 회전 없음)
  phase?: number;               // 처음 돌아가 있는 정도 0~1 — 같은 속도로 도는 두 고리를 직각으로 엇갈려 놓을 때
  turn?: number;                // 고리 면 안에서 알갱이·점선이 한 바퀴 흐르는 초 (음수면 반대, 없으면 안 흐름)
  y?: number;                   // 축을 따라 옮긴 높이(지름 대비) — 회귀선처럼 위아래로 떨어진 작은 가로 고리용
  style: ArmStyle;
  beads?: ArmBead[];
}

/** 고리들 — 바깥 구(지름 0.84) 위의 큰 고리 넷, 회귀선 둘, 안쪽에서 다른 축으로 도는 둘. 앞에 있을수록 먼저 보이는 고리 */
export const ARM_RINGS: ArmRing[] = [
  // 큰 틀 — 같은 크기의 네 고리
  { d: 0.84, rx: 0, spin: 54, style: 'gold', beads: [{ a: 0, s: 11 }, { a: 180, s: 7, hollow: true }] },     // 자오선 (굵고 밝은 고리)
  { d: 0.84, rx: 0, spin: 54, phase: 0.25, style: 'line', beads: [{ a: 90, s: 6 }] },                        // 위와 직각으로 엇갈린 자오선
  { d: 0.84, rx: 90, turn: 120, style: 'band', beads: [{ a: 40, s: 8 }] },                                   // 적도 (눈금 띠)
  { d: 0.84, rx: 66.5, spin: -80, turn: -70, style: 'dash', beads: [{ a: 200, s: 9 }] },                      // 황도 (적도에서 기울어 천천히 도는 고리)
  // 회귀선 — 위아래로 떨어진 작은 가로 고리
  { d: 0.77, rx: 90, y: -0.167, turn: 90, style: 'dot' },
  { d: 0.77, rx: 90, y: 0.167, turn: -90, style: 'dot' },
  // 안쪽 고리 — 서로 다른 축으로 도는 둘
  { d: 0.6, rx: 0, axis: [0, 38], spin: -36, style: 'th', beads: [{ a: 120, s: 7 }] },
  { d: 0.46, rx: 62, axis: [48, -24], spin: 30, style: 'th', beads: [{ a: 300, s: 6, hollow: true }] },
  // 여기부터는 기본으로는 안 보이고, 「선 개수」를 늘리면 차례로 더해진다 — 사이사이 자오선 둘, 극권 둘
  { d: 0.84, rx: 0, spin: 54, phase: 0.125, style: 'th' },
  { d: 0.84, rx: 0, spin: 54, phase: 0.375, style: 'th' },
  { d: 0.464, rx: 90, y: -0.35, turn: 110, style: 'dot' },
  { d: 0.464, rx: 90, y: 0.35, turn: -110, style: 'dot' },
];
/** 기본으로 보이는 고리 수 (목록 앞에서부터 센다) — 설정의 「선 개수」 기본값. 최대는 ARM_RINGS.length */
export const ARM_DEFAULT_COUNT = 8;

/** 별자리 — 고리 뒤에 평면으로 깔려 천천히 도는 별 지도. 가장 먼 점이 ARM_CONS_MAX를 넘으면 바깥 구 밖으로 삐져나오니
 *  각 별자리를 중심 쪽으로 줄여 놓는다 (모양은 그대로, 크기만 조금 작아짐). */
export const ARM_CONS_MAX = 250;
export const ARM_CONS: string[] = [
  '180,204 230,182 276,204 300,166', '470,190 522,220 560,204 594,242', '615,342 650,382 622,430 646,470',
  '452,556 410,530 360,562 314,538', '130,460 176,502 150,546', '102,320 140,286 118,244',
  '270,118 314,86 360,108', '540,510 500,546 454,530',
].map(d => {
  const pts = d.split(' ').map(p => p.split(',').map(Number));
  const far = Math.max(...pts.map(([x, y]) => Math.hypot(x - ARM_C, y - ARM_C)));
  const k = far > ARM_CONS_MAX ? ARM_CONS_MAX / far : 1;
  return pts.map(([x, y]) => `${(ARM_C + (x - ARM_C) * k).toFixed(1)},${(ARM_C + (y - ARM_C) * k).toFixed(1)}`).join(' ');
});

/** 별 지도 위에 흩어 놓은 반짝이 [각도(°), 중심에서의 거리, 팔 길이] — 거리는 바깥 구 반지름(294) 안쪽 */
const SPARK_POLAR: [number, number, number][] = [
  [20, 262, 10], [75, 250, 8], [130, 268, 12], [185, 255, 9], [240, 266, 11], [300, 250, 8], [340, 240, 10],
  [50, 170, 8], [160, 190, 9], [262, 140, 7], [318, 205, 8],
];
export const ARM_SPARKS = SPARK_POLAR.map(([a, r, arm]) => {
  const rad = a * Math.PI / 180;
  return { x: +(ARM_C + r * Math.cos(rad)).toFixed(1), y: +(ARM_C + r * Math.sin(rad)).toFixed(1), arm };
});

/** 네 갈래 반짝이 길 — 중심 (x, y), 팔 길이 arm */
export function armSparkle(x: number, y: number, arm: number): string {
  return `M${x} ${y - arm}Q${x} ${y} ${x + arm} ${y}Q${x} ${y} ${x} ${y + arm}Q${x} ${y} ${x - arm} ${y}Q${x} ${y} ${x} ${y - arm}Z`;
}

/** 가운데 네 갈래 별(속이 빈 별) 길 — -100~100 상자 기준. 별은 고정된 채 마우스를 따라 제자리에서 돈다 */
export const ARM_STAR_PATH = 'M0 -96Q1.6 -1.6 96 0Q1.6 1.6 0 96Q-1.6 1.6 -96 0Q-1.6 -1.6 0 -96ZM0 -30Q-3 -3 -30 0Q-3 3 0 30Q3 3 30 0Q3 -3 0 -30Z';
