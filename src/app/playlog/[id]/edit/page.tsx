'use client';
// 플레이기록 수정 (4.16) — 페이지형 편집
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, Post, BOARD_SEED } from '@/lib/postStore';
import { useSectionTitle } from '@/lib/sectionStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { PlaylogForm } from '@/components/trpg/PlaylogForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

export default function PlaylogEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [records, setRecords, loaded] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  // 세션 게시판 글과 연동된 기록이면 그 글에도 되돌려 반영해야 한다(v3.3) — 지금까지는
  // 글쓰기 화면 → 플레이 기록 방향으로만 동기화됐고, 여기서 고친 내용은 글에 안 갔음
  const [posts, setPosts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  // 큰 글씨 — 추가 섹션 항목이면 그 이름, 눌렀을 때도 그 목록으로 (v2.0 사용자 제보)
  const tt = useSectionTitle('playlog', records.find(x => x.id === id)?.secId, 'EDIT RECORD');
  const r = records.find(x => x.id === id);

  if (!loaded) return <section className="page" />;
  if (!isAdmin || !r) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>기록을 찾을 수 없거나 권한이 없습니다</p></div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>{r.scenario}</p></div>
      <PlaylogForm initial={r} records={records}
        onCancel={() => router.push('/playlog')}
        onSave={v => {
          const updated: PlayRecord = { ...r, ...v, date: v.date, url: v.url, logId: v.logId, scenarioLink: v.scenarioLink };
          setRecords(records.map(x => (x.id === r.id ? updated : x)));
          // 연동된 세션 게시판 글이 있으면(postId) 제목·Date·Playtime·Role·With·Scenario Link·Url을
          // 그 글에도 되돌려 반영한다 — 글의 session 요약은 별도로 저장돼 있어 그동안 여기서
          // 고쳐도 글쪽엔 안 보였음 (v3.3 사용자 제보)
          if (updated.postId) {
            setPosts(posts.map(p => (p.id === updated.postId ? {
              ...p,
              title: updated.scenario.trim() || p.title,
              session: p.session ? {
                ...p.session,
                date: updated.date, scenarioLink: updated.scenarioLink,
                withText: updated.withText, role: updated.role,
                playtime: updated.playtime, url: updated.url,
              } : p.session,
            } : p)));
          }
          toast('저장되었습니다');
          router.push('/playlog');
        }} />
    </section>
  );
}
