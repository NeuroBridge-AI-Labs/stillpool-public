// What every server function shares (lab-spec B, feedback FB1): the header refusals, the bounded body reader, the JSON reply
// and the status log line. The leading underscore keeps Vercel from serving this file as a route.
export type Refusal = { status: number; error: string };
export type Done = (status: number, body: unknown, headers?: Record<string, string>) => Response;

export const MAX_BODY = 4096;
export const refuse = (status: number, error: string): Refusal => ({ status, error });
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Steps 2 to 5 of lab-spec B, before the body is read. The media type is exactly application/json, parameters allowed.
export function headerRefusal(method: string, headers: Headers): Refusal | null {
  if (method !== 'POST') return refuse(405, 'method');
  const origin = headers.get('origin');
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (headers.get('sec-fetch-site') !== 'same-origin' || (origin !== null && origin !== `https://${host}`)) return refuse(403, 'forbidden');
  if (!/^application\/json\s*(;|$)/i.test(headers.get('content-type') ?? '')) return refuse(415, 'type');
  if (Number(headers.get('content-length')) > MAX_BODY) return refuse(413, 'too_large');
  return null;
}

// Reads at most `max` bytes: undefined when the body is larger (the stream is cancelled), a thrown error when the read fails.
export async function readText(body: ReadableStream<Uint8Array> | null, max: number): Promise<string | undefined> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return new Blob(chunks as BlobPart[]).text();
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

// The reply, and the one log line: the function's tag, the status, the caller's own fields, the milliseconds. Never a body,
// header or IP. `extra` must hold nothing a learner typed.
export function finish(tag: string, started: number, status: number, body: unknown, extra: Record<string, unknown> = {}, headers?: Record<string, string>) {
  console.log(JSON.stringify({ [tag]: 1, status, ...extra, ms: Date.now() - started }));
  return json(status, body, headers);
}

// Header checks, then a bounded read of the body: the text, or the refusing Response. A failed read is a refusal, not a crash.
export async function guardedRead(request: Request, done: Done): Promise<string | Response> {
  const refusal = (r: Refusal) => done(r.status, { error: r.error }, r.status === 405 ? { allow: 'POST' } : undefined);
  const early = headerRefusal(request.method, request.headers);
  if (early) return refusal(early);
  let raw: string | undefined;
  try {
    raw = await readText(request.body, MAX_BODY);
  } catch {
    return refusal(refuse(400, 'bad_request'));
  }
  return raw === undefined ? refusal(refuse(413, 'too_large')) : raw;
}
