'use client';
// 스크랩 게시판 (5.8) — 그누보드 스크랩 게시판 스킨(write.skin.php / list.skin.php / view.skin.php / _helper.php)을
// 이 저장소 방식으로 옮긴 것. 개별 보기 페이지가 없고(목록으로 리다이렉트, 배너 게시판과 동일 방식) 목록 자체가
// 3열 담벼락형(masonry) 카드로 X(트위터)/유튜브 임베드, 이미지 카드, 외부 링크 카드를 보여준다.
// 제목은 채우지 않아도 되고(비어 있으면 아이콘만 표시), 본문에 URL만 단독으로 있는 줄이 자동으로 임베드된다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, BOARD_SEED, Post, newId, fmtDate } from '@/lib/postStore';
import { Board, boardHref } from '@/lib/boardStore';
import { renderScrapContent } from '@/lib/scrapEmbed';
import { KInput, KTextarea, KCheck } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { useConfirmDelete } from '@/components/ui/Modal';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

/* ================= 트위터(X) 위젯 스크립트 로더 ================= */
// 원본 list.skin.php의 loadTwitterEmbeds()와 동일한 목적 — 카드 안 blockquote.twitter-tweet을
// 실제 임베드로 바꿔주는 위젯 스크립트를 한 번만 불러오고, 목록이 바뀔 때마다 다시 렌더를 요청한다.
let twitterScriptState: 'idle' | 'loading' | 'ready' = 'idle';
const twitterReadyCbs: (() => void)[] = [];

function ensureTwitterScript(onReady: () => void) {
  if (twitterScriptState === 'ready' && window.twttr?.widgets) { onReady(); return; }
  twitterReadyCbs.push(onReady);
  if (twitterScriptState !== 'idle') return;
  twitterScriptState = 'loading';
  const s = document.createElement('script');
  s.src = 'https://platform.twitter.com/widgets.js';
  s.async = true;
  s.charset = 'utf-8';
  s.onload = () => {
    twitterScriptState = 'ready';
    twitterReadyCbs.splice(0).forEach(cb => cb());
  };
  document.body.appendChild(s);
}

function useTwitterWidgets(deps: React.DependencyList) {
  useEffect(() => {
    if (!document.querySelector('blockquote.twitter-tweet')) return;
    ensureTwitterScript(() => { window.twttr?.widgets?.load(document.body); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

declare global {
  interface Window { twttr?: { widgets?: { load: (el?: HTMLElement) => void } } }
}

/* ================= 글쓰기/수정 폼 ================= */

export function ScrapWriteForm({ board, editPid }: { board: Board; editPid?: string }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [posts, setPosts, postsLoaded] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const editing = editPid ? posts.find(p => p.id === editPid) : undefined;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [secret, setSecret] = useState(false);
  const [notice, setNotice] = useState(false);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!editPid || !postsLoaded || hydrated.current) return;
    const p = posts.find(x => x.id === editPid);
    if (!p) return;
    hydrated.current = true;
    setTitle(p.title);
    setContent(p.body);
    setSecret(p.secret);
    setNotice(p.notice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPid, postsLoaded, posts]);

  const preview = useMemo(() => renderScrapContent(content), [content]);
  useTwitterWidgets([preview.bodyHtml]);

  if (!user) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>WRITE</PageTitle><p>글쓰기는 로그인 후 이용할 수 있습니다</p></div>
      </section>
    );
  }
  if (editing && editing.authorId !== user.id && !isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>WRITE</PageTitle><p>수정은 작성자 본인만 할 수 있습니다</p></div>
      </section>
    );
  }

  const save = () => {
    if (!content.trim()) { toast('내용을 입력해 주세요.'); return; }
    // 제목은 비워 둘 수 있다 (원본 write.skin.php — 제목 없이 링크만 붙여넣는 사용을 전제로 한다)
    if (editing) {
      setPosts(posts.map(p => (p.id === editing.id ? {
        ...p, title: title.trim(), body: content, mode: 'md', secret, notice: isAdmin ? notice : p.notice,
      } : p)));
      toast('수정되었습니다');
      router.push(boardHref(board.id));
      return;
    }
    const p: Post = {
      id: newId(),
      title: title.trim(), body: content, mode: 'md',
      category: '', author: user.nickname, authorId: user.id, date: new Date().toISOString(),
      secret, notice: isAdmin ? notice : false, fold: null, comments: [],
      boardId: board.id,
    };
    setPosts([p, ...posts]);
    toast('등록되었습니다');
    router.push(boardHref(board.id));
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={boardHref(board.id)}>{editing ? 'EDIT' : 'WRITE'}</PageTitle>
        <EditableDesc k="board-write-desc-scrap" def="제목 없이도 등록할 수 있습니다 · URL만 단독 줄로 붙여넣으면 X(트위터)/유튜브/이미지/링크 카드로 자동 임베드됩니다" />
      </div>
      <div className="panel" style={{ padding: 24, maxWidth: 620, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div>
          <label className="k-label" style={{ marginBottom: 6 }}>제목 <small style={{ fontWeight: 400 }}>선택 입력</small></label>
          <KInput value={title} onChange={e => setTitle(e.target.value)} placeholder="제목 (비워 두면 아이콘만 표시됩니다)" style={{ width: '100%' }} />
        </div>
        <div>
          <label className="k-label" style={{ marginBottom: 6 }}>내용</label>
          <KTextarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={'내용을 입력하세요\n\nX(트위터)·유튜브·이미지·그 외 링크는 한 줄에 URL만 단독으로 붙여넣으세요'}
            style={{ minHeight: 200 }} />
        </div>
        {preview.bodyHtml !== '' && (
          <div className="preview-box">
            <div className="pv-label">PREVIEW</div>
            <div className="bscrap-content" dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
          </div>
        )}
        <div style={{ display: 'grid', gap: 9 }}>
          <KCheck label="비밀글 (관리자와 나만 열람)" checked={secret} onChange={setSecret} />
          {isAdmin && <KCheck label="공지로 고정" checked={notice} onChange={setNotice} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-onbk" onClick={() => router.push(boardHref(board.id))}>CANCEL</button>
          <button className="btn btn-accent" onClick={save}>{editing ? 'SAVE' : 'POST'}</button>
        </div>
      </div>
    </section>
  );
}

/* ================= 카드 ================= */

/** 카드 우상단 "⋯" 관리 메뉴 — 수정/삭제 (작성자·관리자만) */
function CardMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);
  return (
    <div className={`bscrap-card-menu ${open ? 'is-open' : ''}`} ref={ref}>
      <button type="button" className="bscrap-card-menu__toggle" aria-label="게시물 메뉴"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
        <i className="fa-solid fa-ellipsis" />
      </button>
      <div className="bscrap-card-menu__dropdown">
        <button type="button" className="bscrap-card-menu__item" onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }}>
          <i className="fa-regular fa-pen-to-square" /><span>수정</span>
        </button>
        <button type="button" className="bscrap-card-menu__item" onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}>
          <i className="fa-regular fa-trash-can" /><span>삭제</span>
        </button>
      </div>
    </div>
  );
}

