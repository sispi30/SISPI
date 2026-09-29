'use client';
/**
 * 인트로(소개) 페이지 — **프로필 양식 + 자유 글** 한 칸 저장.
 *
 * 목록도 댓글도 없이 한 페이지뿐이라, 글 테이블이 아니라 **설정 한 칸**에 담는다.
 * 그래서 DB 구조를 건드릴 일이 없고(포크 쓰는 사람이 SQL을 다시 실행하지 않아도 된다),
 * 백업·서버 동기화도 기존 키(ohome.intro.v1)를 그대로 탄다.
 *
 * 화면 방식은 세 가지 (mode):
 *   · profile — 이름·프로필·계정·LOVE/HATE·키워드·팔레트 같은 **정해진 칸에 채워 넣는 양식**
 *   · editor  — 에디터로 쓰는 자유 글
 *   · html    — HTML을 직접 쓰는 자유 글
 * 방식을 바꿔도 다른 쪽에 써 둔 내용은 지우지 않는다(각자 따로 보관).
 */
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';
import type { CropValue } from '@/components/ui/CropEditor';

const KEY = 'ohome.intro.v1';

export interface StatItem { value: string; label: string }

/** 가운데 큰 이미지의 한 장면 — 메인 「슬라이드 배너」의 슬라이드와 같은 구성
 *  (원본은 imgId로 보존하고 보이는 위치만 crop으로 기록 · 옛 주소 이미지는 img) */
export interface HeroSlide {
  id: string; cap: string; sub: string; link: string;
  imgId?: string; img?: string; crop?: CropValue;
}
export interface ListBlock { title: string; items: string[] }

/** 프로필 양식의 내용 — 비어 있는 칸은 화면에서 통째로 감춘다 */
export interface IntroProfile {
  name: string;            // 큰 이름
  sub: string;             // 이름 아래 작은 영문 라벨
  quote: string;           // 한 줄 소개
  profileTitle: string;    // 오른쪽 위 목록 제목
  profile: string[];       // 오른쪽 위 목록(점 목록) — 한 줄이 한 항목
  heroImg: string;         // (옛 값) 가운데 큰 이미지 한 장 — 읽을 때 heroSlides 한 장으로 옮긴다
  heroSlides: HeroSlide[]; // 가운데 큰 이미지 — 슬라이드 배너와 같은 방식(여러 장·위치 조정·캡션·링크)
  heroInterval: number;    // 슬라이드 전환 간격(초)
  heroLabel: string;       // 이미지 위 게이지 이름 (비우면 게이지 숨김)
  heroPercent: number;     // 게이지 0~100
  heroCount: string;       // 이미지 오른쪽 위 작은 표시 (예: ×4)
  accountTitle: string;
  stats: StatItem[];       // 큼직한 값 + 작은 라벨 (연령/타장르/성향…)
  cols: ListBlock[];       // 번호 붙은 목록 열 (LOVE / HATE …)
  flowTitle: string;
  flow: string[];          // 알약 → 알약 → 알약
  kwTitle: string;
  kwQuotes: string[];      // 밑줄 친 문장
  kwLine: string;          // 한 줄 메모
  kwTags: string[];        // 점 찍은 태그
  palTitle: string;
  palette: string[];       // 색 코드
  notes: ListBlock[];      // 아래 두 칸 (NO / 뒷담 관련 …) — 번호 없는 문단 목록
}

export interface IntroDoc {
  /** 자유 글 본문 HTML — 에디터로 쓰든 HTML로 직접 쓰든 저장 형태는 같다 */
  html: string;
  /** 지금 화면에 보여 줄 방식 — 다음에 열 때도 그 모드로 연다.
   *  HTML로 짜 둔 글이 에디터로 열리면서 태그가 깎이는 일이 없게 하려는 것이다. */
  mode?: 'profile' | 'editor' | 'html';
  /** 프로필 양식 내용 (없으면 아직 안 쓴 것) */
  profile?: IntroProfile;
}

