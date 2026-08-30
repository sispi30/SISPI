'use client';
// 배너 게시판 (5.7) — 그누보드 배너 게시판 스킨(write.skin.php / write_update.skin.php / view.skin.php)을
// 이 저장소 방식으로 옮긴 것. 개별 보기 페이지가 없고(목록으로 리다이렉트), 배너 종류는 말머리(category)로,
// 배너 이미지는 thumbSrc를, 클릭 URL은 bannerLink를 재사용한다 — 새 필드는 bannerLink 하나뿐이다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, BOARD_SEED, Post, newId } from '@/lib/postStore';
import { Board, boardHref } from '@/lib/boardStore';
import { renderBody } from '@/lib/sanitize';
import { putBlob, BlobImg } from '@/lib/blobStore';
import { KInput } from '@/components/ui/Kit';
import { RichEditor } from '@/components/ui/RichEditor';
import { useToast } from '@/components/ui/Toast';
import { useConfirmDelete } from '@/components/ui/Modal';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

/** 원본 write.skin.php의 BSKIN_HEADER/BSKIN_NOTICE/BSKIN_ALLIANCE 상수에 대응 — 이웃 배너는 빈 문자열 대신
 *  게시판 말머리 목록의 첫 항목을 그대로 쓴다 (환경설정에서 이름을 바꿔도 따라가도록) */
const NEIGHBOR_LABEL = '이웃 배너';
const NOTICE_LABEL = '공지 배너';
const ALLIANCE_LABEL = '동맹 배너';
const HEADER_LABEL = '헤더 이미지';
const NOTICE_MAX = 3; // 공지 배너는 최대 3개 (원본 select 안내 문구와 동일)

/* ================= 글쓰기 폼 ================= */

