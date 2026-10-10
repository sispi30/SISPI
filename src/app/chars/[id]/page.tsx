'use client';
// 캐릭터 프로필 상세 (4.4) — 좌측 아이콘 탭 · 중앙 스티키 아트 · 우측 정보 패널
// 스크롤: 정보가 길면 페이지가 이어지고 탭·아트는 스티키 (v1.9)
// AU 선택 시 프로필 전체(이름·스펙·아트·탭·소개)가 그 AU의 값으로 전환 (charWithAu) —
// 편집은 EDIT → /chars/[id]/edit?au= 전용 페이지에서 새 프로필처럼 작성 (v1.9 사용자 확정)
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, charGrant, charWithAu, chipBorder, Relation, REL_SEED , findByKey, GalleryPost, charGalleryPosts, charRelGroups, galleryPostsOf, hasGallery, resolveThemeTone } from '@/lib/charStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { Lightbox } from '@/components/ui/Lightbox';
import { sanitizeHtml } from '@/lib/sanitize';
import { useFonts } from '@/lib/fontStore';
import { useTheme } from '@/lib/ThemeProvider';
import { BlobImg, useBlobUrl } from '@/lib/blobStore';
import { CroppedBlobImg, CropEditor, type CropValue } from '@/components/ui/CropEditor';

import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { useSectionTitle } from '@/lib/sectionStore';
import { ConfirmModal } from '@/components/ui/Modal';
import { usePageBgm } from '@/lib/bgmStore';
import { GalleryPanel } from '@/components/gallery/GalleryPostsView';
import { RelTab } from '@/components/chars/RelTab';
import { StageWindow, type StageWindowItem } from '@/components/chars/StageWindow';
import type { BackupPost } from '@/lib/galleryStore';
import { SpecsDisplay, PlainSpecRow } from '@/components/chars/SpecsDisplay';
import { useBgInk } from '@/lib/useBgInk';

/** 우측 정보 패널에서 「기본 정보」·탭 다음으로 쓰는 세 번째 특수 탭 값 — TRPG 버튼(EDIT·DELETE·
 *  GALLERY와 같은 자리)을 누르면 새 탭 전환과 같은 방식으로 이 값으로 바뀐다 (v2.8) */
const TRPG_TAB = '__trpg__';
/** 갤러리도 TRPG와 같은 방식 — 새 페이지로 가지 않고 우측 패널만 이 값으로 교체한다 (v3.1) */
const GALLERY_TAB = '__gallery__';
const REL_TAB = '__rel__';
const BGM_TAB = '__bgm__';

/** TRPG 탭 내용 — 플레이기록 게시판에서 이 캐릭터가 참여자로 등록된 기록만 모아 보여준다.
 *  단일 출처(PlayRecord.charIds)라 플레이기록 게시판에서 고치면 여기도 자동으로 반영된다 (v2.8) */
