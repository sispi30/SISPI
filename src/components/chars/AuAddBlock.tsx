'use client';
// 캐릭터 수정창의 「+ ADD AU CHARACTER」 — 이 캐릭터가 멤버로 있는 자관에 AU를 만들고(또는 이미 있는 AU를 골라)
// 그 AU 전용 캐릭터 프로필 작성 화면(/chars/[id]/edit?au=…)으로 바로 이동한다.
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Character, Relation, REL_SEED, RelAu } from '@/lib/charStore';
import { newId, useLocalList } from '@/lib/postStore';
import { KInput } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

const NEW = '__new__';

export function AuAddBlock({ ch }: { ch: Character }) {
  const router = useRouter();
  const toast = useToast();
  const [rels, setRels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [open, setOpen] = useState(false);
  const [relId, setRelId] = useState('');
  const [pick, setPick] = useState(NEW);
  const [label, setLabel] = useState('');

  // 이 캐릭터가 멤버인 자관만 — 상세에서 AU 리스트가 이 자관들의 AU로 만들어지기 때문
  const mine = useMemo(() => rels.filter(r => r.members.some(m => m.charId === ch.id)), [rels, ch.id]);
  const rel = mine.find(r => r.id === relId) ?? mine[0];
  const aus = (rel?.aus ?? []).filter(a => a.id !== 'base');
  const keyOf = (r: Relation, a: RelAu) => `${r.id}:${a.id}`;
  const go = (key: string) => router.push(`/chars/${ch.id}/edit?au=${encodeURIComponent(key)}`);

  const add = () => {
    if (!rel) return;
    if (pick !== NEW) { go(keyOf(rel, aus.find(a => a.id === pick)!)); return; }
    if (!label.trim()) { toast('AU 이름을 입력해 주세요'); return; }
    const na: RelAu = { id: newId(), label: label.trim(), catchphrase: '', cp: rel.cp ?? 'ncp', timeline: [], questions: [] };
    setRels(rels.map(r => (r.id === rel.id ? { ...r, aus: [...r.aus, na] } : r)));
    go(`${rel.id}:${na.id}`);
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="k-label" style={{ margin: 0 }}>AU</label>
      <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, justifySelf: 'center' }}
        onClick={() => setOpen(o => !o)}>＋ ADD AU CHARACTER</button>
      {open && (
        mine.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--faint)', margin: 0, textAlign: 'center' }}>
            AU는 자관에 속해 있어요. 먼저 자관에 이 캐릭터를 멤버로 넣어 주세요.
          </p>
        ) : (
          <div className="panel" style={{ padding: 14, display: 'grid', gap: 8, background: 'transparent' }}>
            <select className="k-input" value={rel?.id} onChange={e => { setRelId(e.target.value); setPick(NEW); }}>
              {mine.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="k-input" value={pick} onChange={e => setPick(e.target.value)}>
              <option value={NEW}>＋ 새 AU 만들기</option>
              {aus.map(a => {
                const done = !!ch.auProfiles?.[keyOf(rel!, a)];
                return <option key={a.id} value={a.id}>{a.label}{done ? ' (작성됨 — 수정)' : ''}</option>;
              })}
            </select>
            {pick === NEW && <KInput placeholder="새 AU 이름" value={label} onChange={e => setLabel(e.target.value)} />}
            <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>
              누르면 그 AU 전용 작성 화면으로 이동합니다. 지금 이 화면에서 고친 내용은 먼저 SAVE 해 두세요.
            </p>
            <button type="button" className="btn btn-dark" style={{ justifySelf: 'end' }} onClick={add}>
              {pick === NEW ? '＋ AU 만들고 작성하기' : '작성 화면으로'}
            </button>
          </div>
        )
      )}
    </div>
  );
}
