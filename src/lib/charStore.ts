// 캐릭터·자관 데이터 저장소 — localStorage (→ Supabase 이전 예정)
// 기획서 4.4(캐릭터), 4.5(자관)
export type Visibility = 'public' | 'member' | 'private'; // 공개범위 3단계

export interface ColorChip { hex: string; label: string }

/** 테마컬러 점 테두리 (v2.0 사용자 요청) — 미지정이면 지금까지의 옅은 테두리 그대로,
 *  'none'이면 없음, hex면 그 색으로 1px */
export const chipBorder = (bd?: string): string =>
  (bd === 'none' ? 'none' : `inset 0 0 0 1px ${bd ?? 'rgba(0,0,0,.1)'}`);

export interface CharTab {
  id: string;
  icon: string;          // 아이콘 문자 (업로드 아이콘은 후속)
  title: string;
  subtitle?: string;     // 제목 아래 작은 글씨 (선택)
  html: string;          // HTML 에디터 내용 (스크립트 불허 — 렌더 시 sanitize)
  /** 이 탭 전용 TRPG 룰 이름 — 선택하면 기본 정보 항목과 같은 방식으로 룰별 정보란(specs)을
   *  이 탭에도 띄울 수 있다(캐릭터 정보란 룰별 항목 기능, ADD TAB에도 동일 적용). 미선택 시 기존처럼
   *  HTML 본문(html)만 있는 자유 탭 그대로 동작한다. */
  rule?: string;
  specs?: import('./charRuleConfig').Spec[];
  /** 이 탭 전용 아트(상세 화면 좌측 대표 아트 대체) — 목록 대표·썸네일은 탭에서 바꿀 수 없어 따로
   *  thumbId 개념 없이 전부 "추가 아트"로만 다룬다 (v2.4 ADD TAB 요청) */
  arts?: string[];
}

/** 캐릭터 갤러리 사진 한 장 — 갤러리 게시판 글쓰기와 같은 첨부 방식(v3.3):
 *  crop = ✂ 썸네일 영역(카드 4:3), original = 원본/최적화 선택(기본 원본) */
export interface GalleryImg { ref: string; artist?: string; crop?: import("@/components/ui/CropEditor").CropValue; original?: boolean }

/** 캐릭터 갤러리의 사진 묶음 하나 (v3.4) — 갤러리 게시판 글과 같은 항목:
 *  제목·유형(로그/단일/단일(세로))·사진들·설명·태그·제작일·공개범위·접기 */
export interface GalleryPost {
  id: string;
  title: string;
  type: 'log' | 'single' | 'vlist';
  images: GalleryImg[];
  desc: string;
  tags?: string[];
  madeDate?: string;
  date: string;
  visibility: Visibility;
  fold?: { type: 'spoiler' | 'adult' | 'custom'; label?: string } | null;
  /** 표시 전용(저장 안 함) — 자관 갤러리가 태그 연동으로 가져온 묶음이면 원래 캐릭터 이름 */
  from?: string;
}

/** 캐릭터의 갤러리 묶음 목록 — 새 방식(galleryPosts)이 있으면 그대로,
 *  예전에 사진만 쌓아 둔 갤러리(gallery)는 사진 한 장 = 단일 묶음 하나로 바꿔 보여준다 */
export function galleryPostsOf(c: { gallery?: GalleryImg[]; galleryPosts?: GalleryPost[] }): GalleryPost[] {
  if (c.galleryPosts) return c.galleryPosts;
  return (c.gallery ?? []).map((g, i) => ({
    id: `lg${i}`, title: g.artist || `${i + 1}번째 그림`, type: 'single' as const,
    images: [g], desc: '', date: '', visibility: 'public' as Visibility, fold: null,
  }));
}
/** 갤러리 기능이 켜져 있는가 (빈 갤러리 포함) */
export const hasGallery = (c: { gallery?: GalleryImg[]; galleryPosts?: GalleryPost[] }) =>
  c.galleryPosts !== undefined || c.gallery !== undefined;

