'use client';
// 플레이기록·세션 게시판 공용 입력 — 참여 캐릭터 검색 선택 / 연동 자관 여러 개 검색 선택
import React, { useState } from 'react';
import { Character, CHAR_SEED, Relation, REL_SEED } from '@/lib/charStore';
import { useLocalList } from '@/lib/postStore';
import { KInput } from '@/components/ui/Kit';
import { repRel } from '@/lib/galleryStore';

/** 참여 캐릭터 — 검색창 + 스크롤 목록, 누르면 선택/해제 (플레이기록 게시판과 같은 방식) */
export function CharPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [q, setQ] = useState('');
  return (
    <div>
      <label className="k-label" style={{ marginBottom: 5 }}>
        참여 캐릭터 (optional) <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— {ids.length}명 선택</span>
      </label>
      <KInput placeholder="캐릭터 검색" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 6 }} />
      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 9 }}>
        {chars
          .filter(c => { const s = q.trim().toLowerCase(); return !s || c.name.toLowerCase().includes(s) || c.sub.toLowerCase().includes(s); })
          .map(c => (
            <div key={c.id} onClick={() => onChange(ids.includes(c.id) ? ids.filter(x => x !== c.id) : [...ids, c.id])}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', cursor: 'var(--cur-pointer,pointer)',
                fontSize: 12.5, borderBottom: '1px dashed var(--line)',
                background: ids.includes(c.id) ? 'rgba(127,127,127,.12)' : undefined,
              }}>
              <i style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <b>{c.name}</b> <small style={{ color: 'var(--faint)' }}>{c.sub}</small>
              {ids.includes(c.id) && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
            </div>
          ))}
        {chars.length === 0 && <p className="hint" style={{ padding: 10 }}>등록된 캐릭터가 없습니다</p>}
      </div>
    </div>
  );
}

/** 연동 자관 — 여러 개를 이름 검색으로 추가. 2인 자관이 있으면 그것이 대표로 보인다 */
export function RelMultiPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [q, setQ] = useState('');
  const rep = repRel(ids, rels);
  const s = q.trim().toLowerCase();
  const found = s ? rels.filter(r => !ids.includes(r.id) && r.name.toLowerCase().includes(s)) : [];
  return (
    <div>
      <label className="k-label" style={{ marginBottom: 5 }}>
        자관 연동 (optional) <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 여러 개 가능{ids.length > 1 && rep ? ` · 대표: ${rep.name}` : ''}</span>
      </label>
      {ids.map(id => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', border: '1.5px solid var(--accent)', borderRadius: 8, marginBottom: 6, fontSize: 12.5 }}>
          <b>{rels.find(r => r.id === id)?.name ?? '(찾을 수 없음)'}</b>
          {ids.length > 1 && rep?.id === id && <span className="pill dark">대표</span>}
          <span style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 11, cursor: 'var(--cur-pointer,pointer)' }}
            onClick={() => onChange(ids.filter(x => x !== id))}>연동 해제 ✕</span>
        </div>
      ))}
      <KInput placeholder="자관 이름 검색" value={q} onChange={e => setQ(e.target.value)} />
      {s && (
        <div style={{ marginTop: 6, maxHeight: 150, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 9 }}>
          {found.map(r => (
            <div key={r.id} onClick={() => { onChange([...ids, r.id]); setQ(''); }}
              style={{ padding: '7px 11px', cursor: 'var(--cur-pointer,pointer)', fontSize: 12.5, borderBottom: '1px dashed var(--line)' }}>
              <b>{r.name}</b> {r.members.length === 2 && <small style={{ color: 'var(--faint)' }}>2인</small>} {r.catchphrase && <small style={{ color: 'var(--faint)' }}>{r.catchphrase}</small>}
            </div>
          ))}
          {found.length === 0 && <p className="hint" style={{ padding: 8, margin: 0 }}>검색 결과가 없습니다</p>}
        </div>
      )}
    </div>
  );
}
