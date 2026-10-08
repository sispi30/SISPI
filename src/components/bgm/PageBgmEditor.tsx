'use client';
// 페이지별 BGM 편집 — 환경설정의 BGM 화면(재생목록=무드 카드 → 곡 목록, 커버, 이름 수정, 곡 추가)과 같은 구성.
// 환경설정은 홈페이지 전역 저장소를 직접 고치지만, 이쪽은 넘겨받은 값(value)만 고치고 onChange로 돌려준다
// (자관·캐릭터 편집 폼의 [SAVE]를 눌러야 저장). 재생 방식 4가지는 정하면 이 페이지에서만 홈페이지 값 대신 쓴다.
import React, { useState } from 'react';
import { KInput, KStep, KToggle } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';
import { useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { newId } from '@/lib/postStore';
import {
  useBgm, parseVideoId, extractDominantColorFromBlob,
  type BgmPlaylist, type BgmTrack, type PageBgm,
} from '@/lib/bgmStore';

/** 곡 한 줄 — 인라인 수정(제목/아티스트/URL/재생시간) + 삭제 */
function TrackRow({ t, onPatch, onDelete }: {
  t: BgmTrack; onPatch: (p: Partial<BgmTrack>) => void; onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [artist, setArtist] = useState(t.artist);
  const [url, setUrl] = useState(t.videoId);
  const [duration, setDuration] = useState(t.duration);

  if (editing) {
    return (
      <div style={{ display: 'grid', gap: 7, padding: '10px 0', borderBottom: '1px dashed var(--line)', width: '100%' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <KInput placeholder="곡 제목" value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 150 }} />
          <KInput placeholder="아티스트 (선택)" value={artist} onChange={e => setArtist(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
          <KInput placeholder="재생시간 (3:45)" value={duration} onChange={e => setDuration(e.target.value)} style={{ maxWidth: 90 }} />
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <KInput placeholder="유튜브 URL 또는 영상 ID" value={url} onChange={e => setUrl(e.target.value)} />
          <button type="button" className="btn btn-dark" style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              const vid = parseVideoId(url);
              if (!title.trim() || !vid) { toast('제목과 올바른 유튜브 URL(또는 영상 ID)을 입력해 주세요'); return; }
              onPatch({ title: title.trim(), artist: artist.trim(), videoId: vid, duration: duration.trim() });
              setEditing(false);
            }}>SAVE</button>
          <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }}
            onClick={() => { setEditing(false); setTitle(t.title); setArtist(t.artist); setUrl(t.videoId); setDuration(t.duration); }}>CANCEL</button>
        </div>
      </div>
    );
  }
  return (
    <div className="set-row" style={{ width: '100%' }}>
      <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        <span className="drag-h">⠿</span>
        <div><b>{t.title}</b><small>{t.artist || t.videoId || '유튜브 링크 없음'}{t.duration ? ` · ${t.duration}` : ''}</small></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }} onClick={() => setEditing(true)}>EDIT</button>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }} onClick={onDelete}>DELETE</button>
      </div>
    </div>
  );
}

