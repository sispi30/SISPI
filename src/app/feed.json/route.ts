// 이웃 알림용 공개 피드 — https://내사이트/feed.json
// 이웃이 알림 센터에서 이 주소를 구독하면 내 게시판의 새 글을 알림으로 받는다.
//
// 안전장치
//  · 로그인 없이(API 키만으로) DB를 읽는다 → 서버 규칙이 「전체공개」 행만 내준다.
//    회원전용·비공개 메뉴의 글은 애초에 안 나온다.
//  · 비밀글·수위(adult) 접힘 글은 제목도 내보내지 않는다. 본문은 절대 내보내지 않는다
//    (Firestore에서는 제목·날짜·작성자 필드만 골라 읽는다).
//  · CDN 캐시 — 구독자가 많아도 DB 조회는 캐시 시간당 한 번 수준.
//  · 게시판·갤러리·로드뷰·TRPG 로그·도토리·플레이기록·커미션·다이어리·감상타래·자캐·자관·TRPG 캐릭터·마이룸을
//    한 피드에 합친다. 글마다 제목/날짜 칸이 달라 아래 SOURCES 표에서 종류별로 뽑는 방법을 정해 둔다.
//  · 담지 않는 것: 방명록·메모·역극·신청자·옷입히기·댓글·알림 (방문자·회원이 남긴 것이거나 개인 정보라서)
//  · 감상타래는 타래글 하나하나를 담는다. 타래글 본문은 내보내지 않는다 (Firestore는 배열 안의 칸만 골라
//    읽을 수 없어 서버가 읽되 응답에 싣지 않는다).
// 지원: Firebase(Firestore) · Supabase
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 30;
const MAX_ROWS = 400;                  // Firestore에서 한 번에 읽는 공개 글 상한
const CACHE_SECONDS = 300;             // CDN 캐시 시간. 줄이면 반영은 빨라지지만 DB 읽기가 늘어난다.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
};

type Cfg =
  | { kind: 'supabase'; url: string; anonKey: string }
  | { kind: 'firebase'; apiKey: string; projectId: string; databaseId: string }
  | null;

async function loadConfig(origin: string): Promise<Cfg> {
  const e = process.env;
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return { kind: 'supabase', url: e.NEXT_PUBLIC_SUPABASE_URL, anonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  if (e.NEXT_PUBLIC_FIREBASE_API_KEY && e.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    return { kind: 'firebase', apiKey: e.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      databaseId: (e.NEXT_PUBLIC_FIREBASE_DATABASE_ID ?? '').trim() || '(default)' };
  try {
    const r = await fetch(`${origin}/ohome.config.json`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const o = await r.json() as Record<string, string>;
    if (o.kind === 'firebase' || (o.apiKey && o.projectId))
      return o.apiKey && o.projectId
        ? { kind: 'firebase', apiKey: o.apiKey, projectId: o.projectId, databaseId: (o.databaseId ?? '').trim() || '(default)' }
        : null;
    if (o.url && o.anonKey) return { kind: 'supabase', url: o.url, anonKey: o.anonKey };
  } catch { /* 설정 없음 */ }
  return null;
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...CORS, ...extra } });
const noStore = { 'Cache-Control': 'no-store' };

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

/** 피드 한 줄 */
type Row = { id: string; title: string; date: string; created: string; author: string; secret: boolean; adult: boolean; path: string };
type Plain = Record<string, unknown>;
type Doc = { id: string; data: Plain; created: string };

/* ── Firestore REST 값 → 일반 값 ── */
type FsVal = {
  stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; timestampValue?: string;
  nullValue?: null; mapValue?: { fields?: Record<string, FsVal> }; arrayValue?: { values?: FsVal[] };
};
function fsPlain(v?: FsVal): unknown {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(fsPlain);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fsPlain(x)]));
  return null;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isAdult = (fold: unknown) => (fold as { type?: unknown } | null | undefined)?.type === 'adult';
/** 섹션을 여러 개로 만든 목록은 ?s=섹션 으로 열린다 (기본 섹션은 그냥 주소) */
const secPath = (base: string, secId: unknown) => (typeof secId === 'string' && secId && secId !== 'main' ? `${base}?s=${encodeURIComponent(secId)}` : base);

/** 종류별로 「무엇을 읽고, 어떤 줄로 만들지」 */
type Source = { coll: string; keys: string[]; map: (id: string, d: Plain, created: string) => Row[] };

