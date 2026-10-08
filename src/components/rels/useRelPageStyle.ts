'use client';
// 자관 페이지의 테마색·페이지 배경(그라데이션)·배경 이미지(+블러)를 이 페이지에도 똑같이 적용한다 (v6.1).
// 자관 상세(/rels/{id})와 같은 규칙(기본 = 원본 AU) — 자관 갤러리(/rels/{id}/gallery)처럼 자관 설정을 따라가는
// 하위 페이지에서 쓴다. 페이지를 벗어나면 모두 원래대로 돌아온다(각 setter를 null로 풂).
import { useEffect } from 'react';
import { useTheme } from '@/lib/ThemeProvider';
import { useBlobUrl } from '@/lib/blobStore';
import { Relation, auStyle } from '@/lib/charStore';

export function useRelPageStyle(rel: Relation | undefined, enabled = true) {
  const { setPageTheme, setPageBg, setPageBgImage } = useTheme();
  const on = enabled && !!rel;

  // 테마색
  const pageColor = on && rel!.themeMode === 'custom' && rel!.themeColor ? rel!.themeColor : null;
  const pageTone = on ? rel!.themeTone : undefined;
  useEffect(() => {
    setPageTheme(pageColor, pageTone);
    return () => setPageTheme(null);
  }, [pageColor, pageTone, setPageTheme]);

  // 페이지 전체 배경 그라데이션
  const st = on ? auStyle(rel!, rel!.aus.find(a => a.id === 'base')) : undefined;
  const bgG1 = st?.pageBgG1;
  const bgG2 = st?.pageBgG2;
  const bgAngle = st?.pageBgAngle;
  useEffect(() => {
    if (!bgG1 && !bgG2) return;
    setPageBg({ g1: bgG1 ?? '#2b3038', g2: bgG2 ?? '#121418', angle: bgAngle ?? 180 });
    return () => setPageBg(null);
  }, [bgG1, bgG2, bgAngle, setPageBg]);

  // 배경 이미지 + 블러
  const imgUrl = useBlobUrl(on ? rel!.headerImgId : undefined);
  const blur = (on ? rel!.headerBlur : undefined) ?? 16;
  useEffect(() => {
    setPageBgImage(imgUrl ?? null, blur);
    return () => setPageBgImage(null);
  }, [imgUrl, blur, setPageBgImage]);
}
