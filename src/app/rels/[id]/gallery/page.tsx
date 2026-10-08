'use client';
// 자관 갤러리 (v6.0) — 상세 하단 좌측 칸을 갤러리로 바꿨을 때 「더보기」로 오는 페이지.
// 홈페이지 갤러리 게시판처럼 묶음 카드를 보고(단일=전체화면 뷰어, 로그/세로=상세), 관리자는 여기서 바로 편집한다.
// 자관 상세의 배경(테마색·그라데이션·배경 이미지)과 BGM을 그대로 가져온다.
// 편집 방식은 캐릭터 갤러리와 같다(GalleryEditView) — 다만 변경 즉시 저장된다(별도 SAVE 없음).
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Relation, REL_SEED, Character, CHAR_SEED, GalleryPost, galleryPostsOf, findByKey, memberGalleryTags, relGalleryPosts } from '@/lib/charStore';
import { usePageBgm } from '@/lib/bgmStore';
import { useRelPageStyle } from '@/components/rels/useRelPageStyle';
import { GalleryPanel } from '@/components/gallery/GalleryPostsView';
import { GalleryEditView } from '@/components/gallery/GalleryPostsEditor';
import { PageTitle } from '@/components/ui/PageText';

export default function RelGalleryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const [rels, setRels, loaded] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [editing, setEditing] = useState(false);

  const rel = findByKey(rels, id);
  const allowed = !!rel && !(rel.visibility === 'private' && !isAdmin) && !(rel.visibility === 'member' && !user);
  // 자관 상세와 같은 BGM을 이어서 — 상세에서 이 페이지로 와도 음악이 끊기지 않는다
  usePageBgm(allowed ? `rel:${rel!.id}` : undefined, allowed ? rel!.bgm : undefined);

  // 자관 상세와 같은 테마색·페이지 배경·배경 이미지(블러) — 설정을 그대로 따라간다
  useRelPageStyle(rel, allowed);

  if (!loaded) return <section className="page" />;
  if (!rel || !allowed) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>GALLERY</PageTitle><p>자관을 찾을 수 없거나 열람 권한이 없습니다</p></div>
      </section>
    );
  }

  const posts = galleryPostsOf(rel);                       // 이 자관에 직접 올린 묶음 (편집 대상)
  const shownPosts = relGalleryPosts(rel, chars, { isAdmin, loggedIn: !!user });   // + 태그 연동으로 가져온 캐릭터 묶음
  const linkedCount = shownPosts.filter(p => p.from).length;
  const save = (next: GalleryPost[]) =>
    setRels(rels.map(r => (r.id === rel.id ? { ...r, galleryPosts: next } : r)));
  // 캐릭터 갤러리 연동 태그 (v6.2) — 이 자관 멤버 캐릭터의 갤러리 묶음에 달린 태그 중 자관에서도 보일 것
  const tagOptions = memberGalleryTags(rel, chars);
  const links = rel.galleryTagLinks ?? [];
  const toggleTag = (t: string) => {
    const next = links.includes(t) ? links.filter(x => x !== t) : [...links, t];
    setRels(rels.map(r => (r.id === rel.id ? { ...r, galleryTagLinks: next.length ? next : undefined } : r)));
  };
  const back = `/rels/${rel.slug ?? rel.id}`;

  return (
    <section className="page">
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageTitle>{rel.name} — GALLERY</PageTitle>
        </div>
        <button className="btn btn-ghost" onClick={() => router.push(back)}>‹ 자관으로</button>
        {isAdmin && !editing && <button className="btn btn-dark" onClick={() => setEditing(true)}>EDIT</button>}
      </div>

      {editing && isAdmin ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* 캐릭터 갤러리 연동 — 같은 사진을 자관에 또 올리지 않아도 되도록, 멤버 캐릭터 갤러리의 태그를 골라 가져온다 */}
          <div className="panel" style={{ padding: 24, display: 'grid', gap: 10 }}>
            <label className="k-label" style={{ margin: 0 }}>
              캐릭터 갤러리 연동 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 이 자관 멤버 캐릭터의 갤러리에서 보일 태그를 고르세요 (바로 적용)</span>
            </label>
            {tagOptions.length > 0 || links.length > 0 ? (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {tagOptions.map(o => (
                  <button key={o.tag} type="button" className={`btn ${links.includes(o.tag) ? 'btn-dark' : 'btn-ghost'}`}
                    style={{ padding: '5px 12px', fontSize: 11.5 }} title={o.names.join(', ')} onClick={() => toggleTag(o.tag)}>
                    {links.includes(o.tag) ? '✓ ' : ''}#{o.tag} <small style={{ opacity: .7 }}>{o.count}</small>
                  </button>
                ))}
                {/* 지금은 어느 멤버 갤러리에도 없는 태그(삭제·변경됨) — 선택만 남아 있으니 해제할 수 있게 */}
                {links.filter(t => !tagOptions.some(o => o.tag === t)).map(t => (
                  <button key={t} type="button" className="btn btn-dark" style={{ padding: '5px 12px', fontSize: 11.5, opacity: .6 }}
                    title="멤버 캐릭터 갤러리에 이 태그가 없습니다" onClick={() => toggleTag(t)}>✓ #{t} ✕</button>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                멤버 캐릭터의 갤러리에 태그가 달린 사진 묶음이 아직 없습니다 — 캐릭터 편집 → 갤러리 편집에서 묶음에 태그를 달면 여기에 나타납니다
              </p>
            )}
            {linkedCount > 0 && <p className="hint" style={{ margin: 0 }}>연동된 묶음 {linkedCount}개가 갤러리에 함께 보입니다 — 수정은 캐릭터 갤러리에서 합니다</p>}
          </div>
          <GalleryEditView posts={posts} onChange={save} backLabel="‹ 갤러리로" onBack={() => setEditing(false)} />
        </div>
      ) : (
        <div className="panel" style={{ padding: 24 }}>
          <GalleryPanel posts={shownPosts} ph={rel.thumbClass} loggedIn={!!user} canSeePrivate={isAdmin} />
        </div>
      )}
    </section>
  );
}
