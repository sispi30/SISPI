'use client';
// 배경 글씨 배치 미리보기 — 16:9 판 위에서 큰 이름 글씨(뒤)와 필기체 글씨(앞)를 끌어 옮겨 위치를 정한다.
// 위쪽 버튼으로 어느 쪽을 끌지 고른다. 상세 화면과 같은 비율·같은 식으로 그려 겹침을 그대로 보여 준다.
import React, { useRef, useState } from 'react';
import { ghostSizeVw } from '@/components/chars/StageDeco';
import type { DecoScript, DecoGhost } from '@/lib/charStore';

interface Props {
  script: DecoScript | null;
  scriptText: string;
  scriptFont?: string;
  ghost: string;
  ghostPos: DecoGhost;
  ghostFont?: string;
  accent: string;
  onMoveScript: (x: number, y: number) => void;
  onMoveGhost: (x: number, y: number) => void;
}

export function ScriptPlacer({ script, scriptText, scriptFont, ghost, ghostPos, ghostFont, accent, onMoveScript, onMoveGhost }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<'ghost' | 'script'>(ghost ? 'ghost' : 'script');
  const target: 'ghost' | 'script' = !script ? 'ghost' : !ghost ? 'script' : pick;
  const place = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    if (target === 'ghost') onMoveGhost(x, y); else onMoveScript(x, y);
  };
  const tab = (id: 'ghost' | 'script', label: string) => (
    <button type="button" className={'btn ' + (target === id ? 'btn-primary' : 'btn-ghost')} style={{ padding: '4px 10px', fontSize: 11 }}
      onClick={() => setPick(id)}>{label}</button>
  );
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {ghost && script && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="cp-lb">끌어 옮길 글씨</span>{tab('ghost', '큰 이름 글씨')}{tab('script', '필기체')}
        </div>
      )}
      <div ref={box} style={{ position: 'relative', width: '100%', maxWidth: 480, aspectRatio: '16/9', overflow: 'hidden', borderRadius: 8,
        background: '#f1f2ef', border: '1px solid var(--line)', containerType: 'inline-size', touchAction: 'none', userSelect: 'none',
        cursor: 'var(--cur-grab, grab)' }}
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); place(e); }}
        onPointerMove={e => { if (e.buttons) place(e); }}>
        {ghost && (
          <div style={{ position: 'absolute', left: `${ghostPos.x}%`, top: `${ghostPos.y}%`, transform: 'translate(-50%,-50%)', width: 'max-content',
            textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.35, padding: '.05em .1em', fontWeight: 800, letterSpacing: '-.02em',
            color: target === 'ghost' ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.09)', fontFamily: ghostFont ?? 'var(--serif)',
            fontSize: `${ghostSizeVw(ghost) * ghostPos.scale / 100}cqw` }}>{ghost}</div>
        )}
        {script && (
          <div style={{ position: 'absolute', left: `${script.x}%`, top: `${script.y}%`, transform: `translate(-50%,-50%) rotate(${script.rot}deg)`,
            whiteSpace: 'nowrap', lineHeight: 1.1, color: script.color || accent, fontFamily: scriptFont ?? 'cursive',
            fontSize: `${script.size * 0.5625}cqw` }}>{scriptText || '필기체 글씨'}</div>
        )}
        <span style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, opacity: .55 }}>끌어서 위치 정하기</span>
      </div>
    </div>
  );
}
