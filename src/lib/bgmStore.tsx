'use client';
// BGM 저장소 (5.3) — 재생목록(무드 카드) 구조 · localStorage(→ Supabase 이전 예정)
// v1: 플랫 곡 목록 하나 → v2: 여러 재생목록(무드 카드), 각 재생목록에 곡 여러 개.
// 구버전 데이터('tracks' 배열만 있던 시절)는 최초 로드 시 "BGM"이라는 재생목록 하나로 자동 이관한다.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { newId } from './postStore';
import { getRawSetting, setSetting } from './settingStore';

export interface BgmTrack {
  id: string;
  title: string;
  artist: string;
  videoId: string;   // 유튜브 영상 ID
  duration: string;  // 표시용 재생시간 텍스트 ("3:45") — 관리자가 직접 입력, 없으면 "--:--"
}

export interface BgmPlaylist {
  id: string;
  title: string;
  cover: string;      // blobStore 참조 문자열 — 비어 있으면 자동 그러데이션(제목 해시 기반)
  coverColor?: string; // 커버 이미지 대표색 — 업로드 시점(같은 출처의 원본 파일)에 미리 계산해 저장.
                        // 배포 후에는 cover가 원격 스토리지 URL이 되어 캔버스로 다시 읽으면
                        // CORS에 막힐 수 있어, 업로드 그 순간에 뽑아 함께 저장해 둔다.
  tracks: BgmTrack[];
}

export interface BgmSettings {
  volume: number;               // 0~100 기본 볼륨
  position: 'br' | 'bl';        // 플레이어 위치 (기본: 오른쪽 아래)
  shuffle: boolean;
  crossPlaylist: boolean;       // 켜면 이전/다음 곡이 재생목록 경계에서 다음 재생목록으로 이어짐
                                 // (셔플과 함께 켜면 전체 재생목록을 넘나들며 무작위 재생)
  repeat: 'off' | 'all' | 'one';
  enabled: boolean;              // 플레이어 표시 여부
  autoplay: boolean;             // 입장 후 첫 상호작용 시 자동 재생
}

interface BgmState { playlists: BgmPlaylist[]; settings: BgmSettings }

const DEFAULT_SETTINGS: BgmSettings = {
  volume: 60, position: 'br', shuffle: false, crossPlaylist: false, repeat: 'all',
  enabled: true, autoplay: true,
};

const DEFAULT_STATE: BgmState = { playlists: [], settings: DEFAULT_SETTINGS };

const STORAGE_KEY = 'ohome.bgm.v1';

/** 구버전({tracks:[...], settings:{repeat:boolean,...}}) 감지 및 이관 */
function migrate(raw: unknown): BgmState {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.playlists)) {
    // 이미 v2 형태 — 필드 누락분만 기본값으로 채움
    const playlists = (r.playlists as Array<Record<string, unknown>>).map(p => ({
      id: String(p.id ?? newId()),
      title: String(p.title ?? ''),
      cover: String(p.cover ?? ''),
      coverColor: typeof p.coverColor === 'string' && p.coverColor ? p.coverColor : undefined,
      tracks: Array.isArray(p.tracks) ? (p.tracks as Array<Record<string, unknown>>).map(t => ({
        id: String(t.id ?? newId()),
        title: String(t.title ?? ''),
        artist: String(t.artist ?? ''),
        videoId: String(t.videoId ?? ''),
        duration: String(t.duration ?? ''),
      })) : [],
    }));
    const s = (r.settings ?? {}) as Record<string, unknown>;
    return {
      playlists,
      settings: {
        volume: typeof s.volume === 'number' ? s.volume : DEFAULT_SETTINGS.volume,
        position: s.position === 'bl' ? 'bl' : 'br',
        shuffle: !!s.shuffle,
        crossPlaylist: !!s.crossPlaylist,
        repeat: s.repeat === 'off' || s.repeat === 'one' ? s.repeat : (s.repeat === false ? 'off' : 'all'),
        enabled: s.enabled !== false,
        autoplay: s.autoplay !== false,
      },
    };
  }

  if (Array.isArray(r.tracks)) {
    // v1 구버전 — 모든 곡을 "BGM" 재생목록 하나로 이관
    const tracks = (r.tracks as Array<Record<string, unknown>>).map(t => ({
      id: String(t.id ?? newId()),
      title: String(t.title ?? ''),
      artist: String(t.desc ?? ''),
      videoId: String(t.videoId ?? ''),
      duration: '',
    }));
    const s = (r.settings ?? {}) as Record<string, unknown>;
    return {
      playlists: tracks.length ? [{ id: newId(), title: 'BGM', cover: '', tracks }] : [],
      settings: {
        volume: typeof s.volume === 'number' ? s.volume : DEFAULT_SETTINGS.volume,
        position: s.position === 'bl' ? 'bl' : 'br',
        shuffle: !!s.shuffle,
        crossPlaylist: false,
        repeat: s.repeat === false ? 'off' : 'all',
        enabled: s.enabled !== false,
        autoplay: s.autoplay !== false,
      },
    };
  }

  return DEFAULT_STATE;
}