export interface Character {
  id: string;
  name: string;          // 대표 이름 (전용 폰트 적용 대상)
  sub: string;           // 한글명 · 소속 한 줄
  /** 캐릭터 이름의 다른 표기 (선택) — 상세 화면 이름 아래에 작게 표시. 비우면 표시하지 않는다 */
  altName?: string;
  /** 상세(스테이지) 소개 본문 글자색 — 비우거나 'auto'면 배경 밝기를 보고 자동(기본),
   *  'light'/'dark'는 밝은/어두운 글자로 고정, 'custom'이면 bodyInkColor 그대로 */
  bodyInk?: 'auto' | 'light' | 'dark' | 'custom';
  bodyInkColor?: string;
  color: string;         // 대표 테마색 (말풍선·리스트 점)
  // 상세 페이지 테마 (v1.9 사용자 확정) — custom이면 대표 테마색으로 홈 팔레트 임시 전환 (4.18 방식)
  themeMode?: 'default' | 'custom';
  colors: ColorChip[];   // 테마 컬러 나열
  /** 테마컬러 점 테두리 (v2.0 사용자 요청) — 'none' = 없음 · hex = 그 색으로 1px.
   *  미지정이면 지금까지와 같은 옅은 테두리(안 정한 홈은 모습이 안 바뀐다) */
  colorBd?: string;
  colorTipMode?: 'hex' | 'both' | 'label'; // 색 점 툴팁 표기: hex / 이름+hex / 이름만
  specs: import('./charRuleConfig').Spec[];
  /** 기본 정보 항목에 적용된 TRPG 룰 이름 (v2.1 — 자놀 캐릭터 룰별 정보란).
   *  미지정/빈 문자열이면 지금까지와 같은 자유 항목(specs) 그대로 동작한다. */
  rule?: string;
  /** CHARACTER SHEET 외부 링크 (v2.1) — 룰 선택 여부와 무관하게 항상 편집 가능한 고정 필드 */
  sheetUrl?: string;
  tabs: CharTab[];       // 기본 정보 외 추가 탭
  /** 캐릭터 갤러리 (v2.5) — 미지정이면 갤러리 기능 자체를 안 쓰는 캐릭터.
   *  빈 배열이어도 "갤러리 켜짐" 상태이며, /chars/{id}/gallery 에서 그리드+라이트박스로 보여준다.
   *  AU별로 따로 두지 않고 캐릭터(원본) 하나에만 있다. */
  gallery?: GalleryImg[];            // (구) 사진만 쌓던 갤러리 — galleryPosts가 생기면 그쪽이 우선
  /** 사진 묶음 목록 (v3.4) — 있으면 갤러리 기능 켜짐 (빈 배열 포함) */
  galleryPosts?: GalleryPost[];
  /** 캐릭터 갤러리에 연동해 보일 자관 갤러리 태그 (v6.3) — 이 캐릭터가 멤버인 자관의 갤러리 묶음 중 이 태그가 달린 것이 함께 보인다 */
  galleryTagLinks?: string[];
  /** REL(관계) 탭 (v6.8) — 켜져 있으면 상세 화면에 REL 버튼이 보인다.
   *  내용은 따로 저장하지 않고 자관(페어·다인관)에서 이 캐릭터가 멤버인 것 +
   *  직접 지정한 관계(relLinks)를 그때그때 모아 보여준다 (GALLERY·TRPG 탭과 같은 방식) */
  /** 상세 화면 레이아웃 (v7.0) — 비우면 스테이지(등록한 그림 배경 + 좌 정보 · 우 소개/항목 창), 'classic'이면 예전 좌 아이콘탭·중앙 아트·우 패널 */
  detailLayout?: 'stage' | 'classic';
  relEnabled?: boolean;
  relLinks?: { charId: string; label?: string }[];   // 직접 지정한 관계 — 상대 캐릭터 + 꼬리표(예: 라이벌)
  /** 이 캐릭터 상세 페이지에서만 나오는 BGM (v5.9) — 환경설정 BGM과 같은 구조, 페이지를 나가면 홈페이지 BGM으로 복귀 */
  bgm?: import('./bgmStore').PageBgm;
  /** TRPG 참여 세션 탭 (v2.8) — 켜져 있으면 상세 화면에 TRPG 버튼이 보인다.
   *  실제 세션 목록은 여기 저장하지 않고, 플레이기록 게시판(PlayRecord.charIds)에서
   *  이 캐릭터 id를 참조하는 기록을 찾아 그때그때 보여준다(단일 출처로 양쪽 자동 반영). */
  trpgEnabled?: boolean;
  /** TRPG 탭에서 세션을 보여줄 순서 (v2.9) — PlayRecord id 배열. 여기 없는(새로 연결된)
   *  기록은 이 목록 뒤에 붙는다. 연결을 끊으면 여기서도 제거해 목록을 깔끔하게 유지한다. */
  trpgOrder?: string[];
  basicHtml: string;     // 기본 정보 탭의 소개 본문 (HTML)
  visibility: Visibility;
  /** 페이지 주소 별명 (v2.0 사용자 요청) — /chars/{별명}. 만들 때 정하는 주소(id)와 달리
   *  **나중에 수정 화면에서 바꿀 수 있다.** 참조(자관 멤버·권한 등)는 언제나 id로 저장되므로
   *  바꿔도 아무것도 끊어지지 않고, 옛 주소(id)로도 계속 열린다. */
  slug?: string;
  /** 어느 캐릭터 목록 것인지 (v2.0 사용자 요청) — 없으면 기본 목록.
   *  **자관·역극이 캐릭터를 찾을 때는 소속을 보지 않는다** — 목록 화면에서만 갈린다 */
  secId?: string;
  thumbClass: string;    // 데모 플레이스홀더 클래스
  thumbId?: string;      // 리스트 썸네일 (IndexedDB, 3:4 크롭)
  thumbCrop?: import("@/components/ui/CropEditor").CropValue;
  /** 상세 페이지 중앙 아트의 위치 (v2.0) — 리스트 썸네일과 보이는 크기·비율이 달라
   *  같은 크롭을 쓰면 원하는 부분이 안 나온다. 따로 잡으면 상세에서는 이 값을 쓴다. */
  artCrop?: import("@/components/ui/CropEditor").CropValue;
  arts?: string[];       // 아트 목록 (IndexedDB — 첫 장이 대표 풀 아트이자 썸네일 원본)
  /** 상세 페이지 배경 이미지 (v5.8 사용자 요청) — 자관 배경·환경설정 배경 변경과 같은 방식:
   *  페이지 전체에 고정·cover로 깔리고 블러(px)만 조절한다. 지정하지 않으면 지금처럼 사이트 배경 그대로 */
  bgImgId?: string;
  bgBlur?: number;
  artId?: string;        // (구) 단일 풀 아트
  artUrl?: string;       // (구) 풀 아트 URL
  fontId?: string;       // 전용 폰트 — 이름·타이틀 (5.1)
  /** 상세 페이지 큰 이름의 글씨 크기 px (v2.0) — 기본 38.
   *  이름 길이가 제각각이라 자동으로 줄이면 어중간해진다. 캐릭터마다 직접 정한다. */
  nameSize?: number;
  /** 상세 큰 이름 굵게 (v2.0 사용자 요청) — 기본 켜짐. 폰트에 따라 볼드가 안 어울릴 때 끈다 */
  nameBold?: boolean;
  bodyFontId?: string;   // 본문 폰트 — 프로필 정보·소개 텍스트
  own: boolean;          // true = 운영자 자캐 (리스트 노출), false = 상대 캐릭터
  // 회원-캐릭터 연결 (3차, v1.9) — 상대 캐릭터에 회원 권한 부여:
  // play = 역극에서 이 캐릭터로 발화 가능, edit = 캐릭터 편집까지 가능 (play 포함)
  grants?: CharGrant[];
  // AU별 캐릭터 프로필 (v1.9) — 키 `${relId}:${auId}`. 자관에 AU를 추가하면 멤버 캐릭터
  // 상세 우상단에 AU 리스트가 뜨고, 선택 시 프로필 전체가 이 값으로 전환.
  // 편집은 /chars/[id]/edit?au= — AU 전용 편집 페이지에서 아예 새 프로필처럼 작성 (사용자 확정)
  auProfiles?: Record<string, AuCharProfile>;
}

/** AU 캐릭터 프로필 (v1.9 전면 확장) — 이름·키·성별부터 전부 AU별로 달라질 수 있음.
 *  지정된 필드만 base를 대체 (구버전 basicHtml/arts만 있는 데이터도 그대로 동작) */
