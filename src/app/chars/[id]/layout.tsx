'use client';
// 캐릭터 하나(/chars/[id]/*) 아래 상세·갤러리·편집 화면이 공유하는 레이아웃 (v2.7).
//
// 캐릭터 테마색(대표 테마색)을 예전에는 각 page.tsx가 각자 useEffect로 적용/해제했는데,
// 상세 ↔ 갤러리처럼 서로 다른 페이지로 이동할 때마다 "떠나는 페이지가 null로 되돌렸다가
// 도착한 페이지가 다시 칠하는" 순간이 생겨 기본 배경이 잠깐 깜빡이며 나타났다.
// 여기서 기본 테마를 한 번만 적용해 두면, 같은 캐릭터([id]가 그대로인) 내에서는 이 레이아웃이
// 계속 마운트된 채로 유지되므로 페이지를 오가도 테마가 끊기지 않는다.
// (AU별로 테마색이 다른 경우의 "미세 조정"은 상세 페이지 자체에서 별도로 얹는다 — 그 경우에도
// 벗어날 때 null이 아니라 이 레이아웃의 기본색으로 되돌아가게 해 깜빡임이 나지 않도록 함)
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, findByKey } from '@/lib/charStore';
import { useTheme } from '@/lib/ThemeProvider';

export default function CharIdLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const ch = findByKey(chars, id);
  const { setPageTheme } = useTheme();
  const baseColor = ch?.themeMode === 'custom' ? ch.color : null;

  useEffect(() => {
    setPageTheme(baseColor);
    return () => setPageTheme(null);
  }, [baseColor, setPageTheme]);

  return children;
}
