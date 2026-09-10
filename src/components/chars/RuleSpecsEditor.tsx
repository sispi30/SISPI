'use client';
// TRPG 룰 이름 선택 + 룰별 기본 정보 항목 편집 — CharEditForm(기본 정보)과
// 탭 전용 편집 화면(TabEditView, ADD TAB) 양쪽에서 공용으로 쓴다.
// 룰을 선택하지 않으면(rule === '') 아무것도 렌더링하지 않는다 — 그 자리는 각 화면이
// 기존 자유 항목(specs) 편집 UI를 그대로 보여준다(요청 3: 기존 동작 유지).
import React from 'react';
import { KInput, KSelect } from '@/components/ui/Kit';
import {
  RULE_OPTIONS, RULE_CONFIG, RuleFieldDef, Spec, buildSpecsFromRule, emptyRelationRow, statusTotal,
} from '@/lib/charRuleConfig';

export function RuleSelect({ rule, onChange }: { rule: string; specs?: Spec[]; onChange: (rule: string, specs: Spec[]) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span className="k-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>룰 이름</span>
      <div style={{ flex: 1 }}>
        <KSelect value={rule} onChange={v => onChange(v, buildSpecsFromRule(v))}
          options={[{ value: '', label: '선택 안 함 — 자유 항목' }, ...RULE_OPTIONS.map(r => ({ value: r, label: r }))]} />
      </div>
    </div>
  );
}

