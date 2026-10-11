// Progress on this device (D7): nbl:progress in localStorage through @nanostores/persistent, which keeps it in memory
// when storage is blocked. Lesson keys are <pillar>/<slug>; a step is <lesson>#<step id>. Only Delete removes anything.
import { persistentAtom } from '@nanostores/persistent';

export type Progress = { v: 1; finished: string[]; badges: string[]; steps: string[] };
export const EMPTY: Progress = { v: 1, finished: [], badges: [], steps: [] };

// Zod stays at build time (Q3): stored progress gets this guard, and anything else loads as empty.
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');
export const fromStorage = (raw: string): Progress => {
  try {
    const p = JSON.parse(raw);
    return p?.v === 1 && strings(p.finished) && strings(p.badges) && strings(p.steps)
      ? { v: 1, finished: p.finished, badges: p.badges, steps: p.steps }
      : EMPTY;
  } catch {
    return EMPTY;
  }
};
// An empty record is not stored, so Delete removes the key itself (pr8-review SHOULD-FIX 1).
export const progress = persistentAtom<Progress>('nbl:progress', EMPTY, {
  encode: (p) => (p.finished.length + p.badges.length + p.steps.length ? JSON.stringify(p) : undefined),
  decode: fromStorage,
});
export let localProgressChange = false;

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
// ponytail: a full localStorage throws inside set(), before memory changes, so that visit's progress is lost and the
// page carries on; the save code is the way out, and restore says so. A retry or a size check if testers ever hit it.
const save = (next: Progress) => {
  try {
    localProgressChange = true;
    progress.set(next);
    return true;
  } catch {
    return false; // storage full
  } finally {
    localProgressChange = false;
  }
};

export const restore = ({ finished, badges }: { finished: string[]; badges: string[] }) => {
  const p = progress.get();
  return save({ ...p, finished: union(p.finished, finished), badges: union(p.badges, badges) });
};

export const recordStep = (lesson: string, step: string, earnedBy: string[]) => {
  const p = progress.get();
  const steps = union(p.steps, [`${lesson}#${step}`]);
  const earned = earnedBy.every((s) => steps.includes(`${lesson}#${s}`));
  save({ ...p, steps, badges: earned ? union(p.badges, [lesson]) : p.badges });
};

export const finish = (lesson: string) => {
  const p = progress.get();
  save({ ...p, finished: union(p.finished, [lesson]) });
};

// Delete my progress (T8.3): the one way anything is removed.
export const clear = () => save(EMPTY);
