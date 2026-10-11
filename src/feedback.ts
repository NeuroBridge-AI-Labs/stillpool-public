// The feedback page's state model (FB1). One state at a time, on [data-feedback] as data-state:
//
//   ready    The form. Send is off while the message is blank.        send -> sending
//   sending  Send reads "Sending" and ignores presses; the controls   ok -> sent | fail -> error
//            cannot change, so the text on the page is the text sent.
//   sent     "Thank you." The message box is cleared.                 send -> sending, edit -> ready
//   error    One calm line; the text stays as typed.                  send -> sending, edit -> ready
//
// A fetch is made only on `send`, from a button press. Nothing is stored on the device.
export type Name = 'ready' | 'sending' | 'sent' | 'error';
export type Event = 'send' | 'ok' | 'fail' | 'edit';
export type Kind = 'sent' | 'limit' | 'long' | 'closed' | 'error';

export const START: Name = 'ready';

export function next(state: Name, event: Event): Name {
  if (state === 'sending') return event === 'ok' ? 'sent' : event === 'fail' ? 'error' : state;
  if (event === 'send') return 'sending';
  return event === 'edit' ? 'ready' : state;
}

export const canSend = (state: Name) => state !== 'sending';

// One short sentence per kind: what happened, and what to do.
export const LINES: Record<Kind, string> = {
  sent: 'Thank you. Your message was saved.',
  limit: 'That is a lot of messages in a short time. Try again in about ten minutes.',
  long: 'That message is too long. Try a shorter one.',
  closed: 'Feedback is closed for now. You can write to contact@neurobridgeedu.eu.',
  error: 'That did not work. Your message is still here. You can press Send feedback again.',
};

// What a response means. 429 is read by status alone (the firewall's body is not ours).
export function outcome(status: number, body: unknown): Kind {
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (status === 429) return 'limit';
  if (status === 413) return 'long';
  if (status === 200 && fields.ok === true) return 'sent';
  return status === 503 && fields.error === 'closed' ? 'closed' : 'error';
}