/** 제목 하나·주소 하나로 끝나는 흔한 종류 */
const simple = (o: {
  coll: string; tag: string; keys: string[];
  title: (d: Plain) => string; path: (id: string, d: Plain) => string;
  dateKey?: string;      // 글에 적힌 등록일 칸 — 비우면 문서 생성 시각 (세션 날짜처럼 지난 날짜일 수 있는 칸은 쓰지 않는다)
  fold?: boolean;        // 수위(adult) 접힘 글 제외
  idPrefix?: string;
}): Source => ({
  coll: o.coll, keys: o.keys,
  map: (id, d, created) => {
    const t = o.title(d);
    if (!t) return [];
    return [{
      id: (o.idPrefix ?? `${o.coll}:`) + id, title: `[${o.tag}] ${t}`,
      date: (o.dateKey ? str(d[o.dateKey]) : '') || created, created,
      author: '', secret: false, adult: !!o.fold && isAdult(d.fold), path: o.path(id, d),
    }];
  },
});

/** 감상타래 작품 하나 → 타래글마다 한 줄 (글이 없으면 작품 하나가 한 줄) */
const THREAD_POSTS_PER_WORK = 10;
const threadSource: Source = {
  coll: 'threads', keys: ['title', 'secId', 'created', 'posts'],
  map: (id, d, createdAt) => {
    const title = str(d.title);
    if (!title) return [];
    const path = secPath('/threads', d.secId);
    const tag = `[감상타래] ${title}`;
    const created = str(d.created) || createdAt;
    const base = { created, author: '', secret: false, path };
    const posts = (Array.isArray(d.posts) ? d.posts : []).flatMap(x => {
      const p = (x ?? {}) as Plain;
      return typeof p.id === 'string' && p.id ? [{ id: p.id, date: str(p.date), adult: isAdult(p.fold) }] : [];
    });
    if (!posts.length) return [{ ...base, id: `thread:${id}`, title: tag, date: created, adult: false }];
    return posts
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .slice(0, THREAD_POSTS_PER_WORK)
      .map(p => ({ ...base, id: `thread:${id}:${p.id}`, title: `${tag} · 새 글`, date: p.date || created, adult: p.adult }));
  },
};

const SOURCES: Source[] = [
  // 게시판 — 제목 그대로 (여러 게시판이어도 같은 /board/글 주소)
  {
    coll: 'posts', keys: ['title', 'date', 'author', 'secret', 'fold'],
    map: (id, d, created) => [{
      id, title: str(d.title), date: str(d.date) || created, created, author: str(d.author),
      secret: d.secret === true, adult: isAdult(d.fold), path: `/board/${encodeURIComponent(id)}`,
    }],
  },
  simple({ coll: 'gallery', tag: '갤러리', keys: ['title', 'date', 'fold'], title: d => str(d.title), dateKey: 'date', fold: true,
    path: id => `/gallery/${encodeURIComponent(id)}` }),
  simple({ coll: 'roadview', tag: '로드뷰', keys: ['title', 'no', 'date', 'fold', 'secId'], dateKey: 'date', fold: true,
    title: d => (typeof d.no === 'number' && d.no > 0 ? `#${d.no}` : str(d.title) || '새 그림'),
    path: (_id, d) => secPath('/roadview', d.secId) }),
  simple({ coll: 'trpg_logs', tag: 'TRPG 로그', keys: ['title'], title: d => str(d.title),
    path: id => `/trpg/${encodeURIComponent(id)}` }),
  simple({ coll: 'dotori', tag: '도토리', keys: ['name', 'date', 'secId'], title: d => str(d.name), dateKey: 'date',
    path: (_id, d) => secPath('/dotori', d.secId) }),
  simple({ coll: 'playlog', tag: '플레이기록', keys: ['scenario', 'secId'], title: d => str(d.scenario),
    path: (_id, d) => secPath('/playlog', d.secId) }),
  simple({ coll: 'commissions', tag: '커미션', keys: ['name', 'date'], title: d => str(d.name), dateKey: 'date',
    path: id => `/comm/${encodeURIComponent(id)}` }),
  simple({ coll: 'diary', tag: '다이어리', keys: ['title', 'secId'], title: d => str(d.title),
    path: (_id, d) => secPath('/diary', d.secId) }),
  threadSource,
  // 자캐 — 목록에 뜨는 것(own)만. 주소는 별명(slug)이 있으면 별명
  {
    coll: 'characters', keys: ['name', 'own', 'slug'],
    map: (id, d, created) => {
      const name = str(d.name);
      if (d.own !== true || !name) return [];
      return [{ id: `char:${id}`, title: `[자캐] ${name}`, date: created, created, author: '', secret: false, adult: false,
        path: `/chars/${encodeURIComponent(str(d.slug) || id)}` }];
    },
  },
  simple({ coll: 'relations', tag: '자관', keys: ['name', 'slug'], title: d => str(d.name), idPrefix: 'rel:',
    path: (id, d) => `/rels/${encodeURIComponent(str(d.slug) || id)}` }),
  simple({ coll: 'trpg_chars', tag: 'TRPG 캐릭터', keys: ['name'], title: d => str(d.name),
    path: id => `/tchars/${encodeURIComponent(id)}` }),
  simple({ coll: 'myrooms', tag: '마이룸', keys: ['title', 'date'], title: d => str(d.title), dateKey: 'date',
    path: id => `/myroom/${encodeURIComponent(id)}` }),
];

