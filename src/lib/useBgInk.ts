'use client';
// 배경 밝기에 맞는 글자색 고르기 — 캐릭터마다(또는 사이트 테마마다) 배경이 달라서 글자색을 하나로 정해 둘 수 없다.
// 지금 실제로 깔려 있는 배경을 읽어 평균 밝기를 재고, 밝은 배경이면 어두운 글자('dark'),
// 어두운 배경이면 밝은 글자('light')를 돌려준다.
//
// 배경은 두 가지 중 하나로 적용되어 있다 (ThemeProvider · globals.css의 body):
//   1) --bg-image : 배경 이미지(캐릭터 배경 사진 또는 환경설정 배경) — 글자가 놓이는 좌·우 영역의 평균 밝기
//   2) --bg-g1 / --bg-g2 : 그라데이션 두 색의 평균 밝기
// 이미지는 화면에 cover로 깔리므로 같은 방식으로 작은 캔버스에 그려 좌·우 글자 영역만 잰다.
// (다른 도메인 이미지가 CORS로 막혀 못 읽으면 그라데이션 값으로 대신한다)
import { useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type BgInk = 'light' | 'dark';   // light = 밝은 글자색(어두운 배경) · dark = 어두운 글자색(밝은 배경)

/** 이 값보다 배경이 밝으면(상대 휘도) 어두운 글자 — WCAG 대비 역전 지점(≈0.18)보다 살짝 높게 잡아,
 *  글자 그림자가 받쳐 주는 밝은 글자를 중간 밝기까지 더 쓴다 */
const DARK_INK_ABOVE = 0.24;

function lin(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
const lumOf = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** CSS 색 문자열(hex·rgb·hsl·이름) → 상대 휘도. 해석 못 하면 null */
function colorLum(css: string): number | null {
  const c = css.trim();
  if (!c) return null;
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const read = (base: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = base; ctx.fillStyle = c;   // 해석 못 하면 base가 그대로 남는다
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data;
  };
  const a = read('#000000'), b = read('#ffffff');
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) return null;   // 두 바탕에서 다르면 잘못된 색
  return lumOf(a[0], a[1], a[2]);
}

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImg(url: string): Promise<HTMLImageElement | null> {
  let p = imgCache.get(url);
  if (!p) {
    p = new Promise(resolve => {
      const im = new Image();
      if (!url.startsWith('blob:') && !url.startsWith('data:')) im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = url;
    });
    imgCache.set(url, p);
  }
  return p;
}

/** 이미 잰 사진 밝기 — 같은 사진·같은 화면 크기면 다시 재지 않고, 첫 그리기 전에 바로 쓴다 */
const lumCache = new Map<string, number>();
const lumKey = (url: string) => `${url}|${window.innerWidth}x${window.innerHeight}`;

/** 화면에 cover로 깔았을 때, 글자가 놓이는 좌·우 영역의 평균 상대 휘도 */
async function imageLum(url: string): Promise<number | null> {
  const key = lumKey(url);
  const hit = lumCache.get(key);
  if (hit != null) return hit;
  const r = await imageLumRaw(url);
  if (r != null) lumCache.set(key, r);
  return r;
}
async function imageLumRaw(url: string): Promise<number | null> {
  const im = await loadImg(url);
  if (!im || !im.naturalWidth) return null;
  const W = 96;
  const H = Math.max(24, Math.round(W * (window.innerHeight / Math.max(1, window.innerWidth))));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, W, H).data; } catch { return null; }   // CORS로 오염된 캔버스
  const y0 = Math.floor(H * 0.1), y1 = Math.ceil(H * 0.95);
  const zones: [number, number][] = [[Math.floor(W * 0.04), Math.ceil(W * 0.34)], [Math.floor(W * 0.62), Math.ceil(W * 0.97)]];
  let sum = 0, n = 0;
  for (const [x0, x1] of zones) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] < 8) continue;   // 투명 픽셀은 제외
        sum += lumOf(data[i], data[i + 1], data[i + 2]); n++;
      }
    }
  }
  return n ? sum / n : null;
}

/** 지금 깔린 배경의 상대 휘도 (0~1). 읽을 수 없으면 null */
async function measureBgLuminance(): Promise<number | null> {
  const cs = getComputedStyle(document.documentElement);
  const m = cs.getPropertyValue('--bg-image').match(/url\(\s*["']?(.+?)["']?\s*\)/);
  if (m) {
    const l = await imageLum(m[1]);
    if (l != null) return l;
  }
  const g1 = colorLum(cs.getPropertyValue('--bg-g1'));
  const g2 = colorLum(cs.getPropertyValue('--bg-g2'));
  if (g1 != null && g2 != null) return (g1 + g2) / 2;
  return g1 ?? g2;
}

/** 기다리지 않고 바로 잴 수 있는 만큼만 — 이미 잰 사진이면 그 값, 아니면 그라데이션 두 색.
 *  첫 그리기 전에 글자색을 정해 「어두운 배경용 글자색이 잠깐 비쳤다가 바뀌는」 깜빡임을 없앤다 */
function measureBgLuminanceNow(): number | null {
  const cs = getComputedStyle(document.documentElement);
  const m = cs.getPropertyValue('--bg-image').match(/url\(\s*["']?(.+?)["']?\s*\)/);
  if (m) {
    const hit = lumCache.get(lumKey(m[1]));
    if (hit != null) return hit;
  }
  const g1 = colorLum(cs.getPropertyValue('--bg-g1'));
  const g2 = colorLum(cs.getPropertyValue('--bg-g2'));
  if (g1 != null && g2 != null) return (g1 + g2) / 2;
  return g1 ?? g2;
}

/** 배경 밝기에 맞는 글자색 종류. 배경(이미지·테마·캐릭터 색)이 바뀌면 다시 잰다 */
export function useBgInk(): BgInk {
  const [ink, setInk] = useState<BgInk>('light');
  // 첫 그리기 전에 한 번 바로 잰다 — 기다렸다 재면(아래) 밝은 배경에서도 160ms 동안 밝은 글자색으로 먼저 그려졌다가 바뀌며 깜빡였다
  useIsoLayoutEffect(() => {
    const l = measureBgLuminanceNow();
    if (l != null) setInk(l > DARK_INK_ABOVE ? 'dark' : 'light');
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const apply = (l: number | null) => {
      if (alive && l != null) setInk(l > DARK_INK_ABOVE ? 'dark' : 'light');
    };
    const run = async () => apply(await measureBgLuminance());
    // 테마 적용(effect)이 이 화면의 effect보다 늦게 도는 경우가 있어 한 박자 늦춰 다시 재고(사진 밝기 등),
    // 배경 변수가 바뀔 때마다(style 속성 변화) 먼저 바로 잰 값을 반영하고 다시 잰다
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 160); };
    const onChange = () => {
      const l = measureBgLuminanceNow();
      if (l != null) {
        const next: BgInk = l > DARK_INK_ABOVE ? 'dark' : 'light';
        // 그리기 전에 반영 — 테마가 바뀐 같은 프레임에 글자색도 같이 바뀐다
        try { flushSync(() => { if (alive) setInk(next); }); } catch { apply(l); }
      }
      void run();   // 사진 밝기는 불러오는 대로 바로 반영 (기다리던 160ms를 줄인다)
      schedule();
    };
    schedule();
    const mo = new MutationObserver(onChange);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    window.addEventListener('resize', schedule);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return ink;
}
