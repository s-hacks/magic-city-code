// Plain helpers for a project (a list of files plus empty folders): the folder tree, rename /
// move / delete, the official-tests swap used at submit time, and the saved draft per problem.
import { isSafePath, PROJECT_LIMITS, type Project, type ProjectFile } from "@mcc/shared";

export interface TreeNode {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: TreeNode[];
}

const parentOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
export const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
export const dirName = parentOf;

/** Every folder in the project, including the ones implied by file paths. */
export function allFolders(project: Project): string[] {
  const out = new Set<string>(project.folders ?? []);
  for (const f of project.files) {
    let d = parentOf(f.path);
    while (d) { out.add(d); d = parentOf(d); }
  }
  for (const d of [...out]) { let p = parentOf(d); while (p) { out.add(p); p = parentOf(p); } }
  return [...out].sort();
}

/** The folder tree: folders first, then files, each sorted by name. */
export function buildTree(project: Project): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "dir", children: [] };
  const dirs = new Map<string, TreeNode>([["", root]]);
  const dir = (path: string): TreeNode => {
    const hit = dirs.get(path);
    if (hit) return hit;
    const node: TreeNode = { name: baseName(path), path, kind: "dir", children: [] };
    dirs.set(path, node);
    dir(parentOf(path)).children.push(node);
    return node;
  };
  for (const d of allFolders(project)) dir(d);
  for (const f of project.files) dir(parentOf(f.path)).children.push({ name: baseName(f.path), path: f.path, kind: "file", children: [] });
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === "dir" ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

export const hasFile = (p: Project, path: string) => p.files.some((f) => f.path === path);
export const hasFolder = (p: Project, path: string) => allFolders(p).includes(path);
export const exists = (p: Project, path: string) => hasFile(p, path) || hasFolder(p, path);

/** Why a new name can't be used, or null if it can. */
export function nameProblem(p: Project, path: string, kind: "file" | "dir", ignore?: string): string | null {
  if (!isSafePath(path)) return "Use letters, numbers, spaces, dots, dashes and _ only.";
  if (path !== ignore && exists(p, path)) return "Something with that name is already here.";
  if (kind === "file" && p.files.length >= PROJECT_LIMITS.maxFiles) return `A project can have at most ${PROJECT_LIMITS.maxFiles} files.`;
  return null;
}

export function addFile(p: Project, path: string, content = ""): Project {
  return { ...p, files: [...p.files, { path, content }] };
}

export function addFolder(p: Project, path: string): Project {
  return { ...p, folders: [...new Set([...(p.folders ?? []), path])] };
}

export function setContent(p: Project, path: string, content: string): Project {
  return { ...p, files: p.files.map((f) => (f.path === path ? { ...f, content } : f)) };
}

const under = (path: string, dir: string) => path === dir || path.startsWith(dir + "/");
const moveUnder = (path: string, from: string, to: string) => (under(path, from) ? to + path.slice(from.length) : path);

/** Rename a file or a folder (and everything in it). */
export function rename(p: Project, from: string, to: string): Project {
  return {
    ...p,
    files: p.files.map((f) => ({ ...f, path: moveUnder(f.path, from, to) })),
    folders: (p.folders ?? []).map((d) => moveUnder(d, from, to)),
    entry: p.entry && under(p.entry, from) ? moveUnder(p.entry, from, to) : p.entry,
  };
}

/** Delete a file or a folder (and everything in it). */
export function remove(p: Project, path: string): Project {
  const folders = (p.folders ?? []).filter((d) => !under(d, path));
  // Keep the parent folder visible when its last file goes.
  const parent = parentOf(path);
  const files = p.files.filter((f) => !under(f.path, path));
  if (parent && !files.some((f) => under(f.path, parent)) && !folders.includes(parent)) folders.push(parent);
  return { ...p, files, folders };
}

/** The student's files with the tests/ folder replaced by the problem's own tests. */
export function withOfficialTests(mine: Project, starter: Project): Project {
  const isTest = (f: ProjectFile) => under(f.path, "tests");
  return { ...mine, files: [...mine.files.filter((f) => !isTest(f)), ...starter.files.filter(isTest)] };
}

export function projectBytes(p: Project): number {
  return p.files.reduce((n, f) => n + new Blob([f.content]).size, 0);
}

export type Lang = "python" | "markdown" | "csv" | "json" | "text";
export function langOf(path: string): Lang {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return ext === "py" ? "python" : ext === "md" ? "markdown" : ext === "csv" ? "csv" : ext === "json" ? "json" : "text";
}

/** The file to show first: README.md, then the entry file, then anything. */
export function firstFile(p: Project): string | null {
  return ["README.md", p.entry ?? "main.py"].find((f) => hasFile(p, f)) ?? p.files[0]?.path ?? null;
}

// --- per-viewer storage (may be unavailable: private windows, blocked storage) ----------------
// Keys start with "mcc." so the demo reset (/?reset=1) clears them.
export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

export const draftKey = (problemId: string) => `mcc.ws.${problemId}`;
