'use client';
// 내가 만든 AU ↔ 자관 AU 연결 — 자관에 같은 AU가 생기면 이름으로 검색해 연결한다.
// 연결하면 자관 화면에서도 이 AU의 프로필이 쓰인다.
import React, { useMemo, useState } from 'react';
import { Character, Relation, ownAuKey } from '@/lib/charStore';
import { KInput } from '@/components/ui/Kit';

export function AuLinkBox({ ch, auKey, rels, chars, onChange }: {
  ch: Character; auKey: string; rels: Relation[]; chars: Character[];
  onChange: (link: string | undefined) => void;
}) {
  const [q, setQ] = useState('');
  const mine = ch.ownAus?.find(a => ownAuKey(a.id) === auKey);
  // 이미 다른 내 AU에 연결된 자관 AU는 제외
  const taken = new Set((ch.ownAus ?? []).filter(a => ownAuKey(a.id) !== auKey).map(a => a.link).filter(Boolean));
  const all = useMemo(() => rels.flatMap(r => r.aus.filter(a => a.id !== 'base').map(a => ({
    key: `${r.id}:${a.id}`, label: a.label, rel: r.name,
  }))), [rels]);
  const cur = all.find(a => a.key === mine?.link);
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? all.filter(a => !taken.has(a.key) && `${a.rel} ${a.label}`.toLowerCase().includes(needle)).slice(0, 8)
    : [];
  void chars;
  return (
    <div className="panel" style={{ padding: 14, display: 'grid', gap: 8, marginBottom: 14, maxWidth: 1180 }}>
      <label className="k-label" style={{ margin: 0 }}>자관 AU 연결 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 선택</span></label>
      {mine?.link ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill dark">{cur ? `${cur.rel} · ${cur.label}` : '연결된 자관 AU'}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => onChange(undefined)}>연결 해제</button>
        </div>
      ) : (
        <>
          <KInput placeholder="자관 이름 또는 AU 이름으로 검색" value={q} onChange={e => setQ(e.target.value)} />
          {needle && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hits.length === 0 && <span style={{ fontSize: 12, color: 'var(--faint)' }}>검색 결과가 없어요</span>}
              {hits.map(a => (
                <button key={a.key} type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }}
                  onClick={() => { onChange(a.key); setQ(''); }}>＋ {a.rel} · {a.label}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
