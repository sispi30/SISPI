'use client';
// 배경 혜성 파티클 (사용자 요청) — 배경 위·콘텐츠 아래에서 혜성이 비스듬히 가로지르고,
// 길쭉한 빛 조각이 깜빡이며, 작은 별이 반짝인다. 환경설정 > 디자인 > 배경 > 「혜성 파티클」로 켜고 끈다.
// 캔버스 하나만 쓰고 pointer-events:none · 탭이 숨겨지면 rAF가 멈춰 부담이 없다.
// 시스템의 「동작 줄이기」 설정에서는 그리지 않는다.
import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/ThemeProvider';

interface Comet { x: number; y: number; vx: number; vy: number; ang: number; tail: number; age: number; life: number; head: number }
interface Glint { x: number; y: number; vx: number; vy: number; len: number; ph: number; sp: number }
interface Dot { x: number; y: number; r: number; ph: number; sp: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function CometLayer() {
  const { state } = useTheme();
  const on = !!state.vars.bgComet;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!on) return;
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;
    const comets: Comet[] = [];
    let glints: Glint[] = [];
    let dots: Dot[] = [];

    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 화면 넓이에 비례 (1920×1080 기준 별 36 · 빛 조각 14), 좁은 화면은 적게
      const k = Math.max(0.35, Math.min(1.4, (W * H) / (1920 * 1080)));
      dots = Array.from({ length: Math.round(36 * k) }, () => ({
        x: rnd(0, W), y: rnd(0, H), r: rnd(0.5, 1.3), ph: rnd(0, 6.28), sp: rnd(0.6, 1.8),
      }));
      glints = Array.from({ length: Math.round(14 * k) }, () => ({
        x: rnd(0, W), y: rnd(0, H), vx: rnd(-6, 10), vy: rnd(-8, 4), len: rnd(7, 13), ph: rnd(0, 6.28), sp: rnd(0.5, 1.4),
      }));
    };

    const spawn = () => {
      // 왼쪽에서 오른쪽 위로 살짝 치솟으며 지나감 (원본 GIF의 방향) — 꼬리는 가늘고 길게
      const ang = -rnd(5, 14) * Math.PI / 180;
      const speed = rnd(260, 430);
      comets.push({
        x: rnd(-0.1, 0.65) * W, y: rnd(0.18, 0.9) * H,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ang,
        tail: rnd(180, 420), age: 0, life: rnd(2.6, 4.2), head: rnd(1.6, 2.8),
      });
    };

    const drawComet = (c: Comet) => {
      const t = c.age / c.life;
      const a = Math.min(1, t / 0.15) * Math.min(1, (1 - t) / 0.35);   // 나타나고 사라지는 곡선
      if (a <= 0) return;
      const ux = Math.cos(c.ang), uy = Math.sin(c.ang);
      const tx = c.x - ux * c.tail, ty = c.y - uy * c.tail;
      const g = ctx.createLinearGradient(tx, ty, c.x, c.y);
      g.addColorStop(0, 'rgba(235,240,255,0)');
      g.addColorStop(1, `rgba(235,242,255,${0.5 * a})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(c.x, c.y); ctx.stroke();
      // 머리 — 작은 빛무리
      const r = c.head * 5;
      const h = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      h.addColorStop(0, `rgba(255,255,255,${0.95 * a})`);
      h.addColorStop(0.35, `rgba(220,232,255,${0.45 * a})`);
      h.addColorStop(1, 'rgba(220,232,255,0)');
      ctx.fillStyle = h; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 6.283); ctx.fill();
    };

    let raf = 0, last = performance.now(), nextSpawn = 0.4;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);

      // 별 반짝임
      for (const d of dots) {
        d.ph += d.sp * dt;
        const a = 0.15 + 0.6 * (0.5 + 0.5 * Math.sin(d.ph * 2));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      }

      // 길쭉한 빛 조각 — 서서히 밝아졌다 꺼지며 천천히 떠다닌다
      for (const g of glints) {
        g.ph += g.sp * dt; g.x += g.vx * dt; g.y += g.vy * dt;
        if (g.x < -20) g.x = W + 20; else if (g.x > W + 20) g.x = -20;
        if (g.y < -20) g.y = H + 20; else if (g.y > H + 20) g.y = -20;
        const a = Math.max(0, Math.sin(g.ph)) ** 2 * 0.85;
        if (a < 0.02) continue;
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(-0.55);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, g.len);
        gr.addColorStop(0, `rgba(255,255,255,${a})`);
        gr.addColorStop(0.4, `rgba(225,235,255,${a * 0.4})`);
        gr.addColorStop(1, 'rgba(225,235,255,0)');
        ctx.fillStyle = gr; ctx.scale(1, 0.32);
        ctx.beginPath(); ctx.arc(0, 0, g.len, 0, 6.283); ctx.fill();
        ctx.restore();
      }

      // 혜성
      nextSpawn -= dt;
      if (nextSpawn <= 0 && comets.length < 4) { spawn(); nextSpawn = rnd(1.1, 3.4); }
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.age += dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.age >= c.life || c.x - c.tail > W + 40) { comets.splice(i, 1); continue; }
        drawComet(c);
      }
      raf = requestAnimationFrame(loop);
    };

    fit();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', fit);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, [on]);

  if (!on) return null;
  // z-index -1 : 배경 이미지(body::before) 바로 위, 모든 콘텐츠의 아래
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }} />;
}