export interface AuCharProfile {
  basicHtml?: string;
  arts?: string[];
  name?: string;
  sub?: string;
  altName?: string;      // 이름 다른 표기 — AU에서 비웠다면 '' 로 저장해 원본 값을 물려받지 않게 한다
  bodyInk?: 'auto' | 'light' | 'dark' | 'custom';   // 소개 본문 글자색 — AU에서 자동이면 'auto'로 저장해 원본의 지정을 물려받지 않게 한다
  bodyInkColor?: string;
  color?: string;
  themeMode?: 'default' | 'custom';
  colors?: ColorChip[];
  colorTipMode?: 'hex' | 'both' | 'label';
  specs?: import('./charRuleConfig').Spec[];
  rule?: string;
  sheetUrl?: string;
  tabs?: CharTab[];
  thumbId?: string;
  thumbCrop?: import("@/components/ui/CropEditor").CropValue;
  bgImgId?: string;      // 상세 배경 이미지 (v5.8) — AU는 자기 배경만, 원본 것을 물려받지 않음
  bgBlur?: number;
  artCrop?: import("@/components/ui/CropEditor").CropValue;   // 상세 중앙 아트 위치 (v2.0)
  fontId?: string;
  nameSize?: number;     // 상세 큰 이름 크기 px (v2.0)
  nameBold?: boolean;    // 상세 큰 이름 굵게 (v2.0 사용자 요청 — 폰트에 따라 볼드가 안 어울린다)
  bodyFontId?: string;
}

/** AU 프로필을 합성한 표시용 캐릭터 — AU에서 지정한 필드만 대체 (상세·편집 프리필 공용) */
export function charWithAu(c: Character, auKey?: string | null): Character {
  const p = auKey ? c.auProfiles?.[auKey] : undefined;
  if (!p) return c;
  return {
    ...c,
    ...(p.name !== undefined ? { name: p.name } : {}),
    ...(p.sub !== undefined ? { sub: p.sub } : {}),
    ...(p.altName !== undefined ? { altName: p.altName } : {}),
    ...(p.bodyInk !== undefined ? { bodyInk: p.bodyInk, bodyInkColor: p.bodyInkColor } : {}),
    ...(p.color !== undefined ? { color: p.color } : {}),
    ...(p.themeMode !== undefined ? { themeMode: p.themeMode } : {}),
    ...(p.colors !== undefined ? { colors: p.colors } : {}),
    ...(p.colorTipMode !== undefined ? { colorTipMode: p.colorTipMode } : {}),
    ...(p.specs !== undefined ? { specs: p.specs } : {}),
    ...(p.rule !== undefined ? { rule: p.rule } : {}),
    ...(p.sheetUrl !== undefined ? { sheetUrl: p.sheetUrl } : {}),
    ...(p.tabs !== undefined ? { tabs: p.tabs } : {}),
    ...(p.basicHtml !== undefined ? { basicHtml: p.basicHtml } : {}),
    // 이미지는 **물려받지 않는다** (v2.0 사용자 요청) — AU 프로필에 안 넣었으면 비워 둔다.
    // 글씨(이름·소개·스펙)는 AU에서 안 고쳤으면 base를 쓰는 게 자연스럽지만, 그림은 다르다:
    // 학원 AU를 만들어 놓고 그림을 아직 안 넣었는데 원본 그림이 그대로 떠 있으면
    // 그 AU의 그림인 줄 알게 된다. 자관 전신이 이미 같은 규칙이다(「AU는 자기 전신만」).
    arts: p.arts ?? [],
    artId: p.arts?.[0],
    thumbId: p.thumbId,
    thumbCrop: p.thumbCrop,
    // 배경 이미지도 그림이라 물려받지 않는다 (v5.8) — 자관 배경이 AU별로 완전 분리된 것과 같은 규칙
    bgImgId: p.bgImgId,
    bgBlur: p.bgBlur,
    ...(p.fontId !== undefined ? { fontId: p.fontId } : {}),
    ...(p.bodyFontId !== undefined ? { bodyFontId: p.bodyFontId } : {}),
    // nameSize는 여태 병합에 빠져 있었다 — AU에 저장은 되는데 표시가 base 크기를 따랐다 (v2.0 수정)
    ...(p.nameSize !== undefined ? { nameSize: p.nameSize } : {}),
    ...(p.nameBold !== undefined ? { nameBold: p.nameBold } : {}),
  };
}

export interface CharGrant { userId: string; level: 'play' | 'edit' }

/** 이 자관의 멤버 캐릭터 중 하나라도 권한을 받은 회원인가 (v2.0) — 문답 숨김 판정 */
export function hasRelGrant(
  members: { charId: string }[], chars: Character[], userId?: string,
): boolean {
  if (!userId) return false;
  return members.some(m => !!charGrant(chars.find(c => c.id === m.charId) ?? { grants: [] } as unknown as Character, userId));
}

/** 회원의 캐릭터 권한 — edit는 play를 포함 */
export function charGrant(c: Character, userId?: string): 'play' | 'edit' | null {
  if (!userId) return null;
  const g = c.grants?.find(x => x.userId === userId);
  return g?.level ?? null;
}

export interface RelMember {
  charId: string;
  quote: string;                 // 캐릭터별 한마디
  keywords: string[];            // 키워드 뱃지
  desc: string;                  // 소개글
  palette: ColorChip[];          // 컬러 팔레트 아이콘
  linkedNote?: string;           // "회원 ○○ 연결됨" 등
  fullImgId?: string;            // 전신 이미지 (v1.9 — 자관 수정에서 등록, 중앙 전신 모드)
  fullScale?: number;            // 전신 크기 % (비율 유지, 미리보기 휠로 조절 — 기본 90)
  fullOffX?: number;             // 전신 가로 위치 오프셋 % (미리보기 드래그 — 기본 0, v1.9)
  fullOffY?: number;             // 전신 세로 위치 오프셋 % (기본 0 = 하단 밀착)
  /** 멤버 카드 얼굴칸(1:1) 크롭 (v2.0) — 캐릭터의 리스트 썸네일은 3:4라
   *  정사각 칸에 그대로 쓰면 어긋난다. 자관에서 따로 잡아 저장한다. */
  faceCrop?: import('@/components/ui/CropEditor').CropValue;
  /** 멤버 카드 이름 굵게 (v2.0 사용자 요청) — 기본 켜짐 */
  nameBold?: boolean;
  /** 멤버 카드 이름 크기 px (v2.0) — 기본 17. 카드 폭이 좁아 이름마다 알맞은 크기가 다르다 */
  nameSize?: number;
  /** PC 상세 전신 히어로의 캐릭터 이름 크기 px — 미지정이면 창 폭에 맞춰 자동(clamp). 위 nameSize(멤버 카드)와 별개 */
  heroNameSize?: number;
  /** (구) 이름·배지 묶음 세로 위치 — 설정 화면에서는 없앴다(전신 드래그로 자유 배치). 예전에 저장된 값만 그대로 따른다 */
  badgeAlign?: 'top' | 'mid' | 'bottom';
  /** 전신 위 이름·부제·배지 묶음의 가로 정렬(v6.4) — 이름 기준 좌측/가운데/우측. 없으면 왼쪽 캐릭터는 좌측, 오른쪽 캐릭터는 우측 */
  badgeTextAlign?: 'left' | 'center' | 'right';
  quoteColor?: string;           // 히어로 대사 글씨색 (페어, v1.9 — 기본 #d7dae0)
  quoteMarkColor?: string;       // 히어로 대사 따옴표색 (기본 포인트 소프트)
}

