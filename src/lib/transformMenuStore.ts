'use client';
// 트랜스폼 메뉴 위젯 (커스텀 요청) — 그누보드 위젯 「트랜스폼 메뉴 위젯」을 이 사이트 구조에 맞게 이식.
// 켜면 기존 상단바(TopBar)의 메뉴 줄(gnb)을 숨기고, 위치·글꼴·배경·로고를 자유롭게 꾸민
// 플로팅 메뉴 위젯으로 대체한다. 방문자가 끌어 옮긴 위치는 이 브라우저에만 기억된다(서버 저장 X).
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export type TfDirection = 'row' | 'column';
export type TfJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
export type TfAlign = 'flex-start' | 'center' | 'flex-end';
export type TfAnchorX = 'left' | 'center' | 'right';
export type TfAnchorY = 'top' | 'center' | 'bottom';
export type TfDivider = 'none' | 'line' | 'dot';
export type TfIconMode = 'text' | 'icon-text' | 'icon' | 'line';

export interface TransformMenuSettings {
  enabled: boolean;              // 켜면 기존 상단 메뉴 대신 이 위젯을 사용

  // 배치
  direction: TfDirection;
  justify: TfJustify;
  align: TfAlign;
  gap: number;
  positionType: 'fixed' | 'static'; // fixed: 화면에 고정(드래그 가능) · static: 상단바 자리에 그대로
  posX: number; posY: number;       // fixed일 때 anchor 기준 위치 (vw/vh, %)
  anchorX: TfAnchorX;
  anchorY: TfAnchorY;
  draggable: boolean;               // 방문자가 끌어 옮길 수 있는지
  savePosition: boolean;            // 옮긴 위치를 이 브라우저에 기억할지

  // 아이콘 (커스텀 요청) — 메뉴 관리에서 항목별로 지정한 Font Awesome 아이콘을 이 위젯에 표시할지
  iconMode: TfIconMode;   // text: 글자만(기본) · icon-text: 아이콘+글자 · icon: 아이콘만 · line: 가로선 + 영문 라벨 + 현재 위치 마커(아카이브 라인)
  subAlign: 'left' | 'center' | 'right';          // 서브메뉴 글자 정렬
  subIconMode: 'text' | 'icon-text' | 'icon';   // 서브메뉴 표시 방식 — 글자만 · 아이콘+글자(기본, 예전 동작) · 아이콘만(아이콘 없는 항목은 글자)
  lineEn: Record<string, string>;   // line 방식의 영문 라벨 — 상위 메뉴 이름 → 영문 (비우면 자동)

  // 메뉴 글자
  menuFontSize: number;
  menuFontColor: string;   // 비우면 --top-fg
  menuHoverColor: string;  // 비우면 --top-hv
  menuLetterSpacing: number;
  menuFontWeight?: number; // 글자 굵기 (비우면 기본)
  menuFontScale: number;   // 글자 크기 배율 % (메뉴·서브메뉴 공통)
  menuFontId: string;      // 메뉴 글꼴 (비우면 사이트 기본)

  // 서브메뉴 글자
  subFontSize: number;
  subFontColor: string;    // 비우면 --dd-fg
  subHoverColor: string;   // 비우면 --accent

  // 로고
  showLogo: boolean;
  logoBlobId: string;
  logoWidth: number;

  // 버튼
  showLoginBtn: boolean;   // 비로그인 방문자에게 로그인 버튼
  showAdminBtn: boolean;   // 관리자에게 환경설정 바로가기 버튼

  // 배경/테두리
  bgTransparent: boolean;
  bgColor: string;         // 비우면 --top-bg
  borderWidth: number;
  borderColor: string;     // 비우면 --line
  borderRadius: number;
  padding: number;
  bgShadow: boolean;

  // 외곽선 효과 — 테두리 바깥에 살짝 띄워 한 겹 더 두르는 선 (두께 0이면 끔)
  outlineWidth: number;
  outlineColor: string;    // 비우면 포인트색(--accent)

  // 항목 외곽선 — 박스로 감싸는 게 아니라 각 아이콘·글자 자체에 두르는 윤곽선 (글자 윤곽선처럼, 두께 0이면 끔)
  itemOutlineWidth: number;    // 글자·아이콘 바깥으로 보이는 두께(px)
  itemOutlineColor: string;    // 비우면 포인트색(--accent)

  // 항목 그림자 — 같은 방식으로 아이콘·글자 자체에 드리우는 그림자 (강도 0이면 끔)
  itemShadow: number;          // 0~100 (%)
  itemShadowColor: string;     // 비우면 검정

  // 서브메뉴 배경
  subHoverBg: string;      // 서브메뉴 항목 호버 박스색 — 비우면 기존 연한 색
  subBgColor: string;      // 비우면 --dd-bg
  subBorderRadius: number;
  subShadow: boolean;

  // 구분선(상위 메뉴 사이)
  dividerStyle: TfDivider;
  dividerColor: string;    // 비우면 --line
}

