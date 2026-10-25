'use client';
// 자관 상세 스테이지 — 스크롤을 내리면 장면이 이어서 바뀌는 인터랙티브 히어로.
//  ① 큰 자관명 뒤에서 전신이 앞으로 겹쳐 서 있는 첫 화면
//  ② 내려가면 제목이 위로 밀려 나가고, 필름 띠와 숫자 원이 올라온다 (전신은 작아져 아래로)
//  ③ 더 내려가면 흰 패널이 솟아 「A × B」 큰 글씨와 멤버가 나타난다
//  ④ 패널이 화면을 채우면 이어서 기존 상세 내용(타임라인·문답 등)이 나온다
// 스크롤은 #appMain 이 한다 — 진행도(0~1)를 --p 로 내려 주고, 움직임은 전부 CSS 가 계산한다.
import React, { useEffect } from 'react';
import { useBlobUrl } from '@/lib/blobStore';
import { StageDeco, ScriptWrite } from '@/components/chars/StageDeco';
import type { DecoGhost } from '@/lib/charStore';

export interface RsMember {
  id: string; name: string; color: string; href: string;
  /** 부제(이름 위 작은 글씨) · 키워드 배지 · 기본 정보 항목 · 컬러 팔레트 — 자관 수정/캐릭터 설정에서 정한 그대로 */
  role?: string; kws?: string[]; specs?: { label: string; value: string }[]; gems?: { hex: string; label: string }[];
  ta?: 'l' | 'c' | 'r';
}
export interface RsStat { n: number; label: string }

/** 글자 폭 추정 — 한글·한자는 1em, 나머지는 0.62em. 줄 바꿈 없이 한 줄에 들어가는 글자 크기(vw)를 구한다 */
export function fitVw(text: string, maxVw: number, widthVw: number): number {
  let w = 0;
  for (const ch of text) w += /[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿]/.test(ch) ? 1 : 0.74;
  return Math.max(4, Math.min(maxVw, widthVw / Math.max(w, 2)));
}

function Fig({ refId }: { refId: string }) {
  const url = useBlobUrl(refId);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="rs-fig" src={url} alt="" draggable={false} />;
}

/** 자관명 큰 글씨의 기본 크기(vw) — 설정 화면의 위치 미리보기와 같은 값을 쓰도록 내보낸다 */
export function relTitleVw(name: string): number {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines = words.length <= 1 ? [name] : words.length === 2 ? words : [words[0], words.slice(1, -1).join(' '), words[words.length - 1]];
  return fitVw(lines.reduce((a, b) => (b.length > a.length ? b : a), ''), 24, 86);
}

