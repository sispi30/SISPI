import type { MetadataRoute } from 'next';
import { siteMeta } from '@/lib/siteMeta';

// manifest.ts는 기본이 **캐시된 라우트**라 빌드 때 만든 결과가 그대로 나간다 —
// 환경설정에서 어플 아이콘·사이트 제목을 바꿔도 다시 배포하기 전에는 반영되지 않았다.
// 요청마다 만들고(설정 읽기 자체는 siteMeta가 5분 캐시) 항상 최신 설정을 따르게 한다.
export const dynamic = 'force-dynamic';

/** 웹앱 매니페스트 (커플홈 — 웹푸시) — 아이폰은 사파리 「홈 화면에 추가」로 설치한 웹앱에서만 푸시를 받을 수 있고,
 *  그러려면 standalone 매니페스트가 있어야 한다. 이름은 사이트 제목(환경설정)에서. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { title, appIcon } = await siteMeta();
  const name = (title || 'O.HOME').replace(/ — 개인홈$/, '').trim() || 'O.HOME';
  return {
    name,
    short_name: name.slice(0, 12),
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#22272e',
    // 환경설정에서 어플 아이콘을 지정했으면 그것을(같은 그림을 두 크기로 선언 — 브라우저가 맞춰 줄인다),
    // 없으면 배포 기본 아이콘
    icons: appIcon
      ? [
        { src: appIcon, sizes: '192x192', purpose: 'any' },
        { src: appIcon, sizes: '512x512', purpose: 'any' },
      ]
      : [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
  };
}
