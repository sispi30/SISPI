'use client';
// 웹박수 (원본: PHP 「Web Clap」 스킨) — 익명으로 박수·메시지를 남기고, 관리자가 답글을 단다.
//
// 저장
//  · 박수·메시지·답글은 `ohome.webclap.v1` (서버 컬렉션 webclap) — 방문자(비로그인)도 남길 수 있다.
//  · 박수와 메시지는 **나만보기(private)** 로 저장한다 — 서버가 관리자에게만 내준다. 방문자가 남긴 글을 다른 방문자가
//    API로 읽을 수 없다. 관리자가 답글을 달면 그 답글(과, 비밀글이 아니면 원 메시지)만 공개로 바뀌어 방문자에게 보인다.
//  · 설정(공지·하루 제한·N번째 이벤트·랜덤 이미지)은 `ohome.webclap.cfg.v1` — 관리자만 고치고 모두가 읽는다.
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export const WC_KEY = 'ohome.webclap.v1';
export const WC_CFG_KEY = 'ohome.webclap.cfg.v1';

export interface WcEntry {
  id: string;
  type: 'clap' | 'message' | 'reply';
  content: string;           // 박수는 빈 글
  secret: boolean;           // 비밀글 — 답글을 달아도 방문자에게 공개하지 않는다
  date: string;              // ISO
  parentId?: string;         // 답글이 달린 메시지 id
  visibility: 'public' | 'private';
}

export interface WcEvent { number: number; message: string }
export interface WcConfig {
  notice: string;
  clapLimit: number;         // 이 브라우저에서 하루 박수 횟수 (0 = 무제한)
  events: WcEvent[];
  images: string[];          // 랜덤으로 한 장 보여 줄 그림 (blobStore 참조)
  total?: number;            // 전체 개수 — 관리자가 페이지를 열 때 갱신해 방문자에게 보여 준다
}

export const DEFAULT_WC: WcConfig = { notice: '', clapLimit: 10, events: [], images: [] };

export function normalizeWc(raw: unknown): WcConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<WcConfig>;
  return {
    notice: typeof r.notice === 'string' ? r.notice : '',
    clapLimit: Number.isFinite(Number(r.clapLimit)) && r.clapLimit !== undefined ? Math.max(0, Math.floor(Number(r.clapLimit))) : 10,
    events: Array.isArray(r.events)
      ? r.events.filter(e => e && Number(e.number) > 0 && typeof e.message === 'string' && e.message.trim())
        .map(e => ({ number: Math.floor(Number(e.number)), message: e.message.trim() }))
      : [],
    images: Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === 'string' && !!x) : [],
    total: typeof r.total === 'number' ? r.total : undefined,
  };
}

export function useWcConfig(): [WcConfig, (next: WcConfig) => void, boolean] {
  const [cfg, setCfg] = useState<WcConfig>(DEFAULT_WC);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const raw = getRawSetting(WC_CFG_KEY);
        setCfg(normalizeWc(raw ? JSON.parse(raw) : null));
      } catch { setCfg(DEFAULT_WC); }
    };
    read();
    setLoaded(true);
    window.addEventListener('ohome-setting', read);
    return () => window.removeEventListener('ohome-setting', read);
  }, []);
  const save = useCallback((next: WcConfig) => {
    setCfg(next);
    try { setSetting(WC_CFG_KEY, next); } catch { /* 무시 */ }
  }, []);
  return [cfg, save, loaded];
}

/** 하루 박수 횟수 — 이 브라우저 기준 (서버가 IP를 알 수 없어 PHP 원본의 「IP당」을 브라우저로 대신한다) */
const DAY_KEY = 'ohome.webclap.day';
const dayStr = () => new Date().toISOString().slice(0, 10);
export function clapsToday(): number {
  try {
    const o = JSON.parse(localStorage.getItem(DAY_KEY) || '{}') as { d?: string; n?: number };
    return o.d === dayStr() ? o.n ?? 0 : 0;
  } catch { return 0; }
}
export function bumpClaps() {
  try { localStorage.setItem(DAY_KEY, JSON.stringify({ d: dayStr(), n: clapsToday() + 1 })); } catch { /* 무시 */ }
}
/** 메시지는 1분에 10번까지 */
const MSG_KEY = 'ohome.webclap.msgs';
export function msgAllowed(): boolean {
  try {
    const now = Date.now();
    const list = (JSON.parse(localStorage.getItem(MSG_KEY) || '[]') as number[]).filter(t => now - t < 60_000);
    if (list.length >= 10) return false;
    list.push(now);
    localStorage.setItem(MSG_KEY, JSON.stringify(list));
    return true;
  } catch { return true; }
}
