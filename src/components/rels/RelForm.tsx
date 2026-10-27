'use client';
// 자관 등록/수정 공용 폼 (4.5) — 유형(페어/다인) · 이름/본문 폰트 · 캐치프레이즈 · 공개범위 ·
// 아트 다중 등록(첫 장 = 대표 · 리스트 썸네일 4:3 크롭) · 등록 시 내 캐릭터 연동
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DecoScript, DecoGhost, DEFAULT_DECO_SCRIPT, DEFAULT_DECO_GHOST } from '@/lib/charStore';
import { ScriptPlacer } from '@/components/chars/ScriptPlacer';
import { relTitleLines, relTitlePx, relTitleVw, heroCol, heroNameFs, emWidth } from '@/components/rels/RelStage';
import { Character, Relation, Visibility, RelCpTag, RelMember, auMember, auStyle, fullShadow,
  HeroLayout, heroOrder, heroZ, heroFullId, heroStickerId, HERO_UI_ID } from '@/lib/charStore';
import { ColorField } from '@/components/ui/ColorField';
import { isValidSlug, slugify } from '@/lib/link';
import { CP_LABEL } from '@/lib/relqStore';
import { newId } from '@/lib/postStore';
import { useFonts, deVarFamily } from '@/lib/fontStore';
import { putBlob, getBlob, useBlobUrl } from '@/lib/blobStore';
import { KInput, KSelect, KCheck, KStep, KToggle, KRadio } from '@/components/ui/Kit';
import { Modal } from '@/components/ui/Modal';
import { GrantsEditor } from '@/components/chars/GrantsEditor';
import type { CharGrant } from '@/lib/charStore';
import { isPlainSpec } from '@/lib/charRuleConfig';
import { CropEditor, CropValue, CropImg } from '@/components/ui/CropEditor';
import { DragList } from '@/components/ui/DragList';
import { Lightbox } from '@/components/ui/Lightbox';
import { useConfirmDelete } from '@/components/ui/Modal';
import { fileDrop } from '@/lib/dnd';
import { useToast } from '@/components/ui/Toast';
import { useLocalList } from '@/lib/postStore';
import { CHAR_SEED, memberGalleryTags, galleryPostsOf } from '@/lib/charStore';
import { GalleryTagLinkPicker } from '@/components/gallery/GalleryPostsEditor';
import { RelLinkBoard } from '@/components/rels/RelLinkBoard';
import { PageBgmEditor } from '@/components/bgm/PageBgmEditor';
import type { PageBgm } from '@/lib/bgmStore';

export interface RelFormValue {
  memberOrder?: string[];         // 다인관 멤버 순서(charId 순) — 상세 페이지에 이 순서로 보인다 (v6.7)
  detailLayout?: 'stage' | 'classic';
  deco?: 'off'; decoBg?: 'band'; decoFontId?: string; decoScript?: DecoScript; decoGhost?: DecoGhost;   // 스테이지 배경 장식 (캐릭터 상세와 같은 설정)
  leftBoard?: 'rp' | 'gallery';   // 상세 하단 좌측 칸 — 역극(기본) / 갤러리 (v6.0)
  bgm?: PageBgm;             // 이 자관 페이지 전용 BGM (v5.9) — 없으면 홈페이지 BGM
  slug?: string;             // 페이지 주소 /rels/{slug} (v1.9 — 신규 등록 시, 비우면 자동 id)
  name: string;
  catchphrase: string;
  kind: 'pair' | 'multi';
  visibility: Visibility;
  fontId: string;
  bodyFontId: string;
  arts: string[];            // 첫 장 = 대표 = 리스트 썸네일 원본
  thumbCrop?: CropValue;
  headerImgId?: string;      // 헤더 이미지 (v1.5 — 풀폭 블러 + 페이드아웃)
  headerCrop?: CropValue;    // 헤더 위치 크롭 (원본 무손실)
  headerRemoved?: boolean;   // 헤더 제거 상태 (v1.9 — AU 편집에서 "없음 명시" 저장용)
  headerBlur?: number;       // 배경 이미지 블러(px) — 환경설정 배경 변경과 같은 슬라이더 (v5.0)
  themeFollow?: boolean;     // AU 편집: true면 기존(base) 페이지 테마 따라가기 (v1.9)
  illuBg?: string;           // 전신/일러 스위치 배경색 (v1.9 — 미지정: 테마)
  illuOn?: string;           // 전신/일러 스위치 선택색 (미지정: 포인트색)
  nameColor?: string;        // 자관명(히어로 타이틀) 글씨색 (v1.9 사용자 요청 — 미지정: 테마)
  cpColor?: string;          // 캐치프레이즈 글씨색 (미지정: 테마)
  cpTagBg?: string;          // CP/NCP 뱃지 배경색 (v2.0 사용자 요청)
  cpTagFg?: string;          // CP/NCP 뱃지 글씨색
  nameShadowColor?: string;  // 자관명 그림자 색 (v2.0 사용자 요청)
  nameShadow?: number;       // 자관명 그림자 강도 %
  headerBgG1?: string;       // 헤더 이미지 없을 때 배경 그라데이션 (v2.0 사용자 요청)
  headerBgG2?: string;
  headerBgAngle?: number;
  pageBgG1?: string;         // 페이지 전체 배경 그라데이션 (v2.0 사용자 요청)
  pageBgG2?: string;
  pageBgAngle?: number;
  themeMode: 'site' | 'custom'; // 페이지 테마 — 홈페이지 그대로 / 별도 테마컬러 (4.18 방식)
  themeColor?: string;          // 별도 테마컬러 (custom일 때)
  themeTone?: 'dark' | 'light'; // 테마컬러의 다크/라이트 느낌
  cp: RelCpTag;              // CP/NCP (v1.9) — AU별로는 AU 관리에서 따로 지정
  fulls?: Record<string, string | undefined>;  // 멤버별 전신 이미지 (v1.9 — charId → blob id)
  fullScales?: Record<string, number>;         // 전신 크기 % (휠 조절)
  fullOffsets?: Record<string, { x: number; y: number }>; // 전신 위치 오프셋 % (드래그, v1.9)
  quotes?: Record<string, string>;                              // 히어로 좌/우 한마디 문구 (v2.0)
  nameSizes?: Record<string, number>;                           // 멤버 카드 이름 크기 px (v2.0)
  nameBolds?: Record<string, boolean>;                          // 멤버 카드 이름 볼드 (v2.0 — 기본 켜짐)
  heroNameSizes?: Record<string, number>;                       // PC 상세 전신 위 캐릭터 이름 크기 px (안 정하면 자동)
  badgeAligns?: Record<string, 'top' | 'mid' | 'bottom'>;       // (구) 이름·배지 묶음 세로 위치 — 화면에서는 없앴고 저장된 값만 보존
  badgeTextAligns?: Record<string, 'left' | 'center' | 'right'>; // 이름·부제·배지 묶음 가로 정렬 (이름 기준)
  titleSize?: number;                                           // 자관 이름(제목) 크기 px (안 정하면 기본)
  quoteColors?: Record<string, { fg?: string; mark?: string }>; // 히어로 대사 글씨/따옴표색 (페어, v1.9)
  fullFront?: string;                          // 앞에 보일 캐릭터 id (레이어 순서에서 맨 위 전신 — 예전 화면 호환용)
  heroLayout?: HeroLayout;                     // 레이어 순서·스티커·제목/이름 배치 (v5.6)
  auGalleryTags?: string[];  // AU별 갤러리 서랍에 보일 사진 태그 (AU 편집일 때만 — 비우면 자관 기본)
  auName?: string;           // AU별 자관명 (v2.0 사용자 요청 — AU 편집일 때만)
  qaHide?: boolean;          // 문답 답변 숨기기 (v2.0 사용자 요청)
  linkBoard?: 'log' | 'session'; // 상세 하단에 보일 연동 리스트 — 로그 백업 / 세션 게시판 (자관 전체 설정)
  pickedCharIds: string[];   // 등록 시 연동할 내 캐릭터 (수정 모드에선 빈 배열)
}

/** 전신 위 이름의 자동 크기 근처 값(창 폭 1000px일 때 약 34px) — 스텝퍼의 시작 표시값 */
const HERO_NAME_DEFAULT = 34;

interface FullDraft { ref?: string; file?: File; url?: string }

/** 상세 전신 히어로(.rel-center-full)와 똑같은 가로:세로 비 (v5.2 사용자 요청).
 *  상세는 화면 폭 100vw × 높이 calc(100vh - 58px) (폭 960px 이하는 86vh)로 깔린다.
 *  예전 미리보기는 3:4.1 고정 상자라 여기서 잡은 위치·크기가 실제 화면과 어긋났다 —
 *  지금 브라우저 창 크기로 같은 비를 계산해 쓰므로, 위치·크기(모두 상자 대비 %)가 그대로 일치한다. */
function useHeroAspect() {
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const boxH = w <= 960 ? h * 0.86 : h - 58;
      if (w > 0 && boxH > 0) setRatio(w / boxH);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return ratio;
}

/** 전신 미리보기 한 장 (v1.9 조작 개편 — 사용자 확정)
 *  · 드래그 = 위치 이동 (가로·세로)  · 휠 = 크기 (비율 유지)  · 우클릭 = 앞으로/뒤로 메뉴
 *  배치는 상세 FullImg와 동일(부모 fb 박스 기준 하단 중앙 + 오프셋) — 미리보기 = 실제 */
function FullPrevImg({ draft, scale, offX, offY, name, shadow, selected, onSelect, ly, onDragStart, onGroup, snap, scaleStep, onScale, onOffset, onLayer }: {
  draft?: FullDraft; scale: number; offX: number; offY: number; name: string; shadow?: string;
  selected?: boolean; onSelect?: (shift: boolean) => void; ly?: string;
  onDragStart?: () => void; onGroup?: (dxPx: number, dyPx: number) => void;
  /** 그리드가 켜져 있을 때만 — 드래그 중인 위치(오프셋 %)를 격자에 맞춘 값으로 바꿔 준다 (v5.7) */
  snap?: (p: { x: number; y: number }) => { x: number; y: number };
  /** 그리드가 켜져 있을 때만 — 휠 크기를 이 간격(%)의 배수로 (v5.7) */
  scaleStep?: number;
  onScale: (v: number) => void;
  onOffset: (x: number, y: number) => void;
  onLayer: (front: boolean) => void;
}) {
  const loaded = useBlobUrl(draft?.ref);
  const src = draft?.url ?? loaded;
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number; bw: number; bh: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);
  // 휠 = 크기 — React onWheel은 passive라 preventDefault가 무시되어 페이지가 같이 스크롤됨 (v1.9 수정)
  // → 네이티브 리스너를 {passive:false}로 등록해 이미지 위에서는 기본 휠 차단
  const imgRef = React.useRef<HTMLImageElement>(null);
  const wheelState = React.useRef({ scale, onScale, scaleStep });
  wheelState.current = { scale, onScale, scaleStep };
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: s, onScale: fn, scaleStep: st } = wheelState.current;
      if (st) {
        const v = Math.round((s - Math.sign(e.deltaY) * st) / st) * st;
        fn(Math.max(15, Math.min(160, Math.round(v * 100) / 100)));
        return;
      }
      fn(Math.max(15, Math.min(160, Math.round(s - Math.sign(e.deltaY) * 4))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  if (!src) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={name} data-ly={ly}
        style={{
          position: 'absolute', bottom: `${offY}%`, left: `calc(50% + ${offX}%)`, transform: 'translateX(-50%)',
          height: `${scale}%`, maxWidth: 'none', cursor: 'var(--cur-grab,grab)',
          userSelect: 'none', touchAction: 'none',
          filter: shadow, outline: selected ? '1.5px dashed var(--accent,#c96a73)' : undefined,
          pointerEvents: 'auto',
        }}
        draggable={false}
        onPointerDown={e => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect?.(e.shiftKey);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { x: e.clientX, y: e.clientY, ox: offX, oy: offY, bw: box.width, bh: box.height };
          onDragStart?.();
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (!d) return;
          const nx = d.ox + ((e.clientX - d.x) / d.bw) * 100;
          const ny = d.oy - ((e.clientY - d.y) / d.bh) * 100;
          const q = snap ? snap({ x: nx, y: ny }) : { x: Math.round(nx), y: Math.round(ny) };
          const fx = Math.max(-1200, Math.min(1200, q.x)), fy = Math.max(-250, Math.min(250, q.y));
          onOffset(fx, fy);
          onGroup?.(((fx - d.ox) / 100) * d.bw, -((fy - d.oy) / 100) * d.bh);
        }}
        onPointerUp={() => { drag.current = null; }}
        onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }} />
      {menu && createPortal(
        <div style={{
          position: 'fixed', left: menu.x, top: menu.y, zIndex: 130,
          background: 'var(--panel-solid,#fff)', border: '1px solid var(--line)', borderRadius: 9,
          boxShadow: 'var(--sh-dd)', padding: 4, display: 'grid', minWidth: 92,
        }} onMouseDown={e => e.stopPropagation()}>
          <button style={{ padding: '7px 12px', fontSize: 12, borderRadius: 6, textAlign: 'left' }}
            onClick={() => { onLayer(true); setMenu(null); }}>앞으로</button>
          <button style={{ padding: '7px 12px', fontSize: 12, borderRadius: 6, textAlign: 'left' }}
            onClick={() => { onLayer(false); setMenu(null); }}>뒤로</button>
        </div>,
        document.body,
      )}
    </>
  );
}

/** 지금 창 크기 — 미리보기의 글자 크기·제목 자리를 실제 상세 화면과 같은 비로 맞추려고 (v5.6) */
function useViewport() {
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const calc = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return vp;
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** 미리보기 위에서 끌 수 있는 한 덩어리 (제목·이름·스티커 공용, v5.6).
 *  끈 거리는 미리보기 상자 대비 %로 바뀌어 (x, y) 값에 더해진다 — 상세 화면과 같은 단위.
 *  onWheel을 주면 휠로도 조절한다(스티커 크기). 휠은 네이티브 리스너로 달아 페이지가 같이 스크롤되지 않게 한다 */
/** 레이어 눈 버튼 — 켜면 보이고 끄면 숨는다 (그림 편집 프로그램의 레이어 눈 아이콘처럼) */
function EyeBtn({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-label={on ? '숨기기' : '보이기'} title={on ? '보임 — 눌러서 숨기기' : '숨김 — 눌러서 보이기'}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 7, border: 'none',
        background: 'transparent', cursor: 'var(--cur-pointer,pointer)', color: on ? 'var(--ink,#16191f)' : 'var(--faint)', opacity: on ? 1 : .55 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        {!on && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

function PrevDrag({ rootRef, x, y, min = -100, max = 100, grid, selected, onSelect, onChange, onWheel, style, children, ly, onDragStart, onGroup }: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  x: number; y: number; min?: number; max?: number; selected?: boolean;
  /** 그리드 스냅 (v5.7) — ax·ay = 오프셋 0일 때 기준점의 위치(상자 대비 %), cx·cy = 격자 한 칸(%).
   *  기준점의 "실제 위치"가 격자에 맞도록 오프셋을 보정한다 — 메인 편집모드의 10px 스냅과 같은 방식 */
  grid?: { ax: number; ay: number; cx: number; cy: number };
  onSelect?: (shift: boolean) => void;
  onChange: (x: number, y: number) => void;
  onWheel?: (dir: number) => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
  ly?: string;   // 정렬 기능이 요소를 찾는 이름
  onDragStart?: () => void;                       // 여러 개 선택 이동 — 끌기 시작할 때 다른 선택 항목의 시작 위치를 기억
  onGroup?: (dxPx: number, dyPx: number) => void; // 끄는 동안 이동량(px)을 알려 선택한 다른 항목도 같이 움직이게
}) {
  const elRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ px: number; py: number; ox: number; oy: number; w: number; h: number } | null>(null);
  const wheelFn = React.useRef(onWheel);
  wheelFn.current = onWheel;
  const hasWheel = !!onWheel;
  useEffect(() => {
    const el = elRef.current;
    if (!el || !hasWheel) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); wheelFn.current?.(Math.sign(e.deltaY)); };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, [hasWheel]);
  return (
    <div ref={elRef} data-ly={ly}
      style={{
        position: 'absolute', cursor: 'var(--cur-grab,grab)', touchAction: 'none', userSelect: 'none',
        pointerEvents: 'auto', outline: selected ? '1.5px dashed var(--accent,#c96a73)' : '1px dashed rgba(255,255,255,.28)',
        outlineOffset: 3, ...style,
      }}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        onSelect?.(e.shiftKey);
        const box = rootRef.current?.getBoundingClientRect();
        if (!box) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { px: e.clientX, py: e.clientY, ox: x, oy: y, w: box.width, h: box.height };
        onDragStart?.();
      }}
      onPointerMove={e => {
        const d = drag.current;
        if (!d) return;
        let nx = d.ox + ((e.clientX - d.px) / d.w) * 100;
        let ny = d.oy + ((e.clientY - d.py) / d.h) * 100;
        if (grid) {
          nx = Math.round((grid.ax + nx) / grid.cx) * grid.cx - grid.ax;
          ny = Math.round((grid.ay + ny) / grid.cy) * grid.cy - grid.ay;
        }
        const r = grid ? (v: number) => Math.round(v * 100) / 100 : round1;
        const fx = clampN(r(nx), min, max), fy = clampN(r(ny), min, max);
        onChange(fx, fy);
        onGroup?.(((fx - d.ox) / 100) * d.w, ((fy - d.oy) / 100) * d.h);
      }}
      onPointerUp={() => { drag.current = null; }}>
      {children}
    </div>
  );
}