export interface TlSay { charId: string; text: string }
export interface TlItem { era?: string; desc?: string; says: TlSay[] }

export interface QaAnswer {
  charId: string; text: string;
  note?: string;      // 오너 부연설명 — 말풍선 호버 툴팁 (수정 모달에서 관리자가 작성, v1.9)
  authorId?: string;  // 작성 회원 (v1.9 — 본인 수정, 본인·관리자 삭제 판정)
}
export interface QaEntry {
  no: number; q: string; date: string; answers: QaAnswer[];
  note?: string;   // 질문에 대한 오너 설명 — 질문 아래에 표시 (관리자만 작성, v2.0)
}

/**
 * 문답 답변 한 줄 = 자기 문서 하나 (v2.0).
 *
 * 예전에는 답변이 자관(Relation) 문서 안 배열에 들어 있었다. 그래서 **답변을 달려면 자관을
 * UPDATE 해야 했고**, 「수정은 작성자 또는 관리자만」 규칙에 걸려 관리자가 만든 자관에는
 * 일반 회원이 답을 달 수 없었다 — 댓글이 지워지던 것과 똑같은 뿌리다 (v2.0 사용자 발견).
 *
 * 답변을 따로 저장하면 자관을 건드릴 필요가 없고, 각 답변이 자기 authorId를 가지므로
 * 「내 답변은 내가 수정·삭제」가 규칙 그대로 성립한다.
 */
export const QA_KEY = 'ohome.qaanswers.v1';

export interface QaAnswerRow extends QaAnswer {
  id: string;
  relId: string;   // 자관 id
  auId: string;    // AU id (원본은 'base')
  no: number;      // 질문 번호
  date: string;    // 정렬용
}

export const QA_SEED: QaAnswerRow[] = [];

/** 화면에서 다루는 답변 — 어디에 저장돼 있는지(분리 행 / 옛 자관 안 배열)를 함께 들고 다닌다 */
export type MergedAnswer = QaAnswer & { rowId?: string; legacyIdx?: number };

/** 질문 하나의 답변 — 옛 자관 안의 것 먼저, 그 뒤 분리 저장분 (달린 순서) */
export function answersFor(
  rows: QaAnswerRow[], relId: string, auId: string, no: number, legacy: QaAnswer[] = [],
): MergedAnswer[] {
  return [
    ...legacy.map((a, i) => ({ ...a, legacyIdx: i })),
    ...rows
      .filter(r => r.relId === relId && r.auId === auId && r.no === no)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ ...r, rowId: r.id })),
  ];
}

/** CP/NCP 구분 (v1.9) — CP=커플, NCP=커플 아님. 자관 기본값 + AU마다 별개 지정 가능 */
export type RelCpTag = 'cp' | 'ncp';

/** AU 한 항목 (v1.9 확장) — 캐치프레이즈만이 아니라 프로필 전체가 AU별로 분리:
 *  중앙 일러(arts)·타임라인·문답·CP/NCP. base(원본)는 Relation 최상위 필드를 그대로 사용 (기존 데이터 호환) */
/**
 * AU에서만 다르게 보여 줄 멤버 값 (v2.0 사용자 발견).
 *
 * 전신 위치·크기, 한마디, 대사 색, 이름 크기는 **자관 멤버(RelMember)에만** 있었다. AU 수정
 * 화면에서 고쳐도 결국 자관 공통 값을 고치는 것이라 **다른 AU 페이지까지 같이 바뀌었다.**
 * AU 쪽에 따로 담아 두고, 여기 없는 값만 자관 기본을 그대로 쓴다(→ `auMember`).
 */
export interface RelAuMember {
  quote?: string;
  fullScale?: number;
  fullOffX?: number;
  fullOffY?: number;
  nameSize?: number;
  nameBold?: boolean;
  heroNameSize?: number;
  badgeAlign?: 'top' | 'mid' | 'bottom';
  /** 전신 위 이름·부제·배지 묶음의 가로 정렬(v6.4) — 이름 기준 좌측/가운데/우측. 없으면 왼쪽 캐릭터는 좌측, 오른쪽 캐릭터는 우측 */
  badgeTextAlign?: 'left' | 'center' | 'right';
  quoteColor?: string;
  quoteMarkColor?: string;
  /** 멤버 카드 얼굴칸 위치 — AU마다 따로 (v2.0 사용자 제보 — 원본에서 바꾸면 AU도 같이 바뀌었다).
   *  안 정한 AU는 자관 기본(faceCrop)을 그대로 따른다 */
  faceCrop?: import('@/components/ui/CropEditor').CropValue;
}

/** 이 AU에서 이 멤버를 어떻게 보여 줄지 — AU에 정해 둔 값이 있으면 그것, 없으면 자관 기본.
 *  base(원본) AU이거나 정해 둔 게 없으면 자관 멤버를 그대로 돌려준다. */
