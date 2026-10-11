'use client';
// 필기체 글씨 배치 미리보기 — 16:9 판 위에서 글씨를 끌어 옮기면 위치(x·y)가 정해진다.
// 큰 이름 글씨(뒤)와 필기체 글씨(앞)가 겹쳐 보이는 모습을 상세 화면과 같은 비율로 보여 준다.
import React, { useRef } from 'react';
import { ghostSizeVw } from '@/components/chars/StageDeco';
import type { DecoScript } from '@/lib/charStore';

interface Props {
  script: DecoScript;
  scriptText: string;
  scriptFont?: string;
  ghost: string;
  ghostFont?: string;
  accent: string;
  onMove: (x: number, y: number) => void;
}

export function ScriptPlacer({ script, scriptText, scriptFont, ghost, ghostFont, accent, onMove }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const place = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    onMove(
      Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
      Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
    );
  };
  return (
    <div ref={box} style={{ position: 'relative', width: '100%', maxWidth: 480, aspectRatio: '16/9', overflow: 'hidden', borderRadius: 8,
      background: '#f1f2ef', border: '1px solid var(--line)', containerType: 'inline-size', touchAction: 'none', userSelect: 'none',
      cursor: 'var(--cur-grab, grab)' }}
      onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); place(e); }}
      onPointerMove={e => { if (e.buttons) place(e); }}>
      {ghost && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '16%', textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1, overflow: 'hidden',
          fontWeight: 800, letterSpacing: '-.02em', color: 'rgba(0,0,0,.09)', fontFamily: ghostFont ?? 'var(--serif)', fontSize: `${ghostSizeVw(ghost)}cqw` }}>{ghost}</div>
      )}
      <div style={{ position: 'absolute', left: `${script.x}%`, top: `${script.y}%`, transform: `translate(-50%,-50%) rotate(${script.rot}deg)`,
        whiteSpace: 'nowrap', lineHeight: 1.1, color: script.color || accent, fontFamily: scriptFont ?? 'cursive',
        fontSize: `${script.size * 0.5625}cqw` }}>{scriptText || '필기체 글씨'}</div>
      <span style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, opacity: .55 }}>끌어서 위치 정하기</span>
    </div>
  );
}
