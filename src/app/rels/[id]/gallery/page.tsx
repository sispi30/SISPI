'use client';
// 자관 갤러리 (v6.0) — 상세 하단 좌측 칸을 갤러리로 바꿨을 때 「더보기」로 오는 페이지.
// 홈페이지 갤러리 게시판처럼 묶음 카드를 보고(단일=전체화면 뷰어, 로그/세로=상세), 관리자는 여기서 바로 편집한다.
// 자관 상세의 배경(테마색·그라데이션·배경 이미지)과 BGM을 그대로 가져온다.
// 편집 방식은 캐릭터 갤러리와 같다(GalleryEditView) — 다만 변경 즉시 저장된다(별도 SAVE 없음).
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Relation, REL_SEED, GalleryPost, galleryPostsOf, findByKey } from '@/lib/charStore';
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

  const posts = galleryPostsOf(rel);
  const save = (next: GalleryPost[]) =>
    setRels(rels.map(r => (r.id === rel.id ? { ...r, galleryPosts: next } : r)));
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
        <GalleryEditView posts={posts} onChange={save} backLabel="‹ 갤러리로" onBack={() => setEditing(false)} />
      ) : (
        <div className="panel" style={{ padding: 24 }}>
          <GalleryPanel posts={posts} ph={rel.thumbClass} loggedIn={!!user} canSeePrivate={isAdmin} />
        </div>
      )}
    </section>
  );
}