export function RelStage({ name, fontFamily, catchphrase, cpLabel, members, figs, stats, tc, onGo, auSlot, admin, deco, links }: {
  name: string; fontFamily?: string; catchphrase?: string; cpLabel?: string;
  members: RsMember[]; figs: string[]; stats: RsStat[]; tc: string;
  onGo: (href: string) => void; auSlot?: React.ReactNode;
  /** 관리 글씨(EDIT/DELETE) — 캐릭터 스테이지와 같은 작은 글씨 형태. 권한이 없으면 안 넘긴다 */
  admin?: { editLabel: string; onEdit: () => void; deleteLabel?: string; onDelete?: () => void };
  /** 배경 장식 설정 — 캐릭터 상세와 같은 항목. off면 장식을 그리지 않는다 */
  /** 서랍(창)을 여는 바로가기 */
  links?: { key: string; title: string; sub: string; onClick: () => void }[];
  deco?: {
    off?: boolean;
    image?: string; band?: boolean; blur?: number;
    /** 큰 글씨(자관명) 폰트·위치·크기 */
    titleFont?: string; ghostPos?: DecoGhost;
    script?: { text: string; font?: string; color?: string; size: number; x: number; y: number; rot: number };
  };
}) {
  // 화면 맨 위(메뉴 줄 뒤)까지 꽉 채운다 — 스크롤 영역을 메뉴 줄 뒤로 끌어올리는 클래스
  useEffect(() => {
    document.body.classList.add('rs-full');
    return () => document.body.classList.remove('rs-full');
  }, []);

  const pair = members.map(m => m.name).join(' × ');
  // 제목은 띄어쓰기 기준으로 최대 3줄 — 줄이 늘면 글자가 줄어든다
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines = words.length <= 1 ? [name] : words.length === 2 ? words : [words[0], words.slice(1, -1).join(' '), words[words.length - 1]];
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
  const titleVw = fitVw(longest, 24, 86);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const roman = ROMAN[members.length] ?? String(members.length);

  return (
    <div className="rs" style={{ ['--rs-c' as string]: tc, ['--rs-fs' as string]: `${titleVw}vw` } as React.CSSProperties}>
      <div className="rs-sticky">
        {/* 캐릭터 스테이지와 같은 배경 장식 — 가는 선·눈금·라벨·반짝이·뒤쪽 큰 반원 */}
        {!deco?.off && deco?.image && !deco.band && (
          <div className="rs-bgimg" aria-hidden="true" style={{ backgroundImage: `url("${deco.image}")`, filter: deco.blur ? `blur(${deco.blur}px)` : undefined }} />
        )}
        {!deco?.off && (
          <div className="rs-deco" style={{ ['--accent' as string]: tc } as React.CSSProperties}>
            <StageDeco mode={deco?.image && !deco.band ? 'mono' : 'accent'} shape="tile" tone="dark" ink="light" name={name} colorHex={tc}
              image={deco?.band ? deco.image : undefined} blur={deco?.blur ?? 0} />
          </div>
        )}
        <div className="rs-ring" />
        <i className="rs-bar t" aria-hidden="true" /><i className="rs-bar b" aria-hidden="true" />
        <i className="rs-crn tl" aria-hidden="true" /><i className="rs-crn tr" aria-hidden="true" /><i className="rs-crn bl" aria-hidden="true" /><i className="rs-crn br" aria-hidden="true" />
        <div className="rs-head" aria-hidden="true"><span>{name} // PAIR FILE</span><span>{members.slice(0, 2).map(m => m.name).join(' × ')}</span></div>
        {members.slice(0, 2).map((m, i) => (
          <div key={m.id} className={`rs-side ${i === 0 ? 'l' : 'r'}${m.ta ? ` ta-${m.ta}` : ''}`}>
            <small className="rs-role">{m.role || 'MEMBER'}</small>
            <button type="button" className="rs-nm" onClick={() => onGo(m.href)}>{m.name}</button>
            <div className="rs-meta">
              {(m.gems ?? []).slice(0, 5).map((g, k) => <i key={k} className="rs-gem" title={g.label} style={{ background: g.hex }} />)}
              <span>No./{String(i + 1).padStart(2, '0')}</span>
            </div>
            {!!m.specs?.length && (
              <dl className="rs-spec">
                {m.specs.slice(0, 4).map(sp => <React.Fragment key={sp.label}><dt>{sp.label}</dt><dd>{sp.value}</dd></React.Fragment>)}
              </dl>
            )}
            {!!m.kws?.length && <div className="rs-kw">{m.kws.slice(0, 5).map(k => <span key={k}>{k}</span>)}</div>}
            <button type="button" className="rs-go" onClick={() => onGo(m.href)}>PROFILE →</button>
          </div>
        ))}
        {admin && (
          <div className="cs-tabs cs-admin rs-adm">
            <button type="button" onClick={admin.onEdit}><b>{admin.editLabel}</b></button>
            {admin.onDelete && <button type="button" onClick={admin.onDelete}><b>{admin.deleteLabel ?? 'DELETE'}</b></button>}
          </div>
        )}
        <div className="rs-mid">
          <small>INFO.</small><i />
          <b>{cpLabel ? `PAIR · ${cpLabel}` : 'PAIR'}</b>
          <div className="rs-mt">[ {members.slice(0, 2).map(m => m.name).join(' × ') || name} ]</div>
          {catchphrase && <p>{catchphrase}</p>}
        </div>
        <h1 className={`rs-title${deco?.ghostPos ? ' is-pos' : ''}`}
          style={{ fontFamily: deco?.titleFont ?? fontFamily, ['--rs-ln' as string]: lines.length,
            ...(deco?.ghostPos ? { ['--rs-gx' as string]: `${deco.ghostPos.x}%`, ['--rs-gy' as string]: `${deco.ghostPos.y}%`, ['--rs-gs' as string]: deco.ghostPos.scale / 100 } : {}) } as React.CSSProperties}>
          {lines.map((l, i) => <span key={i}>{l}</span>)}
        </h1>
        {!deco?.off && deco?.script && deco.script.text && (
          <div className="cs-deco rs-scr" style={{ ['--d-acc' as string]: tc } as React.CSSProperties} aria-hidden="true">
            <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><ScriptWrite t={deco.script} /></svg>
          </div>
        )}
        {figs.length > 0 && <div className="rs-figs">{figs.slice(0, 2).map(f => <Fig key={f} refId={f} />)}</div>}
        {/* 서랍 바로가기 + AU 목록 — 캐릭터 상세의 우측 항목(cs-links)과 같은 형태 */}
        <div className="rs-rt">
          {links && links.length > 0 && (
            <div className="cs-links">
              {links.map(l => (
                <button key={l.key} type="button" className="cs-link" onClick={l.onClick}>
                  <span className="cs-link-k">{l.title}</span>
                  <span className="cs-link-s">{l.sub}</span>
                  <span className="cs-link-a">→</span>
                </button>
              ))}
            </div>
          )}
          {auSlot && <div className="rs-au">{auSlot}</div>}
        </div>
      </div>
    </div>
  );
}
