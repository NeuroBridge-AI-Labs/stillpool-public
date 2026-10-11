// Run inside Playwright's page: each read group's text per layer, exactly as src/readaloud.ts reads it (the visible
// siblings' innerText), keyed by the group's data-voice (its heading id). Shared by scripts/voice-tool/voice.ts and
// check:voice.
import type { Page } from '@playwright/test';
import { narrationText } from '../src/lib/narration.ts';

// page.evaluate serialises functions without their imports. Supply the shared extractor in the same expression.
export const readVoiceParts = (page: Page) => page.evaluate<Record<string, Record<string, string>>>(`(${voiceParts.toString()})(${narrationText.toString()})`);

export function voiceParts(readText: (el: HTMLElement) => string) {
  const parts: Record<string, Record<string, string>> = {};
  for (const group of document.querySelectorAll<HTMLElement>('.read[data-voice]')) {
    const layers: Record<string, string> = {};
    for (const name of ['simple', 'deep']) {
      const button = group.previousElementSibling?.querySelector<HTMLButtonElement>(`[data-depth="${name}"]`);
      button?.click();
      const shown: string[] = [];
      for (let el = group.nextElementSibling; el && el.tagName !== 'H2' && !el.matches('[data-part]'); el = el.nextElementSibling) // ends where visible() in src/readaloud.ts ends
        if (el instanceof HTMLElement && el.dataset.layer === name) { // Deep adds under Simple, so each layer is read on its own
          if (!button) el.hidden = el.dataset.layer !== name;
          if (el.getClientRects().length) shown.push(readText(el));
        }
      layers[name] = shown.join('\n');
    }
    parts[group.dataset.voice!] = layers;
  }
  return parts;
}

// Run inside Playwright's page: each layer that no read group reads, because a heading closes its part before it
// (the old split placement: Simple, the activity's own h2, then Deep), or because an activity's [data-part] wrapper
// does. ponytail: the one layer after a [data-part] wrapper that is not narration is 2.5's layer explorer
// (section.layer-explorer, A3-S1) and the skill checker's own-text form (section.skill-own), the activity's own widgets; any other layer with text there fails like any part.
export const readVoiceOrphans = (page: Page) => page.evaluate<{ layer: string; text: string }[]>(`(${voiceOrphans.toString()})()`);

export function voiceOrphans() {
  const orphans: { layer: string; text: string }[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-layer]')) {
    const text = (el.textContent ?? '').trim();
    let group = el.previousElementSibling;
    while (group && !group.matches('.read[data-voice], [data-part]')) group = group.previousElementSibling;
    if (!group) continue; // nested in a component
    if (group.matches('[data-part]')) {
      if (text && !el.matches('section.layer-explorer, section.skill-own')) orphans.push({ layer: el.dataset.layer!, text: text.slice(0, 30) });
      continue;
    }
    for (let next = group.nextElementSibling; next !== el; next = next!.nextElementSibling)
      if (next!.tagName === 'H2') {
        orphans.push({ layer: el.dataset.layer!, text: text.slice(0, 30) });
        break;
      }
  }
  return orphans;
}
