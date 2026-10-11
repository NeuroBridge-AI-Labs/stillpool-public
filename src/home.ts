// The one effect the learner starts on the home band: a point within 120 px of the pointer brightens, with the tip of
// its arc. It is a response to input, never an idle loop, and Reduce motion (the device's or the site's) stops it.
export {};
const root = document.documentElement;
const device = matchMedia('(prefers-reduced-motion: reduce)');
const still = () => device.matches || root.dataset.motion === 'reduce';

const nodes = [...document.querySelectorAll<SVGGElement>('.deco .node')].map((el) => ({ el, core: el.querySelector('.core') as Element, lit: false }));
const tips = [...document.querySelectorAll<SVGPathElement>('.deco .tip')];
const light = (x: number | null, y = 0) => {
  for (const n of nodes) {
    const box = n.core.getBoundingClientRect();
    n.lit = x !== null && Math.hypot(box.left + box.width / 2 - x, box.top + box.height / 2 - y) < 120;
    n.el.classList.toggle('lit', n.lit);
  }
  for (const tip of tips) tip.classList.toggle('lit', nodes[Number(tip.dataset.node)].lit);
};
const band = document.querySelector('.band');
band?.addEventListener('pointermove', (e) => {
  const { clientX, clientY } = e as PointerEvent;
  if (still()) light(null);
  else light(clientX, clientY);
});
band?.addEventListener('pointerleave', () => light(null));
// Reduced motion from either source settles the band at once: no lit point, no transition still under way.
const settle = () => {
  light(null);
  if (still()) for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish();
};
device.addEventListener('change', settle);
addEventListener('change', (e) => (e.target as HTMLInputElement).name === 'motion' && settle());

// The tour video, when there is one (TOUR_SRC in src/pages/index.astro). Play is always the reader's explicit choice.
// Auto-pause fires when motion is reduced, Focus starts, the page hides, or the player leaves the screen.
const video = document.querySelector<HTMLVideoElement>('.tour-video');
if (video) {
  const autoPause = () => { if (!video.paused) video.pause(); };
  video.addEventListener('error', () => {
    video.controls = false;
    document.querySelector<HTMLElement>('.tour-error')!.hidden = false;
  });
  new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) autoPause(); }).observe(video);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  device.addEventListener('change', () => { if (device.matches) autoPause(); });
  addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (['motion', 'focus'].includes(input.name) && input.checked) queueMicrotask(autoPause);
  });

  // Enlarge moves this same video into a dialog over the page, and back on close: one player, one download, one position.
  const dialog = document.querySelector<HTMLDialogElement>('.tour-dialog')!;
  const enlarge = document.querySelector<HTMLButtonElement>('.tour-enlarge')!;
  const home = video.parentElement!;
  const move = (to: Element) => {
    const playing = !video.paused;
    to.append(video);
    if (playing) video.play().catch(() => {});
  };
  enlarge.addEventListener('click', () => { move(dialog); dialog.showModal(); });
  dialog.addEventListener('close', () => { move(home); enlarge.focus(); });
}
