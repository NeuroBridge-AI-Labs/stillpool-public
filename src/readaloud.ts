// Read-aloud (plan T9.1, D13, amended 28-09-26). Emma first: where each visible layer of a part has an audio file (made once by
// scripts/voice-tool/voice.ts, served from this site), Read aloud shows and plays that part's native <audio>, Simple's file then Deep's when both show. Elsewhere,
// only the device's own voices (localService), English first, and every utterance names one: a browser's default voice
// may send the text to a server. With no such voice the control says so and speak() is never called. "Reading voice" in
// Settings lists Emma, then the same voices; the choice is stored in nbl:settings.voice; the reading speed (1 to 1.5) is in nbl:settings.speed,
// and Emma's player and every device utterance follow it.
import { buildVoiceList, EMMA, sameVoiceList, type VoiceList } from './readaloud-options.ts';

import { narrationText } from './lib/narration.ts';

const SETTINGS_KEY = 'nbl:settings';
const synth = 'speechSynthesis' in window ? speechSynthesis : undefined;
const english = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('en');
const voices = () => (synth?.getVoices() ?? []).filter((v) => v.localService).sort((a, b) => Number(english(b)) - Number(english(a)));
const settings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    return {}; // no storage, or a value that is not JSON
  }
};
const chosen = () => voices().find((v) => v.voiceURI === settings().voice) ?? voices()[0];
const SPEEDS = [1, 1.1, 1.2, 1.3, 1.4, 1.5];
const speed = () => SPEEDS.find((v) => v === Number(document.documentElement.dataset.speed)) ?? 1; // src/settings.ts and boot.js keep it on <html>
const emma = () => (settings().voice || EMMA) === EMMA;

const list = document.querySelector<HTMLSelectElement>('#voice');
const dialog = document.querySelector<HTMLDialogElement>('#settings');
let lastList: VoiceList | undefined;
const fill = () => {
  if (!list || !dialog?.open) return;
  const next = buildVoiceList(voices(), emma() ? EMMA : chosen()?.voiceURI);
  if (sameVoiceList(next, lastList)) return; // ponytail: skip a rebuild that would change nothing (check:stillness)
  lastList = next;
  list.replaceChildren(...next.options.map((o) => new Option(o.label, o.value, false, o.selected)));
};
dialog?.addEventListener('toggle', fill);
synth?.addEventListener('voiceschanged', fill); // Chrome lists its voices after the page loads
list?.addEventListener('change', () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings(), voice: list.value }));
  } catch {
    list.value = emma() ? EMMA : (chosen()?.voiceURI ?? ''); // no storage: show the voice this page will use
  }
});

