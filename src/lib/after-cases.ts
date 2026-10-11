// The part of a Cases activity that comes after the last case (Pillar 4: the recorded runs). Cases.astro shows an answer by
// removing its data-off, so this part waits until the last case's answer has lost it. As text, or without JavaScript, data-off
// shows again (src/styles/settings.css) and the part is written out in full. Nothing is stored.
for (const part of document.querySelectorAll<HTMLElement>('[data-after-cases]')) {
  const last = [...document.querySelectorAll(`.cases.${part.dataset.afterCases} [data-case]`)].at(-1)?.querySelector('[data-answer]');
  if (!last?.hasAttribute('data-off')) continue; // no case to wait for
  part.setAttribute('data-off', '');
  const watch = new MutationObserver(() => {
    if (last.hasAttribute('data-off')) return;
    part.removeAttribute('data-off');
    watch.disconnect();
  });
  watch.observe(last, { attributes: true, attributeFilter: ['data-off'] });
}
