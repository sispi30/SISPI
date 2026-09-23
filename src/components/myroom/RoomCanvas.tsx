'use client';
// 마이룸 스테이지 (v1.2) — 메인 페이지 위젯 편집 영역처럼 고정 캔버스/흰 배경 없이,
// 편집 화면(부모가 주는 실제 컨테이너 크기) 그대로를 좌표 기준으로 쓴다.
// 줌은 부모(page)가 상태를 들고 있는 controlled prop — 화면 우측 고정 바에서 조절한다.
import React, { useEffect, useRef } from 'react';
import { BlobImg } from '@/lib/blobStore';
import type { MyRoomItem } from '@/lib/myroomStore';

type DragKind = 'move' | 'resize' | 'rotate';

export function RoomCanvas({
  items, editable, selectedId, onSelect, onChange, zoom,
}: {
  items: MyRoomItem[];
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<MyRoomItem>) => void;
  zoom: number;
}) {
  const dragRef = useRef<{
    kind: DragKind; id: string; startX: number; startY: number;
    it: MyRoomItem; cx: number; cy: number;
  } | null>(null);

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

  // 캔버스 경계가 없으므로, 아이템이 놓인 만큼만 스테이지 높이가 늘어난다 (빈 방은 최소 높이 확보)
  const maxBottom = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  const stageHeight = Math.max(560, Math.round((maxBottom + 140) * zoom));

  const sorted = [...items].sort((a, b) => a.z - b.z);

  return (
    <div className="mr-stage-scroll">
      <div className="mr-stage-inner" style={{ height: stageHeight }} onPointerDown={() => onSelect(null)}>
        <div className="mr-stage-scale" style={{ transform: `scale(${zoom})` }}>
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
      </div>
    </div>
  );
}
