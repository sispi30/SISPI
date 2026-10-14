// 어플 아이콘 같은 출처 중계·정규화 (환경설정 > 어플 아이콘).
//
// 매니페스트의 아이콘은 정확한 크기의 PNG여야 크롬이 「설치 가능」으로 본다. 올린 그림은 아무 크기·형식일 수
// 있고 저장소 주소라 외부 출처이므로, 서버가 지정된 아이콘을 받아 정사각 PNG로 맞춰 우리 출처에서 내준다.
//
// 보안 — 주소는 **요청에서 받지 않는다**. 서버가 직접 읽은 사이트 설정(siteMeta)의 아이콘만 쓰고,
// 그 호스트도 저장소 호스트로 한 번 더 제한한다(임의 주소 중계·SSRF 방지). 크기는 정해진 값만 허용.
import { siteMeta } from '@/lib/siteMeta';
import { APP_ICON_SIZES } from '@/lib/appIcon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = [
  /(^|\.)firebasestorage\.googleapis\.com$/,
  /(^|\.)supabase\.co$/,
  /(^|\.)supabase\.in$/,
];
const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export async function GET(req: Request) {
  const size = Number(new URL(req.url).searchParams.get('s'));
  if (!(APP_ICON_SIZES as readonly number[]).includes(size)) {
    return new Response('bad size', { status: 400 });
  }
  const fallback = () => new Response(null, {
    status: 302,
    headers: { Location: size === 512 ? '/icon-512.png' : '/icon-192.png', 'Cache-Control': 'no-store' },
  });

  try {
    const { appIcon } = await siteMeta();
    if (!appIcon) return fallback();
    const u = new URL(appIcon);
    if (u.protocol !== 'https:' || !ALLOWED.some(r => r.test(u.hostname))) return fallback();

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const res = await fetch(u, { redirect: 'error', signal: ctl.signal, cache: 'no-store' }).finally(() => clearTimeout(timer));
    if (!res.ok) return fallback();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return fallback();

    // sharp는 next가 함께 설치하는 선택 의존성 — 못 불러와도 빌드가 깨지지 않고 기본 아이콘으로 돌아가게 지연 로드
    const sharp = (await import('sharp')).default;
    let img = sharp(buf).rotate().resize(size, size, { fit: 'cover', position: 'centre' });
    // 애플 터치 아이콘(180)은 투명 부분을 검게 채우므로 흰 바탕으로 깐다
    if (size === 180) img = img.flatten({ background: '#ffffff' });
    const png = await img.png().toBuffer();

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
        // 주소에 지문(v)이 붙어 있어 아이콘을 바꾸면 주소가 바뀐다 — 오래 캐시해도 안전
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch {
    return fallback();
  }
}
