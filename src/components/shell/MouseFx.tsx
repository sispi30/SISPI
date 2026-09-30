'use client';
// 마우스 효과 (사용자 요청) — 기존 그누보드 사이트(sispi.dothome.co.kr)의 두 효과를 그대로 옮김.
//  ① 클릭: ✦ 4각 별이 클릭한 자리에서 위로 떠오르며 커지고 사라짐 (랜덤 회전 · 파랑 3색)
//  ② 이동: 팅커벨 반짝이 — 커서를 따라 작은 십자 별이 떨어지다 점으로 바뀌어 사라짐 (최대 50개)
// 원본은 전역 이벤트를 덮어쓰고 body에 직접 붙였지만, 여기서는 리스너를 추가/해제만 하고
// 고정 컨테이너 안에서만 그린다 (pointer-events:none · 다른 화면 요소에 영향 없음).
// 터치 입력과 시스템의 「동작 줄이기」 설정에서는 동작하지 않는다.
import { useEffect } from 'react';
import { normFx, useCursorSettings } from '@/lib/cursorStore';
const TICK = 40;       // 반짝이 갱신 간격(ms) — 원본과 동일
const FRAME = 1000 / 60;

interface ClickStar { el: HTMLDivElement; x: number; y: number; scale: number; alpha: number; rot: number }

export function MouseFx() {
  // 환경 설정 > 마우스 커서 > 마우스 효과 — 켜기/끄기 · 반짝이 개수 · 색 (바뀌면 즉시 다시 구성)
  const [cs, , loaded] = useCursorSettings();
  const fx = normFx(cs.fx);
  const colorKey = fx.colors.join('|');

  useEffect(() => {
    if (typeof window === 'undefined' || !loaded) return;
    if (!fx.click && !fx.trail) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const COLORS = colorKey.split('|');
    const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];
    const SPARKLES = fx.count;

    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:99999';
    document.body.appendChild(box);

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

    /* ── ② 팅커벨 반짝이 ── */
    let mx = -1, my = -1, ox = -1, oy = -1, moved = false;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY; moved = true;
    };

    const mk = (h: number, w: number) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;height:${h}px;width:${w}px;overflow:hidden;pointer-events:none;visibility:hidden`;
      return d;
    };
    const tiny: HTMLDivElement[] = [];
    const star: HTMLDivElement[] = [];
    const starv: number[] = [], tinyv: number[] = [];
    const sx: number[] = [], sy: number[] = [], tx: number[] = [], ty: number[] = [];
    for (let i = 0; i < SPARKLES; i++) {
      const t = mk(3, 3); box.appendChild(t); tiny.push(t);
      const s = mk(5, 5); s.style.backgroundColor = 'transparent';
      const l = mk(1, 5), d = mk(5, 1);
      l.style.visibility = d.style.visibility = 'inherit';
      l.style.top = '2px'; l.style.left = '0px'; d.style.top = '0px'; d.style.left = '2px';
      s.appendChild(l); s.appendChild(d); box.appendChild(s); star.push(s);
      starv.push(0); tinyv.push(0); sx.push(0); sy.push(0); tx.push(0); ty.push(0);
    }
    const starColor = (i: number, c: string) => {
      (star[i].childNodes[0] as HTMLElement).style.backgroundColor = c;
      (star[i].childNodes[1] as HTMLElement).style.backgroundColor = c;
    };

    const updateStar = (i: number) => {
      const h = window.innerHeight;
      if (--starv[i] === 25) star[i].style.clip = 'rect(1px, 4px, 4px, 1px)';
      if (starv[i]) {
        sy[i] += 1 + Math.random() * 3;
        sx[i] += ((i % 5) - 2) / 5;
        if (sy[i] < h) { star[i].style.top = sy[i] + 'px'; star[i].style.left = sx[i] + 'px'; }
        else { star[i].style.visibility = 'hidden'; starv[i] = 0; }
      } else {
        // 별 → 작은 점으로 바뀌어 한 번 더 떨어진다
        tinyv[i] = 50; ty[i] = sy[i]; tx[i] = sx[i];
        const t = tiny[i];
        t.style.top = ty[i] + 'px'; t.style.left = tx[i] + 'px';
        t.style.width = '2px'; t.style.height = '2px';
        t.style.backgroundColor = (star[i].childNodes[0] as HTMLElement).style.backgroundColor;
        star[i].style.visibility = 'hidden';
        t.style.visibility = 'visible';
      }
    };
    const updateTiny = (i: number) => {
      const h = window.innerHeight;
      if (--tinyv[i] === 25) { tiny[i].style.width = '1px'; tiny[i].style.height = '1px'; }
      if (tinyv[i]) {
        ty[i] += 1 + Math.random() * 3;
        tx[i] += ((i % 5) - 2) / 5;
        if (ty[i] < h) { tiny[i].style.top = ty[i] + 'px'; tiny[i].style.left = tx[i] + 'px'; }
        else { tiny[i].style.visibility = 'hidden'; tinyv[i] = 0; }
      } else tiny[i].style.visibility = 'hidden';
    };
    const sparkleTick = () => {
      if (moved && (Math.abs(mx - ox) > 1 || Math.abs(my - oy) > 1)) {
        ox = mx; oy = my;
        for (let c = 0; c < SPARKLES; c++) {
          if (starv[c]) continue;
          sx[c] = mx; sy[c] = my + 1;
          star[c].style.left = mx + 'px'; star[c].style.top = (my + 1) + 'px';
          star[c].style.clip = 'rect(0px, 5px, 5px, 0px)';
          starColor(c, pick());
          star[c].style.visibility = 'visible';
          starv[c] = 50;
          break;
        }
      }
      for (let c = 0; c < SPARKLES; c++) {
        if (starv[c]) updateStar(c);
        if (tinyv[c]) updateTiny(c);
      }
    };

    /* ── 한 루프로 구동 (주사율이 달라도 원본과 같은 속도) ── */
    let raf = 0, last = performance.now(), acc = 0;
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
      acc += dt;
      while (acc >= TICK) { acc -= TICK; sparkleTick(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    if (fx.click) window.addEventListener('click', onClick);
    if (fx.trail) window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('click', onClick);
      window.removeEventListener('pointermove', onMove);
      box.remove();
      style.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fx.click, fx.trail, fx.count, colorKey]);

  return null;
}
