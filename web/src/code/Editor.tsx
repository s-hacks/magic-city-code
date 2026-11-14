import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export interface EditorHandle {
  getCode: () => string;
  setCode: (code: string) => void;
  insert: (text: string) => void;
  mark: (line: number | null, kind: 'run' | 'error') => void;
}

// One effect sets (or clears) the highlighted line; the field turns it into a decoration.
const setMark = StateEffect.define<{ line: number; kind: 'run' | 'error' } | null>();
const markField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setMark)) continue;
      if (!e.value || e.value.line > tr.state.doc.lines) return Decoration.none;
      const from = tr.state.doc.line(e.value.line).from;
      return Decoration.set([Decoration.line({ class: `cm-mark-${e.value.kind}` }).range(from)]);
    }
    if (tr.docChanged) return Decoration.none; // editing clears the error underline
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Mostly monochrome code; the accent only marks city.* calls and numbers.
const highlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--muted)', fontWeight: '600' },
  { tag: [t.function(t.propertyName), t.function(t.variableName)], color: 'var(--accent)' },
  { tag: [t.propertyName, t.variableName], color: 'var(--text)' },
  { tag: [t.string, t.number, t.bool], color: 'var(--accent)', opacity: '0.8' },
  { tag: t.comment, color: 'var(--ash)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--muted)' },
]);

const look = EditorView.theme({
  '&': { background: 'transparent', color: 'var(--text)', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.65' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
  '.cm-gutters': { background: 'transparent', border: 'none', color: 'var(--ash)' },
  '.cm-activeLine, .cm-activeLineGutter': { background: 'color-mix(in srgb, var(--text) 4%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'color-mix(in srgb, var(--accent) 22%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-mark-run': { background: 'color-mix(in srgb, var(--accent) 16%, transparent)', boxShadow: 'inset 3px 0 0 var(--accent)' },
  '.cm-mark-error': { textDecoration: 'underline wavy var(--accent)', textUnderlineOffset: '5px', boxShadow: 'inset 3px 0 0 var(--accent)' },
  '.cm-matchingBracket': { background: 'transparent', outline: '1px solid var(--ash)' },
});

export default function Editor({ initial, ref }: { initial: string; ref: Ref<EditorHandle> }) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    view.current = new EditorView({
      parent: box.current!,
      doc: initial,
      extensions: [basicSetup, python(), look, syntaxHighlighting(highlight), markField, EditorView.lineWrapping],
    });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getCode: () => view.current!.state.doc.toString(),
    setCode: (code) => {
      const v = view.current!;
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code } });
    },
    insert: (text) => {
      const v = view.current!;
      v.dispatch(v.state.replaceSelection(text));
      v.focus();
    },
    mark: (line, kind) => view.current!.dispatch({ effects: setMark.of(line ? { line, kind } : null) }),
  }));

  return <div ref={box} className="editor" />;
}
