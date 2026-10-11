// check:reviews (p6 D5, R3-S1). A review under docs/factcheck is only ever added: a modified, deleted, renamed, copied or
// retyped review since origin/main is refused, in the working tree too. Fails closed with no origin/main. The save code's
// slots are append-only the same way (p6-2-review S5).
// ponytail: copies are found at 90% similarity or more, so a lazy copy-and-edit is caught and a genuine re-review
// (new wording) is not; a forger who rewrites more than a tenth gets past it, the third limit in src/factcheck.ts.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const NAME = 'reviews';
const SLOTS = 'src/progress/slots.ts';
const VERB: Record<string, string> = { D: 'deleted', M: 'modified', R: 'renamed', C: 'copied', T: 'type changed' };
const findings: string[] = [];
for (const repo of process.argv.slice(2).length ? process.argv.slice(2) : ['.']) {
  const git = (...args: string[]) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  if (!existsSync(join(repo, '.git'))) findings.push(`${NAME}: nothing to check in ${repo}`);
  else if (git('rev-parse', '--verify', '-q', 'origin/main').status !== 0) findings.push(`${NAME}: ${repo}: no origin/main to compare with`);
  else {
    // The working tree against the merge base, then each commit since origin/main (p6-0-review S2): on a stack, an add in
    // the base PR and an edit in the next are one A to the first. A merge commit against its first parent (r2 SHOULD-FIX
    // 1). The limit: an edit folded into the base PR's own commit reads as an add from the head, so check:reviews
    // re-runs on the exact head that merges, after its base PR has merged.
    for (const range of [['diff', '--merge-base', 'origin/main'], ['log', '--format=', '--diff-merges=first-parent', 'origin/main..HEAD']]) {
      const r = git(...range, '--name-status', '-C90%', '--find-copies-harder', '--diff-filter=DMRCT', '--', 'docs/factcheck');
      if (r.status !== 0) findings.push(`${NAME}: ${repo}: git ${range[0]} failed: ${r.stderr.trim()}`);
      for (const [status, from, to] of r.stdout.split('\n').filter(Boolean).map((l) => l.split('\t'))) {
        const k = status[0];
        findings.push(to ? `${NAME}: ${to}: ${VERB[k]} from ${from} (${k})` : `${NAME}: ${from}: ${VERB[k]} (${k})`);
      }
    }
    // r2 SHOULD-FIX 2: a folder link on a review's path would move every later review where no diff looks.
    for (const l of git('ls-files', '-s', '--', 'docs').stdout.split('\n').filter((l) => l.startsWith('120000'))) findings.push(`${NAME}: ${l.split('\t')[1]}: a link under docs`);
    // p6-0-review S1: git diff never lists an untracked file; ignored ones count too.
    for (const f of git('ls-files', '--others', '--', 'docs/factcheck').stdout.split('\n').filter(Boolean)) findings.push(`${NAME}: ${f}: untracked: commit a review before verify`);
    // p6-2-review S5 (p5 plan D8): the head's slots start with main's, or an old save code restores the wrong lesson.
    // ponytail: the quoted ids inside `SLOTS = [...]`; a main with no such file has nothing to keep.
    const slots = (ts: string) => [...(/SLOTS\b[^=]*=\s*\[([^\]]*)\]/.exec(ts)?.[1] ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const main = git('show', `origin/main:${SLOTS}`);
    const now = existsSync(join(repo, SLOTS)) ? slots(readFileSync(join(repo, SLOTS), 'utf8')) : [];
    const moved = main.status === 0 ? slots(main.stdout).findIndex((id, i) => now[i] !== id) : -1;
    if (moved >= 0) findings.push(`${NAME}: ${SLOTS}: slot ${moved} moved (append only, D8)`);
  }
}
if (findings.length) {
  console.error([...new Set(findings)].join('\n'));
  process.exitCode = 1;
}