function ScrapCard({ post, canRead, canManage, onEdit, onDelete }: {
  post: Post; canRead: boolean; canManage: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const rendered = useMemo(() => (canRead ? renderScrapContent(post.body) : { bodyHtml: '', needsTwitter: false }), [post.body, canRead]);
  const titleIcon = post.notice ? 'fa-bullhorn' : post.secret ? 'fa-lock' : 'fa-thumbtack';
  const handle = post.authorId ? `@${post.authorId}` : '@anonymous';

  return (
    <article className={`bscrap-card ${post.notice ? 'is-notice' : ''}`}>
      <header className="bscrap-card__header">
        <h3 className="bscrap-card__title"><i className={`fa-solid ${titleIcon}`} /> {post.title}</h3>
        {canManage && <CardMenu onEdit={onEdit} onDelete={onDelete} />}
      </header>

      {!canRead ? (
        <div className="bscrap-secret-card">
          <div className="bscrap-secret-card__title"><i className="fa-solid fa-lock" /> 비밀글 기능으로 보호된 글입니다.</div>
        </div>
      ) : (
        <div className="bscrap-card__body">
          <div className="bscrap-author">
            <div className="bscrap-author__avatar"><i className="fa-solid fa-user" /></div>
            <div className="bscrap-author__meta">
              <strong>{post.author}</strong>
              <span>{handle}</span>
            </div>
            <div className="bscrap-author__date">{fmtDate(post.date)}</div>
          </div>
          {rendered.bodyHtml !== '' && (
            <div className="bscrap-content" dangerouslySetInnerHTML={{ __html: rendered.bodyHtml }} />
          )}
        </div>
      )}
    </article>
  );
}

/* ================= 목록(전용 페이지) 뷰 ================= */

export function ScrapBoardView({ board, items, posts, setPosts, isAdmin, user }: {
  board: Board; items: Post[]; posts: Post[]; setPosts: (next: Post[]) => void;
  isAdmin: boolean; user: { id: string } | null;
}) {
  const router = useRouter();
  const del = useConfirmDelete();

  useTwitterWidgets([items.map(p => p.id).join(',')]);

  const canRead = (p: Post) => !p.secret || isAdmin || (!!p.authorId && p.authorId === user?.id);
  const canManage = (p: Post) => isAdmin || (!!p.authorId && p.authorId === user?.id);
  const goEdit = (p: Post) => router.push(`/board/write?b=${board.id}&edit=${p.id}`);
  // ⚠️ posts는 이 게시판만이 아니라 전체 게시판의 글을 담은 배열이다 — 반드시 전체 배열 기준으로 필터링해
  // setPosts에 넘겨야 한다 (배너 게시판과 동일한 v2.4 사고 재발 방지 규칙)
  const goDelete = (p: Post) => del.ask('게시물을 삭제하시겠습니까?', () => setPosts(posts.filter(x => x.id !== p.id)));

  return (
    <>
      {items.length === 0 ? (
        <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>게시물이 없습니다</div>
      ) : (
        <div className="bscrap-grid">
          {items.map(p => (
            <ScrapCard key={p.id} post={p} canRead={canRead(p)} canManage={canManage(p)}
              onEdit={() => goEdit(p)} onDelete={() => goDelete(p)} />
          ))}
        </div>
      )}
      {del.element}
    </>
  );
}