/** 룰이 선택된 상태에서 그 룰의 필드들을 편집하는 폼 (텍스트/선택/게이지/관계표/기능표/STATUS) */
export function RuleSpecsEditor({ rule, specs, onChange }: {
  rule: string; specs: Spec[]; onChange: (specs: Spec[]) => void;
}) {
  const defs = RULE_CONFIG[rule];
  if (!defs) return null;

  const setSpec = (key: string, patch: Partial<Spec>) =>
    onChange(specs.map(s => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {defs.map(def => {
        const spec = specs.find(s => s.key === def.key) ?? { label: def.label, value: '', key: def.key, type: def.type };
        return (
          <RuleFieldRow key={def.key} def={def} spec={spec}
            onChange={patch => setSpec(def.key, patch)} />
        );
      })}
    </div>
  );
}

function RuleFieldRow({ def, spec, onChange }: {
  def: RuleFieldDef; spec: Spec; onChange: (patch: Partial<Spec>) => void;
}) {
  const rowLabel = <label className="k-label" style={{ margin: '0 0 4px' }}>{def.label}</label>;

  if (def.type === 'text') {
    return (
      <div>
        {rowLabel}
        <KInput value={spec.value} placeholder={def.placeholder} onChange={e => onChange({ value: e.target.value })} />
      </div>
    );
  }

  if (def.type === 'select') {
    return (
      <div>
        {rowLabel}
        <KSelect value={spec.value || def.options?.[0] || ''} onChange={v => onChange({ value: v })}
          options={(def.options ?? []).map(o => ({ value: o, label: o }))} />
      </div>
    );
  }

  if (def.type === 'gauge') {
    const gauges = spec.gauges ?? (def.gaugeKeys ?? []).map(k => ({ key: k, cur: '', max: '', noMax: def.gaugeNoMax?.includes(k) }));
    const setGauge = (gk: string, patch: Partial<typeof gauges[number]>) =>
      onChange({ gauges: gauges.map(g => (g.key === gk ? { ...g, ...patch } : g)) });
    return (
      <div>
        {rowLabel}
        <div style={{ display: 'grid', gap: 6 }}>
          {gauges.map(g => {
            const cur = parseFloat(g.cur) || 0;
            const max = parseFloat(g.max ?? '') || 0;
            const pct = g.noMax ? 100 : (max > 0 ? Math.min(100, Math.max(0, (cur / max) * 100)) : 0);
            return (
              <div key={g.key} style={{ display: 'grid', gridTemplateColumns: '70px 70px 12px 70px 1fr', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>{g.key}</span>
                <KInput type="number" placeholder="현재" value={g.cur} onChange={e => setGauge(g.key, { cur: e.target.value })} style={{ fontSize: 12, padding: '5px 8px' }} />
                {g.noMax ? <span /> : <span style={{ textAlign: 'center' }}>/</span>}
                {g.noMax ? <span /> : (
                  <KInput type="number" placeholder="최대" value={g.max ?? ''} onChange={e => setGauge(g.key, { max: e.target.value })} style={{ fontSize: 12, padding: '5px 8px' }} />
                )}
                <div style={{ height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 5, background: 'var(--accent, #344abd)',
                    ...(g.noMax ? { backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 6px, rgba(255,255,255,0) 6px 12px)' } : {}),
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (def.type === 'relation_table') {
    const columns = spec.relationColumns ?? def.columns ?? [];
    const rows = spec.relationRows ?? [];
    const setRow = (i: number, patch: RelationRowPatch) =>
      onChange({ relationRows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
    return (
      <div>
        {rowLabel}
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
              {columns.map(col => col.type === 'checkbox' ? (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={!!row[col.key]} onChange={e => setRow(i, { [col.key]: e.target.checked })} />
                  {col.label}
                </label>
              ) : (
                <KInput key={col.key} placeholder={col.label} value={(row[col.key] as string) ?? ''}
                  onChange={e => setRow(i, { [col.key]: e.target.value })} style={{ fontSize: 12, padding: '6px 8px', flex: 1, minWidth: 80 }} />
              ))}
              <span className="fx" onClick={() => onChange({ relationRows: rows.filter((_, idx) => idx !== i) })}>✕</span>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, marginTop: 6 }}
          onClick={() => onChange({ relationRows: [...rows, emptyRelationRow(columns)] })}>＋ 행 추가</button>
      </div>
    );
  }

  if (def.type === 'skill_table') {
    const categories = spec.skillCategories ?? def.categories ?? [];
    const checked = spec.skillChecked ?? {};
    const toggle = (cat: string, skill: string) => {
      const k = `${cat}::${skill}`;
      onChange({ skillChecked: { ...checked, [k]: !checked[k] } });
    };
    return (
      <div>
        {rowLabel}
        <div style={{ display: 'grid', gap: 6 }}>
          {categories.map(cat => (
            <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 12, flex: '0 0 50px' }}>{cat.label}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', flex: 1 }}>
                {cat.skills.map(sk => (
                  <label key={sk} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={!!checked[`${cat.label}::${sk}`]} onChange={() => toggle(cat.label, sk)} />
                    {sk}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (def.type === 'status_block') {
    const subStats = spec.subStats ?? def.subStats ?? [];
    const status = spec.status ?? {};
    const set = (patch: Partial<typeof status>) => onChange({ status: { ...status, ...patch } });
    const setSub = (name: string, patch: { cur?: string; max?: string }) =>
      set({ sub: { ...status.sub, [name]: { ...status.sub?.[name], ...patch } } });
    return (
      <div>
        {rowLabel}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <StatusBox label="레벨"><KInput type="number" value={status.level ?? ''} onChange={e => set({ level: e.target.value })} style={{ width: 90 }} /></StatusBox>
          <StatusBox label="프라이드">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <KInput type="number" placeholder="현재" value={status.prideCur ?? ''} onChange={e => set({ prideCur: e.target.value })} style={{ width: 70 }} />
              <span>/</span>
              <KInput type="number" placeholder="최대" value={status.prideMax ?? ''} onChange={e => set({ prideMax: e.target.value })} style={{ width: 70 }} />
            </div>
          </StatusBox>
          {subStats.map(name => (
            <StatusBox key={name} label={name}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <KInput type="number" placeholder="현재" value={status.sub?.[name]?.cur ?? ''} onChange={e => setSub(name, { cur: e.target.value })} style={{ width: 70 }} />
                <span>/</span>
                <KInput type="number" placeholder="최대" value={status.sub?.[name]?.max ?? ''} onChange={e => setSub(name, { max: e.target.value })} style={{ width: 70 }} />
              </div>
            </StatusBox>
          ))}
          <StatusBox label="빚"><KInput type="number" value={status.debt ?? ''} onChange={e => set({ debt: e.target.value })} style={{ width: 90 }} /></StatusBox>
          <StatusBox label="소지금"><KInput type="number" value={status.money ?? ''} onChange={e => set({ money: e.target.value })} style={{ width: 90 }} /></StatusBox>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <StatusBox label="유지비"><KInput type="number" value={status.upkeep ?? ''} onChange={e => set({ upkeep: e.target.value })} style={{ width: 90 }} /></StatusBox>
          <span style={{ fontWeight: 700, color: '#999' }}>+</span>
          <StatusBox label="이자"><KInput type="number" value={status.interest ?? ''} onChange={e => set({ interest: e.target.value })} style={{ width: 90 }} /></StatusBox>
          <span style={{ fontWeight: 700, color: '#999' }}>=</span>
          <StatusBox label="총 지불액"><b style={{ display: 'inline-block', minWidth: 70, fontSize: 15 }}>{statusTotal(status)}</b></StatusBox>
        </div>
      </div>
    );
  }

  if (def.type === 'radar_stats') {
    const statLabels = spec.statLabels ?? def.statLabels ?? [];
    const statMax = spec.statMax ?? def.statMax ?? 10;
    const gradeMap = spec.gradeMap ?? def.gradeMap;
    const values = spec.statValues ?? statLabels.map(() => 0);
    const setVal = (i: number, v: number) =>
      onChange({ statLabels, statMax, gradeMap, statValues: values.map((x, idx) => (idx === i ? v : x)) });
    return (
      <div>
        {rowLabel}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {statLabels.map((lb, i) => {
            const grades = gradeMap?.[lb];
            return (
              <div key={lb} style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 9px' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>{lb}</label>
                {grades ? (
                  <KSelect value={String(values[i] ?? Object.keys(grades)[0] ?? 1)} onChange={v => setVal(i, Number(v))}
                    options={Object.entries(grades).map(([n, name]) => ({ value: n, label: `${n} · ${name}` }))} />
                ) : (
                  <KInput type="number" min={0} max={statMax} value={String(values[i] ?? 0)}
                    onChange={e => setVal(i, Number(e.target.value))} style={{ fontSize: 12, padding: '5px 8px' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

type RelationRowPatch = Record<string, string | boolean>;

function StatusBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
