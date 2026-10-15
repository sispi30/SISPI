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
    if (!fx.click && !fx.trail && !fx.line && !fx.burst) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const COLORS = colorKey.split('|');
    const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];
    const SPARKLES = fx.count;

    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:99999';
    document.body.appendChild(box);

    /* 빛번짐용 — 'transparent'로 끝나는 그라디언트는 중간이 회색(검정 섞임)으로 보여서,
       같은 색의 투명도만 낮춘 값을 쓴다. 어떤 CSS 색 표기든 한 번 풀어서 캐시한다. */
    const rgbCache = new Map<string, [number, number, number]>();
    const probe = document.createElement('canvas'); probe.width = probe.height = 1;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    const rgba = (col: string, a: number) => {
      let v = rgbCache.get(col);
      if (!v) {
        v = [111, 101, 119];
        if (pctx) {
          pctx.clearRect(0, 0, 1, 1); pctx.fillStyle = '#000'; pctx.fillStyle = col; pctx.fillRect(0, 0, 1, 1);
          const d = pctx.getImageData(0, 0, 1, 1).data; v = [d[0], d[1], d[2]];
        }
        rgbCache.set(col, v);
      }
      return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
    };

    /* ── ③ 클릭 선 (캔버스) ── */
    const LIFE = fx.lineLife * 1000, DRAW = 420;
    interface Dust { dx: number; dy: number; r: number; ph: number; sp: number; star: boolean }
    interface Node { x: number; y: number; t: number; dust: Dust[] }
    interface Seg { a: Node; b: Node }
    const nodes: Node[] = [], segs: Seg[] = [];
    let anchor: { x: number; y: number } | null = null;
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
      // 클릭 선 효과에는 둘레에 흩어지는 반짝이 없이 점과 선만 남긴다
      const dust: Dust[] = [];
      for (let i = 0; i < 0; i++) {
        const ang = Math.random() * Math.PI * 2, d = 14 + Math.random() * 54;
        dust.push({ dx: Math.cos(ang) * d, dy: Math.sin(ang) * d, r: 0.8 + Math.random() * 2.6,
          ph: Math.random() * 6.28, sp: 0.004 + Math.random() * 0.006, star: Math.random() < 0.45 });
      }
      const n: Node = { x: e.clientX, y: e.clientY, t: now, dust };
      // 선은 「직전에 클릭한 자리」에서 이번 자리로 — 직전 클릭이 오래 전이라 점이 이미 사라졌어도 자리는
      // 기억해 두었다가 잇는다 (예전엔 시간이 지나면 선 없이 점·반짝이만 남았다).
      // 처음 클릭이면 별똥별처럼 왼쪽 위에서 떨어지는 짧은 선을 긋는다.
      // 같은 자리를 다시 누르면 선은 긋지 않고 점만 남긴다 (왼쪽 위에서 선이 불려오지 않게).
      if (!anchor) {
        segs.push({ a: { x: n.x - 110, y: n.y - 64, t: now, dust: [] }, b: n }); if (segs.length > 40) segs.shift();
        anchor = { x: n.x, y: n.y };
      } else if (Math.hypot(anchor.x - n.x, anchor.y - n.y) >= 8) {
        segs.push({ a: { x: anchor.x, y: anchor.y, t: now, dust: [] }, b: n }); if (segs.length > 40) segs.shift();
        anchor = { x: n.x, y: n.y };
      }
      nodes.push(n); if (nodes.length > 41) nodes.shift();
    };
    const drawLines = (now: number) => {
      if (!ctx || !canvas) return;
      const fade = (t: number) => { const k = (now - t) / LIFE; return k >= 1 ? 0 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; };
      ctx.lineCap = 'round';
      for (const s of segs) {
        const al = fade(s.b.t); if (al <= 0) continue;
        const p = Math.max(0, Math.min(1, (now - s.b.t) / DRAW)), e = 1 - Math.pow(1 - p, 3);   // 선이 점에서 점으로 그어짐
        const hx = s.a.x + (s.b.x - s.a.x) * e, hy = s.a.y + (s.b.y - s.a.y) * e;
        ctx.globalAlpha = al * 0.8; ctx.strokeStyle = fx.lineColor; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(hx, hy); ctx.stroke();
        if (p < 1) {
          // 별똥별 — 머리가 앞서 가며 꼬리가 가늘게 끌린다
          const len = Math.hypot(hx - s.a.x, hy - s.a.y), tl = Math.min(len, 140);
          if (len > 1) {
            const tx = hx - (hx - s.a.x) / len * tl, ty = hy - (hy - s.a.y) / len * tl;
            const g = ctx.createLinearGradient(tx, ty, hx, hy);
            g.addColorStop(0, rgba(fx.lineColor, 0)); g.addColorStop(1, rgba(fx.lineColor, 1));
            ctx.globalAlpha = al; ctx.strokeStyle = g; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
            const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10);
            hg.addColorStop(0, rgba(fx.lineColor, 0.6)); hg.addColorStop(1, rgba(fx.lineColor, 0));
            ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      for (const n of nodes) {
        const al = fade(n.t); if (al <= 0) continue;
        const pop = Math.max(0, Math.min(1, (now - n.t) / 180));
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 12 * pop + 1);
        g.addColorStop(0, rgba(fx.lineColor, 0.5)); g.addColorStop(1, rgba(fx.lineColor, 0));
        ctx.globalAlpha = al; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, 12 * pop + 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fx.lineColor;
        ctx.save(); ctx.translate(n.x, n.y); starPath(ctx, 4 * pop + 0.5); ctx.fill(); ctx.restore();
        for (const d of n.dust) {
          const tw = 0.5 + 0.5 * Math.sin(now * d.sp + d.ph);                 // 깜빡임
          const show = Math.min(1, Math.max(0, (now - n.t - 120) / 300));    // 클릭 직후 하나둘 나타남
          const dl = Math.max(0, Math.min(1, 1 - (now - n.t) / Math.min(LIFE, 1800)));   // 반짝이는 선보다 먼저 사라져 선이 남는다
          const a = al * tw * show * dl; if (a <= 0.02) continue;
          ctx.globalAlpha = a; ctx.fillStyle = fx.lineColor;
          ctx.save(); ctx.translate(n.x + d.dx, n.y + d.dy);
          if (d.star) starPath(ctx, d.r * 1.8); else { ctx.beginPath(); ctx.arc(0, 0, d.r * 0.6, 0, Math.PI * 2); }
          ctx.fill(); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      while (nodes.length && fade(nodes[0].t) <= 0) nodes.shift();
      while (segs.length && fade(segs[0].b.t) <= 0) segs.shift();
    };

    /* ── ① 클릭 별 ── */
    const style = document.createElement('style');
    style.textContent = '.mfx-star{width:16px;height:16px;position:fixed;pointer-events:none;'
      + 'clip-path:polygon(50% 0%,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0% 50%,42% 42%)}';
    // 클릭 링 효과 — 가운데 ✦ 별이 톡 튀고, 얇은 링이 퍼지며, 작은 별 조각이 둘레로 흩어진다
    // 별·링·작은 별 조각은 한 가지 채움 색으로 통일하고, 추가한 색은 윤곽선으로 둘렀다
    style.textContent += `.mfx-b{position:fixed;width:0;height:0;pointer-events:none}`
      + `.mfx-b i{position:absolute;display:block;left:0;top:0}`
      + `.mfx-b svg{width:100%;height:100%;overflow:visible;fill:var(--bc);stroke:var(--bk);stroke-width:3.5;stroke-linejoin:round}`
      + `.mfx-b .sp svg{fill:var(--bk);stroke:var(--bk);stroke-width:7;stroke-linejoin:round}`   // 작은 별 조각 — 팔이 가늘어 흐리게 보여서 윤곽을 같은 색으로 둘러 굵고 진하게
      + `.mfx-b .co{width:24px;height:24px;margin:-12px 0 0 -12px;animation:mfxCo .6s cubic-bezier(.2,.8,.3,1) forwards}`
      + `.mfx-b .sp{width:12px;height:12px;margin:-6px 0 0 -6px;animation:mfxSp .75s cubic-bezier(.2,.7,.3,1) forwards}`
      + `.mfx-b .pt{width:5px;height:10px;margin:-5px 0 0 -2.5px;opacity:0;animation:mfxPt .7s cubic-bezier(.2,.7,.3,1) forwards}`   // 잎 모양 파티클 — 링 안쪽에서 링 테두리에 살짝 걸치는 곳까지만 퍼진다
      + `.mfx-b .pt.bg{width:7px;height:14px;margin:-7px 0 0 -3.5px}`
      + `.mfx-b .pt svg{fill:var(--bp);stroke:none}`
      + `@keyframes mfxPt{0%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d0)*-1)) scale(.4)}15%{opacity:1}70%{opacity:1}100%{opacity:0;transform:rotate(var(--a)) translateY(calc(var(--d1)*-1)) scale(1)}}`
      + `@keyframes mfxCo{0%{opacity:0;transform:scale(.2) rotate(0)}30%{opacity:1;transform:scale(1) rotate(45deg)}100%{opacity:0;transform:scale(.15) rotate(90deg)}}`
      + `@keyframes mfxSp{0%{opacity:0;transform:rotate(var(--a)) translateY(-14px) scale(.3)}18%{opacity:1}65%{opacity:1}100%{opacity:0;transform:rotate(var(--a)) translateY(-32px) scale(.9) rotate(180deg)}}`;
    // 팔을 통통하게 — 가운데 별(.co)과 작은 별 조각(.sp)이 같이 쓰는 모양 (윤곽 둘러도 잘리지 않게 viewBox를 넉넉히)
    const STAR = '<svg viewBox="-6 -6 112 112"><polygon points="50,2 62,38 98,50 62,62 50,98 38,62 2,50 38,38"/></svg>';
    const onBurst = (e: MouseEvent) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const b = document.createElement('div');
      b.className = 'mfx-b';
      b.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--bc:${fx.burstColor};--bk:${fx.burstLine};--bp:${fx.burstPart}`;
      let h = `<i class="co">${STAR}</i>`;
      const n = 6, off = Math.random() * 60;
      for (let i = 0; i < n; i++) h += `<i class="sp" style="--a:${Math.round(off + i * 360 / n)}deg;animation-delay:${(i % 3) * 30}ms">${STAR}</i>`;
      // 잎 파티클 4개 — 별 조각(60° 간격 6개)과 겹치지 않도록 그 사이 빈자리(30°·90°·210°·270°)에만 둔다
      const LEAF = '<svg viewBox="-5 -9 10 18"><path d="M0 -8Q5 0 0 8Q-5 0 0 -8Z"/></svg>';
      [30, 90, 210, 270].forEach((deg, i) => {
        h += `<i class="pt bg" style="--a:${Math.round(off + deg)}deg;--d0:12px;--d1:30px;animation-delay:${(i % 2) * 25}ms">${LEAF}</i>`;
      });
      b.innerHTML = h;
      box.appendChild(b);
      setTimeout(() => b.remove(), 900);
    };
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
        const q = sparks[i], k = Math.max(0, (now - q.t) / q.life);
        if (k >= 1) { sparks.splice(i, 1); continue; }
        const pop = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;       // 커졌다가 작아지며 사라짐
        const r = q.r * (0.4 + 0.6 * pop);
        c.save(); c.translate(q.x, q.y);
        c.globalAlpha = pop;
        c.globalAlpha = Math.min(1, pop * 1.4); c.fillStyle = q.c;
        c.rotate(q.rot + k * 0.6); starPath(c, r); c.fill();
        c.restore();
      }
    };

    /* ── 한 루프로 구동 (주사율이 달라도 원본과 같은 속도) ── */
    let raf = 0, last = performance.now();
    // rAF가 넘겨 주는 시각은 프레임 시작 시각이라, 같은 프레임 안에서 발생한 클릭·이동의 시각(performance.now)보다
    // 몇 ms 이를 수 있다 — 그러면 나이가 음수가 되어 캔버스 그라디언트에 음수 반지름이 들어가 예외가 나고,
    // 루프가 멈춰 별이 화면에 그대로 얼어붙는다. 그래서 항상 performance.now()를 쓰고, 예외가 나도 루프는 이어 간다.
    const loop = () => {
      const now = performance.now();
      try {
      const dt = Math.max(0, Math.min(100, now - last)); last = now;
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
      } catch {
        if (ctx && canvas) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
        sparks.length = 0; nodes.length = 0; segs.length = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    if (fx.burst) window.addEventListener('click', onBurst);
    if (fx.click) window.addEventListener('click', onClick);
    if (fx.line) window.addEventListener('click', onLineClick);
    if (fx.trail) window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('click', onBurst);
      window.removeEventListener('click', onClick);
      window.removeEventListener('click', onLineClick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      box.remove();
      style.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fx.click, fx.trail, fx.count, colorKey, fx.line, fx.lineColor, fx.lineLife, fx.burst, fx.burstColor, fx.burstLine, fx.burstPart]);

  return null;
}
