'use client';
// 마우스 효과 (사용자 요청) — 기존 그누보드 사이트(sispi.dothome.co.kr)의 두 효과를 그대로 옮김.
//  ① 클릭: ✦ 4각 별이 클릭한 자리에서 위로 떠오르며 커지고 사라짐 (랜덤 회전 · 파랑 3색)
//  ③ 클릭 선: 클릭한 자리마다 은은한 점이 생기고, 직전에 클릭한 점과 가는 선으로 이어졌다 서서히 사라짐
//  ② 이동: 반짝이 — 커서가 지나간 자리에 작은 4각 별이 점점이 남아 반짝이다 사라짐 (최대 개수 설정)
// 원본은 전역 이벤트를 덮어쓰고 body에 직접 붙였지만, 여기서는 리스너를 추가/해제만 하고
// 고정 컨테이너 안에서만 그린다 (pointer-events:none · 다른 화면 요소에 영향 없음).
// 터치 입력과 시스템의 「동작 줄이기」 설정에서는 동작하지 않는다.
import { useEffect } from 'react';
import { normFx, useCursorSettings } from '@/lib/cursorStore';
const FRAME = 1000 / 60;

interface ClickStar { el: HTMLDivElement; x: number; y: number; scale: number; alpha: number; rot: number }

export function MouseFx() {
  // 환경 설정 > 마우스 커서 > 마우스 효과 — 켜기/끄기 · 반짝이 개수 · 색 (바뀌면 즉시 다시 구성)
  const [cs, , loaded] = useCursorSettings();
  const fx = normFx(cs.fx);
  const colorKey = fx.colors.join('|');

  useEffect(() => {
    if (typeof window === 'undefined' || !loaded) return;
    if (!fx.click && !fx.trail && !fx.line) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const COLORS = colorKey.split('|');
    const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];
    const SPARKLES = fx.count;

    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:99999';
    document.body.appendChild(box);

    /* ── ③ 클릭 선 (캔버스) ── */
    const LIFE = fx.lineLife * 1000, DRAW = 260;
    interface Node { x: number; y: number; t: number }
    interface Seg { a: Node; b: Node }
    const nodes: Node[] = [], segs: Seg[] = [];
    let canvas: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, dpr = 1;
    const resize = () => {
      if (!canvas) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = '100%'; canvas.style.height = '100%';
    };
    if (fx.line || fx.trail) {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      box.appendChild(canvas); ctx = canvas.getContext('2d'); resize();
      window.addEventListener('resize', resize);
    }
    const onLineClick = (e: MouseEvent) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const now = performance.now();
      const n: Node = { x: e.clientX, y: e.clientY, t: now };
      const prev = nodes[nodes.length - 1];
      if (prev && now - prev.t < LIFE) { segs.push({ a: prev, b: n }); if (segs.length > 40) segs.shift(); }
      nodes.push(n); if (nodes.length > 41) nodes.shift();
    };
    const drawLines = (now: number) => {
      if (!ctx || !canvas) return;
      const fade = (t: number) => { const k = (now - t) / LIFE; return k >= 1 ? 0 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; };
      ctx.strokeStyle = fx.lineColor; ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (const s of segs) {
        const al = fade(s.b.t); if (al <= 0) continue;
        const p = Math.min(1, (now - s.b.t) / DRAW), e = 1 - Math.pow(1 - p, 3);   // 선이 점에서 점으로 그어짐
        ctx.globalAlpha = al * 0.8;
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y);
        ctx.lineTo(s.a.x + (s.b.x - s.a.x) * e, s.a.y + (s.b.y - s.a.y) * e); ctx.stroke();
      }
      ctx.fillStyle = fx.lineColor;
      for (const n of nodes) {
        const al = fade(n.t); if (al <= 0) continue;
        const pop = Math.min(1, (now - n.t) / 180);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 9 * pop + 1);
        g.addColorStop(0, fx.lineColor); g.addColorStop(1, 'transparent');
        ctx.globalAlpha = al * 0.35; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, 9 * pop + 1, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = al; ctx.fillStyle = fx.lineColor;
        ctx.save(); ctx.translate(n.x, n.y); starPath(ctx, 3.5 * pop + 0.5); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      while (nodes.length && fade(nodes[0].t) <= 0) nodes.shift();
      while (segs.length && fade(segs[0].b.t) <= 0) segs.shift();
    };

    /* ── ① 클릭 별 ── */
    const style = document.createElement('style');
    style.textContent = '.mfx-star{width:16px;height:16px;position:fixed;pointer-events:none;'
      + 'clip-path:polygon(50% 0%,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0% 50%,42% 42%)}';
    document.head.appendChild(style);

    const stars: ClickStar[] = [];
    const onClick = (e: MouseEvent) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const el = document.createElement('div');
      el.className = 'mfx-star';
      el.style.background = pick();
      el.style.left = (e.clientX - 8) + 'px'; el.style.top = (e.clientY - 8) + 'px';   // 첫 프레임에 구석에 보이지 않게
      box.appendChild(el);
      stars.push({ el, x: e.clientX - 8, y: e.clientY - 8, scale: 1, alpha: 1, rot: Math.floor(Math.random() * 360) });
    };

    /* ── ② 이동 반짝이 — 지나간 자리에 작은 4각 별이 남아 반짝이다 사라짐 (캔버스) ── */
    interface Spark { x: number; y: number; r: number; rot: number; t: number; life: number; c: string }
    const sparks: Spark[] = [];
    let mx = -1, my = -1, lx = -1, ly = -1;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      if (lx < 0) { lx = mx; ly = my; return; }
      if (Math.hypot(mx - lx, my - ly) < 16) return;        // 일정 거리마다 하나씩 — 궤적을 따라 점점이 남는다
      lx = mx; ly = my;
      if (sparks.length >= SPARKLES) sparks.shift();
      sparks.push({
        x: mx + (Math.random() - 0.5) * 6, y: my + (Math.random() - 0.5) * 6,
        r: 3 + Math.random() * 3.5, rot: Math.random() * Math.PI / 2,
        t: performance.now(), life: 700 + Math.random() * 500, c: pick(),
      });
    };
    const starPath = (c: CanvasRenderingContext2D, r: number) => {
      c.beginPath(); c.moveTo(0, -r);
      c.quadraticCurveTo(0, 0, r, 0); c.quadraticCurveTo(0, 0, 0, r);
      c.quadraticCurveTo(0, 0, -r, 0); c.quadraticCurveTo(0, 0, 0, -r); c.closePath();
    };
    const drawSparks = (c: CanvasRenderingContext2D, now: number) => {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const q = sparks[i], k = (now - q.t) / q.life;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        const pop = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;       // 커졌다가 작아지며 사라짐
        const r = q.r * (0.4 + 0.6 * pop);
        c.save(); c.translate(q.x, q.y);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
        g.addColorStop(0, q.c); g.addColorStop(1, 'transparent');
        c.globalAlpha = 0.22 * pop; c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r * 2.6, 0, Math.PI * 2); c.fill();   // 은은한 번짐
        c.globalAlpha = Math.min(1, pop * 1.4); c.fillStyle = q.c;
        c.rotate(q.rot + k * 0.6); starPath(c, r); c.fill();
        c.restore();
      }
    };

    /* ── 한 루프로 구동 (주사율이 달라도 원본과 같은 속도) ── */
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last); last = now;
      const k = dt / FRAME;
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        if (s.alpha <= 0) { s.el.remove(); stars.splice(i, 1); continue; }
        s.y -= k; s.scale += 0.004 * k; s.alpha -= 0.013 * k;
        s.el.style.cssText = `left:${s.x}px;top:${s.y}px;opacity:${Math.max(0, s.alpha)};`
          + `transform:scale(${s.scale},${s.scale}) rotate(${s.rot}deg);background:${s.el.style.background}`;
      }
      if (ctx && canvas) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (fx.line) drawLines(now);
        if (fx.trail) drawSparks(ctx, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    if (fx.click) window.addEventListener('click', onClick);
    if (fx.line) window.addEventListener('click', onLineClick);
    if (fx.trail) window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('click', onClick);
      window.removeEventListener('click', onLineClick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      box.remove();
      style.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fx.click, fx.trail, fx.count, colorKey, fx.line, fx.lineColor, fx.lineLife]);

  return null;
}
