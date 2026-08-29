'use client';
// 게시글 상세 (4.2) — 본문 렌더(격리 새니타이즈) · 접기 · 댓글+대댓글
// 세션 게시판(타래형)은 댓글도 감상타래와 같은 이어쓰기 방식(사진 최대 4장, 대댓글 없음) — 5.5
import React, { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHrefBlock } from '@/components/shell/MenuGuard';
import { extraBoardHref } from '@/lib/menuStore';
import { useAuth } from '@/lib/auth';
import {
  useLocalList, BOARD_SEED, Post, Comment, newId, fmtDate,
  CommentRow, COMMENT_KEY, COMMENT_SEED, commentsFor,
} from '@/lib/postStore';
import { useBoards, boardHref, MAIN_BOARD_ID, BoardPerm } from '@/lib/boardStore';
import { renderBody } from '@/lib/sanitize';
import { putBlob, BlobImg } from '@/lib/blobStore';
import { KInput } from '@/components/ui/Kit';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { GuestIdBar } from '@/components/ui/GuestId';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';
import { Lightbox } from '@/components/ui/Lightbox';

const FOLD_LABEL = { spoiler: '스포일러 주의', adult: '수위 주의' };

// 사진 첨부 픽토그램 (감상타래와 동일 — 이모지 아님)
const PhotoIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M3.5 17.5 9 13l4 3.5 3.5-3 4 4" />
  </svg>
);