// A section's visible layer: the siblings after its read group, up to the next heading or the activity, that show (D5 may hide one).
const visible = (group: Element) => {
  const shown: HTMLElement[] = [];
  for (let el = group.nextElementSibling; el && el.tagName !== 'H2' && !el.matches('[data-part]'); el = el.nextElementSibling)
    if (el instanceof HTMLElement && el.dataset.layer && el.getClientRects().length) shown.push(el); // shown; any Safari (pr9-review NICE 3)
  return shown;
};
const say = (group: Element, text: string) => {
  const status = group.querySelector('[role="status"]');
  if (status) status.textContent = text;
};
// A part showing both layers: the part's one <audio> plays each layer's file in turn (so mute and volume carry over),
// while the next file is warmed off the page, so the handoff finds it already loaded.
type Run = { files: string[]; layers: string[]; at: number; warm: HTMLAudioElement[] };
const runs = new WeakMap<HTMLAudioElement, Run>();
// Let go of a run's warmers: no further download, nothing kept.
const release = (run?: Run) => {
  for (const w of run?.warm.splice(0) ?? []) { w.removeAttribute('src'); w.load(); }
};
// Each play() call has its own token. A rejection acts only while its token is the element's current one, so cancelling a
// pending play() never touches the part's queue (the run), and a paused part can be resumed from where it was (D10, D13 to D15).
const pending = new WeakMap<HTMLAudioElement, object>();
const pause = (audio: HTMLAudioElement) => {
  pending.delete(audio); // before the pause: the AbortError it causes is then ignored
  audio.pause();
};
const fellBack = new WeakSet<HTMLAudioElement>(); // a failed file's later media events must not replace the fallback line
const play = (run: Run, at: number, audio: HTMLAudioElement, group: Element) => {
  run.at = at;
  audio.hidden = false;
  if (audio.getAttribute('src') !== run.files[at]) {
    audio.defaultPlaybackRate = audio.playbackRate; // the load resets playbackRate to this, so the learner's speed carries
    audio.src = run.files[at];
  }
  else audio.currentTime = 0;
  fellBack.delete(audio);
  const token = {};
  pending.set(audio, token);
  audio.play().catch((error) => {
    if (error?.name === 'AbortError' || pending.get(audio) !== token || audio.hidden) return; // a pause or a new load, cancelled, replaced, or already handled: the learner's intent stands
    stopped(audio, group);
  });
};
// The Speed button is a way to Settings, added only once a part reads, so an idle page never changes.
const addSpeed = (group: Element) => {
  if (group.querySelector('[data-read="speed"]')) return;
  const button = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Speed' });
  button.dataset.read = 'speed';
  button.setAttribute('aria-haspopup', 'dialog');
  group.querySelector('[data-read="stop"]')?.after(button);
};
const start = (group: Element, audio: HTMLAudioElement, files: string[], layers: string[]) => {
  audio.preload = 'none';
  audio.playbackRate = audio.defaultPlaybackRate = speed(); // the file's load keeps the default; a native-menu speed lasts for the part it was set on
  addSpeed(group);
  const warm = files.slice(1).map((src) => Object.assign(new Audio(), { preload: 'auto', src })); // never in the page, never played
  const run = { files, layers, at: 0, warm };
  runs.set(audio, run);
  play(run, 0, audio, group);
};
// Device speech starts only from a learner's click. When Emma fails after a run began, the part stops and offers the rest
// on the device voice: this line and button are the part's, and any start of any player clears them.
let deviceGroup: Element | undefined;
let speaking: SpeechSynthesisUtterance | undefined; // the rest-of-part utterance whose end or error may still be said
const clearDevice = () => {
  speaking = undefined; // a late end or error of a cancelled utterance says nothing
  if (deviceGroup) say(deviceGroup, '');
  deviceGroup?.querySelector('[data-read="rest"]')?.remove();
  deviceGroup = undefined;
};
const stopped = (audio: HTMLAudioElement, group: Element) => {
  const run = runs.get(audio);
  release(run);
  audio.hidden = true;
  fellBack.add(audio);
  clearDevice();
  const layers = run?.layers.slice(run.at) ?? [];
  if (!unread(group, layers)) return say(group, 'Finished.'); // no unread text shows: nothing to offer
  deviceGroup = group;
  if (!chosen()) return say(group, 'Emma could not play the rest of this part, and this device has no voice of its own.');
  say(group, 'Emma could not play the rest of this part.');
  const rest = Object.assign(document.createElement('button'), { type: 'button', textContent: "Read the rest with this device's voice" });
  rest.dataset.read = 'rest';
  rest.dataset.layers = layers.join(',');
  group.querySelector('[role="status"]')?.after(rest);
};
const unread = (group: Element, layers?: string[]) =>
  visible(group).filter((el) => !layers || layers.includes(el.dataset.layer ?? '')).map(narrationText).join('\n');
// The device voice cannot change rate mid-utterance, so a speed change speaks the rest again from the last word boundary.
type Speech = { group: Element; text: string; voice: SpeechSynthesisVoice; layers?: string[]; from: number; live?: SpeechSynthesisUtterance };
let current: Speech | undefined;
const utter = (s: Speech) => {
  const utterance = new SpeechSynthesisUtterance(s.text.slice(s.from));
  const base = s.from;
  utterance.voice = s.voice;
  utterance.lang = s.voice.lang;
  utterance.rate = speed();
  utterance.onboundary = (e) => { s.from = base + e.charIndex; };
  s.live = utterance; // held here so the browser keeps it, and so a cancelled utterance's late end changes nothing
  if (s.layers) speaking = utterance;
  const done = (line: string) => () => {
    if (current === s && s.live === utterance) current = undefined; // this reading is over: a later speed change has nothing to say again
    if (speaking === utterance) (speaking = undefined, say(s.group, line));
  };
  utterance.onend = done('Finished.');
  utterance.onerror = done('Your device voice could not read the rest of this part.');
  synth?.speak(utterance);
};
const cancelSpeech = () => {
  synth?.cancel();
  current = undefined;
};
const speak = (group: Element, layers?: string[]) => {
  const voice = chosen();
  const text = unread(group, layers);
  if (layers && voice && !text) return say(group, 'Finished.'); // the rest is not on screen any more (a depth flip): nothing to read
  deviceGroup = layers ? group : undefined;
  say(group, !voice ? 'This device has no voice of its own, so it cannot read aloud here.' : layers ? 'Your device voice is reading the rest of this part.' : '');
  if (!synth || !voice || !text) return;
  addSpeed(group);
  current = { group, text, voice, layers, from: 0 };
  utter(current);
};

