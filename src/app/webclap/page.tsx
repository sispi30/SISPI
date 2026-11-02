'use client';
// 웹박수 (원본: PHP 「Web Clap」 스킨 v2.1) — 익명 박수 & 메시지. 관리자는 답글·삭제·설정·랜덤 이미지를 다룬다.
// 방문자가 남긴 박수·메시지는 나만보기로 저장되어 관리자만 읽는다 (lib/webclapStore.ts 참조).
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import {
  WcEntry, WcConfig, WcEvent, WC_KEY, useWcConfig, clapsToday, bumpClaps, msgAllowed,
} from '@/lib/webclapStore';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { FileDrop } from '@/components/ui/FileDrop';
import { useToast } from '@/components/ui/Toast';
import { useConfirmDelete } from '@/components/ui/Modal';
import { PageTitle } from '@/components/ui/PageText';
import { notifyAdmins } from '@/lib/notifStore';

const PER_PAGE = 20;
const fmt = (iso: string, withYear = true) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${withYear ? `${d.getFullYear()}.` : ''}${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function WcImg({ fileRef, className }: { fileRef: string; className?: string }) {
  const url = useBlobUrl(fileRef);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} loading="lazy" /> : null;
}

export default function WebclapPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const del = useConfirmDelete();
  const [entries, setEntries, entLoaded] = useLocalList<WcEntry>(WC_KEY, []);
  const [cfg, saveCfg, cfgLoaded] = useWcConfig();
  const [content, setContent] = useState('');
  const [secret, setSecret] = useState(false);
  const [shake, setShake] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [page, setPage] = useState(1);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [pick, setPick] = useState(0);   // 랜덤 이미지 순번 — 열 때마다 새로 뽑는다

  useEffect(() => { setPick(Math.random()); }, []);
  const image = cfg.images.length ? cfg.images[Math.floor(pick * cfg.images.length) % cfg.images.length] : null;

  const parents = useMemo(() => entries.filter(e => e.type !== 'reply').sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  const repliesOf = (id: string) => entries.filter(e => e.type === 'reply' && e.parentId === id).sort((a, b) => a.date.localeCompare(b.date));
  // 방문자에게는 서버가 공개로 바뀐 것만 내준다 — 전체 수는 관리자가 페이지를 열 때 갱신해 둔 값
  const total = isAdmin ? parents.length : cfg.total ?? 0;
  const event = cfg.events.find(ev => ev.number === total && total > 0);

  // 관리자가 열어 둔 동안 전체 수를 설정에 맞춰 둔다 (방문자에게 보여 줄 숫자)
  useEffect(() => {
    if (!isAdmin || !cfgLoaded || !entLoaded) return;   // 목록을 다 받기 전의 0으로 덮어쓰지 않게
    if (cfg.total !== parents.length) saveCfg({ ...cfg, total: parents.length });
  }, [isAdmin, cfgLoaded, entLoaded, parents.length, cfg, saveCfg]);

  const add = (e: WcEntry) => setEntries([...entries, e]);   // 뒤에 붙인다 (방명록과 같은 이유 — 순번이 밀리지 않게)

  const clap = () => {
    if (!isAdmin && cfg.clapLimit > 0 && clapsToday() >= cfg.clapLimit) {
      toast(`하루에 ${cfg.clapLimit}번까지 박수를 보낼 수 있어요.`);
      return;
    }
    add({ id: newId(), type: 'clap', content: '', secret: false, date: new Date().toISOString(), visibility: 'private' });
    if (!isAdmin) bumpClaps();
    setContent(''); setSecret(false);
    toast('박수 감사합니다! 👏');
  };

  const message = () => {
    const text = content.trim();
    if (!text) {
      setShake(true); setTimeout(() => setShake(false), 400);
      return;
    }
    if (!isAdmin && !msgAllowed()) { toast('잠시 후 다시 시도해주세요.'); return; }
    add({ id: newId(), type: 'message', content: text.slice(0, 500), secret, date: new Date().toISOString(), visibility: 'private' });
    setContent(''); setSecret(false);
    toast('메시지가 전달되었어요! 💬');
    notifyAdmins({ type: 'guest', href: '/webclap', title: '웹박수에 새 메시지가 도착했습니다', body: secret ? '비밀글' : clip(text, 50) });
  };

  const reply = (p: WcEntry) => {
    const text = (replyText[p.id] ?? '').trim();
    if (!text) return;
    const r: WcEntry = { id: newId(), type: 'reply', content: text.slice(0, 2000), secret: false, date: new Date().toISOString(), parentId: p.id, visibility: 'public' };
    // 비밀글이 아니면 원 메시지도 공개로 바꿔 방문자에게 「질문 → 답변」으로 보이게 한다
    setEntries([...entries.map(x => (x.id === p.id && !p.secret ? { ...x, visibility: 'public' as const } : x)), r]);
    setReplyText(t => ({ ...t, [p.id]: '' }));
    toast('답변이 등록되었어요.');
  };

  const remove = (e: WcEntry) => {
    const gone = new Set<string>([e.id]);
    if (e.type !== 'reply') entries.filter(x => x.parentId === e.id).forEach(x => gone.add(x.id));
    let next = entries.filter(x => !gone.has(x.id));
    // 마지막 답글을 지우면 원 메시지는 다시 나만보기로
    if (e.type === 'reply' && e.parentId && !next.some(x => x.type === 'reply' && x.parentId === e.parentId)) {
      next = next.map(x => (x.id === e.parentId ? { ...x, visibility: 'private' as const } : x));
    }
    setEntries(next);
    toast('삭제되었어요.');
  };

  /* ── 설정 (관리자) ── */
  const [draft, setDraft] = useState<WcConfig>(cfg);
  const openAdmin = () => { setDraft(cfg); setAdminMode(true); };
  const saveDraft = () => {
    saveCfg({ ...cfg, notice: draft.notice, clapLimit: Math.max(0, Math.floor(Number(draft.clapLimit) || 0)),
      events: draft.events.filter(ev => ev.number > 0 && ev.message.trim()) });
    toast('설정이 저장되었어요.');
  };
  const upload = async (files: File[]) => {
    const ok = files.filter(f => /^image\//.test(f.type) && f.size <= 5 * 1024 * 1024);
    if (ok.length !== files.length) toast('이미지만, 5MB 이하만 올릴 수 있어요.');
    const refs: string[] = [];
    for (const f of ok) { try { refs.push(await putBlob(f)); } catch { toast('업로드하지 못했습니다'); } }
    if (refs.length) { saveCfg({ ...cfg, images: [...cfg.images, ...refs] }); toast('이미지가 업로드되었어요.'); }
  };

  if (!cfgLoaded) return <section className="page" />;

  /* ════ 관리자 설정 화면 ════ */
  if (isAdmin && adminMode) {
    const setEv = (i: number, p: Partial<WcEvent>) => setDraft(d => ({ ...d, events: d.events.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
    return (
      <section className="page">
        <div className="wc-admin-page">
          <div className="wc-admin-top">
            <h2 className="wc-admin-title">⚙️ 웹박수 설정</h2>
            <button className="wc-btn wc-btn-back" onClick={() => setAdminMode(false)}>← 돌아가기</button>
          </div>

          <section className="wc-admin-card">
            <h3>📝 공지 텍스트</h3>
            <p className="wc-admin-desc">방문자에게 보여줄 안내 메시지.</p>
            <textarea className="wc-admin-textarea" rows={4} value={draft.notice} onChange={e => setDraft({ ...draft, notice: e.target.value })} />
          </section>

          <section className="wc-admin-card">
            <h3>🔧 옵션</h3>
            <div className="wc-admin-field">
              <label>하루 박수 제한 (0 = 무제한 · 방문자 브라우저 기준)</label>
              <input type="number" min={0} className="wc-admin-input" value={draft.clapLimit}
                onChange={e => setDraft({ ...draft, clapLimit: Number(e.target.value) })} />
            </div>
          </section>

          <section className="wc-admin-card">
            <h3>🎉 N번째 박수 이벤트</h3>
            <p className="wc-admin-desc">현재 총 <strong>{parents.length.toLocaleString()}</strong>개.</p>
            {draft.events.map((ev, i) => (
              <div className="wc-event-row" key={i}>
                <input type="number" min={1} className="wc-admin-input wc-event-num" placeholder="번째" value={ev.number || ''}
                  onChange={e => setEv(i, { number: Number(e.target.value) })} />
                <input type="text" className="wc-event-msg-input" placeholder="축하 메시지" value={ev.message}
                  onChange={e => setEv(i, { message: e.target.value })} />
                <button type="button" className="wc-event-remove" onClick={() => setDraft(d => ({ ...d, events: d.events.filter((_, j) => j !== i) }))}>×</button>
              </div>
            ))}
            <button type="button" className="wc-btn-small" onClick={() => setDraft(d => ({ ...d, events: [...d.events, { number: 0, message: '' }] }))}>+ 이벤트 추가</button>
          </section>

          <button type="button" className="wc-btn wc-btn-clap wc-btn-full" onClick={saveDraft}>설정 저장</button>

          <section className="wc-admin-card" style={{ marginTop: 16 }}>
            <h3>🖼 랜덤 이미지</h3>
            <p className="wc-admin-desc">업로드한 이미지 중 매번 랜덤으로 1개가 표시됩니다. (이미지 · 최대 5MB)</p>
            <FileDrop accept="image/*" multiple label="이미지를 끌어다 놓거나 클릭" onFiles={f => { void upload(f); }} />
            <div className="wc-image-grid" style={{ marginTop: 12 }}>
              {cfg.images.length === 0 && <div className="wc-empty">등록된 이미지가 없습니다.</div>}
              {cfg.images.map(ref => (
                <div className="wc-image-card" key={ref}>
                  <div className="wc-image-thumb"><WcImg fileRef={ref} /></div>
                  <button type="button" className="wc-img-delete"
                    onClick={() => del.ask('이미지를 삭제할까요?', () => saveCfg({ ...cfg, images: cfg.images.filter(x => x !== ref) }), '목록에서 빠집니다.')}>×</button>
                </div>
              ))}
            </div>
          </section>
        </div>
        {del.element}
      </section>
    );
  }

  /* ════ 방문자 / 관리자 메인 화면 ════ */
  const pages = Math.max(1, Math.ceil(parents.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const shown = parents.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const answered = parents.filter(p => p.type === 'message' && p.visibility === 'public' && !p.secret && repliesOf(p.id).length > 0);

  return (
    <section className="page wc-page">
      <div className="wc-container">
        {isAdmin && <button type="button" className="wc-settings-link" onClick={openAdmin}>⚙️ 설정</button>}

        {image && <div className="wc-image"><WcImg fileRef={image} /></div>}

        <div className="wc-title"><PageTitle>웹박수</PageTitle></div>

        {cfg.notice && <div className="wc-notice"><p style={{ whiteSpace: 'pre-line' }}>{cfg.notice}</p></div>}
        {event && <div className="wc-event-banner">🎉 {event.message}</div>}

        <div className="wc-form-area">
          <form className="wc-form" onSubmit={e => e.preventDefault()}>
            <textarea className={`wc-textarea ${shake ? 'wc-shake' : ''}`} placeholder="메시지를 남겨주세요 (선택)" maxLength={500} rows={3}
              value={content} onChange={e => setContent(e.target.value)} />
            <div className="wc-form-footer">
              <label className="wc-secret-label">
                <input type="checkbox" className="wc-checkbox" checked={secret} onChange={e => setSecret(e.target.checked)} />
                <span>비밀글</span>
              </label>
              <span className="wc-char-count">{content.length} / 500</span>
            </div>
            <div className="wc-buttons">
              <button type="button" className="wc-btn wc-btn-clap" onClick={clap}>👏 박수</button>
              <button type="button" className="wc-btn wc-btn-msg" onClick={message}>💬 메시지</button>
            </div>
          </form>
        </div>

        <div className="wc-counter">전체 : {total.toLocaleString()}</div>

        {/* 관리자: 받은 메시지 */}
        {isAdmin && shown.length > 0 && (
          <div className="wc-admin-section">
            <div className="wc-admin-label">📋 받은 메시지</div>
            <div className="wc-msg-list">
              {shown.map(e => (
                <div className="wc-msg-entry" key={e.id}>
                  <div className="wc-msg-head">
                    <span className="wc-msg-type">{e.type === 'clap' ? '👏' : '💬'}</span>
                    <span className="wc-msg-date">{fmt(e.date)}</span>
                    {e.secret && <span className="wc-msg-secret">🔒</span>}
                    <button type="button" className="wc-msg-del" style={{ marginLeft: 'auto' }}
                      onClick={() => del.ask('삭제할까요?', () => remove(e), '딸린 답글도 함께 지워집니다.')}>×</button>
                  </div>
                  {e.type === 'message' && e.content
                    ? <div className="wc-msg-body">{e.content}</div>
                    : <div className="wc-msg-body wc-msg-clap-only">박수!</div>}
                  {repliesOf(e.id).map(r => (
                    <div className="wc-reply" key={r.id}>
                      <span className="wc-reply-arrow">↳</span>
                      <div className="wc-reply-body">{r.content}</div>
                      <span className="wc-reply-date">{fmt(r.date, false)}</span>
                      <button type="button" className="wc-msg-del" onClick={() => del.ask('답글을 삭제할까요?', () => remove(r))}>×</button>
                    </div>
                  ))}
                  {e.type === 'message' && (
                    <form className="wc-reply-form" onSubmit={ev => { ev.preventDefault(); reply(e); }}>
                      <input type="text" className="wc-reply-input" placeholder="답변 남기기" maxLength={2000}
                        value={replyText[e.id] ?? ''} onChange={ev => setReplyText(t => ({ ...t, [e.id]: ev.target.value }))} />
                      <button type="submit" className="wc-reply-btn">답글</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {pages > 1 && (
              <div className="wc-pager">
                <button disabled={cur <= 1} onClick={() => setPage(cur - 1)}>← 이전</button>
                <span>{cur} / {pages}</span>
                <button disabled={cur >= pages} onClick={() => setPage(cur + 1)}>다음 →</button>
              </div>
            )}
          </div>
        )}

        {/* 방문자: 답변 달린 메시지 공개 */}
        {!isAdmin && answered.length > 0 && (
          <div className="wc-public-messages">
            {answered.map(p => (
              <div className="wc-public-msg" key={p.id}>
                <div className="wc-public-msg-q">{clip(p.content, 40)}</div>
                <div className="wc-public-msg-a">↳ {clip(repliesOf(p.id)[0].content, 60)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {del.element}
    </section>
  );
}
