// The feedback page: the DOM side of src/feedback.ts, whose header holds the state model. The only network call is the POST
// below, and only after Send. Replies are written with textContent.
import { LINES, START, canSend, next, outcome, type Event, type Kind, type Name } from './feedback.ts';

const root = document.querySelector<HTMLElement>('[data-feedback]')!;
const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
const form = $<HTMLFormElement>('form');
const [about, message, send, result] = [$<HTMLSelectElement>('select'), $<HTMLTextAreaElement>('textarea'), $<HTMLButtonElement>('[data-send]'), $('[data-result]')];

let state: Name = START;
let flight: AbortController | undefined;

const blank = () => !message.value.trim();
const sync = () => {
  const busy = state === 'sending';
  root.dataset.state = state;
  send.textContent = busy ? 'Sending' : 'Send feedback';
  send.setAttribute('aria-disabled', String(busy));
  send.disabled = blank();
  about.disabled = busy; // Send keeps focus: it is aria-disabled, never disabled
  message.readOnly = busy;
};

function dispatch(event: Event) {
  state = next(state, event);
  sync();
}

async function post(signal: AbortSignal): Promise<Kind> {
  try {
    const res = await fetch('/api/feedback/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ about: about.value, message: message.value }),
      credentials: 'omit',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
    return outcome(res.status, await res.json().catch(() => null));
  } catch {
    return 'error';
  }
}

async function submit() {
  if (!canSend(state) || blank()) return;
  dispatch('send');
  result.textContent = 'Sending your message.';
  const mine = (flight = new AbortController());
  const kind = await post(mine.signal);
  if (flight !== mine) return;
  result.textContent = LINES[kind];
  if (kind === 'sent') message.value = '';
  dispatch(kind === 'sent' ? 'ok' : 'fail');
  result.focus();
}

form.addEventListener('submit', (e) => e.preventDefault());
send.addEventListener('click', submit);
form.addEventListener('input', () => {
  if (state !== 'sending') {
    if (state !== 'ready') result.textContent = '';
    dispatch('edit');
  }
});
addEventListener('pagehide', () => flight?.abort());
sync();
