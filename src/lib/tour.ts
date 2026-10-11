// When the home page's tour video may start by itself (fix round 5, F6; WCAG 2.2.2). Only with no reduced motion from the
// device or the site, no Focus mode, the player on screen, the page in view and the reader not having paused it. Manual Play is
// never decided here: a reader can always press it.
export type TourState = { reduced: boolean; focus: boolean; inView: boolean; docVisible: boolean; userPaused: boolean };

export const mayStart = ({ reduced, focus, inView, docVisible, userPaused }: TourState) => !reduced && !focus && inView && docVisible && !userPaused;
