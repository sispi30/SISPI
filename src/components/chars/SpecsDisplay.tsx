'use client';
// 기본 정보/탭 정보란 표시 — 자유 항목(text/select)은 라벨-값이 같은 줄에서
// 좌우로 정렬되는 한 줄 행으로, 구조화된 항목(게이지/관계표/기능표/STATUS/레이더차트)은
// 라벨을 위에 두고 그 아래 전체 폭으로 내용을 그린다.
// (기존에는 사이트 공통 .spec 클래스의 고정폭 라벨 칸(76px)을 그대로 썼는데,
//  룰 라벨이 길어지면서 라벨 자체가 여러 줄로 꺾이고 값이 그 아래로 밀려나 보이는 문제가 있었음)
import { Spec, statusTotal } from '@/lib/charRuleConfig';

export function SpecsDisplay({ specs }: { specs: Spec[] }) {
  return (
    <div style={{ marginBottom: 18, fontSize: 'calc(12.5px*var(--fs,1))' }}>
      {specs.map((s, i) => <SpecRow key={s.key ?? s.label ?? i} s={s} />)}
    </div>
  );
}

function SpecRow({ s }: { s: Spec }) {
  const simple = !s.type || s.type === 'text' || s.type === 'select';
  if (simple) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '6px 0' }}>
        <span style={{ color: 'var(--faint)', letterSpacing: '.06em', flexShrink: 0 }}>{s.label}</span>
        <span style={{ color: 'var(--ink)', textAlign: 'right' }}><SpecValue s={s} /></span>
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ color: 'var(--faint)', letterSpacing: '.06em', marginBottom: 7 }}>{s.label}</div>
      {/* 라벨은 그대로 왼쪽, 내용(게이지·관계표·기능표·STATUS·레이더차트)만 가운데로.
          inline-block로 폭을 특정하지 않으면 게이지 바 등 flex:1 자식의 너비 계산이 깨져서,
          고정 상한폭(520px, 좁으면 100%)을 주고 margin:auto로 가운데 정렬한다 */}
      <div style={{ width: 'min(520px, 100%)', margin: '0 auto' }}>
        <SpecValue s={s} />
      </div>
    </div>
  );
}

function SpecValue({ s }: { s: Spec }) {
  if (s.type === 'gauge' && s.gauges?.length) {
    return (
      <div style={{ display: 'grid', gap: 5 }}>
        {s.gauges.map(g => {
          const cur = parseFloat(g.cur) || 0;
          const max = parseFloat(g.max ?? '') || 0;
          const pct = g.noMax ? 100 : (max > 0 ? Math.min(100, Math.max(0, (cur / max) * 100)) : 0);
          return (
            <div key={g.key} style={{ display: 'grid', gridTemplateColumns: '46px 1fr', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{g.key}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 8, flex: 1, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 4, background: 'var(--accent, #344abd)',
                    ...(g.noMax ? { backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 6px, rgba(255,255,255,0) 6px 12px)' } : {}),
                  }} />
                </div>
                <span style={{ color: 'var(--faint)', whiteSpace: 'nowrap' }}>{g.noMax ? g.cur || '0' : `${g.cur || '0'}/${g.max || '0'}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (s.type === 'relation_table') {
    const columns = s.relationColumns ?? [];
    const rows = s.relationRows ?? [];
    if (!rows.length) return <span style={{ color: 'var(--faint)' }}>—</span>;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ fontSize: 12, background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 9px' }}>
            {columns.map((c, ci) => {
              const v = row[c.key];
              const shown = c.type === 'checkbox' ? (v ? '✓' : '') : (v as string) || '';
              if (!shown) return null;
              return <span key={c.key} style={{ marginRight: ci < columns.length - 1 ? 10 : 0 }}><b style={{ color: 'var(--faint)', fontWeight: 600 }}>{c.label}</b> {shown}</span>;
            })}
          </div>
        ))}
      </div>
    );
  }

  if (s.type === 'skill_table') {
    const checked = Object.entries(s.skillChecked ?? {}).filter(([, v]) => v).map(([k]) => k.split('::')[1]);
    if (!checked.length) return <span style={{ color: 'var(--faint)' }}>—</span>;
    return <span>{checked.join(', ')}</span>;
  }

  if (s.type === 'status_block') {
    const st = s.status ?? {};
    const parts: string[] = [];
    if (st.level) parts.push(`레벨 ${st.level}`);
    if (st.prideCur || st.prideMax) parts.push(`프라이드 ${st.prideCur || '0'}/${st.prideMax || '0'}`);
    Object.entries(st.sub ?? {}).forEach(([name, v]) => {
      if (v.cur || v.max) parts.push(`${name} ${v.cur || '0'}/${v.max || '0'}`);
    });
    if (st.debt) parts.push(`빚 ${st.debt}`);
    if (st.money) parts.push(`소지금 ${st.money}`);
    const total = statusTotal(st);
    if (st.upkeep || st.interest) parts.push(`유지비+이자 = ${total}`);
    return <span>{parts.length ? parts.join(' · ') : '—'}</span>;
  }

  if (s.type === 'radar_stats') {
    const labels = s.statLabels ?? [];
    const max = s.statMax ?? 10;
    const values = s.statValues ?? labels.map(() => 0);
    const gradeMap = s.gradeMap;
    if (!labels.length) return <span style={{ color: 'var(--faint)' }}>—</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <RadarChart labels={labels} values={values} max={max} />
        <div style={{ display: 'grid', gap: 3, fontSize: 12 }}>
          {labels.map((lb, i) => {
            const v = values[i] ?? 0;
            const graded = gradeMap?.[lb]?.[v];
            return <div key={lb}><b style={{ color: 'var(--faint)', fontWeight: 600 }}>{lb}</b> {graded ? `${v} · ${graded}` : v}</div>;
          })}
        </div>
      </div>
    );
  }

  return <>{s.value}</>;
}

/** 룰별 특성치 레이더 차트 — 그누보드 스킨의 radar-chart(.radar-chart-container)를 SVG로 재현 */
function RadarChart({ labels, values, max }: { labels: string[]; values: number[]; max: number }) {
  const size = 180;
  const center = size / 2;
  const radius = size / 2 - 26;
  const n = labels.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointFor = (i: number, v: number): [number, number] => {
    const r = (Math.max(0, Math.min(v, max)) / (max || 1)) * radius;
    const a = angleFor(i);
    return [center + r * Math.cos(a), center + r * Math.sin(a)];
  };
  const poly = labels.map((_, i) => pointFor(i, values[i] ?? 0).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0 }}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={labels.map((_, i) => pointFor(i, max * f).join(',')).join(' ')}
          fill="none" stroke="#eee" strokeWidth={1} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pointFor(i, max);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="var(--accent, #344abd)" fillOpacity={0.25} stroke="var(--accent, #344abd)" strokeWidth={1.5} />
      {labels.map((lb, i) => {
        const [x, y] = pointFor(i, max * 1.16);
        return <text key={lb} x={x} y={y} fontSize={10} textAnchor="middle" dominantBaseline="middle" fill="#888">{lb}</text>;
      })}
    </svg>
  );
}
