// The lesson rail's two small jobs. The links are plain anchors, so the browser does the scrolling, the hash and Back; this
// only marks the section you went to, and gives the activity's link the activity's own name, which the page cannot know
// when it builds the rail.
export {}; // a module, so these names stay out of the page's global scope
const links = [...document.querySelectorAll<HTMLAnchorElement>('.rail .here a')];
const mark = () => {
  for (const a of links) {
    if (a.hash === location.hash && location.hash) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  }
};
addEventListener('hashchange', mark);
mark();
const tryIt = document.querySelector('#part-try-it');
const named = document.querySelector('.rail a[href="#part-try-it"]');
if (tryIt?.textContent && named) named.textContent = tryIt.textContent.trim();