export function auMember(m: RelMember, au?: RelAu): RelMember {
  const o = au?.mset?.[m.charId];
  if (!o) return m;
  const out = { ...m };
  // undefined는 「안 정했다」는 뜻 — 그대로 덮으면 자관 기본까지 지워진다
  (Object.keys(o) as (keyof RelAuMember)[]).forEach(k => {
    const v = o[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  });
  return out;
}

/**
 * AU에서만 다르게 쓸 색·배경 (v2.0 사용자 요청 — 「AU 페이지에서도 색상 테마 같은 걸 다 따로」).
 *
 * 값이 있으면 그것, 없으면 자관 기본을 그대로 쓴다(→ `auStyle`). 자관 쪽 「직접 지정」 체크를
 * 끄면 그 값들이 사라지듯, AU에서도 체크를 끄면 여기서 지워져 자관 값으로 되돌아간다.
 */
export interface RelAuStyle {
  nameColor?: string;
  cpColor?: string;
  cpTagBg?: string;
  cpTagFg?: string;
  nameShadowColor?: string;
  nameShadow?: number;
  headerBgG1?: string; headerBgG2?: string; headerBgAngle?: number;
  pageBgG1?: string; pageBgG2?: string; pageBgAngle?: number;
  illuBg?: string; illuOn?: string;
}

/** 이 AU에서 실제로 쓸 색·배경 — AU에 정해 둔 값이 있으면 그것, 없으면 자관 기본 */
export function auStyle(rel: Relation, au?: RelAu): RelAuStyle {
  const s = au?.style;
  const base: RelAuStyle = {
    nameColor: rel.nameColor, cpColor: rel.cpColor,
    cpTagBg: rel.cpTagBg, cpTagFg: rel.cpTagFg,
    nameShadowColor: rel.nameShadowColor, nameShadow: rel.nameShadow,
    headerBgG1: rel.headerBgG1, headerBgG2: rel.headerBgG2, headerBgAngle: rel.headerBgAngle,
    pageBgG1: rel.pageBgG1, pageBgG2: rel.pageBgG2, pageBgAngle: rel.pageBgAngle,
    illuBg: rel.illuBg, illuOn: rel.illuOn,
  };
  if (!s) return base;
  const out = { ...base };
  // 「자관 색·배경 묶음」 단위로 갈아 끼운다 — 한 묶음이라도 AU에 정해 뒀으면 그 묶음 전체를 AU 것으로.
  // 색 하나만 AU 값이고 나머지는 자관 값이면 어울리지 않는 조합이 나온다
  if (s.nameColor !== undefined || s.cpColor !== undefined) {
    out.nameColor = s.nameColor; out.cpColor = s.cpColor;
  }
  if (s.cpTagBg !== undefined || s.cpTagFg !== undefined) {
    out.cpTagBg = s.cpTagBg; out.cpTagFg = s.cpTagFg;
  }
  if (s.nameShadowColor !== undefined || s.nameShadow !== undefined) {
    out.nameShadowColor = s.nameShadowColor; out.nameShadow = s.nameShadow;
  }
  if (s.headerBgG1 !== undefined || s.headerBgG2 !== undefined) {
    out.headerBgG1 = s.headerBgG1; out.headerBgG2 = s.headerBgG2; out.headerBgAngle = s.headerBgAngle;
  }
  if (s.pageBgG1 !== undefined || s.pageBgG2 !== undefined) {
    out.pageBgG1 = s.pageBgG1; out.pageBgG2 = s.pageBgG2; out.pageBgAngle = s.pageBgAngle;
  }
  if (s.illuBg !== undefined || s.illuOn !== undefined) {
    out.illuBg = s.illuBg; out.illuOn = s.illuOn;
  }
  return out;
}

/** 전신 이미지에 깔 그림자 (v2.0 사용자 요청) — 「그림자 직접 지정」의 색·강도를 그대로 따른다.
 *  미지정이면 예전과 같은 검정 35%. 강도를 0으로 두면 그림자를 아예 빼서 또렷하게 둘 수 있다.
 *  geom은 자리마다 다르다 — 상세는 크게(0 8px 18px), 수정 미리보기는 작게(0 6px 14px). */
export function fullShadow(color?: string, strength?: number, geom = '0 8px 18px'): string | undefined {
  const pct = strength ?? 100;
  if (pct <= 0) return undefined;
  const a = 0.35 * (pct / 100);
  const hex = (color ?? '#000000').replace('#', '');
  const f = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) || 0);
  return `drop-shadow(${geom} rgba(${r},${g},${b},${a}))`;
}

/**
 * 2인 전신 히어로의 레이어·배치 (v5.6 사용자 요청 — 「메인 이미지 · 레이어」).
 *
 * 설정의 레이어 목록에서 손잡이로 끌어 앞뒤를 바꾸고, 미리보기에서 제목·이름·배지·스티커를
 * 직접 끌어 배치한다. 값은 모두 **히어로 영역 대비 %** — 상세 화면과 미리보기가 같은 비라서
 * 어느 창 크기에서도 같은 자리에 놓인다.
 *
 * 레이어 id: 'ui'(제목·이름·배지 같은 글자 묶음) · `full:${charId}`(전신) · `st:${stickerId}`(스티커)
 * order 는 **아래 → 위** 순서. 없으면 예전 방식(fullFront)대로 — 앞 캐릭터가 위, 글자는 맨 위.
 */
export interface HeroSticker {
  id: string;
  ref: string;   // 이미지 blob id
  x: number;     // 중심 가로 위치 (히어로 폭 대비 %)
  y: number;     // 중심 세로 위치 (히어로 높이 대비 %)
  w: number;     // 폭 (히어로 폭 대비 %)
}
export interface HeroLayout {
  order?: string[];
  stickers?: HeroSticker[];
  /** 제목(CP 뱃지 + 자관명) 묶음의 기본 자리에서 옮긴 거리 — 히어로 폭/높이 대비 % */
  title?: { x: number; y: number };
  /** 멤버별 이름·배지 묶음의 기본 자리에서 옮긴 거리 — 히어로 폭/높이 대비 % */
  names?: Record<string, { x: number; y: number }>;
}

export const HERO_UI_ID = 'ui';
export const heroFullId = (charId: string) => `full:${charId}`;
export const heroStickerId = (id: string) => `st:${id}`;

/** 레이어 순서(아래 → 위)를 지금 있는 항목에 맞게 정리한다 — 저장된 순서를 우선하고,
 *  없어진 항목은 빼고, 새로 생긴 항목은 알맞은 자리에 채운다. */
