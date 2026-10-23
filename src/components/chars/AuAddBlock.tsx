'use client';
// 캐릭터 수정창의 「+ ADD AU CHARACTER」 — 자관과 상관없이 이 캐릭터의 AU를 직접 만든다.
// 만들면 그 AU 전용 작성 화면(/chars/[id]/edit?au=own:…)으로 이동. 자관 AU와의 연결은 그 화면에서 검색해 건다.
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Character, CHAR_SEED, Relation, REL_SEED, ownAuKey } from '@/lib/charStore';
import { newId, useLocalList } from '@/lib/postStore';
import { KInput } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

export function AuAddBlock({ ch }: { ch: Character }) {
  const router = useRouter();
  const toast = useToast();
  const [chars, setChars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const go = (key: string) => router.push(`/chars/${ch.id}/edit?au=${encodeURIComponent(key)}`);

  // 이미 있는 AU — 내가 만든 것 + 내가 멤버인 자관의 AU
  const mine = (ch.ownAus ?? []).map(a => ({ key: ownAuKey(a.id), label: a.label }));
  const fromRels = rels.flatMap(r => r.members.some(m => m.charId === ch.id)
    ? r.aus.filter(a => a.id !== 'base' && !(ch.ownAus ?? []).some(o => o.link === `${r.id}:${a.id}`))
        .map(a => ({ key: `${r.id}:${a.id}`, label: `${r.name} · ${a.label}` }))
    : []);
  const all = [...mine, ...fromRels];

  const add = () => {
    if (!label.trim()) { toast('AU 이름을 입력해 주세요'); return; }
    const id = newId();
    setChars(chars.map(x => (x.id === ch.id ? { ...x, ownAus: [...(x.ownAus ?? []), { id, label: label.trim() }] } : x)));
    go(ownAuKey(id));
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="k-label" style={{ margin: 0 }}>AU</label>
      <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, justifySelf: 'center' }}
        onClick={() => setOpen(o => !o)}>＋ ADD AU CHARACTER</button>
      {open && (
        <div className="panel" style={{ padding: 14, display: 'grid', gap: 8, background: 'transparent' }}>
          <KInput placeholder="새 AU 이름" value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>
            자관이 없어도 만들 수 있어요. 나중에 자관에 같은 AU가 생기면 작성 화면에서 검색해 연결합니다.
            누르면 이동하니, 이 화면에서 고친 내용은 먼저 SAVE 해 두세요.
          </p>
          <button type="button" className="btn btn-dark" style={{ justifySelf: 'end' }} onClick={add}>＋ AU 만들고 작성하기</button>
        </div>
      )}
      {all.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {all.map(a => (
            <button key={a.key} type="button" className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => go(a.key)}>
              ✎ {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