/** 재생목록(무드 카드) 한 장 — 커버, 이름 수정, 곡 목록(펼침), 삭제 */
function PlaylistRow({ pl, open, onToggle, onPatch, onDelete }: {
  pl: BgmPlaylist; open: boolean; onToggle: () => void;
  onPatch: (p: Partial<BgmPlaylist>) => void; onDelete: () => void;
}) {
  const toast = useToast();
  const del = useConfirmDelete();
  const coverUrl = useBlobUrl(pl.cover || undefined);
  const [titleEdit, setTitleEdit] = useState(false);
  const [title, setTitle] = useState(pl.title);
  const [tTitle, setTTitle] = useState('');
  const [tArtist, setTArtist] = useState('');
  const [tUrl, setTUrl] = useState('');
  const [tDur, setTDur] = useState('');
  const fileId = `pbgm-cover-${pl.id}`;

  const addT = () => {
    const vid = parseVideoId(tUrl);
    if (!vid || !tTitle.trim()) { toast('제목과 올바른 유튜브 URL(또는 영상 ID)을 입력해 주세요'); return; }
    onPatch({ tracks: [...pl.tracks, { id: newId(), title: tTitle.trim(), artist: tArtist.trim(), videoId: vid, duration: tDur.trim() }] });
    setTTitle(''); setTArtist(''); setTUrl(''); setTDur('');
  };

  return (
    <div className="set-row" style={{ width: '100%', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%' }}>
        <span className="drag-h">⠿</span>
        <div className="bgm-cover" onClick={onToggle}
          style={{
            width: 40, height: 40, borderRadius: 10, flex: '0 0 auto', cursor: 'pointer',
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            background: coverUrl ? undefined : 'linear-gradient(135deg,#5b6c91,#39456a)',
          }} />
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
          <b>{pl.title}</b><small>{pl.tracks.length}곡</small>
        </div>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }} onClick={onToggle}>{open ? '접기' : '펼치기'}</button>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
          onClick={() => del.ask(`재생목록 「${pl.title}」을 삭제하시겠습니까? 안의 곡도 모두 삭제됩니다.`, onDelete)}>DELETE</button>
        {del.element}
      </div>

      {open && (
        <div style={{ display: 'grid', gap: 14, paddingLeft: 51 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input id={fileId} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={async e => {
                const f = e.target.files?.[0];
                if (f) {
                  const [ref, color] = await Promise.all([putBlob(f), extractDominantColorFromBlob(f)]);
                  onPatch({ cover: ref, coverColor: color ?? undefined });
                }
                e.target.value = '';
              }} />
            <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 10.5 }}
              onClick={() => document.getElementById(fileId)?.click()}>{pl.cover ? '커버 변경' : '커버 업로드'}</button>
            {pl.cover && (
              <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 10.5 }}
                onClick={() => onPatch({ cover: '', coverColor: undefined })}>커버 제거</button>
            )}
            <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>커버가 없으면 이름을 기준으로 자동 그러데이션이 적용됩니다</span>
          </div>

          {titleEdit ? (
            <div style={{ display: 'flex', gap: 7 }}>
              <KInput value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 220 }} />
              <button type="button" className="btn btn-dark" style={{ padding: '5px 12px', fontSize: 10.5 }}
                onClick={() => { if (title.trim()) { onPatch({ title: title.trim() }); setTitleEdit(false); } }}>SAVE</button>
              <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 10.5 }}
                onClick={() => { setTitleEdit(false); setTitle(pl.title); }}>CANCEL</button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 10.5, width: 'fit-content' }}
              onClick={() => setTitleEdit(true)}>이름 수정 ({pl.title})</button>
          )}

          <DragList items={pl.tracks} keyOf={t => t.id} onReorder={next => onPatch({ tracks: next })}
            render={t => (
              <TrackRow t={t}
                onPatch={p => onPatch({ tracks: pl.tracks.map(x => (x.id === t.id ? { ...x, ...p } : x)) })}
                onDelete={() => onPatch({ tracks: pl.tracks.filter(x => x.id !== t.id) })} />
            )} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <KInput placeholder="곡 제목" value={tTitle} onChange={e => setTTitle(e.target.value)} style={{ maxWidth: 150 }} />
            <KInput placeholder="아티스트 (선택)" value={tArtist} onChange={e => setTArtist(e.target.value)} style={{ maxWidth: 130 }} />
            <KInput placeholder="유튜브 URL 또는 영상 ID" value={tUrl} onChange={e => setTUrl(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <KInput placeholder="재생시간 (3:45)" value={tDur} onChange={e => setTDur(e.target.value)} style={{ maxWidth: 90 }} />
            <button type="button" className="btn btn-dark" onClick={addT}>＋ ADD</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** value가 없으면 이 페이지는 개별 BGM 없음(홈페이지 BGM) — 재생목록을 하나라도 만들면 켜진다 */
export function PageBgmEditor({ value, onChange }: { value: PageBgm | undefined; onChange: (v: PageBgm | undefined) => void }) {
  const toast = useToast();
  const { state } = useBgm();          // 편집 화면에서는 홈페이지 BGM 값 (재생 방식 기본값 표시용)
  const [newTitle, setNewTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const v: PageBgm = value ?? { playlists: [] };
  const set = (p: Partial<PageBgm>) => onChange({ ...v, ...p });
  const patchPl = (id: string, p: Partial<BgmPlaylist>) =>
    set({ playlists: v.playlists.map(x => (x.id === id ? { ...x, ...p } : x)) });
  const g = state.settings;
  const customized = v.volume !== undefined || v.shuffle !== undefined || v.crossPlaylist !== undefined || v.repeat !== undefined;

  const add = () => {
    if (!newTitle.trim()) { toast('재생목록 이름을 입력해 주세요'); return; }
    const id = newId();
    set({ playlists: [...v.playlists, { id, title: newTitle.trim(), cover: '', tracks: [] }] });
    setNewTitle('');
    setOpenId(id);
  };

  return (
    <div className="set-sec" style={{ marginTop: 0 }}>
      <h3>BGM</h3>
      <div className="d">
        이 페이지에서만 나올 BGM입니다 — 재생목록(무드 카드) 단위로 곡을 관리하고, 곡이 하나라도 있으면 이 페이지에 들어갔을 때
        플레이어가 이 BGM으로 바뀝니다. 페이지를 나가면 홈페이지 BGM으로 돌아갑니다. 곡이 없으면 홈페이지 BGM이 그대로 나옵니다.
      </div>

      <DragList items={v.playlists} keyOf={p => p.id} onReorder={playlists => set({ playlists })}
        render={pl => (
          <PlaylistRow pl={pl} open={openId === pl.id}
            onToggle={() => setOpenId(o => (o === pl.id ? null : pl.id))}
            onPatch={p => patchPl(pl.id, p)}
            onDelete={() => { const left = v.playlists.filter(x => x.id !== pl.id); onChange(left.length || customized ? { ...v, playlists: left } : undefined); }} />
        )} />

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <KInput placeholder="새 재생목록 이름 (예: Deep Focus)" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button type="button" className="btn btn-dark" onClick={add}>＋ 재생목록 추가</button>
      </div>

      {v.playlists.length > 0 && (
        <>
          <div className="set-row" style={{ marginTop: 16 }}>
            <div className="l"><b>이 페이지 재생 방식</b><small>바꾸면 이 페이지에서만 적용됩니다{customized ? '' : ' — 지금은 홈페이지 설정을 따릅니다'}</small></div>
            {customized && (
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => set({ volume: undefined, shuffle: undefined, crossPlaylist: undefined, repeat: undefined })}>홈페이지 설정 따르기</button>
            )}
          </div>
          <div className="set-row">
            <div className="l"><b>기본 볼륨</b></div>
            <KStep value={v.volume ?? g.volume} min={0} max={100} suffix="%" onChange={x => set({ volume: x })} />
          </div>
          <div className="set-row">
            <div className="l"><b>셔플</b></div>
            <KToggle checked={v.shuffle ?? g.shuffle} onChange={x => set({ shuffle: x })} />
          </div>
          <div className="set-row">
            <div className="l"><b>재생목록 넘나들기</b><small>켜면 이전/다음 곡이 재생목록 경계에서 다음 재생목록으로 이어짐</small></div>
            <KToggle checked={v.crossPlaylist ?? g.crossPlaylist} onChange={x => set({ crossPlaylist: x })} />
          </div>
          <div className="set-row">
            <div className="l"><b>반복 재생</b></div>
            <div className="mini-seg">
              {(['off', 'all', 'one'] as const).map(m => (
                <button type="button" key={m} className={(v.repeat ?? g.repeat) === m ? 'on' : ''} onClick={() => set({ repeat: m })}>
                  {m === 'off' ? '끔' : m === 'all' ? '전체 반복' : '한 곡 반복'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