/** 스티커 초안 — 새로 올린 건 file/url, 저장돼 있던 건 ref */
interface StickerDraft { id: string; ref?: string; file?: File; url?: string; x: number; y: number; w: number }

function StickerPrev({ s, z, rootRef, grid, selected, onSelect, onChange, onDragStart, onGroup }: {
  s: StickerDraft; z: number; rootRef: React.RefObject<HTMLDivElement | null>;
  grid?: { cx: number; cy: number };
  selected: boolean; onSelect: (shift: boolean) => void; onChange: (p: Partial<StickerDraft>) => void;
  onDragStart?: () => void; onGroup?: (dxPx: number, dyPx: number) => void;
}) {
  const loaded = useBlobUrl(s.ref);
  const src = s.url ?? loaded;
  if (!src) return null;
  return (
    <PrevDrag ly={`st:${s.id}`} onDragStart={onDragStart} onGroup={onGroup} rootRef={rootRef} x={s.x} y={s.y} min={-20} max={120} selected={selected} onSelect={onSelect}
      grid={grid ? { ax: 0, ay: 0, cx: grid.cx, cy: grid.cy } : undefined}
      onChange={(x, y) => onChange({ x, y })}
      onWheel={dir => onChange({
        // 그리드가 켜져 있으면 가로 폭이 격자 한 칸(10px)의 배수로 (v5.7)
        w: grid ? clampN(Math.round(((s.w - dir * grid.cx) / grid.cx)) * grid.cx, grid.cx, 90)
          : clampN(s.w - dir * 2, 3, 90),
      })}
      style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, transform: 'translate(-50%,-50%)', zIndex: z, outlineOffset: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
    </PrevDrag>
  );
}

/** 레이어 목록 행의 작은 그림 — 이미지가 있으면 그것, 없으면 글자 */
function LayerThumb({ refId, url, text }: { refId?: string; url?: string; text?: string }) {
  const loaded = useBlobUrl(refId);
  const src = url ?? loaded;
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center',
      background: 'rgba(127,127,127,.14)', fontSize: 13, fontWeight: 700, color: 'var(--sub)' }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : (text ?? '')}
    </div>
  );
}

interface ArtItem { id: string; ref?: string; url?: string; file?: File }

function ArtThumb({ item, crop }: { item: ArtItem; crop?: CropValue }) {
  const loaded = useBlobUrl(item.ref);
  const src = item.url ?? loaded;
  if (!src) return <div className="ph" style={{ width: '100%', height: '100%' }} />;
  return <CropImg src={src} crop={crop} />;
}

/** ADD CHARACTER — 기존 캐릭터 연동 또는 새 상대 캐릭터 간단 등록 (자관 상세의 「멤버 추가」와 같은 입력) */
export type AddMemberInput =
  | { mode: 'exist'; charId: string; quote: string }
  | { mode: 'new'; name: string; sub: string; color: string; grants: CharGrant[]; quote: string };

