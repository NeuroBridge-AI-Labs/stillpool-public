// The shell's script (p6 D2): predict first. The reveal is enabled once every question in the first step has a choice
// (a checked radio, a chosen option of a select[data-pick] where there are more than five, as in 3.8, or a whole number in a
// number field, as in 1.3); after it, each choice's data-said is read out in
// words, never scored, and focus keeps the reader's place. Typing anywhere else (1.3's own box) says nothing again.
// Next to the question each choice answers, a radio's own words are shown as "Your prediction" and what is said after the
// first sentence of its data-said as "What happened" (a said with one sentence has nothing to add). In a shell marked
// `local` (2.7) the prediction is shown even then, and the live message only says where the feedback is.
for (const shell of document.querySelectorAll<HTMLElement>('[data-shell]')) {
  const local = 'local' in shell.dataset;
  const reveal = shell.querySelector<HTMLButtonElement>('[data-reveal]');
  const said = shell.querySelector<HTMLElement>('.picked');
  const choices = [...shell.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-step] :is(input[data-said], select[data-pick])')];
  const questions = new Set(choices.map((c) => c.name)).size;
  const given = (c: HTMLInputElement | HTMLSelectElement) => (c instanceof HTMLSelectElement ? c.value !== '' : c.type === 'number' ? c.value !== '' && c.validity.valid : c.checked);
  const words = (c: HTMLInputElement | HTMLSelectElement) => (c instanceof HTMLSelectElement ? c.selectedOptions[0].dataset.said : c.dataset.said);
  const line = (label: string, text: string) => {
    const p = document.createElement('p');
    p.append(Object.assign(document.createElement('strong'), { textContent: `${label}.` }), ` ${text}`);
    return p;
  };
  const feedback = (box: Element, c?: HTMLInputElement | HTMLSelectElement) => {
    box.querySelector(':scope > .feedback')?.remove();
    const said = c && words(c);
    const cut = said ? said.indexOf('. ') : -1;
    if (!c || !said || (cut < 0 && !local) || box.classList.contains('build')) return; // a fieldset that builds something is no prediction
    const happened = cut < 0 ? '' : said.slice(cut + 2);
    const own = c instanceof HTMLInputElement && c.type === 'radio' ? c.closest('label')?.textContent?.trim() : undefined;
    const div = Object.assign(document.createElement('div'), { className: 'feedback' });
    div.append(line('Your prediction', own || (cut < 0 ? said : said.slice(0, cut + 1))));
    if (happened) div.append(line(happened === 'That is fair.' ? 'Feedback' : 'What happened', happened));
    box.append(div);
  };
  const say = () => {
    const picked = choices.filter(given);
    if (reveal) reveal.disabled = picked.length < questions;
    if (!said || !shell.classList.contains('revealed')) return;
    said.textContent = local ? 'Your prediction and what happened are above, under its question. Your card is below.' : picked.map(words).join('\n');
    for (const box of new Set(choices.map((c) => c.closest('fieldset')))) if (box) feedback(box, picked.find((c) => c.closest('fieldset') === box));
  };
  shell.addEventListener('input', (e) => choices.includes(e.target as HTMLInputElement) && say());
  reveal?.addEventListener('click', () => {
    shell.classList.add('revealed');
    say();
    said?.focus(); // the button just went (p5-pr11-review NICE 1)
  });
}
