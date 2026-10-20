'use client';
// 페어 옷장 편집창 (관리자) — 페어 관리·옷 올리기·캐릭터 그림·대사·디자인을 한곳에서
import React, { useEffect, useRef, useState } from 'react';
import { putBlob, useUploading } from '@/lib/blobStore';
import { newId } from '@/lib/postStore';
import {
  CLOSET_TABS, DIALOGUE_FIELDS, itemsForPair, newPair, pairTitle,
  type ClosetChar, type ClosetData, type ClosetItem, type ClosetPair,
} from '@/lib/closetStore';
import { Modal, useConfirmDelete } from '@/components/ui/Modal';
import { FileDrop } from '@/components/ui/FileDrop';
import { KCheck, KInput, KLabel, KSelect, KStep, KTextarea } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { useUrlMap } from './ClosetStage';

type Sec = 'pairs' | 'items' | 'chars' | 'dialogue' | 'design';
const SECS: { key: Sec; label: string }[] = [
  { key: 'pairs', label: '페어' }, { key: 'items', label: '옷' }, { key: 'chars', label: '캐릭터' },
  { key: 'dialogue', label: '대사' }, { key: 'design', label: '디자인' },
];
const tabOpts = CLOSET_TABS.map(t => ({ value: t.key, label: t.label }));
const zOf = (tab: string) => CLOSET_TABS.find(t => t.key === tab)?.zi ?? 20;
const stem = (f: string) => f.replace(/\.[^.]+$/, '');
const SHARED = '__shared';   // 선택칸에서 「공용」을 나타내는 값

/** 파일 하나 고르는 버튼 */
function PickBtn({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
        onClick={() => ref.current?.click()}>{label}</button>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </>
  );
}

