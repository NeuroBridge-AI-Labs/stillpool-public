// The check-in (plan T6.3, D6): an opened option's explanation goes to its question's polite live region at once.
// toggle does not bubble, so it is heard in the capture phase. A right option records its step (D7), checkin-<n>, the
// name its options share, and a badge follows once every earnedBy step is done.
import { recordStep } from './progress/store.ts';

addEventListener(
  'toggle',
  (e) => {
    const option = e.target;
    if (!(option instanceof HTMLDetailsElement) || !option.open) return;
    const live = option.closest('.question')?.querySelector('[aria-live]');
    if (live) live.textContent = option.querySelector('.why')?.textContent ?? '';
    const lesson = option.closest<HTMLElement>('[data-lesson]')?.dataset;
    if (lesson?.lesson && option.hasAttribute('data-right')) recordStep(lesson.lesson, option.name, (lesson.earnedBy ?? '').split(' '));
  },
  true,
);
