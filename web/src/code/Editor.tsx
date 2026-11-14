// The code editor: CodeMirror 6, Python, big font for projectors, theme-token colours.
//
//   <Editor value onChange highlightLine errorLine onRun />
//
// highlightLine: molten glow on that line (the line that is placing a hub during the run animation).
// errorLine: red wavy underline on that line (where the Python error is).
// Ctrl+Enter or Cmd+Enter calls onRun.
//
// Syntax colours come from parsing the code with the Python grammar and decorating the tokens
// ourselves, so we don't need extra CodeMirror packages.
import { useEffect, useRef } from "react";
import { EditorState, RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  highlightLine?: number | null; // 1-based
  errorLine?: number | null; // 1-based
  onRun?: () => void;
}

// ---------------------------------------------------------------------------
// Colours (UI prototype look): CSS variables from src/theme.ts, so the editor follows
// day/night. Mostly monochrome code; the accent marks city.* calls, numbers and strings.
// ---------------------------------------------------------------------------
const tint = (pct: number) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;

const theme = EditorView.theme({
  "&": {
    color: "var(--text)",
    backgroundColor: "transparent",
    fontSize: "18px",
    height: "100%",
  },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.65" },
  ".cm-content": { caretColor: "var(--accent)", padding: "12px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: `${tint(22)} !important`,
  },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--ash)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 18px", minWidth: "2.2em" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--text) 4%, transparent)" },

  // The line that is placing a hub right now.
  ".cm-run-line": {
    backgroundColor: tint(16),
    boxShadow: "inset 3px 0 0 var(--accent)",
    transition: "background-color 120ms",
  },
  // The line with the error.
  ".cm-error-line": {
    textDecoration: "underline wavy var(--accent)",
    textDecorationThickness: "1.5px",
    textUnderlineOffset: "5px",
    boxShadow: "inset 3px 0 0 var(--accent)",
  },

  // Syntax colours.
  ".tok-keyword": { color: "var(--muted)", fontWeight: "600" },
  ".tok-string": { color: "var(--accent)", opacity: "0.8" },
  ".tok-number": { color: "var(--accent)", opacity: "0.8" },
  ".tok-comment": { color: "var(--ash)", fontStyle: "italic" },
  ".tok-bool": { color: "var(--accent)", opacity: "0.8" },
  ".tok-call": { color: "var(--accent)" },
  ".tok-prop": { color: "var(--text)" },
  ".tok-def": { color: "var(--text)", fontWeight: "600" },
});

// ---------------------------------------------------------------------------
// Syntax highlighting from the Python parse tree
// ---------------------------------------------------------------------------
const KEYWORDS = new Set([
  "if", "elif", "else", "for", "while", "in", "not", "and", "or", "is", "def", "return",
  "import", "from", "as", "pass", "break", "continue", "lambda", "with", "try", "except",
  "finally", "raise", "class", "global", "nonlocal", "del", "assert", "yield", "await", "async",
]);

const pythonLanguage = python();

const tokenMark = (cls: string) => Decoration.mark({ class: cls });
const marks = {
  keyword: tokenMark("tok-keyword"),
  string: tokenMark("tok-string"),
  number: tokenMark("tok-number"),
  comment: tokenMark("tok-comment"),
  bool: tokenMark("tok-bool"),
  call: tokenMark("tok-call"),
  prop: tokenMark("tok-prop"),
  def: tokenMark("tok-def"),
};

