'use client';
// 페어 카드 — 페어 목록과 캐릭터 상세 서랍(Relations·Gallery)이 같이 쓰는 한 가지 카드 디자인.
// 큰 번호 · FILE 표시 · 오른쪽 위 꼬리표 · 아래쪽 이름 + 멤버(마름모) 줄 · 모서리 표식 · 올리면 떠오르는 효과까지 한 벌.
// 크기는 카드 폭(cqw)을 따라가서 어디에 놓아도 같은 모양으로 줄고 늘어난다.
import React from 'react';
import { PairThumb } from '@/components/rels/PairThumb';
import { useBgLight } from '@/lib/useImgLight';
import type { CropValue } from '@/components/ui/CropEditor';

/* 등장 애니메이션은 페이지를 새로 불러온 뒤 처음 나온 카드들만 재생한다 — 다른 메뉴로 갔다 와도(새로고침 전까지) 다시 재생하지 않는다.
   처음 카드가 붙은 시각에서 0.9초 안에 붙는 카드는 같은 묶음(첫 목록)으로 보고 재생한다 */
let rxFirstMount = 0;
const rxStill = () => rxFirstMount !== 0 && Date.now() - rxFirstMount > 900;

export interface RxWho { name: string; color: string }

const pad2 = (n: number) => String(n).padStart(2, '0');

export function RxCard({ no, fileRef, crop, ph, phLabel, tc, tag, meta, fileText = 'PAIR\nFILE', small, title, titleExtra, who, whoMore,
  priv, tall, drawer, adaptive, anim, onClick, style, children, ...rest }: {
  no: number; fileRef?: string; crop?: CropValue; ph?: string; phLabel?: string;
  /** 테마색 — 대각선·꼬리표·테두리 */
  tc: string;
  tag?: string; meta?: string; fileText?: string;
  small?: string; title: string; titleExtra?: React.ReactNode;
  who: RxWho[]; whoMore?: number;
  priv?: boolean; tall?: boolean; drawer?: boolean;
  /** 홈페이지 배경이 밝으면 밝은 그라데이션 + 어두운 글자 (갤러리 썸네일 전용) */
  adaptive?: boolean;
  /** 등장 애니메이션 순서(0부터) — 줄이 긴 목록에서 뒤쪽 카드가 너무 늦게 뜨지 않게 따로 줄 때. 기본은 번호-1 */
  anim?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
  /** 카드 위에 덮는 것 (접힘 가리개 등) */
  children?: React.ReactNode;
} & Record<string, unknown>) {
  const light = useBgLight(!!adaptive);
  const [still] = React.useState(rxStill);   // 서버·첫 로드에서는 항상 false(재생), 이후 이동해서 새로 붙는 카드만 true
  React.useEffect(() => { if (rxFirstMount === 0) rxFirstMount = Date.now(); }, []);
  return (
    <div className={`rx-card${still ? ' rx-still' : ''}${light ? ' rx-lt' : ''}${priv ? ' priv' : ''}${tall ? ' rx-tall' : ''}${drawer ? ' rx-d' : ''}`} {...rest} onClick={onClick}
      role={onClick ? 'link' : undefined}
      style={{ ['--i' as string]: anim ?? no - 1, ['--c1' as string]: tc, ...(style ?? {}) } as React.CSSProperties}>
      <div className="rx-art">
        <PairThumb fileRef={fileRef} crop={crop} ph={ph} label={phLabel} tc={tc} delay={0.9 + (anim ?? no - 1) * 0.14} />
        <div className="rx-shade" />
      </div>
      <i className="rx-corner tr" /><i className="rx-corner bl" />
      <div className="rx-top">
        <span className="rx-no">{pad2(no)}</span>
        <span className="rx-file">{fileText.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}</span>
        <span className="rx-meta">{tag && <b style={{ color: tc }}>{tag}</b>}{meta && <em>{meta}</em>}</span>
      </div>
      <div className="rx-bot">
        <small>{small ?? ''}</small>
        <h3>{title}{titleExtra}</h3>
        <div className="rx-who">
          {who.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <u>×</u>}
              <span><i style={{ background: m.color }} />{m.name.toUpperCase()}</span>
            </React.Fragment>
          ))}
          {!!whoMore && whoMore > 0 && <u>+{whoMore}</u>}
        </div>
      </div>
      {children}
    </div>
  );
}
