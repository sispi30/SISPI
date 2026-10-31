// 옷장 「찰칵!」 저장용 그림 중계.
// 저장소(Firebase Storage 등)에 CORS 설정이 없으면 브라우저가 그 그림을 캔버스에 그리지 못해 빈 화면이 저장된다.
// 같은 출처로 한 번 거쳐 오게 해서 해결한다. 저장소 호스트만 허용(임의 주소 중계·SSRF 방지), 그림 형식만 통과.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = [
  /(^|\.)firebasestorage\.googleapis\.com$/,
  /(^|\.)storage\.googleapis\.com$/,
  /(^|\.)firebasestorage\.app$/,
  /(^|\.)supabase\.co$/,
  /(^|\.)supabase\.in$/,
];
const MAX_BYTES = 20 * 1024 * 1024;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('u') || '';
  let u: URL;
  try { u = new URL(raw); } catch { return new Response('bad url', { status: 400 }); }
  if (u.protocol !== 'https:' || !ALLOWED.some(r => r.test(u.hostname))) return new Response('host not allowed', { status: 403 });
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15_000);
    const res = await fetch(u, { redirect: 'error', signal: ctl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return new Response('upstream ' + res.status, { status: 502 });
    const type = res.headers.get('content-type') || '';
    if (!/^image\//i.test(type)) return new Response('not an image', { status: 415 });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return new Response('size', { status: 413 });
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch { return new Response('fetch failed', { status: 502 }); }
}
