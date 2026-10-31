// 옷장 전용 단색 아이콘 — 한 줄짜리 선 그림(글자색을 따라간다). 이모티콘 대신 쓴다.
import React from 'react';

const P: Record<string, React.ReactNode> = {
  camera: <><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  soundOn: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /></>,
  soundOff: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 9.5l4 5M20.5 9.5l-4 5" /></>,
  pants: <path d="M7 3h10l1 18h-4l-2-10-2 10H6z" />,
  shirt: <path d="M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 01-8 0z" />,
  shoe: <path d="M3 16l1-8 4 1 2 3 3 1c3 1 6 1 8 3v1H3z" />,
  dress: <path d="M9 3h6l-1 6 5 12H5l5-12z" />,
  coat: <path d="M9 3L4 6v15h5V11l3 3 3-3v10h5V6l-5-3-3 4z" />,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  hair: <><path d="M5 20c0-8 3-15 7-15s7 7 7 15" /><path d="M9 20c0-4 1-7 3-9 2 2 3 5 3 9" /></>,
  mountain: <path d="M3 19l6-10 4 6 3-4 5 8z" />,
  crown: <path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" />,
  ribbon: <><path d="M12 12c-3-4-8-5-8-1s5 5 8 1zM12 12c3-4 8-5 8-1s-5 5-8 1z" /><path d="M12 12l-3 8M12 12l3 8" /></>,
  bookmark: <path d="M7 3h10v18l-5-4-5 4z" />,
  book: <><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" /><path d="M12 6v14" /></>,
  pointer: <path d="M5 3l14 7-6 2-2 6z" />,
  arrows: <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />,
  ban: <><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></>,
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14c3 0 5 1.8 5 4.5" /></>,
};

export type ClosetIconName = keyof typeof P;

export function ClosetIcon({ name, size = 14 }: { name: string; size?: number }) {
  const body = P[name];
  if (!body) return null;
  return (
    <svg className="cl-ico" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
  );
}
