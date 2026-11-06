'use client';
// 메인 위젯 렌더러 (4.0) — DIARY/LATEST/UPCOMING 등은 해당 기능(2·3차) 전까지 데모 데이터
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { WidgetConf, useMainStore, WIDGET_META, decoSlides } from '@/lib/mainStore';
import { useAuth } from '@/lib/auth';
import { boardEntries, useMenuSettings, buildMenu, canViewHref } from '@/lib/menuStore';
import { sectionHref, MAIN_SEC, useSections, sectionMenuEntries, SECTION_META } from '@/lib/sectionStore';
import type { ThreadWork } from '@/lib/threadStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { useBoards, boardHref } from '@/lib/boardStore';
import { Modal } from '@/components/ui/Modal';
import { KInput, KTextarea, KSelect, KStep, KCheck } from '@/components/ui/Kit';
import { ColorField } from '@/components/ui/ColorField';
import { RichEditor } from '@/components/ui/RichEditor';
import { HtmlBody } from '@/components/ui/HtmlBody';
import {
  OrbitSky, OrbitSkySettings, ORBIT_DEFAULT_SIZE, ORBIT_DEFAULT_TILT, ORBIT_DEFAULT_STAR, ORBIT_DEFAULT_COUNT, ORBIT_MAX_COUNT, ORBIT_DEFAULT_WIDTH,
} from '@/components/main/OrbitSky';
import { useFonts } from '@/lib/fontStore';
import { BannerEditor, BannerSlide, DEMO_SLIDES, DdayEditor, DecoEditor, TodoEditor, TodoSetItem } from '@/components/main/widgetEditors';
import { CroppedBlobImg, CropValue } from '@/components/ui/CropEditor';
import { useLocalList, type Post } from '@/lib/postStore';
import { RoadItem, ROAD_SEED, BackupPost, BACKUP_SEED } from '@/lib/galleryStore';
import { DiaryPost, DIARY_SEED, Mood, MOOD_SEED, moodTint } from '@/lib/diaryStore';
import { useSched, eventColor } from '@/lib/schedStore';
import { StickyMemo, MEMO_SEED, MEMO_SIZE_W, useMemoSettings } from '@/lib/memoStore';
import { BlobImg, useBlobUrl } from '@/lib/blobStore';
import { normalizeInternalLink } from '@/lib/link';
import {
  Applicant, APPLY_SEED, useCommSettings, badgeStyle, maskName, inTrash,
} from '@/lib/commStore';

/* 편집모드 우클릭 「설정」 → 해당 위젯의 설정 모달 열기 (v1.9 사용자 확정 — 이벤트로 연결) */
function useEditEvent(id: string, onOpen: () => void) {
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail?.id === id) onOpen(); };
    window.addEventListener('ohome-widget-edit', h);
    return () => window.removeEventListener('ohome-widget-edit', h);
  }, [id, onOpen]);
}

/* ---------- 슬라이드 배너 (고정 요소, 4.0) — 이미지·링크·간격·순서 관리 ---------- */

export function BannerWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const router = useRouter();
  const [cur, setCur] = useState(0);
  const [mngOpen, setMngOpen] = useState(false);
  useEditEvent(conf.id, () => setMngOpen(true));   // 편집모드 우클릭 → 설정 (v1.9)
  const slides = ((conf.settings.slides as BannerSlide[]) ?? []).length > 0
    ? (conf.settings.slides as BannerSlide[]) : DEMO_SLIDES;
  const interval = (conf.settings.interval as number) ?? 4;

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setCur(c => (c + 1) % slides.length), Math.max(2, interval) * 1000);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  const s = slides[Math.min(cur, slides.length - 1)];
  const go = () => {
    if (editOn || !s.link) return;
    // 기존 저장분에 풀주소가 있어도 같은 사이트면 내부 이동으로 (v1.9)
    const l = normalizeInternalLink(s.link);
    if (/^https?:\/\//.test(l)) window.open(l, '_blank');
    else router.push(l);
  };

  return (
    <div className="banner" style={{ cursor: s.link && !editOn ? 'pointer' : undefined }} onClick={go}>
      {slides.map((sl, i) => (
        <div key={sl.id} className={`slide ${i === Math.min(cur, slides.length - 1) ? 'on' : ''}`}>
          {sl.imgId
            /* 업로드 이미지 — 원본 보존 + 위치 크롭만 적용 (배너 크기가 바뀌어도 비율 좌표로 재현) */
            ? <CroppedBlobImg fileRef={sl.imgId} crop={sl.crop} ph="" />
            : sl.img
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={sl.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div className={`ph ${sl.cls ?? ''}`} style={{ position: 'absolute', inset: 0 }}><span>SLIDE BANNER {String(i + 1).padStart(2, '0')}</span></div>}
        </div>
      ))}
      <div className="cap"><b>{s.cap}</b><span>{s.sub}</span></div>
      <div className="dots" onClick={e => e.stopPropagation()}>
        {slides.map((sl, i) => (
          <i key={sl.id} className={i === Math.min(cur, slides.length - 1) ? 'on' : ''} onClick={() => setCur(i)} />
        ))}
      </div>
      {/* 배너 관리 (관리자) — 배너에 마우스를 올렸을 때만 표시 */}
      {isAdmin && !editOn && (
        <button className="hv-actions"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 4, fontSize: 10.5, letterSpacing: '.06em',
            padding: '5px 11px', borderRadius: 999, background: 'rgba(15,17,20,.55)', color: '#dfe2e7',
          }}
          onClick={e => { e.stopPropagation(); setMngOpen(true); }}>MANAGE</button>
      )}
      <div onClick={e => e.stopPropagation()}>
        <Modal open={mngOpen} onClose={() => setMngOpen(false)} title="슬라이드 배너 관리"
          desc="이미지 업로드 · 캡션 · 링크(내부 경로 또는 외부 URL) · ⠿ 드래그로 순서 · 원본은 잘리지 않음">
          {mngOpen && <BannerEditor conf={conf} onSaved={() => setMngOpen(false)} onClose={() => setMngOpen(false)} />}
        </Modal>
      </div>
    </div>
  );
}

/* ---------- 메뉴리스트 (모바일 전용, 8장) ---------- */
export function MenuListWidget() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [menuSet, , menuLoaded] = useMenuSettings(); // 메뉴 관리 (5.2) 반영
  const { boards, loaded: boardsLoaded } = useBoards(); // 다중 게시판 (5.2)
  const { user: wUser, isAdmin: wIsAdmin } = useAuth(); // 공개범위 필터 (v1.9)
  const { map: wSecMap } = useSections();      // 여러 개로 만든 섹션 (v2.0 — 빠져 있었다)
  const { links: wLinks } = useCustomLinks();  // 커스텀 링크 (v2.0)
  return (
    <div className="panel menu-list wgt-menu">
      {(menuLoaded && boardsLoaded
        ? buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(wSecMap), ...linkEntries(wLinks)], { loggedIn: !!wUser, isAdmin: wIsAdmin, id: wUser?.id })
        : []).map(m =>
        m.children ? (
          <div key={m.label} className={`mgrp ${open === m.label ? 'open' : ''}`}>
            <a onClick={() => setOpen(o => (o === m.label ? null : m.label))}>{m.label}</a>
            <div className="msub">
              {/* 커스텀 링크의 외부 주소는 새 창 (v2.0) — 상단 메뉴와 같은 규칙 */}
              {m.children.map(c => (
                <a key={c.href} onClick={() => (/^https?:\/\//.test(c.href) ? window.open(c.href, '_blank') : router.push(c.href))}>{c.label}</a>
              ))}
            </div>
          </div>
        ) : (
          <a key={m.label} onClick={() => (/^https?:\/\//.test(m.href!) ? window.open(m.href!, '_blank') : router.push(m.href!))}>{m.label}</a>
        )
      )}
    </div>
  );
}

/* ---------- MEMO — 관리자 클릭 시 큰 편집 모달 (4.12 v1.8) ---------- */
export function MemoWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const text = (conf.settings.text as string) ?? '';
  useEditEvent(conf.id, () => { setDraft(text); setOpen(true); });   // 편집모드 우클릭 → 설정 (v1.9)
  return (
    <div className="panel widget" style={{ cursor: isAdmin ? 'pointer' : undefined }}
      onClick={e => { if ((e.target as HTMLElement).closest('.modal-ov')) return; if (isAdmin && !editOn) { setDraft(text); setOpen(true); } }}>
      <h4>MEMO {isAdmin && <span className="more">관리 ›</span>}</h4>
      <p style={{ fontSize: 12, lineHeight: 1.7, color: '#3a3f47', whiteSpace: 'pre-line' }}>{text || '메모가 비어 있습니다'}</p>

      <Modal open={open} onClose={() => setOpen(false)} title="메모 관리" desc="메인 메모 위젯 내용 — 관리자 전용"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            updateWidget(conf.id, { settings: { ...conf.settings, text: draft } }, { persist: true }); setOpen(false);
          }}>SAVE</button>
        </>}>
        <KTextarea value={draft} onChange={e => setDraft(e.target.value)} />
      </Modal>
    </div>
  );
}