function buildSyntaxDecorations(doc: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = pythonLanguage.language.parser.parse(doc);
  const pending: { from: number; to: number; mark: Decoration }[] = [];
  tree.iterate({
    enter: (node) => {
      const name = node.name;
      let mark: Decoration | null = null;
      if (KEYWORDS.has(name)) mark = marks.keyword;
      else if (name === "String" || name === "FormatString") mark = marks.string;
      else if (name === "Number") mark = marks.number;
      else if (name === "Comment") mark = marks.comment;
      else if (name === "Boolean" || name === "None") mark = marks.bool;
      if (mark) pending.push({ from: node.from, to: node.to, mark });
      // Function name in `f(...)` or `city.f(...)`, and in `def f`.
      if (name === "CallExpression") {
        const callee = node.node.firstChild;
        const target = callee?.name === "MemberExpression" ? callee.lastChild : callee;
        if (target && (target.name === "VariableName" || target.name === "PropertyName")) {
          pending.push({ from: target.from, to: target.to, mark: marks.call });
        }
      } else if (name === "PropertyName") {
        pending.push({ from: node.from, to: node.to, mark: marks.prop });
      } else if (name === "FunctionDefinition") {
        const id = node.node.getChild("VariableName");
        if (id) pending.push({ from: id.from, to: id.to, mark: marks.def });
      }
    },
  });
  // RangeSetBuilder wants ranges in order; the call/prop overlap on the same node, so keep the last one.
  pending.sort((a, b) => a.from - b.from || a.to - b.to);
  let lastFrom = -1;
  let lastTo = -1;
  for (const p of pending) {
    if (p.from === lastFrom && p.to === lastTo) continue;
    if (p.from < lastTo) continue; // never overlap
    builder.add(p.from, p.to, p.mark);
    lastFrom = p.from;
    lastTo = p.to;
  }
  return builder.finish();
}

const syntaxColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildSyntaxDecorations(view.state.doc.toString());
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = buildSyntaxDecorations(u.state.doc.toString());
    }
  },
  { decorations: (v) => v.decorations },
);

// ---------------------------------------------------------------------------
// Run-line glow and error underline
// ---------------------------------------------------------------------------
const setHighlightLine = StateEffect.define<number | null>();
const setErrorLine = StateEffect.define<number | null>();

// One state field holding a line number, plus a decoration that paints that line.
function lineField(effect: typeof setHighlightLine, cls: string) {
  const field = StateField.define<number | null>({
    create: () => null,
    update(value, tr) {
      for (const e of tr.effects) if (e.is(effect)) return e.value;
      return value;
    },
  });
  const decos = EditorView.decorations.compute([field, "doc"], (state) => {
    const line = state.field(field);
    if (!line || line < 1 || line > state.doc.lines) return Decoration.none;
    return Decoration.set([Decoration.line({ class: cls }).range(state.doc.line(line).from)]);
  });
  return [field, decos] as Extension;
}

const highlightExt = lineField(setHighlightLine, "cm-run-line");
const errorExt = lineField(setErrorLine, "cm-error-line");

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------
export function Editor({ value, onChange, highlightLine = null, errorLine = null, onRun }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks, so the editor is created once.
  const cbs = useRef({ onChange, onRun });
  cbs.current = { onChange, onRun };

  useEffect(() => {
    // Mod is Cmd on macOS, so bind Ctrl-Enter too: it must work on every keyboard.
    const runCommand = () => {
      cbs.current.onRun?.();
      return true;
    };
    const runKeys = keymap.of([
      { key: "Ctrl-Enter", preventDefault: true, run: runCommand },
      { key: "Mod-Enter", preventDefault: true, run: runCommand },
    ]);
    const state = EditorState.create({
      doc: value,
      extensions: [
        runKeys,
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        pythonLanguage,
        syntaxColors,
        highlightExt,
        errorExt,
        theme,
        EditorState.tabSize.of(4),
        EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cbs.current.onChange(u.state.doc.toString());
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current! });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes to `value` (a new level, demo keys) replace the document.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const effects: StateEffect<unknown>[] = [setHighlightLine.of(highlightLine ?? null)];
    const n = highlightLine ?? 0;
    if (n >= 1 && n <= v.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(v.state.doc.line(n).from, { y: "nearest" }));
    }
    v.dispatch({ effects });
  }, [highlightLine]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine ?? null) });
  }, [errorLine]);

  return <div ref={host} className="mcc-editor" style={{ height: "100%", overflow: "hidden" }} />;
}

export default Editor;
