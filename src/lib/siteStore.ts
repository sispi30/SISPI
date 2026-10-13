'use client';
// 사이트 로고 설정 (5.2 — 제목/서브타이틀/서브 정렬) — 상단바 브랜드 + TRPG 티켓 하단 문구 연동
// v1.9: 디자인 탭 SAVE 통합 — 드래프트(useSiteDraft)로 즉시 미리보기하고 SAVE를 눌러야 저장.
// 소비자(useSiteSettings)는 드래프트가 있으면 그 값을 봄 (테마 미리보기와 동일 규칙).
import { useCallback, useEffect, useReducer, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export interface SiteSettings {
  title: string;             // 로고 텍스트
  subtitle: string;          // 로고 아랫줄 (서브타이틀)
  align: 'left' | 'center' | 'right'; // 서브타이틀 정렬 (프로토타입 정렬 아이콘)
  docTitle?: string;         // 브라우저 탭 제목 (v1.9 사용자 요청 — 비우면 「로고 텍스트 — 개인홈」)
  noSpell?: boolean;         // 맞춤법 검사 밑줄 숨김 (v2.0 사용자 요청 — 페이지 전체)
  // 링크 공유 시 크롤링되는 설명 문구 (v2.0 사용자 요청) — 카톡·디스코드 미리보기 설명줄.
  // 비우면 서브타이틀을, 그것도 비었으면 기본 문구를 그대로 쓴다 (generateMetadata)
  crawlDesc?: string;
  // 브라우저 탭 아이콘 (v2.0 사용자 요청) — 비우면 기본 아이콘.
  // 서버 모드면 저장소 주소라 서버 메타데이터에도 그대로 실리고, 로컬 모드면 파일 id라 화면에서만 붙는다
  favicon?: string;
  // 인트로(로딩 후 입장) 화면 — false면 끈다. 없으면 켜짐 (한 탭에서 한 번만 표시)
  introSplash?: boolean;
  // 인트로 배경 — 장식(별·점무늬 물체)은 그대로 두고 바탕만 바꾼다. 비우면 기본 밝은 바탕
  introBg?: string;          // 바탕색
  introBg2?: string;         // 그라데이션 끝색 (비우면 단색)
  introDot?: string;         // 점무늬·장식 색
  introFg?: string;          // 글씨 색
  introImage?: string;       // 바탕 이미지 (파일 id 또는 주소) — 있으면 색 위에 깐다
  introImageOp?: number;     // 바탕 이미지 밝기 % (기본 14 — 어두운 바탕에 희미하게)
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  // 초기 타이틀 = 프로젝트 이름 O.HOME (v1.9 사용자 확정 — 초기화하면 이 값으로 돌아감)
  title: 'O.HOME', subtitle: 'PERSONAL ARCHIVE', align: 'left',
};

const KEY = 'ohome.site.v1';
const EVT = 'ohome-site';

// 모듈 싱글턴 — 어느 컴포넌트에서 접근하든 같은 저장본/드래프트를 봄
let savedCache: SiteSettings = DEFAULT_SITE_SETTINGS;
let cacheLoaded = false;
let draft: SiteSettings | null = null;

function loadSaved() {
  if (cacheLoaded) return;
  try {
    const raw = getRawSetting(KEY);
    if (raw) savedCache = { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(raw) };
  } catch { /* 기본값 */ }
  cacheLoaded = true;
}

const notify = () => setTimeout(() => window.dispatchEvent(new Event(EVT)), 0);

export function useSiteSettings(): [SiteSettings, (patch: Partial<SiteSettings>) => void, boolean] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadSaved();
    setLoaded(true);
    force();
    window.addEventListener(EVT, force);
    return () => window.removeEventListener(EVT, force);
  }, []);
  // 즉시 저장 patch — 디자인 탭 밖 소비자용 (드래프트가 떠 있으면 드래프트에도 반영해 미리보기 유지)
  const patch = useCallback((p: Partial<SiteSettings>) => {
    savedCache = { ...savedCache, ...p };
    if (draft) draft = { ...draft, ...p };
    try { setSetting(KEY, savedCache); } catch { /* 무시 */ }
    notify();
  }, []);
  return [draft ?? savedCache, patch, loaded];
}

/** 디자인 탭 전용 드래프트 (v1.9) — 변경은 미리보기로만, SAVE로 확정 · 취소로 폐기 */
export function useSiteDraft() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    loadSaved();
    force();
    window.addEventListener(EVT, force);
    return () => window.removeEventListener(EVT, force);
  }, []);
  return {
    site: draft ?? savedCache,
    dirty: draft !== null && JSON.stringify(draft) !== JSON.stringify(savedCache),
    set: (p: Partial<SiteSettings>) => { draft = { ...(draft ?? savedCache), ...p }; notify(); },
    save: () => {
      if (!draft) return;
      savedCache = draft;
      draft = null;
      try { setSetting(KEY, savedCache); } catch { /* 무시 */ }
      notify();
    },
    discard: () => { draft = null; notify(); },
  };
}
