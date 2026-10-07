'use client';
// 캐릭터 프로필 상세 (4.4) — 좌측 아이콘 탭 · 중앙 스티키 아트 · 우측 정보 패널
// 스크롤: 정보가 길면 페이지가 이어지고 탭·아트는 스티키 (v1.9)
// AU 선택 시 프로필 전체(이름·스펙·아트·탭·소개)가 그 AU의 값으로 전환 (charWithAu) —
// 편집은 EDIT → /chars/[id]/edit?au= 전용 페이지에서 새 프로필처럼 작성 (v1.9 사용자 확정)
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, charGrant, charWithAu, chipBorder, Relation, REL_SEED , findByKey, GalleryPost, galleryPostsOf, hasGallery} from '@/lib/charStore';
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
import { GalleryViewer } from '@/components/gallery/GalleryViewer';
import type { BackupPost } from '@/lib/galleryStore';
import { SpecsDisplay, PlainSpecRow } from '@/components/chars/SpecsDisplay';

/** 우측 정보 패널에서 「기본 정보」·탭 다음으로 쓰는 세 번째 특수 탭 값 — TRPG 버튼(EDIT·DELETE·
 *  GALLERY와 같은 자리)을 누르면 새 탭 전환과 같은 방식으로 이 값으로 바뀐다 (v2.8) */
const TRPG_TAB = '__trpg__';
/** 갤러리도 TRPG와 같은 방식 — 새 페이지로 가지 않고 우측 패널만 이 값으로 교체한다 (v3.1) */
const GALLERY_TAB = '__gallery__';

/** 갤러리 탭 내용 — TRPG 탭과 같은 방식으로 우측 패널만 교체해 보여준다 (v3.1).
 *  좌측 아이콘 탭·아트·상단 버튼은 그대로 PROFILE 화면과 같은 자리에 있다 */