export function heroOrder(layout: HeroLayout | undefined, charIds: string[], fullFront?: string): string[] {
  const stickers = (layout?.stickers ?? []).map(s => heroStickerId(s.id));
  // 기본: 뒤 캐릭터 → 앞 캐릭터 → 글자 (앞 캐릭터는 fullFront, 없으면 오른쪽)
  const front = fullFront && charIds.includes(fullFront) ? fullFront : charIds[charIds.length - 1];
  const fullsDefault = [...charIds.filter(c => c !== front), ...(front ? [front] : [])].map(heroFullId);
  const valid = new Set([HERO_UI_ID, ...charIds.map(heroFullId), ...stickers]);
  const saved = (layout?.order ?? []).filter(id => valid.has(id));
  const missing = [...fullsDefault, ...stickers, HERO_UI_ID].filter(id => !saved.includes(id));
  // 저장된 순서 뒤에 이어 붙인다 — 새로 생긴 항목(방금 올린 스티커 등)은 맨 위에 놓여 가려지지 않는다
  return [...saved, ...missing];
}

/** 레이어 순서에서 이 항목의 z-index (히어로 안에서 쓰는 값 — 10부터) */
export function heroZ(order: string[], id: string): number {
  const i = order.indexOf(id);
  return 10 + (i < 0 ? 0 : i);
}

export interface RelAu {
  id: string;
  label: string;
  catchphrase: string;
  /** AU별 자관명 (v2.0 사용자 요청) — 비우면 자관 이름을 그대로 쓴다 */
  name?: string;
  /** AU별 이름/본문 폰트 (v2.0 사용자 제보 — 여태 AU 편집의 폰트가 원본에 저장돼 전체가 같이 바뀌었다).
   *  미지정이면 자관 기본 폰트 */
  fontId?: string;
  bodyFontId?: string;
  /** AU별 자관 이름(제목) 크기 px — 미지정이면 자관 기본 */
  titleSize?: number;
  /** AU별 전신 앞뒤 (v2.0) — AU 편집의 앞으로/뒤로가 원본 배치를 바꾸지 않게. 미지정: 자관 기본 */
  fullFront?: string;
  /** AU별 히어로 레이어·배치 (v5.6) — AU는 자기 전신·스티커만 쓰므로 자관 것을 물려받지 않는다 */
  heroLayout?: HeroLayout;
  /** AU별 색·배경 — 없으면 자관 기본 (위 RelAuStyle 설명 참조) */
  style?: RelAuStyle;
  /** AU별 멤버 표시값 — 없으면 자관 기본 (위 RelAuMember 설명 참조) */
  mset?: Record<string, RelAuMember>;
  quotes?: string[];
  cp?: RelCpTag;          // 없으면 자관 기본(Relation.cp)
  arts?: string[];        // AU별 중앙/그룹 일러 (base는 Relation.arts)
  timeline?: TlItem[];    // base는 Relation.timeline
  questions?: QaEntry[];  // base는 Relation.questions
  qaPool?: string[];      // 대기 질문 풀 (v1.9 — 리스트에서 담은 미출제 질문, 랜덤 출제 대기)
  qaEnabled?: boolean;    // QUESTIONS 섹션 사용 여부 (＋로 추가해야 생김, base는 Relation.qaEnabled)
  fulls?: Record<string, string>;  // AU별 전신 이미지 (charId → blob id, 없으면 멤버 공통 전신)
  headerImgId?: string | null;     // AU별 헤더 이미지 (v1.9) — base를 물려받지 않음, 이 AU 것만
  headerCrop?: import("@/components/ui/CropEditor").CropValue;
  headerBlur?: number;             // AU별 헤더 배경 블러(px) (v5.0)
  // AU별 페이지 테마 (v1.9 사용자 확정) — 미지정이면 base(원본) 테마 따라가기
  theme?: { mode: 'site' | 'custom'; color?: string; tone?: 'dark' | 'light' };
  /** 상세 하단의 역극/로그 연동 리스트 숨김 (v2.0 사용자 요청) — AU마다 따로.
   *  원본(base)의 설정은 aus의 base 항목에 담긴다 */
  hideRp?: boolean;
  hideLog?: boolean;
}

