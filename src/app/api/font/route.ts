// 업로드 폰트 파일 같은 출처 중계 (v2.0 사용자 제보 — 「등록한 폰트가 적용이 안 돼요」).
//
// 서버 모드의 폰트 파일은 저장소(파이어베이스/수파베이스)의 공개 URL인데, **폰트는 브라우저가
// CORS를 강제하는 자원**이라(이미지와 다르다) 저장소가 허용 헤더를 안 주면 로드가 통째로
// 거부된다 — 등록은 되는데 화면은 조용히 폴백 글꼴로 남는 원인. 이 라우트가 서버에서 대신
// 받아 같은 출처로 내주면 CORS가 아예 걸리지 않는다.
//
// 보안 (v2.1) — 이 라우트는 우리 출처에서 응답을 내주므로, 업로드된 임의 파일이 그대로
// 통과하면 「저장형 XSS」 통로가 된다(회원이 .html을 올리고 /api/font?u=… 를 링크로 뿌리는 식).
// 그래서 ① 저장소 호스트·경로만 허용하고 ② 업스트림 content-type을 믿지 않고 폰트 MIME으로
// 고정하며 ③ nosniff + CSP sandbox 로 문서로 실행되는 것을 막고 ④ 리다이렉트를 따라가지 않고
// ⑤ 크기·시간 상한을 둔다.
const ALLOWED = [
  /(^|\.)firebasestorage\.googleapis\.com$/,
  /(^|\.)supabase\.co$/,
  /(^|\.)supabase\.in$/,
];
// 저장소 공개 파일 경로 형태만 허용 (그 밖의 API 경로 중계 차단)
const PATHS = [
  /^\/v0\/b\/[^/]+\/o\/[^/]+/,                 // firebase storage
  /^\/storage\/v1\/object\/(public|sign)\//,   // supabase storage
];
const MAX_BYTES = 10 * 1024 * 1024;            // 폰트 10MB 상한
const TIMEOUT_MS = 15_000;

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
};

function fontMime(pathname: string): string {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch { /* 그대로 */ }
  const ext = (p.split('?')[0].split('.').pop() ?? '').toLowerCase();
  return FONT_MIME[ext] ?? 'application/octet-stream';
}

const SAFE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; sandbox",
  'cross-origin-resource-policy': 'same-origin',
};

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u') ?? '';
  let target: URL;
  try { target = new URL(u); } catch { return new Response('bad url', { status: 400 }); }
  if (
    target.protocol !== 'https:' ||
    target.username || target.password ||
    (target.port && target.port !== '443') ||
    !ALLOWED.some(r => r.test(target.hostname)) ||
    !PATHS.some(r => r.test(target.pathname))
  ) {
    return new Response('host not allowed', { status: 400 });
  }
  try {
    // 리다이렉트를 따라가지 않는다 — 허용 호스트에서 다른 곳으로 튕겨 내부망/임의 주소에 닿는 길을 막음
    const res = await fetch(target, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return new Response('fetch failed', { status: 502 });
    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) return new Response('too large', { status: 413 });

    // 스트리밍 중에도 상한 적용 (content-length 가 없거나 거짓일 때)
    let seen = 0;
    const limited = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        seen += chunk.byteLength;
        if (seen > MAX_BYTES) { ctl.error(new Error('too large')); return; }
        ctl.enqueue(chunk);
      },
    }));
    return new Response(limited, {
      headers: {
        ...SAFE_HEADERS,
        'content-type': fontMime(target.pathname),
        'content-disposition': 'attachment',
        // 파일 주소에 고유 id가 들어 있어 내용이 변할 일이 없다 — 오래 캐시
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
