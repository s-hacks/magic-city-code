// One CodeMirror view for the whole project. Each file keeps its own editor state (so undo
// history and cursor survive switching tabs); the view swaps states when the open file changes.
// Python files get Python highlighting; other files are plain text.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, type Extension, type StateEffect } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { highlight, look, markField, setMark } from "../challenges/Editor";
import { langOf } from "./project";

export interface ProjectEditorHandle {
  /** Highlight a line in the open file (null clears it) and scroll to it. */
  mark: (line: number | null, kind: "run" | "error") => void;
  /** Forget a file's editor state (after a delete, or when its text changed from outside). */
  drop: (path: string) => void;
  /** Move a file's editor state to its new path (after a rename). */
  rename: (from: string, to: string) => void;
  /** Forget every file (the whole project was replaced). */
  clear: () => void;
  focus: () => void;
}

interface Props {
  path: string;
  doc: string;
  readOnly: boolean;
  onChange: (path: string, text: string) => void;
}

const ProjectEditor = forwardRef<ProjectEditorHandle, Props>(function ProjectEditor({ path, doc, readOnly, onChange }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  const shown = useRef<string | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  const make = (p: string, text: string) => {
    const ext: Extension[] = [
      basicSetup,
      keymap.of([indentWithTab]),
      indentUnit.of("    "),
      EditorState.tabSize.of(4),
      look,
      syntaxHighlighting(highlight),
      markField,
      EditorView.updateListener.of((u) => {
        // Only the shown file can be edited, so its path is the one that changed.
        if (u.docChanged && shown.current) change.current(shown.current, u.state.doc.toString());
      }),
    ];
    if (langOf(p) === "python") ext.push(python());
    if (langOf(p) !== "python") ext.push(EditorView.lineWrapping);
    if (readOnly) ext.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    return EditorState.create({ doc: text, extensions: ext });
  };

  useEffect(() => {
    view.current = new EditorView({ parent: box.current!, state: make(path, doc) });
    shown.current = path;
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch files: park the old state, bring back (or make) the new one.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (shown.current === path) {
      // Same file, but its text changed from outside (reset, load solution): replace it.
      if (v.state.doc.toString() !== doc) v.setState(make(path, doc));
      return;
    }
    if (shown.current) states.current.set(shown.current, v.state);
    const saved = states.current.get(path);
    v.setState(saved && saved.doc.toString() === doc ? saved : make(path, doc));
    shown.current = path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, doc]);

  useImperativeHandle(ref, () => ({
    mark: (line, kind) => {
      const v = view.current;
      if (!v) return;
      const effects: StateEffect<unknown>[] = [setMark.of(line ? { line, kind } : null)];
      if (line && line <= v.state.doc.lines) effects.push(EditorView.scrollIntoView(v.state.doc.line(line).from, { y: "center" }));
      v.dispatch({ effects });
    },
    drop: (p) => { states.current.delete(p); },
    rename: (from, to) => {
      const moved = (k: string) => k === from || k.startsWith(from + "/");
      for (const k of [...states.current.keys()]) if (moved(k)) states.current.delete(k);
      const v = view.current;
      if (v && shown.current && moved(shown.current)) {
        // A new name may mean a new language (notes.txt -> notes.py): rebuild the open file.
        shown.current = to + shown.current.slice(from.length);
        v.setState(make(shown.current, v.state.doc.toString()));
      }
    },
    clear: () => { states.current.clear(); },
    focus: () => view.current?.focus(),
  }));

  return <div ref={box} className="editor ws-editor-cm" />;
});

export default ProjectEditor;