/* ---------- DIARY (최근 일기 — 실데이터, 4.14) ---------- */
export function DiaryWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [posts] = useLocalList<DiaryPost>('ohome.diary.v1', DIARY_SEED);
  const [moods] = useLocalList<Mood>('ohome.moods.v1', MOOD_SEED);
  // 메뉴에서 비공개로 둔 다이어리는 위젯에도 안 나온다 (v2.0 사용자 발견 — 위젯으로 새던 것)
  const [menuSet] = useMenuSettings();
  const viewer = { loggedIn: !!user, isAdmin, id: user?.id };
  const canSee = canViewHref(menuSet, '/diary', viewer);
  // 비공개 일기는 위젯에 절대 노출되지 않음 — 관리자여도 (4.14)
  const latest = posts
    .filter(p => canViewHref(menuSet, sectionHref('diary', p.secId ?? MAIN_SEC), viewer))
    .filter(p => p.visibility === 'public' || (p.visibility === 'member' && !!user))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (!canSee) return null;   // 메뉴가 비공개면 위젯 자체를 띄우지 않는다 (v2.0)
  return (
    <div className="panel widget" style={{ margin: 0 }}>
      <h4>DIARY <span className="more" onClick={() => router.push('/diary')}>더보기 ›</span></h4>
      {latest.map(p => {
        const m = moods.find(x => x.id === p.moodId);
        return (
          <div key={p.id} className="diary-mini" onClick={() => router.push(`/diary#${p.id}`)}>
            <div className="mood" style={{ background: moodTint(m?.color ?? '#888'), color: m?.color }}>{m?.icon ?? '·'}</div>
            <div className="t"><span className="tt">{p.title}</span> <small>{p.date.slice(5).replace('-', '.')}{m ? ` · ${m.name}` : ''}</small></div>
          </div>
        );
      })}
      {latest.length === 0 && <p className="hint">공개된 일기가 없습니다</p>}
    </div>
  );
}

/* ---------- RECENT ENTRIES (최신글 — 공개 게시판 전체 또는 게시판 하나, 2~6개) ----------
   비밀글은 절대 나오지 않는다 (관리자 포함). 메뉴에서 이 방문자에게 감춘 게시판의 글도 나오지 않는다.
   배너 게시판은 글이 아니라 배너 이미지라 뺀다. 가운데에는 어느 게시판의 글인지 적는다. */
