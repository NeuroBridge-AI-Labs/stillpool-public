// check:register (plan T5.1 i). In every research pack (*.md) under <target>, each row of a table with a Licence and a
// Use column names a licence and a use (cite, link or adapt), and "adapt" only on a licence spec section 9 lets us
// adapt. Ported from .ops/registercheck.py, which also accepted share-alike and the 2023 W3C Document License.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const NAME = 'register';
// Spec 9, "Link or cite only": NC, ND, SA, all rights reserved, personal use only, unknown or no licence.
const NO_ADAPT = /\b(?:NC|ND|SA)\b|share-?alike|non-?commercial|no-?deriv|all rights reserved|personal use|unknown|no licen[cs]e/i;
// Spec 9, "May adapt", as an allowlist: a bare copyright line alone in its cell never passes. ponytail: a cell of
// several licences passes if one part does, unless the use scopes its adapt (below). Only the 2015 W3C licence is named: the
// W3C Document License (2023) allows no changes, and the Phase 1 script's "W3C (Software and )?Document" let it in.
const ADAPT_OK = /\bCC BY\b|\bCC0\b|public domain|\bMIT\b|Apache|\bBSD\b|\bOFL\b|SIL Open Font|W3C Software and Document|2011\/833\/EU|Oireachtas|own work/i;
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

const findings: string[] = [];
for (const target of process.argv.length > 2 ? process.argv.slice(2) : ['docs/packs']) {
  const files = globSync('**/*.md', { cwd: target }).sort();
  if (!files.length) findings.push(`${NAME}: nothing to check in ${target}`);
  for (const file of files) {
    const flag = (reason: string) => findings.push(`${NAME}: ${file}: ${reason}`);
    let head: [number, number] | undefined; // the Licence and Use columns of the table being read
    let rows = 0;
    for (const line of readFileSync(join(target, file), 'utf8').split('\n')) {
      if (!line.trimStart().startsWith('|')) {
        head = undefined;
        continue;
      }
      const row = cells(line);
      const lower = row.map((c) => c.toLowerCase());
      // "Licence" or "License" (p5-pr10-review SHOULD-FIX 1).
      const licenceAt = lower.findIndex((c) => /^licen[cs]e\b/.test(c)); // "Licence (SPDX)" too (p5-pr10-review-r2 NICE 1)
      if (licenceAt >= 0 && lower.includes('use')) {
        head = [licenceAt, lower.indexOf('use')];
        continue;
      }
      if (!head || /^[\s|:-]+$/.test(line)) continue;
      rows += 1;
      const [licence, use] = [row[head[0]], row[head[1]]];
      if (use === undefined) {
        flag(`${row[0]}: short row`);
        continue;
      }
      // A note beside the use is fine ("link, never adapt", "adapt (signed take only)"); "never adapt" is no adapt.
      // "adapted" is adapt, "cited" is cite (p5-pr10-review SHOULD-FIX 1).
      const unsaid = use.toLowerCase().replace(/\b(?:never|not|no)\s+adapt\w*/g, '');
      const uses = new Set([...unsaid.matchAll(/\b(cite|link|adapt)\w*/g)].map((m) => m[1]));
      if (!licence) flag(`${row[0]}: no licence`);
      if (!uses.size) flag(`${row[0]}: no use (cite, link or adapt)`);
      // A row of several licences may scope its adapt, "adapt (AILit only)": then only the licence labelled "(AILit)" counts.
      const only = /\badapt\w*\s*\(([^)\s]+) only\b/i.exec(use)?.[1];
      const adapted = (only && licence.split(';').find((part) => part.includes(`(${only})`))?.trim()) || licence;
      if (uses.has('adapt') && (NO_ADAPT.test(adapted) || !ADAPT_OK.test(adapted))) flag(`${row[0]}: adapt on '${adapted}'`);
    }
    if (!rows) flag('no source rows');
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
}
