'use client';
// 캐릭터 갤러리 (4.4 v2.5) — 상세 화면의 GALLERY 버튼(EDIT·DELETE와 같은 자리·모양)으로 들어오는
// 전용 화면. 참고 화면처럼 담벼락(masonry) 그리드로 늘어놓고, 클릭하면 라이트박스로 원본+작가 표기.
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Character, CHAR_SEED, findByKey } from '@/lib/charStore';
import { useLocalList } from '@/lib/postStore';
import { useBlobUrl } from '@/lib/blobStore';
import { PageTitle } from '@/components/ui/PageText';
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
  const [chars, , loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [lb, setLb] = useState<number | null>(null);

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
    </section>
  );
}