export function RelForm({ initial, auId, myChars, memberNames, existingIds, addCandidates, onAddMember, onSave, onCancel }: {
  /** 멤버로 추가할 수 있는 캐릭터(이미 멤버가 아닌 것) — 수정 화면에서만 */
  addCandidates?: Character[];
  /** 멤버 추가를 바로 저장한다. 성공하면 true — 폼에 적던 내용은 그대로 유지된다 */
  onAddMember?: (a: AddMemberInput) => boolean;
  initial: Relation | null;          // null = 신규 등록
  auId?: string;                     // AU 편집 모드 (v1.9) — 아트·캐치프레이즈·전신이 이 AU의 것
  myChars: Character[];
  memberNames?: Record<string, string>;  // 멤버 charId → 이름 (전신 섹션 표기)
  existingIds?: string[];            // 페이지 주소 중복 검사용 (v1.9 — 신규 등록)
  onSave: (v: RelFormValue, dest?: string) => void;   // dest: 저장 뒤 이동할 주소(갤러리·역극 연동 버튼)
  onCancel: () => void;
}) {
  const toast = useToast();
  const del = useConfirmDelete();   // 삭제 확인 모달 (v1.9 — 아트·전신)
  const { fonts, familyOf } = useFonts();
  const isNew = !initial;
  const auObj = auId ? initial?.aus.find(a => a.id === auId) : undefined;

  const [kind, setKind] = useState<'pair' | 'multi'>(initial?.kind ?? 'pair');
  const [bgm, setBgm] = useState<PageBgm | undefined>(initial?.bgm);
  // 다인관 멤버 순서 (v6.7) — 설정 화면에서 드래그로 바꾼다. 상세 페이지에서는 직접 옮기지 않는다
  const isMultiRel = kind === 'multi' || (!!initial && !initial.kind && initial.members.length > 2);   // kind가 없는 옛 자관은 인원수로 판단
  const [memberOrder, setMemberOrder] = useState<string[]>(() => (initial?.members ?? []).map(m => m.charId));
  const [detailLayout, setDetailLayout] = useState<'stage' | 'classic'>(initial?.detailLayout === 'classic' ? 'classic' : 'stage');
  const [deco, setDeco] = useState<'on' | 'off'>(initial?.deco ?? 'on');
  const [decoScript, setDecoScript] = useState<DecoScript | null>(initial?.decoScript ?? null);
  const [decoGhost, setDecoGhost] = useState<DecoGhost>(initial?.decoGhost ?? { ...DEFAULT_DECO_GHOST });
  const [decoFontId, setDecoFontId] = useState(initial?.decoFontId ?? '');
  const [decoBg, setDecoBg] = useState<'full' | 'band'>(initial?.decoBg ?? 'full');
  const [leftBoard, setLeftBoard] = useState<'rp' | 'gallery'>(initial?.leftBoard === 'gallery' ? 'gallery' : 'rp');
  const [name, setName] = useState(initial?.name ?? '');
  // 페이지 주소 /rels/{slug} — 신규는 비우면 자동(id). 수정에서도 바꿀 수 있다 (v2.0 사용자 요청)
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [catchphrase, setCatchphrase] = useState(auObj ? auObj.catchphrase : (initial?.catchphrase ?? ''));
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'public');
  const [cp, setCp] = useState<RelCpTag>((auObj?.cp ?? initial?.cp) ?? 'cp');   // CP/NCP (v1.9)
  // AU 편집이면 그 AU에 정한 폰트부터 (v2.0 사용자 제보 — AU 폰트가 분리되지 않던 것)
  const [fontId, setFontId] = useState((auObj?.fontId ?? initial?.fontId) ?? 'serif');
  const [bodyFontId, setBodyFontId] = useState((auObj?.bodyFontId ?? initial?.bodyFontId) ?? 'default');
  const [picked, setPicked] = useState<string[]>([]);
  const [arts, setArts] = useState<ArtItem[]>(() => {
    const refs = auObj ? (auObj.arts ?? []) : (initial?.arts ?? (initial?.thumbId ? [initial.thumbId] : []));
    return refs.map(r => ({ id: newId(), ref: r }));
  });
  const heroRatioWin = useHeroAspect();
  const [thumbCrop, setThumbCrop] = useState<CropValue | undefined>(initial?.thumbCrop);
  const [cropOpen, setCropOpen] = useState(false);
  const [lb, setLb] = useState<number | null>(null);   // 아트 썸네일 클릭 → 원본 보기
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerUrl, setHeaderUrl] = useState('');
  const [headerRemoved, setHeaderRemoved] = useState(false);
  // AU 편집 모드 — 그 AU의 헤더만 시작점 (base 것을 복사해오지 않음, v1.9 AU별 완전 분리)
  const initHeaderId = auObj ? (auObj.headerImgId ?? undefined) : initial?.headerImgId;
  const initHeaderBlur = auObj ? auObj.headerBlur : initial?.headerBlur;
  const [headerBlur, setHeaderBlur] = useState(initHeaderBlur ?? 16);
  // 위치 크롭 UI는 없앴지만(v5.0), 예전에 저장해 둔 값이 있으면 그냥 들고만 있다가 그대로 돌려준다
  const initHeaderCrop = auObj ? auObj.headerCrop : initial?.headerCrop;
  // 페이지 테마 (v1.9 AU별) — AU 편집: 기존(base) 따라가기 또는 이 AU 전용 테마
  const [themeFollow, setThemeFollow] = useState<boolean>(auObj ? auObj.theme === undefined : false);
  const [themeMode, setThemeMode] = useState<'site' | 'custom'>(
    (auObj?.theme?.mode ?? initial?.themeMode) ?? 'site');
  const [themeColor, setThemeColor] = useState((auObj?.theme?.color ?? initial?.themeColor) ?? '#c9a86a');
  const [themeTone, setThemeTone] = useState<'dark' | 'light'>((auObj?.theme?.tone ?? initial?.themeTone) ?? 'dark');
  // 색·배경은 AU마다 따로 정할 수 있다 (v2.0 사용자 요청) — AU 편집 중이면 그 AU에 정해 둔 값부터 보고,
  // 정한 게 없으면 자관 값이 그대로 채워진다. 체크를 끄면 AU에서 지워져 자관 값으로 되돌아간다.
  const st = initial ? auStyle(initial, auObj) : undefined;
  // 전신/일러 스위치 색 (v1.9) — 직접 지정 안 하면 테마·포인트색
  const [illuCustom, setIlluCustom] = useState(!!(st?.illuBg || st?.illuOn));
  const [illuBg, setIlluBg] = useState(st?.illuBg ?? '#1d2025');
  const [illuOn, setIlluOn] = useState(st?.illuOn ?? '#a63a45');
  // 자관명·캐치프레이즈 글씨색 (v1.9 사용자 요청) — 직접 지정 안 하면 테마색
  const [txtCustom, setTxtCustom] = useState(!!(st?.nameColor || st?.cpColor));
  const [nameColor, setNameColor] = useState(st?.nameColor ?? '#e8eaee');
  const [cpColor, setCpColor] = useState(st?.cpColor ?? '#8a8f98');
  // CP/NCP 뱃지 색 (v2.0 사용자 요청) — 미지정이면 기본 pill 색
  const [tagCustom, setTagCustom] = useState(!!(st?.cpTagBg || st?.cpTagFg));
  const [cpTagBg, setCpTagBg] = useState(st?.cpTagBg ?? '#eef0f2');
  const [cpTagFg, setCpTagFg] = useState(st?.cpTagFg ?? '#5d636d');
  // 그림자 (v2.0) — 색·강도. 자관명과 전신 이미지에 함께 걸린다 (사용자 요청). 미지정이면 기존 그대로
  const [shadowCustom, setShadowCustom] = useState(!!(st?.nameShadowColor || st?.nameShadow));
  const [nameShadowColor, setNameShadowColor] = useState(st?.nameShadowColor ?? '#000000');
  const [nameShadow, setNameShadow] = useState(st?.nameShadow ?? 100);
  // 헤더 이미지가 없을 때 대신 깔 배경 그라데이션 (v2.0 사용자 요청) — 디자인 탭 배경 설정과 같은 방식(색 2개+각도)
  const [headerBgCustom, setHeaderBgCustom] = useState(!!(st?.headerBgG1 || st?.headerBgG2));
  const [headerBgG1, setHeaderBgG1] = useState(st?.headerBgG1 ?? '#3a4150');
  const [headerBgG2, setHeaderBgG2] = useState(st?.headerBgG2 ?? '#1a1d22');
  const [headerBgAngle, setHeaderBgAngle] = useState(st?.headerBgAngle ?? 180);
  // 페이지 전체 배경 (v2.0 사용자 요청) — 디자인 탭의 사이트 배경과 같은 방식(색 2개 + 각도)
  const [pageBgCustom, setPageBgCustom] = useState(!!(st?.pageBgG1 || st?.pageBgG2));
  const [pageBgG1, setPageBgG1] = useState(st?.pageBgG1 ?? '#2b3038');
  const [pageBgG2, setPageBgG2] = useState(st?.pageBgG2 ?? '#121418');
  const [pageBgAngle, setPageBgAngle] = useState(st?.pageBgAngle ?? 180);
  const [charQuery, setCharQuery] = useState('');
  // ADD CHARACTER 모달 상태
  const [memberOpen, setMemberOpen] = useState(false);
  const [mMode, setMMode] = useState<'exist' | 'new'>('exist');
  const [mCharId, setMCharId] = useState('');
  const [mQuery, setMQuery] = useState('');
  const [mQuote, setMQuote] = useState('');
  const [mName, setMName] = useState('');
  const [mSub, setMSub] = useState('');
  const [mColor, setMColor] = useState('#8a7f70');
  const [mGrants, setMGrants] = useState<CharGrant[]>([]);
  const submitMember = () => {
    if (!onAddMember) return;
    if (mMode === 'new' && !mName.trim()) { toast('상대 캐릭터 이름을 입력해 주세요'); return; }
    if (mMode === 'exist' && !mCharId) { toast('추가할 캐릭터를 선택해 주세요'); return; }
    const ok = mMode === 'new'
      ? onAddMember({ mode: 'new', name: mName.trim(), sub: mSub.trim(), color: mColor, grants: mGrants, quote: mQuote.trim() })
      : onAddMember({ mode: 'exist', charId: mCharId, quote: mQuote.trim() });
    if (!ok) return;
    setMemberOpen(false);
    setMCharId(''); setMQuery(''); setMQuote(''); setMName(''); setMSub(''); setMGrants([]);
    toast('캐릭터가 추가되었습니다');
  };
  // 멤버가 늘면 다인관 순서 목록에도 이어 붙인다
  const memberKey = (initial?.members ?? []).map(m => m.charId).join('|');
  useEffect(() => {
    const ids = memberKey ? memberKey.split('|') : [];
    setMemberOrder(o => {
      const keep = o.filter(id => ids.includes(id));
      const add = ids.filter(id => !keep.includes(id));
      return add.length || keep.length !== o.length ? [...keep, ...add] : o;
    });
  }, [memberKey]);
  // 전신 이미지 (v1.9 — 페어 · 수정 모드) — AU 편집이면 그 AU의 전신
  // 페어는 2명, 다인관은 등록한 전원 — 둘 다 같은 「메인 이미지 · 레이어」로 전신을 놓는다
  const pairMembers = !isNew && (initial!.kind ? initial!.kind === 'pair' : initial!.members.length === 2)
    ? initial!.members.slice(0, 2)
    : (!isNew && initial!.members.length >= 2 ? initial!.members : []);
  const [fulls, setFulls] = useState<Record<string, FullDraft>>(() => {
    const o: Record<string, FullDraft> = {};
    for (const m of pairMembers) {
      const ref = auObj ? auObj.fulls?.[m.charId] : m.fullImgId;
      if (ref) o[m.charId] = { ref };
    }
    return o;
  });
  // AU를 편집 중이면 그 AU에 정해 둔 값부터 본다 (v2.0 사용자 발견 — 예전엔 자관 공통 값만 봐서
  // AU에서 고친 게 다른 AU에도 그대로 나타났다). 정해 둔 게 없으면 자관 기본값.
  const mOf = (m: RelMember) => (auObj ? auMember(m, auObj) : m);
  const [fullScales, setFullScales] = useState<Record<string, number>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).fullScale ?? 90])));
  // 전신 위치 오프셋 % (v1.9 — 드래그로 이동, 상세와 동일 좌표계)
  const [fullOffsets, setFullOffsets] = useState<Record<string, { x: number; y: number }>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, { x: mOf(m).fullOffX ?? 0, y: mOf(m).fullOffY ?? 0 }])));
  // 히어로 좌/우 한마디 — 색만 정할 수 있고 문구를 고칠 곳이 없었다 (v2.0 사용자 발견)
  const [quotes, setQuotes] = useState<Record<string, string>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).quote ?? ''])));
  // 멤버 카드 이름 크기 (v2.0) — 카드 폭이 좁아 이름마다 알맞은 크기가 다르다
  const [nameSizes, setNameSizes] = useState<Record<string, number>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).nameSize ?? 17])));
  // PC 상세 전신 위 캐릭터 이름 크기 — 안 정한 멤버는 자동(창 폭에 맞춤)이라 값이 없다
  const [heroNameSizes, setHeroNameSizes] = useState<Record<string, number | undefined>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).heroNameSize])));
  // 이름·배지 묶음 세로 위치 — 위(기본)/중앙/아래
  const [badgeAligns, setBadgeAligns] = useState<Record<string, 'top' | 'mid' | 'bottom'>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).badgeAlign ?? 'top'])));
  const [badgeTextAligns, setBadgeTextAligns] = useState<Record<string, 'left' | 'center' | 'right' | undefined>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).badgeTextAlign])));
  // 자관 이름(제목) 크기 — AU 편집이면 그 AU에 정해 둔 값부터, 없으면 자관 값
  const [titleSize, setTitleSize] = useState<number | undefined>(auObj?.titleSize ?? initial?.titleSize);
  // 자관 이름(제목) 크기 조절 — 2인 전신 히어로는 작은 제목(22px), 그 외는 큰 제목(64px)이 기본
  const titleDefault = pairMembers.length > 0 ? 22 : 64;
  const titleSizeCtl = (
    <>
      <label className="k-label" style={{ margin: '10px 0 0' }}>
        자관 이름 크기 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 상세 화면의 자관 이름(제목){auObj ? ` · ${auObj.label} AU` : ''} · 기본 {titleDefault}px</span>
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <KStep value={titleSize ?? titleDefault} onChange={(v: number) => setTitleSize(v)}
          min={10} max={120} step={1} suffix="px" />
        {titleSize !== undefined && (
          <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5 }}
            onClick={() => setTitleSize(undefined)}>기본으로</button>
        )}
      </div>
    </>
  );
  // 이름 볼드 (v2.0 사용자 요청) — 폰트에 따라 볼드가 어색한 경우가 있어 끌 수 있게. 기본은 볼드
  const [nameBolds, setNameBolds] = useState<Record<string, boolean>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, mOf(m).nameBold ?? true])));
  // 히어로 대사 글씨/따옴표색 (페어, v1.9)
  const [quoteColors, setQuoteColors] = useState<Record<string, { fg?: string; mark?: string }>>(
    () => Object.fromEntries(pairMembers.map(m => [m.charId, { fg: mOf(m).quoteColor, mark: mOf(m).quoteMarkColor }])));
  // AU별 자관명 (v2.0 사용자 요청) — 비우면 자관 이름 그대로
  const [auName, setAuName] = useState(auObj?.name ?? '');
  const [auGalleryTags, setAuGalleryTags] = useState<string[]>(auObj?.galleryTags ?? []);
  const [allChars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  // 고를 수 있는 태그 = 자관 자기 갤러리 묶음의 태그 + 멤버 캐릭터 갤러리 묶음의 태그
  const auTagOptions = (() => {
    if (!initial) return [];
    const map = new Map<string, { count: number; names: Set<string> }>();
    for (const p of galleryPostsOf(initial)) for (const t of p.tags ?? []) {
      const e = map.get(t) ?? { count: 0, names: new Set<string>() }; e.count += 1; e.names.add(initial.name); map.set(t, e);
    }
    for (const o of memberGalleryTags(initial, allChars)) {
      const e = map.get(o.tag) ?? { count: 0, names: new Set<string>() }; e.count += o.count; o.names.forEach(n => e.names.add(n)); map.set(o.tag, e);
    }
    return [...map.entries()].map(([tag, e]) => ({ tag, count: e.count, names: [...e.names] })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  })();
  // 문답 답변 가리기 (v2.0 사용자 요청) — 질문은 그대로 두고 답변 내용만
  const [qaHide, setQaHide] = useState(!!initial?.qaHide);
  const [linkBoard, setLinkBoard] = useState<'log' | 'session'>(initial?.linkBoard ?? 'log');
  // 전신 앞뒤도 AU별 (v2.0) — AU에서 바꾼 앞뒤가 원본·다른 AU를 건드리지 않게.
  // v5.6부터 앞뒤는 아래 레이어 순서가 정하고, 이 값은 레이어 순서가 아직 없는 예전 자관의 시작점으로만 쓴다
  const initFullFront = auObj?.fullFront ?? initial?.fullFront;
  // 히어로 레이어·스티커·제목/이름 배치 (v5.6 사용자 요청 — 「메인 이미지 · 레이어」). AU 편집이면 그 AU 것
  const initLayout = auObj ? auObj.heroLayout : initial?.heroLayout;
  const vpWin = useViewport();
  const vp = vpWin;
  const heroRatio = heroRatioWin;
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [stickers, setStickers] = useState<StickerDraft[]>(() => (initLayout?.stickers ?? []).map(s => ({ ...s })));
  const [layerOrder, setLayerOrder] = useState<string[]>(
    () => heroOrder(initLayout, pairMembers.map(m => m.charId), initFullFront));
  const [uiTitle, setUiTitle] = useState<{ x: number; y: number }>(initLayout?.title ?? { x: 0, y: 0 });
  const [uiNames, setUiNames] = useState<Record<string, { x: number; y: number }>>(initLayout?.names ?? {});
  const [selLayer, setSelLayer] = useState<string | null>(null);
  // 여러 개 선택 (Shift+클릭) — 정렬 버튼이 이 목록을 기준으로 맞춘다
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const pickLayer = (id: string, shift: boolean) => {
    if (!shift) { if (!multiSel.includes(id)) setMultiSel([]); setSelLayer(id); return; }   // 선택된 묶음 안의 항목을 그냥 누르면 묶음 유지 (함께 끌기)
    setMultiSel(m => {
      const base = m.length === 0 && selLayer && selLayer !== id ? [selLayer] : m;
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    });
    setSelLayer(id);
  };
  const isSel = (id: string) => selLayer === id || multiSel.includes(id);
  // 여러 개 선택 이동 — 끌기 시작 때 나머지 선택 항목의 시작 위치를 기억해 두고, 끄는 만큼 같이 옮긴다
  const groupRef = React.useRef<{ w: number; h: number; items: { id: string; x: number; y: number; cw: number }[] } | null>(null);
  const startGroup = (primary: string) => {
    groupRef.current = null;
    const root = previewRef.current;
    if (!root || multiSel.length < 2 || !multiSel.includes(primary)) return;
    const rb = root.getBoundingClientRect();
    const items = multiSel.filter(id => id !== primary).map(id => {
      let x = 0, y = 0, cw = rb.width;
      if (id === 'info') { x = uiInfo.x; y = uiInfo.y; }
      else if (id === 'deco-ghost') { x = decoGhost.x; y = decoGhost.y; }
      else if (id === 'deco-script') { x = decoScript?.x ?? 0; y = decoScript?.y ?? 0; }
      else if (id === 'ui:title') { x = uiTitle.x; y = uiTitle.y; }
      else if (id.startsWith('ui:name:')) { const o = uiNames[id.slice(8)]; x = o?.x ?? 0; y = o?.y ?? 0; }
      else if (id.startsWith('st:')) { const st = stickers.find(q => q.id === id.slice(3)); x = st?.x ?? 0; y = st?.y ?? 0; }
      else if (id.startsWith('full:')) {
        const o = fullOffsets[id.slice(5)]; x = o?.x ?? 0; y = o?.y ?? 0;
        cw = root.querySelector<HTMLElement>(`[data-ly="${id}"]`)?.parentElement?.getBoundingClientRect().width ?? rb.width;
      } else return null;
      return { id, x, y, cw };
    }).filter((q): q is NonNullable<typeof q> => !!q);
    groupRef.current = { w: rb.width, h: rb.height, items };
  };
  const moveGroup = (dxPx: number, dyPx: number) => {
    const g = groupRef.current;
    if (!g) return;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    for (const it of g.items) {
      const nx = it.x + (dxPx / g.w) * 100, ny = it.y + (dyPx / g.h) * 100;
      if (it.id === 'info') setUiInfo({ x: r2(nx), y: r2(ny) });
      else if (it.id === 'deco-ghost') setDecoGhost(o => ({ ...o, x: r2(nx), y: r2(ny) }));
      else if (it.id === 'deco-script') setDecoScript(o => (o ? { ...o, x: r2(nx), y: r2(ny) } : o));
      else if (it.id === 'ui:title') setUiTitle({ x: r2(nx), y: r2(ny) });
      else if (it.id.startsWith('ui:name:')) { const cid = it.id.slice(8); setUiNames(sc => ({ ...sc, [cid]: { x: r2(nx), y: r2(ny) } })); }
      else if (it.id.startsWith('st:')) setStickers(list => list.map(st => (st.id === it.id.slice(3) ? { ...st, x: r2(nx), y: r2(ny) } : st)));
      else if (it.id.startsWith('full:')) {
        const cid = it.id.slice(5);
        const fx = it.x + (dxPx / it.cw) * 100, fy = it.y - (dyPx / g.h) * 100;
        setFullOffsets(sc => ({ ...sc, [cid]: { x: Math.max(-1200, Math.min(1200, r2(fx))), y: Math.max(-250, Math.min(250, r2(fy))) } }));
      }
    }
  };
  const grp = (id: string) => ({ onDragStart: () => startGroup(id), onGroup: moveGroup });
  // 눈 버튼으로 숨긴 레이어 · 가운데 정보(INFO·서랍) 위치
  const [hiddenLayers, setHiddenLayers] = useState<string[]>(initLayout?.hidden ?? []);
  const [uiInfo, setUiInfo] = useState<{ x: number; y: number }>(initLayout?.info ?? { x: 0, y: 0 });
  const [badgesOn, setBadgesOn] = useState<boolean>(initLayout?.badgeOff !== true);   // 이름 밑 배지 하위 항목(키워드·기본 정보·컬러) 표시
  // 실행 취소 / 다시 실행 (Ctrl+Z · Shift+Ctrl+Z) — 메인 이미지 레이어의 배치 상태를 잠깐(0.35초) 멈출 때마다 기록한다
  type LySnap = { fullScales: typeof fullScales; fullOffsets: typeof fullOffsets; stickers: typeof stickers; layerOrder: string[];
    uiTitle: { x: number; y: number }; uiNames: typeof uiNames; hiddenLayers: string[]; uiInfo: { x: number; y: number };
    decoGhost: DecoGhost; decoScript: DecoScript | null; badgesOn: boolean };
  const curSnap = (): LySnap => ({ fullScales, fullOffsets, stickers, layerOrder, uiTitle, uiNames, hiddenLayers, uiInfo, decoGhost, decoScript, badgesOn });
  const hist = React.useRef<{ stack: LySnap[]; idx: number; timer: ReturnType<typeof setTimeout> | null }>({ stack: [], idx: -1, timer: null });
  const sameSnap = (a: LySnap, b: LySnap) => (Object.keys(a) as (keyof LySnap)[]).every(k => a[k] === b[k]);
  const commitSnap = (snap: LySnap) => {
    const h = hist.current;
    if (h.timer) { clearTimeout(h.timer); h.timer = null; }
    if (h.idx >= 0 && sameSnap(h.stack[h.idx], snap)) return;
    h.stack = [...h.stack.slice(0, h.idx + 1), snap].slice(-100);
    h.idx = h.stack.length - 1;
  };
  const snapNow = React.useRef<LySnap>(curSnap());
  snapNow.current = curSnap();
  useEffect(() => {
    const h = hist.current;
    if (h.idx < 0) { commitSnap(snapNow.current); return; }
    if (sameSnap(h.stack[h.idx], snapNow.current)) return;
    if (h.timer) clearTimeout(h.timer);
    h.timer = setTimeout(() => commitSnap(snapNow.current), 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScales, fullOffsets, stickers, layerOrder, uiTitle, uiNames, hiddenLayers, uiInfo, decoGhost, decoScript, badgesOn]);
  useEffect(() => () => { if (hist.current.timer) clearTimeout(hist.current.timer); }, []);
  const applySnap = (sn: LySnap) => {
    setFullScales(sn.fullScales); setFullOffsets(sn.fullOffsets); setStickers(sn.stickers); setLayerOrder(sn.layerOrder);
    setUiTitle(sn.uiTitle); setUiNames(sn.uiNames); setHiddenLayers(sn.hiddenLayers); setUiInfo(sn.uiInfo);
    setDecoGhost(sn.decoGhost); setDecoScript(sn.decoScript); setBadgesOn(sn.badgesOn);
  };
  const undoRedo = (redo: boolean) => {
    const h = hist.current;
    commitSnap(snapNow.current);   // 아직 기록 전인 마지막 변경도 한 단계로 남긴다
    const ni = h.idx + (redo ? 1 : -1);
    if (ni < 0 || ni >= h.stack.length) return;
    h.idx = ni;
    applySnap(h.stack[ni]);
  };
  const undoFn = React.useRef(undoRedo);
  undoFn.current = undoRedo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;   // 글자 입력 중에는 브라우저 기본 동작
      e.preventDefault();
      undoFn.current(k === 'y' || e.shiftKey);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const isHid = (id: string) => hiddenLayers.includes(id);
  const toggleHid = (id: string) => setHiddenLayers(h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id]));
  // 그리드 on/off (v5.7 사용자 요청) — 메인 편집모드와 같은 10px 격자. 편집을 열 때마다 꺼진 상태로 시작
  const [gridOn, setGridOn] = useState(false);
  // 전신 앞으로/뒤로(우클릭 메뉴) — 다른 전신 바로 위/아래로 옮긴다
  const moveFull = (cid: string, front: boolean) => setLayerOrder(o => {
    // 다른 전신들 가운데 맨 앞(맨 위) 또는 맨 뒤(맨 아래)로
    const rest = o.filter(x => x !== heroFullId(cid));
    const idx = rest.map((x, k) => (x.startsWith('full:') ? k : -1)).filter(k => k >= 0);
    if (idx.length === 0) return o;
    const at = front ? idx[idx.length - 1] + 1 : idx[0];
    rest.splice(at, 0, heroFullId(cid));
    return rest;
  });
  // 정렬·분포 — 기준(정렬 대상) = 선택 영역 / 주요 개체(마지막으로 Shift+클릭한 항목) / 아트보드(미리보기 전체)
  const [alignTo, setAlignTo] = useState<'sel' | 'key' | 'board'>('sel');
  type AlignKind = 'l' | 'cx' | 'r' | 't' | 'cy' | 'b';
  type DistKind = 'dl' | 'dcx' | 'dr' | 'dt' | 'dcy' | 'db' | 'sh' | 'sv';
  const layoutItems = () => {
    const root = previewRef.current;
    if (!root) return null;
    const rb = root.getBoundingClientRect();
    const ids = multiSel.length ? multiSel : (selLayer ? [selLayer] : []);
    const items = ids.map(id => {
      const el = root.querySelector<HTMLElement>(`[data-ly="${id}"]`);
      return el ? { id, el, r: el.getBoundingClientRect() } : null;
    }).filter((x): x is NonNullable<typeof x> => !!x);
    return { root, rb, items };
  };
  type LyItem = NonNullable<ReturnType<typeof layoutItems>>['items'][number];
  const moveItemBy = (it: LyItem, rb: DOMRect, dx: number, dy: number) => {
    if (!dx && !dy) return;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const px = (dx / rb.width) * 100, py = (dy / rb.height) * 100;
    const id = it.id;
    if (id === 'info') setUiInfo(o => ({ x: r2(o.x + px), y: r2(o.y + py) }));
    else if (id === 'deco-ghost') setDecoGhost(g => ({ ...g, x: r2(g.x + px), y: r2(g.y + py) }));
    else if (id === 'deco-script') setDecoScript(c => (c ? { ...c, x: r2(c.x + px), y: r2(c.y + py) } : c));
    else if (id === 'ui:title') setUiTitle(o => ({ x: r2(o.x + px), y: r2(o.y + py) }));
    else if (id.startsWith('ui:name:')) { const cid = id.slice(8); setUiNames(sc => ({ ...sc, [cid]: { x: r2((sc[cid]?.x ?? 0) + px), y: r2((sc[cid]?.y ?? 0) + py) } })); }
    else if (id.startsWith('st:')) setStickers(list => list.map(st => (st.id === id.slice(3) ? { ...st, x: r2(st.x + px), y: r2(st.y + py) } : st)));
    else if (id.startsWith('full:')) {
      const pr = it.el.parentElement?.getBoundingClientRect();
      if (!pr) return;
      const cid = id.slice(5);
      const fx = (dx / pr.width) * 100, fy = -(dy / pr.height) * 100;
      setFullOffsets(sc => ({ ...sc, [cid]: { x: Math.max(-1200, Math.min(1200, r2((sc[cid]?.x ?? 0) + fx))), y: Math.max(-250, Math.min(250, r2((sc[cid]?.y ?? 0) + fy))) } }));
    }
  };
  // 기준 상자 — 아트보드면 미리보기 전체, 주요 개체면 그 항목, 아니면 선택한 항목 전체의 경계
  const refBox = (L: NonNullable<ReturnType<typeof layoutItems>>) => {
    const { rb, items } = L;
    if (alignTo === 'board') return { left: rb.left, right: rb.right, top: rb.top, bottom: rb.bottom };
    if (alignTo === 'key') {
      const k = items.find(i => i.id === selLayer);
      if (k) return { left: k.r.left, right: k.r.right, top: k.r.top, bottom: k.r.bottom };
    }
    return { left: Math.min(...items.map(i => i.r.left)), right: Math.max(...items.map(i => i.r.right)),
      top: Math.min(...items.map(i => i.r.top)), bottom: Math.max(...items.map(i => i.r.bottom)) };
  };
  const alignSel = (kind: AlignKind) => {
    const L = layoutItems();
    if (!L) return;
    const need = alignTo === 'board' ? 1 : 2;
    if (L.items.length < need) return;
    const ref = refBox(L);
    for (const it of L.items) {
      const { r } = it;
      const dx = kind === 'l' ? ref.left - r.left : kind === 'r' ? ref.right - r.right : kind === 'cx' ? (ref.left + ref.right) / 2 - (r.left + r.right) / 2 : 0;
      const dy = kind === 't' ? ref.top - r.top : kind === 'b' ? ref.bottom - r.bottom : kind === 'cy' ? (ref.top + ref.bottom) / 2 - (r.top + r.bottom) / 2 : 0;
      moveItemBy(it, L.rb, dx, dy);
    }
  };
  // 분포 — 왼쪽/가운데/오른쪽(위/가운데/아래) 기준선을 같은 간격으로, 또는 항목 사이 빈 칸을 같게.
  // 선택 영역·주요 개체 기준이면 양 끝 항목은 그대로 두고, 아트보드 기준이면 양 끝 항목이 아트보드 가장자리에 붙는다
  const distributeSel = (kind: DistKind) => {
    const L = layoutItems();
    if (!L) return;
    const horiz = kind === 'sh' || kind === 'dl' || kind === 'dcx' || kind === 'dr';
    const need = alignTo === 'board' ? 2 : 3;
    if (L.items.length < need) return;
    const lo = (r: DOMRect) => (horiz ? r.left : r.top), hi = (r: DOMRect) => (horiz ? r.right : r.bottom);
    const sorted = [...L.items].sort((a, b) => (lo(a.r) + hi(a.r)) - (lo(b.r) + hi(b.r)));
    const n = sorted.length;
    const board = alignTo === 'board';
    const ext = board ? (horiz ? { lo: L.rb.left, hi: L.rb.right } : { lo: L.rb.top, hi: L.rb.bottom })
      : { lo: Math.min(...sorted.map(i => lo(i.r))), hi: Math.max(...sorted.map(i => hi(i.r))) };
    const size = (it: LyItem) => hi(it.r) - lo(it.r);
    const apply = (it: LyItem, d: number) => moveItemBy(it, L.rb, horiz ? d : 0, horiz ? 0 : d);
    if (kind === 'sh' || kind === 'sv') {
      const free = ext.hi - ext.lo - sorted.reduce((t, i) => t + size(i), 0);
      const gap = free / (n - 1);
      let cur = ext.lo;
      for (const it of sorted) { apply(it, cur - lo(it.r)); cur += size(it) + gap; }
      return;
    }
    // 기준선 위치 = 왼쪽(위)/가운데/오른쪽(아래) 가장자리
    const mode = kind === 'dl' || kind === 'dt' ? 0 : kind === 'dcx' || kind === 'dcy' ? 1 : 2;
    const pos = (it: LyItem) => (mode === 0 ? lo(it.r) : mode === 1 ? (lo(it.r) + hi(it.r)) / 2 : hi(it.r));
    const first = sorted[0], last = sorted[n - 1];
    const pFirst = board ? (mode === 0 ? ext.lo : mode === 1 ? ext.lo + size(first) / 2 : ext.lo + size(first)) : pos(first);
    const pLast = board ? (mode === 0 ? ext.hi - size(last) : mode === 1 ? ext.hi - size(last) / 2 : ext.hi) : pos(last);
    sorted.forEach((it, i) => apply(it, pFirst + ((pLast - pFirst) * i) / (n - 1) - pos(it)));
  };
  const patchSticker = (id: string, p: Partial<StickerDraft>) =>
    setStickers(list => list.map(s => (s.id === id ? { ...s, ...p } : s)));
  const addStickers = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const items: StickerDraft[] = files.map((f, i) => ({
      id: newId(), file: f, url: URL.createObjectURL(f), x: 50 + i * 4, y: 50 + i * 4, w: 18,
    }));
    setStickers(prev => [...prev, ...items]);
    setLayerOrder(o => [...o, ...items.map(it => heroStickerId(it.id))]);
    setSelLayer(heroStickerId(items[0].id));
  };
  const removeSticker = (id: string) => {
    setStickers(list => list.filter(s => s.id !== id));
    setLayerOrder(o => o.filter(x => x !== heroStickerId(id)));
    setSelLayer(cur => (cur === heroStickerId(id) ? null : cur));
  };

  // 내 캐릭터 연동 목록 — 선택된 캐릭터는 항상 표시, 나머지는 검색 필터 후 총 6명까지
  const q = charQuery.trim().toLowerCase();
  const pickedChars = myChars.filter(c => picked.includes(c.id));
  const restChars = myChars.filter(c =>
    !picked.includes(c.id) && (!q || c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)));
  const shownChars = [...pickedChars, ...restChars].slice(0, Math.max(6, pickedChars.length));
  const hiddenCount = pickedChars.length + restChars.length - shownChars.length;

  const maxPick = kind === 'pair' ? 2 : 6;

  const togglePick = (id: string, v: boolean) => {
    setPicked(list => {
      if (!v) return list.filter(x => x !== id);
      if (list.length >= maxPick) {
        toast(kind === 'pair' ? '페어는 최대 2명까지 연동할 수 있습니다' : '다인관은 최대 6명까지입니다 (4.5)');
        return list;
      }
      return [...list, id];
    });
  };

  const addArts = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const items = Array.from(list).map(f => ({ id: newId(), url: URL.createObjectURL(f), file: f }));
    setArts(prev => {
      if (prev.length === 0) { setThumbCrop(undefined); setCropOpen(true); } // 첫 장 → 썸네일 크롭 (6.1)
      return [...prev, ...items];
    });
  };

  const save = async (go?: 'gallery' | 'rp') => {
    if (!name.trim()) { toast('자관 이름을 입력해 주세요'); return; }
    // 페이지 주소 (v1.9 / 수정도 가능 v2.0) — 유효성·중복 검사
    if (slug && slug !== (initial?.slug ?? '')) {
      if (!isValidSlug(slug)) { toast('주소는 영문 소문자·숫자·하이픈만 쓸 수 있습니다'); return; }
      if (existingIds?.includes(slug)) { toast('이미 사용 중인 주소입니다 — 다른 주소를 입력해 주세요'); return; }
    }
    const artIds = await Promise.all(arts.map(a => (a.file ? putBlob(a.file) : Promise.resolve(a.ref!))));
    // 스티커 이미지 저장 + 레이어 순서 정리 (v5.6)
    const stickerSaved = await Promise.all(stickers.map(async s => ({
      id: s.id, ref: s.file ? await putBlob(s.file) : s.ref!, x: s.x, y: s.y, w: s.w,
    })));
    const orderSaved = heroOrder({ order: layerOrder, stickers: stickerSaved }, pairMembers.map(m => m.charId), initFullFront);
    // 맨 위 전신 = 예전 화면(모바일 등)이 읽는 「앞 캐릭터」
    const topFull = [...orderSaved].reverse().find(id => id.startsWith('full:'))?.slice(5);
    onSave({
      // 수정에서 정한 주소는 별명으로 (v2.0) — 신규는 rels/new가 이 값을 id로 쓴다
      slug: slug.trim() || undefined,
      name: name.trim().toUpperCase(),
      catchphrase: catchphrase.trim(),
      kind, visibility, fontId, bodyFontId,
      arts: artIds,
      thumbCrop,
      headerImgId: headerFile ? await putBlob(headerFile) : (headerRemoved ? undefined : initHeaderId),
      headerCrop: (headerRemoved || headerFile) ? undefined : initHeaderCrop,
      headerBlur,
      headerRemoved,
      themeFollow,
      illuBg: illuCustom ? illuBg : undefined,
      illuOn: illuCustom ? illuOn : undefined,
      nameColor: txtCustom ? nameColor : undefined,
      cpColor: txtCustom ? cpColor : undefined,
      nameShadowColor: shadowCustom ? nameShadowColor : undefined,
      nameShadow: shadowCustom ? nameShadow : undefined,
      headerBgG1: headerBgCustom ? headerBgG1 : undefined,
      headerBgG2: headerBgCustom ? headerBgG2 : undefined,
      headerBgAngle: headerBgCustom ? headerBgAngle : undefined,
      pageBgG1: pageBgCustom ? pageBgG1 : undefined,
      pageBgG2: pageBgCustom ? pageBgG2 : undefined,
      pageBgAngle: pageBgCustom ? pageBgAngle : undefined,
      cpTagBg: tagCustom ? cpTagBg : undefined,
      cpTagFg: tagCustom ? cpTagFg : undefined,
      themeMode,
      themeColor: themeMode === 'custom' ? themeColor : undefined,
      themeTone: themeMode === 'custom' ? themeTone : undefined,
      cp,
      auName: auObj ? auName.trim() : undefined,
      auGalleryTags: auObj ? auGalleryTags : undefined,
      qaHide: qaHide || undefined,
      linkBoard: linkBoard === 'session' ? 'session' : undefined,
      bgm: bgm && bgm.playlists.length ? bgm : undefined,
      detailLayout: detailLayout === 'classic' ? 'classic' : undefined,
      deco: deco === 'on' ? undefined : 'off',
      decoBg: decoBg === 'full' ? undefined : 'band',
      decoFontId: decoFontId || undefined,
      decoGhost: decoGhost.x === DEFAULT_DECO_GHOST.x && decoGhost.y === DEFAULT_DECO_GHOST.y && decoGhost.scale === DEFAULT_DECO_GHOST.scale && !decoGhost.color && (decoGhost.opacity == null || decoGhost.opacity === 100) ? undefined : decoGhost,
      decoScript: decoScript ? { ...decoScript, text: decoScript.text?.trim() || undefined, fontId: decoScript.fontId || undefined, color: decoScript.color || undefined } : undefined,
      leftBoard: leftBoard === 'gallery' ? 'gallery' : undefined,
      memberOrder: !isNew && !auId && isMultiRel ? memberOrder : undefined,
      fulls: pairMembers.length
        ? Object.fromEntries(await Promise.all(pairMembers.map(async m => {
          const d = fulls[m.charId];
          return [m.charId, d ? (d.file ? await putBlob(d.file) : d.ref) : undefined] as const;
        })))
        : undefined,
      fullScales: pairMembers.length ? fullScales : undefined,
      fullOffsets: pairMembers.length ? fullOffsets : undefined,
      quotes: pairMembers.length ? quotes : undefined,
      nameSizes: pairMembers.length ? nameSizes : undefined,
      nameBolds: pairMembers.length ? nameBolds : undefined,
      heroNameSizes: pairMembers.length
        ? Object.fromEntries(Object.entries(heroNameSizes).filter(([, n]) => n !== undefined) as [string, number][]) : undefined,
      badgeAligns: pairMembers.length ? badgeAligns : undefined,
      badgeTextAligns: pairMembers.length ? (badgeTextAligns as Record<string, 'left' | 'center' | 'right'>) : undefined,
      titleSize,
      quoteColors: pairMembers.length ? quoteColors : undefined,
      fullFront: topFull ?? initFullFront,
      heroLayout: pairMembers.length
        ? { order: orderSaved, stickers: stickerSaved, title: uiTitle, names: uiNames,
          info: uiInfo.x || uiInfo.y ? uiInfo : undefined,
          hidden: hiddenLayers.length ? hiddenLayers : undefined,
          badgeOff: badgesOn ? undefined : true } : undefined,
      pickedCharIds: picked,
    }, go === 'gallery' && initial ? `/rels/${encodeURIComponent(slug.trim() || initial.slug || initial.id)}/gallery` : go === 'rp' ? '/rp' : undefined);
  };

  return (
    <div className="write-grid">
      {/* 좌: 유형 · 내 캐릭터 연동(등록 시) · 아트 */}
      <div className="panel" style={{ padding: 24, display: 'grid', gap: 14, alignContent: 'start' }}>
        <div>
          <label className="k-label">유형</label>
          {isNew ? (
            <div className="mini-seg">
              <button className={kind === 'pair' ? 'on' : ''} onClick={() => { setKind('pair'); setPicked(p => p.slice(0, 2)); }}>
                페어 (2인)
              </button>
              <button className={kind === 'multi' ? 'on' : ''} onClick={() => setKind('multi')}>
                다인관 (3인 이상)
              </button>
            </div>
          ) : (
            /* 등록 후에는 유형 변경 불가 (v1.9) — 레이아웃·데이터 구조가 달라 전환 시 애매해짐 */
            <span className="pill dark">{kind === 'pair' ? '페어 (2인)' : '다인관 (3인 이상)'}</span>
          )}
          <p className="hint">
            {kind === 'pair'
              ? '좌/우 카드 + 중앙 일러(전신 겹침/일러 1장) 레이아웃'
              : '멤버 리스트형 레이아웃 · 최대 6인 (4.5)'}
          </p>
        </div>

        {isNew && (
          <div>
            <label className="k-label">내 캐릭터 연동 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— {picked.length}/{maxPick}명 선택</span></label>
            {myChars.length > 6 && (
              <KInput placeholder="캐릭터 검색" value={charQuery} onChange={e => setCharQuery(e.target.value)}
                style={{ marginBottom: 8 }} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {shownChars.map(c => (
                <div key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    border: `1.5px solid ${picked.includes(c.id) ? 'var(--accent)' : 'var(--line)'}`,
                    borderRadius: 8, transition: '.15s',
                  }}>
                  <KCheck checked={picked.includes(c.id)} onChange={v => togglePick(c.id, v)}
                    label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <i style={{ width: 11, height: 11, borderRadius: '50%', background: c.color, fontStyle: 'normal' }} />
                      <b style={{ fontSize: 12.5 }}>{c.name}</b>
                      <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{c.sub}</small>
                    </span>} />
                </div>
              ))}
              {myChars.length === 0 && <p className="hint">등록된 캐릭터가 없습니다 — 캐릭터를 먼저 등록해 주세요</p>}
              {myChars.length > 0 && shownChars.length === 0 && <p className="hint">검색 결과가 없습니다</p>}
            </div>
            {hiddenCount > 0 && <p className="hint" style={{ marginTop: 6 }}>외 {hiddenCount}명 — 검색으로 찾아 주세요</p>}
            <p className="hint">상대(타인) 캐릭터는 자관 상세에서 [＋ 멤버 추가]로 등록합니다</p>
          </div>
        )}

        {/* 아트 다중 등록 — 첫 장 = 대표 · 리스트 썸네일(4:3 크롭) */}
        <label className="k-label" style={{ margin: 0 }}>
          {auObj ? `아트 — ${auObj.label} AU 일러` : '아트'} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>
            {auObj ? '— 이 AU를 선택했을 때의 중앙 일러' : '— 첫 장이 대표 · 리스트 썸네일은 첫 장에서 4:3 크롭 · 상세 일러스트 모드에서 넘겨보기'}</span>
        </label>
        {arts.length > 0 && (
          <DragList items={arts} keyOf={a => a.id} onReorder={setArts}
            render={(a, i) => (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', padding: '3px 0' }}>
                <span className="drag-h">⠿</span>
                <div data-tip="클릭하면 원본 보기" onClick={() => setLb(i)}
                  style={{ width: 84, aspectRatio: '4/3', borderRadius: 7, overflow: 'hidden', position: 'relative', flexShrink: 0, cursor: 'zoom-in' }}>
                  <ArtThumb item={a} crop={i === 0 ? thumbCrop : undefined} />
                </div>
                {i === 0 ? (
                  <>
                    <span className="pill dark">대표 · 썸네일</span>
                    {/* 옆의 「대표 · 썸네일」 뱃지와 세로 크기 통일 (23px) */}
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5, lineHeight: '13px' }}
                      onClick={() => setCropOpen(true)}>✂ 썸네일 크롭</button>
                  </>
                ) : (
                  <span className="pill">추가 아트</span>
                )}
                <span className="fx" style={{ marginLeft: 'auto' }}
                  onClick={() => del.ask('이 아트를 삭제하시겠습니까?', () => setArts(l => l.filter(x => x.id !== a.id)))}>✕</span>
              </div>
            )} />
        )}
        <input id="relArtsF" type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { addArts(e.target.files); e.target.value = ''; }} />
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, justifySelf: 'center' }}
          onClick={() => document.getElementById('relArtsF')?.click()}
          {...fileDrop(fl => addArts(fl))}>
          ＋ ADD ART {arts.length === 0 && '(첫 장 등록 시 썸네일 크롭 지정)'}
        </button>

        {/* 캐릭터 추가 — 스테이지에서 멤버 추가 버튼이 없어져 여기서 한다. 누르면 바로 저장된다 */}
        {!isNew && onAddMember && (
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, justifySelf: 'center' }}
            onClick={() => setMemberOpen(true)}>
            ＋ ADD CHARACTER
          </button>
        )}

        {/* 전신 이미지 (v1.9) — 페어 좌/우 캐릭터, 미리보기에서 드래그=크기 · 클릭=앞으로 */}
        {pairMembers.length > 0 && (
          <>
            <label className="k-label" style={{ margin: 0 }}>
              {auObj ? `전신 이미지 — ${auObj.label} AU` : '전신 이미지'} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>
                — 중앙 전신 모드의 좌/우 · 미리보기에서 드래그=크기, 클릭=앞으로</span>
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {pairMembers.map(m => {
                const d = fulls[m.charId];
                const nm = memberNames?.[m.charId] ?? m.charId;
                return (
                  <div key={m.charId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <b style={{ fontSize: 12 }}>{nm}</b>
                    <label className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5, cursor: 'var(--cur-pointer,pointer)' }}
                      {...fileDrop(fl => { const f = fl[0]; if (f) setFulls(o => ({ ...o, [m.charId]: { file: f, url: URL.createObjectURL(f) } })); })}>
                      {d ? '교체' : '↑ 업로드'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0]; e.target.value = '';
                          if (f) setFulls(o => ({ ...o, [m.charId]: { file: f, url: URL.createObjectURL(f) } }));
                        }} />
                    </label>
                    {d && (
                      <span className="fx" onClick={() => del.ask(`${nm}의 전신 이미지를 삭제하시겠습니까?`, () => setFulls(o => {
                        const n = { ...o }; delete n[m.charId]; return n;
                      }))}>✕</span>
                    )}
                  </div>
                );
              })}
            </div>
            {Object.keys(fulls).length > 0 && (() => {
              /* 실제 상세 화면(.rel-center-full)과 같은 가로:세로 비·같은 배치 — 여기서 잡은 위치·크기가
                 상세 그대로 (v5.2). v5.6: 전신뿐 아니라 제목·이름·배지·스티커도 이 위에서 끌어 배치하고,
                 앞뒤는 아래 「메인 이미지 · 레이어」 목록의 순서가 정한다. 값은 모두 상자 대비 %.
                 글자 크기·제목 자리는 지금 창 크기(vp) 기준 px를 상자 폭 비율(cqw)로 바꿔 상세와 같게 맞춘다 */
              const heroH = Math.max(1, vp.h - 58);
              const topPct = vp.w <= 960 ? 0 : (58 / vp.h) * 100;   // 위 메뉴가 차지하는 비율
              // 격자 한 칸 = 실제 상세 화면의 20px (상자 대비 %). 가로는 히어로 폭, 세로는 히어로 높이 기준
              const gcx = (20 / vp.w) * 100;
              const gcy = (20 / heroH) * 100;
              const g2 = (v: number) => Math.round(v * 100) / 100;
              // 전신 한 칸은 히어로 폭의 44%(왼쪽은 0~44%, 오른쪽은 56~100%) — 이미지 가운데 x와 바닥 y를 격자에 맞춘다
              const nCols = pairMembers.length;
              const fullSnap = (i: number) => (q: { x: number; y: number }) => {
                const cw = heroCol(i, nCols);
                const abs = Math.round((cw.c + (cw.w / 100) * q.x) / gcx) * gcx;
                return { x: g2((abs - cw.c) / (cw.w / 100)), y: g2(100 - Math.round((100 - q.y) / gcy) * gcy) };
              };
              const titleTop = ((heroH - 290) / heroH) * 100;          // 상세 .pair-name: 히어로 높이 − 290px
              const cq = (px: number) => `${(px / vp.w) * 100}cqw`;
              const uiZ = heroZ(layerOrder, HERO_UI_ID);
              const uiSel = selLayer === HERO_UI_ID;
              const shadowCss = '0 3px 12px rgba(0,0,0,.5)';
              const pillCss = (px: number): React.CSSProperties => ({
                fontSize: cq(px), padding: `${cq(px * 0.25)} ${cq(px * 0.8)}`, borderRadius: 999,
                background: 'rgba(255,255,255,.16)', color: '#fff', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap',
              });
              return (
              <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <span className="hint" style={{ margin: 0 }}>{multiSel.length >= 2 ? `${multiSel.length}개 선택됨` : 'Shift+클릭으로 여러 개 선택'}</span>
                {(() => {
                  const selN = multiSel.length || (selLayer ? 1 : 0);
                  const okA = selN >= (alignTo === 'board' ? 1 : 2);
                  const okD = selN >= (alignTo === 'board' ? 2 : 3);
                  const grpStyle = (ok: boolean): React.CSSProperties => ({ display: 'flex', gap: 2, opacity: ok ? 1 : .4, pointerEvents: ok ? 'auto' : 'none' });
                  const btn = (k: string, t: string, d: string, fn: () => void) => (
                    <button key={k} type="button" className="btn btn-ghost" title={t} aria-label={t} onClick={fn}
                      style={{ width: 28, height: 28, padding: 0, display: 'grid', placeItems: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4"><path d={d} /></svg>
                    </button>
                  );
                  return (
                    <>
                      <KSelect value={alignTo} onChange={v => setAlignTo(v as 'sel' | 'key' | 'board')} minWidth={116}
                        options={[{ value: 'sel', label: '정렬: 선택 영역' }, { value: 'key', label: '정렬: 주요 개체' }, { value: 'board', label: '정렬: 아트보드' }]} />
                      <div style={grpStyle(okA)}>
                        {btn('l', '왼쪽 맞춤', 'M3 2v16 M6 5h11v4H6z M6 11h7v4H6z', () => alignSel('l'))}
                        {btn('cx', '가로 가운데 맞춤', 'M10 2v16 M4 5h12v4H4z M6 11h8v4H6z', () => alignSel('cx'))}
                        {btn('r', '오른쪽 맞춤', 'M17 2v16 M3 5h11v4H3z M7 11h7v4H7z', () => alignSel('r'))}
                        {btn('t', '위쪽 맞춤', 'M2 3h16 M5 6v11h4V6z M11 6v7h4V6z', () => alignSel('t'))}
                        {btn('cy', '세로 가운데 맞춤', 'M2 10h16 M5 4v12h4V4z M11 6v8h4V6z', () => alignSel('cy'))}
                        {btn('b', '아래쪽 맞춤', 'M2 17h16 M5 3v11h4V3z M11 7v7h4V7z', () => alignSel('b'))}
                      </div>
                      <div style={grpStyle(okD)}>
                        {btn('dt', '위쪽 분포', 'M2 3h16 M2 10h16 M2 17h16 M6 5h8v3H6z M6 12h8v3H6z', () => distributeSel('dt'))}
                        {btn('dcy', '세로 가운데 분포', 'M2 3h16 M2 10h16 M2 17h16', () => distributeSel('dcy'))}
                        {btn('db', '아래쪽 분포', 'M2 3h16 M2 10h16 M2 17h16 M6 5h8v3H6z M6 12h8v3H6z', () => distributeSel('db'))}
                        {btn('dl', '왼쪽 분포', 'M3 2v16 M10 2v16 M17 2v16 M5 6h3v8H5z M12 6h3v8h-3z', () => distributeSel('dl'))}
                        {btn('dcx', '가로 가운데 분포', 'M3 2v16 M10 2v16 M17 2v16', () => distributeSel('dcx'))}
                        {btn('dr', '오른쪽 분포', 'M3 2v16 M10 2v16 M17 2v16 M5 6h3v8H5z M12 6h3v8h-3z', () => distributeSel('dr'))}
                        {btn('sh', '가로 간격 균등 분포', 'M2 3v14 M18 3v14 M6 6h3v8H6z M11 6h3v8h-3z', () => distributeSel('sh'))}
                        {btn('sv', '세로 간격 균등 분포', 'M3 2h14 M3 18h14 M6 6h8v3H6z M6 11h8v3H6z', () => distributeSel('sv'))}
                      </div>
                    </>
                  );
                })()}
                <KToggle label="그리드" checked={gridOn} onChange={setGridOn} />
                <span className="hint" style={{ margin: 0 }}>{gridOn ? '20px 격자에 맞춰 배치됩니다' : '꺼짐 — 자유 배치'}</span>
              </div>
              {/* 미리보기 = 실제 화면 전체(위 메뉴 58px 포함). 히어로 상자는 그 메뉴 밑에서 시작한다 — 실제 스테이지처럼 상단에 그만큼 여유가 있다 */}
              <div style={{
                position: 'relative', width: `min(100%, calc(70vh * ${topPct > 0 ? vp.w / vp.h : heroRatio}))`, margin: '0 auto',
                aspectRatio: `${topPct > 0 ? vp.w / vp.h : heroRatio}`, borderRadius: 10, overflow: 'hidden',
                background: 'linear-gradient(180deg,#262b33,#181b20)', border: '1px solid var(--line)',
              } as React.CSSProperties}>
              {topPct > 0 && (
                <div aria-hidden style={{
                  position: 'absolute', left: 0, right: 0, top: 0, height: `${topPct}%`, pointerEvents: 'none',
                  background: 'rgba(255,255,255,.05)', borderBottom: '1px dashed rgba(255,255,255,.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2%',
                  fontSize: 'clamp(6px, 0.9vw, 11px)', letterSpacing: '.3em', color: 'rgba(255,255,255,.35)', fontWeight: 700,
                }}><span>SISPI</span><span>MENU</span></div>
              )}
              <div ref={previewRef} onPointerDown={() => { setSelLayer(null); setMultiSel([]); }} style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, top: `${topPct}%`, overflow: 'visible',   // 위 메뉴 칸까지 올라간 그림(머리 등)도 잘리지 않게 — 바깥 상자가 화면 가장자리에서 자른다
               
                containerType: 'inline-size',
              } as React.CSSProperties}>
                {pairMembers.map((m, i) => (
                  <div key={m.charId} style={{
                    position: 'absolute', width: `${heroCol(i, nCols).w}%`, height: '100%', bottom: 0, pointerEvents: 'none',
                    left: `${heroCol(i, nCols).left}%`,
                    zIndex: heroZ(layerOrder, heroFullId(m.charId)),
                    visibility: isHid(heroFullId(m.charId)) ? 'hidden' : undefined,
                  }}>
                    <FullPrevImg draft={fulls[m.charId]}
                        scale={fullScales[m.charId] ?? 90}
                        offX={fullOffsets[m.charId]?.x ?? 0}
                        offY={fullOffsets[m.charId]?.y ?? 0}
                        name={memberNames?.[m.charId] ?? m.charId}
                        shadow={fullShadow(shadowCustom ? nameShadowColor : undefined,
                          shadowCustom ? nameShadow : undefined, '0 6px 14px')}
                        selected={isSel(heroFullId(m.charId))} ly={heroFullId(m.charId)} {...grp(heroFullId(m.charId))}
                        onSelect={sh => pickLayer(heroFullId(m.charId), sh)}
                        snap={gridOn ? fullSnap(i) : undefined}
                        scaleStep={gridOn ? g2(gcy) : undefined}
                        onScale={v => setFullScales(sc => ({ ...sc, [m.charId]: v }))}
                        onOffset={(x, y) => setFullOffsets(sc => ({ ...sc, [m.charId]: { x, y } }))}
                        onLayer={front => moveFull(m.charId, front)} />
                  </div>
                ))}

                {stickers.filter(st2 => !isHid(heroStickerId(st2.id))).map(st2 => (
                  <StickerPrev key={st2.id} s={st2} rootRef={previewRef}
                    z={heroZ(layerOrder, heroStickerId(st2.id))}
                    grid={gridOn ? { cx: gcx, cy: gcy } : undefined}
                    selected={isSel(heroStickerId(st2.id))} {...grp(heroStickerId(st2.id))}
                    onSelect={sh => pickLayer(heroStickerId(st2.id), sh)}
                    onChange={p => patchSticker(st2.id, p)} />
                ))}

                {/* 장식 사각형(뒤쪽 큰 판) — 스테이지와 같은 자리에 흐리게. 눈 버튼으로 켜고 끈다 (자리는 고정) */}
                {detailLayout === 'stage' && deco === 'on' && !isHid('tile') && (() => {
                  const sc = Math.max(vp.w / 1920, vp.h / 1080);
                  const ox = (vp.w - 1920 * sc) / 2, oy = (vp.h - 1080 * sc) / 2;
                  const x0 = ox + 636 * sc, x1 = ox + 1272 * sc, y0 = oy + 150 * sc - 58, y1 = oy + 790 * sc - 58;
                  return <div aria-hidden style={{
                    position: 'absolute', zIndex: 1, pointerEvents: 'none',
                    left: `${(x0 / vp.w) * 100}%`, top: `${(y0 / heroH) * 100}%`,
                    width: `${((x1 - x0) / vp.w) * 100}%`, height: `${((y1 - y0) / heroH) * 100}%`,
                    borderRadius: `${cq(290 * sc)} 0 0 0`, opacity: .55,
                    background: `linear-gradient(160deg, color-mix(in srgb, ${themeMode === 'custom' ? themeColor : '#7fd6d0'} 70%, #fff), color-mix(in srgb, ${themeMode === 'custom' ? themeColor : '#7fd6d0'} 88%, #000))`,
                  }} />;
                })()}

                {/* 가운데 정보(INFO · 자관 이름 · 서랍 바로가기) — 끌어서 위치를 옮긴다 (스테이지 구성일 때) */}
                {detailLayout === 'stage' && !isHid('info') && (() => {
                  const wMax = Math.min(0.3 * vp.w, 400);
                  const pairTxt = `[ ${pairMembers.map(m => memberNames?.[m.charId] ?? m.charId).join(' × ')} ]`;
                  const mtPx = Math.min(24, Math.max(11, wMax / (emWidth(pairTxt) + 1)));
                  const wPx = Math.min(wMax, emWidth(pairTxt) * mtPx);   // 서랍 바로가기는 자관 이름 줄 폭에 맞춘다
                  const infoTop = ((0.46 * vp.h - 58) / heroH) * 100;
                  return (
                    <PrevDrag ly="info" {...grp('info')} rootRef={previewRef} x={uiInfo.x} y={uiInfo.y} selected={isSel('info')}
                      grid={gridOn ? { ax: 50, ay: infoTop, cx: gcx, cy: gcy } : undefined}
                      onSelect={sh => pickLayer('info', sh)} onChange={(x, y) => setUiInfo({ x, y })}
                      style={{
                        left: `${50 + uiInfo.x}%`, top: `${infoTop + uiInfo.y}%`, transform: 'translateX(-50%)', width: 'max-content', maxWidth: cq(wMax), zIndex: 300,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: cq(8), color: '#fff', textAlign: 'center',
                        background: 'rgba(0,0,0,.18)', borderRadius: cq(6),
                      }}>
                      {/* 실제 스테이지의 INFO와 같은 구성·간격 — INFO. · PAIR/GROUP 꼬리표 · 자관 이름 · (캐치프레이즈) · 서랍 바로가기 */}
                      <small style={{ fontSize: cq(9), letterSpacing: '.34em', fontWeight: 800, opacity: .7 }}>INFO.</small>
                      <b style={{ fontSize: cq(10), letterSpacing: '.14em' }}>{cp ? `${pairMembers.length > 2 ? 'GROUP' : 'PAIR'} · ${CP_LABEL[cp]}` : (pairMembers.length > 2 ? 'GROUP' : 'PAIR')}</b>
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: cq(mtPx), fontWeight: 800, whiteSpace: 'nowrap' }}>{pairTxt}</div>
                        {catchphrase.trim() && <p style={{ margin: 0, fontSize: cq(clampN(vp.w * 0.0085, 10, 12)), lineHeight: 1.8, letterSpacing: '.1em', opacity: .8 }}>{catchphrase.trim()}</p>}
                        <div style={{ width: '100%', display: 'grid', marginTop: cq(8) }}>
                          {['TIMELINE', 'SESSION BOARD', 'GALLERY'].map(t => (
                            <div key={t} style={{ fontSize: cq(10.5), fontWeight: 800, letterSpacing: '.16em', textAlign: 'left', padding: `${cq(6)} ${cq(2)}`, borderBottom: '1px solid rgba(255,255,255,.28)' }}>{t}</div>
                          ))}
                        </div>
                      </div>
                    </PrevDrag>
                  );
                })()}

                {/* 스테이지의 큰 자관명 · 필기체 — 끌어서 위치를 옮긴다 (스테이지 구성 · 배경 장식 켬일 때만). 전신보다 뒤에 놓인다 */}
                {detailLayout === 'stage' && deco === 'on' && (() => {
                  const bigName = (auObj ? auName.trim() : '') || name.trim().toUpperCase() || 'TITLE';
                  const gsel = isSel('deco-ghost'), ssel = isSel('deco-script');
                  const spTxt = decoScript?.text?.trim() || bigName;
                  return (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
                      {!isHid('ghost') && <PrevDrag ly="deco-ghost" {...grp('deco-ghost')} rootRef={previewRef} x={decoGhost.x} y={decoGhost.y} min={-20} max={120} selected={gsel}
                        grid={gridOn ? { ax: 0, ay: 0, cx: gcx, cy: gcy } : undefined}
                        onWheel={dir => setDecoGhost(g => ({ ...g, scale: clampN(g.scale - dir * 5, 30, 200) }))}
                        onSelect={sh => pickLayer('deco-ghost', sh)} onChange={(x, y) => setDecoGhost({ ...decoGhost, x, y })}
                        style={{
                          left: `${decoGhost.x}%`, top: `${decoGhost.y}%`, transform: 'translate(-50%,-50%)', width: 'max-content',
                          textAlign: 'center', whiteSpace: 'nowrap', color: decoGhost.color || 'rgba(255,255,255,.55)', opacity: decoGhost.opacity != null ? decoGhost.opacity / 100 : undefined, fontWeight: 800, lineHeight: 0.9,
                          letterSpacing: '-.025em', fontFamily: deVarFamily(familyOf(decoFontId || fontId) ?? ''),
                          fontSize: cq(relTitlePx(bigName, vp.w, heroH, decoGhost.scale)),
                        }}>
                        {relTitleLines(bigName).map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
                      </PrevDrag>}
                      {decoScript && !isHid('script') && (
                        <PrevDrag ly="deco-script" {...grp('deco-script')} rootRef={previewRef} x={decoScript.x} y={decoScript.y} min={-20} max={120} selected={ssel}
                          onWheel={dir => setDecoScript(c => (c ? { ...c, size: clampN(c.size - dir, 6, 50) } : c))}
                          onSelect={sh => pickLayer('deco-script', sh)} onChange={(x, y) => setDecoScript({ ...decoScript, x, y })}
                          style={{
                            left: `${decoScript.x}%`, top: `${decoScript.y}%`, transform: `translate(-50%,-50%) rotate(${decoScript.rot}deg)`,
                            whiteSpace: 'nowrap', lineHeight: 1.1, color: decoScript.color || (themeMode === 'custom' ? themeColor : '#7fd6d0'),
                            fontFamily: deVarFamily(familyOf(decoScript.fontId || fontId) ?? ''),
                            fontSize: cq(decoScript.size * heroH / 100), filter: decoScript.blur ? `blur(${cq(decoScript.blur)})` : undefined,
                          }}>{spTxt}</PrevDrag>
                      )}
                    </div>
                  );
                })()}

                {/* 글자 묶음(제목 · 이름 · 배지) — 레이어 목록의 「UI」 한 칸. 끌어서 기본 자리에서 옮긴다 */}
                <div style={{ position: 'absolute', inset: 0, zIndex: uiZ, pointerEvents: 'none', display: isHid(HERO_UI_ID) ? 'none' : undefined }}>
                  {detailLayout !== 'stage' && (
                  <PrevDrag ly="ui:title" {...grp('ui:title')} rootRef={previewRef} x={uiTitle.x} y={uiTitle.y} selected={uiSel || isSel('ui:title')}
                    grid={gridOn ? { ax: 50, ay: titleTop, cx: gcx, cy: gcy } : undefined}
                    onSelect={sh => pickLayer('ui:title', sh)} onChange={(x, y) => setUiTitle({ x, y })}
                    style={{
                      left: `${50 + uiTitle.x}%`, top: `${titleTop + uiTitle.y}%`, transform: 'translateX(-50%)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: cq(6),
                      color: '#fff', fontWeight: 800, textShadow: shadowCss, whiteSpace: 'nowrap',
                      fontFamily: familyOf(fontId),
                      fontSize: cq(titleSize ?? clampN(vp.w * 0.02, 16, 22)),
                    }}>
                    {cp && <span style={{ ...pillCss(10), ...(tagCustom ? { background: cpTagBg, color: cpTagFg } : {}) }}>{CP_LABEL[cp]}</span>}
                    <div>{(auObj ? auName.trim() : '') || name.trim().toUpperCase() || 'TITLE'}</div>
                    {/* AU 줄 (v5.9) — 상세 화면처럼 제목 묶음에 붙어 있다: 제목을 끌면 같이 움직인다.
                        기본 자리는 제목 위에서 100px 아래(상세와 같은 값) */}
                    <div style={{
                      position: 'absolute', top: cq(100), left: '50%', transform: 'translateX(-50%)',
                      display: 'flex', gap: cq(8), alignItems: 'flex-start',
                    }}>
                      {(initial?.aus?.length ? initial.aus : [{ id: 'base', label: 'BASE' }]).map((a, i) => (
                        <div key={a.id} style={{
                          width: cq(48), aspectRatio: '1', borderRadius: cq(11), position: 'relative', overflow: 'hidden',
                          border: `${cq(2)} solid ${(auObj ? auObj.id === a.id : i === 0) ? '#fff' : 'rgba(255,255,255,.25)'}`,
                          background: 'rgba(255,255,255,.12)',
                        }}>
                          <small style={{ position: 'absolute', left: 0, right: 0, bottom: cq(2), textAlign: 'center',
                            fontSize: cq(8), letterSpacing: '.08em', fontWeight: 400 }}>{a.label}</small>
                        </div>
                      ))}
                      <div style={{
                        width: cq(48), aspectRatio: '1', borderRadius: cq(11), display: 'grid', placeItems: 'center',
                        border: `${cq(2)} dashed rgba(255,255,255,.25)`, background: 'rgba(255,255,255,.06)',
                        fontSize: cq(16), fontWeight: 400, color: 'rgba(255,255,255,.75)',
                      }}>＋</div>
                    </div>
                  </PrevDrag>
                  )}

                  {pairMembers.map((m, i) => {
                    if (!fulls[m.charId]) return null;
                    const o = uiNames[m.charId] ?? { x: 0, y: 0 };
                    const al = badgeAligns[m.charId] ?? 'top';
                    const left = i === 0 || nCols > 2;
                    const colN = heroCol(i, nCols);
                    const ta = badgeTextAligns[m.charId] ?? (left ? 'left' : 'right');
                    const fs = heroNameFs(memberNames?.[m.charId] ?? m.charId,
                      heroNameSizes[m.charId] ?? clampN(vp.w * 0.034, 20, 40) * (nCols > 2 ? 0.8 : 1), (colN.w / 100) * vp.w);
                    const ch = myChars.find(c => c.id === m.charId);
                    const specPills = (ch?.specs ?? []).filter(isPlainSpec);
                    const gems = ch?.colors ?? m.palette ?? [];
                    return (
                      <PrevDrag key={m.charId} ly={`ui:name:${m.charId}`} {...grp(`ui:name:${m.charId}`)} rootRef={previewRef} x={o.x} y={o.y} selected={uiSel || isSel(`ui:name:${m.charId}`)}
                        grid={gridOn ? {
                          // 기준점 = 왼쪽 이름은 왼쪽 가장자리, 오른쪽 이름은 오른쪽 가장자리 / 위·가운데·아래 정렬에 따라 y
                          ax: left ? colN.left + colN.w * 0.06 : 97.36,
                          ay: al === 'bottom' ? 96 : al === 'mid' ? 50 : 4,
                          cx: gcx, cy: gcy,
                        } : undefined}
                        onSelect={sh => pickLayer(`ui:name:${m.charId}`, sh)}
                        onChange={(x, y) => setUiNames(sc => ({ ...sc, [m.charId]: { x, y } }))}
                        style={{
                          // 상세와 같은 기본 자리: 전신 칸(폭 44%) 안쪽 6% → 상자 기준 2.64%, 세로는 위 4% / 중앙 / 아래 4%
                          ...(left ? { left: `${colN.left + colN.w * 0.06 + o.x}%` } : { right: `${2.64 - o.x}%` }),
                          ...(nCols > 2 ? { maxWidth: `${colN.w}%` } : null),
                          ...(al === 'bottom' ? { bottom: `${4 - o.y}%` } : { top: `${(al === 'mid' ? 50 : 4) + o.y}%` }),
                          transform: al === 'mid' ? 'translateY(-50%)' : undefined,
                          display: 'flex', flexDirection: 'column', gap: 2, color: '#fff', textShadow: shadowCss,
                          alignItems: ta === 'center' ? 'center' : ta === 'left' ? 'flex-start' : 'flex-end', textAlign: ta,
                        }}>
                        {/* 상세 스테이지와 같은 구성 — 부제 · 이름 · No. · 기본 정보 · 키워드 · PROFILE (정렬·배지 표시 설정이 그대로 반영된다) */}
                        <small style={{ fontSize: cq(clampN(vp.w * 0.0085, 9, 12)), fontStyle: 'italic', opacity: .75, letterSpacing: '.06em', fontWeight: 400 }}>{ch?.sub || 'MEMBER'}</small>
                        <b style={{ fontSize: cq(fs), lineHeight: 1.05, fontWeight: (nameBolds[m.charId] ?? true) ? 800 : 400 }}>
                          {memberNames?.[m.charId] ?? m.charId}
                        </b>
                        <div style={{ display: 'flex', flexDirection: left ? 'row' : 'row-reverse', alignItems: 'center', gap: cq(6),
                          fontSize: cq(clampN(vp.w * 0.0085, 9, 12)), fontWeight: 800, letterSpacing: '.08em', color: 'var(--accent,#7fd6d0)', textShadow: 'none' }}>
                          {badgesOn && gems.slice(0, 5).map(gm => <i key={gm.hex + gm.label} title={gm.label} style={{ width: cq(9), height: cq(9), borderRadius: '50%', background: gm.hex }} />)}
                          <span>No./{String(i + 1).padStart(2, '0')}</span>
                          <i style={{ width: cq(clampN(vp.w * 0.03, 24, 44)), height: 1, background: 'currentColor' }} />
                        </div>
                        {badgesOn && specPills.length > 0 && (
                          <div style={{ display: 'grid', gap: 1, margin: `${cq(4)} 0 ${cq(2)}`, fontSize: cq(clampN(vp.w * 0.009, 10, 13)) }}>
                            {specPills.slice(0, 4).map(sp => (
                              <React.Fragment key={sp.label}>
                                <span style={{ fontSize: '.72em', fontStyle: 'italic', opacity: .6, marginTop: cq(6) }}>▪ {sp.label}</span>
                                <b style={{ fontWeight: 700 }}>{sp.value}</b>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                        {badgesOn && m.keywords.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: cq(5), marginTop: cq(2), justifyContent: ta === 'center' ? 'center' : ta === 'left' ? 'flex-start' : 'flex-end' }}>
                            {m.keywords.slice(0, 5).map(k => (
                              <span key={k} style={{ padding: `${cq(3)} ${cq(10)}`, borderRadius: 999, border: '1px solid rgba(255,255,255,.4)',
                                fontSize: cq(clampN(vp.w * 0.008, 9, 11)), fontWeight: 700 }}>{k}</span>
                            ))}
                          </div>
                        )}
                        <span style={{ marginTop: cq(6), fontSize: cq(10), fontWeight: 800, letterSpacing: '.2em', opacity: .8, borderBottom: '1px solid currentColor', paddingBottom: cq(2) }}>PROFILE →</span>
                      </PrevDrag>
                    );
                  })}
                </div>

                {/* 그리드 선 (v5.7) — 메인 편집모드와 같은 10px 격자(상세 화면 기준). 클릭은 통과시킨다 */}
                {gridOn && (
                  <div aria-hidden style={{
                    position: 'absolute', inset: 0, zIndex: 500, pointerEvents: 'none',
                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.16) 1px, transparent 1px)',
                    backgroundSize: `${gcx}% 100%, 100% ${gcy}%`,
                  }} />
                )}
              </div>
              </div>
              </>
              );
            })()}
            <p className="hint" style={{ margin: '4px 0 0' }}>전신: 드래그 = 위치 · 휠 = 크기 (큰 자관명·필기체도 휠 = 크기) · 우클릭 = 앞으로/뒤로 / 제목(AU 줄 포함)·이름·배지·스티커: 드래그 = 위치 (스티커는 휠 = 크기) / 그리드를 켜면 20px 격자에 맞춰집니다 — 미리보기 비율은 지금 브라우저 창 기준으로 상세 화면과 동일합니다</p>

            {/* 메인 이미지 · 레이어 (v5.6 사용자 요청) — 손잡이를 끌어 앞뒤 순서를 바꾼다.
                목록의 위쪽이 화면 앞쪽. 「UI」(제목·이름·배지 글자)를 전신보다 위에 두면 글자가 앞에, 아래에 두면 뒤에 그려진다 */}
            {Object.keys(fulls).length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
                <label className="k-label" style={{ margin: 0 }}>
                  메인 이미지 · 레이어 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— ⠿ 손잡이를 끌어 앞뒤 순서를 바꿉니다 (위 = 앞)</span>
                </label>
                <p className="hint" style={{ margin: 0 }}>
                  UI(제목·이름·배지 글자)보다 위에 두면 글자 앞에, 아래에 두면 글자 뒤에 그려집니다. 👁 눈 버튼으로 각 레이어를 보이게/숨기게 할 수 있습니다. 스티커·가운데 정보 위치와 크기는 위 미리보기에서 직접 끌어 조절합니다.
                </p>
                <KToggle label={badgesOn ? '배지 하위 항목 표시 — 키워드·기본 정보·컬러 모두' : '배지 하위 항목 숨김 — 이름·프로필 이동만'} checked={badgesOn} onChange={setBadgesOn} />
                {/* 자리가 정해진 레이어 — 순서는 없고 눈 버튼으로 켜고 끈다 */}
                <div style={{ display: 'grid', gap: 6 }}>
                  {([
                    ...(detailLayout === 'stage' && deco === 'on' ? [
                      { id: 'tile', cap: 'DECO', label: '장식 사각형 (뒤쪽 큰 판)' },
                      { id: 'ghost', cap: 'TEXT', label: '큰 자관명' },
                      ...(decoScript ? [{ id: 'script', cap: 'TEXT', label: '필기체 글씨' }] : []),
                    ] : []),
                    ...(detailLayout === 'stage' ? [{ id: 'info', cap: 'INFO', label: '가운데 정보 · 서랍 바로가기' }] : []),
                  ] as { id: string; cap: string; label: string }[]).map(r => {
                    const rid = r.id === 'ghost' ? 'deco-ghost' : r.id === 'script' ? 'deco-script' : r.id;
                    const sel = isSel(rid);
                    return (
                      <div key={r.id} onClick={e => pickLayer(rid, e.shiftKey)} style={{
                        display: 'flex', gap: 10, alignItems: 'center', padding: '5px 10px', borderRadius: 10,
                        border: `1px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
                        background: sel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined,
                      }}>
                        <EyeBtn on={!isHid(r.id)} onToggle={() => toggleHid(r.id)} />
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                          <div style={{ fontSize: 9.5, letterSpacing: '.08em', color: 'var(--faint)' }}>{r.cap}</div>
                          <b style={{ fontSize: 12.5 }}>{r.label}</b>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <DragList items={[...layerOrder].reverse().filter(id =>
                    id === HERO_UI_ID || (id.startsWith('full:') && fulls[id.slice(5)]) || id.startsWith('st:'))}
                  keyOf={id => id}
                  onReorder={shown => {
                    // 화면에서 안 보이는 항목(지운 전신)은 제자리를 유지한 채 보이는 항목만 재배열
                    const hidden = layerOrder.filter(id => id.startsWith('full:') && !fulls[id.slice(5)]);
                    setLayerOrder([...hidden, ...[...shown].reverse()]);
                  }}
                  render={id => {
                    const isSel = selLayer === id || multiSel.includes(id);
                    const stId = id.startsWith('st:') ? id.slice(3) : null;
                    const st2 = stId ? stickers.find(x => x.id === stId) : undefined;
                    const cid = id.startsWith('full:') ? id.slice(5) : null;
                    const mi = cid ? pairMembers.findIndex(m => m.charId === cid) : -1;
                    const label = id === HERO_UI_ID ? '이름 · 제목 · 배지 글자'
                      : cid ? (memberNames?.[cid] ?? cid) : `스티커 ${stickers.findIndex(x => x.id === stId) + 1}`;
                    const cap = id === HERO_UI_ID ? 'UI' : cid ? `전신 · ${pairMembers.length > 2 ? `${mi + 1}번째` : mi === 0 ? '왼쪽' : '오른쪽'}` : 'STICKER';
                    return (
                      <div onClick={e => pickLayer(id, e.shiftKey)} style={{
                        display: 'flex', gap: 10, alignItems: 'center', width: '100%', padding: '7px 10px', borderRadius: 10,
                        border: `1px solid ${isSel ? 'var(--accent)' : 'var(--line)'}`,
                        background: isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined,
                      }}>
                        <EyeBtn on={!isHid(id)} onToggle={() => toggleHid(id)} />
                        <span className="drag-h">⠿</span>
                        {id === HERO_UI_ID ? <LayerThumb text="Aa" />
                          : cid ? <LayerThumb refId={fulls[cid]?.ref} url={fulls[cid]?.url} />
                          : <LayerThumb refId={st2?.ref} url={st2?.url} />}
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                          <div style={{ fontSize: 9.5, letterSpacing: '.08em', color: 'var(--faint)' }}>{cap}</div>
                          <b style={{ fontSize: 12.5 }}>{label}</b>
                        </div>
                        {st2 && (
                          <>
                            <label className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5, cursor: 'var(--cur-pointer,pointer)' }}
                              onClick={e => e.stopPropagation()}>
                              교체
                              <input type="file" accept="image/*" style={{ display: 'none' }}
                                onChange={e => {
                                  const f = e.target.files?.[0]; e.target.value = '';
                                  if (f) patchSticker(st2.id, { file: f, url: URL.createObjectURL(f), ref: undefined });
                                }} />
                            </label>
                            <span className="fx" onClick={e => {
                              e.stopPropagation();
                              del.ask('이 스티커를 삭제하시겠습니까?', () => removeSticker(st2.id));
                            }}>✕</span>
                          </>
                        )}
                      </div>
                    );
                  }} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, cursor: 'var(--cur-pointer,pointer)' }}
                    {...fileDrop(fl => addStickers(fl))}>
                    ＋ 스티커 추가
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                      onChange={e => { addStickers(e.target.files); e.target.value = ''; }} />
                  </label>
                  {(() => {
                    const cur = selLayer?.startsWith('st:') ? stickers.find(x => x.id === selLayer.slice(3)) : undefined;
                    if (cur) {
                      return (
                        <>
                          <span className="cp-lb">스티커 크기</span>
                          <KStep value={Math.round(cur.w)} min={3} max={90} step={1} suffix="%"
                            onChange={(v: number) => patchSticker(cur.id, { w: v })} />
                        </>
                      );
                    }
                    if (selLayer === 'info') {
                      return (
                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                          onClick={() => setUiInfo({ x: 0, y: 0 })}>가운데 정보 위치 처음대로</button>
                      );
                    }
                    if (selLayer === HERO_UI_ID) {
                      return (
                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                          onClick={() => { setUiTitle({ x: 0, y: 0 }); setUiNames({}); }}>글자 위치 처음대로</button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* 좌/우 한마디 문구 (v2.0 사용자 발견 — 색만 있고 문구 칸이 없었다) */}
            <label className="k-label" style={{ margin: '10px 0 0' }}>한마디 — 상단 좌/우 대사</label>
            {pairMembers.map((m, i) => (
              <div key={m.charId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <b style={{ fontSize: 12, width: 92, flexShrink: 0 }}>{i === 0 ? '왼쪽' : '오른쪽'} · {memberNames?.[m.charId] ?? m.charId}</b>
                <KInput value={quotes[m.charId] ?? ''}
                  onChange={e => setQuotes(s => ({ ...s, [m.charId]: e.target.value }))}
                  placeholder="비우면 표시하지 않습니다" style={{ flex: 1 }} />
              </div>
            ))}

            {/* 자관 이름(제목) 크기 — 이름 크기 항목 바로 위 */}
            {titleSizeCtl}

            {/* 캐릭터 이름 크기 — PC 상세 전신 위 이름과 모바일 멤버 카드 이름에 함께 적용된다
                (v2.0 이후 모바일 카드는 별도 필드를 봐서 여기서 조정해도 반영되지 않던 것을 통합).
                안 정하면 창 폭에 맞춰 자동(모바일 카드는 카드 기본 크기) */}
            <label className="k-label" style={{ margin: '10px 0 0' }}>
              캐릭터 이름 크기 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 상세 화면 전신 위 이름 · 모바일 멤버 카드 이름 · 기본은 자동</span>
            </label>
            {pairMembers.map((m, i) => (
              <div key={m.charId} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 12, width: 92, flexShrink: 0 }}>{i === 0 ? '왼쪽' : '오른쪽'} · {memberNames?.[m.charId] ?? m.charId}</b>
                <KCheck label="Bold" checked={nameBolds[m.charId] ?? true}
                  onChange={(v: boolean) => setNameBolds(s => ({ ...s, [m.charId]: v }))} />
                <KStep value={heroNameSizes[m.charId] ?? HERO_NAME_DEFAULT}
                  onChange={(v: number) => setHeroNameSizes(s => ({ ...s, [m.charId]: v }))}
                  min={12} max={80} step={1} suffix="px" />
                {heroNameSizes[m.charId] !== undefined && (
                  <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5 }}
                    onClick={() => setHeroNameSizes(s => ({ ...s, [m.charId]: undefined }))}>자동</button>
                )}
              </div>
            ))}

            {/* 배치 정렬 — 이름·부제·배지 묶음을 캐릭터 이름 기준으로 좌측/가운데/우측 정렬 (v6.4).
                세로 위치(위/중앙/아래)는 전신 드래그 배치로 자유롭게 옮길 수 있어서 없앴다.
                이 블록은 pairMembers.length > 0(=페어 자관)일 때만 나타난다 */}
            <label className="k-label" style={{ margin: '10px 0 0' }}>
              배치 정렬 (좌측 / 가운데 / 우측) <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 상세 화면 전신 위 이름·부제·정보 배지를 캐릭터 이름 기준으로 어느 쪽에 맞출지</span>
            </label>
            {pairMembers.map((m, i) => {
              const cur = badgeTextAligns[m.charId] ?? (i === 0 ? 'left' : 'right');   // 안 정했으면 왼쪽 캐릭터=좌측, 오른쪽 캐릭터=우측
              return (
                <div key={m.charId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <b style={{ fontSize: 12, width: 92, flexShrink: 0 }}>{i === 0 ? '왼쪽' : '오른쪽'} · {memberNames?.[m.charId] ?? m.charId}</b>
                  <div className="mini-seg">
                    {([['left', '좌측'], ['center', '가운데'], ['right', '우측']] as const).map(([k, lb2]) => (
                      <button key={k} className={cur === k ? 'on' : ''}
                        onClick={() => setBadgeTextAligns(sc => ({ ...sc, [m.charId]: k }))}>{lb2}</button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 히어로 대사 색 (페어, v1.9 사용자 요청) — 좌/우 캐릭터 대사 글씨색·따옴표색 */}
            <label className="k-label" style={{ margin: '10px 0 0' }}>대사 색 — 상단 좌/우 한마디</label>
            {pairMembers.map((m, i) => (
              <div key={m.charId} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 12, width: 92 }}>{i === 0 ? '왼쪽' : '오른쪽'} · {memberNames?.[m.charId] ?? m.charId}</b>
                <span className="cp-lb">글씨</span>
                <ColorField value={quoteColors[m.charId]?.fg ?? '#d7dae0'}
                  onChange={hex => setQuoteColors(s => ({ ...s, [m.charId]: { ...s[m.charId], fg: hex } }))} />
                <span className="cp-lb">따옴표</span>
                <ColorField value={quoteColors[m.charId]?.mark ?? '#c96a73'}
                  onChange={hex => setQuoteColors(s => ({ ...s, [m.charId]: { ...s[m.charId], mark: hex } }))} />
              </div>
            ))}
          </>
        )}

        {/* 배경 이미지 (v1.5 → v5.0 사용자 요청 — 기존 "헤더 이미지" 선택을 환경설정의 배경
            변경(업로드·블러)과 똑같은 방식으로 바꿈. 위치 크롭은 없애고, 사이트 배경 설정처럼
            업로드 + 블러 슬라이더만 남김. v5.1 — 상단 배너·아래로 페이드아웃은 없애고, 환경설정
            배경처럼 페이지 전체에 고정으로 깔려 끊김 없이 이어진다 */}
        {pairMembers.length === 0 && titleSizeCtl}

        {/* 다인관 멤버 순서 (v6.7) — 상세 페이지의 멤버 목록 순서. ⠿ 핸들을 잡고 끌어서 바꾼다.
            자관 전체 설정이라 AU 편집에서는 두지 않는다 */}
        {!isNew && !auId && isMultiRel && memberOrder.length > 1 && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            <label className="k-label" style={{ margin: 0 }}>
              멤버 순서 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— ⠿ 을 잡고 끌어서 상세 페이지에 보이는 캐릭터 순서를 바꿉니다</span>
            </label>
            <DragList items={memberOrder} keyOf={id => id} onReorder={setMemberOrder}
              render={(id, i) => (
                <div className="upfile-row" style={{ width: '100%' }}>
                  <span className="drag-h">⠿</span>
                  <span className="mw-no">{i + 1}</span>
                  <div className="nm"><b>{memberNames?.[id] ?? id}</b></div>
                </div>
              )} />
          </div>
        )}

        {/* 서랍 연동 — 갤러리 편집·연동 · 로그/세션 연동 · 역극. 자관 전체 설정이라 AU 편집에서는 두지 않는다 */}
        {!auObj && (
          <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="k-label" style={{ margin: 0 }}>갤러리 · 역극</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} disabled={!initial}
                  onClick={() => save('gallery')}>갤러리 편집 · 연동 ↗</button>
                <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} disabled={!initial}
                  onClick={() => save('rp')}>역극 연동 (역극방 만들 때 자관 선택) ↗</button>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                {initial ? '(누르면 지금까지의 수정 내용을 저장하고 같은 탭에서 이동합니다) 갤러리 사진 묶음 추가·수정과 캐릭터 갤러리 태그 연동은 갤러리 페이지에서, 역극은 역극 게시판에서 이 자관을 골라 연동합니다 — 모두 상세 서랍에 나타납니다'
                  : '갤러리·역극 연동은 자관을 등록한 뒤 수정 화면에서 할 수 있습니다'}
              </p>
            </div>
            <RelLinkBoard relId={initial?.id} mode={linkBoard} onMode={setLinkBoard} />
          </div>
        )}

        {/* 이 자관 페이지 전용 BGM (v5.9) — 환경설정 BGM과 같은 편집 화면. 자관 전체 설정이라 AU 편집에서는 두지 않는다.
            들어오면 플레이어가 이 BGM으로 바뀌고, 나가면 홈페이지 BGM으로 돌아간다 */}
        {!auObj && (
          <div style={{ marginTop: 22 }}>
            <PageBgmEditor value={bgm} onChange={setBgm} />
          </div>
        )}
      </div>

      {/* 우: 기본 정보 + 저장 */}
      <div>
        <div className="panel widget" style={{ marginBottom: 14 }}>
          <h4>기본</h4>
          <div style={{ display: 'grid', gap: 9 }}>
            <KInput placeholder="자관 이름" value={name} onChange={e => setName(e.target.value)}
              style={{ fontFamily: familyOf(fontId), letterSpacing: '.1em' }} />
            {/* AU별 자관명 (v2.0 사용자 요청) — 이 AU를 볼 때만 쓰는 이름. 비우면 위 이름 그대로 */}
            {auObj && (
              <div>
                <label className="k-label" style={{ marginBottom: 5 }}>{auObj.label} AU 이름</label>
                <KInput placeholder={name || '자관 이름 그대로'} value={auName}
                  onChange={e => setAuName(e.target.value)}
                  style={{ fontFamily: familyOf(fontId), letterSpacing: '.1em' }} />
                <p className="hint" style={{ margin: '5px 0 0' }}>
                  이 AU를 볼 때만 쓰는 이름 — 비우면 자관 이름을 그대로 씁니다
                </p>
              </div>
            )}
            {/* 페이지 주소 (v1.9) — /rels/{slug}, 비우면 자동 · 중복이면 경고 */}
            {/* 수정에서도 바꿀 수 있다 (v2.0 사용자 요청) — 비우면 원래 주소(id) 그대로.
                AU 편집에서는 주소가 base 소관이라 숨긴다 */}
            {!auObj && (
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap' }}>/rels/</span>
                  <KInput placeholder={isNew ? '페이지 주소 (선택)' : `페이지 주소 (비우면 ${initial?.id})`} value={slug}
                    onChange={e => setSlug(slugify(e.target.value))} style={{ flex: 1 }} />
                </div>
                {slug && slug !== (initial?.slug ?? '') && existingIds?.includes(slug) && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--accent)' }}>이미 사용 중인 주소입니다</p>
                )}
              </div>
            )}
            <KInput placeholder="캐치프레이즈" value={catchphrase} onChange={e => setCatchphrase(e.target.value)} />
            {/* 자관명·캐치프레이즈 글씨색 (v1.9 사용자 요청) — 기본은 테마색. AU마다 따로 정할 수 있다 (v2.0) */}
            {(
              <div>
                <KCheck label="자관명·캐치프레이즈 색 직접 지정" checked={txtCustom} onChange={setTxtCustom} />
                {txtCustom && (
                  <div className="cf-row" style={{ marginTop: 8 }}>
                    <span className="cp-lb">자관명</span>
                    <ColorField value={nameColor} onChange={setNameColor} />
                    <span className="cp-lb">캐치</span>
                    <ColorField value={cpColor} onChange={setCpColor} />
                  </div>
                )}
              </div>
            )}
            {/* 그림자 (v2.0 사용자 요청) — 어떤 색으로 얼마나 진하게 깔릴지. 자관명과 전신에 함께 걸린다 */}
            {(
              <div>
                <KCheck label="그림자 직접 지정 (자관명·전신)" checked={shadowCustom} onChange={setShadowCustom} />
                {shadowCustom && (
                  <div className="cf-stack" style={{ marginTop: 8 }}>
                    <div className="cf-row">
                      <span className="cp-lb">색</span>
                      <ColorField value={nameShadowColor} onChange={setNameShadowColor} />
                    </div>
                    <div className="cf-row">
                      <span className="cp-lb">강도</span>
                      <KStep value={nameShadow} min={0} max={200} step={10} suffix="%" onChange={setNameShadow} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* CP/NCP (v1.9) — CP=커플 · NCP=커플 아님. AU마다 따로 지정은 상세의 AU 관리에서 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label className="k-label" style={{ margin: 0 }}>구분</label>
              <div className="mini-seg">
                {(['cp', 'ncp'] as RelCpTag[]).map(t => (
                  <button key={t} className={cp === t ? 'on' : ''} onClick={() => setCp(t)}>{CP_LABEL[t]}</button>
                ))}
              </div>
            </div>
            {/* 뱃지 색 (v2.0 사용자 요청) — 자관명 위에 뜨는 CP/NCP 표시. AU마다 따로 */}
            {(
              <div>
                <KCheck label="CP 뱃지 색 직접 지정" checked={tagCustom} onChange={setTagCustom} />
                {tagCustom && (
                  <div className="cf-stack" style={{ marginTop: 8 }}>
                    <div className="cf-row">
                      <span className="cp-lb">배경</span>
                      <ColorField value={cpTagBg} onChange={setCpTagBg} />
                      <span className="cp-lb">글씨</span>
                      <ColorField value={cpTagFg} onChange={setCpTagFg} />
                    </div>
                    <div className="cf-row">
                      <span className="cp-lb">미리보기</span>
                      <span className="pill" style={{ background: cpTagBg, color: cpTagFg, borderColor: cpTagBg }}>
                        {CP_LABEL[cp]}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="hint" style={{ margin: '2px 0 0' }}>이름 폰트 — 상세 대형 타이틀에 적용</p>
            <KSelect value={fontId} onChange={setFontId}
              options={fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: deVarFamily(f.family) }}>{f.name}</span> }))} />
            <p className="hint" style={{ margin: '2px 0 0' }}>본문 폰트 — 카드 소개·타임라인·문답 텍스트에 적용</p>
            <KSelect value={bodyFontId} onChange={setBodyFontId}
              options={fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: deVarFamily(f.family) }}>{f.name}</span> }))} />
            <div>
              <label className="k-label">페이지 테마{auObj ? ` — ${auObj.label}` : ''}</label>
              {/* AU 편집 (v1.9) — 기존(원본) 테마 따라가기 / 이 AU 전용 테마 */}
              {auObj && (
                <div className="mini-seg" style={{ marginBottom: 6 }}>
                  <button className={themeFollow ? 'on' : ''} onClick={() => setThemeFollow(true)}>기존 테마 따라가기</button>
                  <button className={!themeFollow ? 'on' : ''} onClick={() => setThemeFollow(false)}>이 AU 전용</button>
                </div>
              )}
              {!(auObj && themeFollow) && (
              <div className="mini-seg">
                <button className={themeMode === 'site' ? 'on' : ''} onClick={() => setThemeMode('site')}>홈페이지 테마 그대로</button>
                <button className={themeMode === 'custom' ? 'on' : ''} onClick={() => setThemeMode('custom')}>테마컬러 입력</button>
              </div>
              )}
              {!(auObj && themeFollow) && themeMode === 'custom' && (
                /* 공용 ColorField — 다른 색 입력들과 동일 스타일 (v1.9 사용자 피드백) */
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <ColorField value={themeColor} onChange={setThemeColor} />
                  <div className="mini-seg">
                    <button className={themeTone === 'dark' ? 'on' : ''} onClick={() => setThemeTone('dark')}>다크 느낌</button>
                    <button className={themeTone === 'light' ? 'on' : ''} onClick={() => setThemeTone('light')}>라이트 느낌</button>
                  </div>
                </div>
              )}
              <p className="hint" style={{ margin: '6px 0 0' }}>
                {auObj && themeFollow
                  ? '이 AU는 원본 자관의 페이지 테마를 그대로 사용합니다'
                  : themeMode === 'custom'
                  ? '이 페이지에 들어가면 홈페이지 전체 팔레트가 이 색 기준으로 전환되고, 벗어나면 원래 테마로 돌아옵니다'
                  : '이 페이지도 홈페이지 테마를 그대로 사용합니다'}
              </p>
            </div>
        {auObj && (
          <GalleryTagLinkPicker title={`갤러리 서랍 — ${auObj.label} AU`}
            hint="이 AU로 전환했을 때 갤러리 서랍에 보일 사진의 태그를 고르세요 (비워 두면 자관 기본 갤러리 그대로)"
            emptyHint="자관·멤버 캐릭터의 갤러리 묶음에 태그가 달려 있지 않습니다 — 갤러리 묶음에 태그를 달면 여기에 나타납니다"
            options={auTagOptions} selected={auGalleryTags}
            onToggle={t => setAuGalleryTags(l => (l.includes(t) ? l.filter(x => x !== t) : [...l, t]))} />
        )}

        {/* 상세 화면 구성 — 스테이지(스크롤 인터랙티브, 기본) / 클래식(예전 구성). 자관 전체 설정 */}
        {!auObj && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            <label className="k-label" style={{ margin: 0 }}>상세 페이지 구성</label>
            <div className="mini-seg" style={{ justifySelf: 'start' }}>
              <button type="button" className={detailLayout === 'stage' ? 'on' : ''} onClick={() => setDetailLayout('stage')}>스테이지</button>
              <button type="button" className={detailLayout === 'classic' ? 'on' : ''} onClick={() => setDetailLayout('classic')}>클래식</button>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {detailLayout === 'stage'
                ? '캐릭터 스테이지처럼 큰 자관명 앞에 전신이 서고, 우측 서랍에서 로그·세션·갤러리·역극을 엽니다'
                : '예전 구성 — 좌우 카드와 중앙 일러가 한 화면에 보입니다'}
            </p>
          </div>
        )}

        {/* 스테이지 배경 장식 — 캐릭터 상세와 같은 설정(큰 글씨 위치·크기·폰트, 필기체 겹치기, 이미지 쓸 곳). 자관 전체 설정 */}
        {!auObj && detailLayout === 'stage' && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            <label className="k-label" style={{ margin: 0 }}>배경 장식</label>
            <p className="hint" style={{ margin: 0 }}>
              스테이지 배경에 얇은 선·눈금·라벨과 뒤쪽 큰 판(왼쪽 위가 둥근 사각형)을 깝니다. 가운데 큰 글씨는 자관명입니다
            </p>
            <div className="mini-seg" style={{ justifySelf: 'start' }}>
              <button type="button" className={deco === 'on' ? 'on' : ''} onClick={() => setDeco('on')}>켜기 (기본)</button>
              <button type="button" className={deco === 'off' ? 'on' : ''} onClick={() => setDeco('off')}>끄기</button>
            </div>
            {deco === 'on' && (
              <>
                <p className="hint" style={{ margin: 0 }}>큰 글씨(자관명) 폰트 — 비우면 자관 이름 폰트와 같게</p>
                <KSelect value={decoFontId} onChange={setDecoFontId}
                  options={[{ value: '', label: '이름 폰트와 같게 (기본)' },
                    ...fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: deVarFamily(f.family) }}>{f.name}</span> }))]} />
                <KCheck label="필기체 글씨 겹치기 — 큰 글씨 위에 다른 색·필기체로 한 번 더 쓰고, 처음 나타날 때 써 내려가는 효과로 등장"
                  checked={!!decoScript} onChange={v => setDecoScript(v ? { ...DEFAULT_DECO_SCRIPT } : null)} />
                {decoScript && (
                  <>
                    <KInput placeholder="필기체로 쓸 글씨 (비우면 자관명)" value={decoScript.text ?? ''}
                      onChange={e => setDecoScript({ ...decoScript, text: e.target.value })} />
                    <KSelect value={decoScript.fontId ?? ''} onChange={v => setDecoScript({ ...decoScript, fontId: v })}
                      options={[{ value: '', label: '이름 폰트와 같게 (필기체 폰트를 고르세요)' },
                        ...fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: deVarFamily(f.family) }}>{f.name}</span> }))]} />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="cp-lb">색</span>
                      <ColorField value={decoScript.color || '#ff6a00'} onChange={hex => setDecoScript({ ...decoScript, color: hex })} />
                      <button type="button" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 10, whiteSpace: 'nowrap' }}
                        onClick={() => setDecoScript({ ...decoScript, color: undefined })}>포인트색</button>
                      <span className="cp-lb">크기</span>
                      <KStep value={decoScript.size} min={6} max={50} step={1} onChange={v => setDecoScript({ ...decoScript, size: v })} />
                      <span className="cp-lb">기울기</span>
                      <KStep value={decoScript.rot} min={-30} max={30} step={1} suffix="°" onChange={v => setDecoScript({ ...decoScript, rot: v })} />
                      <span className="cp-lb">블러</span>
                      <KStep value={decoScript.blur ?? 0} min={0} max={30} step={1} suffix="px" onChange={v => setDecoScript({ ...decoScript, blur: v || undefined })} />
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="cp-lb">큰 자관명 크기</span>
                  <KStep value={decoGhost.scale} min={30} max={200} step={5} suffix="%" onChange={v => setDecoGhost({ ...decoGhost, scale: v })} />
                  <span className="cp-lb">색</span>
                  <ColorField value={decoGhost.color || '#ffffff'} onChange={hex => setDecoGhost({ ...decoGhost, color: hex })} />
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 10, whiteSpace: 'nowrap' }}
                    onClick={() => setDecoGhost({ ...decoGhost, color: undefined })}>자동</button>
                  <span className="cp-lb">불투명도</span>
                  <KStep value={decoGhost.opacity ?? 100} min={5} max={100} step={5} suffix="%" onChange={v => setDecoGhost({ ...decoGhost, opacity: v })} />
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 10, whiteSpace: 'nowrap' }}
                    onClick={() => setDecoGhost({ ...DEFAULT_DECO_GHOST })}>위치·크기·색 처음대로</button>
                </div>
                {Object.keys(fulls).length === 0 && <ScriptPlacer script={decoScript} scriptText={decoScript?.text?.trim() || name.trim()}
                  scriptFont={decoScript?.fontId ? deVarFamily(familyOf(decoScript.fontId) ?? '') : deVarFamily(familyOf(fontId) ?? '')}
                  ghost={name.trim().toUpperCase()} ghostPos={decoGhost} ghostFont={deVarFamily(familyOf(decoFontId || fontId) ?? '')}
                  ghostVw={relTitleVw(name.trim().toUpperCase())}
                  accent={themeMode === 'custom' ? themeColor : '#7fd6d0'}
                  onMoveGhost={(x, y) => setDecoGhost({ ...decoGhost, x, y })}
                  onMoveScript={(x, y) => decoScript && setDecoScript({ ...decoScript, x, y })} />}
                {Object.keys(fulls).length > 0 && <p className="hint" style={{ margin: 0 }}>큰 자관명·필기체 위치는 아래 「메인 이미지」 미리보기에서 끌어 옮깁니다 (전신 뒤에 놓여, 전신이 가린 부분은 보이는 글자를 잡으세요)</p>}
                {(headerUrl || (!headerRemoved && initHeaderId)) && (
                  <>
                    <p className="hint" style={{ margin: 0 }}>배경 이미지를 등록했을 때 — 이미지를 어디에 쓸지 고릅니다</p>
                    <div className="mini-seg">
                      <button type="button" className={decoBg === 'full' ? 'on' : ''} onClick={() => setDecoBg('full')}>이미지 전체 배경 + 흰색 장식 (기본)</button>
                      <button type="button" className={decoBg === 'band' ? 'on' : ''} onClick={() => setDecoBg('band')}>큰 판 안에 이미지 + 포인트색 장식</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}


        <label className="k-label" style={{ margin: 0 }}>
          배경 이미지 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 환경설정의 배경 변경과 같은 방식(업로드·블러). 페이지 전체 배경으로 깔림 (선택)</span>
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 200, aspectRatio: '3/1', borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1.5px dashed var(--line)', cursor: 'var(--cur-pointer,pointer)' }}
            onClick={() => document.getElementById('relHeaderF')?.click()}
            {...fileDrop(fl => {
              const hf = fl[0];
              if (hf) { setHeaderFile(hf); setHeaderUrl(URL.createObjectURL(hf)); setHeaderRemoved(false); }
            })}>
            {headerUrl ? (
              <div style={{ position: 'absolute', inset: 0, filter: 'blur(2px)' }}>
                <CropImg src={headerUrl} />
              </div>
            ) : (!headerRemoved && initHeaderId) ? (
              <HeaderPreview refId={initHeaderId} />
            ) : (
              <div className="ph" style={{ width: '100%', height: '100%' }}><span style={{ fontSize: 10 }}>BACKGROUND</span></div>
            )}
          </div>
          <input id="relHeaderF" type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => {
              const hf = e.target.files?.[0];
              if (hf) { setHeaderFile(hf); setHeaderUrl(URL.createObjectURL(hf)); setHeaderRemoved(false); }
              e.target.value = '';
            }} />
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
            onClick={() => document.getElementById('relHeaderF')?.click()}>
            {(headerUrl || (!headerRemoved && initHeaderId)) ? 'CHANGE' : 'UPLOAD'}
          </button>
          {(headerUrl || (!headerRemoved && initHeaderId)) && (
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
              onClick={() => { setHeaderFile(null); setHeaderUrl(''); setHeaderRemoved(true); }}>REMOVE</button>
          )}
          <span className="cp-lb">블러</span>
          <KStep value={headerBlur} min={0} max={30} step={2} suffix="px" onChange={setHeaderBlur} />
        </div>

        {/* 배경 이미지가 없을 때 대신 깔 배경 (v2.0 사용자 요청) — 디자인 탭 배경 설정과 같은 방식.
            지정하지 않으면 예전처럼 그 자리엔 아무것도 안 그린다. AU마다 따로 정할 수 있다 */}
        {(
          <div style={{ marginTop: 10 }}>
            <KCheck label="배경 이미지 없을 때 배경 직접 지정" checked={headerBgCustom} onChange={setHeaderBgCustom} />
            {headerBgCustom && (
              <div className="cf-stack" style={{ marginTop: 8 }}>
                <div className="cf-row">
                  <ColorField value={headerBgG1} onChange={setHeaderBgG1} />
                  <span style={{ color: 'var(--faint)', fontSize: 11 }}>→</span>
                  <ColorField value={headerBgG2} onChange={setHeaderBgG2} />
                </div>
                <div className="cf-row">
                  <span className="cp-lb">각도</span>
                  <KStep value={headerBgAngle} min={0} max={360} step={15} suffix="°" onChange={setHeaderBgAngle} />
                </div>
              </div>
            )}
          </div>
        )}


            {/* 문답 답변 가리기 (v2.0 사용자 요청) — 방문자에게 답변 내용을 안 보이게.
                자관 전체 설정이라 AU 편집에서는 두지 않는다 */}
            {!auObj && (
              <div>
                <KCheck label="문답 답변 숨기기" checked={qaHide} onChange={setQaHide} />
                <p className="hint" style={{ margin: '5px 0 0', lineHeight: 1.6 }}>
                  질문은 그대로 두고 <b>답변 내용만</b> 가립니다 — 관리자와 이 자관 캐릭터에
                  권한을 받은 회원만 볼 수 있습니다.
                  {qaHide && (
                    <>
                      <br />
                      <b style={{ color: 'var(--accent)' }}>다만 화면에서 가리는 것이라 완전한 차단은 아닙니다.</b>{' '}
                      답변은 공개로 저장돼 있어 마음먹고 찾아보는 사람에게는 보일 수 있으니,
                      정말 알려지면 안 되는 내용은 적지 말아 주세요.
                    </>
                  )}
                </p>
              </div>
            )}

            {/* 페이지 배경 (v2.0 사용자 요청) — 이 페이지에 있는 동안의 바탕 그라데이션. AU마다 따로 */}
            {(
              <div>
                <KCheck label="페이지 배경 직접 지정" checked={pageBgCustom} onChange={setPageBgCustom} />
                {pageBgCustom && (
                  <div className="cf-stack" style={{ marginTop: 8 }}>
                    <div className="cf-row">
                      <ColorField value={pageBgG1} onChange={setPageBgG1} />
                      <span style={{ color: 'var(--faint)', fontSize: 11 }}>→</span>
                      <ColorField value={pageBgG2} onChange={setPageBgG2} />
                    </div>
                    <div className="cf-row">
                      <span className="cp-lb">각도</span>
                      <KStep value={pageBgAngle} min={0} max={360} step={15} suffix="°" onChange={setPageBgAngle} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* 전신/일러 스위치 색 (v1.9 사용자 요청) — 페어 중앙 이미지의 전환 스위치. AU마다 따로 (v2.0) */}
            {(
              <div>
                <KCheck label="전신/일러 스위치 색 직접 지정" checked={illuCustom} onChange={setIlluCustom} />
                {illuCustom && (
                  /* 한 줄 고정 (v1.9 사용자 피드백) — 좁은 패널에서 두 줄로 내려가지 않게 인풋이 줄어듦 */
                  <div className="cf-row" style={{ marginTop: 8 }}>
                    <span className="cp-lb">배경</span>
                    <ColorField value={illuBg} onChange={setIlluBg} />
                    <span className="cp-lb">선택</span>
                    <ColorField value={illuOn} onChange={setIlluOn} />
                  </div>
                )}
              </div>
            )}
            <KSelect value={visibility} onChange={v => setVisibility(v as Visibility)}
              options={[
                { value: 'public', label: '전체공개' },
                { value: 'member', label: '멤버공개' },
                { value: 'private', label: '나만보기' },
              ]} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-onbk" onClick={onCancel}>CANCEL</button>
          <button className="btn btn-accent" onClick={() => save()}>
            {isNew ? 'ADD' : 'SAVE'}
          </button>
        </div>
      </div>

      {arts[0] && cropOpen && (
        <FirstArtCrop open={cropOpen} item={arts[0]} crop={thumbCrop}
          onClose={() => setCropOpen(false)}
          onApply={c => { setThumbCrop(c); setCropOpen(false); }} />
      )}
      {/* 아트 원본 보기 — 아직 저장 전 파일은 url, 저장된 것은 ref (Lightbox가 둘 다 처리) */}
      {lb !== null && (
        <Lightbox srcs={arts.map(a => a.url ?? a.ref ?? '')} index={lb} onClose={() => setLb(null)} />
      )}
      {/* ---------- ADD CHARACTER 모달 — 자관 상세의 「멤버 추가」와 같다 ---------- */}
      {onAddMember && (
        <Modal open={memberOpen} onClose={() => setMemberOpen(false)} small title="캐릭터 추가"
          dirty={!!(mCharId || mName || mQuote)}
          desc="내 캐릭터를 연동하거나, 상대(타인) 캐릭터를 간단 등록 — 상대 캐릭터는 내 캐릭터 리스트에 표시되지 않음 · 추가하면 바로 저장됩니다"
          actions={<>
            <button className="btn btn-ghost" onClick={() => setMemberOpen(false)}>CANCEL</button>
            <button className="btn btn-dark" onClick={submitMember}>ADD</button>
          </>}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <KRadio name="mm" value="exist" current={mMode} onChange={v => setMMode(v as 'exist')} label="기존 캐릭터" />
              <KRadio name="mm" value="new" current={mMode} onChange={v => setMMode(v as 'new')} label="새 상대 캐릭터" />
            </div>
            {mMode === 'exist' ? (
              <div>
                <KInput placeholder="캐릭터 검색" value={mQuery} onChange={e => setMQuery(e.target.value)} />
                <div style={{ marginTop: 6, maxHeight: 190, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 9 }}>
                  {(addCandidates ?? [])
                    .filter(c => {
                      const q2 = mQuery.trim().toLowerCase();
                      return !q2 || c.name.toLowerCase().includes(q2) || (c.sub ?? '').toLowerCase().includes(q2);
                    })
                    .map(c => (
                      <div key={c.id} onClick={() => setMCharId(mCharId === c.id ? '' : c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', cursor: 'var(--cur-pointer,pointer)',
                          background: mCharId === c.id ? 'rgba(127,127,127,.12)' : undefined,
                          borderBottom: '1px dashed var(--line)', transition: '.13s',
                        }}>
                        <i style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, fontStyle: 'normal', flexShrink: 0 }} />
                        <b style={{ fontSize: 12.5 }}>{c.name}</b>
                        <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{c.sub}{!c.own && ' · 상대'}</small>
                        {mCharId === c.id && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
                      </div>
                    ))}
                  {(addCandidates ?? []).length === 0 && <p className="hint" style={{ padding: 10 }}>추가할 수 있는 캐릭터가 없습니다</p>}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <KInput placeholder="이름" value={mName} onChange={e => setMName(e.target.value)} />
                  <KInput placeholder="한 줄 소개 (선택)" value={mSub} onChange={e => setMSub(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span className="cp-lb">테마색</span>
                  <ColorField value={mColor} onChange={setMColor} />
                </div>
                <div>
                  <label className="k-label" style={{ marginBottom: 7 }}>회원 권한 (선택)</label>
                  <GrantsEditor value={mGrants} onChange={setMGrants} />
                </div>
              </>
            )}
            <KInput placeholder="캐릭터 한마디 (선택 — 타이틀 옆 인용구)" value={mQuote} onChange={e => setMQuote(e.target.value)} />
          </div>
        </Modal>
      )}
      {del.element}
    </div>
  );
}

/** 저장된 배경 이미지 미리보기 (v5.0 — 사이트 배경 설정과 같은 방식으로 단순화, 위치 크롭 없음) */
function HeaderPreview({ refId }: { refId: string }) {
  const url = useBlobUrl(refId);
  if (!url) return <div className="ph" style={{ width: '100%', height: '100%' }} />;
  return (
    <div style={{ position: 'absolute', inset: 0, filter: 'blur(2px)' }}>
      <CropImg src={url} />
    </div>
  );
}

/** 첫 아트(새 파일 또는 저장된 blob)를 소스로 4:3 크롭 편집기 */
function FirstArtCrop({ open, item, crop, onClose, onApply }: {
  open: boolean; item: ArtItem; crop?: CropValue;
  onClose: () => void; onApply: (c: CropValue) => void;
}) {
  const [loadedUrl, setLoadedUrl] = useState('');
  useEffect(() => {
    if (item.url || !item.ref || !open) return;
    getBlob(item.ref).then(b => { if (b) setLoadedUrl(URL.createObjectURL(b)); });
  }, [item, open]);
  const src = item.url || loadedUrl;
  if (!src) return null;
  return <CropEditor open={open} src={src} aspect="4:3" initial={crop} onClose={onClose} onApply={onApply} />;
}