export function ClosetAdmin({ open, data, pairId, onSave, onClose }: {
  open: boolean; data: ClosetData; pairId: string; onSave: (d: ClosetData) => void; onClose: () => void;
}) {
  const toast = useToast();
  const del = useConfirmDelete();
  const uploading = useUploading();
  const [d, setD] = useState<ClosetData>(data);
  const [pi, setPi] = useState(pairId);              // 지금 고치는 페어
  const [sec, setSec] = useState<Sec>('items');
  const [upTab, setUpTab] = useState('top');
  const [upPair, setUpPair] = useState(SHARED);      // 올리는 옷의 대상 (공용 / 특정 페어)
  const [urls, setUrls] = useState('');
  const resolve = useUrlMap([...d.items.map(i => i.src), ...d.pairs.flatMap(p => p.chars.flatMap(c => c.bodies))]);

  // 열릴 때마다 저장된 값에서 새로 시작 — 보고 있던 페어부터
  useEffect(() => {
    if (open) { setD(data); setPi(pairId); setUpPair(SHARED); setSec('items'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cur: ClosetPair = d.pairs.find(p => p.id === pi) ?? d.pairs[0];
  const pairOpts = d.pairs.map(p => ({ value: p.id, label: p.name }));
  const targetOpts = [{ value: SHARED, label: '공용 (모든 페어)' }, ...d.pairs.map(p => ({ value: p.id, label: `${p.name} 전용` }))];

  const patchPair = (id: string, p: Partial<ClosetPair>) =>
    setD(x => ({ ...x, pairs: x.pairs.map(q => q.id === id ? { ...q, ...p } : q) }));
  const setItem = (id: string, p: Partial<ClosetItem>) =>
    setD(x => ({ ...x, items: x.items.map(i => i.id === id ? { ...i, ...p } : i) }));
  const setChar = (n: 0 | 1, p: Partial<ClosetChar>) =>
    patchPair(cur.id, { chars: cur.chars.map((c, i) => i === n ? { ...c, ...p } : c) as ClosetPair['chars'] });
  const setDlg = (n: 0 | 1, key: string, v: string) =>
    patchPair(cur.id, { dialogue: cur.dialogue.map((m, i) => i === n ? { ...m, [key]: v } : m) as ClosetPair['dialogue'] });

  const upload = async (file: File): Promise<string | null> => {
    try { return await putBlob(file); } catch (e) {
      toast(`업로드 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
      return null;
    }
  };

  const mkItem = (src: string, name: string): ClosetItem =>
    ({ id: newId(), src, tab: upTab, name, zi: zOf(upTab), ...(upPair !== SHARED ? { pair: upPair } : {}) });

  const addFiles = async (files: File[]) => {
    const added: ClosetItem[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const src = await upload(f);
      if (src) added.push(mkItem(src, stem(f.name)));
    }
    if (added.length) { setD(x => ({ ...x, items: [...x.items, ...added] })); toast(`${added.length}개 추가했습니다`); }
  };

  const addUrls = () => {
    const added = urls.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const [src, ...rest] = l.split('|');
      return mkItem(src.trim(), rest.join('|').trim() || 'item');
    }).filter(i => /^https?:\/\//.test(i.src));
    if (!added.length) { toast('http(s):// 로 시작하는 주소를 한 줄에 하나씩 적어 주세요'); return; }
    setD(x => ({ ...x, items: [...x.items, ...added] }));
    setUrls('');
    toast(`${added.length}개 추가했습니다`);
  };

  const removeItem = (id: string) => setD(x => ({
    ...x,
    items: x.items.filter(i => i.id !== id),
    pairs: x.pairs.map(p => ({
      ...p, chars: p.chars.map(c => ({ ...c, outfit: c.outfit.filter(o => o !== id) })) as ClosetPair['chars'],
    })),
  }));

  /* ---------- 페어 관리 ---------- */
  const addPair = () => {
    const np = newPair(`p${newId()}`, `페어 ${d.pairs.length + 1}`);
    setD(x => ({ ...x, pairs: [...x.pairs, np] }));
    setPi(np.id);
    toast('페어를 추가했습니다 — 「캐릭터」에서 그림과 이름을 바꿔 주세요');
  };
  const dupPair = (p: ClosetPair) => {
    const cp: ClosetPair = { ...JSON.parse(JSON.stringify(p)), id: `p${newId()}`, name: `${p.name} 복사` };
    // 이 페어 전용이던 옷도 같이 복제 — 복제본이 원본과 독립적으로 쓰이게
    setD(x => {
      const idMap = new Map<string, string>();
      const copies = x.items.filter(i => i.pair === p.id).map(i => { const nid = newId(); idMap.set(i.id, nid); return { ...i, id: nid, pair: cp.id }; });
      cp.chars = cp.chars.map(c => ({ ...c, outfit: c.outfit.map(o => idMap.get(o) ?? o) })) as ClosetPair['chars'];
      return { ...x, pairs: [...x.pairs, cp], items: [...x.items, ...copies] };
    });
    setPi(cp.id);
  };
  const movePair = (idx: number, dir: -1 | 1) => setD(x => {
    const j = idx + dir;
    if (j < 0 || j >= x.pairs.length) return x;
    const pairs = [...x.pairs];
    [pairs[idx], pairs[j]] = [pairs[j], pairs[idx]];
    return { ...x, pairs };
  });
  const removePair = (p: ClosetPair) => {
    if (d.pairs.length <= 1) { toast('페어는 최소 하나가 있어야 합니다'); return; }
    del.ask(`「${p.name}」 페어를 삭제할까요?`, () => {
      setD(x => ({
        ...x,
        pairs: x.pairs.filter(q => q.id !== p.id),
        // 이 페어 전용이던 옷은 지우지 않고 공용으로 돌린다
        items: x.items.map(i => i.pair === p.id ? { ...i, pair: undefined } : i),
      }));
      if (pi === p.id) setPi(d.pairs.find(q => q.id !== p.id)!.id);
    }, '이 페어 전용으로 올린 옷은 공용으로 바뀌어 남습니다.');
  };

  const setFace = async (n: 0 | 1, idx: number, f: File) => {
    const src = await upload(f);
    if (src) setChar(n, { bodies: cur.chars[n].bodies.map((b, i) => i === idx ? src : b) });
  };

  const FACE_NAMES = ['기본', '말하는', '웃는', '방치·부끄', '드문 반응'];
  const sorted = [...d.items].sort((a, b) =>
    CLOSET_TABS.findIndex(t => t.key === a.tab) - CLOSET_TABS.findIndex(t => t.key === b.tab));
  const curItems = itemsForPair(d.items, cur.id);
  const perPair = sec === 'chars' || sec === 'dialogue' || sec === 'design';

  return (
    <Modal open={open} title="옷장 편집" desc="저장하면 모든 방문자에게 바로 반영됩니다" dirty onClose={onClose}
      actions={<>
        {uploading > 0 && <span style={{ fontSize: 11, color: 'var(--faint)', alignSelf: 'center' }}>업로드 중 {uploading}…</span>}
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-dark" disabled={uploading > 0} onClick={() => { onSave(d); toast('저장했습니다'); }}>SAVE</button>
      </>}>
      <div className="closet-adm">
        <div className="mini-seg" style={{ justifySelf: 'start' }}>
          {SECS.map(s => <button key={s.key} className={sec === s.key ? 'on' : ''} onClick={() => setSec(s.key)}>{s.label}</button>)}
        </div>

        {perPair && d.pairs.length > 1 && (
          <div className="row">
            <KLabel>고치는 페어</KLabel>
            <KSelect options={pairOpts} value={cur.id} onChange={setPi} minWidth={140} />
          </div>
        )}

        {sec === 'pairs' && (
          <div className="sec">
            <p className="hint">
              페어마다 캐릭터·대사·제목을 따로 두고, 옷장 위의 칩으로 바꿔 가며 입힙니다.
              옷은 기본적으로 모든 페어가 같이 쓰고, 「옷」에서 특정 페어 전용으로 정할 수도 있습니다.
            </p>
            {d.pairs.map((p, idx) => (
              <div className="row" key={p.id}>
                <KInput style={{ width: 180 }} value={p.name} onChange={e => {
                  // 제목이 자동(이름 따라가는) 상태면 이름을 바꿀 때 제목도 같이 바꾼다
                  const auto = pairTitle(p) === `${p.name}의 옷장`;
                  patchPair(p.id, { name: e.target.value, ...(auto ? { title: `${e.target.value}의 옷장` } : {}) });
                }} />
                <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11 }} disabled={idx === 0} onClick={() => movePair(idx, -1)}>▲</button>
                <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11 }} disabled={idx === d.pairs.length - 1} onClick={() => movePair(idx, 1)}>▼</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => dupPair(p)}>복제</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => removePair(p)}>삭제</button>
              </div>
            ))}
            <div className="row"><button className="btn btn-dark" onClick={addPair}>＋ 페어 추가</button></div>
          </div>
        )}

        {sec === 'items' && (<>
          <div className="sec">
            <div className="row">
              <KLabel>올릴 탭</KLabel>
              <KSelect options={tabOpts} value={upTab} onChange={setUpTab} minWidth={120} />
              {d.pairs.length > 1 && (<>
                <KLabel>쓸 페어</KLabel>
                <KSelect options={targetOpts} value={upPair} onChange={setUpPair} minWidth={150} />
              </>)}
            </div>
            <FileDrop accept="image/*" multiple label="옷 그림을 끌어다 놓거나 클릭 (투명 PNG · 캐릭터와 같은 크기)" onFiles={f => { void addFiles(f); }} />
            <KTextarea value={urls} onChange={e => setUrls(e.target.value)} placeholder={'주소로 여러 개 추가 — 한 줄에 하나\nhttps://…/옷.png | 루즈삭스A'} />
            <div className="row"><button className="btn btn-ghost" onClick={addUrls}>주소로 추가</button></div>
            <p className="hint">
              이름 끝에 캐릭터의 사이즈 표시(예: <b>A</b>/<b>B</b>)를 붙이면 더블클릭 때 알아서 그 캐릭터에게 입혀집니다 (예: 루즈삭스A).
              z-index 는 클수록 앞입니다 (캐릭터 몸 10 · 하의 15 · 상의/원피스 20 · 신발 22 · 외투 35 · 악세 40).
            </p>
          </div>
          <div className="grid-items">
            {sorted.map(it => (
              <div className="it" key={it.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolve(it.src)} alt="" />
                <KInput value={it.name} onChange={e => setItem(it.id, { name: e.target.value })} />
                <KSelect options={tabOpts} value={it.tab} onChange={v => setItem(it.id, { tab: v })} minWidth={110} />
                {d.pairs.length > 1 && (
                  <KSelect options={targetOpts} value={it.pair ?? SHARED} minWidth={110}
                    onChange={v => setItem(it.id, { pair: v === SHARED ? undefined : v })} />
                )}
                <KStep value={it.zi} min={-50} max={100} onChange={v => setItem(it.id, { zi: v })} />
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }} onClick={() => removeItem(it.id)}>삭제</button>
              </div>
            ))}
            {sorted.length === 0 && <p className="hint">아직 옷이 없습니다.</p>}
          </div>
        </>)}

        {sec === 'chars' && ([0, 1] as const).map(n => {
          const c = cur.chars[n];
          return (
            <div className="sec" key={`${cur.id}-${n}`} style={{ borderTop: n ? '1px solid var(--line)' : undefined, paddingTop: n ? 14 : 0 }}>
              <KLabel>캐릭터 {n + 1}</KLabel>
              <div className="row">
                <KInput style={{ width: 150 }} value={c.name} placeholder="이름" onChange={e => setChar(n, { name: e.target.value })} />
                <KInput style={{ width: 90 }} value={c.label} placeholder="사이즈 표시" onChange={e => setChar(n, { label: e.target.value })} />
                <KStep value={c.width} min={50} max={1200} step={10} suffix="px" onChange={v => setChar(n, { width: v })} />
                <KStep value={c.height} min={50} max={1600} step={10} suffix="px" onChange={v => setChar(n, { height: v })} />
              </div>
              <div className="faces">
                {c.bodies.map((b, i) => (
                  <div key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="face" src={resolve(b)} alt="" />
                    <span>{i + 1}. {FACE_NAMES[i]}</span>
                    <PickBtn label="바꾸기" onFile={f => { void setFace(n, i, f); }} />
                  </div>
                ))}
              </div>
              <p className="hint">표정 5장은 크기가 모두 같은 투명 PNG 여야 하고, 위 크기(px)와 맞춰 주세요. 얼굴 위치도 5장 모두 똑같이 맞춥니다.</p>
              <div className="row">
                <span className="hint">홍조 위치(왼쪽·위·너비·높이)</span>
                {([0, 1, 2, 3] as const).map(k => (
                  <KStep key={k} value={c.blush[k]} min={0} max={1600} step={5}
                    onChange={v => setChar(n, { blush: c.blush.map((x, i) => i === k ? v : x) as ClosetChar['blush'] })} />
                ))}
              </div>
              <KLabel>처음 입고 나오는 옷</KLabel>
              <div className="chk">
                {curItems.map(it => (
                  <KCheck key={it.id} label={it.name} checked={c.outfit.includes(it.id)}
                    onChange={v => setChar(n, { outfit: v ? [...c.outfit, it.id] : c.outfit.filter(o => o !== it.id) })} />
                ))}
                {curItems.length === 0 && <span className="hint">옷을 먼저 올려 주세요</span>}
              </div>
            </div>
          );
        })}

        {sec === 'dialogue' && (<>
          <p className="hint">줄바꿈으로 여러 줄을 적으면 그중 하나가 무작위로 나옵니다 (표시된 칸만). 왼쪽 {cur.chars[0].name} / 오른쪽 {cur.chars[1].name}</p>
          {DIALOGUE_FIELDS.map(f => (
            <div className="sec" key={f.key}>
              <KLabel>{f.label} <span className="hint">— {f.when}</span></KLabel>
              <div className="dlg">
                {([0, 1] as const).map(n => (
                  <KTextarea key={`${cur.id}-${n}`} value={cur.dialogue[n][f.key] ?? ''} onChange={e => setDlg(n, f.key, e.target.value)} />
                ))}
              </div>
            </div>
          ))}
        </>)}

        {sec === 'design' && (
          <div className="sec">
            <KLabel>제목 (리본에 타자로 나옵니다)</KLabel>
            <KInput value={pairTitle(cur)} onChange={e => patchPair(cur.id, { title: e.target.value })} />
            <KLabel>저장 파일 기본 이름</KLabel>
            <KInput value={cur.saveName} onChange={e => patchPair(cur.id, { saveName: e.target.value })} />
          </div>
        )}
      </div>
      {del.element}
    </Modal>
  );
}