function GalleryPanel({ posts, ph, canSeePrivate, loggedIn }: {
  posts: GalleryPost[]; ph: string; canSeePrivate: boolean; loggedIn: boolean;
}) {
  const [viewId, setViewId] = useState<string | null>(null);     // 단일 유형 — 전체화면 뷰어
  const [openId, setOpenId] = useState<string | null>(null);     // 로그/단일(세로) 유형 — 패널 안 상세
  const [unveiled, setUnveiled] = useState<Record<string, boolean>>({});

  // 공개범위 — 전체공개 / 멤버공개(로그인) / 나만보기(관리자·편집 권한자)
  const shown = posts.filter(p => p.visibility === 'public' || (p.visibility === 'member' && loggedIn) || canSeePrivate);
  if (shown.length === 0) {
    return <p className="hint">아직 등록된 사진이 없습니다</p>;
  }
  const opened = shown.find(p => p.id === openId);
  const dateOf = (p: GalleryPost) => {
    const d = new Date(p.madeDate ? p.madeDate + 'T00:00:00' : p.date);
    return isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const foldLabel = (p: GalleryPost) =>
    p.fold ? (p.fold.type === 'custom' ? (p.fold.label || '접힘') : p.fold.type === 'adult' ? '수위 주의' : '스포일러') : '';

  // 뷰어에서 이전/다음 글로 넘길 수 있는 묶음 — 같은 방식(단일 유형), 접힘이 풀린 것만
  const viewable: BackupPost[] = shown
    .filter(p => p.type === 'single' && p.images.length > 0 && (!p.fold || unveiled[p.id]))
    .map(p => ({
      id: p.id, title: p.title, type: 'single', images: p.images.map(g => g.ref), phList: [],
      desc: p.desc, category: '', tags: p.tags, madeDate: p.madeDate, date: p.date,
      author: '', authorId: '', visibility: 'public', fold: null,
    }));

  // 로그/단일(세로) 상세 — 패널 안에서 사진을 세로로 나열 (로그는 이어 붙이고, 세로는 갭을 둔다)
  if (opened) {
    return (
      <div>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setOpenId(null)}>‹ 목록</button>
        <h3 className="tab-tt" style={{ marginTop: 12 }}>{opened.title}</h3>
        <div className="sub">
          {dateOf(opened)}{(opened.tags ?? []).map(t => <i key={t} className="tag-in">#{t}</i>)}
        </div>
        {opened.desc && <div className="prose" style={{ marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(opened.desc) }} />}
        <div style={{ display: 'grid', gap: opened.type === 'vlist' ? 14 : 0 }}>
          {opened.images.map((g, i) => <StackImg key={g.ref + i} fileRef={g.ref} />)}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 홈페이지 갤러리 게시판(/gallery)과 같은 카드 — 4:3 썸네일 + 제목 + 'N장 · 날짜', 3열 */}
      <div className="g3">
        {shown.map(p => {
          const folded = !!p.fold && !unveiled[p.id];
          return (
            <div key={p.id} className="panel g-item"
              onClick={() => {
                if (folded) return;
                if (p.type === 'single' && p.images.length > 0) setViewId(p.id);
                else setOpenId(p.id);
              }}>
              <div className={`thumb ${folded ? 'veil' : ''}`}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {p.images[0] && <CroppedBlobImg fileRef={p.images[0].ref} crop={p.images[0].crop} ph={ph} />}
                </div>
                {folded && (
                  <div className="cover" onClick={e => { e.stopPropagation(); setUnveiled(u => ({ ...u, [p.id]: true })); }}>
                    <div><b>{foldLabel(p)}</b><br /><span>클릭하여 표시</span></div>
                  </div>
                )}
              </div>
              <div className="info">
                <b>{p.title}</b>
                <small>
                  {p.images.length}장{dateOf(p) ? ` · ${dateOf(p)}` : ''}
                  {p.visibility !== 'public' && <> · {p.visibility === 'member' ? '멤버공개' : '나만보기'}</>}
                  {(p.tags ?? []).map(t => <i key={t} className="tag-in">#{t}</i>)}
                </small>
              </div>
            </div>
          );
        })}
      </div>
      {/* 갤러리 게시판 '단일' 글과 같은 전체화면 뷰어 */}
      {viewId && viewable.some(v => v.id === viewId) && (
        <GalleryViewer posts={viewable} postId={viewId}
          onClose={() => setViewId(null)} onChangePost={setViewId} />
      )}
    </>
  );
}

function StackImg({ fileRef }: { fileRef: string }) {
  const url = useBlobUrl(fileRef);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />;
}

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
  const [tab, setTab] = useState(() => {
    const t = params.get('tab');
    return t === 'trpg' ? TRPG_TAB : t === 'gallery' ? GALLERY_TAB : 'basic';
  });
  const [artIdx, setArtIdx] = useState(0);
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
  useEffect(() => { setTab('basic'); setArtIdx(0); }, [auKey]);
  // 탭마다 다른 아트를 보여줄 수 있어(v2.4), 탭을 옮기면 이미지 인덱스를 처음으로
  useEffect(() => { setArtIdx(0); }, [tab]);

  // 캐릭터 테마색 → 페이지 임시 테마 (4.18 방식, v1.9) — 기본 테마는 이제 공용 레이아웃
  // (chars/[id]/layout.tsx)이 계속 맡고 있어, 여기서는 AU가 기본과 다른 색을 쓸 때만
  // "얹어서" 덮어쓴다. 벗어날 때도 null이 아니라 레이아웃의 기본색으로 돌려줘야
  // 상세↔갤러리 이동 때 배경이 깜빡이던 문제가 재발하지 않는다 (v2.7)
  const { setPageTheme, setPageBgImage } = useTheme();
  const baseColor = ch?.themeMode === 'custom' ? ch.color : null;
  const auColor = auRegistered && eff?.themeMode === 'custom' ? eff.color : null;
  useEffect(() => {
    if (!auColor || auColor === baseColor) return; // 기본과 같으면 레이아웃이 이미 칠해 둔 색 그대로 둔다
    setPageTheme(auColor);
    return () => setPageTheme(baseColor);
  }, [auColor, baseColor, setPageTheme]);

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

  return (
    <section className="page page-char-detail">
      <div className="page-head">
        {/* 제목 자리는 메뉴 이름 — 클릭 시 목록 복귀. 캐릭터 이름은 우측 프로필 패널에 크게 표시 */}
        <PageTitle href={tt.href}>{tt.title}</PageTitle>
        {/* 캐릭터별로 별도 저장 — 키에 캐릭터 id 포함 */}
        <EditableDesc k={`char-detail-desc:${ch.id}`} def="좌측 아이콘 탭 → 우측 정보 전환" />
        <div className="head-actions">
          {/* 관리자 또는 「편집까지」 권한 회원 (3차 회원-캐릭터 연결, v1.9)
              — AU 선택 상태의 EDIT은 그 AU 전용 프로필 편집으로 진입 */}
          {(isAdmin || charGrant(ch, user?.id) === 'edit') && (
            <button className="btn btn-dark" onClick={() => router.push(editHref)}>EDIT</button>
          )}
          {/* 캐릭터당 갤러리 하나 — TRPG와 같은 방식으로, 새 페이지로 가지 않고
              우측 패널만 갤러리 그리드로 교체한다 (v3.1 사용자 요청 — 좌측 아이콘 탭·아트와
              상단 버튼 위치를 PROFILE 화면과 통일) */}
          {hasGallery(ch) && (
            <button className="btn btn-dark" onClick={() => setTab(GALLERY_TAB)}>GALLERY</button>
          )}
          {/* TRPG 참여 세션 — 새 페이지로 가지 않고 새 탭 전환과 같은 방식으로 우측 패널만 교체 (v2.8) */}
          {(ch.trpgEnabled || hasTrpgLinks) && (
            <button className="btn btn-dark" onClick={() => setTab(TRPG_TAB)}>TRPG</button>
          )}
          {isAdmin && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
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
          ) : tab === GALLERY_TAB ? (
            <>
              <h3 className="tab-tt">Gallery</h3>
              <GalleryPanel posts={galleryPostsOf(ch)} ph={ch.thumbClass} loggedIn={!!user}
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
      )}

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
