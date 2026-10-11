// The stepper's rules (stage I, lessons 5.1 and 5.3): stages one at a time, a stage's answer only after its own pick or picks.
// Both lessons use this one file, so they agree on when a step reveals. Pure; src/components/Steps.astro applies it to the page.
// A stage is hidden (not reached yet), open (asked: its Show button waits for every question) or answered (final until restart).
import type { Row } from './cases.ts';

export type { Row };
export interface Question { legend: string; options: string[]; said?: string[] } // said: stage 1 only, the shell reads it
export interface Stage { heading: string; scene: string[]; questions: Question[]; answer: Row[] }
export interface Props { title: string; name: string; intro: string[]; stages: Stage[]; stageListLabel: string; notes?: string[] }
export type State = 'hidden' | 'open' | 'answered';

// Stage 1 is the shell's own step; stage 2 sits ready behind the shell's reveal; the rest wait.
export const initial = (n: number): State[] => Array.from({ length: n }, (_, k) => (k < 2 ? 'open' : 'hidden'));
// Show is enabled only when every question in the stage has a pick.
export const ready = (given: boolean[]) => given.length > 0 && given.every(Boolean);
export const answer = (states: State[], k: number): State[] =>
  states.map((s, i) => (i === k ? 'answered' : i === k + 1 && s === 'hidden' ? 'open' : s));
export const finished = (states: State[]) => states.every((s) => s === 'answered');
// The stage the list marks as the current step: the first one not answered. -1 once all are.
export const current = (states: State[]) => states.findIndex((s) => s !== 'answered');
