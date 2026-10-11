// The search page's script: a combobox over the lesson titles (WAI-ARIA list autocomplete, manual selection: focus stays in the
// input and nothing is selected until an arrow key), and Pagefind for free text. Matching is src/lib/lesson-suggestions.ts.
import { type Lesson, suggest } from './lib/lesson-suggestions.ts';

type Result = { url: string; excerpt: string; meta: { title?: string } };
type Pagefind = { search: (term: string) => Promise<{ results: { data: () => Promise<Result> }[] }> };

const form = document.querySelector<HTMLFormElement>('#search');
const field = document.querySelector<HTMLInputElement>('#q');
const list = document.querySelector<HTMLUListElement>('#suggestions');
const status = document.querySelector('#search-status');
const results = document.querySelector('#results');
const none = document.querySelector<HTMLElement>('#search-map');
const INDEX = '/pagefind/pagefind.js'; // written by `pagefind --site dist` after the build, so Vite must not resolve it
let pagefind: Promise<Pagefind> | undefined;
let latest = 0; // a slower, older search never overwrites a newer one, and typing invalidates one still waiting (pr9-review NICE 3)
const text = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';

if (form && field && list && status && results && none) {
  const lessons: Lesson[] = JSON.parse(form.dataset.lessons ?? '[]');
  let shown: Lesson[] = [];
  let active = -1;

  const mark = () => {
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active < 0) field.removeAttribute('aria-activedescendant');
    else field.setAttribute('aria-activedescendant', `suggestion-${active}`);
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  };
  const show = (found: Lesson[]) => {
    shown = found;
    active = -1;
    list.replaceChildren(
      ...found.map((lesson, i) => {
        const li = Object.assign(document.createElement('li'), { id: `suggestion-${i}`, className: 'suggestion' });
        li.setAttribute('role', 'option');
        li.append(
          Object.assign(document.createElement('span'), { textContent: lesson.title }),
          Object.assign(document.createElement('small'), { textContent: [lesson.number && `Lesson ${lesson.number}`, lesson.pillar].filter(Boolean).join(' · ') }),
        );
        return li;
      }),
    );
    list.hidden = !found.length;
    field.setAttribute('aria-expanded', String(found.length > 0));
    mark();
  };
  const open = (lesson?: Lesson) => lesson && location.assign(lesson.url);

  field.addEventListener('input', () => {
    latest++;
    status.textContent = '';
    results.replaceChildren();
    none.hidden = true;
    show(suggest(field.value, lessons));
  });
  field.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // an IME's own Enter and arrows pick its characters
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown.length) show(suggest(field.value, lessons));
      active = Math.min(Math.max(active + (e.key === 'ArrowDown' ? 1 : -1), 0), shown.length - 1);
      mark();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      open(shown[active]);
    } else if (e.key === 'Escape' && shown.length) {
      e.preventDefault(); // a search field would also clear its text
      show([]);
    }
  });
  field.addEventListener('focusout', () => show([])); // Tab or a click elsewhere closes the list without choosing
  list.addEventListener('mousedown', (e) => e.preventDefault()); // keeps focus in the input, so focusout does not close the list before the click
  list.addEventListener('click', (e) => open(shown[[...list.children].indexOf((e.target as Element).closest('li') as Element)]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // the CSP's form-action 'none' refuses a real submit
    const term = field.value.trim();
    if (!term) return;
    show([]);
    results.replaceChildren();
    none.hidden = true;
    status.textContent = 'Searching the lessons.';
    const mine = ++latest;
    let found: Result[];
    try {
      pagefind ??= import(/* @vite-ignore */ INDEX);
      found = await Promise.all((await (await pagefind).search(term)).results.map((r) => r.data()));
    } catch (error) {
      if (mine !== latest) return; // a newer search has answered (p5-pr10-review-r2 NICE 2)
      pagefind = undefined; // the next search tries again
      console.warn('search:', error);
      status.textContent = 'Search could not load. Please try again.';
      return;
    }
    if (mine !== latest) return;
    results.replaceChildren(
      ...found.map(({ url, excerpt, meta }) => {
        const link = Object.assign(document.createElement('a'), { href: url, textContent: meta.title ?? url });
        const li = document.createElement('li');
        li.append(link, Object.assign(document.createElement('p'), { textContent: text(excerpt) }));
        return li;
      }),
    );
    status.textContent = found.length ? `Lessons that match "${term}":` : `No lessons match "${term}".`;
    none.hidden = found.length > 0;
  });
}