export function BannerWriteForm({ board, editPid }: { board: Board; editPid?: string }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [posts, setPosts, postsLoaded] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const editing = editPid ? posts.find(p => p.id === editPid) : undefined;

  const [type, setType] = useState(NEIGHBOR_LABEL);
  const isHeader = type === HEADER_LABEL;
  const [siteName, setSiteName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [headerHtml, setHeaderHtml] = useState('');
  // 이미지 — 파일 업로드 또는 URL 중 하나 (원본과 동일, 둘 다 있으면 파일 우선)
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const [existingImg, setExistingImg] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const filePreview = imgFile ? URL.createObjectURL(imgFile) : undefined;

  const hydrated = useRef(false);
  useEffect(() => {
    if (!editPid || !postsLoaded || hydrated.current) return;
    const p = posts.find(x => x.id === editPid);
    if (!p) return;
    hydrated.current = true;
    setType(p.category || NEIGHBOR_LABEL);
    setSiteName(p.title === '-' ? '' : p.title);
    setLinkUrl(p.bannerLink ?? '');
    setHeaderHtml(p.mode === 'html' ? p.body : '');
    setExistingImg(p.thumbSrc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPid, postsLoaded, posts]);

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

  const noticeCount = posts.filter(p =>
    (p.boardId ?? '') === board.id && p.category === NOTICE_LABEL && p.id !== editing?.id).length;

  const save = async () => {
    // 관리자가 아니면 이웃 배너로 고정 (원본 — 헤더/공지/동맹 select는 관리자 전용)
    const finalType = isAdmin ? type : NEIGHBOR_LABEL;
    const finalIsHeader = finalType === HEADER_LABEL;

    if (!finalIsHeader && !siteName.trim()) { toast('사이트명을 입력해 주세요.'); return; }
    if (!finalIsHeader && !linkUrl.trim()) { toast('클릭 URL을 입력해 주세요.'); return; }
    if (finalType === NOTICE_LABEL && noticeCount >= NOTICE_MAX) {
      toast(`공지 배너는 최대 ${NOTICE_MAX}개까지만 등록할 수 있습니다.`); return;
    }
    const hasNewImg = !!imgFile || !!imgUrl.trim();
    if (!editing && !hasNewImg) { toast('이미지를 첨부하거나 이미지 URL을 입력해 주세요.'); return; }

    const thumbSrc = imgFile ? await putBlob(imgFile) : (imgUrl.trim() || existingImg);

    if (editing) {
      setPosts(posts.map(p => (p.id === editing.id ? {
        ...p,
        title: finalIsHeader ? '-' : siteName.trim(),
        body: finalIsHeader ? (headerHtml || '-') : '-',
        mode: 'html',
        category: finalType,
        thumbSrc,
        bannerLink: finalIsHeader ? undefined : linkUrl.trim(),
      } : p)));
      toast('수정되었습니다');
      router.push(boardHref(board.id));
      return;
    }
    const p: Post = {
      id: newId(),
      title: finalIsHeader ? '-' : siteName.trim(),
      body: finalIsHeader ? (headerHtml || '-') : '-',
      mode: 'html',
      category: finalType,
      author: user.nickname, authorId: user.id, date: new Date().toISOString(),
      secret: false, notice: false, fold: null, comments: [],
      boardId: board.id,
      thumbSrc,
      bannerLink: finalIsHeader ? undefined : linkUrl.trim(),
    };
    setPosts([p, ...posts]);
    toast('등록되었습니다');
    router.push(boardHref(board.id));
  };

  const previewSrc = filePreview || imgUrl.trim() || undefined;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={boardHref(board.id)}>{editing ? 'EDIT' : 'WRITE'}</PageTitle>
        <EditableDesc k="board-write-desc-banner" def="배너 이미지와 클릭 URL을 등록합니다 · 헤더 이미지 종류는 관리자만 선택할 수 있습니다" />
      </div>
      <div className="panel" style={{ padding: 24, maxWidth: 560, margin: '0 auto', display: 'grid', gap: 16 }}>
        {isAdmin ? (
          <div>
            <label className="k-label" style={{ marginBottom: 6 }}>배너 종류 <small style={{ fontWeight: 400 }}>헤더/공지/동맹은 관리자 전용입니다</small></label>
            <div className="mini-seg">
              {[NEIGHBOR_LABEL, NOTICE_LABEL, ALLIANCE_LABEL, HEADER_LABEL].map(t => (
                <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>
                  {t}{t === NOTICE_LABEL && ` (${noticeCount}/${NOTICE_MAX})`}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="hint" style={{ margin: 0 }}>이웃 배너로 등록됩니다 — 승인 후 노출됩니다</p>
        )}

        {!isHeader && (
          <div>
            <label className="k-label" style={{ marginBottom: 6 }}>사이트명</label>
            <KInput value={siteName} onChange={e => setSiteName(e.target.value)}
              placeholder="마우스 오버 시 툴팁으로 표시됩니다" style={{ width: '100%' }} />
          </div>
        )}

        <div>
          <label className="k-label" style={{ marginBottom: 6 }}>
            {isHeader ? '헤더 이미지' : '배너 이미지'} <small style={{ fontWeight: 400 }}>파일 업로드 또는 URL 중 하나</small>
          </label>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 140, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden',
                border: '1.5px dashed var(--line)', cursor: 'var(--cur-pointer,pointer)',
                position: 'relative', flexShrink: 0, background: 'var(--panel-2, #f4f5f7)',
              }}>
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : existingImg ? (
                <BlobImg fileRef={existingImg} />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', fontSize: 11, color: 'var(--faint)' }}>클릭하여 업로드</div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setImgFile(f); setImgUrl(''); } e.target.value = ''; }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="k-label" style={{ marginBottom: 6 }}>또는 이미지 URL</label>
              <KInput value={imgUrl} onChange={e => { setImgUrl(e.target.value); if (e.target.value) setImgFile(null); }}
                placeholder="https://example.com/image.png" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {isAdmin && isHeader && (
          <div>
            <label className="k-label" style={{ marginBottom: 6 }}>헤더 문구 <small style={{ fontWeight: 400 }}>이미지 아래 표시됩니다 (선택)</small></label>
            <RichEditor value={headerHtml} onChange={setHeaderHtml} placeholder="헤더 문구를 입력하세요 (선택)" />
          </div>
        )}

        {!isHeader && (
          <div>
            <label className="k-label" style={{ marginBottom: 6 }}>클릭 URL</label>
            <KInput value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://example.com" style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-onbk" onClick={() => router.push(boardHref(board.id))}>CANCEL</button>
          <button className="btn btn-accent" onClick={save}>{editing ? 'SAVE' : 'POST'}</button>
        </div>
      </div>
    </section>
  );
}

/* ================= 목록(전용 페이지) 뷰 ================= */

function BannerCard({ post, onClick, canManage, onEdit, onDelete }: {
  post: Post; onClick?: () => void; canManage: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="bbanner-card" title={post.title !== '-' ? post.title : undefined} onClick={onClick}>
      <div className="bbanner-img"><BlobImg fileRef={post.thumbSrc} /></div>
      {canManage && (
        <div className="bbanner-manage" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}>수정</button>
          <button onClick={onDelete}>삭제</button>
        </div>
      )}
    </div>
  );
}

export function BannerBoardView({ board, posts, setPosts, isAdmin, user }: {
  board: Board; posts: Post[]; setPosts: (next: Post[]) => void;
  isAdmin: boolean; user: { id: string } | null;
}) {
  const router = useRouter();
  const del = useConfirmDelete();
  const of = (label: string) => posts.filter(p => p.category === label)
    .sort((a, b) => b.date.localeCompare(a.date));
  const header = of(HEADER_LABEL)[0];
  const notice = of(NOTICE_LABEL);
  const alliance = of(ALLIANCE_LABEL);
  const neighbor = of(NEIGHBOR_LABEL);
  const headerHtml = useMemo(() => (header ? renderBody('html', header.body) : ''), [header]);

  const canManage = (p: Post) => isAdmin || (!!p.authorId && p.authorId === user?.id);
  const goEdit = (p: Post) => router.push(`/board/write?b=${board.id}&edit=${p.id}`);
  const goDelete = (p: Post) => del.ask('배너를 삭제하시겠습니까?', () => setPosts(posts.filter(x => x.id !== p.id)));
  const openLink = (p: Post) => { if (p.bannerLink) window.open(p.bannerLink, '_blank', 'noopener,noreferrer'); };

  const row = (label: string, list: Post[]) => (list.length === 0 ? null : (
    <div className="bbanner-sec">
      <h4>{label}</h4>
      <div className="bbanner-row">
        {list.map(p => (
          <BannerCard key={p.id} post={p} onClick={() => openLink(p)}
            canManage={canManage(p)} onEdit={() => goEdit(p)} onDelete={() => goDelete(p)} />
        ))}
      </div>
    </div>
  ));

  const empty = !header && notice.length === 0 && alliance.length === 0 && neighbor.length === 0;

  return (
    <>
      {header && (
        <div className="bbanner-header">
          <div className="bbanner-header-img"><BlobImg fileRef={header.thumbSrc} /></div>
          {canManage(header) && (
            <div className="bbanner-manage" style={{ position: 'absolute', top: 10, right: 10 }}>
              <button onClick={() => goEdit(header)}>수정</button>
              <button onClick={() => goDelete(header)}>삭제</button>
            </div>
          )}
          {headerHtml && headerHtml !== '-' && (
            <div className="bbanner-header-text post-body" dangerouslySetInnerHTML={{ __html: headerHtml }} />
          )}
        </div>
      )}
      {row(NOTICE_LABEL, notice)}
      {row(ALLIANCE_LABEL, alliance)}
      {row(NEIGHBOR_LABEL, neighbor)}
      {empty && (
        <div className="panel" style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>등록된 배너가 없습니다</div>
      )}
      {del.element}
    </>
  );
}
