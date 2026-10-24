'use client';
// 홈페이지 배경색이 밝은지 알려 준다 — 갤러리 썸네일의 아래 그라데이션·글자색을 배경에 맞추기 위함.
// 배경 그라데이션 두 색(--bg-g1, --bg-g2)의 평균 밝기를 보고, 테마·화면이 바뀌면 다시 잰다.
import { useEffect, useState } from 'react';

function lumaOf(css: string, cx: CanvasRenderingContext2D): number | null {
  const s = css.trim();
  if (!s) return null;
  cx.fillStyle = '#000';
  cx.fillStyle = s;
  const v = cx.fillStyle as string;   // 정규화: #rrggbb 또는 rgba(...)
  let r: number, g: number, b: number;
  if (v.startsWith('#')) {
    const h = v.length === 4 ? v.replace(/./g, (c, i) => (i ? c + c : c)) : v;
    r = parseInt(h.slice(1, 3), 16); g = parseInt(h.slice(3, 5), 16); b = parseInt(h.slice(5, 7), 16);
  } else {
    const m = v.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    [r, g, b] = m.map(Number);
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function measure(): boolean {
  try {
    const cx = document.createElement('canvas').getContext('2d');
    if (!cx) return false;
    const cs = getComputedStyle(document.documentElement);
    const a = lumaOf(cs.getPropertyValue('--bg-g1'), cx);
    const b = lumaOf(cs.getPropertyValue('--bg-g2'), cx);
    const xs = [a, b].filter((x): x is number => x != null);
    if (!xs.length) return false;
    return xs.reduce((p, c) => p + c, 0) / xs.length > 0.55;
  } catch { return false; }
}

export function useBgLight(enabled: boolean): boolean {
  const [light, setLight] = useState(false);
  useEffect(() => {
    if (!enabled) { setLight(false); return; }
    const run = () => setLight(measure());
    run();
    const root = document.documentElement;
    const mo = new MutationObserver(run);
    mo.observe(root, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    return () => mo.disconnect();
  }, [enabled]);
  return light;
}