export interface Relation {
  id: string;
  /** 이 자관 페이지에서만 나오는 BGM (v5.9) — 캐릭터와 같은 방식 */
  bgm?: import('./bgmStore').PageBgm;
  /** 상세 하단 좌측 칸 — 역극 목록(기본) / 갤러리 (v6.0). 갤러리면 작은 썸네일로 보이고 더보기에서 보기·편집 */
  leftBoard?: 'rp' | 'gallery';
  /** 자관 갤러리에 연동해 보일 캐릭터 갤러리 태그 (v6.2) — 이 자관 멤버 캐릭터의 갤러리 묶음 중 이 태그가 달린 것이 함께 보인다 */
  galleryTagLinks?: string[];
  /** 자관 갤러리 사진 묶음 (v6.0) — 캐릭터 갤러리와 같은 구조 */
  galleryPosts?: GalleryPost[];
  /** 페이지 주소 별명 (v2.0 사용자 요청) — /rels/{별명}. 나중에 수정 화면에서 바꿀 수 있다.
   *  참조(AU 프로필 키·로그 연동 등)는 언제나 id로 저장되므로 바꿔도 끊어지지 않는다. */
  slug?: string;
  name: string;
  catchphrase: string;
  kind?: 'pair' | 'multi';         // 페어(2인) / 다인(3인+) — 등록 시 선택
  fontId?: string;               // 자관 이름 폰트 (4.5 필수 요구 — 5.1 라이브러리)
  bodyFontId?: string;           // 본문 폰트 — 카드 소개·타임라인·문답 텍스트
  titleSize?: number;            // 자관 이름(제목) 크기 px — 미지정이면 기본 크기(PC 2인 히어로 22px·그 외 64px)
  arts?: string[];               // 아트 목록 (첫 장 = 대표 = 리스트 썸네일 원본)
  headerImgId?: string;          // 헤더 이미지 (v1.5 — 상단 풀폭 블러 + 페이드아웃)
  headerCrop?: import("@/components/ui/CropEditor").CropValue; // 헤더 이미지 위치 크롭 (원본 무손실)
  headerBlur?: number;           // 헤더 배경 이미지 블러(px) (v5.0)
  themeMode?: 'site' | 'custom'; // 페이지 테마: 홈페이지 그대로 / 별도 테마컬러 (4.18 방식)
  themeColor?: string;           // 별도 테마컬러 (custom일 때)
  themeTone?: 'dark' | 'light';  // 테마컬러의 다크/라이트 느낌
  illuBg?: string;               // 전신/일러 스위치 배경색 (v1.9 — 미지정: 테마 진한 버튼색 기반)
  illuOn?: string;               // 전신/일러 스위치 선택색 (미지정: 포인트색)
  nameColor?: string;            // 자관명(히어로 타이틀) 글씨색 (v1.9 — 미지정: 테마)
  cpColor?: string;              // 캐치프레이즈 글씨색 (미지정: 테마)
  cpTagBg?: string;              // CP/NCP 뱃지 배경색 (v2.0 — 미지정: 기본 pill)
  cpTagFg?: string;              // CP/NCP 뱃지 글씨색 (v2.0)
  nameShadowColor?: string;      // 자관명 그림자 색 (v2.0 — 미지정: 검정)
  nameShadow?: number;           // 자관명 그림자 강도 % — 0~200, 미지정 100(기존 세기와 동일)
  // 헤더 이미지가 없을 때 대신 깔 배경 그라데이션 (v2.0 사용자 요청) — 색 2개 + 각도.
  // 미지정이면 예전처럼 아무것도 안 그린다 (배경 강제 없음)
  headerBgG1?: string;
  headerBgG2?: string;
  headerBgAngle?: number;
  // 이 자관 페이지 전체의 배경 그라데이션 (v2.0 사용자 요청) — 색 2개 + 각도.
  // 위 headerBg*는 상단 헤더 자리에만 깔리는 것이고, 이건 페이지 바탕 전체다.
  pageBgG1?: string;
  pageBgG2?: string;
  pageBgAngle?: number;
  thumbId?: string;              // 리스트 썸네일 (IndexedDB, 4:3 크롭)
  thumbCrop?: import("@/components/ui/CropEditor").CropValue;
  members: RelMember[];          // 2인 = 좌/우, 3인+ = 다인 리스트
  visibility: Visibility;
  thumbClass: string;
  illustMode: 'duo' | 'one';     // 2인: 전신 2장 / 일러 1장 (v1.8)
  aus: RelAu[];                  // AU 리스트 (첫 항목 = 원본 base)
  cp?: RelCpTag;                 // 자관 기본 CP/NCP (등록 시 선택, v1.9)
  heroLayout?: HeroLayout;       // 2인 전신 히어로 레이어·스티커·글자 배치 (v5.6)
  fullFront?: string;            // 전신 모드에서 앞에 보일 캐릭터 id (v1.9 — 미리보기에서 클릭 선택)
  pairRight?: string;            // 페어에서 오른쪽 자리에 둘 캐릭터 id (v2.0 — 없으면 등록 순서대로)
  /** 상세 중앙 일러가 어디를 보여 줄지 (v2.0 사용자 요청) — 리스트 썸네일(thumbCrop)과 별개.
    *  **이미지 참조를 키로** 두어 여러 장을 각각 잡을 수 있고, AU의 일러도 같은 자리에 담긴다
    *  (참조가 다르므로 섞이지 않는다). 원본은 건드리지 않는다. */
   artCrops?: Record<string, import('@/components/ui/CropEditor').CropValue>;
  timeline: TlItem[];            // base AU의 타임라인
  questions: QaEntry[];          // base AU의 문답
  qaPool?: string[];             // base AU의 대기 질문 풀 (v1.9 — 랜덤 출제 대기)
  qaEnabled?: boolean;           // base AU의 QUESTIONS 섹션 사용 여부 (구버전은 questions 존재로 판정)
  /** 문답 답변 숨기기 (v2.0 사용자 요청) — 질문은 그대로 두고 **답변 내용만** 가린다.
   *  켜면 **관리자와 이 자관 캐릭터에 권한을 받은 회원만** 볼 수 있다(사용자 확정).
   *  **화면에서 가리는 것일 뿐 완전한 차단이 아니다** — 답변은 공개로 저장돼 있어 주소를 직접
   *  다루는 사람에게는 보일 수 있다. 설정 화면에도 그대로 적어 둔다. */
  qaHide?: boolean;
  /** 상세 하단에 보일 연동 리스트 — 로그 백업(log) / 세션 게시판(session). 미지정이면 지금까지대로 로그 */
  linkBoard?: 'log' | 'session';
}

export const CHAR_SEED: Character[] = [];

export const REL_SEED: Relation[] = [];

export const findChar = (chars: Character[], id: string) => chars.find(c => c.id === id);

/* ---------- 페이지 주소 별명 (v2.0 사용자 요청) ---------- */
/** 주소로 항목 찾기 — id로도, 별명으로도 열린다 (별명을 바꿔도 옛 주소가 살아 있게) */
export const findByKey = <T extends { id: string; slug?: string }>(list: T[], key: string) =>
  list.find(x => x.id === key || (x.slug ?? '') === key);
/** 이 캐릭터의 주소 — 별명을 정했으면 그것, 아니면 id */
export const charPath = (c: { id: string; slug?: string }) => `/chars/${c.slug?.trim() || c.id}`;
/** 이 자관의 주소 — 별명을 정했으면 그것, 아니면 id */
export const relPath = (r: { id: string; slug?: string }) => `/rels/${r.slug?.trim() || r.id}`;


/* ---------- 자관 갤러리 ↔ 캐릭터 갤러리 태그 연동 (v6.2) ---------- */

