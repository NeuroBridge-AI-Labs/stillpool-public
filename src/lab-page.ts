// The practice lab page: the DOM side of src/lab.ts, whose header holds the state model this wires up. Every reply field is
// written with textContent, never as HTML. The only network call is the POST below, and only after Send.
import { OFFLINE, START, TIMEOUT, canSend, lineFor, next, outcome, type LabEvent, type Outcome, type State } from './lab.ts';

const root = document.querySelector<HTMLElement>('[data-lab]')!;
const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
const form = $<HTMLFormElement>('form');
const [send, cancel, start] = [$<HTMLButtonElement>('[data-send]'), $<HTMLButtonElement>('[data-cancel]'), $<HTMLButtonElement>('[data-start]')];
const [prompt, example] = [form.elements.namedItem('prompt') as HTMLTextAreaElement, form.elements.namedItem('example') as HTMLInputElement];
const [live, problem, code, answer, actions] = [$('[data-live]'), $('[data-problem]'), $('[data-code]'), $('[data-answer]'), $('[data-actions]')];

const LIMIT = 'That is a lot of practice in a short time. The lab has a limit so it stays free. Try again in about ten minutes.';

let state: State = START;
let flight: AbortController | undefined;
const sending = () => state.name === 'sending';

const picked = () => form.querySelector<HTMLInputElement>('input[name="exercise"]:checked');
// While a reply is awaited, and once the lab is closed, the choices stay readable but cannot change: prompt read-only,
// exercise and example clicks refused. Focus never moves, so Send keeps it.
const frozen = () => sending() || state.name === 'off';
const syncSend = () => {
  send.disabled = state.name === 'off' || !picked() || !prompt.value.trim();
  $('[data-pick-hint]').hidden = !!picked();
};

const show = (reply: Extract<Outcome, { ok: true }>['reply']) => {
  for (const [field, value] of Object.entries(reply)) {
    const el = answer.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (el) el.textContent = value;
    const row = answer.querySelector<HTMLElement>(`[data-row="${field}"]`);
    if (row) row.hidden = !value;
  }
};

// Render is the only place that reads the state, so the page cannot disagree with the model.
function render(focus?: HTMLElement | null) {
  root.dataset.state = state.name;
  const { name } = state;
  const busy = name === 'sending';
  send.textContent = busy ? 'Sending' : 'Send';
  send.setAttribute('aria-disabled', String(busy));
  cancel.hidden = !busy;
  answer.hidden = !state.had;
  actions.hidden = busy; // the old answer stays readable while a retry is awaited, but its buttons cannot be pressed
  prompt.readOnly = frozen();
  syncSend();
  focus?.focus();
}

function dispatch(event: LabEvent, focus?: () => HTMLElement | null) {
  const before = state;
  state = next(state, event);
  if (state !== before) render(focus?.());
}

async function post(cancelled: AbortSignal): Promise<Outcome> {
  const signal = AbortSignal.any([cancelled, AbortSignal.timeout(25_000)]);
  try {
    const res = await fetch('/api/lab/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exercise: picked()!.value, prompt: prompt.value, example: example.checked }),
      credentials: 'omit',
      signal,
    });
    return outcome(res.status, await res.json().catch(() => null));
  } catch (error) {
    return error instanceof DOMException && error.name === 'TimeoutError' ? TIMEOUT : OFFLINE;
  }
}

// The old result, and nothing the learner typed.
function clearResult() {
  answer.querySelectorAll('[data-field]').forEach((el) => (el.textContent = ''));
  problem.textContent = '';
  code.textContent = '';
}

async function submit() {
  if (!canSend(state) || !picked() || !prompt.value.trim()) return;
  dispatch({ type: 'send' });
  problem.textContent = '';
  code.textContent = '';
  live.textContent = 'Sent. Waiting for the answer.';
  const mine = (flight = new AbortController());
  const result = await post(mine.signal);
  if (!sending() || flight !== mine || mine.signal.aborted) return; // cancelled, or the page was restored
  live.textContent = '';
  if (result.ok) {
    show(result.reply);
    return dispatch({ type: 'ok' }, () => $('#lab-answer'));
  }
  if (result.kind === 'filtered') clearResult(); // the old answer goes with the block; the typed text stays
  if (result.kind !== 'closed') {
    problem.textContent = result.kind === 'limit' ? LIMIT : lineFor(result.code);
    if (result.kind === 'error' && !['filtered', '200 empty'].includes(result.code)) code.textContent = `Code: ${result.code}`;
  }
  dispatch({ type: 'fail', kind: result.kind }, () => (result.kind === 'closed' ? $('[data-off-line]') : problem));
}

function clear() {
  form.reset();
  syncSend();
}

start.hidden = false; // without JavaScript it stays hidden and the noscript line explains
start.addEventListener('click', () => dispatch({ type: 'start' }, () => $('[data-first]')));
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('input', syncSend);
form.addEventListener('click', (e) => {
  const input = e.target instanceof HTMLInputElement ? e.target : null;
  if (input && input.type !== 'text' && frozen()) e.preventDefault();
});
// A different exercise is a different question: the old result goes, so it never sits beside it.
form.addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLInputElement) || e.target.name !== 'exercise') return;
  clearResult();
  dispatch({ type: 'reset' });
});
send.addEventListener('click', submit);
$('[data-again]').addEventListener('click', submit);
cancel.addEventListener('click', () => {
  flight?.abort();
  dispatch({ type: 'cancel' }, () => send);
  live.textContent = 'Cancelled. Nothing was kept.';
});
$('[data-new]').addEventListener('click', () => {
  if (sending()) return; // a reply is awaited: it must not land beside a reset form
  clear();
  clearResult();
  dispatch({ type: 'reset' }, () => prompt);
});
addEventListener('pagehide', () => flight?.abort());
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  flight?.abort();
  clear();
  clearResult();
  live.textContent = '';
  state = START;
  render();
});
syncSend();
