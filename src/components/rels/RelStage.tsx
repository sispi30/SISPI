'use client';
// 자관 상세 스테이지 — 한 화면에 고정된 포스터형 첫 화면 (스크롤 연동 없음).
//  · 뒤: 배경 장식(StageDeco) → 큰 자관명 → 필기체 글씨
//  · 앞: 전신·이름·스티커 — 자관 수정의 「메인 이미지 · 레이어」 미리보기와 같은 자리·크기·순서
//  · 가운데 INFO 아래: 서랍 바로가기(타임라인·문답·로그·세션·갤러리·역극) + AU 목록
// 레이어 좌표는 「메뉴 줄 아래 ~ 화면 끝」 상자 대비 % — 수정 화면 미리보기와 같은 비율이다.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBlobUrl } from '@/lib/blobStore';
import { StageDeco, ScriptWrite } from '@/components/chars/StageDeco';
import type { DecoGhost } from '@/lib/charStore';

export interface RsMember { id: string; name: string; href: string }
/** 전신 한 칸 — i=0 왼쪽, i=1 오른쪽. scale·off는 상자(칸) 대비 % */
export interface RsFull { id: string; ref: string; scale: number; offX: number; offY: number; z: number; shadow?: string }
/** 이름 묶음 — o는 기본 자리에서 옮긴 거리(상자 대비 %) */
export interface RsName {
  id: string; name: string; sub?: string; font?: string; fs?: number; bold: boolean; href: string;
  align: 'top' | 'mid' | 'bottom'; ta: 'left' | 'center' | 'right'; o: { x: number; y: number };
  kws: string[]; specs: { label: string; value: string }[]; gems: { hex: string; label: string }[];
}
export interface RsSticker { id: string; ref: string; x: number; y: number; w: number; z: number }
export interface RsHero { fulls: RsFull[]; names: RsName[]; stickers: RsSticker[]; uiZ: number }

/** 글자 폭 추정 — 한글·한자는 1em, 나머지는 0.74em. 줄 바꿈 없이 한 줄에 들어가는 글자 크기(vw)를 구한다 */
export function fitVw(text: string, maxVw: number, widthVw: number): number {
  let w = 0;
  for (const ch of text) w += /[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿]/.test(ch) ? 1 : 0.74;
  return Math.max(4, Math.min(maxVw, widthVw / Math.max(w, 2)));
}

/** 자관명을 띄어쓰기 기준 최대 3줄로 */
export function relTitleLines(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length <= 1 ? [name] : words.length === 2 ? words : [words[0], words.slice(1, -1).join(' '), words[words.length - 1]];
}
/** 자관명 큰 글씨의 기본 크기(상자 폭 대비 %) — 수정 화면 미리보기와 같은 값을 쓰도록 내보낸다 */
export function relTitleVw(name: string): number {
  return fitVw(relTitleLines(name).reduce((a, b) => (b.length > a.length ? b : a), ''), 24, 86);
}
/** 큰 글씨 실제 크기(px) — 상자 폭 W·높이 H 기준. 줄이 늘면 줄어들고 높이를 넘지 않는다 */
export function relTitlePx(name: string, W: number, H: number, scale = 100): number {
  const ln = relTitleLines(name).length;
  return Math.min(relTitleVw(name) * W / 100, (0.64 * H / ln) * 1.05) * scale / 100;
}

function Full({ f, i }: { f: RsFull; i: number }) {
  const url = useBlobUrl(f.ref);
  return (
    <div className={`rs-fb ${i === 0 ? 'l' : 'r'}`} style={{ zIndex: f.z }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" draggable={false} style={{
        position: 'absolute', bottom: `${f.offY}%`, left: `calc(50% + ${f.offX}%)`, transform: 'translateX(-50%)',
        height: `${f.scale}%`, maxWidth: 'none', filter: f.shadow ?? 'drop-shadow(0 14px 30px rgba(0,0,0,.45))',
      }} />}
    </div>
  );
}

function Sticker({ s }: { s: RsSticker }) {
  const url = useBlobUrl(s.ref);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="rs-stk" src={url} alt="" draggable={false} style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, zIndex: s.z }} /> : null;
}

