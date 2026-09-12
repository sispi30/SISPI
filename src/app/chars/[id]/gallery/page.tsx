'use client';
// 캐릭터 갤러리 (4.4 v2.5) — 상세 화면의 GALLERY 버튼(EDIT·DELETE와 같은 자리·모양)으로 들어오는
// 전용 화면. 참고 화면처럼 담벼락(masonry) 그리드로 늘어놓고, 클릭하면 라이트박스로 원본+작가 표기.
// 캐릭터 테마색(대표 테마색)을 상세 화면과 같은 방식으로 적용하고, 상세로 돌아가는 PROFILE
// 버튼을 GALLERY 버튼이 있던 자리에 그대로 둔다 (v2.6).
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Character, CHAR_SEED, findByKey } from '@/lib/charStore';
import { useLocalList } from '@/lib/postStore';
import { useBlobUrl } from '@/lib/blobStore';
import { useTheme } from '@/lib/ThemeProvider';
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
  const router = useRouter();
  const [chars, , loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [lb, setLb] = useState<number | null>(null);

  const ch = findByKey(chars, id);

  // 캐릭터 테마색 → 페이지 임시 테마 (상세 화면과 같은 방식, v1.9) — 여기도 AU 개념이 없어
  // (갤러리는 캐릭터 하나에만 있음) ch.themeMode만 본다
  const { setPageTheme } = useTheme();
  const pageColor = ch?.themeMode === 'custom' ? ch.color : null;
  useEffect(() => {
    setPageTheme(pageColor);
    return () => setPageTheme(null);
  }, [pageColor, setPageTheme]);

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
    </section>
  );
}
