// Sparks, the AI coding coach docked inside the challenge's code card, under Run / Submit.
// Collapsed it shows Sparks' latest reply, the quick actions and the question box; expanded it
// shows the whole chat (the editor gives up some height). It sees the student's current code,
// the test they are looking at and the chat so far, and streams a reply from
// POST /api/challenges/:id/coach (Claude on the server, stored hints when it is off).
// It explains, reviews and hints; it never writes the solution (the server enforces that too).
// "line 12" in a reply is a button that highlights that line in the editor.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChallengeCoachAction, ChallengeCoachTurn } from '@mcc/shared';
import { streamChallengeCoach } from '../mission/api';
import { Spark } from '../app/icons';

export interface CoachVerdict { ok: boolean; title: string; detail: string; line?: number; testName?: string }

interface Msg { role: 'student' | 'coach'; text: string; label?: string; pending?: boolean; failed?: boolean }

interface Props {
  challengeId: string;
  conceptLabel: string; // e.g. "Explain Dijkstra"
  getCode: () => string;
  verdict: CoachVerdict | null; // the test the student is looking at, once it has run
  flood: boolean;
  /** Ask from outside the panel (e.g. "Ask Sparks why" under a failing test). Bump `n` to send. */
  trigger: { action: ChallengeCoachAction; n: number } | null;
  onLine: (line: number) => void;
  open: boolean; // chat history expanded
  onOpen: (open: boolean) => void;
}

const HINTS = 3;

export default function CoachPanel({ challengeId, conceptLabel, getCode, verdict, flood, trigger, onLine, open, onOpen }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hints, setHints] = useState(0);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const latest = useRef({ msgs, hints, busy, verdict, flood });
  latest.current = { msgs, hints, busy, verdict, flood };

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const input = useRef<HTMLInputElement>(null);

  async function send(action: ChallengeCoachAction, typed?: string) {
    const { msgs: past, hints: given, busy: running, verdict: v, flood: f } = latest.current;
    if (running) return;
    const q = typed?.trim();
    if (action === 'chat' && !q) return;
    const label = q ?? LABELS[action](v, conceptLabel, given);
    const history: ChallengeCoachTurn[] = past.filter((m) => !m.pending && !m.failed && m.text).map((m) => ({ role: m.role, text: m.label && m.role === 'student' ? m.label : m.text }));
    setMsgs([...past, { role: 'student', text: label, label }, { role: 'coach', text: '', pending: true }]);
    setQuestion('');
    setBusy(true);
    onOpen(true); // show the answer as it streams
    const ctl = new AbortController();
    abort.current = ctl;
    const setLast = (patch: Partial<Msg>) => setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], ...patch }]);
    try {
      await streamChallengeCoach(
        { challengeId, action, code: getCode(), question: q, verdict: v ?? undefined, flood: f, history, hintsGiven: Math.min(given, HINTS - 1) },
        (text) => setLast({ text }),
        ctl.signal,
      );
      setLast({ pending: false });
      if (action === 'hint') setHints((h) => Math.min(h + 1, HINTS));
    } catch {
      if (ctl.signal.aborted) setLast({ pending: false, text: latestText() || 'Stopped.' });
      else setLast({ pending: false, failed: true, text: "I can't reach the server right now. Re-read the Example and the checker's message, then try again in a moment." });
    }
    setBusy(false);
  }
  const latestText = () => latest.current.msgs[latest.current.msgs.length - 1]?.text ?? '';

  // Requests from outside the panel.
  useEffect(() => {
    if (trigger) send(trigger.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.n]);

  const failing = !!verdict && !verdict.ok;
  const lastCoach = [...msgs].reverse().find((m) => m.role === 'coach');
  return (
    <section className="agent-dock" data-open={open || undefined} aria-label="Sparks, your AI coding coach">
      <button type="button" className="agent-bar" onClick={() => onOpen(!open)} aria-expanded={open}>
        <Spark />
        <span className="agent-title">
          <strong>Sparks</strong> <span className="tiny">AI coach</span>
        </span>
        {!open && (
          <span className="agent-peek">
            {lastCoach ? (lastCoach.text || 'Thinking…') : failing ? 'A test failed. Want me to explain it?' : 'Stuck? Ask me about your code.'}
          </span>
        )}
        <span className="agent-chev" aria-hidden>{open ? '▾' : '▴'}</span>
      </button>

      {open && <div className="agent-msgs" ref={list} aria-live="polite">
        {msgs.length === 0 && (
          <div className="agent-empty">
            <p>Hi! I'm Sparks. I can read your code and your test results, explain what went wrong, and give you the next step.</p>
            <p className="tiny">I'll help you get there, but I won't write the answer for you.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`agent-msg ${m.role}${m.failed ? ' failed' : ''}`}>
            {m.role === 'coach' ? (m.text ? <Rich text={m.text} onLine={onLine} /> : <span className="agent-typing" aria-label="Sparks is thinking"><i /><i /><i /></span>) : m.text}
          </div>
        ))}
      </div>}

      <div className="agent-actions">
        <button className="chip-btn" disabled={busy || !verdict} onClick={() => send('explain-failure')} title={verdict ? '' : 'Run the tests first'}>
          {failing ? 'Why did it fail?' : 'Explain this result'}
        </button>
        <button className="chip-btn" disabled={busy || hints >= HINTS} onClick={() => send('hint')}>Next hint {Math.min(hints + 1, HINTS)}/{HINTS}</button>
        <button className="chip-btn" disabled={busy} onClick={() => send('review')}>Review my code</button>
        <button className="chip-btn" disabled={busy} onClick={() => send('concept')}>{conceptLabel}</button>
      </div>

      <form className="agent-input" onSubmit={(e) => { e.preventDefault(); send('chat', question); }}>
        <input
          ref={input}
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your code…"
          aria-label="Question for Sparks"
        />
        {busy ? (
          <button type="button" className="btn ghost small" onClick={() => abort.current?.abort()}>Stop</button>
        ) : (
          <button className="btn primary small" disabled={!question.trim()}>Send</button>
        )}
      </form>
    </section>
  );
}

const LABELS: Record<ChallengeCoachAction, (v: CoachVerdict | null, concept: string, hints: number) => string> = {
  'explain-failure': (v) => (v && !v.ok ? `Why did "${v.title}" happen?` : 'Explain this result'),
  hint: (_v, _c, h) => `Next hint (${Math.min(h + 1, HINTS)}/${HINTS})`,
  review: () => 'Review my code',
  concept: (_v, c) => c,
  chat: () => '',
};

/** Coach text with `code` spans, and "line N" as buttons that highlight the line in the editor. */
function Rich({ text, onLine }: { text: string; onLine: (n: number) => void }) {
  const out: ReactNode[] = [];
  const re = /`([^`\n]+)`|\b(lines?) (\d+)(?:\s*(?:-|–|and|to)\s*(\d+))?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<code key={m.index}>{m[1]}</code>);
    else {
      const n = Number(m[3]);
      out.push(
        <button key={m.index} type="button" className="line-ref" onClick={() => onLine(n)} title={`Show line ${n} in the editor`}>
          {m[0]}
        </button>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <p>{out}</p>;
}