export function RelStage({ name, fontFamily, catchphrase, cpLabel, members, hero, tc, onGo, auSlot, admin, deco, links, light }: {
  name: string; fontFamily?: string; catchphrase?: string; cpLabel?: string;
  members: RsMember[]; hero: RsHero; tc: string;
  onGo: (href: string) => void; auSlot?: React.ReactNode;
  /** 관리 글씨(EDIT/DELETE) — 캐릭터 스테이지와 같은 작은 글씨 형태. 권한이 없으면 안 넘긴다 */
  admin?: { editLabel: string; onEdit: () => void; deleteLabel?: string; onDelete?: () => void };
  /** 서랍(창)을 여는 바로가기 */
  links?: { key: string; title: string; sub: string; onClick: () => void }[];
  /** 배경이 밝으면 true — 장식·글자를 어두운 쪽으로 (캐릭터 상세와 같은 규칙) */
  light?: boolean;
  /** 배경 장식 설정 — 캐릭터 상세와 같은 항목. off면 장식을 그리지 않는다 */
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

  // 필기체 글씨는 레이어 상자의 실제 크기에 맞춰 그린다 (위치·크기가 수정 화면 미리보기와 같게)
  const heroRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1920, h: 1000 });
  useLayoutEffect(() => {
    const el = heroRef.current; if (!el) return;
    const sync = () => setBox({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) });
    sync();
    const ro = new ResizeObserver(sync); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pair = members.map(m => m.name).join(' × ');
  const lines = relTitleLines(name);
  const gp = deco?.ghostPos ?? { x: 50, y: 30, scale: 100 };
  const titlePx = relTitlePx(name, box.w, box.h, gp.scale);

  return (
    <div className="rs" data-lt={light ? '1' : undefined} style={{ ['--rs-c' as string]: tc } as React.CSSProperties}>
      <div className="rs-sticky">
        {/* 캐릭터 스테이지와 같은 배경 장식 — 가는 선·눈금·라벨·반짝이·뒤쪽 큰 판. 바탕색은 지금 테마에 맞춘다 */}
        {!deco?.off && (
          <div className="rs-deco" style={{ ['--accent' as string]: tc } as React.CSSProperties}>
            <StageDeco mode={deco?.image && !deco.band ? 'mono' : 'accent'} shape="tile" tone={light ? 'light' : 'dark'} ink={light ? 'dark' : 'light'}
              name={name} colorHex={tc} image={deco?.band ? deco.image : undefined} blur={deco?.blur ?? 0} />
          </div>
        )}
        <i className="rs-crn tl" aria-hidden="true" /><i className="rs-crn tr" aria-hidden="true" /><i className="rs-crn bl" aria-hidden="true" /><i className="rs-crn br" aria-hidden="true" />
        <div className="rs-head" aria-hidden="true"><span>{name} // PAIR FILE</span><span>{members.slice(0, 2).map(m => m.name).join(' × ')}</span></div>

        {/* 메인 이미지 레이어 — 큰 자관명 · 필기체 · 전신 · 이름 · 스티커 (수정 화면 미리보기와 같은 상자) */}
        <div className="rs-hero" ref={heroRef}>
          <h1 className="rs-title" style={{ fontFamily: deco?.titleFont ?? fontFamily, left: `${gp.x}%`, top: `${gp.y}%`, fontSize: `${titlePx}px` }}>
            {lines.map((l, i) => <span key={i}>{l}</span>)}
          </h1>
          {!deco?.off && deco?.script && deco.script.text && (
            <div className="cs-deco rs-scr" style={{ ['--d-acc' as string]: tc } as React.CSSProperties} aria-hidden="true">
              <svg viewBox={`0 0 ${box.w} ${box.h}`} width="100%" height="100%"><ScriptWrite t={deco.script} vb={box} /></svg>
            </div>
          )}
          {hero.fulls.slice(0, 2).map((f, i) => <Full key={f.id} f={f} i={i} />)}
          {hero.stickers.map(st => <Sticker key={st.id} s={st} />)}
          <div className="rs-ui" style={{ zIndex: hero.uiZ }}>
            {hero.names.slice(0, 2).map((n, i) => {
              const left = i === 0;
              const pos: React.CSSProperties = {
                ...(left ? { left: `${2.64 + n.o.x}%` } : { right: `${2.64 - n.o.x}%` }),
                ...(n.align === 'bottom' ? { bottom: `${4 - n.o.y}%` } : { top: `${(n.align === 'mid' ? 50 : 4) + n.o.y}%` }),
                transform: n.align === 'mid' ? 'translateY(-50%)' : undefined,
                alignItems: n.ta === 'center' ? 'center' : n.ta === 'left' ? 'flex-start' : 'flex-end', textAlign: n.ta,
                fontFamily: n.font,
              };
              return (
                <div key={n.id} className={`rs-nb ${left ? 'l' : 'r'}`} style={pos}>
                  <small className="rs-role">{n.sub || 'MEMBER'}</small>
                  <button type="button" className="rs-nm" onClick={() => onGo(n.href)}
                    style={{ fontSize: n.fs ? `${n.fs}px` : 'clamp(20px,3.4vw,40px)', fontWeight: n.bold ? 800 : 400 }}>{n.name}</button>
                  <div className="rs-meta">
                    {n.gems.slice(0, 5).map(g => <i key={g.hex + g.label} className="rs-gem" title={g.label} style={{ background: g.hex }} />)}
                    <span>No./{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  {n.specs.length > 0 && (
                    <dl className="rs-spec">
                      {n.specs.slice(0, 4).map(sp => <React.Fragment key={sp.label}><dt>{sp.label}</dt><dd>{sp.value}</dd></React.Fragment>)}
                    </dl>
                  )}
                  {n.kws.length > 0 && <div className="rs-kw">{n.kws.slice(0, 5).map(k => <span key={k}>{k}</span>)}</div>}
                  <button type="button" className="rs-go" onClick={() => onGo(n.href)}>PROFILE →</button>
                </div>
              );
            })}
          </div>
        </div>

        {admin && (
          <div className="cs-tabs cs-admin rs-adm">
            <button type="button" onClick={admin.onEdit}><b>{admin.editLabel}</b></button>
            {admin.onDelete && <button type="button" onClick={admin.onDelete}><b>{admin.deleteLabel ?? 'DELETE'}</b></button>}
          </div>
        )}

        {/* 가운데 INFO — 아래에 서랍 바로가기와 AU 목록이 이어진다 */}
        <div className="rs-mid">
          <small>INFO.</small><i />
          <b>{cpLabel ? `PAIR · ${cpLabel}` : 'PAIR'}</b>
          <div className="rs-mt">[ {pair || name} ]</div>
          {catchphrase && <p>{catchphrase}</p>}
          {links && links.length > 0 && (
            <div className="cs-links rs-links">
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
