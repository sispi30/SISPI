'use client';
/**
 * 인트로 프로필 양식 — 보기 화면.
 * 비어 있는 칸은 통째로 감춘다(쓰지 않은 칸의 제목만 덩그러니 남지 않게).
 * 글자는 전부 React가 이스케이프해서 그리므로 별도 정화가 필요 없다.
 */
import React from 'react';
import { useBlobUrl } from '@/lib/blobStore';
import { isValidColor, normalizeColor } from '@/lib/color';
import type { IntroProfile } from '@/lib/introStore';

export const clean = (a: string[]) => a.map(s => s.trim()).filter(Boolean);
const num = (i: number) => String(i + 1).padStart(2, '0');

function Hero({ p }: { p: IntroProfile }) {
  const src = useBlobUrl(p.heroImg.trim() || undefined);
  if (!p.heroImg.trim()) return null;
  const pct = Math.max(0, Math.min(100, p.heroPercent));
  return (
    <div className="np-hero">
      <div className="np-phone">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        )}
        {p.heroLabel.trim() && (
          <div className="np-hud">
            <span className="np-hud-lab">{p.heroLabel}</span>
            <span className="np-bar"><i style={{ width: `${pct}%` }} /></span>
            <span className="np-hud-pct">{pct}%</span>
          </div>
        )}
        {p.heroCount.trim() && <span className="np-count">{p.heroCount}</span>}
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
              {clean(n.items).map((t, i) => <p key={i}>{t}</p>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
