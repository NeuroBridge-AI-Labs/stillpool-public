// A lesson's drawing, for its tile on the map, its lesson header and its badge emblem (Pool Band v2). The four the
// designers drew are 48 px line drawings; every other lesson takes a Phosphor icon (MIT, see NOTICE), which has the same
// 3 px line at this size, so the two sit together. A lesson with no drawing yet falls back to its pillar's.
import { readFileSync } from 'node:fs';

export type Glyph = { view: number; kit: boolean; inner: string };

const KIT: Record<string, string> = {
  'how-ai-works/what-ai-is-and-is-not': '<path d="M13 24C22 24 23 13 32 13M13 24H33M13 24C22 24 23 35 32 35"/><circle class="dot" cx="11" cy="24" r="4"/><circle class="dot" cx="36" cy="13" r="3.5"/><circle class="dot" cx="37" cy="24" r="3.5"/><circle cx="36" cy="35" r="3.5"/>',
  'how-ai-works/rules-or-examples': '<path d="M9 12H20V33M15 28l5 5 5-5"/><circle class="dot" cx="31" cy="33" r="3"/><circle class="dot" cx="35" cy="23" r="3"/><circle class="dot" cx="40" cy="14" r="3"/>',
  'how-ai-works/tokens': '<rect x="7" y="10" width="34" height="10" rx="5"/><rect x="7" y="29" width="9" height="10" rx="3"/><rect x="19" y="29" width="12" height="10" rx="3"/><rect x="34" y="29" width="7" height="10" rx="3"/>',
  'prompting/a-skill-is-a-written-procedure': '<rect x="10" y="6" width="28" height="36" rx="5"/><path d="M21 16h11M21 24h11M21 32h11"/><circle class="dot" cx="16" cy="16" r="2"/><circle class="dot" cx="16" cy="24" r="2"/><circle class="dot" cx="16" cy="32" r="2"/>',
};
const ICON: Record<string, string> = {
  'how-ai-works/the-next-word': 'cursor-text',
  'how-ai-works/where-your-question-goes': 'paper-plane-tilt',
  'how-ai-works/why-they-make-things-up': 'seal-question',
  'how-ai-works/training': 'barbell',
  'how-ai-works/attention-and-the-context-window': 'eye',
  'how-ai-works/images-and-sound': 'image',
  'how-ai-works/feeds': 'rss',
  'prompting/bad-and-good-prompts': 'thumbs-up',
  'prompting/context': 'stack',
  'prompting/roles-and-ground-rules': 'identification-badge',
  'prompting/examples': 'copy',
  'prompting/format': 'layout',
  'prompting/iterate-and-check': 'arrows-clockwise',
  'ethics/who-shapes-what-ai-shows': 'megaphone',
  'ethics/bias': 'scales',
  'ethics/privacy-where-your-words-go': 'lock-key',
  'ethics/environmental-cost': 'leaf',
  'ethics/harm-and-misuse': 'shield-warning',
  'ethics/work-creativity-and-credit': 'paint-brush',
  'ethics/the-law': 'gavel',
  'ethics/what-trustworthy-ai-needs': 'handshake',
};
// A pillar is a hexagon with its own mark inside, so the map's rows tell apart at a glance.
const HEX = '<path d="M24 4 41.3 14v20L24 44 6.7 34V14z"/>';
const PILLAR: Record<string, string> = {
  'how-ai-works': `${HEX}<circle class="dot" cx="24" cy="24" r="4"/>`,
  prompting: `${HEX}<path d="M19 19l6 5-6 5M27 30h5"/>`,
  ethics: `${HEX}<circle cx="24" cy="24" r="5.5"/>`,
};

const phosphor = (name: string) => /<svg[^>]*>(.*)<\/svg>/s.exec(readFileSync(`node_modules/@phosphor-icons/core/assets/regular/${name}.svg`, 'utf8'))![1];

export const pillarGlyph = (pillar: string): Glyph => ({ view: 48, kit: true, inner: PILLAR[pillar] ?? HEX });
export const lessonGlyph = (id: string): Glyph =>
  KIT[id] ? { view: 48, kit: true, inner: KIT[id] } : ICON[id] ? { view: 256, kit: false, inner: phosphor(ICON[id]) } : pillarGlyph(id.split('/')[0]);

// A sprite symbol's id, for the pages that draw many drawings (the map): each drawing is in the page once and used where it
// is shown, so 24 lessons do not mean 48 copies of their paths in the HTML.
export const symbolId = (key: string) => `g-${key.replace(/\//g, '-')}`;
