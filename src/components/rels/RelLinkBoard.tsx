'use client';
// 자관 상세 하단 연동 리스트 설정 (자관 수정 화면 · 배경 이미지 항목 아래) —
//  1) 상세에서 「로그 백업」 연동을 보일지 「세션 게시판」 연동을 보일지 선택
//  2) 고른 게시판의 항목을 제목으로 검색해 이 자관에 연결/해제 — 플레이기록 폼의 「참여 캐릭터」와 같은 UI
//     (검색창 + 스크롤 리스트, 연결된 항목은 ✓). 로그(TrpgLog.relId)·세션(PlayRecord.relId)에 바로 저장되므로
//     각 게시판 쪽에서 고른 자관과 서로 즉시 반영된다.
import React, { useState } from 'react';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED, TrpgLog, TRPG_SEED, logNo } from '@/lib/galleryStore';
import { Relation, REL_SEED } from '@/lib/charStore';
import { KInput } from '@/components/ui/Kit';

interface Item { id: string; title: string; sub: string; relId?: string }

export function RelLinkBoard({ relId, mode, onMode }: {
  relId?: string;                       // 신규 자관은 저장 전이라 id가 없어 연동을 켤 수 없다
  mode: 'log' | 'session';
  onMode: (m: 'log' | 'session') => void;
}) {
  const [records, setRecords] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  const [logs, setLogs] = useLocalList<TrpgLog>('ohome.trpg.v1', TRPG_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const [q, setQ] = useState('');

  const isSession = mode === 'session';
  const items: Item[] = isSession
    ? records.map(r => ({ id: r.id, title: r.scenario, sub: r.date ?? '', relId: r.relId }))
    : logs.map(l => ({ id: l.id, title: l.title, sub: logNo(l), relId: l.relId }));

  const query = q.trim().toLowerCase();
  // 연결된 항목을 위로, 그 안에서는 날짜순 — 목록이 길어도 무엇을 연결했는지 바로 보이고,
  // 검색해서 찾을 때도 등록 순서가 아니라 항목에 적힌 날짜 순으로 보이게 한다
  const shown = items
    .filter(it => !query || it.title.toLowerCase().includes(query))
    .sort((a, b) => Number(b.relId === relId) - Number(a.relId === relId) || (a.sub || '9999').localeCompare(b.sub || '9999'));
  const linkedCount = items.filter(it => it.relId === relId).length;

  const toggle = (it: Item) => {
    const next = it.relId === relId ? undefined : relId;
    if (isSession) setRecords(records.map(r => (r.id === it.id ? { ...r, relId: next } : r)));
    else setLogs(logs.map(l => (l.id === it.id ? { ...l, relId: next } : l)));
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="k-label" style={{ margin: 0 }}>상세 페이지 하단 연동 리스트</label>
      <div className="mini-seg" style={{ justifySelf: 'start' }}>
        <button className={mode === 'log' ? 'on' : ''} onClick={() => onMode('log')}>로그 백업</button>
        <button className={mode === 'session' ? 'on' : ''} onClick={() => onMode('session')}>세션 게시판</button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        자관 상세 하단에 어느 게시판의 연동 목록을 보일지 고릅니다 — 선택은 저장하면 적용됩니다
      </p>

      {relId ? (
        <div>
          <label className="k-label" style={{ marginBottom: 5 }}>
            연동된 {isSession ? '세션' : '로그'} (optional) <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— {linkedCount}개 선택 · 누르면 바로 연결/해제됩니다</span>
          </label>
          <KInput placeholder={isSession ? '세션 제목 검색' : '로그 제목 검색'} value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 6 }} />
          <div style={{ maxHeight: 150, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 9 }}>
            {shown.map(it => {
              const on = it.relId === relId;
              const other = !on && it.relId ? rels.find(r => r.id === it.relId)?.name : undefined;
              return (
                <div key={it.id} onClick={() => toggle(it)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', cursor: 'var(--cur-pointer,pointer)',
                    fontSize: 12.5, borderBottom: '1px dashed var(--line)',
                    background: on ? 'rgba(127,127,127,.12)' : undefined,
                  }}>
                  <b>{it.title}</b>
                  <small style={{ color: 'var(--faint)' }}>{it.sub}{other ? `${it.sub ? ' · ' : ''}${other} 연동 중` : ''}</small>
                  {on && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
                </div>
              );
            })}
            {shown.length === 0 && (
              <p className="hint" style={{ padding: 10, margin: 0 }}>
                {items.length === 0 ? (isSession ? '등록된 세션이 없습니다' : '백업된 로그가 없습니다') : '검색 결과가 없습니다'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="hint" style={{ margin: 0 }}>{isSession ? '세션' : '로그'} 연결은 자관을 등록한 뒤 수정 화면에서 할 수 있습니다</p>
      )}
    </div>
  );
}
