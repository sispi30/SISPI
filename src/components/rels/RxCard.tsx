'use client';
// 페어 카드 — 페어 목록과 캐릭터 상세 서랍(Relations·Gallery)이 같이 쓰는 한 가지 카드 디자인.
// 큰 번호 · FILE 표시 · 오른쪽 위 꼬리표 · 아래쪽 이름 + 멤버(마름모) 줄 · 모서리 표식 · 올리면 떠오르는 효과까지 한 벌.
// 크기는 카드 폭(cqw)을 따라가서 어디에 놓아도 같은 모양으로 줄고 늘어난다.
import React from 'react';
import { PairThumb } from '@/components/rels/PairThumb';
import type { CropValue } from '@/components/ui/CropEditor';

export interface RxWho { name: string; color: string }

const pad2 = (n: number) => String(n).padStart(2, '0');

export function RxCard({ no, fileRef, crop, ph, phLabel, tc, tag, meta, fileText = 'PAIR\nFILE', small, title, titleExtra, who, whoMore,
  priv, tall, drawer, onClick, style, children, ...rest }: {
  no: number; fileRef?: string; crop?: CropValue; ph?: string; phLabel?: string;
  /** 테마색 — 대각선·꼬리표·테두리 */
  tc: string;
  tag?: string; meta?: string; fileText?: string;
  small?: string; title: string; titleExtra?: React.ReactNode;
  who: RxWho[]; whoMore?: number;
  priv?: boolean; tall?: boolean; drawer?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  /** 카드 위에 덮는 것 (접힘 가리개 등) */
  children?: React.ReactNode;
} & Record<string, unknown>) {
  return (
    <div className={`rx-card${priv ? ' priv' : ''}${tall ? ' rx-tall' : ''}${drawer ? ' rx-d' : ''}`} {...rest} onClick={onClick}
      role={onClick ? 'link' : undefined}
      style={{ ['--i' as string]: no - 1, ['--c1' as string]: tc, ...(style ?? {}) } as React.CSSProperties}>
      <div className="rx-art">
        <PairThumb fileRef={fileRef} crop={crop} ph={ph} label={phLabel} tc={tc} delay={0.9 + (no - 1) * 0.14} />
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
