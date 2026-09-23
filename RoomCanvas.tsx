'use client';
// 마이룸 캔버스 (v1) — 드래그 이동 · 우하단 리사이즈 · 상단 회전 핸들 · 클릭 선택.
// 그누보드판(myroom-editor.js)의 조작 방식을 옮기되, 포인터 이벤트 하나로 마우스/터치를 함께
// 처리해서 단순화했다. 줌은 슬라이더 하나로, 멀티셀렉트·잠금·좌우반전·사운드클릭 등은 v1 밖.
import React, { useEffect, useRef, useState } from 'react';
import { BlobImg } from '@/lib/blobStore';
import type { MyRoomItem } from '@/lib/myroomStore';

type DragKind = 'move' | 'resize' | 'rotate';

export function RoomCanvas({
  canvasW, canvasH, items, editable, selectedId, onSelect, onChange,
}: {
  canvasW: number;
  canvasH: number;
  items: MyRoomItem[];
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<MyRoomItem>) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);       // 0.3 ~ 2
  const dragRef = useRef<{
    kind: DragKind; id: string; startX: number; startY: number;
    it: MyRoomItem; cx: number; cy: number;
  } | null>(null);

  // 처음 열었을 때 컨테이너 폭에 맞춰 자동으로 한 번 축소 (그 다음은 사용자가 슬라이더로 조절)
  useEffect(() => {
    const w = outerRef.current?.clientWidth;
    if (w && w < canvasW) setZoom(Math.max(0.3, Math.round((w / canvasW) * 100) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW]);

  useEffect(() => {
    if (!editable) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      if (d.kind === 'move') {
        onChange(d.id, { x: Math.round(d.it.x + dx), y: Math.round(d.it.y + dy) });
      } else if (d.kind === 'resize') {
        onChange(d.id, {
          w: Math.max(20, Math.round(d.it.w + dx)),
          h: Math.max(20, Math.round(d.it.h + dy)),
        });
      } else if (d.kind === 'rotate') {
        const ang = Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * (180 / Math.PI) + 90;
        onChange(d.id, { rot: Math.round(ang) });
      }
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [editable, zoom, onChange]);

  const startDrag = (e: React.PointerEvent, kind: DragKind, it: MyRoomItem) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(it.id);
    const rect = (e.currentTarget.closest('.mr-item') as HTMLElement)?.getBoundingClientRect();
    dragRef.current = {
      kind, id: it.id, startX: e.clientX, startY: e.clientY, it,
      cx: rect ? rect.left + rect.width / 2 : e.clientX,
      cy: rect ? rect.top + rect.height / 2 : e.clientY,
    };
  };

  const sorted = [...items].sort((a, b) => a.z - b.z);

  return (
    <div className="mr-canvas-outer" ref={outerRef}>
      <div
        className="mr-canvas"
        style={{ width: canvasW, height: canvasH, transform: `scale(${zoom})` }}
        onPointerDown={() => onSelect(null)}
      >
        {sorted.map(it => {
          const sel = editable && selectedId === it.id;
          return (
            <div
              key={it.id}
              className={`mr-item${sel ? ' sel' : ''}`}
              style={{
                left: it.x, top: it.y, width: it.w, height: it.h,
                transform: `rotate(${it.rot || 0}deg)`, zIndex: it.z,
                cursor: editable ? 'grab' : 'default',
              }}
              onPointerDown={e => startDrag(e, 'move', it)}
            >
              <BlobImg fileRef={it.src} imgStyle={{ objectFit: 'contain', pointerEvents: 'none' }} />
              {sel && (
                <>
                  <div className="mr-handle mr-handle-rotate" onPointerDown={e => startDrag(e, 'rotate', it)}>⟳</div>
                  <div className="mr-handle mr-handle-resize" onPointerDown={e => startDrag(e, 'resize', it)}>⇲</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mr-zoom-control">
        <button type="button" onClick={() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))}>－</button>
        <input type="range" min={30} max={200} step={5} value={Math.round(zoom * 100)}
          onChange={e => setZoom(Number(e.target.value) / 100)} />
        <button type="button" onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>＋</button>
        <small>{Math.round(zoom * 100)}%</small>
      </div>
    </div>
  );
}
