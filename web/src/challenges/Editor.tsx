// CodeMirror editor for the code challenges (from the UI prototype): imperative handle with
// getCode / setCode / insert / mark(line, 'run' | 'error'). The mission screen uses code/Editor.tsx.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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

// Syntax colors reuse the brand palette: violet keywords, cyan calls, pink strings, gold numbers.
const highlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--violet)', fontWeight: '600' },
  { tag: [t.function(t.propertyName), t.function(t.variableName), t.definition(t.function(t.variableName))], color: 'var(--cyan)' },
  { tag: [t.propertyName, t.variableName], color: 'var(--text)' },
  { tag: [t.string, t.docString], color: 'var(--pink)' },
  { tag: [t.number, t.bool], color: 'var(--accent)' },
  { tag: t.comment, color: 'var(--ash)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--muted)' },
]);

const look = EditorView.theme({
  '&': { background: 'transparent', color: 'var(--text)', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.65' },
  '.cm-content': { caretColor: 'var(--cyan)', padding: '12px 0' },
  '.cm-gutters': { background: 'transparent', border: 'none', color: 'var(--ash)' },
  '.cm-activeLine, .cm-activeLineGutter': { background: 'color-mix(in srgb, var(--text) 4%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'color-mix(in srgb, var(--violet) 30%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--cyan)', borderLeftWidth: '2px' },
  '.cm-mark-run': { background: 'color-mix(in srgb, var(--cyan) 14%, transparent)', boxShadow: 'inset 3px 0 0 var(--cyan)' },
  '.cm-mark-error': { background: 'color-mix(in srgb, var(--red) 12%, transparent)', textDecoration: 'underline wavy var(--red)', textUnderlineOffset: '5px', boxShadow: 'inset 3px 0 0 var(--red)' },
  '.cm-matchingBracket': { background: 'transparent', outline: '1px solid var(--ash)' },
});

const Editor = forwardRef<EditorHandle, { initial: string }>(function Editor({ initial }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lastMark = useRef<string | null>(null);

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
      lastMark.current = null;
    },
    insert: (text) => {
      const v = view.current!;
      v.dispatch(v.state.replaceSelection(text));
      v.focus();
    },
    mark: (line, kind) => {
      const v = view.current!;
      const k = `${line}:${kind}:${v.state.doc.length}`;
      if (k === lastMark.current) return; // replay calls this every frame
      lastMark.current = k;
      const effects: StateEffect<unknown>[] = [setMark.of(line ? { line, kind } : null)];
      if (line && line <= v.state.doc.lines) effects.push(EditorView.scrollIntoView(v.state.doc.line(line).from, { y: 'nearest', yMargin: 40 }));
      v.dispatch({ effects });
    },
  }));

  return <div ref={box} className="editor" />;
});

export default Editor;
