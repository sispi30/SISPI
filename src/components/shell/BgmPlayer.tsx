'use client';
// BGM 플레이어 (5.3) — 무드 카드(재생목록) → 레코드판 재생 화면
// 유튜브 IFrame API, 화면은 숨기고 자체 컨트롤만 표시. 브라우저 정책상 소리 재생은 사용자의 첫 클릭부터 시작.
// "보고 있는 재생목록"과 "실제로 재생 중인 재생목록"을 분리해서 관리한다 — 다른 재생목록을 구경만 해도
// 재생 중인 곡 정보(미니바 등)가 덮어써지지 않게 하기 위함.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBgm, BgmPlaylist, extractDominantColorFromUrl } from '@/lib/bgmStore';
import { useBlobUrl } from '@/lib/blobStore';

/** 흐르는 글씨 — 재생 중이고 글자가 넘칠 때만 무한 스크롤, 평소엔 말줄임 */
function Marquee({ text, active, className }: { text: string; active: boolean; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measRef = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const box = boxRef.current, meas = measRef.current;
    if (!box || !meas) return;
    const m = () => setOver(meas.scrollWidth > box.clientWidth + 1);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(box);
    ro.observe(meas);
    return () => ro.disconnect();
  }, [text]);
  const run = active && over;
  return (
    <div ref={boxRef} className={`mq ${className ?? ''} ${run ? 'run' : ''}`} style={{ position: 'relative' }}>
      <span ref={measRef} aria-hidden
        style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        {text}
      </span>
      {run ? <span className="mq-in"><span>{text}</span><span>{text}</span></span> : text}
    </div>
  );
}

