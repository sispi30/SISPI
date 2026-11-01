'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Notif, NotifType, NOTIF_TYPE_LABEL, notifSettings, setNotifSetting, markRead, markAllRead, clearReadNotifs, removeNotif } from '@/lib/notifStore';
import { KToggle } from '@/components/ui/Kit';
import './NeighborNotificationPanel.css';

type Neighbor = { id: string; name: string; feedUrl: string; subscribedAt: string };
type Entry = { key: string; neighborId: string; neighborName: string; title: string; url: string; date: string };
type Cache = { neighbors: Neighbor[]; entries: Entry[]; read: string[]; hidden: string[] };
const MAX_FEED_ITEMS = 30;
const MAX_NEIGHBORS = 30;
const POLL_MS = 5 * 60 * 1000;   // 새 글 확인 주기
const MIN_GAP_MS = 15 * 1000;    // 자동 확인 최소 간격
const KEY = (userId: string) => `ohome.neighbor.v2:${userId}`;
const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '날짜 미상' : d.toLocaleString('ko-KR'); };
const httpsUrl = (raw: string) => {
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
};
const host = (url: string) => { try { return new URL(url).hostname; } catch { return ''; } };
const bare = (h: string) => h.replace(/^www\./, '');
/** 항목 링크는 피드와 같은 사이트(또는 그 하위 도메인)여야 한다 — 다른 도메인으로 보내는 피싱 방지 */
const sameSite = (itemHost: string, feedHost: string) => {
  const a = bare(itemHost), b = bare(feedHost);
  return !!a && !!b && (a === b || a.endsWith('.' + b));
};
const readCache = (id: string): Cache => {
  try {
    const x = JSON.parse(localStorage.getItem(KEY(id)) || '{}');
    return {
      neighbors: Array.isArray(x.neighbors) ? x.neighbors.filter((n: Neighbor) => !!httpsUrl(n.feedUrl)) : [],
      entries: Array.isArray(x.entries) ? x.entries : [],
      read: Array.isArray(x.read) ? x.read : [],
      hidden: Array.isArray(x.hidden) ? x.hidden : [],
    };
  } catch { return { neighbors: [], entries: [], read: [], hidden: [] }; }
};
const parseFeed = (json: unknown, neighbor: Neighbor): Entry[] => {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { items?: unknown }).items)) throw new Error('items 배열이 없는 JSON Feed입니다.');
  const rows = (json as { items: unknown[] }).items.slice(0, MAX_FEED_ITEMS);
  return rows.flatMap((v): Entry[] => {
    if (!v || typeof v !== 'object') return [];
    const x = v as Record<string, unknown>;
    const url = httpsUrl(String(x.url || ''));
    const title = String(x.title || '').trim().slice(0, 140);
    const date = String(x.date_published || x.createdAt || x.published_at || '');
    if (!url || !sameSite(host(url), host(neighbor.feedUrl)) || !title || !Number.isFinite(Date.parse(date))) return [];
    const key = `${neighbor.id}:${String(x.id || url)}`;
    return [{ key, neighborId: neighbor.id, neighborName: neighbor.name, title, url, date }];
  });
};
const fetchFeed = async (neighbor: Neighbor): Promise<Entry[]> => {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8500);
  try {
    const res = await fetch(neighbor.feedUrl, { signal: ctrl.signal, cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.text();
    if (data.length > 500000) throw new Error('피드 크기가 너무 큽니다.');
    return parseFeed(JSON.parse(data), neighbor);
  } finally { window.clearTimeout(timer); }
};

/** 기존 TopBar 종 내부에 삽입 — 기존 알림은 notifStore가 유일한 읽음 상태 원본이다. */
export function NeighborNotificationPanel({ open, userId, notifications, isAdmin, onClose, onSelfTest, onNeighborUnread, placement }: {
  open: boolean; userId: string; notifications: Notif[]; isAdmin: boolean;
  onClose: () => void; onSelfTest: () => void;
  onNeighborUnread?: (n: number) => void;
  placement?: 'top' | 'dock';   // dock = 데스크톱 작업표시줄 위로 펼침
}) {
  const [tab, setTab] = useState<'all' | 'own' | 'neighbor'>('all');
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);   // 삭제한 이웃 글 — 피드에 계속 있어도 다시 안 뜨게 기억
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [settingsVersion, setSettingsVersion] = useState(0);
  const busyRef = useRef(false);
  const neighborsRef = useRef<Neighbor[]>([]);
  neighborsRef.current = neighbors;
  const lastRef = useRef(0);
  const hiddenRef = useRef<string[]>([]);
  hiddenRef.current = hidden;
  useEffect(() => {
    setReady(false);
    const state = readCache(userId);
    setNeighbors(state.neighbors); setEntries(state.entries); setRead(state.read); setHidden(state.hidden);
    setReady(true);
  }, [userId]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY(userId), JSON.stringify({ neighbors, entries: entries.slice(0, 300), read: read.slice(-1000), hidden: hidden.slice(-2000) })); }
    catch { setNotice('브라우저 저장 용량 또는 권한 때문에 이웃 알림을 저장하지 못했습니다.'); }
  }, [userId, ready, neighbors, entries, read, hidden]);
  const refresh = useCallback(async (list: Neighbor[], quiet = false) => {
    if (!list.length || busyRef.current) return;
    busyRef.current = true; setLoading(true);
    const results = await Promise.allSettled(list.map(fetchFeed));
    let fails = 0;
    const incoming = results.flatMap(r => { if (r.status === 'rejected') { fails++; return []; } return r.value; });
    setEntries(old => {
      const merged = new Map(old.map(e => [e.key, e]));
      for (const x of incoming) {
        // 가져오는 동안 삭제된 이웃은 현재 목록(ref) 기준으로 걸러낸다
        if (hiddenRef.current.includes(x.key)) continue;   // 사용자가 지운 글
        const n = neighborsRef.current.find(z => z.id === x.neighborId);
        // 가입 시각보다 뒤에 등록된 글만 알림으로 수집
        if (n && Date.parse(x.date) > Date.parse(n.subscribedAt)) merged.set(x.key, x);
      }
      return [...merged.values()].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 300);
    });
    if (!quiet || fails) setNotice(fails ? `${fails}곳의 공개 피드를 읽지 못했습니다. JSON Feed/CORS를 확인해 주세요.` : '이웃의 공개 새 글을 확인했습니다.');
    setLoading(false); busyRef.current = false;
  }, []);
  // 이 탭이 열려 있는 동안 5분마다 확인(패널을 닫아 둬도 종 배지에 반영). 탭이 숨겨져 있으면 건너뛰고,
  // 다시 보이거나 창에 돌아오면 바로 확인한다. 너무 잦은 요청을 막기 위해 최소 15초 간격.
  useEffect(() => {
    if (!ready || !neighbors.length) return;
    const tick = () => {
      if (document.hidden || Date.now() - lastRef.current < MIN_GAP_MS) return;
      lastRef.current = Date.now();
      void refresh(neighborsRef.current, true);
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', tick); };
  }, [ready, neighbors, refresh]);
  // 패널을 열 때도 한 번 확인
  useEffect(() => { if (open && ready) void refresh(neighborsRef.current, true); }, [open, ready, refresh]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const feedUrl = httpsUrl(url.trim());
    const label = name.trim().slice(0, 40);
    if (!label || !feedUrl) { setNotice('이웃 이름과 HTTPS JSON Feed 주소를 입력해 주세요.'); return; }
    if (neighbors.length >= MAX_NEIGHBORS) { setNotice('이웃은 최대 30곳까지 등록할 수 있습니다.'); return; }
    if (neighbors.some(n => n.feedUrl === feedUrl)) { setNotice('이미 등록된 피드입니다.'); return; }
    const n: Neighbor = { id: `n-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: label, feedUrl, subscribedAt: new Date().toISOString() };
    setLoading(true);
    try {
      await fetchFeed(n); // 실제 주소가 유효해야 등록. 기존 글은 등록하지 않음.
      setNeighbors(p => [...p, n]); setName(''); setUrl('');
      setNotice('구독했습니다. 기존 게시글은 알림으로 표시되지 않습니다.');
    } catch (err) { setNotice(`피드를 확인할 수 없습니다: ${err instanceof Error ? err.message : '접속 오류'} (CORS 허용 여부 확인)`); }
    finally { setLoading(false); }
  };
  const ownUnread = notifications.filter(n => !n.read).length;
  const otherUnread = entries.filter(e => !read.includes(e.key)).length;
  const counts = ownUnread + otherUnread;
  useEffect(() => { onNeighborUnread?.(otherUnread); }, [otherUnread, onNeighborUnread]);
  const mySettings = notifSettings(userId);
  void settingsVersion;
  const merged = [
    ...(tab!=='neighbor' ? notifications.map(n => ({ kind: 'own' as const, n, t: n.date })) : []),
    ...(tab!=='own' ? entries.map(e => ({ kind: 'nb' as const, e, t: e.date })) : []),
  ].sort((a, b) => (Date.parse(b.t) || 0) - (Date.parse(a.t) || 0)) as Array<{ kind: 'own'; n: Notif; t: string } | { kind: 'nb'; e: Entry; t: string }>;
  // 링크는 진짜 <a target="_blank">로 연다 — window.open은 팝업 차단·미리보기 창에서 조용히 막힐 수 있다.
  const ownHref = (n: Notif) => {
    try { const u = new URL(n.href, window.location.origin); return /^https?:$/.test(u.protocol) ? u.href : '#'; } catch { return '#'; }
  };
  const delEntry = (key: string) => {
    setHidden(p => p.includes(key) ? p : [...p, key]);
    setEntries(p => p.filter(x => x.key !== key));
    setRead(p => p.filter(k => k !== key));
  };
  const clearRead = () => {
    const keys = entries.filter(e => read.includes(e.key)).map(e => e.key);
    const ownRead = notifications.filter(n => n.read).length;
    setHidden(p => [...p, ...keys.filter(k => !p.includes(k))]);
    setEntries(p => p.filter(e => !keys.includes(e.key)));
    setRead(p => p.filter(k => !keys.includes(k)));
    clearReadNotifs(userId);
    setNotice(keys.length + ownRead ? `읽은 알림 ${keys.length + ownRead}개를 삭제했습니다.` : '삭제할 읽은 알림이 없습니다.');
  };
  const markEntryRead = (key: string) => setRead(p => p.includes(key) ? p : [...p, key]);
  // 안내 문구는 잠시 뒤 저절로 사라진다 (실패 안내는 읽을 시간을 더 준다)
  useEffect(() => {
    if (!notice) return;
    const fail = /못했|없습니다|확인할 수|저장하지|입력해|이미|최대/.test(notice) && !/삭제할 읽은/.test(notice);
    const t = window.setTimeout(() => setNotice(''), fail ? 7000 : 3000);
    return () => window.clearTimeout(t);
  }, [notice]);
  return <div className={`oh-center-panel user-menu ${placement === 'dock' ? 'dock' : ''} ${open ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
    <div className="oh-center-head"><strong>NOTIFICATION CENTER</strong><span>{counts} UNREAD</span><button onClick={onClose} aria-label="알림창 닫기">×</button></div>
    <div className="oh-center-tabs">{([['all','전체'],['own','내 홈'],['neighbor','이웃']] as const).map(([id,label]) => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
    <div className="oh-center-actions"><button onClick={()=>{ markAllRead(userId);setRead(entries.map(x=>x.key)); }}>모두 읽음</button><button onClick={clearRead}>읽은 알림 삭제</button><button onClick={()=>setEditing(v=>!v)}>{editing?'알림 목록':'이웃 관리'}</button></div>
    {editing ? <div className="oh-center-manage"><p>이웃 홈페이지의 공개 HTTPS JSON Feed 주소를 입력해 주세요. 일반 홈페이지 주소만으로는 구독할 수 없습니다.</p>
      <form onSubmit={add}><input aria-label="이웃 이름" placeholder="이웃 이름" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><input aria-label="JSON 피드 주소" placeholder="https://example.com/feed.json" value={url} onChange={e=>setUrl(e.target.value)}/><button type="submit" disabled={loading}>구독 추가</button></form>
      {neighbors.map(n=><div className="oh-center-neighbor" key={n.id}><span><b>{n.name}</b><small>{host(n.feedUrl)}</small></span><button onClick={()=>{setNeighbors(p=>p.filter(x=>x.id!==n.id));setEntries(p=>p.filter(x=>x.neighborId!==n.id));setRead(p=>p.filter(k=>!k.startsWith(`${n.id}:`)));setHidden(p=>p.filter(k=>!k.startsWith(`${n.id}:`)));}}>삭제</button></div>)}
    </div> : <div className="oh-center-list">
      {merged.map(row => row.kind==='own'
        ? <div className="oh-center-row" key={`o-${row.n.id}`}><a className={`oh-center-item ${row.n.read?'is-read':''}`} href={ownHref(row.n)} target="_blank" rel="noopener noreferrer" onClick={()=>markRead(row.n.id)}><strong>{row.n.title}</strong><small>{row.n.body||NOTIF_TYPE_LABEL[row.n.type]}</small><time>{fmt(row.n.date)} · 내 홈페이지(새 탭)</time></a><button className="oh-center-del" title="삭제" aria-label="알림 삭제" onClick={()=>removeNotif(row.n.id)}>×</button></div>
        : <div className="oh-center-row" key={`n-${row.e.key}`}><a className={`oh-center-item ${read.includes(row.e.key)?'is-read':''}`} href={row.e.url} target="_blank" rel="noopener noreferrer" onClick={()=>markEntryRead(row.e.key)}><strong>{row.e.title}</strong><small>{row.e.neighborName} · {host(row.e.url)}</small><time>{fmt(row.e.date)} · 외부 사이트(새 탭)</time></a><button className="oh-center-del" title="삭제" aria-label="알림 삭제" onClick={()=>delEntry(row.e.key)}>×</button></div>)}
      {!merged.length&&<p className="oh-center-empty">표시할 알림이 없습니다.</p>}
    </div>}
    {tab!=='neighbor' && <details className="oh-center-settings"><summary>내 홈 알림 설정</summary>{(Object.keys(NOTIF_TYPE_LABEL) as NotifType[]).filter(k=>k!=='guest'||isAdmin).map(k=><label key={k}>{NOTIF_TYPE_LABEL[k]}<KToggle checked={mySettings[k]} onChange={value=>{setNotifSetting(userId,k,value);setSettingsVersion(v=>v+1);}} /></label>)}<button onClick={onSelfTest}>내 홈 알림 전달 확인</button></details>}
    {notice&&<p className="oh-center-notice" role="status">{notice}</p>}
    <div className="oh-center-foot"><span>이웃: 공개 새 글만 지원</span><button disabled={loading||!neighbors.length} onClick={()=>void refresh(neighbors)}>{loading?'확인 중…':'↻ 새 글 확인'}</button></div>
  </div>;
}
