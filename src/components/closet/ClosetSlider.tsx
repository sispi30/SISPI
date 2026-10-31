'use client';
// 옷장 전용 슬라이드 — 기본 브라우저 슬라이더 대신 쓰는 자체 컨트롤 (끌기 · 클릭 · 방향키)
import React, { useRef } from 'react';

export function ClosetSlider({ value, min, max, step = 1, onChange, onDragStart, onDragEnd }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  /** 끄는 동안 주변 배치를 고정하려고 알려 준다 (끌 때마다 화면 폭이 바뀌어 옆 패널이 흔들리는 것을 막음) */
  onDragStart?: () => void; onDragEnd?: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const zero = max > min ? ((0 - min) / (max - min)) * 100 : 0;   // 0(겹침/간격의 경계) 위치 표시

  const from = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    onChange(clamp(min + ((clientX - r.left) / r.width) * (max - min)));
  };
  const down = (e: React.PointerEvent) => {
    onDragStart?.();
    from(e.clientX);
    const mv = (ev: PointerEvent) => from(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      onDragEnd?.();
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    e.preventDefault();
  };
  const key = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    onChange(clamp(value + d * step * (e.shiftKey ? 5 : 1)));
    e.preventDefault();
  };

  return (
    <div className="cl-slider" ref={track} role="slider" tabIndex={0} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      onPointerDown={down} onKeyDown={key}>
      <span className="cl-slider-zero" style={{ left: `${zero}%` }} />
      <span className="cl-slider-fill" style={{ left: `${Math.min(pct, zero)}%`, width: `${Math.abs(pct - zero)}%` }} />
      <span className="cl-slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}