export const DEFAULT_TRANSFORM_MENU: TransformMenuSettings = {
  enabled: false,

  direction: 'row',
  justify: 'center',
  align: 'center',
  gap: 22,
  positionType: 'fixed',
  posX: 50, posY: 14,
  anchorX: 'center', anchorY: 'top',
  draggable: true,
  savePosition: true,

  iconMode: 'text',
  subAlign: 'left',
  subIconMode: 'icon-text',
  lineEn: {},

  menuFontSize: 14,
  menuFontColor: '',
  menuHoverColor: '',
  menuLetterSpacing: 0,
  menuFontId: '',
  menuFontScale: 100,

  subFontSize: 13,
  subFontColor: '',
  subHoverColor: '',

  showLogo: true,
  logoBlobId: '',
  logoWidth: 100,

  showLoginBtn: true,
  showAdminBtn: true,

  bgTransparent: false,
  bgColor: '',
  borderWidth: 1,
  borderColor: '',
  borderRadius: 999,
  padding: 10,
  bgShadow: true,

  outlineWidth: 2,
  outlineColor: '',

  itemOutlineWidth: 1,
  itemOutlineColor: '',

  itemShadow: 0,
  itemShadowColor: '',

  subBgColor: '',
  subHoverBg: '',
  subBorderRadius: 10,
  subShadow: true,

  dividerStyle: 'none',
  dividerColor: '',
};

const KEY = 'ohome.tfmenu.v1';
const EVT = 'ohome-tfmenu';

export function useTransformMenuSettings(): [TransformMenuSettings, (patch: Partial<TransformMenuSettings>) => void, boolean] {
  const [st, setSt] = useState<TransformMenuSettings>(DEFAULT_TRANSFORM_MENU);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const raw = getRawSetting(KEY);
        if (raw) setSt({ ...DEFAULT_TRANSFORM_MENU, ...JSON.parse(raw) });
      } catch { /* 기본값 */ }
    };
    load();
    setLoaded(true);
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);

  const patch = useCallback((p: Partial<TransformMenuSettings>) => {
    setSt(s => {
      const n = { ...s, ...p };
      try { setSetting(KEY, n); } catch { /* 무시 */ }
      setTimeout(() => window.dispatchEvent(new Event(EVT)), 0);
      return n;
    });
  }, []);

  return [st, patch, loaded];
}

/** 훅 없이 지금 켜져 있는지만 빠르게 확인 (TopBar가 gnb를 그릴지 말지 판단할 때) */
export function transformMenuEnabled(): boolean {
  try {
    const raw = getRawSetting(KEY);
    if (raw) return !!(JSON.parse(raw) as Partial<TransformMenuSettings>).enabled;
  } catch { /* 무시 */ }
  return false;
}

/** 방문자가 끌어 옮긴 위치 — 브라우저 보관 전용 (서버로 올리지 않음) */
const POS_KEY = 'ohome.tfmenu.pos.v1';
export function loadTfPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
  } catch { /* 무시 */ }
  return null;
}
export function saveTfPosition(x: number, y: number): void {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch { /* 무시 */ }
}

/** line(아카이브 라인) 방식의 영문 라벨 자동 추정 — 주소·이름으로 흔한 것만. 못 맞추면 빈 글자(설정에서 직접 입력) */
const EN_BY_PATH: Record<string, string> = {
  '/': 'MAIN', '/chars': 'CHARACTER', '/rels': 'RELATIONS', '/rp': 'ROLEPLAY', '/board': 'BOARD', '/gallery': 'GALLERY',
  '/loadb': 'ROADVIEW', '/myroom': 'MYROOM', '/closet': 'CLOSET', '/tchars': 'CHARACTER', '/trpg': 'LOG', '/dotori': 'DOTORI',
  '/playlog': 'PLAYLOG', '/comm': 'COMMISSION', '/comm-apply': 'APPLICANTS', '/cal': 'SCHEDULE', '/diary': 'DIARY',
  '/threads': 'THREADS', '/memo': 'MEMO', '/guest': 'GUESTBOOK', '/intro': 'INTRO', '/settings': 'SETTINGS',
};
const EN_BY_LABEL: Record<string, string> = {
  '메인': 'MAIN', '홈': 'HOME', '공지사항': 'NOTICE', '공지': 'NOTICE', '일기장': 'DIARY', '다이어리': 'DIARY',
  '에셋백업': 'ASSETS', '유저': 'USER', '회원': 'MEMBER', '로그백업': 'LOG', '로그': 'LOG', '프롬프트': 'ISSUANCE',
  '배너': 'BANNER', '방명록': 'GUESTBOOK', '자놀': 'ROLEPLAY', '게시판': 'BOARD', '커미션': 'COMMISSION', '소개': 'INTRO',
  '캐릭터': 'CHARACTER', '자관': 'RELATIONS', '역극': 'ROLEPLAY', '갤러리': 'GALLERY', '스케줄러': 'SCHEDULE',
};
export function tfEnglishLabel(
  item: { label: string; href?: string; children?: { href: string }[] },
  custom?: Record<string, string>,
): string {
  const own = custom?.[item.label]?.trim();
  if (own) return own;
  if (EN_BY_LABEL[item.label]) return EN_BY_LABEL[item.label];
  const path = (h?: string) => (h ?? '').split('?')[0];
  if (item.href && EN_BY_PATH[path(item.href)]) return EN_BY_PATH[path(item.href)];
  const c = item.children?.[0];
  if (c && EN_BY_PATH[path(c.href)]) return EN_BY_PATH[path(c.href)];
  return '';
}
