'use client';
// 리치 텍스트 에디터 (TipTap) — 프로필 탭 등 HTML 콘텐츠 작성용
// 자체 스타일 툴바 (7장 — 기본 UI 금지) · 출력은 HTML, 저장 시 새니타이즈는 렌더 쪽에서 (6.3)
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Mark, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import { putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';

/** 로컬 모드용 — 파일을 그대로 본문에 심는다 (서버가 없어 올릴 곳이 없을 때) */
function toDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

/** 글자색(대표 테마색) 표식 — <span data-theme-color="#hex" style="color:#hex">. 색은 #rrggbb만 받는다 */
const ThemeColor = Mark.create({
  name: 'themeColor',
  addAttributes() {
    return {
      // 'theme' = 캐릭터 대표 테마색을 따라간다(페이지가 --char-theme로 현재 색을 내려줌), #rrggbb = 옛 데이터(고정 색)
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-theme-color'),
        renderHTML: (attrs: { color?: string | null; fb?: string | null }) => {
          if (!attrs.color) return {};
          if (attrs.color !== 'theme') return { 'data-theme-color': attrs.color, style: `color:${attrs.color}` };
          // 변수를 못 받는 곳(목록·미리보기 등)에서도 읽히도록 저장 시점의 색을 대체값으로
          return { 'data-theme-color': 'theme', style: `color:var(--char-theme${attrs.fb ? `,${attrs.fb}` : ''})` };
        },
      },
      fb: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-theme-fb'),
        renderHTML: (attrs: { color?: string | null; fb?: string | null }) => (attrs.color === 'theme' && attrs.fb ? { 'data-theme-fb': attrs.fb } : {}),
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-theme-color]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
});

/** 블록 서식(제목·목록·인용)은 원래 커서가 놓인 줄(문단) 전체에 걸린다 — 그래서 일부만 골라도 같은 문단의 나머지 글까지 같이 바뀌었다.
 *  서식을 적용하기 전에 선택 시작·끝 지점에서 문단을 나눠, 고른 부분만 따로 한 줄이 되게 한다.
 *  (Shift+Enter 줄바꿈으로 이어진 줄은 그 줄바꿈 자리에서 나누고 줄바꿈은 없앤다. 선택이 문단 경계에 있으면 나누지 않는다) */
function splitAtSelection({ tr }: { tr: Transaction }) {
  if (tr.selection.empty) return true;
  let f = tr.selection.from, t = tr.selection.to;
  const depthFor = (pos: number) => {
    const $p = tr.doc.resolve(pos);
    return $p.depth >= 2 && $p.node($p.depth - 1).type.name === 'listItem' ? 2 : 1;
  };
  const textblockAt = (pos: number) => tr.doc.resolve(pos).parent.isTextblock;
  if (!textblockAt(f) || !textblockAt(t)) return true;
  // 끝 지점 먼저 (앞쪽 위치가 밀리지 않게)
  {
    const $t = tr.doc.resolve(t);
    if ($t.nodeAfter?.type.name === 'hardBreak') tr.delete(t, t + 1);
    const $t2 = tr.doc.resolve(t);
    if ($t2.parentOffset < $t2.parent.content.size) tr.split(t, depthFor(t));
  }
  {
    const $f = tr.doc.resolve(f);
    if ($f.nodeBefore?.type.name === 'hardBreak') { tr.delete(f - 1, f); f -= 1; t -= 1; }
    const $f2 = tr.doc.resolve(f);
    if ($f2.parentOffset > 0) { const d = depthFor(f); tr.split(f, d); f += 2 * d; t += 2 * d; }
  }
  tr.setSelection(TextSelection.create(tr.doc, f, t));
  return true;
}

function TBtn({ on, label, title, onClick }: { on?: boolean; label: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" data-tip={title} className={`re-btn ${on ? 'on' : ''}`}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );
}

export function RichEditor({ value, onChange, placeholder, themeColor }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** 있으면 툴바에 「선택한 글자를 이 색(대표 테마색)으로」 버튼이 생긴다 */
  themeColor?: string;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Image, ThemeColor],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 're-content prose' },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // 외부 값이 완전히 바뀐 경우(탭 전환) 동기화
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="re-wrap" style={{ minHeight: 200 }} />;

  /* 이미지는 **올려서** 넣는다 (v2.0 사용자 요청 — 예전엔 URL을 직접 적게 했다).
     다른 이미지들과 같은 경로(putBlob)를 타므로 서버 모드면 저장소에 올라가고 공개 주소가 나온다.
     서버가 없는 로컬 모드에서는 그 주소가 이 브라우저 안에서만 뜻이 있는 파일 id라
     <img>가 읽지 못한다 — 그때만 본문에 그대로 심는다(개발·오프라인용). */
  const insertImage = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const ref = await putBlob(f);
      const src = /^https?:/.test(ref) ? ref : await toDataUrl(f);
      editor.chain().focus().setImage({ src }).run();
    } catch (e) {
      // 조용히 실패하면 「올렸는데 왜 안 들어가지」가 된다 — 사유를 그대로 보여 준다
      toast(`이미지를 올리지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };

  return (
    <div className="re-wrap" style={themeColor ? ({ '--char-theme': themeColor } as React.CSSProperties) : undefined}>
      <div className="re-toolbar">
        <TBtn title="굵게" label={<b>B</b>} on={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()} />
        <TBtn title="기울임" label={<i>I</i>} on={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()} />
        <TBtn title="취소선" label={<s>S</s>} on={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()} />
        {/* 대표 테마색 — 선택한 글자를 캐릭터 대표 테마색으로 (이미 그 색이면 해제) */}
        {themeColor && /^#[0-9a-f]{6}$/i.test(themeColor) && (
          <TBtn title="글자를 대표 테마색으로 — 테마색을 바꾸면 같이 바뀝니다 (다시 누르면 해제)"
            on={editor.isActive('themeColor')}
            label={<span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
              <b style={{ fontSize: 13 }}>A</b>
              <span style={{ width: 14, height: 3, borderRadius: 1, background: themeColor, marginTop: 1 }} />
            </span>}
            onClick={() => (editor.isActive('themeColor')
              ? editor.chain().focus().unsetMark('themeColor').run()
              : editor.chain().focus().setMark('themeColor', { color: 'theme', fb: themeColor }).run())} />
        )}
        <span className="re-sep" />
        <TBtn title="제목" label="H2" on={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().command(splitAtSelection).toggleHeading({ level: 2 }).run()} />
        <TBtn title="소제목" label="H3" on={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().command(splitAtSelection).toggleHeading({ level: 3 }).run()} />
        <span className="re-sep" />
        <TBtn title="글머리 목록" label="•≡" on={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().command(splitAtSelection).toggleBulletList().run()} />
        <TBtn title="번호 목록" label="1≡" on={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().command(splitAtSelection).toggleOrderedList().run()} />
        <TBtn title="인용" label="❝" on={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().command(splitAtSelection).toggleBlockquote().run()} />
        <TBtn title="구분선" label="—" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <span className="re-sep" />
        <TBtn title={busy ? '올리는 중…' : '이미지 올리기'} label={busy ? '⏳' : '🖼'}
          onClick={() => { if (!busy) fileRef.current?.click(); }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void insertImage(f); }} />
        {/* 실행 취소·다시 실행은 모바일에서 숨김 — 툴바가 두 줄로 넘어가 본문 영역을 침범 (v1.9 사용자 확정)
            (단축키 Ctrl+Z / Ctrl+Shift+Z는 그대로 동작) */}
        <span className="re-sep re-hide-m" />
        <span className="re-hide-m" style={{ display: 'contents' }}>
          <TBtn title="실행 취소" label="↶" onClick={() => editor.chain().focus().undo().run()} />
          <TBtn title="다시 실행" label="↷" onClick={() => editor.chain().focus().redo().run()} />
        </span>
      </div>
      {/* 플레이스홀더는 본문 영역 기준으로 — 툴바가 두 줄이 돼도 안 밀림 (v1.9 사용자 발견) */}
      <div className="re-body">
        <EditorContent editor={editor} />
        {placeholder && editor.isEmpty && <div className="re-ph">{placeholder}</div>}
      </div>
    </div>
  );
}
