'use client';
// 상세(스테이지) 배경 장식 — 게임 아트 소개 화면처럼 얇은 선·눈금·라벨·반짝이와,
// 캐릭터 이름의 다른 표기를 뒤에 크게 깐 「고스트 글씨」로 꾸민다. 늘 글자·그림보다 뒤(z-index 0)이고 클릭을 받지 않는다.
//
// 색
//  · 포인트색 = 페이지의 --accent (캐릭터 테마색 모드면 그 색으로 이미 바뀌어 있다)
//  · 바탕·선 색 = 밝은 테마는 흰색 계열, 어두운 테마는 검은색 계열 (tone — 배경 밝기에서 정한다)
// 배경 이미지를 등록한 경우 (mode)
//  · 'band' : 이미지를 뒤쪽의 큰 반원 안에 넣고, 나머지는 포인트색 장식 + 테마 바탕
//  · 'mono' : 이미지는 전체 배경 그대로, 장식 요소만 흰색/검은색(이미지 밝기에 맞춰)으로
import React from 'react';

export type DecoMode = 'accent' | 'mono';

interface Props {
  mode: DecoMode;
  /** 장식 바탕·선의 계열 — 'light'=밝은(흰색 계열) 테마 · 'dark'=어두운(검은색 계열) 테마 */
  tone: 'light' | 'dark';
  /** mode='mono'일 때 장식 색 — 'dark'=검정 · 'light'=흰색 (이미지 밝기에 맞춘 값) */
  ink: 'light' | 'dark';
  /** mode='band'일 때 반원 안에 넣을 이미지와 블러(px) */
  image?: string;
  blur?: number;
  /** 뒤에 크게 깔 글씨 (이름의 다른 표기) — 비우면 깔지 않는다 */
  ghost?: string;
  ghostFont?: string;
  /** 하단 라벨에 적을 값 */
  name?: string;
  colorHex?: string;
}

// 뒤쪽 큰 반원 (부채꼴) — 중심 (960,905) · 반지름 610
const FAN = 'M350 905 A610 610 0 0 1 1570 905 Z';

