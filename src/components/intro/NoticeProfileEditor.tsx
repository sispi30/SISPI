'use client';
/**
 * 인트로 프로필 양식 — EDIT 폼.
 * 목록 칸은 「한 줄 = 한 항목」 텍스트 칸으로 받는다 (순서 바꾸기·붙여 넣기가 가장 쉽다).
 * 편집 중에는 빈 줄을 지우지 않는다 — 줄바꿈을 치는 순간 사라지면 다음 항목을 쓸 수 없다.
 * 빈 줄 정리는 저장할 때 한다 (cleanProfile).
 */
import React, { useRef } from 'react';
import { KInput, KLabel, KTextarea } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { putBlob } from '@/lib/blobStore';
import type { IntroProfile, ListBlock } from '@/lib/introStore';

const cleanArr = (a: string[]) => a.map(s => s.trim()).filter(Boolean);

/** 저장 직전 정리 — 빈 줄·빈 항목을 걷어 낸다 */
export function cleanProfile(p: IntroProfile): IntroProfile {
  return {
    ...p,
    profile: cleanArr(p.profile), flow: cleanArr(p.flow),
    kwQuotes: cleanArr(p.kwQuotes), kwTags: cleanArr(p.kwTags), palette: cleanArr(p.palette),
    stats: p.stats.filter(s => s.value.trim() || s.label.trim()),
    cols: p.cols.map(c => ({ ...c, items: cleanArr(c.items) })).filter(c => c.title.trim() || c.items.length),
    notes: p.notes.map(c => ({ ...c, items: cleanArr(c.items) })).filter(c => c.title.trim() || c.items.length),
  };
}

