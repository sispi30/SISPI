'use client';
// 감상 리스트 카드 — 그림이 카드 전체를 채우고, 오른쪽 아래에 큰 번호·제목·태그·작은 표기가 쌓이는 구성.
// 홈페이지 배경이 밝으면 아래 그라데이션이 밝아지고 글자는 어두워진다 (갤러리 카드와 같은 기준).
import React from 'react';
import { useBlobUrl } from '@/lib/blobStore';
import { CropImg } from '@/components/ui/CropEditor';
import type { CropValue } from '@/components/ui/CropEditor';
import { useBgLight } from '@/lib/useImgLight';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function RvCard({ no, fileRef, crop, ph, title, tags, label, sub, anim, style, onClick, ...rest }: {
  no: number; fileRef?: string; crop?: CropValue; ph?: string;
  title: string; tags: string[]; label: string; sub: string; anim?: number;
  style?: React.CSSProperties; onClick?: () => void;
} & Record<string, unknown>) {
  const url = useBlobUrl(fileRef);
  const light = useBgLight(true);
  return (
    <div className={`rv-card${light ? ' rv-lt' : ''}`} {...rest} onClick={onClick}
      role={onClick ? 'link' : undefined}
      style={{ ['--i' as string]: anim ?? no - 1, ...(style ?? {}) } as React.CSSProperties}>
      <div className="rv-art">
        {url ? <CropImg src={url} crop={crop} /> : <div className={`ph ${ph ?? ''}`} style={{ position: 'absolute', inset: 0 }} />}
        <div className="rv-shade" />
      </div>
      <div className="rv-txt">
        <span className="rv-no">{pad2(no)}</span>
        <h3>{title}</h3>
        <div className="rv-tags">{tags.map((t, i) => <span key={i}>#{t}</span>)}</div>
        <small className="rv-lb">{label}</small>
        <small className="rv-sub">{sub}</small>
        <div className="rv-ic" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="5" y="5" width="8" height="8" /><path d="M3 11V3h8" /></svg>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.8.8M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.500l.8-.8" /></svg>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M8 2v9M4.500 7.500 8 11l3.500-3.500M3 14h10" /></svg>
        </div>
      </div>
    </div>
  );
}