addEventListener('click', (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>('.read button');
  const group = button?.parentElement;
  if (!button || !group) return;
  if (button.dataset.read === 'speed') { // only a way to Settings: nothing stops or pauses
    dialog?.showModal();
    const radio = dialog?.querySelector<HTMLInputElement>('input[name="speed"]:checked') ?? dialog?.querySelector<HTMLInputElement>('input[name="speed"]');
    const box = radio?.closest('details');
    if (box) box.open = true; // a radio in a closed disclosure cannot take focus
    radio?.focus();
    return;
  }
  const rest = button.dataset.read === 'rest' ? (button.dataset.layers ?? '').split(',') : undefined;
  cancelSpeech();
  clearDevice();
  const audio = group.querySelector('audio');
  if (audio) audio.hidden = true; // hidden first, so its pause is not announced
  for (const playing of document.querySelectorAll('audio')) pause(playing); // one voice at a time; another part keeps its queue and can be resumed
  if (audio) { release(runs.get(audio)); runs.delete(audio); } // this part starts again, or stops
  if (button.dataset.read === 'stop') return say(group, '');
  if (rest) return speak(group, rest);
  const layers = [...new Set(visible(group).map((el) => el.dataset.layer ?? ''))];
  const files = emma() && layers.length && layers.every((l) => l === 'simple' || l === 'deep') ? layers.map((l) => audio?.dataset[l]) : [];
  if (!audio || !files.length || !files.every(Boolean)) return speak(group); // a layer with no file: the device voice reads what shows
  start(group, audio, files as string[], layers);
});
// A speed chosen in Settings reaches every player, playing or not, and a speaking device voice. src/settings.ts hears the
// same change first and has already set html[data-speed]. A rate set by a player's own menu is never heard or stored here.
addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLInputElement) || e.target.name !== 'speed') return;
  for (const audio of document.querySelectorAll('audio')) audio.playbackRate = speed();
  const s = current; // held across cancel(): an engine may end the old speech inside it, which clears current
  if (s && synth?.speaking) {
    synth.cancel();
    current = s;
    utter(s);
  }
});
// Emma's state, said politely in the group's status. One voice at a time: a playing file stops every other voice.
for (const type of ['play', 'playing', 'pause', 'ended'])
  addEventListener(type, (e) => {
    const audio = e.target;
    if (!(audio instanceof HTMLAudioElement) || !audio.parentElement || fellBack.has(audio)) return;
    const run = runs.get(audio);
    if (run && audio.ended && !audio.hidden && run.at < run.files.length - 1) { // a layer is done, the next is still to read
      if (type === 'ended') play(run, run.at + 1, audio, audio.parentElement);
      return;
    }
    if (type === 'play') {
      cancelSpeech();
      clearDevice(); // any start clears the device voice's line and button (D17)
      for (const other of document.querySelectorAll('audio')) if (other !== audio) pause(other); // by any control, Read aloud or a native Play
    }
    const waiting = run && run.at > 0 && !audio.paused && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA; // this player has no data to play yet
    if (run && ((type === 'playing' && run.at > 0) || audio.ended)) release(run); // this player has taken over, or the run is over
    say(audio.parentElement, audio.hidden ? '' : audio.ended ? 'Finished.' : audio.paused ? 'Paused.' : waiting ? 'Loading the next layer.' : 'Emma is reading this part.');
  }, true); // media events do not bubble
// A file that fails to load or decode while it is meant to play: the part offers the device voice.
addEventListener('error', (e) => {
  const audio = e.target;
  if (!(audio instanceof HTMLAudioElement) || audio.hidden || audio.paused || !runs.has(audio) || !audio.parentElement) return; // a paused or left part is the learner's choice
  stopped(audio, audio.parentElement);
}, true);
