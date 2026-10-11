// Back off after a streak of failed network calls, then retry once.
const RETRY_AFTER_MS = 200;
export const later = (fn: () => void) => setTimeout(fn, RETRY_AFTER_MS);
