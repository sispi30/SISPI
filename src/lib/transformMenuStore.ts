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

  // 메뉴 글자
  menuFontSize: number;
  menuFontColor: string;   // 비우면 --top-fg
  menuHoverColor: string;  // 비우면 --top-hv
  menuLetterSpacing: number;

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

  // 서브메뉴 배경
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

  menuFontSize: 14,
  menuFontColor: '',
  menuHoverColor: '',
  menuLetterSpacing: 0,

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

  subBgColor: '',
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
