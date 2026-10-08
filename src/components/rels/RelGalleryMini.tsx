'use client';
// 자관 상세 하단 좌측 칸의 갤러리 — 작은 썸네일만 보여주고, 누르거나 더보기를 누르면 갤러리 페이지(/rels/{id}/gallery)로 간다 (v6.0)
import React from 'react';
import { GalleryPost } from '@/lib/charStore';
import { CroppedBlobImg } from '@/components/ui/CropEditor';

const MAX = 6;

export function RelGalleryMini({ posts, ph, onOpen }: { posts: GalleryPost[]; ph: string; onOpen: () => void }) {
  if (posts.length === 0) {
    return <p className="hint" style={{ margin: 0 }}>이 자관의 갤러리가 여기에 표시됩니다 — 더보기에서 추가할 수 있습니다</p>;
  }
  const shown = posts.slice(0, MAX);
  const rest = posts.length - shown.length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {shown.map((p, i) => {
        const cover = p.images[0];
        const folded = !!p.fold;   // 접힌 묶음은 썸네일을 가리고, 갤러리 페이지에서 펼친다
        return (
          <div key={p.id} title={p.title} onClick={onOpen}
            style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', cursor: 'var(--cur-pointer,pointer)', background: 'rgba(127,127,127,.14)' }}>
            {cover && !folded && (
              <div style={{ position: 'absolute', inset: 0 }}>
                <CroppedBlobImg fileRef={cover.ref} crop={cover.crop} ph={ph} />
              </div>
            )}
            {folded && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 10.5, color: 'var(--faint)', textAlign: 'center', padding: 4 }}>
                {p.fold?.type === 'custom' ? (p.fold.label || '접힘') : p.fold?.type === 'adult' ? '수위 주의' : '스포일러'}
              </div>
            )}
            {p.images.length > 1 && !folded && (
              <span style={{ position: 'absolute', right: 5, bottom: 5, padding: '1px 6px', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 10 }}>{p.images.length}</span>
            )}
            {i === MAX - 1 && rest > 0 && (
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 13, fontWeight: 700 }}>+{rest}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