/* 최소한의 YT IFrame API 타입 */
interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { ENDED: number; PLAYING: number; PAUSED: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/* ---------- 아이콘 (기존 ListIcon 스타일과 통일 — stroke 기반, currentColor) ---------- */
const IcBack = () => (<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>);
const IcChevDown = () => (<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>);
const IcPrev = () => (<svg viewBox="0 0 24 24"><path d="M18 5v14M18 12L7 5v14l11-7z" /></svg>);
const IcNext = () => (<svg viewBox="0 0 24 24"><path d="M6 5v14M6 12l11-7v14L6 12z" /></svg>);
const IcPlay = () => (<svg viewBox="0 0 24 24"><path d="M7 4l14 8-14 8V4z" /></svg>);
const IcPause = () => (<svg viewBox="0 0 24 24"><path d="M7 4h4v16H7zM13 4h4v16h-4z" /></svg>);
const IcShuffle = () => (<svg viewBox="0 0 24 24"><path d="M3 6h4l9 12h5M17 4l4 2-4 2M3 18h4l3-4M17 20l4-2-4-2" /></svg>);
const IcCross = () => (<svg viewBox="0 0 24 24"><path d="M3 8l9-4 9 4-9 4-9-4zM3 16l9 4 9-4M3 12l9 4 9-4" /></svg>);
const IcRepeat = () => (<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" /></svg>);
const IcVolume = () => (<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9H4zM17 8a5 5 0 010 8" /></svg>);
const IcGear = () => (<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></svg>);

/* ---------- 무드 그러데이션 프리셋(커버 이미지 없을 때) — 6종 + 대표 링 색 ---------- */
const THEME_RING = ['#5b6c91', '#8f80ad', '#4f9484', '#b97a54', '#9c8a57', '#6d78a0'];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}
function themeIdx(pl: Pick<BgmPlaylist, 'id' | 'title'>): number {
  return Math.abs(hashStr(pl.id || pl.title || '')) % THEME_RING.length;
}
function fmtTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s < 10 ? '0' + s : s}`;
}
function parseDurationText(str?: string): number {
  if (!str) return 0;
  const parts = str.split(':').map(n => parseInt(n, 10) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

const RING_CIRC = 2 * Math.PI * 63; // r=63 (SVG 진행률 링 반지름)

/** 무드 카드 한 장(캐러셀 안) — 커버 이미지 참조를 URL로 직접 해석 */
function MoodCard({ pl, onOpen }: { pl: BgmPlaylist; onOpen: () => void }) {
  const url = useBlobUrl(pl.cover || undefined);
  const t = themeIdx(pl);
  return (
    <button type="button" className="mc" onClick={onOpen}>
      <span className={`mc-art${url ? '' : ` mc-t${t}`}`}
        style={url ? { backgroundImage: `url(${url})` } : undefined} />
      <span className="mc-grain" />
      <span className="mc-shade" />
      <span className="mc-body">
        <span className="mc-title">{pl.title}</span>
        <span className="mc-count">{pl.tracks.length} Tracks</span>
      </span>
    </button>
  );
}

export function BgmPlayer() {
  const { state } = useBgm();
  const { playlists, settings } = state;

  // 실제로 "재생 중"인 재생목록/곡
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  // 지금 "보고 있는" 재생목록 화면 — 재생 상태와 무관
  const [viewPlaylistId, setViewPlaylistId] = useState<string | null>(null);
  const [view, setView] = useState<'browse' | 'tracks'>('browse');

  const [folded, setFolded] = useState(false);
  const [volume, setVolume] = useState(settings.volume);
  const [shuffle, setShuffle] = useState(settings.shuffle);
  const [crossPlaylist, setCrossPlaylist] = useState(settings.crossPlaylist);
  const [repeatMode, setRepeatMode] = useState(settings.repeat);
  const [volOpen, setVolOpen] = useState(false);
  const [progress, setProgress] = useState({ cur: 0, total: 0 });
  const [ringColor, setRingColor] = useState<string | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const volBarRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colorCache = useRef<Map<string, string>>(new Map());

  // 콜백 안에서 최신 값을 보도록 refs로 미러링 (이벤트 핸들러는 마운트 시 한 번만 등록됨)
  const plsRef = useRef(playlists); plsRef.current = playlists;
  const playlistIdRef = useRef(playlistId); playlistIdRef.current = playlistId;
  const idxRef = useRef(idx); idxRef.current = idx;
  const volumeRef = useRef(volume); volumeRef.current = volume;
  const shuffleRef = useRef(shuffle); shuffleRef.current = shuffle;
  const crossRef = useRef(crossPlaylist); crossRef.current = crossPlaylist;
  const repeatRef = useRef(repeatMode); repeatRef.current = repeatMode;
  const playingRef = useRef(playing); playingRef.current = playing;

  useEffect(() => { setVolume(settings.volume); }, [settings.volume]);
  useEffect(() => { setShuffle(settings.shuffle); }, [settings.shuffle]);
  useEffect(() => { setCrossPlaylist(settings.crossPlaylist); }, [settings.crossPlaylist]);
  useEffect(() => { setRepeatMode(settings.repeat); }, [settings.repeat]);

  useEffect(() => {
    try { setFolded(localStorage.getItem('ohome.bgm.fold') === '1'); } catch { /* 무시 */ }
  }, []);
  const setFold = (v: boolean) => {
    setFolded(v);
    if (!v && playlistId) { setViewPlaylistId(playlistId); setView('tracks'); }
    try { localStorage.setItem('ohome.bgm.fold', v ? '1' : '0'); } catch { /* 무시 */ }
  };

  const hasAnyTrack = playlists.some(p => p.tracks.length > 0);

  /* ---------- YT API 로드 + 플레이어 생성 ---------- */
  useEffect(() => {
    if (!settings.enabled || !hasAnyTrack) return;
    let cancelled = false;
    const create = () => {
      if (cancelled || !holderRef.current || playerRef.current) return;
      playerRef.current = new window.YT!.Player(holderRef.current, {
        width: 0, height: 0,
        playerVars: { controls: 0, disablekb: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (armedRef.current) { armedRef.current = false; playAtRef.current(playlistIdRef.current, idxRef.current); }
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) {
              stopTick();
              advanceRef.current();
            } else if (e.data === 1) {
              startedRef.current = true;
              setPlaying(true);
              startTick();
            } else if (e.data === 2) {
              setPlaying(false);
              stopTick();
            } else if (e.data === -1) {
              setPlaying(false);
              startedRef.current = false;
            }
          },
        },
      });
    };
    if (window.YT?.Player) create();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
      if (!document.getElementById('yt-iframe-api')) {
        const s = document.createElement('script');
        s.id = 'yt-iframe-api';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
    }
    return () => {
      cancelled = true;
      readyRef.current = false;
      stopTick();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled, hasAnyTrack]);

  function startTick() {
    stopTick();
    tickRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setProgress({ cur: p.getCurrentTime() || 0, total: p.getDuration() || 0 });
    }, 1000);
  }
  function stopTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  /* ---------- 재생 ---------- */
  const playAt = (plId: string | null, i: number, opts?: { follow?: boolean }) => {
    const pl = plsRef.current.find(p => p.id === plId);
    const t = pl?.tracks[i];
    if (!pl || !t || !t.videoId) return;
    setPlaylistId(pl.id);
    setIdx(i);
    startedRef.current = true;
    setProgress({ cur: 0, total: parseDurationText(t.duration) });
    if (opts?.follow !== false) { setViewPlaylistId(pl.id); setView('tracks'); }
    if (playerRef.current) {
      playerRef.current.loadVideoById(t.videoId);
      playerRef.current.setVolume(volumeRef.current);
      playerRef.current.playVideo();
      setPlaying(true);
    }
  };
  const playAtRef = useRef(playAt); playAtRef.current = playAt;

  /** 현재 재생목록 안에서 다음/이전 재생 가능한 인덱스. 경계에서 crossPlaylist면 -1(넘어가라는 신호) */
  function pickWithin(direction: 1 | -1): number {
    const pl = plsRef.current.find(p => p.id === playlistIdRef.current);
    if (!pl || !pl.tracks.length) return -1;
    const playable: number[] = [];
    pl.tracks.forEach((t, i) => { if (t.videoId) playable.push(i); });
    if (!playable.length) return -1;

    if (shuffleRef.current) {
      if (playable.length === 1) return playable[0];
      let choice: number;
      do { choice = playable[Math.floor(Math.random() * playable.length)]; } while (choice === idxRef.current);
      return choice;
    }

    let pos = playable.indexOf(idxRef.current);
    if (pos === -1) return playable[0];
    pos += direction;
    if (pos < 0 || pos >= playable.length) {
      if (crossRef.current) return -1;
      pos = pos < 0 ? playable.length - 1 : 0;
    }
    return playable[pos];
  }

  function crossJump(direction: 1 | -1) {
    const list = plsRef.current;
    if (!list.length) return;
    let curIdx = list.findIndex(p => p.id === playlistIdRef.current);
    if (curIdx === -1) curIdx = 0;
    for (let step = 1; step <= list.length; step++) {
      const i = (((curIdx + direction * step) % list.length) + list.length) % list.length;
      const cand = list[i];
      let playIdx = -1;
      if (direction === 1) playIdx = cand.tracks.findIndex(t => !!t.videoId);
      else for (let k = cand.tracks.length - 1; k >= 0; k--) { if (cand.tracks[k].videoId) { playIdx = k; break; } }
      if (playIdx > -1) { playAt(cand.id, playIdx); return; }
    }
  }

  function pickGlobalRandom(): { plId: string; idx: number } | null {
    const pool: { plId: string; idx: number }[] = [];
    plsRef.current.forEach(p => p.tracks.forEach((t, i) => { if (t.videoId) pool.push({ plId: p.id, idx: i }); }));
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    let choice: { plId: string; idx: number };
    do { choice = pool[Math.floor(Math.random() * pool.length)]; }
    while (choice.plId === playlistIdRef.current && choice.idx === idxRef.current);
    return choice;
  }

  const next = () => {
    if (shuffleRef.current && crossRef.current) {
      const p = pickGlobalRandom(); if (p) playAt(p.plId, p.idx);
      return;
    }
    const i = pickWithin(1);
    if (i > -1) playAt(playlistIdRef.current, i);
    else if (crossRef.current) crossJump(1);
  };
  const prev = () => {
    if (shuffleRef.current && crossRef.current) {
      const p = pickGlobalRandom(); if (p) playAt(p.plId, p.idx);
      return;
    }
    const i = pickWithin(-1);
    if (i > -1) playAt(playlistIdRef.current, i);
    else if (crossRef.current) crossJump(-1);
  };
  /** 곡이 자연 종료됐을 때(ENDED) — repeat/shuffle/crossPlaylist 조합에 따라 다음 동작 결정 */
  const advance = () => {
    if (repeatRef.current === 'one') { playAt(playlistIdRef.current, idxRef.current); return; }
    if (shuffleRef.current && crossRef.current) {
      const p = pickGlobalRandom(); if (p) playAt(p.plId, p.idx);
      return;
    }
    const i = pickWithin(1);
    if (i > -1) {
      if (repeatRef.current === 'off' && !shuffleRef.current && !crossRef.current) {
        const pl = plsRef.current.find(p => p.id === playlistIdRef.current);
        const playable = pl?.tracks.filter(t => t.videoId) ?? [];
        const lastIdx = pl?.tracks.lastIndexOf(playable[playable.length - 1]) ?? -1;
        if (idxRef.current === lastIdx) { setPlaying(false); return; }
      }
      playAt(playlistIdRef.current, i);
      return;
    }
    if (crossRef.current) { crossJump(1); return; }
    setPlaying(false);
  };
  const advanceRef = useRef(advance); advanceRef.current = advance;

  const togglePlay = () => {
    if (idxRef.current === -1 || !playlistIdRef.current) {
      // 처음 재생 — 재생 가능한 곡이 있는 첫 재생목록의 첫 곡
      const pl = plsRef.current.find(p => p.tracks.some(t => t.videoId));
      if (!pl) return;
      const i = pl.tracks.findIndex(t => t.videoId);
      playAt(pl.id, i);
      return;
    }
    if (!playerRef.current) return;
    if (playing) { playerRef.current.pauseVideo(); setPlaying(false); }
    else if (!readyRef.current) { armedRef.current = true; }
    else if (!startedRef.current) { playAt(playlistIdRef.current, idxRef.current); }
    else { playerRef.current.setVolume(volumeRef.current); playerRef.current.playVideo(); setPlaying(true); }
  };

  /* ---------- 입장 자동 재생 (첫 상호작용) ---------- */
  const armedRef = useRef(false);
  useEffect(() => {
    if (!settings.autoplay || !settings.enabled || !hasAnyTrack) return;
    const fire = (ev: Event) => {
      remove();
      if (rootRef.current?.contains(ev.target as Node)) return;
      if (playingRef.current) return;
      if (readyRef.current && playerRef.current) {
        const pl = plsRef.current.find(p => p.tracks.some(t => t.videoId));
        if (pl) playAtRef.current(pl.id, pl.tracks.findIndex(t => t.videoId));
      } else {
        armedRef.current = true;
      }
    };
    const remove = () => {
      window.removeEventListener('pointerdown', fire, true);
      window.removeEventListener('keydown', fire, true);
    };
    window.addEventListener('pointerdown', fire, true);
    window.addEventListener('keydown', fire, true);
    return remove;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoplay, settings.enabled, hasAnyTrack]);

  const onVolDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const set = (clientY: number) => {
      const r = volBarRef.current!.getBoundingClientRect();
      // 세로 바: 아래쪽이 0%, 위쪽이 100%
      const v = Math.round(Math.min(1, Math.max(0, (r.bottom - clientY) / r.height)) * 100);
      setVolume(v);
      playerRef.current?.setVolume(v);
    };
    set(e.clientY);
    const mv = (ev: PointerEvent) => set(ev.clientY);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  /* ---------- 화면 전환 ---------- */
  const openPlaylist = (id: string) => { setViewPlaylistId(id); setView('tracks'); };
  const showBrowse = () => setView('browse');
  const expand = () => {
    setFolded(false);
    try { localStorage.setItem('ohome.bgm.fold', '0'); } catch { /* 무시 */ }
    if (playlistId && idx > -1) { setViewPlaylistId(playlistId); setView('tracks'); }
  };

  const viewPlaylist = playlists.find(p => p.id === viewPlaylistId) ?? null;
  const playingPlaylist = playlists.find(p => p.id === playlistId) ?? null;
  const playingTrack = playingPlaylist?.tracks[idx];
  const isViewingPlaying = !!viewPlaylist && viewPlaylist.id === playlistId;

  const coverUrl = useBlobUrl(viewPlaylist?.cover || undefined);
  const miniCoverUrl = useBlobUrl(playingPlaylist?.cover || undefined);

  /* 앨범아트 대표색 추출 — 재생목록당 1회 계산 후 캐시 */
  useEffect(() => {
    if (!isViewingPlaying || !viewPlaylist) { setRingColor(null); return; }
    if (viewPlaylist.coverColor) { setRingColor(viewPlaylist.coverColor); return; }
    const key = `${viewPlaylist.id}:${viewPlaylist.cover}`;
    const cached = colorCache.current.get(key);
    if (cached) { setRingColor(cached); return; }
    let cancelled = false;
    (async () => {
      const color = coverUrl ? await extractDominantColorFromUrl(coverUrl) : null;
      const final = color || THEME_RING[themeIdx(viewPlaylist)];
      colorCache.current.set(key, final);
      if (!cancelled) setRingColor(final);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewingPlaying, viewPlaylist?.id, viewPlaylist?.cover, viewPlaylist?.coverColor, coverUrl]);

  if (!settings.enabled || !hasAnyTrack) return null;

  const ringFrac = isViewingPlaying && progress.total > 0 ? Math.min(1, progress.cur / progress.total) : 0;
  const spinning = isViewingPlaying && playing;
  const cycleRepeat = () => setRepeatMode(m => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));

  return (
    <div
      ref={rootRef}
      className={`bgm2 ${folded ? 'folded' : ''} ${settings.position === 'bl' ? 'bgm-left' : ''}`}
      style={settings.position === 'bl' ? { right: 'auto', left: 20 } : undefined}
    >
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <div ref={holderRef} />
      </div>

      {/* 미니 바 */}
      {folded && (
        <div className="mini" onClick={expand}>
          <div className="mini-art" style={miniCoverUrl ? { backgroundImage: `url(${miniCoverUrl})` } : undefined}
            data-fb={playingPlaylist ? `t${themeIdx(playingPlaylist)}` : undefined} />
          <div className="mini-info">
            <Marquee className="mini-tt" text={playingTrack?.title ?? 'BGM'} active={playing} />
            <div className="mini-sub">{playingTrack?.artist || playingPlaylist?.title || '재생목록을 선택해보세요'}</div>
          </div>
          <button className="mini-play" onClick={e => { e.stopPropagation(); togglePlay(); }}>
            {playing ? <IcPause /> : <IcPlay />}
          </button>
        </div>
      )}

      {/* 펼쳐진 패널 */}
      {!folded && (
        <div className="panel">
          <div className="pn-head">
            {view === 'tracks' && <button className="pn-ic" onClick={showBrowse} data-tip="목록으로"><IcBack /></button>}
            <div className="pn-title">{view === 'tracks' ? (viewPlaylist?.title ?? '') : 'PLAYLIST'}</div>
            <button className="pn-ic" onClick={() => setFold(true)} data-tip="최소화"><IcChevDown /></button>
          </div>

          {view === 'browse' && (
            <div className="mc-wrap">
              {playlists.length === 0 ? (
                <div className="mc-empty">등록된 재생목록이 없습니다</div>
              ) : (
                <div className={`mc-scroll${playlists.length === 1 ? ' single' : ''}`} onWheel={e => {
                  const el = e.currentTarget;
                  const h = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                  if (h) { e.preventDefault(); el.scrollLeft += h; }
                }}>
                  {playlists.map(pl => <MoodCard key={pl.id} pl={pl} onOpen={() => openPlaylist(pl.id)} />)}
                </div>
              )}
            </div>
          )}

          {view === 'tracks' && viewPlaylist && (
            <>
              <div className="rec-wrap">
                <svg className="rec-ring" viewBox="0 0 134 134">
                  <circle cx="67" cy="67" r="63" fill="none" stroke={ringColor ?? 'var(--accent)'} strokeWidth={3}
                    strokeLinecap="round" strokeDasharray={RING_CIRC}
                    strokeDashoffset={RING_CIRC * (1 - ringFrac)}
                    transform="rotate(-90 67 67)"
                    style={{ transition: 'stroke-dashoffset .3s linear, stroke .4s ease' }} />
                </svg>
                <div className={`tonearm ${spinning ? 'on' : ''}`}>
                  <span className="pivot" /><span className="arm" />
                </div>
                <div className={`rec ${spinning ? 'spin' : ''}`}>
                  <div className={`rec-label ${!coverUrl ? `mc-t${themeIdx(viewPlaylist)}` : ''}`}
                    style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined} />
                  <div className="rec-hole" />
                </div>
              </div>

              <ul className="tr-list">
                {viewPlaylist.tracks.map((t, i) => {
                  const isPlaying = isViewingPlaying && i === idx;
                  const has = !!t.videoId;
                  return (
                    <li key={t.id} className={`tr ${isPlaying ? 'on' : ''} ${!has ? 'off' : ''}`}
                      onClick={() => has && playAt(viewPlaylist.id, i)}>
                      <span className="tr-idx">{isPlaying && playing ? <IcVolume /> : i + 1}</span>
                      <span className="tr-main">
                        <span className="tr-title">{t.title}</span>
                        <span className="tr-artist">{t.artist || (has ? '' : '유튜브 링크 없음')}</span>
                      </span>
                      <span className="tr-dur">
                        {isPlaying ? `${fmtTime(progress.cur)} / ${t.duration || '--:--'}` : (t.duration || '--:--')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="ctrl2">
            <button className={`ic-btn ${shuffle ? 'on' : ''}`} onClick={() => setShuffle(v => !v)} data-tip="셔플"><IcShuffle /></button>
            <button className={`ic-btn ${crossPlaylist ? 'on' : ''}`} onClick={() => setCrossPlaylist(v => !v)} data-tip="재생목록 넘나들기"><IcCross /></button>
            <div className="tr-btns">
              <button onClick={prev} data-tip="이전"><IcPrev /></button>
              <button className="pp" onClick={togglePlay} data-tip={playing ? '일시정지' : '재생'}>{playing ? <IcPause /> : <IcPlay />}</button>
              <button onClick={next} data-tip="다음"><IcNext /></button>
            </div>
            <button className={`ic-btn ${repeatMode !== 'off' ? 'on' : ''}`} onClick={cycleRepeat}
              data-tip={repeatMode === 'off' ? '반복 꺼짐' : repeatMode === 'all' ? '전체 반복' : '한 곡 반복'}>
              {repeatMode === 'one' ? <b className="one">1</b> : <IcRepeat />}
            </button>
            <div className="vol2" ref={volRef}>
              <button className="ic-btn" onClick={() => setVolOpen(o => !o)} data-tip={`볼륨 ${volume}`}><IcVolume /></button>
              {volOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={() => setVolOpen(false)} />
                  <div className="vol2-pop" ref={volBarRef} onPointerDown={onVolDrag}>
                    <i style={{ height: `${volume}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
