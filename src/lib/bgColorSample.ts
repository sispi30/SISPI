'use client';
// 지금 화면에 깔린 배경(사진 또는 그라데이션)에서 특정 영역의 평균 색을 읽는다 — 메뉴 위젯 서브메뉴 박스 색을 주변 배경에 맞출 때 쓴다.
// 사진은 화면에 cover로 깔리므로 작은 캔버스에 같은 방식으로 그려 해당 영역만 잰다. CORS로 막혀 못 읽으면 그라데이션 값으로 대신한다.

export interface Rgb { r: number; g: number; b: number }
export interface Box { x: number; y: number; w: number; h: number }

function parseRgb(css: string): Rgb | null {
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
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) return null;
  return { r: a[0], g: a[1], b: a[2] };
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

async function imageAvg(url: string, box: Box): Promise<Rgb | null> {
  const im = await loadImg(url);
  if (!im || !im.naturalWidth) return null;
  const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
  const W = 128, H = Math.max(32, Math.round(W * (vh / vw)));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const x0 = Math.max(0, Math.floor(box.x / vw * W)), x1 = Math.min(W, Math.max(x0 + 1, Math.ceil((box.x + box.w) / vw * W)));
  const y0 = Math.max(0, Math.floor(box.y / vh * H)), y1 = Math.min(H, Math.max(y0 + 1, Math.ceil((box.y + box.h) / vh * H)));
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; } catch { return null; }   // CORS로 오염된 캔버스
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return n ? { r: r / n, g: g / n, b: b / n } : null;
}

/** 두 색 --bg-g1 → --bg-g2 를 --bg-angle 방향으로 깐 선형 그라데이션의 (x, y) 지점 색 (CSS 각도 규칙) */
function gradientAt(cs: CSSStyleDeclaration, box: Box): Rgb | null {
  const g1 = parseRgb(cs.getPropertyValue('--bg-g1'));
  const g2 = parseRgb(cs.getPropertyValue('--bg-g2'));
  if (!g1 && !g2) return null;
  if (!g1 || !g2) return g1 ?? g2;
  const ang = parseFloat(cs.getPropertyValue('--bg-angle')) || 180;
  const th = ang * Math.PI / 180;
  const vw = window.innerWidth, vh = window.innerHeight;
  const L = Math.abs(vw * Math.sin(th)) + Math.abs(vh * Math.cos(th)) || 1;
  const cx = box.x + box.w / 2 - vw / 2, cy = box.y + box.h / 2 - vh / 2;
  const t = Math.min(1, Math.max(0, (cx * Math.sin(th) - cy * Math.cos(th)) / L + 0.5));
  return { r: g1.r + (g2.r - g1.r) * t, g: g1.g + (g2.g - g1.g) * t, b: g1.b + (g2.b - g1.b) * t };
}

/** 영역 box(화면 좌표) 뒤에 깔린 배경의 평균 색. 읽을 수 없으면 null */
export async function sampleBgColor(box: Box): Promise<Rgb | null> {
  const cs = getComputedStyle(document.documentElement);
  const m = cs.getPropertyValue('--bg-image').match(/url\(\s*["']?(.+?)["']?\s*\)/);
  if (m) {
    const c = await imageAvg(m[1], box);
    if (c) {
      const br = parseFloat(cs.getPropertyValue('--bg-brightness')) || 1;
      return { r: Math.min(255, c.r * br), g: Math.min(255, c.g * br), b: Math.min(255, c.b * br) };
    }
  }
  return gradientAt(cs, box);
}

/** 상대 휘도 0~1 */
export function rgbLum({ r, g, b }: Rgb): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
