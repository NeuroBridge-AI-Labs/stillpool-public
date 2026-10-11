// Restore (plan T7.4, D8, S3). A restore link, <origin>/#p=<code>, loses its fragment first, so the code never stays
// in the address or reaches a later request; then the code is read and the result said in a polite live region. The
// Settings dialog's "Move your progress" form does the same for a typed code. Restore is a union: it removes nothing.
// Delete, in the same form, asks once in the page (never confirm(), R4 section 2.6) and is the one way to remove.
import { decode } from './progress/code.ts';
import { clear, restore } from './progress/store.ts';

const apply = (code: string, status: Element | null) => {
  const found = decode(code);
  const kept = found.ok && restore(found);
  if (status)
    status.textContent = !found.ok ? found.message : kept ? 'Your progress is back on this device.' : 'This browser has no room left to keep your progress.';
};

// Read at load and on hashchange: a link opened on a page that is already open does not reload it (pr7-review SHOULD-FIX 1).
// Only / says the result, so a link that lands anywhere else goes there, replacing its own history entry (NICE 3).
const status = document.querySelector('#restore-status');
const fromLink = () => {
  const code = new URLSearchParams(location.hash.slice(1)).get('p');
  if (code === null) return;
  if (!status) return location.replace(`/${location.hash}`);
  history.replaceState(history.state, '', location.pathname + location.search);
  apply(code, status);
};
fromLink();
addEventListener('hashchange', fromLink);

const move = document.querySelector<HTMLFormElement>('#move-progress');
move?.addEventListener('submit', (e) => {
  e.preventDefault(); // the CSP's form-action 'none' refuses a real submit
  apply(String(new FormData(move).get('code') ?? ''), move.querySelector('.restored'));
});
// The field is a textarea so a code wraps; Enter in it still restores, as it did in a one-line field. Only the field:
// on the form it would cancel Enter on every button there (foldB-review BLOCKER 1).
move?.querySelector<HTMLTextAreaElement>('#save-code')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  move.requestSubmit();
});

// Focus never falls with a hidden button: asking focuses Cancel, the safe choice; either answer returns to Delete.
const check = document.querySelector<HTMLElement>('.delete-check');
const ask = document.querySelector<HTMLElement>('[data-delete="ask"]');
addEventListener('click', (e) => {
  const step = (e.target as Element).closest<HTMLElement>('[data-delete]')?.dataset.delete;
  if (!step || !check || !ask) return;
  check.hidden = step !== 'ask';
  (step === 'ask' ? check.querySelector<HTMLElement>('[data-delete="no"]') : ask)?.focus();
  if (step !== 'yes') return;
  clear();
  (move?.querySelector('.restored') as HTMLElement).textContent = 'Your progress on this device is deleted.';
});