export function StageDeco({ mode, tone, ink, image, blur = 0, ghost, ghostFont, name, colorHex }: Props) {
  const mono = mode === 'mono';
  const band = mode === 'accent' && !!image;
  const style = (mono
    ? { '--d-acc': ink === 'dark' ? '#111418' : '#ffffff', '--d-line': ink === 'dark' ? 'rgba(10,12,16,.5)' : 'rgba(255,255,255,.55)',
        '--d-ghost': ink === 'dark' ? 'rgba(10,12,16,.1)' : 'rgba(255,255,255,.14)' }
    : tone === 'light'
      ? { '--d-acc': 'var(--accent,#7fd6d0)', '--d-line': 'rgba(18,22,28,.4)',
          '--d-base': 'color-mix(in srgb,var(--accent,#7fd6d0) 4%,#f6f7f5)',
          '--d-ghost': 'color-mix(in srgb,var(--accent,#7fd6d0) 16%,rgba(255,255,255,0))' }
      : { '--d-acc': 'var(--accent,#7fd6d0)', '--d-line': 'rgba(255,255,255,.38)',
          '--d-base': 'color-mix(in srgb,var(--accent,#7fd6d0) 6%,#0b0d10)',
          '--d-ghost': 'color-mix(in srgb,var(--accent,#7fd6d0) 14%,rgba(0,0,0,0))' }) as unknown as React.CSSProperties;

  // 고스트 글씨 크기 — 화면 폭의 약 92%에 들어오게 (한글·한자는 글자 폭이 넓어 계수가 다르다)
  const g = (ghost ?? '').trim();
  const wide = /[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ㐀-鿿]/.test(g);
  const gsize = g ? Math.min(30, 92 / Math.max(3, g.length * (wide ? 1.0 : 0.6))) : 0;

  return (
    <div className="cs-deco" aria-hidden="true" style={style} data-mode={mode} data-tone={tone}>
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" focusable="false">
        <defs>
          <pattern id="dc-grid" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M96 0H0V96" fill="none" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </pattern>
          <pattern id="dc-dots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="var(--d-line)" />
          </pattern>
          <linearGradient id="dc-tag" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--d-acc)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--d-acc)" stopOpacity=".08" />
          </linearGradient>
          {band && (
            <>
              <clipPath id="dc-fan"><path d={FAN} /></clipPath>
              {blur > 0 && <filter id="dc-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={blur} /></filter>}
            </>
          )}
        </defs>

        {/* 바탕 — 이미지를 전체 배경으로 쓰는 경우(mono)에는 칠하지 않고 그대로 비친다 */}
        {!mono && <rect width="1920" height="1080" fill="var(--d-base)" />}
        {/* 아주 옅은 모눈 */}
        <rect width="1920" height="1080" fill="url(#dc-grid)" opacity=".13" />
      </svg>
      {/* 고스트 글씨 — 바탕·모눈 위, 나머지 장식(반원·선·라벨)과 그림 아래 */}
      {g && (
        <div className="cs-deco-ghost" style={{ fontFamily: ghostFont ?? 'var(--serif)', fontSize: `${gsize}vw` }}>{g}</div>
      )}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" focusable="false"
        style={{ position: 'absolute', inset: 0 }}>

        {/* 뒤쪽 큰 반원 — 이미지가 있으면(band) 그 안에 그림을, 없으면 포인트색을 옅게 */}
        {band ? (
          <g clipPath="url(#dc-fan)">
            <image href={image} x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"
              filter={blur > 0 ? 'url(#dc-blur)' : undefined} />
          </g>
        ) : (
          <path d={FAN} fill="var(--d-acc)" opacity={mono ? 0.1 : tone === 'light' ? 0.1 : 0.16} />
        )}
        <path d={FAN} fill="none" stroke="var(--d-acc)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".75" />
        <path d="M312 905 A648 648 0 0 1 1608 905" fill="none" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7" />
        <line x1="230" y1="905" x2="1690" y2="905" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7" />

        {/* 왼쪽 가장자리 — 세로 줄 셋 + 포인트색 막대 */}
        <g stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".75">
          <line x1="20" y1="170" x2="20" y2="930" /><line x1="27" y1="170" x2="27" y2="930" /><line x1="34" y1="170" x2="34" y2="930" />
        </g>
        <rect x="31" y="770" width="6" height="160" fill="var(--d-acc)" />

        {/* 오른쪽 위 — 포인트색 라벨 띠 + 3x3 점 */}
        <rect x="1690" y="62" width="230" height="34" fill="url(#dc-tag)" />
        <text x="1708" y="84" fontSize="13" letterSpacing="4" fontWeight="700" fill="var(--d-line)"
          fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace">CHARACTER FILE</text>
        <g fill="var(--d-acc)" opacity=".85">
          {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => <rect key={r + '' + c} x={1700 + c * 14} y={112 + r * 14} width="7" height="7" />))}
        </g>

        {/* 점 격자 · 십자 표식 · 반짝이 */}
        <rect x="46" y="640" width="168" height="96" fill="url(#dc-dots)" opacity=".65" />
        <rect x="1700" y="560" width="168" height="96" fill="url(#dc-dots)" opacity=".5" />
        <g stroke="var(--d-line)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" opacity=".9">
          {([[96, 560], [1264, 1010], [716, 112], [1856, 420], [330, 800]] as const).map(([x, y]) => (
            <path key={x + '-' + y} d={`M${x - 8} ${y}h16M${x} ${y - 8}v16`} />
          ))}
        </g>
        <g fill="var(--d-acc)">
          {([[1180, 220, 15], [560, 330, 10], [1440, 760, 12], [250, 960, 9], [1110, 150, 8], [1660, 330, 10]] as const).map(([x, y, r]) => (
            <path key={x + '-' + y} transform={`translate(${x} ${y})`}
              d={`M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r}Z`} opacity=".85" />
          ))}
        </g>

        {/* 하단 라벨 — 점선으로 이어진 이름표 */}
        <g fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" fontSize="12" letterSpacing="3">
          <rect x="1560" y="1000" width="84" height="20" fill="var(--d-acc)" />
          <text x="1572" y="1015" fill={mono ? (ink === 'dark' ? '#fff' : '#111') : (tone === 'light' ? '#fff' : '#0b0d10')} fontWeight="700">THEME</text>
          <line x1="1654" y1="1010" x2="1740" y2="1010" stroke="var(--d-line)" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x="1750" y="1015" fill="var(--d-line)" textAnchor="start">{(colorHex ?? '').replace('#', '').toUpperCase().slice(0, 6)}</text>
          <rect x="1560" y="1030" width="84" height="20" fill="none" stroke="var(--d-acc)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x="1572" y="1045" fill="var(--d-line)" fontWeight="700">NAME</text>
          <line x1="1654" y1="1040" x2="1700" y2="1040" stroke="var(--d-line)" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x="1710" y="1045" fill="var(--d-line)">{(name ?? '').toUpperCase().slice(0, 12)}</text>
        </g>
        <g fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace" fill="var(--d-line)" letterSpacing="3">
          <text x="60" y="1046" fontSize="14" fontWeight="800" fill="var(--d-acc)">// ARCHIVE</text>
          <text x="60" y="1064" fontSize="10" letterSpacing="2">CHARACTER PROFILE · ALL RIGHTS RESERVED</text>
          <text x="1262" y="132" fontSize="12">STATUS</text>
        </g>
        <g stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7">
          <line x1="1296" y1="140" x2="1296" y2="330" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={i} x1="1296" y1={150 + i * 24} x2={i % 2 ? 1303 : 1310} y2={150 + i * 24} />)}
        </g>
      </svg>
    </div>
  );
}