/** 댓글 첨부 이미지 — 1장=와이드, 2~4장=격자 (감상타래 PostImgs와 동일 규칙) */
function CmtImgs({ images, onOpen }: { images?: string[]; onOpen: (ids: string[], idx: number) => void }) {
  const ids = images ?? [];
  if (ids.length === 0) return null;
  return (
    <div className={`thr-imgs ${ids.length === 1 ? 'one' : ids.length === 3 ? 'three' : ''}`}>
      {ids.map((idv, i) => (
        <div key={idv} className="im" onClick={() => onOpen(ids, i)}><BlobImg fileRef={idv} /></div>
      ))}
    </div>
  );
}

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [posts, setPosts, loaded] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  // 댓글은 글과 따로 저장된다 (v2.0) — 글 안에 두면 댓글을 달 때 글을 UPDATE 해야 해서
  // 일반 회원이 관리자 글에 댓글을 달 수 없었다 (포크 사용자 제보)
  const [cmtRows, setCmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const { boards } = useBoards();                  // 소속 게시판 (5.2 다중 게시판)
  const [open, setOpen] = useState(false);         // 접기 해제
  const [cmt, setCmt] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [delAsk, setDelAsk] = useState(false);
  const [gName, setGName] = useState('');                       // 게스트 닉네임 (방문자 댓글 허용 시)
  // 세션 게시판(타래형) 댓글 첨부 이미지 — 감상타래와 동일하게 최대 4장 (5.5)
  const [cmtFiles, setCmtFiles] = useState<File[]>([]);
  const [cmtUrls, setCmtUrls] = useState<string[]>([]);
  const cmtImgRef = useRef<HTMLInputElement>(null);
  const [lb, setLb] = useState<{ srcs: string[]; idx: number } | null>(null);
  // 세션 게시판(타래형) 댓글 스포일러 접기 (5.6) — 작성 시 체크, 목록에서는 댓글별로 따로 펼침
  const [cmtSpoiler, setCmtSpoiler] = useState(false);
  const [openCmts, setOpenCmts] = useState<Set<string>>(new Set());

  const post = posts.find(p => p.id === id);
  /* 이 글이 속한 곳이 비공개면 주소로 들어와도 열리지 않게 (v2.0 사용자 요청).
     글 주소에는 섹션이 없어 MenuGuard가 못 막는다 — 글을 읽어 소속을 알아낸 여기서 판정한다.
     **다른 early return보다 먼저 불러야 한다**(훅이므로 렌더마다 개수가 같아야 한다) */
  const bid = post?.boardId ?? MAIN_BOARD_ID;
  const blocked = useHrefBlock(post && (bid === MAIN_BOARD_ID ? '/board' : extraBoardHref(bid)));
  // loaded 이후에만 본문 렌더 (SSR/하이드레이션 불일치 방지)
  const html = useMemo(() => (post && loaded ? renderBody(post.mode, post.body) : ''), [post, loaded]);

  // 막힌 곳이면 여기서 되돌아간다 — 훅을 모두 부른 뒤여야 렌더마다 개수가 같다
  if (blocked) return blocked;
  if (!loaded) return <section className="page" />;
  if (!post) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>BOARD</PageTitle><p>글을 찾을 수 없습니다</p></div>
      </section>
    );
  }
  /* 글쓴이인지 한 곳에서 정한다 (v2.0 발견) — 예전 글이나 손님이 쓴 글은 authorId가 없고
     비로그인 방문자도 user?.id가 없어, 서로 「같다」고 판정돼 **비밀글이 그대로 열렸다.** */
  const isAuthor = !!post.authorId && post.authorId === user?.id;
  if (post.secret && !isAdmin && !isAuthor) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>BOARD</PageTitle><p>비밀글 — 작성자와 관리자만 열람할 수 있습니다</p></div>
      </section>
    );
  }

  const board = boards.find(b => b.id === (post.boardId ?? MAIN_BOARD_ID)) ?? boards[0];
  const boardTitle = board.id === MAIN_BOARD_ID ? 'BOARD' : board.name;
  // 댓글 권한 (5.2) — 방문자 허용 시 게스트 작성(닉네임+비밀번호, 방명록 4.7 규칙)
  const allow = (p: BoardPerm) => (p === 'admin' ? isAdmin : p === 'member' ? !!user : true);
  const guestMode = !user && board.permComment === 'guest';
  const canComment = allow(board.permComment) && (!!user || guestMode);

  const canManage = isAdmin || isAuthor;
  const update = (patch: Partial<Post>) =>
    setPosts(posts.map(p => (p.id === post.id ? { ...p, ...patch } : p)));

  // 이 글의 댓글 — 분리 저장분 + 옛 글 안에 남아 있던 것 (v2.0)
  const comments = commentsFor(cmtRows, 'post', post.id, post.comments);

  const addCmtFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...cmtFiles, ...Array.from(list)].slice(0, 4); // 이미지 4장 제한 (감상타래와 동일, 5.5)
    if (cmtFiles.length + list.length > 4) toast('이미지는 최대 4장까지 첨부할 수 있습니다');
    setCmtFiles(next);
    setCmtUrls(next.map(f => URL.createObjectURL(f)));
  };
  const removeCmtFile = (i: number) => {
    const next = cmtFiles.filter((_, x) => x !== i);
    setCmtFiles(next);
    setCmtUrls(next.map(f => URL.createObjectURL(f)));
  };

  const addComment = async () => {
    if (!canComment) { toast('댓글은 로그인 후 작성할 수 있습니다'); return; }
    if (!cmt.trim() && cmtFiles.length === 0) return;
    if (guestMode && !gName.trim()) { toast('닉네임을 입력해 주세요'); return; }
    const images: string[] = [];
    for (const f of cmtFiles) images.push(await putBlob(f));
    const base = {
      id: newId(), text: cmt.trim(), date: new Date().toISOString(), parentId: replyTo ?? undefined,
      images: images.length ? images : undefined,
      fold: (board.skin === 'thread' && cmtSpoiler) ? { type: 'spoiler' as const } : undefined,
    };
    const c: CommentRow = user
      ? { ...base, target: 'post', targetId: post.id, author: user.nickname, authorId: user.id }
      : { ...base, target: 'post', targetId: post.id, author: gName.trim(), authorId: '' };
    setCmtRows([...cmtRows, c]);
    setCmt(''); setReplyTo(null); setCmtFiles([]); setCmtUrls([]); setCmtSpoiler(false);
  };

  // 댓글 삭제 — 대댓글도 함께. 옛 글 안에 있던 댓글이면 글 쪽에서 지운다 (v2.0)
  const removeComment = (c: Comment) => {
    const gone = (x: { id: string; parentId?: string }) => x.id === c.id || x.parentId === c.id;
    if (cmtRows.some(gone)) setCmtRows(cmtRows.filter(x => !gone(x)));
    if (post.comments.some(gone)) update({ comments: post.comments.filter(x => !gone(x)) });
  };
  const roots = comments.filter(c => !c.parentId);
  const childrenOf = (pid: string) => comments.filter(c => c.parentId === pid);

  const CmtRow = ({ c, depth }: { c: Comment; depth: number }) => (
    <div className={`cmt ${depth > 0 ? 'reply-depth' : ''}`}>
      <b>{c.author}</b><small>{fmtDate(c.date)}</small>
      {canComment && depth === 0 && (
        <small style={{ cursor: 'var(--cur-pointer,pointer)', color: 'var(--accent)', marginLeft: 8 }}
          onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
          {replyTo === c.id ? '답글 취소' : '답글'}
        </small>
      )}
      {/* 손님 댓글은 관리자만 지운다 (v2.0 사용자 확정) — 서버가 그렇게밖에 못 받는다 */}
      {(isAdmin || (user && c.authorId === user.id)) && (
        <small style={{ cursor: 'var(--cur-pointer,pointer)', marginLeft: 8 }}
          onClick={() => removeComment(c)}>
          삭제
        </small>
      )}
      <p>{c.text}</p>
    </div>
  );

  // 세션 게시판(타래형) 댓글 — 감상타래 이어쓰기와 같은 카드형, 대댓글 없이 시간순 (5.5)
  // 세션 게시판(타래형) 댓글 — 감상타래 이어쓰기와 같은 카드형, 대댓글 없이 시간순 (5.5)
  // 스포일러 접기 (5.6) — 글 접기(veil)와 동일한 방식, 댓글별로 따로 펼침 상태를 기억한다
  const toggleCmtOpen = (id: string) =>
    setOpenCmts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const ThrCmtRow = ({ c }: { c: Comment }) => {
    const cOpen = openCmts.has(c.id);
    return (
      <div className="thr-post">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <b style={{ fontSize: 12.5 }}>{c.author}</b>
          <span style={{ fontSize: 10, color: 'var(--faint)' }}>{fmtDate(c.date)}</span>
        </div>
        <div className={`veil ${!c.fold || cOpen ? 'open' : ''}`}>
          {c.fold && !cOpen && (
            <div className="cover" onClick={() => toggleCmtOpen(c.id)} style={{ position: 'absolute' }}>
              <div>
                <b>{c.fold.type === 'custom' ? (c.fold.label || '접힌 댓글') : FOLD_LABEL[c.fold.type]}</b>
                <span style={{ display: 'block' }}>클릭하면 내용이 표시됩니다</span>
              </div>
            </div>
          )}
          <div style={c.fold && !cOpen ? { minHeight: 60, filter: 'blur(6px)' } : undefined}>
            {c.text && <p>{c.text}</p>}
            <CmtImgs images={c.images} onOpen={(ids, idx) => setLb({ srcs: ids, idx })} />
          </div>
        </div>
        {(isAdmin || (user && c.authorId === user.id)) && (
          <div className="hv-actions">
            <button className="del" onClick={() => removeComment(c)}>DELETE</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={boardHref(board.id)}>{boardTitle}</PageTitle>
        <p>{post.notice ? '공지 · ' : `${post.category} · `}{post.author} · {fmtDate(post.date)}</p>
        {/* 세션 게시판(타래형) ↔ 플레이 기록 연동 정보 (5.4) */}
        {post.session && (
          <p style={{ marginTop: -4, fontSize: 12, color: 'var(--faint)' }}>
            {[post.session.date?.replace(/-/g, '.'), post.session.playtime, post.session.role, post.session.withText]
              .filter(Boolean).join(' · ')}
            {post.session.recordId && (
              <>
                {' · '}
                <a style={{ cursor: 'var(--cur-pointer,pointer)', color: 'var(--accent)' }}
                  onClick={() => router.push('/playlog')}>플레이 기록에서 보기 →</a>
              </>
            )}
          </p>
        )}
        <div className="head-actions">
          {/* 수정은 작성자 본인만 — 관리자도 타인 글은 삭제만 (v1.9) */}
          {isAuthor && (
            <button className="btn btn-dark" onClick={() => router.push(`/board/write?edit=${post.id}`)}>EDIT</button>
          )}
          {canManage && (
            <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: '26px 28px' }}>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>
          {post.secret && '🔒 '}{post.title}
        </h2>
        <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 18 }}>
          {post.author} · {fmtDate(post.date)} · {post.mode.toUpperCase()}
          {/* 태그 (v2.0 사용자 요청) — 목록과 같은 표기 */}
          {(post.tags ?? []).map(t => (
            <span key={t} style={{ marginLeft: 7, color: 'color-mix(in srgb,var(--accent) 65%,var(--faint))' }}>#{t}</span>
          ))}
        </p>

        {/* 접기 (6.2) — 흐림 커버, 클릭 시 표시 */}
        <div className={`veil ${!post.fold || open ? 'open' : ''}`}>
          {post.fold && !open && (
            <div className="cover" onClick={() => setOpen(true)} style={{ position: 'absolute' }}>
              <div>
                <b>{post.fold.type === 'custom' ? (post.fold.label || '접힌 글') : FOLD_LABEL[post.fold.type]}</b>
                <span style={{ display: 'block' }}>클릭하면 내용이 표시됩니다</span>
              </div>
            </div>
          )}
          <div className="post-body" style={post.fold && !open ? { minHeight: 120, filter: 'blur(6px)' } : undefined}
            dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>

      {/* 댓글 — 세션 게시판(타래형)은 감상타래와 같은 이어쓰기 방식, 그 외는 기존 댓글+대댓글 (5.5) */}
      <div className="panel" style={{ padding: 0, marginTop: 16 }}>
        <div style={{ padding: '16px 18px' }}>
          <h4 style={{ fontSize: 11.5, letterSpacing: '.12em', color: 'var(--faint)', marginBottom: 13 }}>
            COMMENTS {comments.length > 0 && <span style={{ color: 'var(--accent)' }}>{comments.length}</span>}
          </h4>
          {board.skin === 'thread' ? (
            comments.map(c => <ThrCmtRow key={c.id} c={c} />)
          ) : (
            roots.map(c => (
              <React.Fragment key={c.id}>
                <CmtRow c={c} depth={0} />
                {childrenOf(c.id).map(cc => <CmtRow key={cc.id} c={cc} depth={1} />)}
              </React.Fragment>
            ))
          )}
          {comments.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--faint)' }}>첫 댓글을 남겨보세요</p>
          )}
        </div>
        {canComment ? (
          board.skin === 'thread' ? (
            /* 이어쓰기 컴포저 (감상타래와 동일 — 텍스트 + 사진 최대 4장) */
            <div className="thr-write">
              {guestMode && <div style={{ padding: '0 18px' }}><GuestIdBar name={gName} onName={setGName} /></div>}
              <textarea placeholder="댓글 남기기…" value={cmt} onChange={e => setCmt(e.target.value)} />
              {cmtUrls.length > 0 && (
                <div className="thr-att">
                  {cmtUrls.map((u, i) => (
                    <div key={i} className="at">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" />
                      <button onClick={() => removeCmtFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="wfoot">
                <input ref={cmtImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { addCmtFiles(e.target.files); e.target.value = ''; }} />
                <button className="icobtn" data-tip="사진 추가 (최대 4장)" onClick={() => cmtImgRef.current?.click()}>
                  <PhotoIcon />
                </button>
                {/* 스포일러 접기 (5.6) — 글 접기와 같은 규칙, 체크하면 이 댓글만 흐림 처리되어 올라간다 */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--sub)',
                  cursor: 'var(--cur-pointer,pointer)',
                }}>
                  <input type="checkbox" checked={cmtSpoiler} onChange={e => setCmtSpoiler(e.target.checked)} />
                  스포일러 접기
                </label>
                <button className="btn btn-dark" style={{ padding: '8px 20px', fontSize: 12, borderRadius: 20 }}
                  onClick={addComment}>POST</button>
              </div>
            </div>
          ) : (
            /* 게스트 작성(방문자 허용) — 구분선 아래 GUEST 바 + 입력줄 세로 배치 */
            <div className={`cmt-input ${guestMode ? 'guest' : ''}`}>
              {guestMode && <GuestIdBar name={gName} onName={setGName} />}
              <div className="ci-row" style={guestMode ? undefined : { display: 'contents' }}>
                <KInput
                  placeholder={replyTo ? '답글 작성...' : '댓글 남기기...'}
                  value={cmt} onChange={e => setCmt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
                />
                <button className="btn btn-dark" onClick={addComment}>POST</button>
              </div>
            </div>
          )
        ) : (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)' }}>
            {user ? '이 게시판은 관리자만 댓글을 쓸 수 있습니다' : '댓글은 로그인 후 작성할 수 있습니다'}
          </div>
        )}
      </div>

      {lb && <Lightbox srcs={lb.srcs} index={lb.idx} onClose={() => setLb(null)} />}

      <ConfirmModal open={delAsk} title="글을 삭제하시겠습니까?" body="삭제한 글은 복구할 수 없습니다."
        onClose={() => setDelAsk(false)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => {
            setPosts(posts.filter(p => p.id !== post.id));
            // 글에 딸린 댓글도 함께 지운다 — 따로 저장되므로 남겨 두면 주인 없는 줄이 된다 (v2.0)
            setCmtRows(cmtRows.filter(c => !(c.target === 'post' && c.targetId === post.id)));
            router.push(boardHref(board.id));
          } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
        ]} />
    </section>
  );
}
