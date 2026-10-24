'use client';
// 자관 상세 스테이지 — 스크롤을 내리면 장면이 이어서 바뀌는 인터랙티브 히어로.
//  ① 큰 자관명 뒤에서 전신이 앞으로 겹쳐 서 있는 첫 화면
//  ② 내려가면 제목이 위로 밀려 나가고, 필름 띠와 숫자 원이 올라온다 (전신은 작아져 아래로)
//  ③ 더 내려가면 흰 패널이 솟아 「A × B」 큰 글씨와 멤버가 나타난다
//  ④ 패널이 화면을 채우면 이어서 기존 상세 내용(타임라인·문답 등)이 나온다
// 스크롤은 #appMain 이 한다 — 진행도(0~1)를 --p 로 내려 주고, 움직임은 전부 CSS 가 계산한다.
import React, { useEffect, useRef } from 'react';
import { useBlobUrl } from '@/lib/blobStore';

export interface RsMember {
  id: string; name: string; color: string; href: string;
  /** 부제(이름 위 작은 글씨) · 키워드 배지 · 기본 정보 항목 · 컬러 팔레트 — 자관 수정/캐릭터 설정에서 정한 그대로 */
  role?: string; kws?: string[]; specs?: { label: string; value: string }[]; gems?: { hex: string; label: string }[];
  ta?: 'l' | 'c' | 'r';
}
export interface RsStat { n: number; label: string }

/** 글자 폭 추정 — 한글·한자는 1em, 나머지는 0.62em. 줄 바꿈 없이 한 줄에 들어가는 글자 크기(vw)를 구한다 */
function fitVw(text: string, maxVw: number, widthVw: number): number {
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

export function RelStage({ name, fontFamily, catchphrase, cpLabel, members, figs, stats, tc, onGo, auSlot }: {
  name: string; fontFamily?: string; catchphrase?: string; cpLabel?: string;
  members: RsMember[]; figs: string[]; stats: RsStat[]; tc: string;
  onGo: (href: string) => void; auSlot?: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const stk = useRef<HTMLDivElement>(null);

  // 화면 맨 위(메뉴 줄 뒤)까지 꽉 채운다 — 스크롤 영역을 메뉴 줄 뒤로 끌어올리는 클래스
  useEffect(() => {
    document.body.classList.add('rs-full');
    return () => document.body.classList.remove('rs-full');
  }, []);

  useEffect(() => {
    const sc = document.getElementById('appMain');
    const target: HTMLElement | Window = sc ?? window;
    let raf = 0;
    const calc = () => {
      raf = 0;
      const w = wrap.current, s = stk.current;
      if (!w || !s) return;
      const top = sc ? sc.getBoundingClientRect().top : 0;
      const range = Math.max(1, w.offsetHeight - s.offsetHeight);
      const p = Math.min(1, Math.max(0, (top - w.getBoundingClientRect().top) / range));
      w.style.setProperty('--p', p.toFixed(4));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    target.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { target.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const pair = members.map(m => m.name).join(' × ');
  // 제목은 띄어쓰기 기준으로 최대 3줄 — 줄이 늘면 글자가 줄어든다
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines = words.length <= 1 ? [name] : words.length === 2 ? words : [words[0], words.slice(1, -1).join(' '), words[words.length - 1]];
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
  const titleVw = fitVw(longest, 24, 86);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const roman = ROMAN[members.length] ?? String(members.length);
  const goDown = () => (document.getElementById('appMain') ?? window).scrollBy({ top: window.innerHeight * 1.7, behavior: 'smooth' });
  const pairVw = fitVw(pair || name, 11, 84);

  return (
    <div className="rs" ref={wrap} style={{ ['--rs-c' as string]: tc, ['--rs-fs' as string]: `${titleVw}vw`, ['--rs-pfs' as string]: `${pairVw}vw` } as React.CSSProperties}>
      <div className="rs-sticky" ref={stk}>
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
        <div className="rs-mid">
          <small>INFO.</small><i />
          <b>{cpLabel ? `PAIR · ${cpLabel}` : 'PAIR'}</b>
          <div className="rs-mt">[ {members.slice(0, 2).map(m => m.name).join(' × ') || name} ]</div>
          {catchphrase && <p>{catchphrase}</p>}
        </div>
        <h1 className="rs-title" style={{ fontFamily, ['--rs-ln' as string]: lines.length } as React.CSSProperties}>{lines.map((l, i) => <span key={i}>{l}</span>)}</h1>
        <div className="rs-band" aria-hidden="true" />
        {figs.length > 0 && <div className="rs-figs">{figs.slice(0, 2).map(f => <Fig key={f} refId={f} />)}</div>}
        <div className="rs-hint">
          <button type="button" className="rs-pill" onClick={goDown}>VIEW STORY <b>↗</b></button>
          <span className="rs-badge" aria-hidden="true"><em>{cpLabel || 'PAIR'}</em></span>
        </div>
        <div className="rs-stats">
          {stats.map((s, i) => (
            <div key={s.label} className={`rs-stat s${i % 3}`}><small>{s.label}</small><b>{s.n}</b></div>
          ))}
        </div>
        <div className="rs-panel">
          <div className="rs-ptitle" style={{ fontFamily }}>{pair || name}</div>
          {catchphrase && <p className="rs-psub">{catchphrase}</p>}
          <div className="rs-chips">
            {members.map(m => (
              <button key={m.id} type="button" onClick={() => onGo(m.href)}><i style={{ background: m.color }} />{m.name}</button>
            ))}
          </div>
          {auSlot && <div className="rs-au">{auSlot}</div>}
          <div className="rs-more" aria-hidden="true">↓ 아래로 내려 상세 정보 보기</div>
        </div>
      </div>
    </div>
  );
}