export function RecentWidget({ conf }: { conf: WidgetConf }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [menuSet] = useMenuSettings();
  const { boards } = useBoards();
  const [posts] = useLocalList<Post>('ohome.board.v1', []);
  const [roads] = useLocalList<RoadItem>('ohome.road.v1', ROAD_SEED);
  const [backups] = useLocalList<BackupPost>('ohome.backup.v1', BACKUP_SEED);
  const [works] = useLocalList<ThreadWork>('ohome.threads.v1', []);
  const { list: secList } = useSections();
  const [open, setOpen] = useState(false);
  useEditEvent(conf.id, () => setOpen(true));

  const count = Math.max(2, Math.min(6, (conf.settings.count as number) ?? 5));
  // 고르는 값: '__all' 전체 · '__gallery' · '__road' · '__thread' · 그 밖에는 게시판 id
  const pick = (conf.settings.board as string) || '__all';
  const viewer = { loggedIn: !!user, isAdmin, id: user?.id };
  const usable = boards.filter(b => b.skin !== 'banner' && canViewHref(menuSet, boardHref(b.id), viewer));
  const usableIds = new Set(usable.map(b => b.id));
  const nameOf = (id?: string) => boards.find(b => b.id === (id || 'main'))?.name ?? '';
  const secName = (kind: 'gallery' | 'roadview' | 'threads', id?: string) =>
    secList(kind).find(x => x.id === (id || MAIN_SEC))?.name ?? SECTION_META[kind].defName;
  const okSec = (kind: 'gallery' | 'roadview' | 'threads', id?: string) =>
    canViewHref(menuSet, SECTION_META[kind].href, viewer) && canViewHref(menuSet, sectionHref(kind, id ?? MAIN_SEC), viewer);
  const visOk = (v: string) => v === 'public' || (v === 'member' && !!user);   // 비공개는 관리자여도 안 나온다

  type Row = { key: string; title: string; where: string; date: string; href: string; src: string };
  const rows: Row[] = [];
  if (pick === '__all' || !pick.startsWith('__')) {
    posts.filter(p => !p.secret && usableIds.has(p.boardId || 'main') && (pick === '__all' || (p.boardId || 'main') === pick))
      .forEach(p => rows.push({ key: `p-${p.id}`, title: p.title, where: nameOf(p.boardId), date: p.date, href: `/board/${p.id}`, src: 'board' }));
  }
  if (pick === '__all' || pick === '__gallery') {
    backups.filter(p => visOk(p.visibility) && !p.fold && okSec('gallery', p.secId))
      .forEach(p => rows.push({ key: `g-${p.id}`, title: p.title, where: secName('gallery', p.secId), date: p.date, href: `/gallery/${p.id}`, src: 'gallery' }));
  }
  if (pick === '__all' || pick === '__road') {
    roads.filter(it => !it.fold && okSec('roadview', it.secId))
      .forEach(it => rows.push({ key: `r-${it.id}`, title: it.title || `No.${String(it.no ?? 0).padStart(3, '0')}`, where: secName('roadview', it.secId), date: it.date, href: sectionHref('roadview', it.secId ?? MAIN_SEC), src: 'road' }));
  }
  if (pick === '__all' || pick === '__thread') {
    works.filter(w => visOk(w.visibility) && okSec('threads', w.secId))
      .forEach(w => rows.push({
        key: `t-${w.id}`, title: w.title, where: secName('threads', w.secId),
        date: w.posts.reduce((m, x) => (x.date > m ? x.date : m), w.created), href: sectionHref('threads', w.secId ?? MAIN_SEC), src: 'thread',
      }));
  }
  const shown = rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
  const md = (iso: string) => iso.slice(5, 10);

  const boardOpts = [
    { value: '__all', label: '공개된 곳 전체' },
    { value: '__gallery', label: '갤러리' },
    { value: '__road', label: '로드비' },
    { value: '__thread', label: '감상타래(리뷰)' },
    ...boards.filter(b => b.skin !== 'banner').map(b => ({ value: b.id, label: b.name })),
  ];
  const set = (p: Record<string, unknown>) => updateWidget(conf.id, { settings: { ...conf.settings, ...p } }, { persist: true });

  return (
    <div className="panel widget recent-w">
      <h4>RECENT ENTRIES <span className="more" style={{ cursor: 'default' }}>최신글</span></h4>
      <ul className="recent-list">
        {shown.map(p => (
          <li key={p.key} onClick={() => { if (!editOn) router.push(p.href); }}>
            <span className="rt">{p.title}</span>
            <span className="rb">{p.where}</span>
            <span className="rd">{md(p.date)}</span>
          </li>
        ))}
        {shown.length === 0 && <li className="recent-empty">새 글이 없습니다</li>}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} small title="최신글 위젯"
        desc="비밀글·비공개 항목은 어떤 설정에서도 보이지 않습니다"
        actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>확인</button>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb" style={{ minWidth: 58 }}>게시판</span>
            <KSelect options={boardOpts} value={pick} onChange={v => set({ board: v })} minWidth={170} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="cp-lb" style={{ minWidth: 58 }}>몇 개</span>
            <KStep value={count} min={2} max={6} suffix="개" onChange={v => set({ count: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- LATEST (최신 그림 — 로드비 + 갤러리 통합 최신 3장, v1.9 사용자 피드백) ---------- */
export function LatestWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [roads] = useLocalList<RoadItem>('ohome.road.v1', ROAD_SEED);
  const [backups] = useLocalList<BackupPost>('ohome.backup.v1', BACKUP_SEED);
  /* 메뉴에서 비공개로 둔 곳은 빼고 모은다 (v2.0 사용자 발견) — 로드비와 갤러리를 함께 보여 주는
     위젯이라 **소스별로** 따진다. 한쪽만 비공개면 나머지는 그대로 나온다. */
  const [menuSet] = useMenuSettings();
  const viewer = { loggedIn: !!user, isAdmin, id: user?.id };
  const seeRoad = canViewHref(menuSet, '/loadb', viewer);
  const seeGal = canViewHref(menuSet, '/gallery', viewer);
  const latest = [
    ...(seeRoad ? roads : []).filter(it => canViewHref(menuSet, sectionHref('roadview', it.secId ?? MAIN_SEC), viewer)).map(it => ({
      id: `r-${it.id}`, date: it.date, ref: it.imgId ?? it.imgUrl, ph: it.ph,
      href: '/loadb', tip: `로드비 · No.${String(it.no ?? 0).padStart(3, '0')}`,
    })),
    // 갤러리 — 전체공개 + 접기 없는 게시물의 대표(첫) 이미지
    ...(seeGal ? backups : [])
      .filter(p => canViewHref(menuSet, sectionHref('gallery', p.secId ?? MAIN_SEC), viewer))
      .filter(p => p.visibility === 'public' && !p.fold).map(p => ({
      id: `b-${p.id}`, date: p.date, ref: p.images[0], ph: p.phList[0] ?? 'cool',
      href: `/gallery/${p.id}`, tip: `갤러리 · ${p.title}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const phFallback = ['cool', 'warm', 'red'];
  if (!seeRoad && !seeGal) return null;   // 둘 다 비공개면 위젯 자체를 띄우지 않는다 (v2.0)
  return (
    <div className="panel widget" style={{ margin: 0 }}>
      <h4>LATEST <span className="more" onClick={() => router.push('/gallery')}>더보기 ›</span></h4>
      <div className="latest-grid">
        {[0, 1, 2].map(i => {
          const it = latest[i];
          return (
            <div key={it?.id ?? i} style={{ aspectRatio: '1', borderRadius: 9, overflow: 'hidden', position: 'relative', cursor: it ? 'pointer' : undefined }}
              onClick={() => { if (it) router.push(it.href); }} data-tip={it?.tip}>
              <BlobImg fileRef={it?.ref} ph={it?.ph || phFallback[i]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- D-DAY (4.12 — 스케줄러 연동은 3차) ---------- */
interface DdayItem { title: string; date: string; plusOne?: boolean }
function ddayLabel(date: string, plusOne?: boolean): { label: string; passed: boolean; near: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  // +1 Day: 시작일을 1일로 세는 기념일 카운트 (커플 기념일 등) — 당일 = D+1
  if (plusOne && diff <= 0) return { label: `D+${-diff + 1}`, passed: true, near: false };
  if (diff === 0) return { label: 'D-DAY', passed: false, near: true };
  return diff > 0
    ? { label: `D-${diff}`, passed: false, near: diff <= 7 }
    : { label: `D+${-diff}`, passed: true, near: false };
}

export function DdayWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn } = useMainStore();
  const { familyOf } = useFonts();
  const [open, setOpen] = useState(false);
  const items = (conf.settings.items as DdayItem[]) ?? [];
  // 날짜 표시(D-2·D+3 등) 폰트·색 — 미지정이면 기존 세리프 기본값 그대로 (v2.0 사용자 요청)
  // 'serif'는 폰트 라이브러리의 실제(잠금) 폰트라 편집기의 기본 옵션과 값이 늘 일치한다
  const dFontId = (conf.settings.fontId as string | undefined) ?? 'serif';
  const dColor = conf.settings.color as string | undefined;
  useEditEvent(conf.id, () => setOpen(true));   // 편집모드 우클릭 → 설정 (v1.9)
  return (
    <div className="panel widget" style={{ cursor: isAdmin ? 'pointer' : undefined }}
      onClick={e => { if ((e.target as HTMLElement).closest('.modal-ov')) return; if (isAdmin && !editOn) setOpen(true); }}>
      <h4>D-DAY {isAdmin && <span className="more">관리 ›</span>}</h4>
      {items.map(it => {
        const d = ddayLabel(it.date, it.plusOne);
        return (
          <div className="dday-row" key={it.title}>
            <span>{it.title}</span>
            <b className={d.near && !dColor ? 'd-red' : ''}
              style={{ fontFamily: familyOf(dFontId), color: dColor }}>{d.label}</b>
          </div>
        );
      })}
      {items.length === 0 && <p className="hint">등록된 D-day가 없습니다</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="D-day 관리"
        desc="추가 · 수정 · 삭제 · ⠿ 드래그로 순서 조정 — 환경설정 「위젯」에서도 관리 가능"
        actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>CLOSE</button>}>
        {open && <DdayEditor conf={conf} />}
      </Modal>
    </div>
  );
}

/* ---------- TO-DO — 관리자 클릭 시 관리 모달 (4.12 확정) ---------- */
export function TodoWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [open, setOpen] = useState(false);
  const items = (conf.settings.items as TodoSetItem[]) ?? [];
  useEditEvent(conf.id, () => setOpen(true));   // 편집모드 우클릭 → 설정 (v1.9)

  const setItems = (next: TodoSetItem[]) => {
    updateWidget(conf.id, { settings: { ...conf.settings, items: next } }, { persist: true });
  };

  return (
    <div className="panel widget" style={{ cursor: isAdmin ? 'pointer' : undefined }}
      onClick={e => {
        if (!isAdmin || editOn) return;
        if ((e.target as HTMLElement).closest('.k-check') || (e.target as HTMLElement).closest('.modal-ov')) return;
        setOpen(true);
      }}>
      <h4>TO-DO {isAdmin && <span className="more">관리 ›</span>}</h4>
      {items.map((it, i) => (
        <label className={`todo-row k-check ${it.done ? 'done' : ''}`} key={`${it.text}-${i}`}
          style={!isAdmin ? { pointerEvents: 'none' } : undefined}>
          <input type="checkbox" checked={it.done}
            onChange={ev => setItems(items.map((x, j) => (j === i ? { ...x, done: ev.target.checked } : x)))} />
          <span className="box" /><span>{it.text}</span>
        </label>
      ))}
      {items.length === 0 && <p className="hint">할 일이 없습니다</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="투두 관리"
        desc="추가 · 체크 · 삭제 · ⠿ 드래그로 순서 조정 — 환경설정 「위젯」에서도 관리 가능">
        {open && <TodoEditor conf={conf} />}
        <div className="modal-actions">
          <button className="btn btn-dark" onClick={() => setOpen(false)}>CLOSE</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- UPCOMING (다가오는 일정 — 스케줄러 실데이터, 4.12) ---------- */
export function UpcomingWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { st } = useSched();   // 인자 없이 = 모든 스케줄러 (v2.0 — 어느 것이든 다가오는 일정은 다가온다)
  /* 메뉴에서 비공개로 둔 스케줄러는 위젯에도 안 나온다 (v2.0).
     스케줄러를 여러 개 만들 수 있으므로 **일정마다 그 스케줄러 기준**으로 따지고,
     볼 수 있는 스케줄러가 하나도 없을 때만 위젯을 통째로 감춘다. */
  const [menuSet] = useMenuSettings();
  const { list } = useSections();
  const viewer = { loggedIn: !!user, isAdmin, id: user?.id };
  const seeSec = (secId?: string) => canViewHref(menuSet, sectionHref('sched', secId ?? MAIN_SEC), viewer);
  const canSee = list('sched').some(s => seeSec(s.id));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // 오늘 포함 이후 일정 — 매년 반복은 올해 날짜로 환산해 가장 가까운 3개
  const upcoming = st.events
    .filter(e => seeSec(e.secId))
    .filter(e => isAdmin || e.visibility === 'public' || (e.visibility === 'member' && !!user))
    .map(e => {
      let d = e.start;
      if (e.repeat === 'yearly') {
        const thisYear = `${today.getFullYear()}-${e.start.slice(5)}`;
        d = thisYear >= todayStr ? thisYear : `${today.getFullYear() + 1}-${e.start.slice(5)}`;
      }
      return { e, d };
    })
    .filter(x => x.d >= todayStr)
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, 3);
  if (!canSee) return null;   // 메뉴가 비공개면 위젯 자체를 띄우지 않는다 (v2.0)
  return (
    <div className="panel widget" style={{ cursor: 'var(--cur-pointer,pointer)' }} onClick={() => router.push('/cal')}>
      <h4>UPCOMING <span className="more">더보기 ›</span></h4>
      {upcoming.map(({ e, d }) => (
        <div key={e.id} className="dday-row">
          <span>{d.slice(5).replace('-', '.')} · {e.title}</span>
          <b style={{ fontSize: 11, color: eventColor(e, st.cats) }}>●</b>
        </div>
      ))}
      {upcoming.length === 0 && <p className="hint">다가오는 일정이 없습니다</p>}
    </div>
  );
}

/* ---------- 자유 텍스트 (v1.9 개편 — 사용자 확정) ----------
   패널 없이 문구만 — 폰트·크기·색·정렬을 지정해 장식처럼 아무 곳에나 배치(위젯 드래그·크기 공통).
   편집은 편집모드에서만 — 우클릭 「설정」 (v1.9 사용자 확정: 평상시 클릭 편집 제거). */
export function FreeTextWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { updateWidget } = useMainStore();
  const { fonts, familyOf } = useFonts();
  const [open, setOpen] = useState(false);
  const s = conf.settings as { text?: string; fontId?: string; size?: number; color?: string; align?: 'left' | 'center' | 'right'; bold?: boolean };
  const [draft, setDraft] = useState(s);
  useEditEvent(conf.id, () => { setDraft({ ...s }); setOpen(true); });
  return (
    <div>
      <p style={{
        fontFamily: familyOf(s.fontId) ?? 'var(--sans)',
        fontSize: s.size ?? 15, color: s.color ?? 'var(--page-desc)',
        textAlign: s.align ?? 'left', fontWeight: s.bold ? 700 : 400,
        lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0, wordBreak: 'keep-all',
      }}>
        {s.text || (isAdmin ? '자유 텍스트 — 편집모드에서 우클릭 → 설정' : '')}
      </p>
      <Modal open={open} onClose={() => setOpen(false)} title="자유 텍스트"
        desc="패널 없이 문구만 표시 — 폰트·크기·색·정렬 지정, 배치는 편집모드에서 드래그"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            updateWidget(conf.id, { settings: { ...conf.settings, ...draft } }, { persist: true }); setOpen(false);
          }}>SAVE</button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <KTextarea value={draft.text ?? ''} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <KSelect minWidth={170} value={draft.fontId ?? 'default'}
              onChange={v => setDraft(d => ({ ...d, fontId: v }))}
              options={fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> }))} />
            <span className="cp-lb">크기</span>
            <KStep value={draft.size ?? 15} min={10} max={64} step={1} suffix="px"
              onChange={v => setDraft(d => ({ ...d, size: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb">글씨색</span>
            <ColorField value={draft.color ?? '#5d636d'} onChange={hex => setDraft(d => ({ ...d, color: hex }))} />
            <div className="mini-seg">
              {(['left', 'center', 'right'] as const).map(a => (
                <button key={a} className={(draft.align ?? 'left') === a ? 'on' : ''}
                  onClick={() => setDraft(d => ({ ...d, align: a }))}>
                  {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
                </button>
              ))}
            </div>
            <KCheck label="굵게" checked={!!draft.bold} onChange={v => setDraft(d => ({ ...d, bold: v }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- 장식 이미지 — 패널 없이 이미지만 (장식용) ---------- */
/** 비율 유지(안 잘림) 렌더 — cover(크롭)와 선택제 (v1.9 사용자 요청)
 *  둥근 모서리는 위젯 박스가 아니라 **이미지 크기**에 맞춰 적용 (v1.9 사용자 피드백 — 여백까지 둥글면 티가 안 남) */
function ContainImg({ fileRef, rounded, onActivate }: {
  fileRef: string; rounded: boolean; onActivate?: () => void;
}) {
  const url = useBlobUrl(fileRef);
  const imgRef = useRef<HTMLImageElement>(null);
  // 투명 픽셀 판독용 캔버스 — 이미지마다 한 번만 그린다
  const cacheRef = useRef<{ url: string; c: HTMLCanvasElement } | null>(null);
  if (!url) return null;
  /* 클릭이 실제 그림 위인지 (v2.0 사용자 요청 — 「투명 영역은 클릭 영역이 아니게」).
     장식 이미지는 배경이 투명한 PNG가 많다 — 빈 데를 눌러도 링크로 가면 이상하다.
     픽셀의 투명도를 읽어 거의 투명하면 클릭으로 치지 않는다. 외부 주소 이미지처럼
     판독이 막히면(캔버스 보안) 이미지 사각형 기준으로만 제한한다. */
  const hitTest = (e: React.MouseEvent): boolean => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return true;
    const r = img.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * img.naturalWidth);
    const y = Math.floor((e.clientY - r.top) / r.height * img.naturalHeight);
    try {
      if (!cacheRef.current || cacheRef.current.url !== url) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0);
        cacheRef.current = { url, c };
      }
      return cacheRef.current.c.getContext('2d')!.getImageData(x, y, 1, 1).data[3] > 8;
    } catch { return true; }
  };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={url} alt="" draggable={false}
        onClick={e => { if (onActivate && hitTest(e)) onActivate(); }}
        style={{
          maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block',
          borderRadius: rounded ? 'var(--radius)' : 0,
          cursor: onActivate ? 'var(--cur-pointer,pointer)' : undefined,
        }} />
    </div>
  );
}

export function DecoWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn } = useMainStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rounded = (conf.settings.rounded as boolean) ?? true;
  const fit = (conf.settings.fit as 'cover' | 'contain') ?? 'cover';   // 꽉 채움(잘림) / 비율 유지 (v1.9)
  // 여러 장 슬라이드 (v2.0) — 한 장만 넣던 옛 저장분도 같은 목록으로 읽힌다
  const slides = decoSlides(conf.settings);
  const sec = (conf.settings.interval as number) ?? 5;
  const [idx, setIdx] = useState(0);
  const cur = slides[Math.min(idx, slides.length - 1)];
  // 자동 넘김 — 편집 중이거나 설정 모달이 열려 있으면 멈춘다 (위치를 맞추는 중이라)
  useEffect(() => {
    if (slides.length < 2 || editOn || open) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), Math.max(1, sec) * 1000);
    return () => clearInterval(t);
  }, [slides.length, sec, editOn, open]);
  useEffect(() => { if (idx >= slides.length) setIdx(0); }, [slides.length, idx]);
  useEditEvent(conf.id, () => setOpen(true));   // 편집은 편집모드 우클릭 「설정」 전용 (v1.9 사용자 확정)
  // 링크 이동 (v1.9 — 이미지+링크를 위젯 테두리 없이) — 링크는 장면마다 따로 (v2.0)
  const onBody = () => {
    if (editOn) return;
    if (cur?.link) {
      const l = normalizeInternalLink(cur.link);
      if (/^https?:\/\//.test(l)) window.open(l, '_blank');
      else router.push(l);
    }
  };
  // 직접 정한 크기 (v2.0 사용자 요청) — 비우면 지금까지처럼 자리(그리드 칸)를 따라간다
  const wPx = conf.settings.wPx as number | undefined;
  const hPx = conf.settings.hPx as number | undefined;
  const canGo = !editOn && !!cur?.link;
  return (
    <div className={`deco-wgt${!wPx && !hPx && conf.w && conf.h ? ' dm' : ''}`}
      style={{
        // 모바일에서 PC에서 정한 크기·비율을 그대로 유지하기 위한 값 (아래 .deco-wgt.dm CSS가 모바일에서만 쓴다)
        ...(conf.w && conf.h ? { ['--dw' as string]: `${conf.w}px`, ['--da' as string]: `${conf.w} / ${conf.h}` } : {}),
        ['--ms' as string]: ((conf.settings.mScale as number | undefined) ?? 100) / 100,
        ['--mox' as string]: `${(conf.settings.mOffX as number | undefined) ?? 0}px`,
        ['--moy' as string]: `${(conf.settings.mOffY as number | undefined) ?? 0}px`,
        position: 'relative', overflow: 'hidden',
        width: wPx ? `${wPx}px` : '100%', maxWidth: '100%',
        height: hPx ? `${hPx}px` : '100%', minHeight: hPx ? undefined : 80,
        margin: wPx ? '0 auto' : undefined,
        aspectRatio: conf.h == null && !hPx ? '1/1' : undefined, // 크기 동결 전 기본 정사각
        borderRadius: rounded ? 'var(--radius)' : 0,
      }}>
      {/* 클릭은 이미지 위에서만 (v2.0 사용자 요청) — 예전에는 위젯 칸 전체가 눌렸다.
          꽉 채움은 이미지가 칸을 채우므로 그대로 칸 전체, 비율 유지는 그림 픽셀 기준(투명 제외) */}
      {cur
        ? (fit === 'contain'
          ? <ContainImg key={cur.id} fileRef={cur.imgId} rounded={rounded} onActivate={canGo ? onBody : undefined} />
          : (
            <div style={{ position: 'absolute', inset: 0, cursor: canGo ? 'var(--cur-pointer,pointer)' : undefined }}
              onClick={canGo ? onBody : undefined}>
              <CroppedBlobImg key={cur.id} fileRef={cur.imgId} crop={cur.crop} ph="" />
            </div>
          ))
        : (
          <div className="ph" style={{ position: 'absolute', inset: 0 }}>
            <span style={{ fontSize: 10 }}>{isAdmin ? 'DECO — 편집모드에서 우클릭 → 설정' : 'DECO'}</span>
          </div>
        )}
      {/* 여러 장일 때만 지금 몇 번째인지 표시 — 눌러서 바로 넘길 수도 있다 (v2.0) */}
      {slides.length > 1 && !editOn && (
        <div className="deco-dots" onClick={e => e.stopPropagation()}>
          {slides.map((sl, i) => (
            <i key={sl.id} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} />
          ))}
        </div>
      )}
      <div onClick={e => e.stopPropagation()}>
        <Modal open={open} onClose={() => setOpen(false)} small title="장식 이미지"
          desc="여러 장을 넣으면 순서대로 넘어갑니다 — 위치 크롭은 현재 위젯 비율 기준, 원본은 잘리지 않음">
          {open && <DecoEditor conf={conf} onClose={() => setOpen(false)} />}
        </Modal>
      </div>
    </div>
  );
}

/* ---------- 스티커 메모 미니보드 (4.6) — 읽기 전용 축소 보드, 클릭 시 /memo ---------- */
export function MemoBoardWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [memos] = useLocalList<StickyMemo>('ohome.memo.v1', MEMO_SEED);
  const [settings] = useMemoSettings();
  // 메뉴에서 비공개로 둔 메모장은 위젯에도 안 나온다 (v2.0)
  const [menuSet] = useMenuSettings();
  if (!canViewHref(menuSet, '/memo', { loggedIn: !!user, isAdmin, id: user?.id })) return null;
  return (
    <div className="panel widget" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4>STICKY</h4>
      <div className="memo-mini" onClick={() => router.push('/memo')}>
        {memos.map(m => (
          <div key={m.id} className="postit"
            style={{
              left: `${m.x}%`, top: `${m.y}%`, zIndex: m.z,
              transform: `rotate(${m.rot}deg)`, background: m.color,
              width: Math.round(MEMO_SIZE_W[m.size] * 0.53),
            }}>
            {settings.showAuthor && <b>{m.author}</b>}
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 커미션 신청자 (v2.0 사용자 요청) ----------
   다가오는 마감이 빠른 순으로. 몇 명까지 볼지는 설정에서 (기본 5명).
   이름은 신청자 리스트와 **같은 규칙**으로 가린다 — 관리자만 전체, 나머지는 앞 몇 글자만.
   마감이 없는 신청은 「다가오는 마감」이 아니므로 넣지 않는다. 지난 마감도 뺀다. */
export function ApplyWidget({ conf }: { conf: WidgetConf }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  // 메뉴에서 비공개로 둔 신청자 리스트는 위젯에도 안 나온다 (v2.0)
  const [menuSet] = useMenuSettings();
  const [settings] = useCommSettings();
  const [apps] = useLocalList<Applicant>('ohome.commapply.v1', APPLY_SEED);
  const [open, setOpen] = useState(false);
  useEditEvent(conf.id, () => setOpen(true));

  const max = Math.max(1, Math.min(20, (conf.settings.count as number) ?? 5));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const shown = apps
    .filter(a => !inTrash(a) && !!a.deadline && a.deadline >= todayStr)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, max);

  /** 남은 날 — 오늘이면 D-DAY */
  const dleft = (d: string) => {
    const ms = Date.parse(`${d}T00:00:00`) - Date.parse(`${todayStr}T00:00:00`);
    const n = Math.round(ms / 86400000);
    return n === 0 ? 'D-DAY' : `D-${n}`;
  };

  // 훅을 모두 부른 뒤에 판정한다 — 중간에서 빠지면 렌더마다 훅 수가 달라진다
  if (!canViewHref(menuSet, '/comm-apply', { loggedIn: !!user, isAdmin, id: user?.id })) return null;

  return (
    /* 누르면 관리자든 아니든 신청자 페이지로 간다 (v2.0 사용자 요청).
       설정은 편집모드에서 우클릭 > 설정으로만 — 목록을 보러 눌렀는데 관리 창이 뜨면 안 된다 */
    <div className="panel widget" style={{ cursor: 'var(--cur-pointer,pointer)' }}
      onClick={e => {
        if ((e.target as HTMLElement).closest('.modal-ov')) return;
        if (editOn) return;   // 편집모드에서는 배치·우클릭 메뉴가 우선
        router.push('/comm-apply');
      }}>
      <h4>COMMISSION <span className="more" onClick={e => { e.stopPropagation(); router.push('/comm-apply'); }}>전체 ›</span></h4>
      {shown.map(a => {
        const badge = settings.applyBadges.find(b => b.id === a.badgeId);
        return (
          <div className="apply-row" key={a.id}>
            <b>{dleft(a.deadline!)}</b>
            <span>{isAdmin ? a.name : maskName(a.name, a.nameOpen ?? 1)}</span>
            {badge && <i style={badgeStyle(badge, settings.badgeShape)}>{badge.label}</i>}
          </div>
        );
      })}
      {shown.length === 0 && <p className="hint">다가오는 마감이 없습니다</p>}

      <Modal open={open} onClose={() => setOpen(false)} small title="커미션 신청자 위젯"
        desc="마감이 가까운 순으로 보여 줍니다 — 마감일이 없거나 지난 신청은 빼고 셉니다"
        actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>확인</button>}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="cp-lb">몇 명까지</span>
          <KStep value={(conf.settings.count as number) ?? 5} min={1} max={20} suffix="명"
            onChange={v => updateWidget(conf.id, { settings: { ...conf.settings, count: v } }, { persist: true })} />
        </div>
      </Modal>
    </div>
  );
}

/* ---------- 별자리 궤도 (사용자 요청) ----------
   혼천의(Armillary Sphere)처럼 여러 고리가 서로 다른 축으로 입체 회전하는 장식 — 가운데 별은 고정, 별은 마우스를 따라 제자리에서 돈다.
   패널 없이 그림만 — 크기·색은 편집모드 우클릭 「설정」에서. 크기(칸 대비 %)는 위젯 칸을 키우고 줄이는 것과 별개로 그림만 키우고 줄인다.
   도형은 인트로 화면과 따로 관리한다 (lib/orbitSky.ts ↔ lib/introSky.ts). */
export function OrbitWidget({ conf }: { conf: WidgetConf }) {
  const { updateWidget, editOn } = useMainStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEditEvent(conf.id, () => setOpen(true));
  const s = conf.settings as OrbitSkySettings & { link?: string };
  // 링크 — 이미지 위젯과 같은 방식: 내부 경로면 이동, 외부 주소면 새 탭. 편집모드에서는 이동하지 않는다.
  // 고리 구(球) 안쪽을 눌렀을 때만 이동한다 (위젯 칸의 빈 모서리는 눌려도 반응 없음)
  const inSphere = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rad = Math.min(r.width, r.height) * Math.min(4, Math.max(0.1, (s.size ?? ORBIT_DEFAULT_SIZE) / 100)) * 0.5;
    return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= rad;
  };
  const go = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editOn || !s.link || !inSphere(e)) return;
    const l = normalizeInternalLink(s.link);
    if (/^https?:\/\//.test(l)) window.open(l, '_blank');
    else router.push(l);
  };
  const set = (p: Partial<OrbitSkySettings>) => updateWidget(conf.id, { settings: { ...conf.settings, ...p } }, { persist: true });
  // 색을 비워 두면 사이트 포인트색 — 색 상자에는 지금 포인트색을 보여 준다 (#16진수가 아니면 기본값)
  const accentHex = (() => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      return /^#[0-9a-f]{6}$/i.test(v) ? v : '#7fd6d0';
    } catch { return '#7fd6d0'; }
  })();
  const colorRow = (label: string, k: 'lineColor' | 'pointColor' | 'sparkColor' | 'starColor' | 'beadColor') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="cp-lb" style={{ minWidth: 58 }}>{label}</span>
      <ColorField value={s[k] || accentHex} onChange={hex => set({ [k]: hex } as Partial<OrbitSkySettings>)} />
      {s[k] && (
        <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 10 }}
          onClick={() => set({ [k]: '' } as Partial<OrbitSkySettings>)}>기본값</button>
      )}
    </div>
  );
  return (
    <div className="ow-wrap" onClick={go}
      onMouseMove={e => { e.currentTarget.style.cursor = !editOn && s.link && inSphere(e) ? 'var(--cur-pointer,pointer)' : ''; }}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 80 }}>
      <OrbitSky size={s.size} lineColor={s.lineColor} pointColor={s.pointColor} sparkColor={s.sparkColor} starColor={s.starColor} beadColor={s.beadColor} showBeads={s.showBeads !== false} sparkSize={s.sparkSize} tilt={s.tilt}
        starSize={s.starSize} ringCount={s.ringCount} boldWidth={s.boldWidth} thinWidth={s.thinWidth} dashWidth={s.dashWidth} />
      <div onClick={e => e.stopPropagation()}>
        <Modal open={open} onClose={() => setOpen(false)} small title="별자리 궤도"
          desc="혼천의처럼 고리가 입체적으로 돕니다 — 가운데 별은 마우스를 따라 제자리에서 돕니다. 바꾸는 즉시 적용됩니다"
          actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>확인</button>}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cp-lb" style={{ minWidth: 58 }}>크기</span>
              <KStep value={s.size ?? ORBIT_DEFAULT_SIZE} min={20} max={300} step={5} suffix="%" onChange={v => set({ size: v })} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>100% = 위젯 칸에 꽉 차는 크기</small>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cp-lb" style={{ minWidth: 58 }}>기울기</span>
              <KStep value={s.tilt ?? ORBIT_DEFAULT_TILT} min={0} max={100} step={5} suffix="%" onChange={v => set({ tilt: v })} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>마우스를 따라 고리가 기우는 세기 · 0%면 기울지 않음 (고리는 계속 돕니다)</small>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cp-lb" style={{ minWidth: 58 }}>별 크기</span>
              <KStep value={s.starSize ?? ORBIT_DEFAULT_STAR} min={30} max={300} step={10} suffix="%" onChange={v => set({ starSize: v })} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>가운데에서 도는 별</small>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cp-lb" style={{ minWidth: 58 }}>선 개수</span>
              <KStep value={s.ringCount ?? ORBIT_DEFAULT_COUNT} min={1} max={ORBIT_MAX_COUNT} step={1} suffix="개" onChange={v => set({ ringCount: v })} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>고리 수 · 기본 {ORBIT_DEFAULT_COUNT}개, 최대 {ORBIT_MAX_COUNT}개</small>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cp-lb" style={{ minWidth: 58 }}>반짝이 크기</span>
              <KStep value={s.sparkSize ?? 100} min={30} max={400} step={10} suffix="%" onChange={v => set({ sparkSize: v })} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>100% = 인트로 화면과 같은 크기</small>
            </div>
            {([['진한 선', 'boldWidth', '굵고 밝은 고리'], ['얇은 선', 'thinWidth', '보통·가는 고리와 별자리 선'], ['점선', 'dashWidth', '점선 고리와 눈금']] as const).map(([label, k, hint]) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="cp-lb" style={{ minWidth: 58 }}>{label}</span>
                <KStep value={s[k] ?? ORBIT_DEFAULT_WIDTH} min={30} max={300} step={10} suffix="%" onChange={v => set({ [k]: v } as Partial<OrbitSkySettings>)} />
                <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{hint} 굵기</small>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cp-lb" style={{ minWidth: 58 }}>링크</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <KInput placeholder="링크 (선택 — 클릭 시 이동)" value={s.link ?? ''}
                  onChange={e => set({ link: normalizeInternalLink(e.target.value) || undefined } as Partial<OrbitSkySettings>)} />
              </div>
            </div>
            {colorRow('고리·별자리', 'lineColor')}
            {colorRow('알갱이·점선', 'pointColor')}
            <KCheck checked={s.showBeads !== false} onChange={v => set({ showBeads: v })} label="원형 장식 (고리 위의 동그란 알갱이) 보이기" />
            {s.showBeads !== false && colorRow('원형 장식', 'beadColor')}
            {colorRow('가운데 별', 'starColor')}
            {colorRow('반짝이', 'sparkColor')}
          </div>
        </Modal>
      </div>
    </div>
  );
}

/* ---------- 팝업 버튼 — 「① ABOUT ME」 처럼 번호+라벨 버튼, 누르면 메인 화면이 흐려지고 가운데에 팝업이 뜬다 ----------
   팝업 내용은 둘 중 하나: 메뉴 목록(사이트 메뉴를 그룹별로 · 보여 줄 항목 고르기) / 직접 쓴 글(서식 있는 글).
   배경 클릭·× 버튼·Esc 로 닫는다. 편집모드에서는 눌러도 열리지 않고(드래그 우선), 우클릭 → 설정으로 고친다. */
interface PopBtnSettings {
  num?: string; showNum?: boolean; label?: string;
  fontId?: string; size?: number; bold?: boolean;
  labelFontId?: string; labelSize?: number;   // 라벨만 따로 폰트·크기
  numBg?: string; numFg?: string; labelColor?: string;
  sub?: string; numSuffix?: string; starColor?: string; showStar?: boolean;   // 부제 · 번호 옆 글자 · 별 색/표시
  tag?: string; heading?: string;
  mode?: 'menu' | 'text' | 'page' | 'link'; hrefs?: string[]; html?: string;
  target?: string;     // page(팝업 안에 화면 그대로) · link(바로 이동) 에서 열 메뉴 주소
  height?: number;     // page 팝업 높이(vh)
  width?: number; blur?: number;
}

function PopStar({ color }: { color: string }) {
  return (
    <span className="pb-star" style={{ '--pb-star': color } as React.CSSProperties} aria-hidden>
      <i className="pb-star-halo" />
      <svg viewBox="-14 -14 28 28" width="1em" height="1em">
        <path d="M0-13.5 Q.55-.55 13.5 0 Q.55.55 0 13.5 Q-.55.55-13.5 0 Q-.55-.55 0-13.5Z" fill="currentColor" />
        <path d="M0-6.5 Q.7-.7 6.5 0 Q.7.7 0 6.5 Q-.7.7-6.5 0 Q-.7-.7 0-6.5Z" fill="currentColor" opacity=".55" transform="rotate(45)" />
        <circle r="1.7" fill="#fff" />
      </svg>
      <i className="pb-star-ring" />
    </span>
  );
}

function PopBtnCard({ conf, onClose, origin }: { conf: WidgetConf; onClose: () => void; origin: { x: number; y: number } | null }) {
  const { familyOf } = useFonts();
  const router = useRouter();
  const s = conf.settings as PopBtnSettings;
  const [frameH, setFrameH] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(s.mode !== 'page');   // 페이지 화면은 내용이 자리 잡은 뒤에 상자를 연다
  useEffect(() => { if (s.mode === 'page') { const t = setTimeout(() => setShown(true), 2500); return () => clearTimeout(t); } }, [s.mode]);   // 페이지 내용이 자리 잡을 때까지 숨겨 로딩이 안 보이게
  const [menuSet, , menuLoaded] = useMenuSettings();
  const { boards, loaded: boardsLoaded } = useBoards();
  const { user, isAdmin } = useAuth();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);

  const picked = new Set(s.hrefs ?? []);
  const groups = (menuLoaded && boardsLoaded
    ? buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)], { loggedIn: !!user, isAdmin, id: user?.id })
    : [])
    .map(m => ({ title: m.children ? m.label : '', items: m.children ?? (m.href ? [{ label: m.label, href: m.href }] : []) }))
    .map(g => ({ ...g, items: g.items.filter(i => picked.size === 0 || picked.has(i.href)) }))
    .filter(g => g.items.length > 0);
  const go = (href: string) => { onClose(); if (/^https?:\/\//.test(href)) window.open(href, '_blank'); else router.push(href); };

  const num = s.num ?? '1';
  const hasFont = !!s.fontId && s.fontId !== 'default';
  return createPortal(
    <div className="pb-overlay" style={{ '--pb-blur': `${s.blur ?? 12}px` } as React.CSSProperties} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`pb-card${shown ? '' : ' pb-wait'}`} role="dialog" aria-modal="true"
        style={{ maxWidth: `min(${s.width ?? 560}px, 92vw)`, '--dx': `${origin ? origin.x - window.innerWidth / 2 : 0}px`, '--dy': `${origin ? origin.y - window.innerHeight / 2 : 0}px`,
          '--pb-font': hasFont ? familyOf(s.fontId) : undefined } as React.CSSProperties}>
        <div className="pb-head">
          <div className="pb-tag">{s.tag || `FILE ${String(num).padStart(2, '0')} · ${(s.label ?? 'about').toLowerCase().replace(/\s+/g, '-')}.log`}</div>
          <div className="pb-title">
            <span className={`pb-heading${hasFont ? ' pb-cf' : ''}`}>{s.heading ?? s.label ?? ''}</span>
            {s.sub && <span className="pb-sub">{s.sub}</span>}
          </div>
          <button type="button" className="pb-x" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <div className="pb-body">
        {s.mode === 'page' ? (
          s.target
            ? <iframe className="pb-frame" scrolling="no" title={s.heading || s.label || '페이지'} style={{ height: frameH ?? `${s.height ?? 70}vh`, opacity: ready ? 1 : 0 }}
                src={`${s.target}${s.target.includes('?') ? '&' : '?'}embed=1`}
                onLoad={e => {   // 같은 사이트 화면이라 내용 높이를 읽어 팝업 안에 자연스럽게 이어 붙인다
                  const f = e.currentTarget;
                  try {
                    const d = f.contentDocument; if (!d) return;
                    const fit = () => { const m = d.getElementById('appMain'); const h = m ? m.getBoundingClientRect().height : d.body.getBoundingClientRect().height; if (h > 0) { setFrameH(Math.ceil(h) + 4); setReady(true); } };
                    const reveal = () => { fit(); setShown(true); };
                    fit(); setTimeout(fit, 250); setTimeout(reveal, 600); setTimeout(fit, 1500);
                    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(d.getElementById('appMain') ?? d.body);
                  } catch { /* 접근 불가면 설정한 높이 유지 */ }
                }} />
            : <div className="pb-empty">열 페이지를 설정에서 골라 주세요</div>
        ) : (s.mode ?? 'menu') === 'menu' ? (
          <div className="pb-menu">
            {groups.map((g, gi) => (
              <div className="pb-grp" key={gi}>
                {g.title && <div className="pb-grp-t">{g.title}</div>}
                <div className="pb-chips">
                  {g.items.map(i => <button type="button" className="pb-chip" key={i.href} onClick={() => go(i.href)}>{i.label}</button>)}
                </div>
              </div>
            ))}
            {groups.length === 0 && <div className="pb-empty">보여 줄 메뉴가 없습니다</div>}
          </div>
        ) : (
          <HtmlBody className="pb-text post-body" html={s.html ?? ''} />
        )}
        </div>
        <div className="pb-foot"><span>SCROLL ↓</span><span>ESC TO CLOSE</span></div>
      </div>
    </div>,
    document.body,
  );
}

export function PopupBtnWidget({ conf }: { conf: WidgetConf }) {
  const router = useRouter();
  const { editOn, updateWidget } = useMainStore();
  const { fonts, familyOf } = useFonts();
  const [menuSet] = useMenuSettings();
  const { boards } = useBoards();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  const [open, setOpen] = useState(false);       // 팝업
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [edit, setEdit] = useState(false);       // 설정 모달
  const s = conf.settings as PopBtnSettings;
  const [draft, setDraft] = useState<PopBtnSettings>(s);
  useEditEvent(conf.id, () => { setDraft({ ...s }); setEdit(true); });

  const size = s.size ?? 15;
  const all = buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)])
    .flatMap(m => (m.children ? m.children.map(c => ({ ...c, group: m.label })) : m.href ? [{ label: m.label, href: m.href, group: '' }] : []));
  const dh = new Set(draft.hrefs ?? []);

  return (
    <div className="pb-wrap">
      <button type="button" className={`pb-btn${(s.labelFontId ?? s.fontId) && (s.labelFontId ?? s.fontId) !== 'default' ? ' pb-cf' : ''}`} onClick={e => {
        if (editOn) return;
        if (s.mode === 'link') {   // 팝업 없이 바로 이동
          if (!s.target) return;
          if (/^https?:\/\//.test(s.target)) window.open(s.target, '_blank'); else router.push(s.target);
          return;
        }
        const r = (e.currentTarget.querySelector('.pb-star') ?? e.currentTarget).getBoundingClientRect();
        setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        setOpen(true);
      }}
        style={{ fontFamily: familyOf(s.fontId) ?? 'var(--sans)', fontSize: size, color: s.labelColor ?? 'var(--ink)', fontWeight: s.bold === false ? 400 : 700 }}>
        {s.showStar !== false && <PopStar color={s.starColor ?? '#4a63d8'} />}
        <span className="pb-txt">
          {s.showNum !== false && (
            <span className="pb-num" style={{ color: s.numFg }}>{String(s.num ?? '1').padStart(2, '0')}{(s.numSuffix ?? 'logged') ? ` · ${s.numSuffix ?? 'logged'}` : ''}</span>
          )}
          <span className="pb-label" style={{ fontFamily: (s.labelFontId ?? s.fontId) && (s.labelFontId ?? s.fontId) !== 'default' ? familyOf(s.labelFontId ?? s.fontId) : undefined, fontSize: s.labelSize ? `${s.labelSize}px` : undefined }}>{s.label ?? 'ABOUT ME'}</span>
          {s.sub && <span className="pb-subl">{s.sub}</span>}
        </span>
      </button>
      {open && !editOn && <PopBtnCard conf={conf} origin={origin} onClose={() => setOpen(false)} />}

      <Modal open={edit} onClose={() => setEdit(false)} title="팝업 버튼"
        desc="번호·라벨이 붙은 버튼 — 누르면 메인 화면이 흐려지고 가운데에 팝업이 뜹니다"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setEdit(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            updateWidget(conf.id, { settings: { ...conf.settings, ...draft } }, { persist: true }); setEdit(false);
          }}>SAVE</button>
        </>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb">번호</span>
            <KInput style={{ width: 70 }} value={draft.num ?? '1'} maxLength={3} onChange={e => setDraft(d => ({ ...d, num: e.target.value }))} />
            <KCheck label="번호 표시" checked={draft.showNum !== false} onChange={v => setDraft(d => ({ ...d, showNum: v }))} />
            <span className="cp-lb">번호 옆 글자</span>
            <KInput style={{ width: 90 }} placeholder="logged" value={draft.numSuffix ?? 'logged'} onChange={e => setDraft(d => ({ ...d, numSuffix: e.target.value }))} />
            <span className="cp-lb">라벨</span>
            <KInput style={{ width: 160 }} value={draft.label ?? 'ABOUT ME'} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
            <span className="cp-lb">부제</span>
            <KInput style={{ width: 130 }} placeholder="공지" value={draft.sub ?? ''} onChange={e => setDraft(d => ({ ...d, sub: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb">라벨 폰트</span>
            <KSelect minWidth={170} value={draft.labelFontId ?? draft.fontId ?? 'default'} onChange={v => setDraft(d => ({ ...d, labelFontId: v, fontId: v }))}
              options={fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> }))} />
            <span className="cp-lb">라벨 크기</span>
            <KStep value={draft.labelSize ?? Math.round((draft.size ?? 15) * 1.15)} min={8} max={80} suffix="px" onChange={v => setDraft(d => ({ ...d, labelSize: v }))} />
            <span className="cp-lb">전체 크기</span>
            <KStep value={draft.size ?? 15} min={10} max={48} suffix="px" onChange={v => setDraft(d => ({ ...d, size: v }))} />
            <KCheck label="굵게" checked={draft.bold !== false} onChange={v => setDraft(d => ({ ...d, bold: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <KCheck label="별 표시" checked={draft.showStar !== false} onChange={v => setDraft(d => ({ ...d, showStar: v }))} />
            <span className="cp-lb">별 색</span>
            <ColorField value={draft.starColor ?? '#4a63d8'} onChange={hex => setDraft(d => ({ ...d, starColor: hex }))} />
            <span className="cp-lb">번호 글씨</span>
            <ColorField value={draft.numFg ?? '#9a9a9a'} onChange={hex => setDraft(d => ({ ...d, numFg: hex }))} />
            <span className="cp-lb">라벨 색</span>
            <ColorField value={draft.labelColor ?? '#111111'} onChange={hex => setDraft(d => ({ ...d, labelColor: hex }))} />
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb">팝업 표식</span>
            <KInput style={{ width: 150 }} placeholder={`about No.${draft.num ?? '1'}`} value={draft.tag ?? ''} onChange={e => setDraft(d => ({ ...d, tag: e.target.value }))} />
            <span className="cp-lb">제목</span>
            <KInput style={{ width: 170 }} placeholder={draft.label ?? ''} value={draft.heading ?? ''} onChange={e => setDraft(d => ({ ...d, heading: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb">내용</span>
            <div className="mini-seg">
              {(['menu', 'text', 'page', 'link'] as const).map(m => (
                <button key={m} className={(draft.mode ?? 'menu') === m ? 'on' : ''} onClick={() => setDraft(d => ({ ...d, mode: m }))}>
                  {m === 'menu' ? '메뉴 목록' : m === 'text' ? '직접 쓴 글' : m === 'page' ? '페이지 화면' : '바로 이동'}
                </button>
              ))}
            </div>
            <span className="cp-lb">너비</span>
            <KStep value={draft.width ?? 560} min={320} max={1000} step={20} suffix="px" onChange={v => setDraft(d => ({ ...d, width: v }))} />
            <span className="cp-lb">흐림</span>
            <KStep value={draft.blur ?? 12} min={0} max={30} suffix="px" onChange={v => setDraft(d => ({ ...d, blur: v }))} />
          </div>
          {(draft.mode === 'page' || draft.mode === 'link') ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="cp-lb">{draft.mode === 'page' ? '팝업에 띄울 페이지' : '이동할 페이지'}</span>
                <KSelect minWidth={200} placeholder="페이지 고르기" value={draft.target ?? ''} onChange={v => setDraft(d => ({ ...d, target: v }))}
                  options={all.map(i => ({ value: i.href, label: `${i.group ? `${i.group} › ` : ''}${i.label}` }))} />
                {draft.mode === 'page' && (<>
                  <span className="cp-lb">높이</span>
                  <KStep value={draft.height ?? 70} min={30} max={90} step={5} suffix="vh" onChange={v => setDraft(d => ({ ...d, height: v }))} />
                </>)}
              </div>
              <p className="hint" style={{ margin: 0 }}>
                {draft.mode === 'page'
                  ? '선택한 페이지가 팝업 안에 그대로 열립니다(상단바·메뉴·음악은 숨김). 팝업 너비를 넉넉히(예: 900px) 잡아 주세요.'
                  : '버튼을 누르면 팝업 없이 선택한 페이지로 바로 이동합니다.'}
              </p>
            </div>
          ) : (draft.mode ?? 'menu') === 'menu' ? (
            <div>
              <p className="hint" style={{ margin: '0 0 6px' }}>팝업에 보일 메뉴 — 아무것도 고르지 않으면 방문자가 볼 수 있는 메뉴 전체가 나옵니다.</p>
              <div style={{ display: 'grid', gap: 4, maxHeight: 220, overflowY: 'auto', padding: '2px 0' }}>
                {all.map(i => (
                  <KCheck key={i.href} label={`${i.group ? `${i.group} › ` : ''}${i.label}`} checked={dh.has(i.href)}
                    onChange={v => setDraft(d => {
                      const n = new Set(d.hrefs ?? []);
                      if (v) n.add(i.href); else n.delete(i.href);
                      return { ...d, hrefs: [...n] };
                    })} />
                ))}
              </div>
            </div>
          ) : (
            <RichEditor value={draft.html ?? ''} onChange={html => setDraft(d => ({ ...d, html }))} placeholder="팝업에 보일 글을 쓰세요" />
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ---------- 타입 → 렌더러 ---------- */
export function renderWidget(conf: WidgetConf) {
  switch (conf.type) {
    case 'banner': return <BannerWidget conf={conf} />;
    case 'menu': return <MenuListWidget />;
    case 'memo': return <MemoWidget conf={conf} />;
    case 'diary': return <DiaryWidget />;
    case 'latest': return <LatestWidget />;
    case 'recent': return <RecentWidget conf={conf} />;
    case 'dday': return <DdayWidget conf={conf} />;
    case 'todo': return <TodoWidget conf={conf} />;
    case 'upcoming': return <UpcomingWidget />;
    case 'freetext': return <FreeTextWidget conf={conf} />;
    case 'deco': return <DecoWidget conf={conf} />;
    case 'memoboard': return <MemoBoardWidget />;
    case 'apply': return <ApplyWidget conf={conf} />;
    case 'orbit': return <OrbitWidget conf={conf} />;
    case 'popbtn': return <PopupBtnWidget conf={conf} />;
    default: return <div className="panel widget"><h4>{WIDGET_META[conf.type]?.title ?? conf.type}</h4></div>;
  }
}
