'use client';
// 페어 옷장 화면 — 캐릭터 두 명 · 착용 중 패널 · 옷장(탭/검색) · 찰칵 저장
// 입은 옷과 표정은 React 상태로, 말풍선·모션·홍조 같은 연출은 Brain 이 DOM 에 직접 건다.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBlob } from '@/lib/blobStore';
import { CLOSET_TABS, CLOTH_TABS, STACK_TABS, type ClosetItem, type ClosetPair, pairTitle } from '@/lib/closetStore';
import { Modal } from '@/components/ui/Modal';
import { KInput } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { Brain, type BrainEnv, type CharView } from './closetBrain';
import './closet.css';

type Cid = 1 | 2;
export interface Worn { key: string; itemId: string; src: string; tab: string; name: string; zi: number; fx?: 'out' | 'in' }

const SFX_FILES = { blop: 'blop.mp3', magic: 'magic.mp3', whoosh: 'whoosh.mp3', pic: 'pic.mp3' } as const;
const direct = (ref: string) => /^(https?:|data:|blob:|\/)/.test(ref);
let wornSeq = 0;

/** 업로드 참조(로컬 모드의 IndexedDB id)를 보여 줄 수 있는 주소로 바꿔 주는 표 */
export function useUrlMap(refs: string[]) {
  const [map, setMap] = useState<Record<string, string>>({});
  const sig = refs.filter(r => r && !direct(r)).sort().join('|');
  useEffect(() => {
    let alive = true;
    sig.split('|').filter(Boolean).forEach(ref => {
      getBlob(ref).then(b => {
        if (b && alive) setMap(m => (m[ref] ? m : { ...m, [ref]: URL.createObjectURL(b) }));
      }).catch(() => { /* 없으면 빈 그림 */ });
    });
    return () => { alive = false; };
  }, [sig]);
  return useCallback((ref: string) => (!ref ? '' : direct(ref) ? ref : map[ref] ?? ''), [map]);
}

/** 페어를 바꿨다 돌아와도 입혀 둔 모습이 남도록, 떠날 때 맡겨 두는 상태 */
export interface StageSaved { worn: Record<Cid, Worn[]>; bg: Record<Cid, string> }

