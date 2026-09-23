// 마이룸 (v1 — 핵심 기능) — 캔버스에 아이템을 배치해 꾸미는 개인 방 게시판
// 그누보드 마이룸 스킨(PHP)의 핵심 기능(배치·저장, 카탈로그·카테고리 관리)을
// 이 사이트의 useLocalList 목록 저장 방식으로 옮긴 것.
//
// 사운드클릭·비회원 비밀번호 소유확인·선택복사/이동·멀티셀렉트·줌/팬 등은 v1 범위 밖(다음 단계).

/** 캔버스 위에 배치된 아이템 하나 */
export interface MyRoomItem {
  id: string;
  /** 카탈로그에서 가져온 것이면 그 id — 카탈로그에서 지워져도 배치된 아이템 자체는 남는다 */
  catalogId?: string;
  /** 이미지 참조 — blobStore의 putBlob이 돌려주는 참조 문자열(서버 모드 URL / 로컬 파일 id) */
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;   // deg
  z: number;
}

/** 마이룸 방(글) 하나 */
export interface MyRoomPost {
  /** 소속 섹션 (v2.0 다중 섹션 패턴) — 없으면 기본 섹션 */
  secId?: string;
  id: string;
  title: string;
  author: string;
  authorId: string;
  date: string;        // ISO
  canvasW: number;
  canvasH: number;
  items: MyRoomItem[];
}

export const MYROOM_SEED: MyRoomPost[] = [];

export const MYROOM_DEFAULT_CANVAS = { w: 2000, h: 1500 };

/** 리모콘(카탈로그) 카테고리 — 관리자가 환경설정 없이 편집 화면에서 직접 관리 */
export interface MyRoomCategory {
  id: string;
  name: string;
  sort: number;
}

/** 처음 켰을 때의 기본 카테고리 4종 — PHP판 기본값과 동일 */
export const MYROOM_CATEGORY_SEED: MyRoomCategory[] = [
  { id: 'myroom-cat-floor', name: '바닥', sort: 1 },
  { id: 'myroom-cat-wall', name: '벽', sort: 2 },
  { id: 'myroom-cat-furniture', name: '가구', sort: 3 },
  { id: 'myroom-cat-etc', name: '기타', sort: 4 },
];

/** 리모콘(카탈로그) 아이템 — 클릭하면 캔버스에 놓이는 미리 등록된 이미지 */
export interface MyRoomCatalogItem {
  id: string;
  categoryId: string;
  name: string;
  src: string;
  w: number;
  h: number;
  sort: number;
}

export const MYROOM_CATALOG_SEED: MyRoomCatalogItem[] = [];

export const newMyRoomItemId = () => `mi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