/** 이 자관 멤버 캐릭터들의 갤러리 묶음에 달린 태그 모음 — 연동 태그 고르기용 (많이 쓴 순) */
export function memberGalleryTags(rel: Relation, chars: Character[]): { tag: string; count: number; names: string[] }[] {
  const map = new Map<string, { count: number; names: Set<string> }>();
  for (const m of rel.members) {
    const c = chars.find(x => x.id === m.charId);
    if (!c) continue;
    for (const p of galleryPostsOf(c)) {
      for (const t of p.tags ?? []) {
        const e = map.get(t) ?? { count: 0, names: new Set<string>() };
        e.count += 1; e.names.add(c.name);
        map.set(t, e);
      }
    }
  }
  return [...map.entries()]
    .map(([tag, e]) => ({ tag, count: e.count, names: [...e.names] }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** 자관 갤러리에 같이 보일 묶음 = 자기 묶음 + 연동 태그가 달린 멤버 캐릭터 묶음.
 *  연동분은 복사하지 않고 캐릭터 쪽 데이터를 그대로 가리킨다(캐릭터에서 고치면 자관에도 반영) —
 *  id는 `캐릭터id:묶음id`, from에 캐릭터 이름. 열람 권한(캐릭터·묶음 공개범위)은 여기서 거른다 */
export function relGalleryPosts(rel: Relation, chars: Character[], viewer: { isAdmin: boolean; loggedIn: boolean }): GalleryPost[] {
  const ok = (v: Visibility) => v === 'public' || (v === 'member' && viewer.loggedIn) || viewer.isAdmin;
  const own = galleryPostsOf(rel).filter(p => ok(p.visibility));
  const tags = rel.galleryTagLinks ?? [];
  if (tags.length === 0) return own;
  const linked: GalleryPost[] = [];
  for (const m of rel.members) {
    const c = chars.find(x => x.id === m.charId);
    if (!c || !ok(c.visibility)) continue;
    for (const p of galleryPostsOf(c)) {
      if (!ok(p.visibility)) continue;
      if (!(p.tags ?? []).some(t => tags.includes(t))) continue;
      linked.push({ ...p, id: `${c.id}:${p.id}`, from: c.name });
    }
  }
  return [...own, ...linked];
}


/* ---------- 캐릭터 갤러리 ← 자관 갤러리 태그 연동 (v6.3) — 위 자관→캐릭터 연동의 반대 방향 ----------
   연동으로 가져오는 건 상대 쪽이 직접 올린 묶음(galleryPostsOf)뿐이라, 서로 연동해도 되돌아 꼬리를 물지 않는다 */

/** 이 캐릭터가 멤버인 자관들의 갤러리 묶음에 달린 태그 모음 — 연동 태그 고르기용 */
export function relGalleryTagsForChar(charId: string | undefined, rels: Relation[]): { tag: string; count: number; names: string[] }[] {
  if (!charId) return [];
  const map = new Map<string, { count: number; names: Set<string> }>();
  for (const r of rels) {
    if (!r.members.some(m => m.charId === charId)) continue;
    for (const p of galleryPostsOf(r)) {
      for (const t of p.tags ?? []) {
        const e = map.get(t) ?? { count: 0, names: new Set<string>() };
        e.count += 1; e.names.add(r.name);
        map.set(t, e);
      }
    }
  }
  return [...map.entries()]
    .map(([tag, e]) => ({ tag, count: e.count, names: [...e.names] }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** 캐릭터 갤러리에 같이 보일 묶음 = 자기 묶음 + 연동 태그가 달린 자관 묶음. id는 `rel~자관id:묶음id`, from에 자관 이름.
 *  canEdit = 이 캐릭터를 편집할 수 있는 사람(관리자·편집 권한) — 나만보기 묶음까지 봄 */
export function charGalleryPosts(c: Character, rels: Relation[], viewer: { isAdmin: boolean; canEdit: boolean; loggedIn: boolean }): GalleryPost[] {
  const okOwn = (v: Visibility) => v === 'public' || (v === 'member' && viewer.loggedIn) || viewer.canEdit;
  const okRel = (v: Visibility) => v === 'public' || (v === 'member' && viewer.loggedIn) || viewer.isAdmin;
  const own = galleryPostsOf(c).filter(p => okOwn(p.visibility));
  const tags = c.galleryTagLinks ?? [];
  if (tags.length === 0) return own;
  const linked: GalleryPost[] = [];
  for (const r of rels) {
    if (!r.members.some(m => m.charId === c.id) || !okRel(r.visibility)) continue;
    for (const p of galleryPostsOf(r)) {
      if (!okRel(p.visibility)) continue;
      if (!(p.tags ?? []).some(t => tags.includes(t))) continue;
      linked.push({ ...p, id: `rel~${r.id}:${p.id}`, from: r.name });
    }
  }
  return [...own, ...linked];
}


/* ---------- REL(관계) 탭 (v6.8) — 참고: OC-homepage의 관계 탭(페어 자동 목록) ---------- */
export interface RelCardInfo {
  key: string; name: string; sub: string;
  label?: string;          // 카드 왼쪽 위 꼬리표 (CP·관계명)
  thumbRef?: string;       // 이미지 (IndexedDB 키)
  thumbClass?: string;     // 이미지가 없을 때 쓰는 플레이스홀더
  href: string;
}
export interface RelGroupInfo { name: string; cards: RelCardInfo[] }

/** 이 캐릭터의 관계 그룹들 — Pair(페어 자관) · Group(다인관) · 직접 지정 순.
 *  자관은 이 캐릭터가 멤버인 것, 열람 권한이 없는 자관·캐릭터는 뺀다 */
export function charRelGroups(ch: Character, chars: Character[], rels: Relation[], viewer: { isAdmin: boolean; loggedIn: boolean }): RelGroupInfo[] {
  const ok = (v: Visibility) => v === 'public' || (v === 'member' && viewer.loggedIn) || viewer.isAdmin;
  const charOf = (id: string) => chars.find(c => c.id === id);
  const charHref = (c: Character) => `/chars/${c.slug ?? c.id}`;
  const pairs: RelCardInfo[] = [];
  const groups: RelCardInfo[] = [];
  for (const r of rels) {
    if (!r.members.some(m => m.charId === ch.id) || !ok(r.visibility)) continue;
    const others = r.members.filter(m => m.charId !== ch.id).map(m => charOf(m.charId)).filter((c): c is Character => !!c);
    const isPair = (r.kind ?? (r.members.length === 2 ? 'pair' : 'multi')) === 'pair';
    const card: RelCardInfo = {
      key: `rel:${r.id}`, name: r.name,
      sub: others.length ? `with ${others.map(o => o.name).join(', ')}` : '',
      label: r.cp === 'cp' ? 'CP' : r.cp === 'ncp' ? 'NCP' : undefined,
      thumbRef: r.thumbId ?? others[0]?.thumbId, thumbClass: others[0]?.thumbClass ?? r.thumbClass,
      href: `/rels/${r.slug ?? r.id}`,
    };
    (isPair ? pairs : groups).push(card);
  }
  const out: RelGroupInfo[] = [];
  if (pairs.length) out.push({ name: 'Pair', cards: pairs });
  if (groups.length) out.push({ name: 'Group', cards: groups });

  const manual: RelCardInfo[] = [];
  for (const l of ch.relLinks ?? []) {
    const c = charOf(l.charId);
    if (!c || c.id === ch.id || !ok(c.visibility)) continue;
    manual.push({ key: `link:${c.id}`, name: c.name, sub: c.sub, label: l.label || undefined, thumbRef: c.thumbId, thumbClass: c.thumbClass, href: charHref(c) });
  }
  if (manual.length) out.push({ name: '관계', cards: manual });

  return out;
}
