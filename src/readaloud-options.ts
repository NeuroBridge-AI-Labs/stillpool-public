// The read-aloud voice list's pure half (readaloud.ts): what the <select> should contain for a given voice set and
// choice. Kept out of readaloud.ts because that file touches document/window at import time (module side effects on
// import), so this is what a vitest test (readaloud-options.test.ts) can reach without a DOM.
export type VoiceOption = { value: string; label: string; selected: boolean };
export type VoiceList = { options: VoiceOption[] };
type Voice = { name: string; lang: string; voiceURI: string };

// Emma's audio files, made once (scripts/voice-tool/voice.ts), come first: the default wherever a part has one.
export const EMMA = 'emma';
export const buildVoiceList = (found: Voice[], pick?: string): VoiceList => ({
  options: [
    { value: EMMA, label: 'Emma (en-GB), made for this site', selected: pick === EMMA },
    ...found.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})`, selected: v.voiceURI === pick })),
  ],
});

// ponytail: JSON.stringify is a one-line deep-equal for this small, always-same-shape value; add a real structural
// compare only if this value ever grows a Map/Set/function (check:stillness: a late voiceschanged that would
// rebuild an identical list must not touch the DOM).
export const sameVoiceList = (a: VoiceList, b: VoiceList | undefined) => JSON.stringify(a) === JSON.stringify(b);