interface BgmCtx {
  state: BgmState;
  setPlaylists: (p: BgmPlaylist[]) => void;
  addPlaylist: (title: string, cover?: string) => string;
  updatePlaylist: (id: string, patch: Partial<Pick<BgmPlaylist, 'title' | 'cover' | 'coverColor'>>) => void;
  removePlaylist: (id: string) => void;
  setTracks: (playlistId: string, tracks: BgmTrack[]) => void;
  addTrack: (playlistId: string, title: string, artist: string, urlOrId: string, duration: string) => boolean;
  updateTrack: (playlistId: string, trackId: string, patch: Partial<Omit<BgmTrack, 'id'>>) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  setSettings: (patch: Partial<BgmSettings>) => void;
}

const Ctx = createContext<BgmCtx | null>(null);

/** 유튜브 URL/ID → videoId 추출 */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** 캔버스로 이미지 픽셀을 평균 내 대표색을 뽑는다. 실패(디코딩 오류 등)하면 null. */
function averageColorFromImage(img: HTMLImageElement): string | null {
  try {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return null;
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  } catch {
    return null; // 캔버스가 오염된 경우(CORS) 등
  }
}

/**
 * 방금 고른 파일(Blob)에서 대표색을 뽑는다 — 업로드 직후, 아직 우리 브라우저 안에 있는
 * 원본이라 항상 같은 출처라서 CORS에 걸릴 일이 없다. 업로드 시점에 호출해서
 * BgmPlaylist.coverColor로 저장해 두는 용도.
 */
export function extractDominantColorFromBlob(blob: Blob): Promise<string | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { const c = averageColorFromImage(img); URL.revokeObjectURL(url); resolve(c); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * 이미지 URL에서 대표색을 뽑는다 — coverColor가 없는 예전 데이터를 위한 호환용 경로.
 * 원격 URL은 저장소가 CORS를 허용해야만 성공하고, 실패하면 null(호출부가 테마색으로 대체).
 */
export function extractDominantColorFromUrl(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(averageColorFromImage(img));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function BgmStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BgmState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = getRawSetting(STORAGE_KEY);
      if (raw) setState(migrate(JSON.parse(raw)));
    } catch { /* 기본값 */ }
  }, []);

  const persist = (s: BgmState) => {
    try { setSetting(STORAGE_KEY, s); } catch { /* 무시 */ }
  };

  const setPlaylists = useCallback((playlists: BgmPlaylist[]) => {
    setState(s => { const n = { ...s, playlists }; persist(n); return n; });
  }, []);

  const addPlaylist = useCallback((title: string, cover?: string): string => {
    const id = newId();
    setState(s => {
      const n = { ...s, playlists: [...s.playlists, { id, title: title.trim() || '새 재생목록', cover: cover ?? '', tracks: [] }] };
      persist(n); return n;
    });
    return id;
  }, []);

  const updatePlaylist = useCallback((id: string, patch: Partial<Pick<BgmPlaylist, 'title' | 'cover' | 'coverColor'>>) => {
    setState(s => {
      const n = { ...s, playlists: s.playlists.map(p => (p.id === id ? { ...p, ...patch } : p)) };
      persist(n); return n;
    });
  }, []);

  const removePlaylist = useCallback((id: string) => {
    setState(s => { const n = { ...s, playlists: s.playlists.filter(p => p.id !== id) }; persist(n); return n; });
  }, []);

  const setTracks = useCallback((playlistId: string, tracks: BgmTrack[]) => {
    setState(s => {
      const n = { ...s, playlists: s.playlists.map(p => (p.id === playlistId ? { ...p, tracks } : p)) };
      persist(n); return n;
    });
  }, []);

  const addTrack = useCallback((playlistId: string, title: string, artist: string, urlOrId: string, duration: string): boolean => {
    const vid = parseVideoId(urlOrId);
    if (!vid || !title.trim()) return false;
    setState(s => {
      const n = {
        ...s,
        playlists: s.playlists.map(p => (p.id === playlistId
          ? { ...p, tracks: [...p.tracks, { id: newId(), title: title.trim(), artist: artist.trim(), videoId: vid, duration: duration.trim() }] }
          : p)),
      };
      persist(n); return n;
    });
    return true;
  }, []);

  const updateTrack = useCallback((playlistId: string, trackId: string, patch: Partial<Omit<BgmTrack, 'id'>>) => {
    setState(s => {
      const n = {
        ...s,
        playlists: s.playlists.map(p => (p.id === playlistId
          ? { ...p, tracks: p.tracks.map(t => (t.id === trackId ? { ...t, ...patch } : t)) }
          : p)),
      };
      persist(n); return n;
    });
  }, []);

  const removeTrack = useCallback((playlistId: string, trackId: string) => {
    setState(s => {
      const n = {
        ...s,
        playlists: s.playlists.map(p => (p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p)),
      };
      persist(n); return n;
    });
  }, []);

  const setSettings = useCallback((patch: Partial<BgmSettings>) => {
    setState(s => { const n = { ...s, settings: { ...s.settings, ...patch } }; persist(n); return n; });
  }, []);

  return (
    <Ctx.Provider value={{
      state, setPlaylists, addPlaylist, updatePlaylist, removePlaylist,
      setTracks, addTrack, updateTrack, removeTrack, setSettings,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBgm(): BgmCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBgm must be used within BgmStoreProvider');
  return ctx;
}