function TrpgSessionsList({ charId, order, records, chars }: { charId: string; order?: string[]; records: PlayRecord[]; chars: Character[] }) {
  const router = useRouter();
  const linkedAll = records.filter(r => r.charIds?.includes(charId));
  // 편집 화면(TrpgLinkEditView)에서 드래그로 정한 순서(trpgOrder)가 있으면 그대로,
  // 없으면(또는 순서에 없는 새 연결) 최신 날짜순으로 보여준다 (v2.9)
  const mine = order && order.length > 0
    ? [
      ...order.map(id => linkedAll.find(r => r.id === id)).filter((r): r is PlayRecord => !!r),
      ...linkedAll.filter(r => !order.includes(r.id)).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    ]
    : [...linkedAll].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const nameOf = (id: string) => chars.find(c => c.id === id)?.name ?? '';

  if (mine.length === 0) {
    return <p className="hint">아직 연결된 플레이기록이 없습니다</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
      {mine.map(r => {
        const others = (r.charIds ?? []).filter(id => id !== charId);
        return (
          <div key={r.id} style={{ border: '1.5px solid var(--line)', borderRadius: 9, padding: '10px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              {r.postId ? (
                <a onClick={() => router.push(`/board/${r.postId}`)} style={{ fontWeight: 700, cursor: 'var(--cur-pointer,pointer)' }}>{r.scenario}</a>
              ) : r.scenarioLink ? (
                <a href={r.scenarioLink} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{r.scenario}</a>
              ) : (
                <b>{r.scenario}</b>
              )}
              {r.date && <small style={{ color: 'var(--faint)' }}>{r.date}</small>}
              {r.role && <span className="pill" style={{ fontSize: 10.5 }}>{r.role}</span>}
            </div>
            {(others.length > 0 || r.withText) && (
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>
                With: {others.length > 0
                  ? others.map((id, i) => (
                    <React.Fragment key={id}>
                      {i > 0 && ', '}
                      {nameOf(id)
                        ? <a onClick={() => router.push(`/chars/${id}`)} style={{ cursor: 'var(--cur-pointer,pointer)' }}>{nameOf(id)}</a>
                        : null}
                    </React.Fragment>
                  ))
                  : r.withText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NaturalArt({ fileRef, ph, label }: { fileRef?: string; ph: string; label?: string }) {
  const url = useBlobUrl(fileRef);
  if (!url) {
    return (
      <div className={`ph ${ph}`} style={{ width: '100%', minHeight: 200, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius)' }}>
        {label && <span>{label}</span>}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '76vh', display: 'block', margin: '0 auto', borderRadius: 'var(--radius)' }} />;
}

/** 스테이지 좌측 — 항목이 많아도 화면 안에서 스크롤 없이 전부 보이도록(PC),
 *  내용 높이가 상자(위·아래 여백으로 정해진 높이)보다 크면 그만큼 비율로 줄여서 보여준다.
 *  내용 높이는 확대·축소(transform)의 영향을 받지 않아 줄였다 늘였다 하는 되먹임이 없다. 모바일(≤960px)은 그대로 쌓인다 */
function StageLeft({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const box = boxRef.current, inner = inRef.current;
    if (!box || !inner) return;
    const mq = window.matchMedia('(min-width:961px)');
    const calc = () => {
      const avail = box.clientHeight, need = inner.offsetHeight;
      const next = mq.matches && avail > 0 && need > avail ? Math.max(0.5, avail / need) : 1;
      setFit(prev => (Math.abs(prev - next) < 0.005 ? prev : next));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(box); ro.observe(inner);
    mq.addEventListener('change', calc);
    return () => { ro.disconnect(); mq.removeEventListener('change', calc); };
  }, []);
  return (
    <div className="cs-left" ref={boxRef}>
      <div className="cs-left-in" ref={inRef} style={{ '--fit': fit } as React.CSSProperties}>{children}</div>
    </div>
  );
}

/** 스테이지 배경 그림 — 화면 가득 채우도록 cover (등록한 그림 그대로) */
function StageArt({ fileRef, onClick }: { fileRef?: string; onClick?: () => void }) {
  const url = useBlobUrl(fileRef);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="cs-art" src={url} alt="" draggable={false} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} />;
}

/** 스테이지 하단 추가 이미지 줄 — 가운데 칸(좌·우 내용 사이)을 넘지 않는 폭까지만 보이고,
 *  더 많으면 마우스 휠·터치 스크롤이나 양옆 화살표로 넘긴다. 고른 썸네일은 항상 보이는 자리로 따라온다 */
function StageFaces({ arts, cur, off, ph, onPick }: { arts: string[]; cur: number; off: boolean; ph: string; onPick: (i: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [edge, setEdge] = useState({ l: true, r: false });
  const measure = () => {
    const t = track.current; if (!t) return;
    setMore(t.scrollWidth > t.clientWidth + 1);
    setEdge({ l: t.scrollLeft <= 1, r: t.scrollLeft + t.clientWidth >= t.scrollWidth - 1 });
  };
  useEffect(() => {
    const t = track.current; if (!t) return;
    measure();
    const ro = new ResizeObserver(measure); ro.observe(t);
    // 세로 휠을 가로 이동으로 — 넘칠 때만
    const wheel = (e: WheelEvent) => {
      if (t.scrollWidth <= t.clientWidth + 1) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault(); t.scrollLeft += d;
    };
    t.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); t.removeEventListener('wheel', wheel); };
  }, [arts.length]);
  // 고른 썸네일이 가운데 오도록
  useEffect(() => {
    const t = track.current; const el = t?.children[cur] as HTMLElement | undefined;
    if (!t || !el) return;
    t.scrollTo({ left: el.offsetLeft - t.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [cur, arts.length]);
  const page = (dir: -1 | 1) => track.current?.scrollBy({ left: dir * Math.max(64, (track.current.clientWidth - 64)), behavior: 'smooth' });
  return (
    <div className={`cs-faces${off ? ' off' : ''}`}>
      {more && <button type="button" className="cs-faces-arr" aria-label="이전 이미지" disabled={edge.l} onClick={() => page(-1)}>‹</button>}
      <div className="cs-faces-track" ref={track} onScroll={measure}>
        {arts.map((a, i) => (
          <div key={i} className={`fc ${i === cur ? 'on' : ''}`} onClick={() => onPick(i)}>
            <CroppedBlobImg fileRef={a} ph={ph} />
          </div>
        ))}
      </div>
      {more && <button type="button" className="cs-faces-arr" aria-label="다음 이미지" disabled={edge.r} onClick={() => page(1)}>›</button>}
    </div>
  );
}

function CharDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [chars, setChars, loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  // TRPG 참여 세션 (v2.8) — 플레이기록 게시판(PlayRecord.charIds)에서 이 캐릭터를 찾아 보여준다
  const [playRecords] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  const { familyOf } = useFonts();
  // 큰 글씨 — 추가 섹션(창고캐 등)이면 그 이름, 눌렀을 때도 그 목록으로 (v2.0 사용자 제보)
  const tt = useSectionTitle('chars', findByKey(chars, id)?.secId, 'CHARACTERS');
  const params = useSearchParams();
  // 스테이지 — 그림을 누르면 아래 썸네일 줄을 숨긴다 (갤러리 뷰어와 같은 방식, 다시 누르면 복귀)
  const [facesOff, setFacesOff] = useState(false);
  const [tab, setTab] = useState(() => {
    const t = params.get('tab');
    return t === 'trpg' ? TRPG_TAB : t === 'gallery' ? GALLERY_TAB : t === 'rel' ? REL_TAB : 'basic';
  });
  // 스테이지의 항목 창(Gallery·Relations·TRPG) — 페이지 내용(tab)과 따로 둬서, 창을 열어도 보던 탭 내용이 기본 정보로 돌아가지 않는다
  const [win, setWin] = useState<string | null>(() => {
    const t = params.get('tab');
    return t === 'trpg' ? TRPG_TAB : t === 'gallery' ? GALLERY_TAB : t === 'rel' ? REL_TAB : null;
  });
  const [artIdx, setArtIdx] = useState(0);
  // 스테이지 소개 본문 글자색 — 캐릭터마다 배경이 다르므로 지금 깔린 배경의 밝기를 재서 자동으로 (밝은 배경 → 어두운 글자)
  const bgInk = useBgInk();
  const [delAsk, setDelAsk] = useState(false);   // 캐릭터 삭제 확인
  const infoRef = useRef<HTMLDivElement>(null);

  // 별명 주소로도 열린다 (v2.0 사용자 요청 — 주소를 나중에 바꿔도 옛 주소가 살아 있게)
  const ch = findByKey(chars, id);

  // AU 프로필 (v1.9) — 이 캐릭터가 속한 자관들의 AU 리스트 (base 제외), 우상단에 썸네일로
  const charAus = useMemo(() => (ch
    ? rels.flatMap(r => r.members.some(m => m.charId === ch.id)
      ? r.aus.filter(a => a.id !== 'base').map(a => ({ key: `${r.id}:${a.id}`, label: a.label, relName: r.name }))
      : [])
    : []), [rels, ch]);
  // AU 편집에서 ?au= 로 돌아오면 그 AU가 선택된 채 시작
  const [auKey, setAuKey] = useState<string | null>(() => params.get('au'));
  // AU는 "새로 등록"하는 프로필 (v1.9 사용자 확정) — 등록 전엔 base를 보여주지 않고 등록 안내
  const auRegistered = !auKey || !!ch?.auProfiles?.[auKey];
  // 표시용 캐릭터 — AU에서 지정한 필드만 base를 대체 (이름·키·성별부터 전부 바뀔 수 있음)
  const eff = ch ? charWithAu(ch, auKey) : undefined;

  // AU 전환 시 탭 구성·아트가 달라지므로 리셋
  useEffect(() => { setTab('basic'); setWin(null); setArtIdx(0); }, [auKey]);
  // 탭마다 다른 아트를 보여줄 수 있어(v2.4), 탭을 옮기면 이미지 인덱스를 처음으로
  useEffect(() => { setArtIdx(0); }, [tab]);

  // 캐릭터 테마색 → 페이지 임시 테마 (4.18 방식, v1.9) — 기본 테마는 이제 공용 레이아웃
  // (chars/[id]/layout.tsx)이 계속 맡고 있어, 여기서는 AU가 기본과 다른 색을 쓸 때만
  // "얹어서" 덮어쓴다. 벗어날 때도 null이 아니라 레이아웃의 기본색으로 돌려줘야
  // 상세↔갤러리 이동 때 배경이 깜빡이던 문제가 재발하지 않는다 (v2.7)
  // 이 캐릭터 전용 BGM — 들어오면 플레이어가 이 BGM으로, 나가면 홈페이지 BGM으로 (열람 권한이 없으면 걸지 않는다)
  const bgmAllowed = !!ch && !(ch.visibility === 'private' && !isAdmin) && !(ch.visibility === 'member' && !user);
  usePageBgm(bgmAllowed ? `char:${ch!.id}` : undefined, bgmAllowed ? ch!.bgm : undefined);
  const { setPageTheme, setPageBgImage } = useTheme();
  const baseColor = ch?.themeMode === 'custom' ? ch.color : null;
  const auColor = auRegistered && eff?.themeMode === 'custom' ? eff.color : null;
  const baseTone = baseColor ? resolveThemeTone(ch?.themeTone, ch?.color) : undefined;
  const auTone = auColor ? resolveThemeTone(eff?.themeTone, eff?.color) : undefined;
  useEffect(() => {
    if (!auColor || (auColor === baseColor && auTone === baseTone)) return; // 기본과 같으면 레이아웃이 이미 칠해 둔 색 그대로 둔다
    setPageTheme(auColor, auTone);
    return () => setPageTheme(baseColor, baseTone);
  }, [auColor, auTone, baseColor, baseTone, setPageTheme]);

  // 배경 이미지 (v5.8 사용자 요청) — 자관 배경·환경설정 배경 변경과 똑같이 페이지 전체에 고정·cover로
  // 깔고 블러만 조절한다. AU는 자기 배경만(원본 것을 물려받지 않음 — charWithAu). 이미지가 없으면
  // 아무것도 하지 않아 사이트 배경이 그대로 보인다. 벗어나면 풀려서 사이트 배경으로 되돌아간다
  const bgUrl = useBlobUrl(auRegistered ? eff?.bgImgId : undefined);
  const bgBlur = eff?.bgBlur ?? 16;
  useEffect(() => {
    if (!bgUrl) return;
    setPageBgImage(bgUrl, bgBlur);
    return () => setPageBgImage(null);
  }, [bgUrl, bgBlur, setPageBgImage]);

  const curTab = eff?.tabs.find(t => t.id === tab);
  const tabHtml = useMemo(
    () => (loaded && curTab ? sanitizeHtml(curTab.html) : ''),
    [loaded, curTab],
  );
  const basicHtml = useMemo(
    () => (loaded && eff ? sanitizeHtml(eff.basicHtml) : ''),
    [loaded, eff],
  );

  if (!loaded) return <section className="page" />;
  if (!ch || !eff) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>캐릭터를 찾을 수 없습니다</p></div>
      </section>
    );
  }
  if (ch.visibility === 'private' && !isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>비공개 캐릭터입니다</p></div>
      </section>
    );
  }
  if (ch.visibility === 'member' && !user) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>멤버공개 — 로그인 후 열람할 수 있습니다</p></div>
      </section>
    );
  }

  // 탭 전환 시 정보 상단이 화면 맨 위로 오도록 스크롤 (모바일형, v1.9)
  const pickTab = (t: string) => {
    setTab(t);
    if (window.matchMedia('(max-width:960px)').matches) {
      infoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const editHref = auKey ? `/chars/${ch.id}/edit?au=${encodeURIComponent(auKey)}` : `/chars/${ch.id}/edit`;
  // 플레이기록 게시판 쪽에서 이미 이 캐릭터를 참여자로 연결해 둔 게 있으면, trpgEnabled를
  // 켜지 않았어도 TRPG 탭이 자동으로 보인다 (v3.0 사용자 요청)
  const hasTrpgLinks = playRecords.some(r => r.charIds?.includes(ch.id));

  /* ---------- 스테이지 레이아웃 데이터 (v7.0) ---------- */
  // 캐릭터마다 고른다(편집 → 상세 레이아웃). 안 고르면 스테이지, 「클래식」이면 예전 좌 아이콘탭·중앙 아트·우 패널
  const stage = ch.detailLayout !== 'classic';
  // 스테이지가 실제로 그려지는 상태 (AU 미등록 안내 화면은 제외)
  const stageShown = stage && !(auKey && !auRegistered);
  const canEditChar = isAdmin || charGrant(ch, user?.id) === 'edit';
  // 소개 본문 글자색 — 옵션(편집 > 본문 글자색): 자동(기본)이면 배경 밝기를 보고, 밝게/어둡게는 고정, 직접 지정은 그 색 그대로.
  // 'light'=밝은 글자 · 'dark'=어두운 글자 (그림자 색도 이에 맞춘다).
  // 직접 지정한 색은 글자색 자체는 그대로 쓰고, 글자를 받치는 그림자만 배경 밝기(bgInk)에 맞춘다
  const inkMode = eff.bodyInk ?? 'auto';
  const customInk = inkMode === 'custom' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(eff.bodyInkColor ?? '') ? eff.bodyInkColor! : null;
  const stageInk: 'light' | 'dark' = inkMode === 'light' ? 'light' : inkMode === 'dark' ? 'dark' : bgInk;
  const stageViewer = { isAdmin, canEdit: isAdmin || charGrant(ch, user?.id) === 'edit', loggedIn: !!user };
  const stageGallery = hasGallery(ch) ? charGalleryPosts(ch, rels, stageViewer) : [];
  const stageRel = ch.relEnabled ? charRelGroups(ch, chars, rels, { isAdmin, loggedIn: !!user }) : [];
  const stageTrpgCount = playRecords.filter(r => r.charIds?.includes(ch.id)).length;
  const stageTabArts = curTab?.arts && curTab.arts.length > 0 ? curTab.arts : null;
  const stageBaseArts = eff.arts && eff.arts.length > 0 ? eff.arts : (eff.artId ? [eff.artId] : []);
  // 첫 장은 목록용 대표·썸네일 전용이라 상세에는 2번째 장부터 (클래식과 같은 규칙)
  const stageArts = stageTabArts ?? (stageBaseArts.length > 1 ? stageBaseArts.slice(1) : stageBaseArts);
  const stageArtCur = Math.min(artIdx, Math.max(0, stageArts.length - 1));
  const stageArtRef = stageArts[stageArtCur] ?? (stageTabArts ? undefined : eff.artUrl);
  const stageWinTitle = win === GALLERY_TAB ? 'Gallery' : win === REL_TAB ? 'Relations' : win === TRPG_TAB ? 'TRPG' : win === BGM_TAB ? 'BGM' : '';
  // 항목 창 왼쪽 목록 — 우측 바로가기와 같은 조건으로 있는 항목만 (창 안에서 서로 오갈 수 있다)
  const stageWinItems: StageWindowItem[] = [
    ...(hasGallery(ch) ? [{ key: GALLERY_TAB, title: 'Gallery', sub: 'GALLERY' }] : []),
    ...(ch.relEnabled ? [{ key: REL_TAB, title: 'Relations', sub: 'RELATIONS' }] : []),
    ...((ch.trpgEnabled || hasTrpgLinks) ? [{ key: TRPG_TAB, title: 'TRPG', sub: 'SESSIONS' }] : []),
  ];
  // 추가 탭을 열었을 때 좌측에 띄울 항목 — 클래식과 같은 조건 (룰을 고르고 항목이 있을 때만)
  const stageTabSpecs = curTab?.rule && curTab.specs?.length ? curTab.specs : null;

  return (
    <section className={`page page-char-detail${stageShown ? ' is-stage' : ''}`}>
      <div className="page-head">
        {/* 제목 자리는 메뉴 이름 — 클릭 시 목록 복귀. 캐릭터 이름은 우측 프로필 패널에 크게 표시 */}
        {/* 스테이지에서는 이 제목·설명을 없애고, 같은 기능(목록으로)을 BACK 버튼으로 우측 상단에 둔다 */}
        {!stageShown && <PageTitle href={tt.href}>{tt.title}</PageTitle>}
        {/* 캐릭터별로 별도 저장 — 키에 캐릭터 id 포함 */}
        {!stageShown && <EditableDesc k={`char-detail-desc:${ch.id}`} def={stage ? '우측 항목을 누르면 창이 열립니다' : '좌측 아이콘 탭 → 우측 정보 전환'} />}
        <div className="head-actions">
          {/* 관리자 또는 「편집까지」 권한 회원 (3차 회원-캐릭터 연결, v1.9)
              — AU 선택 상태의 EDIT은 그 AU 전용 프로필 편집으로 진입 */}
          {/* 스테이지에서는 EDIT·DELETE가 좌측 항목 아래(탭 버튼 옆 작은 글씨)로 옮겨 가서 여기엔 안 나온다 */}
          {!stageShown && canEditChar && (
            <button className="btn btn-dark" onClick={() => router.push(editHref)}>EDIT</button>
          )}
          {/* 캐릭터당 갤러리 하나 — TRPG와 같은 방식으로, 새 페이지로 가지 않고
              우측 패널만 갤러리 그리드로 교체한다 (v3.1 사용자 요청 — 좌측 아이콘 탭·아트와
              상단 버튼 위치를 PROFILE 화면과 통일) */}
          {!stage && hasGallery(ch) && (
            <button className="btn btn-dark" onClick={() => setTab(GALLERY_TAB)}>GALLERY</button>
          )}
          {/* 관계(REL) 탭 (v6.8) — GALLERY와 같은 방식. 자관(페어·다인관)·직접 지정한 관계를 카드로 보여준다 */}
          {!stage && ch.relEnabled && (
            <button className="btn btn-dark" onClick={() => setTab(REL_TAB)}>RELATIONS</button>
          )}
          {/* TRPG 참여 세션 — 새 페이지로 가지 않고 새 탭 전환과 같은 방식으로 우측 패널만 교체 (v2.8) */}
          {!stage && (ch.trpgEnabled || hasTrpgLinks) && (
            <button className="btn btn-dark" onClick={() => setTab(TRPG_TAB)}>TRPG</button>
          )}
          {!stageShown && isAdmin && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
        </div>

        <ConfirmModal open={delAsk} title="캐릭터를 삭제하시겠습니까?"
          body="프로필·탭 정보가 함께 삭제되며 복구할 수 없습니다. 이 캐릭터가 들어간 자관에서는 멤버 표시가 사라집니다."
          onClose={() => setDelAsk(false)}
          buttons={[
            { label: 'DELETE', kind: 'accent', onClick: () => { setChars(chars.filter(c => c.id !== ch.id)); router.push(tt.href); } },
            { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
          ]} />
      </div>
      {/* AU 프로필 리스트 (v1.9) — 자관에 추가된 AU가 있으면 우상단.
          대표 썸네일 이미지는 목록(리스트) 화면 전용으로 두고, 캐릭터를 클릭해 들어온
          이 상세 화면에서는 이미지 없이 라벨만 보이는 버튼으로 전환함 (v2.3) */}
      {charAus.length > 0 && (
        <div className="au-list" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
          <div className={`au-item ${auKey === null ? 'on' : ''} ph ${ch.thumbClass}`} style={{ borderColor: auKey === null ? 'var(--accent)' : 'var(--line)' }}
            onClick={() => setAuKey(null)}>
            <small>원본</small>
          </div>
          {charAus.map(a => {
            /* 이 AU **자신의** 썸네일만 (v2.0 사용자 제보 — 「새 세계관을 만들면 리스트가 기존
               이미지로 채워져 있다」). charWithAu는 프로필이 아예 없으면 base를 그대로 돌려줘서,
               미등록 AU가 원본 그림을 빌려 쓰는 것처럼 보였다 — 안 넣었으면 색 플레이스홀더 */
            const p = ch.auProfiles?.[a.key];
            const ref = p?.thumbId ?? p?.arts?.[0];
            return (
              <div key={a.key} className={`au-item ${auKey === a.key ? 'on' : ''} ph ${ch.thumbClass}`}
                style={{ borderColor: auKey === a.key ? 'var(--accent)' : 'var(--line)' }}
                data-tip={`${a.relName} · ${a.label}`}
                onClick={() => setAuKey(a.key)}>
                {ref && <CroppedBlobImg fileRef={ref} crop={p?.thumbCrop} ph={ch.thumbClass} />}
                <small>{a.label}</small>
              </div>
            );
          })}
        </div>
      )}
      {/* AU 미등록 (v1.9 사용자 확정) — base를 보여주지 않고 그 AU에 맞춰 캐릭터를 새로 등록 */}
      {auKey && !auRegistered ? (
        <div className="panel" style={{ textAlign: 'center', padding: 56 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '.14em', marginBottom: 8 }}>
            {charAus.find(a => a.key === auKey)?.label ?? 'AU'}
          </div>
          <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 16 }}>
            이 AU의 「{ch.name}」이 아직 등록되지 않았습니다 — 등록하면 이 캐릭터의 AU 프로필로 연동됩니다
          </p>
          {(isAdmin || charGrant(ch, user?.id) === 'edit') && (
            <button className="btn btn-dark" onClick={() => router.push(editHref)}>＋ AU 캐릭터 등록</button>
          )}
        </div>
      ) : (
      stage ? (
      <div className="cs" data-ink={stageInk}
        style={{ fontFamily: familyOf(eff.bodyFontId), ...(customInk ? { '--cs-body': customInk } as React.CSSProperties : {}) }}>
        {/* 배경 — 등록한 그림 그대로 (추가 탭에 전용 그림이 있으면 그 탭을 여는 동안 그 그림) */}
        <div className="cs-bg">
          {stageArtRef
            ? <StageArt key={stageArtRef} fileRef={stageArtRef} onClick={stageArts.length > 1 ? () => setFacesOff(v => !v) : undefined} />
            : <div className={`cs-ph ph ${ch.thumbClass}`}><span>CHARACTER FULL ART</span></div>}
        </div>
        {stageArts.length > 1 && (
          <StageFaces arts={stageArts} cur={stageArtCur} off={facesOff} ph={ch.thumbClass} onPick={setArtIdx} />
        )}

        {/* BACK — 제목(CHARACTERS)을 누르면 목록으로 돌아가던 것과 같은 기능. EDIT/DELETE와 같은 작은 글씨 버튼으로 우측 상단에 */}
        <div className="cs-tabs cs-admin cs-back">
          <button onClick={() => router.push(tt.href)}><b>BACK</b></button>
        </div>

        {/* 좌측 — 한 줄 소개 → 이름 → 다른 표기(있을 때만) → 기본 정보 항목 (박스 없이 배경 위에 바로) */}
        <StageLeft>
          {/* 맨 윗줄 — 한 줄 소개 옆에 관리 버튼(상단 EDIT/DELETE를 옮겨 온 것). 탭 버튼과 같은 작은 글씨 모양
              (EDIT은 편집 권한자, DELETE는 관리자만 — 권한 조건은 예전 상단 버튼과 같다). 소개가 길면 버튼이 다음 줄로 내려간다 */}
          {(eff.sub || canEditChar || isAdmin) && (
            <div className="cs-top">
              {eff.sub && <div className="cs-tag">{eff.sub}</div>}
              {(canEditChar || isAdmin) && (
                <div className="cs-tabs cs-admin">
                  {canEditChar && <button onClick={() => router.push(editHref)}><b>EDIT</b></button>}
                  {isAdmin && <button onClick={() => setDelAsk(true)}><b>DELETE</b></button>}
                </div>
              )}
            </div>
          )}
          <div className="cs-name" style={{
            fontFamily: familyOf(eff.fontId) ?? 'var(--serif)', fontSize: Math.round((eff.nameSize ?? 38) * 1.35),
            fontWeight: (eff.nameBold ?? true) ? 700 : 400, letterSpacing: '.08em',
          }}>{eff.name}</div>
          {eff.altName && <div className="cs-alt">{eff.altName}</div>}
          {/* 추가 탭을 열었으면 그 탭의 항목(룰별 정보란)으로, 아니면 기본 정보 항목 */}
          {(!curTab || stageTabSpecs) && (
            <div className="cs-specs">
              {curTab ? <SpecsDisplay specs={stageTabSpecs!} stage /> : (
                <>
                  <SpecsDisplay specs={eff.specs} stage />
                  {eff.sheetUrl && (
                    <PlainSpecRow label="CHARACTER SHEET" stage>
                      <a href={eff.sheetUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>LINK ↗</a>
                    </PlainSpecRow>
                  )}
                  {eff.colors.length > 0 && (
                    <PlainSpecRow label="테마컬러" stage>
                      <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                        {eff.colors.map(c => {
                          const tip = eff.colorTipMode === 'label' ? (c.label || c.hex.toUpperCase())
                            : eff.colorTipMode === 'both' ? (c.label ? `${c.label} · ${c.hex.toUpperCase()}` : c.hex.toUpperCase())
                            : c.hex.toUpperCase();
                          return <span key={c.hex + c.label} className="sw-static" data-hex={tip} style={{ background: c.hex, boxShadow: chipBorder(eff.colorBd) }} />;
                        })}
                      </span>
                    </PlainSpecRow>
                  )}
                </>
              )}
            </div>
          )}
          {/* 추가 탭(ADD TAB) 이동 버튼 — 누르면 이 페이지의 내용이 그 탭의 항목·본문·그림으로 바뀐다 */}
          {eff.tabs.length > 0 && (
            <div className="cs-tabs">
              <button className={!curTab ? 'on' : ''} onClick={() => { setTab('basic'); setWin(null); }}>
                <b>기본 정보</b><span className="k">Basic</span>
              </button>
              {eff.tabs.map(t => (
                <button key={t.id} className={curTab?.id === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setWin(null); }}>
                  <b>{t.title}</b><span className="k">{t.subtitle || 'Tab'}</span><i>›</i>
                </button>
              ))}
            </div>
          )}
        </StageLeft>

        {/* 우측 — 소개 본문(탭을 열었으면 그 탭의 본문) · 항목 바로가기 (이름·한 줄 소개는 좌측으로 이동) */}
        <div className="cs-right" ref={infoRef}>
          {curTab && (
            <div className="cs-tabhead"><b>{curTab.title}</b>{curTab.subtitle && <span>{curTab.subtitle}</span>}</div>
          )}
          <div className={`cs-intro prose${curTab ? ' tab' : ''}`} dangerouslySetInnerHTML={{ __html: curTab ? tabHtml : basicHtml }} />
          <div className="cs-links">
            {/* BGM 바로가기는 표시하지 않는다 (사용자 요청) — 이 캐릭터 BGM은 페이지에 들어오면 플레이어에서 그대로 재생된다 */}
            {hasGallery(ch) && (
              <button className="cs-link" onClick={() => setWin(GALLERY_TAB)}>
                <span className="cs-link-k">Gallery</span>
                <span className="cs-link-s">{stageGallery.length ? `사진 묶음 ${stageGallery.length}개` : '아직 없음'}</span>
                <span className="cs-link-a">→</span>
              </button>
            )}
            {ch.relEnabled && (
              <button className="cs-link" onClick={() => setWin(REL_TAB)}>
                <span className="cs-link-k">Relations</span>
                <span className="cs-link-s">{stageRel.length ? stageRel.map(g => `${g.name} ${g.cards.length}`).join(' · ') : '아직 없음'}</span>
                <span className="cs-link-a">→</span>
              </button>
            )}
            {(ch.trpgEnabled || hasTrpgLinks) && (
              <button className="cs-link" onClick={() => setWin(TRPG_TAB)}>
                <span className="cs-link-k">TRPG</span>
                <span className="cs-link-s">{stageTrpgCount ? `참여 세션 ${stageTrpgCount}개` : '아직 없음'}</span>
                <span className="cs-link-a">→</span>
              </button>
            )}
          </div>
        </div>

        {/* 항목 창 — 옆으로 펼쳐지며 열린다 (BGM·갤러리·관계·TRPG. 추가 탭은 창 없이 페이지 내용이 바뀐다) */}
        {win && (
          <StageWindow title={stageWinTitle} name={eff.name} items={stageWinItems} current={win} onSelect={setWin} onClose={() => setWin(null)}>
            {win === BGM_TAB ? (
              <div style={{ display: 'grid', gap: 18 }}>
                {(ch.bgm?.playlists ?? []).filter(pl => pl.tracks.length > 0).map(pl => (
                  <div key={pl.id}>
                    <b style={{ fontSize: 13, letterSpacing: '.08em' }}>{pl.title}</b>
                    <div style={{ marginTop: 6 }}>
                      {pl.tracks.map((t, i) => (
                        <div key={t.id} className="set-row" style={{ padding: '8px 2px' }}>
                          <div className="l"><b>{i + 1}. {t.title}</b><small>{t.artist}{t.duration ? ` · ${t.duration}` : ''}</small></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="hint" style={{ margin: 0 }}>이 페이지에 들어오면 플레이어에서 이 BGM이 재생됩니다</p>
              </div>
            ) : win === TRPG_TAB ? (
              <TrpgSessionsList charId={ch.id} order={ch.trpgOrder} records={playRecords} chars={chars} />
            ) : win === REL_TAB ? (
              <RelTab groups={stageRel} />
            ) : (
              <GalleryPanel ph={ch.thumbClass} loggedIn={!!user} posts={stageGallery} canSeePrivate={stageViewer.canEdit} />
            )}
          </StageWindow>
        )}
      </div>
      ) : (
      <div className="profile-wrap">
        {/* 좌측 아이콘 탭 — AU면 그 AU의 탭 구성 */}
        <div className="side-icons">
          <button className={tab === 'basic' ? 'on' : ''} data-tip="기본 정보" onClick={() => pickTab('basic')}>☰</button>
          {eff.tabs.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} data-tip={t.title} onClick={() => pickTab(t.id)}>{t.icon}</button>
          ))}
          {isAdmin && (
            <button data-tip="탭 추가 (편집모드)" style={{ borderStyle: 'dashed', fontSize: 13 }}
              onClick={() => router.push(editHref)}>＋</button>
          )}
        </div>

        {/* 중앙 아트 — 스티키 · 원본 비율 그대로 표시(자르거나 늘이지 않음, v2.3) ·
            추가 아트가 있으면 아래 썸네일 줄로 전환 (TRPG 캐릭터 게시판과 같은 방식) ·
            탭에 전용 아트가 등록돼 있으면 그 탭을 보는 동안은 그 아트로 대체 (v2.4) */}
        {tab !== GALLERY_TAB && (() => {
          const tabArts = curTab?.arts && curTab.arts.length > 0 ? curTab.arts : null;
          const baseArts = eff.arts && eff.arts.length > 0 ? eff.arts : (eff.artId ? [eff.artId] : []);
          // 첫 장은 목록용 「대표·썸네일」 전용 — 상세 화면에는 2번째 장부터("추가 아트")만 노출한다.
          // 탭 전용 아트는 애초에 전부 "추가 아트"라 이 제외 규칙이 적용되지 않는다.
          const displayArts = tabArts ?? (baseArts.length > 1 ? baseArts.slice(1) : baseArts);
          const fallbackUrl = tabArts ? undefined : eff.artUrl;
          if (displayArts.length === 0 && !fallbackUrl) {
            return (
              <div className="char-art-wrap panel" style={{ padding: 14 }}>
                <div className={`profile-center ph ${ch.thumbClass}`}><span>CHARACTER FULL ART</span></div>
              </div>
            );
          }
          const cur = Math.min(artIdx, displayArts.length - 1);
          return (
            <div className="char-art-wrap panel" style={{ padding: 14 }}>
              <div className="profile-center"
                style={{ cursor: displayArts.length > 1 ? 'pointer' : undefined }}
                onClick={() => { if (displayArts.length > 1) setArtIdx(i => (i + 1) % displayArts.length); }}>
                <NaturalArt fileRef={displayArts[cur] ?? fallbackUrl} ph={ch.thumbClass} label="CHARACTER FULL ART" />
              </div>
              {/* 썸네일 줄에도 같은 목록을 그대로 사용 */}
              {displayArts.length > 1 && (
                <div className="tc-faces">
                  {displayArts.map((a, i) => (
                    <div key={i} className={`fc ${i === cur ? 'on' : ''}`} onClick={() => setArtIdx(i)}>
                      <CroppedBlobImg fileRef={a} ph={ch.thumbClass} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 우측 정보 패널 — 최상단 캐릭터 이름 크게 (v1.6) · AU면 그 AU의 이름·폰트 */}
        <div className={`panel profile-info${tab === GALLERY_TAB ? ' gal-full' : ''}`} ref={infoRef} style={{ fontFamily: familyOf(eff.bodyFontId) }}>
          {/* 크기는 캐릭터마다 직접 정한다 (등록·수정의 「이름 크기」) — 자동으로 줄이면
              이름 길이에 따라 어중간해져서, 정한 크기를 그대로 쓴다 (v2.0 사용자 확정) */}
          <div style={{
            fontFamily: familyOf(eff.fontId) ?? 'var(--serif)', fontSize: eff.nameSize ?? 38,
            // 굵기는 끌 수 있다 (v2.0 사용자 요청 — 폰트에 따라 볼드가 안 어울린다). 기본은 지금처럼 굵게
            fontWeight: (eff.nameBold ?? true) ? 600 : 400,
            letterSpacing: '.2em', lineHeight: 1.1,
          }}>{eff.name}</div>
          {eff.altName && <div className="sub" style={{ marginBottom: 4 }}>{eff.altName}</div>}
          <div className="sub" style={{ marginBottom: 14 }}>{eff.sub}</div>

          {tab === 'basic' ? (
            <>
              {/* 기본 정보 탭은 제목을 두지 않는다 — 처음 보이는 화면이라 안내가 필요 없다
                  (다른 탭은 무엇을 보는 중인지 알아야 하므로 제목을 그대로 둔다) */}
              <SpecsDisplay specs={eff.specs} />
              {eff.sheetUrl && (
                <PlainSpecRow label="CHARACTER SHEET">
                  <a href={eff.sheetUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>LINK ↗</a>
                </PlainSpecRow>
              )}
              {eff.colors.length > 0 && (
                <PlainSpecRow label="테마컬러">
                  <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                    {/* 색 점 나열 — hex는 호버 툴팁만 (v1.8) */}
                    {eff.colors.map(c => {
                      // 툴팁 표기: hex / 이름+hex / 이름만 (등록 시 선택)
                      const tip = eff.colorTipMode === 'label' ? (c.label || c.hex.toUpperCase())
                        : eff.colorTipMode === 'both' ? (c.label ? `${c.label} · ${c.hex.toUpperCase()}` : c.hex.toUpperCase())
                        : c.hex.toUpperCase();
                      return (
                        <span key={c.hex + c.label} className="sw-static" data-hex={tip}
                          style={{ background: c.hex, boxShadow: chipBorder(eff.colorBd) }} />
                      );
                    })}
                  </span>
                </PlainSpecRow>
              )}
              <div className="prose" dangerouslySetInnerHTML={{ __html: basicHtml }} />
            </>
          ) : tab === TRPG_TAB ? (
            <>
              <h3 className="tab-tt">TRPG</h3>
              <TrpgSessionsList charId={ch.id} order={ch.trpgOrder} records={playRecords} chars={chars} />
            </>
          ) : tab === REL_TAB ? (
            <>
              <h3 className="tab-tt">Relations</h3>
              <RelTab groups={charRelGroups(ch, chars, rels, { isAdmin, loggedIn: !!user })} />
            </>
          ) : tab === GALLERY_TAB ? (
            <>
              <h3 className="tab-tt">Gallery</h3>
              <GalleryPanel ph={ch.thumbClass} loggedIn={!!user}
                posts={charGalleryPosts(ch, rels, { isAdmin, canEdit: isAdmin || charGrant(ch, user?.id) === 'edit', loggedIn: !!user })}
                canSeePrivate={isAdmin || charGrant(ch, user?.id) === 'edit'} />
            </>
          ) : (
            <>
              <h3 className="tab-tt">{curTab?.title}</h3>
              {curTab?.subtitle && <div className="sub">{curTab.subtitle}</div>}
              {/* 이 탭에 TRPG 룰을 지정했으면(ADD TAB에서도 지원) 정보란을 본문 위에 표시 */}
              {curTab?.rule && curTab.specs?.length ? <SpecsDisplay specs={curTab.specs} /> : null}
              <div className="prose" dangerouslySetInnerHTML={{ __html: tabHtml }} />
            </>
          )}
        </div>
      </div>
      ))}

      {/* 대표 아트 위치 조정 기능은 사진을 잘라 채우던 방식(cover)일 때만 의미가 있었는데,
          이제 원본 비율 그대로 보여주는 방식으로 바뀌어 더 이상 필요하지 않아 제거함 (v2.3) */}
    </section>
  );
}

/** 상세 아트 위치 편집기 (v2.0) — 실제 표시 영역의 비율 그대로 열어야 보이는 대로 맞출 수 있다.
 *  이 영역은 화면 높이에 따라 달라지므로 고정 비율(3:4 등)을 쓰면 편집기와 결과가 어긋난다. */
function ArtCropModal({ fileRef, ratio, crop, onClose, onApply }: {
  fileRef: string; ratio: number; crop?: CropValue; onClose: () => void; onApply: (c: CropValue) => void;
}) {
  const url = useBlobUrl(fileRef);
  if (!url) return null;
  return (
    <CropEditor open src={url} aspect={ratio} aspectLabel="상세 화면과 같은 비율"
      initial={crop} onClose={onClose} onApply={onApply} />
  );
}

export default function CharDetailPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><CharDetailInner /></Suspense>;
}