/** 한 컬렉션에서 「전체공개」 문서를 필요한 칸만 읽는다 (Firestore) */
async function fbDocs(cfg: Extract<Cfg, { kind: 'firebase' }>, origin: string, src: Source): Promise<Doc[]> {
  const db = encodeURIComponent(cfg.databaseId);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${db}/documents:runQuery?key=${encodeURIComponent(cfg.apiKey)}`;
  const r = await fetch(url, {
    method: 'POST',
    // API 키를 「HTTP 리퍼러 제한」으로 묶어 둔 경우를 위해 내 사이트 주소를 리퍼러로 보낸다
    headers: { 'Content-Type': 'application/json', Referer: `${origin}/` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: src.coll }],
        where: { fieldFilter: { field: { fieldPath: 'visibility' }, op: 'EQUAL', value: { stringValue: 'public' } } },
        // 필요한 칸만 (게시판 본문 등은 가져오지 않는다)
        select: { fields: src.keys.map(k => ({ fieldPath: `data.${k}` })) },
        limit: MAX_ROWS,
      },
    }),
    cache: 'no-store', signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Firestore(${src.coll}) 응답 오류 (${r.status}) ${t.slice(0, 160)}`);
  }
  const out = await r.json() as { document?: { name: string; createTime?: string; fields?: Record<string, FsVal> } }[];
  return out.flatMap((x): Doc[] => {
    if (!x.document) return [];
    const data = fsPlain({ mapValue: { fields: x.document.fields?.data?.mapValue?.fields } }) as Plain;
    return [{ id: x.document.name.split('/').pop() ?? '', data: data ?? {}, created: x.document.createTime ?? '' }];
  });
}

/** 같은 일을 Supabase로 */
async function supaDocs(cfg: Extract<Cfg, { kind: 'supabase' }>, src: Source): Promise<Doc[]> {
  const q = `${cfg.url.replace(/\/$/, '')}/rest/v1/${src.coll}?select=id,data,created_at&visibility=eq.public&order=created_at.desc&limit=80`;
  const r = await fetch(q, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (r.status === 404) return [];   // 이 홈에는 없는 종류(옛 버전 등) — 빈 목록으로 본다
  if (!r.ok) throw new Error(`DB(${src.coll}) 응답 오류 (${r.status})`);
  const rows = await r.json() as { id: string; data: Plain | null; created_at: string }[];
  return rows.map(row => ({ id: row.id, data: row.data ?? {}, created: row.created_at }));
}

async function readSource(cfg: NonNullable<Cfg>, origin: string, src: Source): Promise<Row[]> {
  const docs = cfg.kind === 'firebase' ? await fbDocs(cfg, origin, src) : await supaDocs(cfg, src);
  return docs.flatMap(d => src.map(d.id, d.data, d.created));
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const cfg = await loadConfig(origin);
  if (!cfg) return json({ error: '서버 설정(ohome.config.json)을 찾지 못했습니다.' }, 503, noStore);

  // 종류별로 따로 읽는다 — 한 곳이 실패해도 나머지는 담는다
  const results = await Promise.allSettled(SOURCES.map(src => readSource(cfg, origin, src)));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length === results.length) {
    const why = failed[0].reason;
    // 실패 응답은 캐시하지 않는다
    return json({ error: why instanceof Error ? why.message : '알 수 없는 오류' }, 502, noStore);
  }

  const rows = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  const items = rows.flatMap(row => {
    // 글에 적힌 날짜가 날짜로 읽히지 않으면 문서 생성 시각으로 대신한다
    let t = Date.parse(row.date);
    if (!Number.isFinite(t)) t = Date.parse(row.created);
    if (!row.id || !row.title || row.secret || row.adult || !Number.isFinite(t)) return [];
    return [{
      id: row.id,
      title: row.title.slice(0, 140),
      url: `${origin}${row.path}`,
      date_published: new Date(t).toISOString(),
      ...(row.author ? { authors: [{ name: row.author }] } : {}),
    }];
  }).sort((a, b) => b.date_published.localeCompare(a.date_published)).slice(0, MAX_ITEMS);

  // 일부만 실패했으면 캐시하지 않아 다음 요청에 바로 다시 시도한다
  return json({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'O.HOME',
    home_page_url: origin,
    feed_url: `${origin}/feed.json`,
    items,
  }, 200, failed.length ? noStore : {});
}
