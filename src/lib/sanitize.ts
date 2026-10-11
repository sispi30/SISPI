// HTML 보안 정책 (6.3 확정) — 스크립트 실행 불허, 스타일은 유지
// <script>·인라인 이벤트(onclick 등)·javascript: 링크 제거. DOMPurify 사용.
//
// v2.1 보강
//  · <style>/<link>/<meta>/<base> 등 문서 단위로 영향을 주는 태그 금지 (CSS 주입으로 화면 덮어쓰기·
//    속성 선택자를 이용한 정보 유출 방지)
//  · 인라인 style 에서 화면 전체를 덮거나 외부 주소를 부르는 속성(position:fixed, url(), expression 등) 제거
//  · target="_blank" 링크에 rel="noopener noreferrer" 강제 (window.opener 탈취 방지)
//  · 이미지는 레퍼러를 보내지 않음
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export type PostMode = 'md' | 'html';

const FORBID_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form', 'input',
  'style', 'link', 'meta', 'base', 'textarea', 'select', 'option', 'button', 'frame', 'frameset', 'applet',
];

// 인라인 style 안에서 허용하지 않는 패턴
const BAD_STYLE = /(url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding|position\s*:\s*(fixed|sticky)|image-set\s*\()/i;

let hooked = false;
function installHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.hasAttribute?.('style')) {
      const st = node.getAttribute('style') ?? '';
      // CSS 주석·이스케이프로 패턴을 숨기는 시도까지 보려고 정리한 문자열로 검사
      const norm = st.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\[0-9a-f]{1,6}\s?/gi, '').replace(/\\/g, '');
      if (BAD_STYLE.test(norm)) {
        // 위험한 선언만 걷어내고 나머지는 보존
        const safe = st.split(';').filter(d => {
          const n = d.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\[0-9a-f]{1,6}\s?/gi, '').replace(/\\/g, '');
          return !BAD_STYLE.test(n);
        }).join(';');
        if (safe.trim()) node.setAttribute('style', safe); else node.removeAttribute('style');
      }
    }
    if (node.tagName === 'A') {
      if (node.getAttribute('target')) {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('referrerpolicy', 'no-referrer');
      node.setAttribute('loading', 'lazy');
    }
  });
}

export function sanitizeHtml(html: string): string {
  // DOMPurify는 브라우저 DOM 필요 — SSR 프리렌더 시 빈 값 (클라이언트에서 렌더됨)
  if (typeof window === 'undefined') return '';
  installHooks();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['style', 'target', 'align'],   // 스타일 자유 (6.3)
    FORBID_TAGS,
    FORBID_ATTR: ['formaction', 'srcdoc'],
  });
}

/** MD/HTML 본문 → 렌더 가능한 안전한 HTML */
export function renderBody(mode: PostMode, body: string): string {
  const raw = mode === 'md' ? (marked.parse(body, { async: false }) as string) : body;
  return sanitizeHtml(raw);
}