export function ClosetStage({ pair, items, isAdmin, onEdit, saved, onSave, pairs, onPick }: {
  pair: ClosetPair; items: ClosetItem[]; isAdmin: boolean; onEdit: () => void;
  pairs?: ClosetPair[]; onPick?: (id: string) => void;
  saved?: StageSaved; onSave: (s: StageSaved) => void;
}) {
  const toast = useToast();
  const data = { ...pair, items };
  const dataRef = useRef(data);
  dataRef.current = data;

  const resolve = useUrlMap([...data.items.map(i => i.src), ...data.chars.flatMap(c => c.bodies)]);
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  const [worn, setWornState] = useState<Record<Cid, Worn[]>>({ 1: [], 2: [] });
  const wornRef = useRef<Record<Cid, Worn[]>>({ 1: [], 2: [] });
  const setWorn = (cid: Cid, fn: (w: Worn[]) => Worn[]) => {
    wornRef.current = { ...wornRef.current, [cid]: fn(wornRef.current[cid]) };
    setWornState(wornRef.current);
  };
  const [face, setFace] = useState<Record<Cid, number>>({ 1: 1, 2: 1 });
  const [bgSrc, setBgSrc] = useState<Record<Cid, string>>(saved?.bg ?? { 1: '', 2: '' });
  const bgRef = useRef(bgSrc);
  bgRef.current = bgSrc;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const [tab, setTab] = useState(CLOSET_TABS.find(t => data.items.some(i => i.tab === t.key))?.key ?? 'dress');
  const [kw, setKw] = useState('');
  const [dblTarget, setDblTarget] = useState<'auto' | Cid>('auto');
  const [tip, setTip] = useState<{ text: string; x: number; y: number; show: boolean } | null>(null);
  const [bgAsk, setBgAsk] = useState<string | null>(null);
  const [saveAsk, setSaveAsk] = useState<string | null>(null);
  const [mute, setMute] = useState(false);
  const muteRef = useRef(false);

  // 화면 요소 · 반응 엔진
  const els = useRef<Record<Cid, CharView>>({
    1: { cv: null, bubble: null, blush: null, sweat: null, cloud: null },
    2: { cv: null, bubble: null, blush: null, sweat: null, cloud: null },
  });
  const brains = useRef<Record<Cid, Brain> | null>(null);
  const audio = useRef<Record<string, HTMLAudioElement>>({});
  const sfx = (k: keyof typeof SFX_FILES) => {
    if (muteRef.current) return;
    try {
      const a = audio.current[k] ?? (audio.current[k] = new Audio(`/closet/sfx/${SFX_FILES[k]}`));
      a.currentTime = 0;
      void a.play().catch(() => { /* 자동재생 차단 — 무시 */ });
    } catch { /* 무시 */ }
  };
  useEffect(() => {
    try { const v = localStorage.getItem('ohome.closet.mute') === '1'; setMute(v); muteRef.current = v; } catch { /* 무시 */ }
  }, []);

  const itemOf = (id: string) => dataRef.current.items.find(i => i.id === id);
  const lines = (cid: Cid, key: string) => {
    const v = dataRef.current.dialogue[cid - 1]?.[key];
    return v && v.trim() ? v.split('\n').filter(Boolean) : ['...'];
  };

  const makeEnv = (): BrainEnv => {
    const env: BrainEnv = {
      view: cid => els.current[cid],
      setFace: (cid, n) => setFace(f => (f[cid] === n ? f : { ...f, [cid]: n })),
      hasTop: cid => wornRef.current[cid].some(w => w.fx !== 'out' && CLOTH_TABS.includes(w.tab)),
      dg: (cid, key) => {
        const v = dataRef.current.dialogue[cid - 1]?.[key];
        return v && v.trim() ? v : '...';
      },
      dgList: (cid, key) => lines(cid, key),
      brain: cid => brains.current![cid],
    };
    return env;
  };

  const outfitOf = (cid: Cid): Worn[] =>
    dataRef.current.chars[cid - 1].outfit
      .map(id => itemOf(id))
      .filter((it): it is ClosetItem => !!it)
      .map(it => ({ key: `w${++wornSeq}`, itemId: it.id, src: resolveRef.current(it.src), tab: it.tab, name: it.name, zi: it.zi }));

  // 입장 — 기본 코디를 입고 인사한다
  useEffect(() => {
    const env = makeEnv();
    const b = { 1: new Brain(1, env), 2: new Brain(2, env) };
    brains.current = b;
    // 페어를 바꿨다 돌아왔으면 입혀 두었던 모습 그대로, 처음이면 기본 코디
    ([1, 2] as Cid[]).forEach(cid => setWorn(cid, () => saved ? saved.worn[cid] : outfitOf(cid)));
    sfx('magic');
    // 요소가 붙은 다음 틱에 시작
    const t = setTimeout(() => { b[1].init(); b[2].init(); }, 50);
    return () => {
      clearTimeout(t); b[1].destroy(); b[2].destroy(); brains.current = null;
      const clean = (w: Worn[]) => w.filter(x => x.fx !== 'out').map(x => ({ ...x, fx: undefined }));
      onSaveRef.current({ worn: { 1: clean(wornRef.current[1]), 2: clean(wornRef.current[2]) }, bg: bgRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 입히기 / 벗기기 ---------- */
  const isWornBy = (itemId: string) => ([1, 2] as Cid[]).some(c => wornRef.current[c].some(w => w.itemId === itemId));

  const drop = (cid: Cid, it: ClosetItem) => {
    if (it.tab === 'bg') { setBgAsk(it.id); return; }
    sfx('blop');
    const stack = STACK_TABS.includes(it.tab);
    if (wornRef.current[cid].some(w => w.itemId === it.id)) return;
    setWorn(cid, w => [
      ...(stack ? w : w.filter(x => x.tab !== it.tab)),
      { key: `w${++wornSeq}`, itemId: it.id, src: resolve(it.src), tab: it.tab, name: it.name, zi: it.zi },
    ]);
    const acc = wornRef.current[cid].filter(w => w.tab === 'acc').length;
    if (it.tab === 'acc' && acc >= 5) brains.current?.[cid].tooMany();
    else brains.current?.[cid].interact(false);
  };

  const removeWorn = (cid: Cid, key: string) => {
    sfx('blop');
    setWorn(cid, w => w.filter(x => x.key !== key));
    const b = brains.current?.[cid];
    b?.interact(false, true);
    b?.bubble(lines(cid, 'take_off_list')[Math.floor(Math.random() * lines(cid, 'take_off_list').length)]);
  };

  const shiftZ = (cid: Cid, key: string, d: number) =>
    setWorn(cid, w => w.map(x => x.key === key ? { ...x, zi: x.zi + d } : x));

  const restore = (cid: Cid) => {
    const b = brains.current?.[cid];
    if (!b) return;
    const go = () => {
      sfx('magic');
      b.afterRestore();
      const next = outfitOf(cid).map(w => ({ ...w, fx: 'in' as const }));
      setWorn(cid, () => next);
      setTimeout(() => setWorn(cid, w => w.map(x => ({ ...x, fx: undefined }))), 600);
      b.anim('anim-jump');
      b.bubble(lines(cid, 'reset_all')[Math.floor(Math.random() * lines(cid, 'reset_all').length)], 3);
      b.startIdle();
    };
    if (wornRef.current[cid].length) {
      setWorn(cid, w => w.map(x => ({ ...x, fx: 'out' as const })));
      setTimeout(go, 450);
    } else go();
  };

  const stripAll = (cid: Cid) => {
    const b = brains.current?.[cid];
    if (!b) return;
    if (!wornRef.current[cid].length) { b.nothingToTakeOff(); return; }
    sfx('whoosh');
    setWorn(cid, w => w.map(x => ({ ...x, fx: 'out' as const })));
    b.panicOff(() => setWorn(cid, () => []));
  };

  // 이름 끝의 사이즈 표시(A/B) → 알아서 대상 고르기
  const pickTarget = (it: ClosetItem): Cid => {
    if (dblTarget !== 'auto') return dblTarget;
    const raw = it.name.trim();
    const up = raw.toUpperCase();
    let hit = ([1, 2] as Cid[]).filter(i => {
      const lb = dataRef.current.chars[i - 1].label.trim().toUpperCase();
      return lb && up.endsWith(lb);
    });
    if (hit.length === 1) return hit[0];
    hit = ([1, 2] as Cid[]).filter(i => {
      const nm = dataRef.current.chars[i - 1].name.trim();
      if (!nm) return false;
      if (raw.includes(nm)) return true;
      const first = nm.split(/\s+/)[0];
      return first.length >= 2 && raw.includes(first);
    });
    return hit.length === 1 ? hit[0] : 1;
  };

  const [flash, setFlash] = useState<string | null>(null);
  const dblWear = (it: ClosetItem) => {
    const cid = pickTarget(it);
    setFlash(it.id); setTimeout(() => setFlash(null), 220);
    const have = wornRef.current[cid].find(w => w.itemId === it.id);
    if (have) removeWorn(cid, have.key); else drop(cid, it);
  };

  const tap = useRef<{ id: string; t: number } | null>(null);
  const onItemClick = (it: ClosetItem) => {
    if (justDragged.current) return;   // 끌었다 놓은 직후의 클릭은 탭으로 세지 않는다
    if (it.tab === 'bg') { setBgAsk(it.id); return; }
    const now = Date.now();
    if (tap.current && tap.current.id === it.id && now - tap.current.t < 450) { tap.current = null; dblWear(it); }
    else tap.current = { id: it.id, t: now };
  };

  // 끌어서 입히기 — 원본(jQuery UI draggable)과 같게: 6px 움직이면 시작 · 끄는 그림은 캐릭터 크기 ·
  // 커서가 그림의 (가로 절반, 세로는 가로 절반) 지점을 잡음 · 엉뚱한 데 놓으면 0.5초 동안 제자리로 돌아감
  const justDragged = useRef(false);
  const onItemDown = (e: React.PointerEvent, it: ClosetItem) => {
    if (e.button !== 0 || it.tab === 'bg') return;
    const sx = e.clientX, sy = e.clientY;
    const origin = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const c0 = dataRef.current.chars[0];
    const gx = c0.width / 2, gy = c0.width / 2;
    let ghost: HTMLImageElement | null = null;
    const mv = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        ghost = document.createElement('img');
        ghost.src = resolve(it.src);
        ghost.className = 'closet-ghost';
        ghost.style.width = `${c0.width}px`; ghost.style.height = `${c0.height}px`;
        document.body.appendChild(ghost);
        document.body.classList.add('closet-dragging');
        setTip(t => t && { ...t, show: false });
      }
      ghost.style.left = `${ev.clientX - gx}px`; ghost.style.top = `${ev.clientY - gy}px`;
      ev.preventDefault();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('closet-dragging');
      if (!ghost) return;
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      const g = ghost;
      const zone = document.elementsFromPoint(ev.clientX, ev.clientY)
        .map(el => (el as HTMLElement).closest?.('[data-zone]') as HTMLElement | null).find(Boolean);
      if (zone) { g.remove(); drop(Number(zone.dataset.zone) as Cid, it); return; }
      g.style.transition = 'left .5s ease, top .5s ease';   // 제자리로
      g.style.left = `${origin.left}px`; g.style.top = `${origin.top}px`;
      setTimeout(() => g.remove(), 520);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // 컴포넌트가 사라질 때 끌던 흔적 정리
  useEffect(() => () => { document.body.classList.remove('closet-dragging'); document.querySelectorAll('.closet-ghost').forEach(g => g.remove()); }, []);

  /* ---------- 배경 ---------- */
  const applyBg = (target: Cid | 'both') => {
    const it = bgAsk ? itemOf(bgAsk) : null;
    if (it) {
      const src = resolve(it.src);
      setBgSrc(b => ({ 1: target === 2 ? b[1] : src, 2: target === 1 ? b[2] : src }));
    }
    setBgAsk(null);
  };

  /* ---------- 찰칵 — 두 명을 나란히 PNG 로 ---------- */
  const loadImg = (src: string) => new Promise<HTMLImageElement | null>(resolveImg => {
    const cross = /^https?:\/\//.test(src) && !src.startsWith(window.location.origin);
    const im = new Image();
    if (cross) im.crossOrigin = 'anonymous';
    im.onload = () => resolveImg(im);
    im.onerror = () => resolveImg(null);
    // 같은 주소를 CORS 없이 받아 둔 캐시와 섞이지 않게 구분
    im.src = cross ? src + (src.includes('?') ? '&' : '?') + '_cors=1' : src;
  });

  const drawChar = async (cid: Cid, canvas: HTMLCanvasElement, skipped: string[]) => {
    const c = dataRef.current.chars[cid - 1];
    canvas.width = c.width; canvas.height = c.height;
    const ctx = canvas.getContext('2d')!;
    const layers: { src: string; zi: number; bg?: boolean; name: string }[] = [];
    if (bgSrc[cid]) layers.push({ src: bgSrc[cid], zi: -999, bg: true, name: '배경' });
    layers.push({ src: resolve(c.bodies[face[cid] - 1] || c.bodies[0]), zi: 10, name: '캐릭터' });
    wornRef.current[cid].forEach(w => layers.push({ src: w.src, zi: w.zi, name: w.name }));
    layers.sort((a, b) => a.zi - b.zi);
    const imgs = await Promise.all(layers.map(l => loadImg(l.src)));
    layers.forEach((l, i) => {
      const im = imgs[i];
      if (!im) { skipped.push(l.name); return; }
      if (l.bg) {
        const sc = Math.max(c.width / im.naturalWidth, c.height / im.naturalHeight);
        const sw = im.naturalWidth * sc, sh = im.naturalHeight * sc;
        ctx.drawImage(im, (c.width - sw) / 2, (c.height - sh) / 2, sw, sh);
      } else ctx.drawImage(im, 0, 0, c.width, c.height);
    });
  };

  const saveBoth = async (name: string) => {
    const d = dataRef.current;
    sfx('pic');
    const skipped: string[] = [];
    const c1 = document.createElement('canvas'), c2 = document.createElement('canvas');
    await Promise.all([drawChar(1, c1, skipped), drawChar(2, c2, skipped)]);
    const gap = 20, a = d.chars[0], b = d.chars[1];
    const comb = document.createElement('canvas');
    comb.width = a.width + gap + b.width; comb.height = Math.max(a.height, b.height);
    const ctx = comb.getContext('2d')!;
    ctx.drawImage(c1, 0, 0); ctx.drawImage(c2, a.width + gap, 0);
    let url: string;
    try { url = comb.toDataURL('image/png'); } catch {
      toast('저장하지 못했습니다 — 다른 사이트 주소의 그림이 섞여 있으면 브라우저가 막습니다');
      return;
    }
    const link = document.createElement('a');
    link.download = `${name || d.saveName || '옷장'}.png`; link.href = url;
    document.body.appendChild(link); link.click(); link.remove();
    if (skipped.length) toast(`저장됐지만 담기지 않은 그림: ${Array.from(new Set(skipped)).join(', ')}`);
    setTimeout(() => brains.current?.[1].bubble(lines(1, 'save_photo')[0], 3), 800);
    setTimeout(() => brains.current?.[2].bubble(lines(2, 'save_photo')[0], 3), 1100);
  };

  /* ---------- 표시용 ---------- */
  // 찰칵·소리 버튼 — 넓은 화면에서는 사용법 상자 안에, 좁은 화면에서는 제목 아래에 보인다
  const actionBtns = (<>
    <button type="button" className="btn_custom big" onClick={() => setSaveAsk(data.saveName)}>📸 찰칵!</button>
    <button type="button" className={`btn_custom ${mute ? 'off' : ''}`} onClick={() => {
      const v = !mute; setMute(v); muteRef.current = v;
      try { localStorage.setItem('ohome.closet.mute', v ? '1' : '0'); } catch { /* 무시 */ }
    }}>{mute ? '🔇 소리 꺼짐' : '🔊 소리'}</button>
  </>);
  // 옷장(오른쪽 목록)은 사용법 상자처럼 끌어서 옮긴다 — 캐릭터 화면은 가운데에 둔다
  const ward = useFloat('ohome.closet.wardpos', () => ({ l: window.innerWidth - 460, t: 130 }));
  const [c1, c2] = data.chars;
  const chars: [Cid, typeof c1][] = [[1, c1], [2, c2]];
  const tabItems = useMemo(() => data.items.filter(i => i.tab === tab), [data.items, tab]);
  const q = kw.trim().toLowerCase();
  // 입은 옷은 목록에서 투명해질 뿐 자리는 그대로 둔다 (원본: visibility:hidden)
  const matched = tabItems.filter(i => !q || i.name.toLowerCase().includes(q));
  const isWornHidden = (i: ClosetItem) => !STACK_TABS.includes(i.tab) && isWornBy(i.id);
  const anyShown = matched.some(i => !isWornHidden(i));

  return (
    <div className="closet">
      <div className="cl-wrap">
        <div className="cl-main">
          <div className="ribbon-wrapper"><div className="ribbon-bg" /><Title text={pairTitle(data)} /></div>
          <div className="title-btns narrow-only">{actionBtns}</div>

          <div className="dual-stage">
            {chars.map(([cid, c]) => (
              <div className="char-col" key={cid}>
                <div className="char-name-label">{c.name}</div>
                <div className="character-stage" data-zone={cid} style={{
                  width: c.width, height: c.height,
                  backgroundImage: bgSrc[cid] ? `url("${bgSrc[cid]}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
                }} onClick={() => brains.current?.[cid].click()}>
                  <div className="speech-bubble" ref={el => { els.current[cid].bubble = el; }} />
                  <div ref={el => { els.current[cid].sweat = el; }} />
                  <div ref={el => { els.current[cid].cloud = el; }} />
                  <div className="blush-overlay" ref={el => { els.current[cid].blush = el; }}
                    style={{ left: c.blush[0], top: c.blush[1], width: c.blush[2], height: c.blush[3] }} />
                  <div className="char-visuals" ref={el => { els.current[cid].cv = el; }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="base-layer" alt="" draggable={false} src={resolve(c.bodies[face[cid] - 1] || c.bodies[0])} />
                    {worn[cid].map(w => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={w.key} className={`dropped-item ${w.fx === 'out' ? 'anim-fly-down' : w.fx === 'in' ? 'anim-fly-in-up' : ''}`}
                        alt="" draggable={false} src={w.src} style={{ zIndex: w.zi }} />
                    ))}
                  </div>
                </div>
                <div className="char-btn-row below">
                  <button type="button" className="btn_custom" onClick={() => restore(cid)}>다시 입히기</button>
                  <button type="button" className="btn_custom btn_reset" onClick={() => stripAll(cid)}>전부 벗기!</button>
                </div>
                <div className="worn-panel-wrap" style={{ width: c.width, maxWidth: '100%' }}>
                  <div className="worn-panel-title">👕 착용 중 — ✕ 벗기 / ▲▼ 앞뒤 조절</div>
                  <div className="worn-panel">
                    {worn[cid].filter(w => !w.fx).length === 0 && <span className="worn-empty">없음</span>}
                    {worn[cid].filter(w => !w.fx).map(w => (
                      <div className="worn-chip" key={w.key}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.src} alt="" title={w.name} />
                        <span className="chip-lbl">{w.name}</span>
                        <div className="zi-row">
                          <button className="zi-btn" onClick={() => shiftZ(cid, w.key, 1)}>▲</button>
                          <span className="zi-val">{w.zi}</span>
                          <button className="zi-btn" onClick={() => shiftZ(cid, w.key, -1)}>▼</button>
                        </div>
                        <button className="worn-x" title="벗기기" onClick={() => removeWorn(cid, w.key)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cl-side floating" ref={ward.box}>
          <div className="float-header" title="이 줄을 끌어서 옮기세요 (두 번 누르면 제자리로)"
            onPointerDown={ward.down} onDoubleClick={ward.reset}>
            <span>👗 옷장</span><span className="guide-grip">⠿</span>
          </div>
          <div className="wardrobe-top-bar">
            <input className="search-box" placeholder="아이템 검색..." value={kw} onChange={e => setKw(e.target.value)} />
            <div className="dbl-bar">
              <span className="dbl-hint">👆 더블클릭 → 입히기</span>
              <button type="button" className={`dbl-btn ${dblTarget === 'auto' ? 'active' : ''}`} onClick={() => setDblTarget('auto')}
                title={`아이템 이름 끝의 ${c1.label}/${c2.label} 를 보고 알아서 정합니다`}>자동</button>
              <button type="button" className={`dbl-btn ${dblTarget === 1 ? 'active' : ''}`} onClick={() => setDblTarget(1)}>{c1.name}</button>
              <button type="button" className={`dbl-btn ${dblTarget === 2 ? 'active' : ''}`} onClick={() => setDblTarget(2)}>{c2.name}</button>
            </div>
          </div>
          <div className="tab-nav">
            {CLOSET_TABS.map(t => (
              <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="wardrobe">
            {tab === 'bg' && (<>
              <div className="bg-remove-btn" onClick={() => setBgSrc(b => ({ ...b, 1: '' }))}><span style={{ fontSize: 15 }}>🚫</span><span>{c1.name}<br />배경제거</span></div>
              <div className="bg-remove-btn" onClick={() => setBgSrc(b => ({ ...b, 2: '' }))}><span style={{ fontSize: 15 }}>🚫</span><span>{c2.name}<br />배경제거</span></div>
            </>)}
            {matched.map(it => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={it.id} src={resolve(it.src)} alt={it.name} draggable={false} loading="lazy" decoding="async"
                className={`clothes-item ${it.tab === 'bg' ? 'bg' : ''} ${flash === it.id ? 'dbl-flash' : ''} ${isWornHidden(it) ? 'item-worn' : ''}`}
                onClick={() => onItemClick(it)}
                onPointerDown={e => onItemDown(e, it)}
                onMouseEnter={e => setTip({ text: it.name, x: e.clientX, y: e.clientY, show: true })}
                onMouseMove={e => setTip(t => t && { ...t, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTip(t => t && { ...t, show: false })} />
            ))}
            {!anyShown && <div className="tab-empty">아이템이 없습니다.</div>}
          </div>
          <div className="footer-credit">
            <a href="https://uchoman.ivyro.net/" target="_blank" rel="noreferrer">원본 제작 우초맨</a>
            <span>✔ SFX: <a href="https://sellbuymusic.com/md/spjqcbb-efbfbct" target="_blank" rel="noreferrer">셀바이뮤직</a></span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ textAlign: 'center', margin: '30px auto 10px' }}>
          <button type="button" className="admin-link" onClick={() => { setTip(null); onEdit(); }}>👑 옷장 편집</button>
        </div>
      )}

      <GuideBox c1={c1} c2={c2} pairs={pairs} pairId={pair.id} onPick={onPick} actions={actionBtns} />

      {tip && (
        <div className="closet-tip" style={{
          left: tip.x > window.innerWidth / 2 ? tip.x - 12 : tip.x + 12, top: tip.y - 40,
          transform: tip.x > window.innerWidth / 2 ? 'translateX(-100%)' : undefined,
          opacity: tip.show ? 1 : 0,
        }}>{tip.text}</div>
      )}

      <Modal open={bgAsk !== null} small title="어디에 배경을 적용할까요?" onClose={() => setBgAsk(null)}
        actions={<button className="btn btn-ghost" onClick={() => setBgAsk(null)}>취소</button>}>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn-dark" onClick={() => applyBg(1)}>🧍 {c1.name} 만</button>
          <button className="btn btn-dark" onClick={() => applyBg(2)}>🧍 {c2.name} 만</button>
          <button className="btn btn-accent" onClick={() => applyBg('both')}>👫 둘 다</button>
        </div>
      </Modal>

      <Modal open={saveAsk !== null} small title="저장 파일명" onClose={() => setSaveAsk(null)}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setSaveAsk(null)}>취소</button>
          <button className="btn btn-dark" onClick={() => { const n = saveAsk ?? ''; setSaveAsk(null); void saveBoth(n.trim()); }}>저장</button>
        </>}>
        <KInput value={saveAsk ?? ''} onChange={e => setSaveAsk(e.target.value)} placeholder={data.saveName}
          onKeyDown={e => { if (e.key === 'Enter') { const n = saveAsk ?? ''; setSaveAsk(null); void saveBoth(n.trim()); } }} />
      </Modal>
    </div>
  );
}

/** 끌어서 옮기는 떠 있는 상자 공통 — 자리는 기억되고, 제목 줄을 두 번 누르면 제자리 */
function useFloat(key: string, home: () => { l: number; t: number }) {
  const box = useRef<HTMLDivElement>(null);
  const place = (l: number, t: number) => {
    const g = box.current;
    if (!g) return;
    l = Math.max(0, Math.min(l, window.innerWidth - g.offsetWidth));
    t = Math.max(0, Math.min(t, window.innerHeight - 44));   // 제목 줄은 항상 잡을 수 있게
    g.style.left = `${l}px`; g.style.top = `${t}px`;
  };
  useEffect(() => {
    let sv: { l: number; t: number } | null = null;
    try { sv = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* 무시 */ }
    const h = sv && typeof sv.l === 'number' ? sv : home();
    place(h.l, h.t);
    const onResize = () => { const g = box.current; if (g) place(parseFloat(g.style.left) || 0, parseFloat(g.style.top) || 0); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const down = (e: React.PointerEvent) => {
    const g = box.current;
    if (!g || (e.target as HTMLElement).closest('button')) return;
    const r = g.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    g.classList.add('is-dragging');
    const mv = (ev: PointerEvent) => { place(ev.clientX - ox, ev.clientY - oy); ev.preventDefault(); };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      g.classList.remove('is-dragging');
      try { localStorage.setItem(key, JSON.stringify({ l: parseFloat(g.style.left) || 0, t: parseFloat(g.style.top) || 0 })); } catch { /* 무시 */ }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    e.preventDefault();
  };
  const reset = (e?: React.MouseEvent) => {
    if (e && (e.target as HTMLElement).closest('button')) return;
    const h = home();
    place(h.l, h.t);
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
  };
  return { box, down, reset };
}

/** 사용법 상자 — 떠 있고 제목 줄을 끌어 옮긴다. 찰칵·소리 버튼과 페어 고르기가 여기 있다. 페어가 둘 이상이면 여기서 페어를 고른다(많으면 스크롤) */
function GuideBox({ c1, c2, pairs, pairId, onPick, actions }: {
  actions?: React.ReactNode;
  c1: { name: string; label: string }; c2: { name: string; label: string };
  pairs?: ClosetPair[]; pairId: string; onPick?: (id: string) => void;
}) {
  const g = useFloat('ohome.closet.guidepos', () => ({ l: 10, t: 130 }));
  const [more, setMore] = useState(false);

  const sz = [c1, c2].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div ref={g.box} className="guide-box" style={{ left: '10px', top: '130px' }}>
      <div className="guide-header" title="이 줄을 끌어서 옮기세요 (두 번 누르면 제자리로)"
        onPointerDown={g.down} onDoubleClick={g.reset}>
        <span>📖 사용법</span><span className="guide-grip">⠿</span>
      </div>
      <div className="guide-actions">{actions}</div>
      {pairs && pairs.length > 1 && (
        <div className="guide-pairs">
          <div className="guide-pairs-title">👫 페어 고르기</div>
          <div className="guide-pairs-list">
            {pairs.map(p => (
              <button key={p.id} type="button" className={p.id === pairId ? 'on' : ''} onClick={() => onPick?.(p.id)}>{p.name}</button>
            ))}
          </div>
        </div>
      )}
      <div className="guide-details" style={{ display: more ? 'block' : 'none' }}>
        <ul className="guide-list">
          <li><b>드래그&드롭</b>으로 옷 입히기</li>
          <li><b>{sz[0].label} 또는 {sz[1].label}를 검색</b>하여 사이즈별 의상 보기</li>
          <li>{sz[0].label} {sz[0].name} 사이즈 / {sz[1].label} {sz[1].name} 사이즈</li>
          <li>착용 중 패널 <b>✕</b>로 개별 벗기기</li>
          <li><b>▲▼</b>로 의상 앞뒤 조절</li>
          <li><b>배경 탭</b> 클릭 → 배경 적용</li>
          <li>📸 <b>찰칵!</b>으로 두 캐릭터 PNG 저장</li>
          <li><b>다시 입히기</b>: 기본 코디로 복귀</li>
          <li><b>전부 벗기!</b>: 해당 캐릭터 모두 벗기기</li>
          <li><b>방치 모드</b>: 가만히 두면 혼잣말을 합니다.</li>
          <li><b>부끄럼 모드</b>: 레어 모드?</li>
          <li><b>옷장</b>(오른쪽 목록)도 제목 줄을 끌어 옮길 수 있어요</li>
        </ul>
      </div>
      <button type="button" className="btn-toggle-detail" onClick={() => setMore(m => !m)}>{more ? '닫기 ▲' : '자세히 ▼'}</button>
    </div>
  );
}

/** 제목 글자가 하나씩 나타났다가 꿀렁이는 연출 */
function Title({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 100);
    return () => clearInterval(t);
  }, [text]);
  return (
    <div className={`game-title ${n >= text.length ? 'wag' : ''}`}>
      {Array.from(text).slice(0, n).map((ch, i) => (
        <span key={i} style={n >= text.length ? { animationDelay: `${((i * 37) % 20) / 100}s` } : undefined}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </div>
  );
}
