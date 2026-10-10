'use client';
// 지금 깔린 배경(캐릭터 배경 이미지 또는 테마 그라데이션)의 평균 색과 밝기를 잰다 —
// 항목 서랍이 그 배경에 맞는 색(밝은 배경이면 밝은 서랍·어두운 글자, 어두우면 반대)을 고르는 데 쓴다.
// 읽을 수 없으면(다른 도메인 이미지가 CORS로 막힘) 테마 그라데이션 두 색의 평균으로 대신한다.
import { useEffect, useState } from 'react';

export type BgTone = { r: number; g: number; b: number; lum: number };

const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lumOf = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const mk = (r: number, g: number, b: number): BgTone => ({ r, g, b, lum: lumOf(r, g, b) });

/** CSS 색 문자열 → [r,g,b]. 해석 못 하면 null */
function parseColor(css: string): [number, number, number] | null {
  const c = css.trim(); if (!c) return null;
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const read = (base: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = base; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return ctx.getImageData(0, 0, 1, 1).data; };
  const a = read('#000000'), b = read('#ffffff');
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) return null;
  return [a[0], a[1], a[2]];
}

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const im = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = url;
  });
}

async function imageTone(url: string): Promise<BgTone | null> {
  const im = await loadImg(url);
  if (!im || !im.naturalWidth) return null;
  const W = 48, H = Math.max(12, Math.round(W * (window.innerHeight / Math.max(1, window.innerWidth))));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); if (!ctx) return null;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  let d: Uint8ClampedArray;
  try { d = ctx.getImageData(0, 0, W, H).data; } catch { return null; }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return n ? mk(Math.round(r / n), Math.round(g / n), Math.round(b / n)) : null;
}

async function measure(): Promise<BgTone | null> {
  const cs = getComputedStyle(document.documentElement);
  const m = cs.getPropertyValue('--bg-image').match(/url\(\s*["']?(.+?)["']?\s*\)/);
  if (m) { const t = await imageTone(m[1]); if (t) return t; }
  const g1 = parseColor(cs.getPropertyValue('--bg-g1')), g2 = parseColor(cs.getPropertyValue('--bg-g2'));
  if (g1 && g2) return mk(Math.round((g1[0] + g2[0]) / 2), Math.round((g1[1] + g2[1]) / 2), Math.round((g1[2] + g2[2]) / 2));
  const one = g1 ?? g2; return one ? mk(one[0], one[1], one[2]) : null;
}

export function useBgTone(): BgTone | null {
  const [tone, setTone] = useState<BgTone | null>(null);
  useEffect(() => {
    let alive = true;
    measure().then(t => { if (alive && t) setTone(t); });
    return () => { alive = false; };
  }, []);
  return tone;
}
