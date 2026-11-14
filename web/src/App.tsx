import { useEffect, useRef, useState } from 'react';
import MapView, { HUB_STEP_MS, RUN_START_MS } from './map/MapView';
import type { LayerGroup } from './map/style';
import Home from './pages/Home';
import Mission, { type RunState } from './pages/Mission';
import ChallengePage from './pages/Challenge';
import ChallengeList from './pages/ChallengeList';
import { challenges } from './challenges';
import type { EditorHandle } from './code/Editor';
import { applyCssVars, type ThemeName } from './theme';
import { baseline, fakeRun, litSet, mission, problems as seedProblems, residents, type Problem, type Site } from './data/mock';

const RESULT_AT_MS = 2400; // when the meter fills, after the last ring has rippled

export default function App() {
  const [theme, setTheme] = useState<ThemeName>('night');
  const [screen, setScreen] = useState<'home' | 'mission' | 'challenge' | 'list'>('home');
  const [listTab, setListTab] = useState<'practice' | 'city'>('practice');
  const [problems, setProblems] = useState<Problem[]>(seedProblems);
  const [hidden, setHidden] = useState<Set<LayerGroup>>(new Set());
  const [compare, setCompare] = useState(false);
  const [level, setLevel] = useState(0);
  const [unlocked, setUnlocked] = useState(1);
  const [hubs, setHubs] = useState<Site[]>([]);
  const [runId, setRunId] = useState(0);
  const [run, setRun] = useState<RunState>(idle());
  const editor = useRef<EditorHandle>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => applyCssVars(theme), [theme]);

  const resetRun = () => {
    timers.current.forEach(clearTimeout);
    setHubs([]);
    setRunId((n) => n + 1);
    setRun(idle());
    editor.current?.mark(null, 'run');
  };

  const openLevel = (i: number) => {
    setLevel(i);
    editor.current?.setCode(mission.levels[i].starterCode);
    resetRun();
  };

  const doRun = () => {
    if (run.status === 'running' || !editor.current) return;
    timers.current.forEach(clearTimeout);
    const res = fakeRun(editor.current.getCode());
    editor.current.mark(null, 'run');

    if (!res.ok) {
      editor.current.mark(res.error!.line, 'error');
      setRun({ ...idle(), status: 'error', output: [res.error!.message], coach: res.error!.message });
      return;
    }
    setHubs(res.hubs);
    setRunId((n) => n + 1);
    setRun({ ...idle(), status: 'running' });

    const at = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    res.hubLines.forEach((line, i) => at(RUN_START_MS + i * HUB_STEP_MS, () => editor.current?.mark(line, 'run')));
    at(RUN_START_MS + res.hubs.length * HUB_STEP_MS + 200, () => editor.current?.mark(null, 'run'));
    at(RESULT_AT_MS, () => {
      const after = litSet(res.hubs.map((h) => h.at)).size / residents.length;
      const goal = after >= mission.levels[level].target;
      if (goal) setUnlocked((u) => Math.max(u, Math.min(level + 2, mission.levels.length)));
      setRun({
        status: 'done',
        before: baseline.size / residents.length,
        after,
        goal,
        output: res.output,
        coach: res.hubs.length === 0
          ? 'Nothing happened on the map yet. Which line puts a hub in the city?'
          : goal
            ? 'You did it! Look how far the light reaches now.'
            : 'Good start! Some families are still in the dark. Can you choose places that reach more of them?',
      });
    });
  };

  // demo keys (ignored while typing in the editor or a form)
  useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement).closest('.cm-editor, input, textarea, select');
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'd') setTheme((t) => (t === 'night' ? 'day' : 'night'));
      if (k === 'h') setScreen('home');
      if (screen !== 'mission') return;
      if (k === 'r') doRun();
      if (k === 'b') setCompare(true);
      if (['1', '2', '3'].includes(k)) {
        const i = Number(k) - 1;
        setLevel(i);
        setUnlocked((u) => Math.max(u, i + 1));
        resetRun();
        editor.current?.setCode(mission.levels[i].solution);
      }
    };
    const up = (e: KeyboardEvent) => e.key.toLowerCase() === 'b' && setCompare(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  const open = (p: Problem) => (p.challengeId ? setScreen('challenge') : p.missionId && setScreen('mission'));

  const toggle = (g: LayerGroup) => setHidden((h) => {
    const n = new Set(h);
    if (n.has(g)) n.delete(g); else n.add(g);
    return n;
  });

  return (
    <div className="app" data-screen={screen}>
      {screen !== 'challenge' && screen !== 'list' && <MapView
        theme={theme} screen={screen} hidden={hidden} problems={problems}
        hubs={hubs} runId={runId} compare={compare}
        onFlare={open}
        onSiteClick={(s) => editor.current?.insert(`city.site("${s.name}")`)}
      />}
      <div className="vignette" aria-hidden />
      {run.goal && <div key={runId} className="wave" aria-hidden />}

      {screen === 'home' && (
        <Home
          problems={problems}
          onOpen={open}
          onReport={(p) => setProblems((ps) => [...ps, p])}
          onBrowse={(t) => { setListTab(t); setScreen('list'); }}
        />
      )}
      {screen === 'challenge' && (
        <ChallengePage ch={challenges['route-to-fresh-food']} theme={theme} onHome={() => setScreen('home')} onList={() => { setListTab('practice'); setScreen('list'); }} onTheme={() => setTheme((t) => (t === 'night' ? 'day' : 'night'))} />
      )}
      {screen === 'list' && (
        <ChallengeList tab={listTab} onTab={setListTab} onHome={() => setScreen('home')} onOpen={(p) => p.open && setScreen(p.open)} />
      )}
      {screen === 'mission' && (
        <Mission
          level={level} unlocked={unlocked} run={run} compare={compare} hidden={hidden} theme={theme}
          editorRef={editor}
          onLevel={openLevel} onRun={doRun} onCompare={setCompare} onToggle={toggle}
          onHome={() => setScreen('home')} onTheme={() => setTheme((t) => (t === 'night' ? 'day' : 'night'))}
        />
      )}
    </div>
  );
}

function idle(): RunState {
  return { status: 'idle', before: baseline.size / residents.length, after: null, goal: false, output: [], coach: null };
}
