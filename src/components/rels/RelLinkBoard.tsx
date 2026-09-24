'use client';
// 자관 상세 하단 연동 리스트 설정 (자관 수정 화면) —
//  1) 상세에서 「로그 백업」 연동을 보일지 「세션 게시판」 연동을 보일지 선택
//  2) 세션 게시판 연동: 제목으로 검색해 이 자관에 연결/해제 (캐릭터 수정의 세션 찾기와 같은 방식).
//     플레이 기록(PlayRecord.relId)에 바로 저장되므로 세션 글쓰기 화면에서 고른 것과 서로 즉시 반영된다.
import React, { useState } from 'react';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { KInput } from '@/components/ui/Kit';

export function RelLinkBoard({ relId, mode, onMode }: {
  relId?: string;                       // 신규 자관은 저장 전이라 id가 없어 세션 연동을 켤 수 없다
  mode: 'log' | 'session';
  onMode: (m: 'log' | 'session') => void;
}) {
  const [records, setRecords] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  const [q, setQ] = useState('');

  const linked = relId ? records.filter(r => r.relId === relId) : [];
  const query = q.trim().toLowerCase();
  const matches = relId && query
    ? records.filter(r => r.relId !== relId && r.scenario.toLowerCase().includes(query))
    : [];

  const link = (rec: PlayRecord) => {
    setRecords(records.map(r => (r.id === rec.id ? { ...r, relId } : r)));
    setQ('');
  };
  const unlink = (rec: PlayRecord) =>
    setRecords(records.map(r => (r.id === rec.id ? { ...r, relId: undefined } : r)));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="k-label" style={{ margin: 0 }}>상세 페이지 하단 연동 리스트</label>
      <div className="mini-seg" style={{ justifySelf: 'start' }}>
        <button className={mode === 'log' ? 'on' : ''} onClick={() => onMode('log')}>로그 백업</button>
        <button className={mode === 'session' ? 'on' : ''} onClick={() => onMode('session')}>세션 게시판</button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        자관 상세 하단에 어느 게시판의 연동 목록을 보일지 고릅니다 — 저장하면 적용됩니다
      </p>

      {relId && (
        <>
          <label className="k-label" style={{ margin: '6px 0 0' }}>
            연동된 세션 <span style={{ fontWeight: 400, color: 'var(--faint)' }}>— 여기서 연결·해제하면 바로 반영됩니다</span>
          </label>
          {linked.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>아직 연결한 세션이 없습니다 — 아래에서 제목으로 검색해 연결해 보세요</p>
          ) : linked.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 12.5 }}>
              <b>{r.scenario}</b>
              {r.date && <small style={{ color: 'var(--faint)' }}>{r.date}</small>}
              <span className="fx" style={{ marginLeft: 'auto' }} onClick={() => unlink(r)}>✕</span>
            </div>
          ))}
          <KInput placeholder="세션 제목 검색" value={q} onChange={e => setQ(e.target.value)} />
          {query && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 9 }}>
              {matches.map(r => (
                <div key={r.id} onClick={() => link(r)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', cursor: 'var(--cur-pointer,pointer)', fontSize: 12.5, borderBottom: '1px dashed var(--line)' }}>
                  <b>{r.scenario}</b>
                  {r.date && <small style={{ color: 'var(--faint)' }}>{r.date}</small>}
                  <span style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 11 }}>연결 +</span>
                </div>
              ))}
              {matches.length === 0 && <p className="hint" style={{ padding: 8, margin: 0 }}>검색 결과가 없습니다</p>}
            </div>
          )}
        </>
      )}
      {!relId && <p className="hint" style={{ margin: 0 }}>세션 연결은 자관을 등록한 뒤 수정 화면에서 할 수 있습니다</p>}
    </div>
  );
}