function Lines({ value, onChange, rows = 3, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; rows?: number; placeholder?: string;
}) {
  return (
    <KTextarea rows={rows} placeholder={placeholder} value={value.join('\n')}
      onChange={e => onChange(e.target.value.split('\n'))} style={{ minHeight: rows * 26 }} />
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <KLabel>{label}</KLabel>
      {children}
      {hint && <p className="hint" style={{ margin: '6px 0 0' }}>{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 0, borderTop: '1px solid var(--line)', margin: '0 0 6px', padding: '18px 0 6px' }}>
      <legend style={{ fontSize: 11, letterSpacing: '.22em', color: 'var(--faint)', padding: '0 10px 0 0' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Blocks({ blocks, onChange, max, noun, ph }: {
  blocks: ListBlock[]; onChange: (b: ListBlock[]) => void; max: number; noun: string; ph: string;
}) {
  const set = (i: number, b: Partial<ListBlock>) => onChange(blocks.map((x, j) => (j === i ? { ...x, ...b } : x)));
  return (
    <>
      {blocks.map((b, i) => (
        <div key={i} style={{ marginBottom: 14, padding: 12, border: '1px solid var(--line)', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <KInput value={b.title} placeholder={`${noun} 제목`} onChange={e => set(i, { title: e.target.value })} />
            <button type="button" className="btn btn-ghost" onClick={() => onChange(blocks.filter((_, j) => j !== i))}>삭제</button>
          </div>
          <Lines value={b.items} onChange={items => set(i, { items })} rows={4} placeholder={ph} />
        </div>
      ))}
      {blocks.length < max && (
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...blocks, { title: '', items: [] }])}>+ {noun} 추가</button>
      )}
    </>
  );
}

export function NoticeProfileEditor({ value: p, onChange }: { value: IntroProfile; onChange: (p: IntroProfile) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<IntroProfile>) => onChange({ ...p, ...patch });

  const pickImage = async (f?: File) => {
    if (!f) return;
    try { set({ heroImg: await putBlob(f) }); }
    catch { toast('이미지를 올리지 못했습니다'); }
  };

  return (
    <div>
      <Group title="TOP — 이름 · 한 줄 소개">
        <Field label="이름 (큰 글씨)"><KInput value={p.name} onChange={e => set({ name: e.target.value })} /></Field>
        <Field label="이름 아래 작은 라벨"><KInput value={p.sub} onChange={e => set({ sub: e.target.value })} /></Field>
        <Field label="한 줄 소개"><KTextarea rows={2} value={p.quote} onChange={e => set({ quote: e.target.value })} /></Field>
      </Group>

      <Group title="PROFILE — 오른쪽 위 점 목록">
        <Field label="제목"><KInput value={p.profileTitle} onChange={e => set({ profileTitle: e.target.value })} /></Field>
        <Field label="내용" hint="한 줄이 한 항목입니다.">
          <Lines value={p.profile} onChange={profile => set({ profile })} rows={5} />
        </Field>
      </Group>

      <Group title="IMAGE — 가운데 큰 이미지">
        <Field label="이미지" hint="파일을 올리거나 주소(https://…)를 붙여 넣으세요. 비워 두면 이 칸은 나오지 않습니다.">
          <div style={{ display: 'flex', gap: 8 }}>
            <KInput value={/^https?:/.test(p.heroImg) ? p.heroImg : ''} placeholder={p.heroImg && !/^https?:/.test(p.heroImg) ? '(올린 파일 사용 중)' : 'https://'}
              onChange={e => set({ heroImg: e.target.value })} />
            <button type="button" className="btn btn-dark" onClick={() => fileRef.current?.click()}>올리기</button>
            {p.heroImg && <button type="button" className="btn btn-ghost" onClick={() => set({ heroImg: '' })}>제거</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <Field label="게이지 이름" hint="비우면 게이지를 숨깁니다."><KInput value={p.heroLabel} onChange={e => set({ heroLabel: e.target.value })} /></Field>
          <Field label="게이지 %"><KInput type="number" min={0} max={100} value={p.heroPercent}
            onChange={e => set({ heroPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></Field>
          <Field label="오른쪽 위 표시"><KInput value={p.heroCount} placeholder="×4" onChange={e => set({ heroCount: e.target.value })} /></Field>
        </div>
      </Group>

      <Group title="ACCOUNT — 큼직한 값 + 라벨">
        <Field label="제목"><KInput value={p.accountTitle} onChange={e => set({ accountTitle: e.target.value })} /></Field>
        {p.stats.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <KInput value={s.value} placeholder="값 (예: 성인)"
              onChange={e => set({ stats: p.stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
            <KInput value={s.label} placeholder="라벨 (예: 연령)"
              onChange={e => set({ stats: p.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <button type="button" className="btn btn-ghost" onClick={() => set({ stats: p.stats.filter((_, j) => j !== i) })}>삭제</button>
          </div>
        ))}
        {p.stats.length < 4 && (
          <button type="button" className="btn btn-ghost" onClick={() => set({ stats: [...p.stats, { value: '', label: '' }] })}>+ 항목 추가</button>
        )}
      </Group>

      <Group title="LOVE / HATE — 번호 붙은 목록 열">
        <Blocks blocks={p.cols} onChange={cols => set({ cols })} max={3} noun="열" ph="한 줄이 한 항목 (번호는 자동)" />
      </Group>

      <Group title="FLOW — 알약 → 알약">
        <Field label="제목"><KInput value={p.flowTitle} onChange={e => set({ flowTitle: e.target.value })} /></Field>
        <Field label="단계" hint="한 줄이 한 단계입니다. 게이지는 단계 수에 맞춰 자동으로 차오릅니다.">
          <Lines value={p.flow} onChange={flow => set({ flow })} rows={3} />
        </Field>
      </Group>

      <Group title="KEYWORDS">
        <Field label="제목"><KInput value={p.kwTitle} onChange={e => set({ kwTitle: e.target.value })} /></Field>
        <Field label="밑줄 문장" hint="한 줄이 한 문장입니다.">
          <Lines value={p.kwQuotes} onChange={kwQuotes => set({ kwQuotes })} rows={2} />
        </Field>
        <Field label="한 줄 메모"><KInput value={p.kwLine} onChange={e => set({ kwLine: e.target.value })} /></Field>
        <Field label="태그" hint="한 줄이 한 태그입니다.">
          <Lines value={p.kwTags} onChange={kwTags => set({ kwTags })} rows={3} />
        </Field>
      </Group>

      <Group title="COLOR PALETTE">
        <Field label="제목"><KInput value={p.palTitle} onChange={e => set({ palTitle: e.target.value })} /></Field>
        <Field label="색" hint="한 줄에 색 코드 하나 (예: #99A7B7). 코드가 아닌 줄은 나오지 않습니다.">
          <Lines value={p.palette} onChange={palette => set({ palette })} rows={3} />
        </Field>
      </Group>

      <Group title="NOTES — 아래 문단 칸 (NO / 뒷담 관련 …)">
        <Blocks blocks={p.notes} onChange={notes => set({ notes })} max={3} noun="칸" ph="한 줄이 한 문단" />
      </Group>
    </div>
  );
}
