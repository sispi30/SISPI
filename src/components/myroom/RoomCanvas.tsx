'use client';
// 마이룸 스테이지 (v1.4) — 고정 캔버스/흰 배경 없이 편집 화면 전체를 좌표 기준으로 쓴다.
// 아이템 선택 시 위에 뜨는 플로팅 툴바(투명도·좌우반전·맨앞/맨뒤·고정·삭제) + 코너의
// 리사이즈·회전 핸들로 조작한다. 화면 이동 모드(또는 스페이스바 누른 채 드래그) 중에는
// 아이템을 건드리지 않고 화면(페이지 스크롤)만 움직인다.
import React, { useEffect, useRef, useState } from 'react';
import { BlobImg } from '@/lib/blobStore';
import type { MyRoomItem } from '@/lib/myroomStore';

type DragKind = 'move' | 'resize' | 'rotate';

export function RoomCanvas({
  items, editable, selectedId, onSelect, onChange, onDelete, zoom, gridOn, panMode,
}: {
  items: MyRoomItem[];
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<MyRoomItem>) => void;
  onDelete: (id: string) => void;
  zoom: number;
  gridOn: boolean;
  panMode: boolean;
}) {
  const dragRef = useRef<{
    kind: DragKind; id: string; startX: number; startY: number;
    it: MyRoomItem; cx: number; cy: number;
  } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollX: number; scrollY: number } | null>(null);
  const [showOpacity, setShowOpacity] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panning = editable && (panMode || spaceHeld);

  // 스페이스바를 누른 채 드래그해도 화면 이동 모드와 같은 동작 (입력창에 포커스 중일 땐 무시)
  useEffect(() => {
    if (!editable) return;
    const kd = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [editable]);

  useEffect(() => {
    if (!editable) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      // 메인 페이지 그리드와 동일: 위치·크기는 10px, 회전은 5° 단위로 스냅
      if (d.kind === 'move') {
        const nx = d.it.x + dx, ny = d.it.y + dy;
        onChange(d.id, gridOn
          ? { x: Math.round(nx / 10) * 10, y: Math.round(ny / 10) * 10 }
          : { x: Math.round(nx), y: Math.round(ny) });
      } else if (d.kind === 'resize') {
        const nw = d.it.w + dx, nh = d.it.h + dy;
        onChange(d.id, {
          w: Math.max(20, gridOn ? Math.round(nw / 10) * 10 : Math.round(nw)),
          h: Math.max(20, gridOn ? Math.round(nh / 10) * 10 : Math.round(nh)),
        });
      } else if (d.kind === 'rotate') {
        const ang = Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * (180 / Math.PI) + 90;
        onChange(d.id, { rot: gridOn ? Math.round(ang / 5) * 5 : Math.round(ang) });
      }
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [editable, zoom, gridOn, onChange]);

  // 화면 이동 — 아이템 좌표는 그대로 두고 페이지 스크롤만 옮긴다
  useEffect(() => {
    if (!panning) return;
    const move = (e: PointerEvent) => {
      const p = panRef.current;
      if (!p) return;
      window.scrollTo({ left: p.scrollX - (e.clientX - p.startX), top: p.scrollY - (e.clientY - p.startY) });
    };
    const up = () => { panRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [panning]);

  const startPan = (e: React.PointerEvent) => {
    e.preventDefault();
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollX: window.scrollX, scrollY: window.scrollY };
  };

  const startDrag = (e: React.PointerEvent, kind: DragKind, it: MyRoomItem) => {
    if (!editable) return;
    if (panning) { startPan(e); return; }
    e.stopPropagation();
    e.preventDefault();
    onSelect(it.id);
    if (it.locked) return; // 선택(툴바)은 계속 가능하게 하고, 실제 이동/리사이즈/회전만 막는다
    const rect = (e.currentTarget.closest('.mr-item') as HTMLElement)?.getBoundingClientRect();
    dragRef.current = {
      kind, id: it.id, startX: e.clientX, startY: e.clientY, it,
      cx: rect ? rect.left + rect.width / 2 : e.clientX,
      cy: rect ? rect.top + rect.height / 2 : e.clientY,
    };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (panning) { startPan(e); return; }
    onSelect(null);
  };

  // 캔버스 경계가 없으므로, 아이템이 놓인 만큼만 스테이지 높이가 늘어난다 (빈 방은 최소 높이 확보)
  const maxBottom = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  const stageHeight = Math.max(560, Math.round((maxBottom + 140) * zoom));

  const sorted = [...items].sort((a, b) => a.z - b.z);
  const selItem = editable && !panning ? items.find(it => it.id === selectedId) : undefined;
  const maxZ = items.reduce((m, it) => Math.max(m, it.z), 0);
  const minZ = items.reduce((m, it) => Math.min(m, it.z), 0);
  const stepZ = (dir: 1 | -1) => {
    if (!selItem) return;
    const ord = [...items].sort((a, b) => a.z - b.z);
    const idx = ord.findIndex(i => i.id === selItem.id);
    const other = ord[idx + dir];
    if (!other) return; // 이미 맨 앞/맨 뒤
    onChange(selItem.id, { z: other.z });
    onChange(other.id, { z: selItem.z });
  };

  return (
    <div className="mr-stage-scroll">
      <div className={`mr-stage-inner${panning ? ' panning' : ''}`} style={{ height: stageHeight }} onPointerDown={onStagePointerDown}>
        <div className={`mr-stage-scale${gridOn && editable ? ' gridlines' : ''}`} style={{ transform: `scale(${zoom})` }}>
          {sorted.map(it => {
            const sel = !panning && editable && selectedId === it.id;
            return (
              <div
                key={it.id}
                className={`mr-item${sel ? ' sel' : ''}${it.locked ? ' locked' : ''}`}
                style={{
                  left: it.x, top: it.y, width: it.w, height: it.h,
                  transform: `rotate(${it.rot || 0}deg) scaleX(${it.flip ? -1 : 1})`, zIndex: it.z,
                  opacity: (it.opacity ?? 100) / 100,
                  cursor: !editable ? 'default' : panning ? 'grab' : (it.locked ? 'not-allowed' : 'grab'),
                }}
                onPointerDown={e => startDrag(e, 'move', it)}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (editable && !panning) onSelect(it.id); }}
              >
                <BlobImg fileRef={it.src} imgStyle={{ objectFit: 'contain', pointerEvents: 'none' }} />
                {sel && !it.locked && (
                  <>
                    <div className="mr-handle mr-handle-rotate" onPointerDown={e => startDrag(e, 'rotate', it)}>⟳</div>
                    <div className="mr-handle mr-handle-resize" onPointerDown={e => startDrag(e, 'resize', it)}>⇲</div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {selItem && (
          <div className="mr-sel-toolbar" style={{ left: (selItem.x + selItem.w / 2) * zoom, top: selItem.y * zoom }}
            onPointerDown={e => e.stopPropagation()}>
            <div className="mr-sel-toolbar-row">
              <button type="button" disabled={selItem.locked} title="투명도" onClick={() => setShowOpacity(v => !v)}>👁</button>
              <button type="button" disabled={selItem.locked} title="좌우반전"
                onClick={() => onChange(selItem.id, { flip: !selItem.flip })}>↔</button>
              <button type="button" disabled={selItem.locked} title="맨 앞으로"
                onClick={() => onChange(selItem.id, { z: maxZ + 1 })}>⇈</button>
              <button type="button" disabled={selItem.locked} title="앞으로"
                onClick={() => stepZ(1)}>↑</button>
              <button type="button" disabled={selItem.locked} title="뒤로"
                onClick={() => stepZ(-1)}>↓</button>
              <button type="button" disabled={selItem.locked} title="맨 뒤로"
                onClick={() => onChange(selItem.id, { z: minZ - 1 })}>⇊</button>
              <button type="button" title={selItem.locked ? '잠금 해제' : '고정'}
                onClick={() => onChange(selItem.id, { locked: !selItem.locked })}>{selItem.locked ? '🔒' : '🔓'}</button>
              <button type="button" disabled={selItem.locked} title="삭제" onClick={() => onDelete(selItem.id)}>🗑</button>
            </div>
            {showOpacity && !selItem.locked && (
              <div className="mr-sel-opacity">
                <input type="range" min={10} max={100} step={5} value={selItem.opacity ?? 100}
                  onChange={e => onChange(selItem.id, { opacity: Number(e.target.value) })} />
                <small>{selItem.opacity ?? 100}%</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
