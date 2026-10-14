'use client';
// 클릭 효과음 — 환경설정 > 마우스 커서에서 켜고 끄기 · 소리 고르기 · 직접 등록 · 볼륨.
// 기본 소리 3가지는 파일 없이 브라우저 오디오로 짧게 만들어 낸다. 등록한 파일은 클릭할 때마다 새로 재생한다.
import { useEffect, useRef } from 'react';
import { normSound, useCursorSettings, type ClickSoundKind } from '@/lib/cursorStore';
import { useBlobUrl } from '@/lib/blobStore';

type ACtor = new () => AudioContext;

/** 기본 소리를 한 번 재생 — 설정 화면의 미리듣기도 같이 쓴다 */
export function playBuiltIn(ctxRef: { current: AudioContext | null }, kind: Exclude<ClickSoundKind, 'custom'>, vol: number) {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext) as ACtor | undefined;
    if (!AC) return;
    const ctx = ctxRef.current ?? (ctxRef.current = new AC());
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime, g = ctx.createGain();
    g.connect(ctx.destination);
    const v = Math.max(0, Math.min(1, vol));
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, peak: number, at = 0) => {
      const o = ctx.createOscillator(), eg = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t + at);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      eg.gain.setValueAtTime(0.0001, t + at);
      eg.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * v), t + at + 0.008);
      eg.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(eg); eg.connect(g); o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    if (kind === 'tick') tone('square', 1900, 1200, 0.04, 0.12);
    else if (kind === 'pop') tone('sine', 640, 160, 0.11, 0.5);
    else { tone('sine', 1320, 1320, 0.42, 0.3); tone('sine', 1980, 1980, 0.3, 0.16, 0.03); tone('sine', 2640, 2640, 0.2, 0.08, 0.06); }
  } catch { /* 소리가 안 나도 화면에는 영향 없음 */ }
}

export function ClickSound() {
  const [cs] = useCursorSettings();
  const snd = normSound(cs.sound);
  const url = useBlobUrl(snd.kind === 'custom' ? snd.file : undefined);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!snd.on) return;
    const on = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      const vol = snd.volume / 100;
      if (snd.kind === 'custom') {
        if (!url) return;
        try { const a = new Audio(url); a.volume = vol; void a.play().catch(() => { /* 재생 불가 */ }); } catch { /* 무시 */ }
      } else playBuiltIn(ctx, snd.kind, vol);
    };
    window.addEventListener('click', on, true);
    return () => window.removeEventListener('click', on, true);
  }, [snd.on, snd.kind, snd.volume, url]);

  return null;
}
