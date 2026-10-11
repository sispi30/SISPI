'use client';
// 상세(스테이지) 배경 장식 — 대각 띠 · 동심원 · 십자 표식 · 모서리 괄호 · 점 격자 · 빗금 같은
// 얇은 디자인 요소를 그림 뒤에 깐다. 글자와 그림보다 늘 뒤(z-index 0)이고 클릭을 받지 않는다.
//
// 색
//  · 포인트색 = 페이지의 --accent (캐릭터 테마색 모드면 그 색으로 이미 바뀌어 있다)
//  · 바탕·선 색 = 밝은 테마는 흰색 계열, 어두운 테마는 검은색 계열 (tone — 배경 밝기에서 정한다)
// 배경 이미지를 등록한 경우 (mode)
//  · 'band' : 이미지를 대각 띠 안에 넣고, 나머지는 포인트색 장식 + 테마 바탕
//  · 'mono' : 이미지는 전체 배경 그대로, 장식 요소만 흰색/검은색(이미지 밝기에 맞춰)으로
import React from 'react';

export type DecoMode = 'accent' | 'mono';

interface Props {
  mode: DecoMode;
  /** 장식 바탕·선의 계열 — 'light'=밝은(흰색 계열) 테마 · 'dark'=어두운(검은색 계열) 테마 */
  tone: 'light' | 'dark';
  /** mode='mono'일 때 장식 색 — 'dark'=검정 · 'light'=흰색 (이미지 밝기에 맞춘 값) */
  ink: 'light' | 'dark';
  /** mode='band'일 때 띠 안에 넣을 이미지와 블러(px) */
  image?: string;
  blur?: number;
}

const BAND = '0,930 1920,250 1920,585 520,1080 0,1080';

export function StageDeco({ mode, tone, ink, image, blur = 0 }: Props) {
  const mono = mode === 'mono';
  const band = mode === 'accent' && !!image;
  const style = (mono
    ? { '--d-acc': ink === 'dark' ? '#111418' : '#ffffff', '--d-line': ink === 'dark' ? 'rgba(10,12,16,.55)' : 'rgba(255,255,255,.6)' }
    : tone === 'light'
      ? { '--d-acc': 'var(--accent,#7fd6d0)', '--d-line': 'rgba(18,22,28,.42)',
          '--d-base': 'color-mix(in srgb,var(--accent,#7fd6d0) 5%,#f5f6f3)' }
      : { '--d-acc': 'var(--accent,#7fd6d0)', '--d-line': 'rgba(255,255,255,.4)',
          '--d-base': 'color-mix(in srgb,var(--accent,#7fd6d0) 7%,#0b0d10)' }) as unknown as React.CSSProperties;
  const bandFill = mono ? 0.13 : (band ? 1 : (tone === 'light' ? 0.2 : 0.3));
  return (
    <div className="cs-deco" aria-hidden="true" style={style} data-mode={mode} data-tone={tone}>
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" focusable="false">
        <defs>
          <pattern id="dc-dots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="var(--d-line)" />
          </pattern>
          <pattern id="dc-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="4.5" height="9" fill="var(--d-acc)" />
          </pattern>
          {band && (
            <>
              <clipPath id="dc-band"><polygon points={BAND} /></clipPath>
              {blur > 0 && <filter id="dc-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={blur} /></filter>}
            </>
          )}
        </defs>

        {/* 바탕 — 이미지를 전체 배경으로 쓰는 경우(mono)에는 칠하지 않고 그대로 비친다 */}
        {!mono && <rect width="1920" height="1080" fill="var(--d-base)" />}

        {/* 큰 원 윤곽 · 점 격자 */}
        <g fill="none" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".55">
          <circle cx="640" cy="-30" r="330" vectorEffect="non-scaling-stroke" />
          <circle cx="640" cy="-30" r="262" strokeDasharray="3 7" vectorEffect="non-scaling-stroke" />
          <circle cx="1560" cy="960" r="250" vectorEffect="non-scaling-stroke" />
          <circle cx="1560" cy="960" r="200" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
        </g>
        <rect x="40" y="620" width="170" height="108" fill="url(#dc-dots)" opacity=".7" />
        <rect x="1690" y="150" width="190" height="96" fill="url(#dc-dots)" opacity=".7" />

        {/* 대각 띠 — 이미지가 있으면(band) 그 안에 그림을, 없으면 포인트색을 옅게 */}
        {band ? (
          <g clipPath="url(#dc-band)">
            <image href={image} x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"
              filter={blur > 0 ? 'url(#dc-blur)' : undefined} />
          </g>
        ) : (
          <polygon points={BAND} fill="var(--d-acc)" opacity={bandFill} />
        )}
        {/* 띠 가장자리의 가는 줄 두 개 + 굵은 포인트 줄 */}
        <polygon points="0,898 1920,218 1920,232 0,912" fill="var(--d-acc)" />
        <line x1="0" y1="944" x2="1920" y2="264" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="540" y1="1080" x2="1920" y2="596" stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {/* 모서리의 포인트색 면 */}
        <polygon points="0,1002 0,1080 250,1080" fill="var(--d-acc)" />

        {/* 빗금 상자 */}
        <rect x="46" y="1030" width="124" height="20" fill="url(#dc-hatch)" opacity=".9" />

        {/* 동심원 표식 */}
        <g transform="translate(1800 760)" fill="none" stroke="var(--d-acc)" opacity=".5">
          <circle r="92" strokeWidth="10" />
          <circle r="48" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle r="16" fill="var(--d-acc)" stroke="none" />
        </g>

        {/* 모서리 괄호 */}
        <g fill="none" stroke="var(--d-acc)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="square">
          <path d="M560 168 h34 M560 168 v34" /><path d="M690 168 h-34 M690 168 v34" />
          <path d="M560 262 h34 M560 262 v-34" /><path d="M690 262 h-34 M690 262 v-34" />
        </g>

        {/* 십자 표식 */}
        <g stroke="var(--d-line)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" opacity=".9">
          {([[96, 790], [1264, 1010], [716, 112], [1856, 420], [330, 560]] as const).map(([x, y]) => (
            <path key={x + '-' + y} d={`M${x - 8} ${y}h16M${x} ${y - 8}v16`} />
          ))}
        </g>
        {/* 작은 마름모 점 */}
        <g fill="var(--d-acc)">
          {([[1872, 126], [1872, 152], [1872, 178]] as const).map(([x, y]) => <rect key={y} x={x - 4} y={y - 4} width="8" height="8" transform={`rotate(45 ${x} ${y})`} />)}
        </g>

        {/* 얇은 세로 눈금 */}
        <g stroke="var(--d-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".7">
          <line x1="1296" y1="140" x2="1296" y2="330" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={i} x1="1296" y1={150 + i * 24} x2={i % 2 ? 1303 : 1310} y2={150 + i * 24} />)}
        </g>

        {/* 하단 사선 + 점 */}
        <line x1="790" y1="1054" x2="930" y2="920" stroke="var(--d-line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx="930" cy="920" r="5" fill="var(--d-acc)" />

        {/* 작은 글씨 */}
        <g fill="var(--d-line)" fontSize="12" letterSpacing="3" fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace">
          <text x="612" y="148">// CHARACTER</text>
          <text x="1262" y="132">STATUS</text>
          <text x="980" y="1056">PROFILE MODULE</text>
        </g>
      </svg>
    </div>
  );
}
