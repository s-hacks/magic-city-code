// The project explorer: a collapsible folder tree. Click a folder to open or close it, click a
// file to open it. Hover a row for rename / delete / new-file-here. New names are typed inline
// (Enter saves, Escape cancels). Read-only projects show the tree without the edit buttons.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Project } from "@mcc/shared";
import { allFolders, baseName, buildTree, dirName, nameProblem, type TreeNode } from "./project";

type Editing =
  | { mode: "new"; kind: "file" | "dir"; parent: string }
  | { mode: "rename"; kind: "file" | "dir"; path: string };

interface Props {
  project: Project;
  active: string | null;
  readOnly: boolean;
  /** Files whose text differs from the starter (shown with a dot). */
  changed?: Set<string>;
  /** Files with a failing test or an error (shown in red). */
  flagged?: Set<string>;
  onOpen: (path: string) => void;
  onCreate: (kind: "file" | "dir", path: string) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (path: string, kind: "file" | "dir") => void;
  title?: ReactNode;
}

export default function FileTree({ project, active, readOnly, changed, flagged, onOpen, onCreate, onRename, onDelete, title }: Props) {
  const tree = useMemo(() => buildTree(project), [project]);
  const folders = useMemo(() => allFolders(project), [project]);
  // Folders start open; the set holds the closed ones.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [focusDir, setFocusDir] = useState(""); // where "New file" goes

  // Opening a file inside a closed folder opens the folders above it.
  useEffect(() => {
    if (!active) return;
    setClosed((c) => {
      let d = dirName(active);
      let next: Set<string> | null = null;
      while (d) {
        if (c.has(d)) (next ??= new Set(c)).delete(d);
        d = dirName(d);
      }
      return next ?? c;
    });
    setFocusDir(dirName(active));
  }, [active]);

  const toggle = (path: string) =>
    setClosed((c) => {
      const n = new Set(c);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });

  const startNew = (kind: "file" | "dir", parent = focusDir) => {
    if (parent) setClosed((c) => { const n = new Set(c); n.delete(parent); return n; });
    setEditing({ mode: "new", kind, parent });
  };

  const commit = (value: string): string | null => {
    if (!editing) return null;
    const name = value.trim();
    if (!name) { setEditing(null); return null; }
    if (editing.mode === "new") {
      const path = editing.parent ? `${editing.parent}/${name}` : name;
      const why = nameProblem(project, path, editing.kind);
      if (why) return why;
      onCreate(editing.kind, path);
    } else {
      const parent = dirName(editing.path);
      const path = parent ? `${parent}/${name}` : name;
      if (path !== editing.path) {
        const why = nameProblem(project, path, editing.kind, editing.path);
        if (why) return why;
        onRename(editing.path, path);
      }
    }
    setEditing(null);
    return null;
  };

  const rows = (nodes: TreeNode[], depth: number): ReactNode[] => {
    const out: ReactNode[] = [];
    for (const n of nodes) {
      const isDir = n.kind === "dir";
      const open = isDir && !closed.has(n.path);
      const renaming = editing?.mode === "rename" && editing.path === n.path;
      out.push(
        renaming ? (
          <NameInput key={n.path} depth={depth} kind={n.kind} initial={n.name} onCommit={commit} onCancel={() => setEditing(null)} />
        ) : (
          <div
            key={n.path}
            role="treeitem"
            aria-expanded={isDir ? open : undefined}
            aria-selected={!isDir && n.path === active}
            tabIndex={0}
            className={`ft-row ${isDir ? "dir" : "file"}${n.path === active ? " active" : ""}${flagged?.has(n.path) ? " flagged" : ""}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => (isDir ? (toggle(n.path), setFocusDir(n.path)) : onOpen(n.path))}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (isDir) toggle(n.path); else onOpen(n.path); }
              if (e.key === "ArrowRight" && isDir && !open) toggle(n.path);
              if (e.key === "ArrowLeft" && isDir && open) toggle(n.path);
              if (!readOnly && e.key === "F2") setEditing({ mode: "rename", kind: n.kind, path: n.path });
            }}
            title={n.path}
          >
            <span className="ft-caret" aria-hidden>{isDir ? (open ? "▾" : "▸") : ""}</span>
            <FileIcon name={n.name} dir={isDir} open={open} />
            <span className="ft-name">{n.name}</span>
            {!isDir && changed?.has(n.path) && <span className="ft-dot" title="Changed from the starter" />}
            {!readOnly && (
              <span className="ft-acts" onClick={(e) => e.stopPropagation()}>
                {isDir && <button className="ft-act" title="New file here" aria-label={`New file in ${n.name}`} onClick={() => startNew("file", n.path)}>+</button>}
                <button className="ft-act" title="Rename (F2)" aria-label={`Rename ${n.name}`} onClick={() => setEditing({ mode: "rename", kind: n.kind, path: n.path })}>✎</button>
                <button className="ft-act" title="Delete" aria-label={`Delete ${n.name}`} onClick={() => onDelete(n.path, n.kind)}>×</button>
              </span>
            )}
          </div>
        ),
      );
      if (isDir && open) {
        out.push(...rows(n.children, depth + 1));
        if (editing?.mode === "new" && editing.parent === n.path) out.push(<NameInput key={`new:${n.path}`} depth={depth + 1} kind={editing.kind} initial="" onCommit={commit} onCancel={() => setEditing(null)} />);
      }
    }
    return out;
  };

  return (
    <div className="ft">
      <div className="ft-head">
        <span className="eyebrow">{title ?? "Project"}</span>
        {!readOnly && (
          <span className="ft-tools">
            <button className="ft-tool" title={`New file${focusDir ? ` in ${focusDir}/` : ""}`} aria-label="New file" onClick={() => startNew("file")}><NewFileGlyph /></button>
            <button className="ft-tool" title={`New folder${focusDir ? ` in ${focusDir}/` : ""}`} aria-label="New folder" onClick={() => startNew("dir")}><NewFolderGlyph /></button>
          </span>
        )}
        <button className="ft-tool" title="Collapse all folders" aria-label="Collapse all folders" onClick={() => setClosed(new Set(folders))}><CollapseGlyph /></button>
      </div>
      <div className="ft-body" role="tree" aria-label="Project files" onClick={(e) => e.target === e.currentTarget && setFocusDir("")}>
        {rows(tree, 0)}
        {editing?.mode === "new" && editing.parent === "" && <NameInput depth={0} kind={editing.kind} initial="" onCommit={commit} onCancel={() => setEditing(null)} />}
        {!project.files.length && !editing && <p className="tiny ft-empty">No files yet.</p>}
      </div>
    </div>
  );
}

function NameInput({ depth, kind, initial, onCommit, onCancel }: { depth: number; kind: "file" | "dir"; initial: string; onCommit: (v: string) => string | null; onCancel: () => void }) {
  const box = useRef<HTMLInputElement>(null);
  const [why, setWhy] = useState<string | null>(null);
  const done = useRef(false); // Enter / Escape already handled it; ignore the blur that follows
  const finish = (value: string) => {
    if (done.current) return;
    const problem = onCommit(value);
    if (!problem) done.current = true;
    setWhy(problem);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };
  useEffect(() => {
    const el = box.current!;
    el.focus();
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, kind === "file" && dot > 0 ? dot : initial.length); // select the name, not the .py
  }, [initial, kind]);
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); finish(e.currentTarget.value); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };
  return (
    <div className="ft-row editing" style={{ paddingLeft: 10 + depth * 14 }}>
      <span className="ft-caret" aria-hidden>{kind === "dir" ? "▸" : ""}</span>
      <FileIcon name={initial || (kind === "file" ? "x.py" : "")} dir={kind === "dir"} open={false} />
      <div className="ft-input">
        <input
          ref={box}
          defaultValue={initial}
          aria-label={kind === "dir" ? "Folder name" : "File name"}
          placeholder={kind === "dir" ? "folder name" : "file name, e.g. helpers.py"}
          onKeyDown={key}
          onChange={() => setWhy(null)}
          onBlur={(e) => { if (!e.currentTarget.value.trim()) cancel(); else finish(e.currentTarget.value); }}
          spellCheck={false}
        />
        {why && <span className="ft-why" role="alert">{why}</span>}
      </div>
    </div>
  );
}

/** A small glyph per file type: Python, Markdown, data, or plain. */
function FileIcon({ name, dir, open }: { name: string; dir: boolean; open: boolean }) {
  if (dir) return <span className={`ft-ico folder${open ? " open" : ""}`} aria-hidden />;
  const ext = baseName(name).split(".").pop()?.toLowerCase();
  const kind = ext === "py" ? "py" : ext === "md" ? "md" : ext === "csv" || ext === "json" || ext === "tsv" ? "data" : "txt";
  const label = kind === "py" ? "py" : kind === "md" ? "M" : kind === "data" ? (ext === "json" ? "{}" : "▦") : "≡";
  return <span className={`ft-ico ${kind}`} aria-hidden>{label}</span>;
}

const NewFileGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" /><path d="M9 1.5v4h4M8 8v4M6 10h4" /></svg>
);
const NewFolderGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" /><path d="M8 7v4M6 9h4" /></svg>
);
const CollapseGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M4 6l4-3 4 3M4 13l4-3 4 3" /></svg>
);