export const EMPTY_PROFILE: IntroProfile = {
  name: '', sub: 'NOTICE PROFILE', quote: '',
  profileTitle: 'PROFILE', profile: [],
  heroImg: '', heroSlides: [], heroInterval: 4, heroLabel: 'ACTIVITY', heroPercent: 78, heroCount: '',
  accountTitle: 'ACCOUNT', stats: [],
  cols: [{ title: 'LOVE', items: [] }, { title: 'HATE', items: [] }],
  flowTitle: '', flow: [],
  kwTitle: 'KEYWORDS', kwQuotes: [], kwLine: '', kwTags: [],
  palTitle: 'COLOR PALETTE', palette: [],
  notes: [{ title: 'NO', items: [] }, { title: '', items: [] }],
};

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const blocks = (v: unknown, fallback: ListBlock[]): ListBlock[] =>
  Array.isArray(v)
    ? v.map(b => ({ title: typeof b?.title === 'string' ? b.title : '', items: strs(b?.items) }))
    : fallback;

const heroSlides = (v: unknown, legacy: string): HeroSlide[] => {
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const list: HeroSlide[] = Array.isArray(v)
    ? v.filter(x => x && typeof x === 'object').map((x, i) => ({
        id: str(x.id) || `h${i}`, cap: str(x.cap), sub: str(x.sub), link: str(x.link),
        imgId: str(x.imgId) || undefined, img: str(x.img) || undefined,
        crop: x.crop && typeof x.crop === 'object' ? x.crop as CropValue : undefined,
      }))
    : [];
  /* 예전에 한 장만 넣던 값 — 있으면 첫 장면으로 옮겨 그대로 보이게 */
  const old = legacy.trim();
  if (!list.length && old) list.push({ id: 'h0', cap: '', sub: '', link: '', ...(/^https?:/.test(old) ? { img: old } : { imgId: old }) });
  return list;
};

/** 저장본(또는 일부만 있는 값)을 안전하게 완성된 프로필로 — 옛 값·깨진 값이 와도 화면이 죽지 않게 */
export function normProfile(p?: Partial<IntroProfile> | null): IntroProfile {
  const b = EMPTY_PROFILE;
  const s = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
  return {
    name: s(p?.name, b.name), sub: s(p?.sub, b.sub), quote: s(p?.quote, b.quote),
    profileTitle: s(p?.profileTitle, b.profileTitle), profile: strs(p?.profile),
    heroImg: '', heroSlides: heroSlides(p?.heroSlides, s(p?.heroImg, '')),
    heroInterval: typeof p?.heroInterval === 'number' ? Math.max(2, Math.min(30, p.heroInterval)) : b.heroInterval,
    heroLabel: s(p?.heroLabel, b.heroLabel),
    heroPercent: typeof p?.heroPercent === 'number' ? Math.max(0, Math.min(100, p.heroPercent)) : b.heroPercent,
    heroCount: s(p?.heroCount, b.heroCount),
    accountTitle: s(p?.accountTitle, b.accountTitle),
    stats: Array.isArray(p?.stats)
      ? p.stats.map(x => ({ value: s(x?.value, ''), label: s(x?.label, '') })) : [],
    cols: blocks(p?.cols, b.cols),
    flowTitle: s(p?.flowTitle, b.flowTitle), flow: strs(p?.flow),
    kwTitle: s(p?.kwTitle, b.kwTitle), kwQuotes: strs(p?.kwQuotes),
    kwLine: s(p?.kwLine, b.kwLine), kwTags: strs(p?.kwTags),
    palTitle: s(p?.palTitle, b.palTitle), palette: strs(p?.palette),
    notes: blocks(p?.notes, b.notes),
  };
}

const EMPTY: IntroDoc = { html: '', mode: 'profile', profile: undefined };

function load(): IntroDoc {
  try {
    const raw = getRawSetting(KEY);
    if (!raw) return EMPTY;
    const d = { ...EMPTY, ...JSON.parse(raw) } as IntroDoc;
    /* 예전에 자유 글만 쓰던 홈은 그 글이 그대로 보이게 둔다.
       글이 하나도 없던 홈(비어 있음)만 새 프로필 양식으로 시작한다. */
    if (!d.mode) d.mode = d.html?.trim() ? 'editor' : 'profile';
    else if (!d.profile && !d.html?.trim()) d.mode = 'profile';
    return d;
  } catch { return EMPTY; }
}

export function useIntro(): [IntroDoc, (next: IntroDoc) => void, boolean] {
  const [doc, setDoc] = useState<IntroDoc>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setDoc(load());
    setLoaded(true);
  }, []);
  const save = useCallback((next: IntroDoc) => {
    setDoc(next);
    try { setSetting(KEY, next); } catch { /* 무시 */ }
  }, []);
  return [doc, save, loaded];
}
