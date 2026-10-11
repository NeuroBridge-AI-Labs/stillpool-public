// The script of Cases.astro: cases one at a time. The first case's answer comes with the shell's reveal; each later case
// shows once the one before has its answer, and its answer waits for its own pick. Nothing is scored or stored. As text,
// or without JavaScript, data-off shows again and every case and answer is written out (src/styles/settings.css).
export interface Row { label: string; text: string; quote?: boolean; href?: string }
// change: one design choice the reader can make (3.8), with what it moves.
export interface Case { scene: string; answer: Row[]; question?: string; heading?: string; change?: { choice: string; moves: Row[] } }

for (const list of document.querySelectorAll<HTMLElement>('[data-cases]')) {
  const cases = [...list.querySelectorAll<HTMLElement>('[data-case]')];
  cases.forEach((c, i) => i > 1 && c.setAttribute('data-off', ''));
  cases.forEach((c, i) => {
    const answer = c.querySelector<HTMLElement>('[data-answer]');
    const show = c.querySelector<HTMLButtonElement>('[data-show]');
    const fieldset = c.querySelector('fieldset');
    const chosen = () => {
      const select = fieldset?.querySelector('select');
      return select ? (select.value ? select.selectedOptions[0].textContent : null) : fieldset?.querySelector(':checked')?.closest('label')?.textContent;
    };
    if (i && answer && show && fieldset) {
      answer.setAttribute('data-off', '');
      fieldset.addEventListener('input', () => (show.disabled = !chosen()));
      show.addEventListener('click', () => {
        const yours = document.createElement('p');
        yours.textContent = `You picked: ${chosen()}`;
        answer.prepend(yours);
        fieldset.disabled = true;
        show.hidden = true;
        answer.removeAttribute('data-off');
        cases[i + 1]?.removeAttribute('data-off');
        answer.focus(); // the button just went
      });
    }
    const change = c.querySelector<HTMLButtonElement>('[data-change]');
    const moves = c.querySelector<HTMLElement>('[data-moves]');
    if (change && moves) {
      moves.setAttribute('data-off', '');
      change.addEventListener('click', () => {
        change.hidden = true;
        moves.removeAttribute('data-off');
        moves.focus();
      });
    }
  });
}
