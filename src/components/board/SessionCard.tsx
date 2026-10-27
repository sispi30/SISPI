'use client';
// 세션 게시판(타래형) 카드 — 그림이 카드 전체를 채우고, 가운데에 큰 번호 · 제목이 놓이는 구성.
// 아래에서 올라오는 그라데이션과 밝은/어두운 배경 대응은 감상 게시판 카드(RvCard)와 같은 클래스를 쓴다.
import React from 'react';
import { CropImg, PH_LATE } from '@/components/ui/CropEditor';
import type { CropValue } from '@/components/ui/CropEditor';
import { useBgLight } from '@/lib/useImgLight';
import { usePlayedBefore } from '@/lib/playOnce';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function SessionCard({ no, thumbSrc, crop, spoiler, title, locked, cmt, status, anim, onClick, onLink, ...rest }: {
  no: number;
  /** 이미 풀린 그림 주소(본문 첫 이미지 등) */
  thumbSrc?: string | null; crop?: CropValue;
  spoiler?: boolean; title: string;
  /** 비밀글 — 왼쪽 위에 자물쇠 */
  locked?: boolean;
  cmt?: number;
  /** 오른쪽 위 상태 배지 */
  status?: React.ReactNode;
  anim?: number;
  onClick?: () => void; onLink?: () => void;
} & Record<string, unknown>) {
  const light = useBgLight(true);
  const still = usePlayedBefore();
  return (
    <div className={`rv-card rv-sess${light ? ' rv-lt' : ''}${still ? ' rv-still' : ''}`} {...rest} onClick={onClick}
      role={onClick ? 'link' : undefined}
      style={{ ['--i' as string]: anim ?? no - 1 } as React.CSSProperties}>
      <div className={`rv-art${spoiler ? ' spoiler' : ''}`}>
        {thumbSrc ? <CropImg src={thumbSrc} crop={crop} /> : <div className="ph" style={{ position: 'absolute', inset: 0, ...PH_LATE }} />}
        <div className="rv-shade" />
      </div>
      {locked && (
        <span className="rv-lock" aria-label="비밀글">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.4" /><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" /></svg>
        </span>
      )}
      {status && <span className="rv-st">{status}</span>}
      <div className="rv-txt">
        <span className="rv-no">{pad2(no)}</span>
        <h3>{title}{!!cmt && cmt > 0 && <span className="rv-cmt">{cmt}</span>}</h3>
        <div className="rv-ic">
          <button type="button" title="링크 복사" aria-label="링크 복사" onClick={e => { e.stopPropagation(); onLink?.(); }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.8.8M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.8-.8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
