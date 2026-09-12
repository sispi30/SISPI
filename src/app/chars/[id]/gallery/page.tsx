'use client';
// 캐릭터 갤러리 (4.4 v2.5) — 상세 화면의 GALLERY 버튼(EDIT·DELETE와 같은 자리·모양)으로 들어오는
// 전용 화면. 참고 화면처럼 담벼락(masonry) 그리드로 늘어놓고, 클릭하면 라이트박스로 원본+작가 표기.
// 캐릭터 테마색은 공용 레이아웃(chars/[id]/layout.tsx)이 이 화면에서도 계속 적용해 준다
// (상세 ↔ 갤러리 이동 때 배경이 깜빡이던 문제를 거기서 고쳤음, v2.7). PROFILE 버튼을
// GALLERY 버튼이 있던 자리에 그대로 둔다.
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Character, CHAR_SEED, charGrant, findByKey } from '@/lib/charStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { useLocalList } from '@/lib/postStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useSectionTitle } from '@/lib/sectionStore';
import { PageTitle } from '@/components/ui/PageText';
import { ConfirmModal } from '@/components/ui/Modal';
import { Lightbox } from '@/components/ui/Lightbox';

function GalleryThumb({ fileRef, onClick }: { fileRef: string; onClick: () => void }) {
  const url = useBlobUrl(fileRef);
  if (!url) return null;
  return (
    <div className="char-gallery-card" onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" />
    </div>
  );
}

export default function CharGalleryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [chars, setChars, loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [playRecords] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  const [lb, setLb] = useState<number | null>(null);
  const [delAsk, setDelAsk] = useState(false);
  const tt = useSectionTitle('chars', findByKey(chars, id)?.secId, 'CHARACTERS');

  const ch = findByKey(chars, id);

  if (!loaded) return <section className="page" />;
  if (!ch || ch.gallery === undefined) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={`/chars/${id}`}>Gallery</PageTitle><p>갤러리를 찾을 수 없습니다</p></div>
      </section>
    );
  }

  const images = ch.gallery;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={`/chars/${ch.id}`}>Gallery</PageTitle>
        <div className="head-actions">
          {/* GALLERY 버튼이 있던 자리 — 프로필로 돌아가는 길을 눈에 띄게 (v2.6 사용자 지적:
              제목 글씨를 눌러도 되지만 한눈에 알아보기 어려움) */}
          <button className="btn btn-dark" onClick={() => router.push(`/chars/${ch.id}`)}>PROFILE</button>
          {/* 상세 화면과 같은 EDIT·DELETE·TRPG 버튼도 여기서 바로 쓸 수 있게 (v2.9 사용자 요청) */}
          {(isAdmin || charGrant(ch, user?.id) === 'edit') && (
            <button className="btn btn-dark" onClick={() => router.push(`/chars/${ch.id}/edit`)}>EDIT</button>
          )}
          {ch.trpgEnabled || playRecords.some(r => r.charIds?.includes(ch.id)) ? (
            <button className="btn btn-dark" onClick={() => router.push(`/chars/${ch.id}?tab=trpg`)}>TRPG</button>
          ) : null}
          {isAdmin && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
        </div>
      </div>
      {images.length === 0 ? (
        <p className="hint">아직 등록된 사진이 없습니다</p>
      ) : (
        <div className="char-gallery-grid">
          {images.map((g, i) => (
            <GalleryThumb key={g.ref + i} fileRef={g.ref} onClick={() => setLb(i)} />
          ))}
        </div>
      )}
      {lb != null && (
        <Lightbox srcs={images.map(g => g.ref)} index={lb} onClose={() => setLb(null)}
          captions={images.map(g => g.artist)} />
      )}
      <ConfirmModal open={delAsk} title="캐릭터를 삭제하시겠습니까?"
        body="프로필·탭 정보가 함께 삭제되며 복구할 수 없습니다. 이 캐릭터가 들어간 자관에서는 멤버 표시가 사라집니다."
        onClose={() => setDelAsk(false)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setChars(chars.filter(c => c.id !== ch.id)); router.push(tt.href); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
        ]} />
    </section>
  );
}
