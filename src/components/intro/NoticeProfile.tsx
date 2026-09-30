'use client';
/**
 * 인트로 프로필 양식 — 보기 화면.
 * 비어 있는 칸은 통째로 감춘다(쓰지 않은 칸의 제목만 덩그러니 남지 않게).
 * 글자는 전부 React가 이스케이프해서 그리므로 별도 정화가 필요 없다.
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { normalizeInternalLink } from '@/lib/link';
import { isValidColor, normalizeColor } from '@/lib/color';
import type { IntroProfile } from '@/lib/introStore';

export const clean = (a: string[]) => a.map(s => s.trim()).filter(Boolean);
/** 줄바꿈·빈 줄은 그대로 두고, 맨 앞뒤의 빈 줄만 뺀다 (한 줄 소개와 같은 방식) */
export const keepLines = (a: string[]) => a.map(s => s.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
const num = (i: number) => String(i + 1).padStart(2, '0');

/** 가운데 큰 이미지 — 메인 「슬라이드 배너」와 같은 출력(크로스페이드 · 캡션 · 점 · 링크 · 같은 비율) */
function Hero({ p }: { p: IntroProfile }) {
  const router = useRouter();
  const slides = p.heroSlides.filter(sl => sl.imgId || sl.img || sl.cap.trim());
  const [cur, setCur] = useState(0);
  const interval = p.heroInterval;

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setCur(c => (c + 1) % slides.length), Math.max(2, interval) * 1000);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  if (!slides.length) return null;
  const at = Math.min(cur, slides.length - 1);
  const s = slides[at];
  const pct = Math.max(0, Math.min(100, p.heroPercent));
  const go = () => {
    if (!s.link) return;
    const l = normalizeInternalLink(s.link);
    if (/^https?:\/\//.test(l)) window.open(l, '_blank');
    else router.push(l);
  };

  return (
    <div className="np-hero">
      <div className="np-phone">
        <div className="banner" style={{ cursor: s.link ? 'pointer' : undefined }} onClick={go}>
          {slides.map((sl, i) => (
            <div key={sl.id} className={`slide ${i === at ? 'on' : ''}`}>
              {sl.imgId
                ? <CroppedBlobImg fileRef={sl.imgId} crop={sl.crop} ph="" />
                : sl.img
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={sl.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div className="ph" style={{ position: 'absolute', inset: 0 }} />}
            </div>
          ))}
          {p.heroLabel.trim() && (
            <div className="np-hud">
              <span className="np-hud-lab">{p.heroLabel}</span>
              <span className="np-bar"><i style={{ width: `${pct}%` }} /></span>
              <span className="np-hud-pct">{pct}%</span>
            </div>
          )}
          {p.heroCount.trim() && <span className="np-count">{p.heroCount}</span>}
          <div className="cap"><b>{s.cap}</b><span>{s.sub}</span></div>
          <div className="dots" onClick={e => e.stopPropagation()}>
            {slides.map((sl, i) => (
              <i key={sl.id} className={i === at ? 'on' : ''} onClick={() => setCur(i)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NoticeProfile({ p }: { p: IntroProfile }) {
  const profile = clean(p.profile);
  const stats = p.stats.filter(s => s.value.trim() || s.label.trim());
  const cols = p.cols.filter(c => clean(c.items).length);
  const flow = clean(p.flow);
  const kwQuotes = clean(p.kwQuotes), kwTags = clean(p.kwTags);
  const pal = clean(p.palette).filter(isValidColor);
  const hasKw = kwQuotes.length || p.kwLine.trim() || kwTags.length;
  const notes = p.notes.filter(n => clean(n.items).length);
  const midCols = (stats.length ? 1 : 0) + cols.length;

  return (
    <div className="np">
      <div className="np-top">
        <div className="np-id">
          {p.name.trim() && <h2 className="np-name">{p.name}</h2>}
          {p.sub.trim() && <div className="np-sub">{p.sub}</div>}
          {p.quote.trim() && <p className="np-quote">{p.quote}</p>}
          <i className="np-rule" />
        </div>
        {profile.length > 0 && (
          <div className="np-prof">
            {p.profileTitle.trim() && <div className="np-lab">{p.profileTitle}</div>}
            <ul>{profile.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}
      </div>

      <Hero p={p} />

      {midCols > 0 && (
        <div className="np-mid" style={{ ['--n' as string]: midCols }}>
          {stats.length > 0 && (
            <div className="np-cell">
              {p.accountTitle.trim() && <div className="np-lab">{p.accountTitle}</div>}
              <div className="np-stats">
                {stats.map((s, i) => (
                  <div key={i}><b>{s.value}</b><span>{s.label}</span></div>
                ))}
              </div>
            </div>
          )}
          {cols.map((c, ci) => (
            <div className="np-cell" key={ci}>
              {c.title.trim() && <div className="np-lab">{c.title}</div>}
              <ol className="np-nlist">
                {clean(c.items).map((t, i) => <li key={i}><em>{num(i)}</em><span>{t}</span></li>)}
              </ol>
            </div>
          ))}
        </div>
      )}

      {(flow.length > 0 || hasKw || pal.length > 0) && (
        <div className={`np-row2${flow.length && (hasKw || pal.length) ? ' two' : ''}`}>
          {flow.length > 0 && (
            <div className="np-cell">
              {p.flowTitle.trim() && <div className="np-lab">{p.flowTitle}</div>}
              <div className="np-flow">
                {flow.map((t, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="np-arrow">→</span>}
                    <div className="np-step">
                      <span className="np-pill"><i style={{ width: `${Math.round(((i + 1) / flow.length) * 100)}%` }} /></span>
                      <span className="np-steplab">{t}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          {(hasKw || pal.length > 0) && (
            <div className="np-cell">
              {hasKw && (
                <>
                  {p.kwTitle.trim() && <div className="np-lab">{p.kwTitle}</div>}
                  {kwQuotes.length > 0 && (
                    <div className="np-quotes">{kwQuotes.map((t, i) => <span key={i}>{t}</span>)}</div>
                  )}
                  {p.kwLine.trim() && <div className="np-kwline">{p.kwLine}</div>}
                  {kwTags.length > 0 && (
                    <ul className="np-tags">{kwTags.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  )}
                </>
              )}
              {pal.length > 0 && (
                <>
                  {p.palTitle.trim() && <div className="np-lab" style={{ marginTop: hasKw ? 26 : 0 }}>{p.palTitle}</div>}
                  <div className="np-pal">
                    {pal.map((c, i) => {
                      const n = normalizeColor(c);
                      return <div key={i}><i style={{ background: n }} /><span>{n.replace('#', '').toUpperCase()}</span></div>;
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <div className="np-notes" style={{ ['--n' as string]: notes.length }}>
          {notes.map((n, ni) => (
            <div className="np-cell" key={ni}>
              {n.title.trim() && <div className="np-lab">{n.title}</div>}
              <p>{keepLines(n.items)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
