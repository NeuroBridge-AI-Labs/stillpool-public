// Fix round 1 (N3, N5), on the real build: a link says it opens another site once, and no two recorded tables shown on a page are
// landmarks with the same name (a run also kept in the closed "Show all runs" is not in the landmark list until opened).
import { pages } from '../checks/serve.ts';
import { expect, test } from './guard.ts';

const routes = pages('dist');

test('no link carries two warnings in its name, and no two shown recorded tables on a page share a name', async ({ page }) => {
  expect(routes.length).toBeGreaterThan(20);
  const twice: string[] = [];
  const same: string[] = [];
  for (const route of routes) {
    await page.goto(route);
    const found = await page.evaluate(() => {
      const warnings = (a: Element) => (a.textContent!.match(/\((?:different site|opens another site|opens in a new tab)\)/g) ?? []).length;
      const regions = [...document.querySelectorAll('.table-scroll[role="region"]')];
      const names = regions.filter((el) => el.checkVisibility()).map((el) => el.getAttribute('aria-label'));
      const generic = regions.filter((el) => el.getAttribute('aria-label') === 'Recorded comparison table').map(() => 'Recorded comparison table');
      return { twice: [...document.querySelectorAll('a')].filter((a) => warnings(a) > 1).map((a) => a.textContent!.trim().slice(0, 60)), same: [...generic, ...names.filter((n, i) => names.indexOf(n) !== i)] };
    });
    twice.push(...found.twice.map((t) => `${route} ${t}`));
    same.push(...found.same.map((n) => `${route} ${n}`));
  }
  console.log(`LINKS WITH TWO WARNINGS: ${twice.length}; TABLES WITH A SHARED NAME: ${same.length}`);
  expect(twice).toEqual([]);
  expect(same).toEqual([]);
});
