// 스크랩 게시판 (5.8) — 업로드받은 그누보드 스크랩 게시판 스킨(_helper.php의 scrap_embed_* 함수들)을
// 이 저장소 방식(TypeScript, dangerouslySetInnerHTML 없이 문자열만 생성)으로 옮긴 것.
// 본문에서 "URL만 단독으로 있는 줄"을 찾아 유튜브/트위터(X)/이미지/일반 링크 카드로 임베드하고,
// 그 외 텍스트는 문단으로, 빈 줄은 스페이서로 렌더한다 — 원본 PHP와 동일한 규칙.

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(text: string): string {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function isUrlOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^https?:\/\/[^\s<>"']+$/iu.test(t);
}

/** 유튜브 videoId 추출 — youtu.be/<id>, watch?v=, /embed|shorts|live/<id> */
function parseYoutubeId(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return ''; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/^\/|\/$/g, '');

  if (host.includes('youtu.be')) {
    return /^[A-Za-z0-9_-]{6,}$/.test(path) ? path : '';
  }
  if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
    const v = u.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;
    const m = /^(embed|shorts|live)\/([A-Za-z0-9_-]{6,})/.exec(path);
    if (m) return m[2];
  }
  return '';
}

/** 트위터(X) 상태 링크 파싱 — /<user>/status/<id> */
function parseTweet(url: string): { user: string; statusId: string; canonical: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (!host.includes('twitter.com') && !host.includes('x.com')) return null;
  const m = /^\/([A-Za-z0-9_]+)\/status\/(\d+)/.exec(u.pathname);
  if (!m) return null;
  const user = m[1];
  const statusId = m[2];
  return { user, statusId, canonical: `https://twitter.com/${encodeURIComponent(user)}/status/${encodeURIComponent(statusId)}` };
}

function isImageUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(u.pathname);
}

type MediaType = 'youtube' | 'tweet' | 'image' | 'link' | 'text';

function guessType(url: string): MediaType {
  if (!url) return 'text';
  if (parseYoutubeId(url)) return 'youtube';
  if (parseTweet(url)) return 'tweet';
  if (isImageUrl(url)) return 'image';
  return 'link';
}

function buildYoutubeHtml(url: string): string {
  const id = parseYoutubeId(url);
  if (!id) return '';
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
  const isShorts = url.includes('/shorts/');
  const cls = 'bscrap-media bscrap-media--video' + (isShorts ? ' bscrap-media--shorts' : '');
  return (
    `<div class="${cls}">` +
      `<iframe src="${escapeHtml(src)}" title="YouTube video player" loading="lazy" frameborder="0" ` +
      `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
      `referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` +
    `</div>`
  );
}

function buildTweetHtml(url: string): { html: string; canonical: string } {
  const t = parseTweet(url);
  if (!t) return { html: '', canonical: '' };
  return {
    canonical: t.canonical,
    html:
      `<div class="bscrap-media bscrap-media--tweet">` +
        `<blockquote class="twitter-tweet" data-dnt="true">` +
          `<a href="${escapeHtml(t.canonical)}">${escapeHtml(t.canonical)}</a>` +
        `</blockquote>` +
      `</div>`,
  };
}

function buildImageHtml(url: string): string {
  return (
    `<div class="bscrap-media bscrap-media--image">` +
      `<img src="${escapeHtml(url)}" alt="" loading="lazy">` +
    `</div>`
  );
}

function buildLinkHtml(url: string): string {
  const label = url.replace(/^https?:\/\//i, '');
  return (
    `<a class="bscrap-link-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow">` +
      `<span class="bscrap-link-card__eyebrow"><i class="fa-solid fa-up-right-from-square"></i> 외부 링크</span>` +
      `<strong class="bscrap-link-card__title">${escapeHtml(label)}</strong>` +
    `</a>`
  );
}

function buildMedia(rawUrl: string): { html: string; needsTwitter: boolean } {
  const url = rawUrl.trim();
  const type = guessType(url);
  if (type === 'youtube') return { html: buildYoutubeHtml(url), needsTwitter: false };
  if (type === 'tweet') { const t = buildTweetHtml(url); return { html: t.html, needsTwitter: t.html !== '' }; }
  if (type === 'image') return { html: buildImageHtml(url), needsTwitter: false };
  if (type === 'link') return { html: buildLinkHtml(url), needsTwitter: false };
  return { html: '', needsTwitter: false };
}

export interface RenderedScrapContent {
  bodyHtml: string;
  needsTwitter: boolean;
}

/** 본문(raw text)을 카드 안에 넣을 HTML로 변환 — URL만 있는 줄은 임베드로, 빈 줄은 스페이서로,
 *  그 외는 문단(줄바꿈 유지)으로. dangerouslySetInnerHTML로 넣을 문자열이라 텍스트는 반드시 이스케이프한다. */
export function renderScrapContent(raw: string): RenderedScrapContent {
  const text = normalizeText(raw);
  if (!text) return { bodyHtml: '', needsTwitter: false };

  const lines = text.split('\n');
  const chunks: string[] = [];
  let buf: string[] = [];
  let needsTwitter = false;

  const flush = () => {
    if (buf.length === 0) return;
    const p = escapeHtml(buf.join('\n')).replace(/\n/g, '<br>');
    chunks.push(`<p>${p}</p>`);
    buf = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '') {
      flush();
      chunks.push('<div class="bscrap-content-spacer"></div>');
      continue;
    }
    if (isUrlOnlyLine(trimmed)) {
      flush();
      const media = buildMedia(trimmed);
      if (media.needsTwitter) needsTwitter = true;
      if (media.html) { chunks.push(media.html); continue; }
    }
    buf.push(rawLine.replace(/\s+$/, ''));
  }
  flush();

  return { bodyHtml: chunks.join('\n'), needsTwitter };
}
