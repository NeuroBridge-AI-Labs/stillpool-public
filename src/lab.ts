// The practice lab's state model (design sheet 5, lab-spec E), written before the code (brief rule 5). One state at a time,
// on [data-lab] as data-state; `had` is whether an answer is on screen. Consent is per page load and is never stored.
//
//   idle      Every load, Back and Reload. The notice and "I understand. Start." The form is not in the tab order.
//             start -> ready. Nothing else does anything. Nothing has been sent.
//   ready     The form: six exercises, the prompt, the improved-version checkbox, Send. Send is disabled until an
//             exercise is picked and the prompt is not blank.
//             send -> sending.
//   sending   Send reads "Sending" and ignores presses (aria-disabled, so focus stays); Cancel shows. A second send is ignored.
//             The exercise, prompt and example cannot be edited, so a reply never sits beside different text.
//             ok -> answered | fail(limit) -> limit | fail(closed) -> off | fail(error) -> error
//             cancel -> aborts the fetch; ready, or answered when an answer was on screen.
//   answered  The answer and the coaching under the form; the text is kept. send -> sending, reset ("Start a new prompt")
//             -> ready with the prompt and the answer cleared.
//   error     One plain line and a small code; the form stays as typed. send -> sending, reset -> ready.
//             Changing the exercise is a reset from answered, error or limit: the old result goes, the text stays.
//   limit     The 429 line (the firewall's per-visitor limit); the form stays as typed. send -> sending, reset -> ready.
//   off       The lab answered "closed": one line, the old answer is gone, the form stays readable but cannot send.
//             Final until the page is reloaded.
//   restore   pageshow with persisted (Back): any state -> idle, form and answer cleared.
//
// Every entry point is a button, a radio, the textarea or the checkbox. Enter in the textarea is a new line and the form
// never submits. Leaving the page aborts the fetch. Nothing is stored on the device.
import type { Reply } from '../api/lab.ts';

export type Name = 'idle' | 'ready' | 'sending' | 'answered' | 'error' | 'limit' | 'off';
export type State = { name: Name; had: boolean };
export type Failure = 'limit' | 'closed' | 'error' | 'filtered';
export type LabEvent = { type: 'start' | 'send' | 'ok' | 'cancel' | 'reset' | 'restore' } | { type: 'fail'; kind: Failure };

export const START: State = { name: 'idle', had: false };
const ready: State = { name: 'ready', had: false };

// The one place that says whether a send may leave the page: the page asks this before it posts.
export const canSend = ({ name }: State) => name === 'ready' || name === 'answered' || name === 'error' || name === 'limit';

export function next(state: State, event: LabEvent): State {
  const { name, had } = state;
  if (event.type === 'restore') return START;
  if (name === 'idle') return event.type === 'start' ? ready : state;
  if (name === 'sending') {
    if (event.type === 'ok') return { name: 'answered', had: true };
    if (event.type === 'cancel') return had ? { name: 'answered', had } : ready;
    // Closed and filtered both drop the old answer: the page must not show it beside "nothing was answered".
    if (event.type === 'fail') {
      if (event.kind === 'closed') return { name: 'off', had: false };
      return event.kind === 'filtered' ? { name: 'error', had: false } : { name: event.kind, had };
    }
    return state;
  }
  if (name === 'off') return state;
  if (event.type === 'send') return canSend(state) ? { name: 'sending', had } : state;
  if (event.type === 'reset' && name !== 'ready') return ready;
  return state;
}

export type Failed = { ok: false; kind: Failure; code: string };
export type Outcome = { ok: true; reply: Reply } | Failed;
export const OFFLINE: Failed = { ok: false, kind: 'error', code: 'offline' };
export const TIMEOUT: Failed = { ok: false, kind: 'error', code: 'timeout' };
export const EMPTY_LINE = 'The AI returned no answer this time. You can press Send again.';

// One short sentence per failure: what to do. The technical code is shown beside it, as secondary text.
const LINES: Record<string, string> = {
  busy: 'The AI is busy, or the lab has reached its limit for this month. Try again later.',
  timeout: 'The AI took too long to answer. Wait a little, then press Send again.',
  offline: 'The lab could not be reached. Check your connection, then press Send again.',
  too_large: 'That prompt is too long to send. Make it shorter, then press Send again.',
  filtered: "The AI's safety filter stopped this prompt. Nothing was answered. Try a different prompt.",
  bad_reply: 'The AI sent back an answer the lab could not read. Press Send again.',
  empty: EMPTY_LINE,
};
export const lineFor = (code: string) => LINES[code.split(' ').pop() ?? ''] ?? 'That did not work. Nothing was changed on your side. You can press Send again.';

const text = (v: unknown) => typeof v === 'string';
const orNull = (v: unknown) => v === null || text(v);

// What a response means. 429 is read by status alone (the firewall's body is not ours). The body is checked again here
// because the page shows it: the server already did, and a second look costs three lines.
export function outcome(status: number, body: unknown): Outcome {
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (status === 429) return { ok: false, kind: 'limit', code: '429' };
  if (status === 200) {
    if (fields.filtered === true) return { ok: false, kind: 'filtered', code: 'filtered' }; // the server's seventh kind: moderation
    if (fields.ai_answer === '') return { ok: false, kind: 'error', code: '200 empty' };
    const shaped = ['ai_answer', 'worked', 'try_next', 'why'].every((k) => text(fields[k])) && orNull(fields.example_prompt) && orNull(fields.note);
    return shaped ? { ok: true, reply: fields as Reply } : { ok: false, kind: 'error', code: '200 shape' };
  }
  const code = `${status} ${text(fields.error) ? fields.error : ''}`.trim();
  return { ok: false, kind: status === 503 && fields.error === 'closed' ? 'closed' : 'error', code };
}
