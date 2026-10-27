'use client';
// 페어 썸네일 — 크롭한 썸네일을 그대로 보여 주고, 그 위에 테마색 대각선 한 줄을 긋는다.
// 페어 목록 · 캐릭터 상세 서랍(Relations·Gallery)이 같이 쓴다. 부모는 position:relative(또는 absolute) + overflow:hidden.
import React from 'react';
import { useBlobUrl } from '@/lib/blobStore';
import { CropImg, PH_LATE } from '@/components/ui/CropEditor';
import type { CropValue } from '@/components/ui/CropEditor';
import type { Relation } from '@/lib/charStore';

/** 이 자관의 테마색 — 자관 수정에서 따로 정한 색이 있으면 그 색, 아니면 사이트 포인트색 */
export function relThemeColor(r: Pick<Relation, 'themeMode' | 'themeColor'>, fallback?: string): string {
  return r.themeMode === 'custom' && r.themeColor ? r.themeColor : (fallback ?? 'var(--accent,#7fd6d0)');
}

export function PairThumb({ fileRef, crop, ph, label, tc, delay = 0 }: {
  fileRef?: string; crop?: CropValue; ph?: string; label?: string; tc: string; delay?: number;
}) {
  const url = useBlobUrl(fileRef);
  if (!url) return <div className={`ph ${ph ?? ''}`} style={{ position: 'absolute', inset: 0, ...(fileRef ? PH_LATE : null) }}>{label && <span>{label}</span>}</div>;
  return (
    <div className="pt" style={{ '--tc': tc, '--pd': `${delay}s` } as React.CSSProperties}>
      <div className="pt-base"><CropImg src={url} crop={crop} /></div>
      <svg className="pt-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="58" y1="0" x2="38" y2="100" stroke={tc} strokeWidth="1.4" vectorEffect="non-scaling-stroke" pathLength={1} />
      </svg>
    </div>
  );
}
