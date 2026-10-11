import type { NextConfig } from "next";

// 보안 헤더 (v2.1)
// · 클릭재킹 방지(frame-ancestors/X-Frame-Options), MIME 스니핑 방지, 레퍼러 최소화
// · base-uri/object-src/form-action 을 막아 주입된 마크업의 피해 범위를 줄임
// 스크립트 출처 제한(script-src)은 인라인 부트스트랩·외부 SDK 때문에 넣지 않았다.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
