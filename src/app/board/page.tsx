'use client';
// 일반 게시판 목록 (4.2 / 5.2 다중 게시판) — 말머리 필터 · 검색 · 비밀글 마스킹 · 접기 표시 · 페이지네이션
// ?b=<게시판 id> 로 게시판 구분 (없으면 기본 게시판) · 리스트 스킨: 기본형 / 티켓형 / 타래형(목록·상태구분) (5.2 v1.9 / 5.3)
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  useLocalList, BOARD_SEED, Post, fmtDate,
  CommentRow, COMMENT_KEY, COMMENT_SEED, commentsFor,
} from '@/lib/postStore';
import {
  useBoardSettings, useBoards, badgeFor, boardBadgeStyle, boardHref, MAIN_BOARD_ID, BoardPerm,
} from '@/lib/boardStore';
import { SearchBar, Pager } from '@/components/ui/Kit';
import { CropImg } from '@/components/ui/CropEditor';
import { EditableDesc, PageTitle } from '@/components/ui/PageText';
import { BannerBoardView } from '@/components/board/BannerBoard';
import { ScrapBoardView } from '@/components/board/ScrapBoard';

const PER_PAGE = 10;

/** 본문에서 첫 이미지 추출 — 티켓/타래형 스킨 썸네일용 (HTML img / MD 이미지) */
function firstImage(body: string): string | null {
  const html = /<img[^>]*src=["']([^"']+)["']/i.exec(body);
  if (html) return html[1];
  const md = /!\[[^\]]*\]\(([^)\s]+)/.exec(body);
  return md ? md[1] : null;
}

/** 스크롤이 일정 이상 내려가면 나타나는 맨 위로 버튼 (TOP 버튼) */
function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      className="scroll-top-btn"
      aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑ TOP
    </button>
  );
}

function BoardInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const params = useSearchParams();
  const bid = params.get('b') ?? MAIN_BOARD_ID;
  const { boards, loaded: boardsLoaded } = useBoards();
  const board = boards.find(b => b.id === bid) ?? boards[0];
  const [posts, setPosts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  // 댓글 수 — 댓글은 글과 따로 저장된다 (v2.0). 옛 글 안에 남아 있던 것도 함께 센다
  const [cmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const cmtCount = (p: Post) => commentsFor(cmtRows, 'post', p.id, p.comments).length;
  const { st: boardSet } = useBoardSettings();   // 시스템 뱃지 색 (환경설정 > 게시판 관리)
  const [cat, setCat] = useState('전체');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [bannerManageOpen, setBannerManageOpen] = useState(false); // 배너 게시판 전용 — 관리(수정/삭제) 패널 토글

  // 게시판 전환 시 필터·페이지 초기화
  const [prevBid, setPrevBid] = useState(bid);
  if (prevBid !== bid) { setPrevBid(bid); setCat('전체'); setQ(''); setPage(1); }

  // 권한 3단계 — mock 단계에선 로그인 전제 (로드뷰 4.10과 동일 규칙)
  const allow = (p: BoardPerm) => (p === 'admin' ? isAdmin : p === 'member' ? !!user : true);
  // 타래형(목록형) 게시판의 상태(진행중/완료) — 말머리(category)를 그대로 상태값으로 사용 (도토리 형식)
  const canSetStatus = (p: Post) => isAdmin || (!!p.authorId && p.authorId === user?.id);
  const cycleStatus = (p: Post) => {
    const labels = board.cats.map(c => c.label);
    const idx = labels.indexOf(p.category);
    const next = labels[(idx + 1) % labels.length] ?? labels[0];
    setPosts(posts.map(x => (x.id === p.id ? { ...x, category: next } : x)));
  };

  const visible = useMemo(() => {
    let list = posts.filter(p => (p.boardId ?? MAIN_BOARD_ID) === board.id);
    if (board.skin === 'thread') {
      // 진행중/완료 상태 구분 (도토리 게시판과 같은 형식) — 전체 탭에는 완료 게시물도 함께 표시
      if (cat !== '전체') list = list.filter(p => p.category === cat);
    } else if (cat === '공지') list = list.filter(p => p.notice);
    else if (cat !== '전체') list = list.filter(p => p.category === cat);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(k) ||
        p.author.toLowerCase().includes(k) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(k)) ||   // 태그 검색 (v2.0 사용자 요청)
        (!p.secret && p.body.toLowerCase().includes(k)));
    }
    // 공지 상단 고정 + 최신순
    return list.sort((a, b) =>
      (b.notice ? 1 : 0) - (a.notice ? 1 : 0) || b.date.localeCompare(a.date));
  }, [posts, board.id, cat, q]);

  // 상태 탭 옆 개수 표시 (도토리 게시판과 같은 형식) — 검색어와 무관하게 이 게시판 전체 기준
  const boardPosts = useMemo(() => posts.filter(p => (p.boardId ?? MAIN_BOARD_ID) === board.id), [posts, board.id]);
  const countFor = (label: string) =>
    (label === '전체' ? boardPosts.length : boardPosts.filter(p => p.category === label).length);

  // 타래형은 5열 그리드라 12개면 마지막 줄이 2개만 채워져 허전해 보인다 — 15개(5열×3줄)로 맞춘다
  // 스크랩형은 3열 담벼락(masonry)이라 18개(3열×6줄)로 맞춘다
  const perPage = board.skin === 'thread' ? 15 : board.skin === 'scrap' ? 18 : PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const pageList = visible.slice((page - 1) * perPage, page * perPage);
  /* 비밀글 열람 (v2.0 발견) — authorId 없는 비밀글은 비로그인 방문자에게도 열렸다.
     둘 다 undefined라 `undefined === undefined`가 참이었기 때문 */
  const canRead = (p: Post) => !p.secret || isAdmin || (!!p.authorId && p.authorId === user?.id);

  if (!boardsLoaded) return <section className="page" />;

  const postBadge = (p: Post) => (
    <span style={boardBadgeStyle(badgeFor(boardSet, p, board.cats))}>
      {p.notice ? boardSet.system[0].label : p.secret ? boardSet.system[1].label : p.category}
    </span>
  );

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={boardHref(board.id)}>{board.id === MAIN_BOARD_ID ? 'BOARD' : board.name}</PageTitle>
        <EditableDesc k={board.id === MAIN_BOARD_ID ? 'board-desc' : `board-desc-${board.id}`} def={board.desc} />
      </div>
      <div className="toolrow">
        {board.skin === 'banner' || board.skin === 'scrap' ? <div /> : (
          <div className="seg">
            {(board.skin === 'thread' ? ['전체', ...board.cats.map(x => x.label)] : ['전체', '공지', ...board.cats.map(x => x.label)]).map(c => (
              <button key={c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setPage(1); }}>
                {c}{board.skin === 'thread' && <small style={{ marginLeft: 5, opacity: .7 }}>{countFor(c)}</small>}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {board.skin !== 'banner' && <SearchBar onSearch={v => { setQ(v); setPage(1); }} />}
          {board.skin === 'banner' && !!user && (isAdmin || visible.some(p => !!p.authorId && p.authorId === user.id)) && (
            <button className={`btn ${bannerManageOpen ? 'btn-dark' : 'btn-onbk'}`} onClick={() => setBannerManageOpen(v => !v)}>
              {bannerManageOpen ? '관리 닫기' : '관리'}
            </button>
          )}
          {allow(board.permWrite) && !!user && (
            <button className="btn btn-dark" onClick={() => router.push(`/board/write?b=${board.id}`)}>✎ WRITE</button>
          )}
        </div>
      </div>

      {board.skin === 'banner' ? (
        /* 배너 게시판 (5.7) — 그누보드 배너 게시판 스킨 이식. 헤더/공지/동맹/이웃 배너를 구역별로 표시하는
           별도 배너 전용 페이지 — 필터·페이지네이션 없이 이 게시판에 속한 배너를 전부 보여준다 */
        <BannerBoardView board={board} posts={posts} setPosts={setPosts} isAdmin={isAdmin} user={user}
          manageOpen={bannerManageOpen} onCloseManage={() => setBannerManageOpen(false)} />
      ) : board.skin === 'scrap' ? (
        /* 스크랩 게시판 (5.8) — 그누보드 스크랩 게시판 스킨 이식. X(트위터)·유튜브 임베드,
           이미지·링크 카드를 3열 담벼락형(masonry)으로 보여준다 */
        <ScrapBoardView board={board} items={pageList} posts={posts} setPosts={setPosts} isAdmin={isAdmin} user={user} />
      ) : board.skin === 'thread' ? (
        /* 타래형 스킨(목록형 전용) — 썸네일 그리드 + 진행중/완료 상태 배지(작성자·관리자는 클릭해 전환) */
        <div className="bthread-grid">
          {pageList.map(p => {
            const thumb = canRead(p) ? (p.thumbSrc ?? firstImage(p.body)) : null;
            const spoiler = !!p.fold && p.fold.type === 'spoiler';
            const statusStyle = boardBadgeStyle(badgeFor(boardSet, { ...p, notice: false, secret: false }, board.cats));
            return (
              <div className="bthread-gcard" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
                <div className={`bthread-gthumb ${spoiler ? 'spoiler' : ''}`}>
                  {thumb
                    ? <CropImg src={thumb} crop={p.thumbSrc ? p.thumbCrop : undefined} />
                    : <div className="bt-ph">{(canRead(p) ? p.title : 'SECRET').slice(0, 1).toUpperCase()}</div>}
                  {spoiler && <span className="bthread-gbadge">스포일러</span>}
                  {canRead(p) && (
                    <span
                      className="bthread-gstatus"
                      style={statusStyle}
                      onClick={e => { if (canSetStatus(p)) { e.stopPropagation(); cycleStatus(p); } }}
                    >
                      {p.category}
                    </span>
                  )}
                </div>
                <div className="bthread-gtitle">
                  {canRead(p) ? p.title : '🔒 비밀글입니다'}
                  {canRead(p) && cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                </div>
              </div>
            );
          })}
          {pageList.length === 0 && (
            <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      ) : board.skin === 'ticket' ? (
        /* 티켓형 스킨 (5.2 v1.9) — 왼쪽 썸네일(본문 첫 이미지) + 절취선 + 오른쪽 글 정보 */
        <div style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => {
            // 대표 이미지(직접 선택 + 크롭) 우선, 없으면 본문 첫 이미지 (v1.9)
            const thumb = canRead(p) ? (p.thumbSrc ?? firstImage(p.body)) : null;
            return (
              <div className="bticket" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
                <div className="bt-thumb">
                  {thumb
                    ? <CropImg src={thumb} crop={p.thumbSrc ? p.thumbCrop : undefined} />
                    : <div className="bt-ph">{(canRead(p) ? p.title : 'SECRET').slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="bt-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {postBadge(p)}
                    {p.fold && <span style={boardBadgeStyle(boardSet.system[2])}>{boardSet.system[2].label}</span>}
                  </div>
                  <div className="bt-title">
                    {canRead(p) ? <>{p.secret && '🔒 '}{p.title}</> : '🔒 비밀글입니다'}
                    {canRead(p) && cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                  </div>
                  <div className="bt-meta">{p.author} · {fmtDate(p.date)}</div>
                </div>
              </div>
            );
          })}
          {pageList.length === 0 && (
            <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      ) : (
        /* 기본형 스킨 — 리스트 행 (글씨색은 게시판 관리에서 지정 가능, v1.9) */
        <div className="panel board-list flush" style={board.fg ? { color: board.fg } : undefined}>
          {pageList.map(p => (
            <div className="brow" key={p.id} onClick={() => { if (canRead(p)) router.push(`/board/${p.id}`); }}>
              <span className="cat">{postBadge(p)}</span>
              {/* 제목 칸 안에서 태그를 오른쪽 끝(=작성자 바로 왼쪽)에 정렬 (v2.0 사용자 요청) —
                  칸을 따로 만들면 행마다 그리드가 독립이라 작성자 열이 태그 길이만큼 어긋난다 */}
              <div className="tcell">
                {canRead(p) ? (
                  <b>
                    {p.secret && '🔒 '}{p.title}
                    {cmtCount(p) > 0 && <span className="cmt">{cmtCount(p)}</span>}
                    {p.fold && <span style={{ ...boardBadgeStyle(boardSet.system[2]), marginLeft: 6 }}>{boardSet.system[2].label}</span>}
                  </b>
                ) : (
                  <b style={{ color: 'var(--faint)' }}>🔒 비밀글입니다</b>
                )}
                {canRead(p) && (p.tags ?? []).length > 0 && (
                  <span className="tags">{(p.tags ?? []).map(t => <i key={t}>#{t}</i>)}</span>
                )}
              </div>
              <span className="who">{p.author}</span>
              <span className="dt">{fmtDate(p.date)}</span>
            </div>
          ))}
          {pageList.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시글이 없습니다</div>
          )}
        </div>
      )}
      {board.skin !== 'banner' && <Pager page={page} total={totalPages} onChange={setPage} />}
      {board.skin === 'thread' && <ScrollTopButton />}
    </section>
  );
}

export default function BoardPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><BoardInner /></Suspense>;
}
