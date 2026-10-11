// Records answers (T5.10, inventory section E, p6 plan D4 and section 7); never part of the site, and its tests mock the
// network. It writes every run and no summary, which a person writes in the lesson's recorded.yaml after reading the
// runs (p6 D4); the build refuses the lesson until then. It never overwrites (git keeps the old).
//
// Usage, for Emanuel, from the repo root with Node 22, one set per command. `read -rs` takes a key without showing it or
// saving it in the history: paste the key, then press Enter.
//   R-1.1  read -rs KEY_S; SCW_SECRET_KEY=$KEY_S node scripts/record.ts R-1.1
//   R-1.5  read -rs KEY_A; ANTHROPIC_API_KEY=$KEY_A node scripts/record.ts R-1.5
//   R-1.6  read -rs KEY_A; read -rs KEY_B; ANTHROPIC_API_KEY=$KEY_A MISTRAL_API_KEY=$KEY_B node scripts/record.ts R-1.6
//   R-1.8  read -rs KEY_B; MISTRAL_API_KEY=$KEY_B node scripts/record.ts R-1.8
//   R-2.N  read -rs KEY_A; read -rs KEY_B; ANTHROPIC_API_KEY=$KEY_A MISTRAL_API_KEY=$KEY_B node scripts/record.ts R-2.N  (N is 1 to 7)
//   R-3.1  the same two keys, node scripts/record.ts R-3.1
//   R-4.1, R-4.3, R-4.6, R-4.8, R-5.5  the same two keys, node scripts/record.ts R-4.N (R-5.5 the same way)
//   R-5.1  no key; two llama-server addresses on 127.0.0.1, one per model:
//          R51_BASE_URL=http://127.0.0.1:8091 R51_TUNED_URL=http://127.0.0.1:8092 node scripts/record.ts R-5.1
// Then, in the same shell, before any commit (p6 plan section 7, step 3), for each key variable you set, say KEY_A:
//   rg -c -F -- "$KEY_A" data/recorded content                   prints nothing
//   rg -n -i 'sk-|bearer|api[_-]?key' data/recorded/R-1.N.json   prints nothing
//   unset KEY_S KEY_A KEY_B
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { RUNS, SETS_2, type Variant } from './record-2.ts';
import { SETS_3 } from './record-3.ts';
import { SETS_4 } from './record-4.ts';
import { SETS_5, SETS_55 } from './record-5.ts';

type Msg = { role: 'system' | 'user' | 'assistant'; content: unknown };
type Call = { at: string; request: object; response?: unknown; error?: { status: number; category: 'http_error' } };
type Keys = Record<string, string | undefined>;
type Block = { type: string; text?: string; name?: string; input?: { query?: string }; citations?: { url: string; title: string | null; cited_text: string }[] };

const SETS = { ...SETS_2, ...SETS_3, ...SETS_4, ...SETS_55 };

// Maker A (S8): Claude Sonnet 5 on Anthropic's Messages API, every setting stated (1.5 brief R6, 1.6 brief R7).
const A = { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', host: 'Anthropic Messages API' };
const A_SETTINGS = { max_tokens: 16000, output_config: { effort: 'high' }, thinking: { type: 'adaptive', display: 'summarized' } };
const claudeBody = (content: string, tools?: object) => ({ model: A.id, messages: [{ role: 'user', content }], ...A_SETTINGS, ...(tools && { tools }) });
// Maker B for R-1.6 and R-1.8 (1.6 brief R1, 1.8 brief R1): Emanuel's pick on 28-09-26 (.ops/p6-carry.md). His other
// choice is this one line, set to 'mistral-small-2603'; MISTRAL carries each candidate's settings.
export const MISTRAL_MODEL: keyof typeof MISTRAL = 'ministral-14b-2512';
const MISTRAL = { 'ministral-14b-2512': { name: 'Ministral 3 14B' }, 'mistral-small-2603': { name: 'Mistral Small 4', reasoning_effort: 'none' } };
export const mistralBody = (model: keyof typeof MISTRAL, messages: Msg[], max_tokens: number) => {
  const { name: _, ...extra } = MISTRAL[model];
  return { model, messages, max_tokens, ...extra };
};
const Q15 = 'Who won the most recent All-Ireland senior hurling final, and what was the score?';
const Q16 =
  'Name three studies published since 2020 on whether taking notes by hand or on a laptop affects how much students remember from a lecture. For each study, give the title, the authors, the year, the journal and the main finding. Use plain text, with each study on its own line.';
// R-1.8's chat is the 1.8 pack's section 1e, read where it is written and held to the brief's fingerprint (R3).
const CHAT_SHA = '0c31222b10919ebb55ebf2686446767f7c48087f6e6997a34c039427d9bb9c12';
const LIMIT = 2048;

// R-1.1 as the 1.1 brief fixes it (Interactive) and Maker B as .ops/recording-models-report.md settles it (26-09-26).
export const SPECS = {
  'R-1.1': {
    keys: ['SCW_SECRET_KEY'],
    message: "I missed the bus to my first lecture today and I'm annoyed with myself.",
    instructions: ['Give a warm reply.', 'Give a brief, practical reply.'],
    runs: 3,
    model: { id: 'mistral-small-3.2-24b-instruct-2506', name: 'Mistral Small 3.2', host: 'Scaleway Generative APIs, Paris' },
  },
  'R-1.5': { keys: ['ANTHROPIC_API_KEY'], runs: 3 },
  'R-1.6': { keys: ['ANTHROPIC_API_KEY', 'MISTRAL_API_KEY'], runs: 10 },
  'R-1.8': { keys: ['MISTRAL_API_KEY'], runs: 3 },
  'R-5.1': { keys: [], runs: SETS_5['R-5.1'].runs },
  // Pillars 2 to 4 (R briefs, 03-10-26): both makers for every set; each set's variants and run counts are in record-2.ts, record-3.ts and record-4.ts.
  ...Object.fromEntries(Object.keys(SETS).map((id) => [id, { keys: ['ANTHROPIC_API_KEY', 'MISTRAL_API_KEY'], runs: RUNS }])) as unknown as Record<keyof typeof SETS, { keys: readonly ['ANTHROPIC_API_KEY', 'MISTRAL_API_KEY']; runs: number }>,
} as const;
// ponytail: Scaleway's OpenAI-compatible endpoint for the default project, confirmed by R-1.1 (27-09-26); one call per
// run, because Scaleway does not support n. Temperature is not sent: the brief asks for the model's default.
const SCALEWAY = 'https://api.scaleway.ai/v1/chat/completions';
const SETTINGS = { temperature: "not set, so the model's default", 'chance of each piece (logprobs)': 'on', 'system prompt': 'the instruction' };
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const MISTRAL_API = 'https://api.mistral.ai/v1';

const cut = (id: string, field: string) => new Error(`${id}: a cut answer (${field}): record the whole set again with max_tokens doubled`);
const safeFetch = async (fetcher: typeof fetch, url: string, init: RequestInit) => {
  try { return await fetcher(url, init); } catch { throw new Error('model request failed: nothing was recorded'); }
};
const safeJson = async (res: Response) => {
  try { return await res.json(); } catch { throw new Error('model response was not valid JSON: nothing was recorded'); }
};
const sumUsage = (parts: Record<string, unknown>[]) => {
  const total: Record<string, unknown> = {};
  for (const part of parts) for (const [key, value] of Object.entries(part)) {
    if (typeof value === 'number') total[key] = (typeof total[key] === 'number' ? total[key] : 0) + value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) total[key] = sumUsage([total[key] as Record<string, unknown> ?? {}, value as Record<string, unknown>]);
  }
  return total;
};
// One call. An error is stored and the call made again (1.6 brief R8, 1.8 brief R6); ponytail: three tries, then stop.
async function send(fetcher: typeof fetch, url: string, headers: object, request: object, calls: Call[]) {
  for (let tries = 0; tries < 3; tries++) {
    const at = new Date().toISOString();
    const res = await safeFetch(fetcher, url, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(request) });
    if (res.ok) return (calls.push({ at, request, response: await safeJson(res) }), calls.at(-1)?.response as Record<string, any>);
    calls.push({ at, request, error: { status: res.status, category: 'http_error' } });
  }
  throw new Error(`the model answered with an HTTP error three times (status ${calls.at(-1)?.error?.status})`);
}

// A run on maker A: a pause_turn is continued with the paused assistant message, unchanged (1.5 pack R8); the reply is
// the text blocks joined in order with nothing between. ponytail: ten pauses at most, then stop.
async function claude(id: string, key: string, request: { messages: object[]; [field: string]: unknown }, fetcher: typeof fetch) {
  const calls: Call[] = [];
  for (let body: object = request, pauses = 0; ; pauses++) {
    const res = await send(fetcher, ANTHROPIC, { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body, calls);
    if (res.stop_reason === 'max_tokens') throw cut(id, 'stop_reason max_tokens');
    if (res.stop_reason !== 'pause_turn') break;
    if (pauses === 9) throw new Error(`${id}: paused ten times`);
    body = { ...request, messages: [...(body as typeof request).messages, { role: 'assistant', content: res.content }] };
  }
  const blocks = calls.flatMap((c) => ((c.response as { content?: Block[] })?.content ?? []));
  return {
    reply: blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''),
    searches: blocks.flatMap((b) => (b.type === 'server_tool_use' && b.name === 'web_search' ? [String(b.input?.query)] : [])),
    citations: blocks.flatMap((b) => b.citations ?? []).map(({ url, title, cited_text }) => ({ url, title, cited_text })),
    usage: sumUsage(calls.flatMap((c) => c.response ? [(c.response as { usage?: Record<string, unknown> }).usage ?? {}] : [])),
    calls,
  };
}

// A call on maker B, whose answer must be one plain string (1.6 brief T1).
async function mistral(id: string, key: string, request: object, fetcher: typeof fetch) {
  const calls: Call[] = [];
  const choice = (await send(fetcher, `${MISTRAL_API}/chat/completions`, { authorization: `Bearer ${key}` }, request, calls)).choices?.[0];
  if (choice?.finish_reason === 'length' && (request as { max_tokens: number }).max_tokens > 1) throw cut(id, 'finish_reason length');
  if (typeof choice?.message?.content !== 'string') throw new Error(`${id}: Mistral's answer is not one plain string`);
  return { reply: choice.message.content as string, calls };
}

// Maker B's entry in /v1/models, as read, with its default temperature (the briefs' Maker B settings rows).
async function mistralModel(key: string, fetcher: typeof fetch, max_tokens = 4096) {
  const res = await safeFetch(fetcher, `${MISTRAL_API}/models`, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Mistral's /v1/models answered ${res.status}: nothing was recorded`);
  const card = ((await safeJson(res)).data ?? []).find((m: { id: string }) => m.id === MISTRAL_MODEL);
  if (!card) throw new Error(`${MISTRAL_MODEL} is not in Mistral's /v1/models: nothing was recorded`);
  const model = { id: MISTRAL_MODEL, name: MISTRAL[MISTRAL_MODEL].name, host: 'Mistral AI API', card };
  const { messages: _, ...settings } = mistralBody(MISTRAL_MODEL, [], max_tokens);
  return { model, settings: { ...settings, default_model_temperature: card.default_model_temperature } };
}

// R-1.8's cut, CR2 (p6 plan section 7): probe 0 sends the question alone and each probe adds the next-newest exchange,
// with max_tokens 1; the first over the limit ends it and the previous probe's list is kept. Exchange 1 holds the name
// and is never sent: if exchanges 2 to 17 still fit, it throws. At most 100 probes.
async function trim(key: string, fetcher: typeof fetch) {
  const pack = readFileSync('docs/packs/how-ai-works/attention-and-the-context-window.md', 'utf8');
  const chat = (load(/### 1e\.[\s\S]*?```yaml\n([\s\S]*?)```/.exec(pack)?.[1] ?? '') as Msg[]).map(({ role, content }) => ({ role, content }));
  if (createHash('sha256').update(JSON.stringify(chat)).digest('hex') !== CHAT_SHA) throw new Error("R-1.8: the pack's chat is not the brief's (sha256)");
  const question = chat.at(-1) as Msg;
  const exchanges = Array.from({ length: (chat.length - 1) / 2 }, (_, i) => chat.slice(2 * i, 2 * i + 2));
  const probes = [];
  let kept: Msg[] | undefined;
  for (let k = 0; k < Math.min(exchanges.length, 100); k++) {
    const messages = [...exchanges.slice(exchanges.length - k).flat(), question];
    const { calls } = await mistral('R-1.8', key, mistralBody(MISTRAL_MODEL, messages, 1), fetcher);
    const { id, model, choices, usage } = calls.at(-1)?.response as Record<string, any>;
    probes.push({ exchanges: k, at: calls.at(-1)?.at, id, model, finish_reason: choices?.[0]?.finish_reason, usage });
    if (usage.prompt_tokens > LIMIT) {
      if (!kept) throw new Error(`R-1.8: the question alone is ${usage.prompt_tokens} tokens, over ${LIMIT}: no real call was made`);
      return { limit: LIMIT, kept_from: exchanges.length - k + 2, kept, dropped: exchanges.slice(0, exchanges.length - k + 1), probes };
    }
    kept = messages;
  }
  throw new Error(`R-1.8: exchanges 2 to 17 and the question fit in ${LIMIT} tokens; exchange 1, with the name, would be next and is never sent`);
}

async function scaleway(id: 'R-1.1', key: string, date: string, fetcher: typeof fetch) {
  const spec = SPECS[id];
  const variants = [];
  for (const instruction of spec.instructions) {
    const runs = [];
    for (let n = 0; n < spec.runs; n++) {
      const res = await safeFetch(fetcher, SCALEWAY, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: spec.model.id,
          messages: [{ role: 'system', content: instruction }, { role: 'user', content: spec.message }],
          logprobs: true,
        }),
      });
      if (!res.ok) throw new Error(`${id}: the model answered ${res.status}: nothing was recorded`);
      const choice = (await safeJson(res)).choices?.[0];
      const pieces = choice?.logprobs?.content?.map(({ token, logprob }: { token: string; logprob: number }) => ({ text: token, logprob }));
      if (typeof choice?.message?.content !== 'string') throw new Error(`${id}: no reply in the response`);
      if (!pieces?.length) throw new Error(`${id}: no logprobs in the response, which 1.4 needs`);
      runs.push({ reply: choice.message.content, pieces });
    }
    variants.push({ instruction, runs });
  }
  return { id, message: spec.message, model: spec.model, date, settings: SETTINGS, variants };
}

// Pillar 2 (R brief): maker A is Claude Sonnet 5.5 with nothing but max_tokens set; maker B is MISTRAL_MODEL the same way.
const A2 = { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', host: 'Anthropic Messages API' };
const NO_TEMPERATURE = "not set, so the model's default";
const A2_SETTINGS = { max_tokens: 4000, temperature: NO_TEMPERATURE, tools: 'no tools', 'system prompt': 'in each variant that has one' };
const usageOf = (calls: Call[]) => sumUsage(calls.flatMap((c) => (c.response ? [(c.response as { usage?: Record<string, unknown> }).usage ?? {}] : [])));

// One run of a variant: each user turn is sent with the earlier turns and this run's own earlier replies.
async function chat(id: string, maker: 'A' | 'B', key: string, { system, turns }: Variant, fetcher: typeof fetch) {
  const calls: Call[] = [];
  const replies: string[] = [];
  let history: Msg[] = [];
  for (const content of turns) {
    history = [...history, { role: 'user', content }];
    const done = maker === 'A'
      ? await claude(id, key, { model: A2.id, max_tokens: 4000, ...(system && { system }), messages: history }, fetcher)
      : await mistral(id, key, mistralBody(MISTRAL_MODEL, [...(system ? [{ role: 'system' as const, content: system }] : []), ...history], 4000), fetcher);
    calls.push(...done.calls);
    replies.push(done.reply);
    history = [...history, { role: 'assistant', content: done.reply }];
  }
  return { reply: replies.at(-1) as string, ...(replies.length > 1 && { replies }), usage: usageOf(calls), calls };
}

// An R-2 set: every variant on maker A, then on maker B; a throw on any call writes nothing.
async function setOf(id: keyof typeof SETS, keys: Keys, date: string, fetcher: typeof fetch) {
  const [a, b] = [keys.ANTHROPIC_API_KEY ?? '', keys.MISTRAL_API_KEY ?? ''];
  const { model, settings } = await mistralModel(b, fetcher, 4000);
  const variants = [];
  for (const variant of SETS[id])
    for (const maker of ['A', 'B'] as const) {
      const runs = [];
      for (let n = 0; n < variant.runs; n++) runs.push(await chat(id, maker, maker === 'A' ? a : b, variant, fetcher));
      variants.push({
        label: variant.label, maker, ...(variant.system && { system: variant.system }),
        messages: variant.turns.map((content) => ({ role: 'user', content })),
        ...(maker === 'B' && { model, settings: { ...settings, temperature: NO_TEMPERATURE, tools: 'no tools', 'system prompt': 'in each variant that has one' } }),
        runs,
      });
    }
  return { id, model: A2, date, settings: A2_SETTINGS, variants };
}

// R-5.1 (version A): two local llama-server addresses, 127.0.0.1 only and checked before any call. The base model gets the
// raw text on /v1/completions, the tuned one the chat template on /v1/chat/completions. A cut answer is kept, never thrown:
// a base model has no reason to stop. Each server's /props gives the file, the llama.cpp build and the chat template.
const LOCAL_HOST = 'this Mac, llama.cpp llama-server';
const loopback = (name: string, value?: string) => {
  const url = URL.canParse(value ?? '') ? new URL(value as string) : undefined;
  if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) throw new Error(`${name} must be an http://127.0.0.1:<port> address: nothing was called`);
  return url.origin;
};
async function local(id: 'R-5.1', keys: Keys, date: string, fetcher: typeof fetch) {
  const { message, runs, ...sampling } = SETS_5[id];
  const [base, tuned] = [loopback('R51_BASE_URL', keys.R51_BASE_URL), loopback('R51_TUNED_URL', keys.R51_TUNED_URL)];
  const info = async (origin: string) => {
    const res = await safeFetch(fetcher, `${origin}/props`, { method: 'GET' });
    const { model_path, build_info, chat_template } = res.ok ? await safeJson(res) : ({} as Record<string, string>);
    if (!model_path || !build_info) throw new Error(`${id}: ${origin}/props did not name the file and the build: nothing was recorded`);
    return { file: String(model_path).split('/').at(-1), build: build_info, chat_template };
  };
  const variants = [];
  for (const [origin, chatty] of [[base, false], [tuned, true]] as const) {
    const { file, build, chat_template } = await info(origin);
    const model = chatty
      ? { id: 'allenai/OLMo-2-0425-1B-Instruct', name: 'OLMo 2 1B, tuned (Instruct)', host: LOCAL_HOST }
      : { id: 'allenai/OLMo-2-0425-1B', name: 'OLMo 2 1B, base', host: LOCAL_HOST };
    const settings = {
      endpoint: chatty ? '/v1/chat/completions' : '/v1/completions', file, 'llama.cpp build': build, temperature: sampling.temperature,
      max_tokens: chatty ? sampling.max_tokens : `${sampling.max_tokens}; the base model was stopped here`,
      'chat template': chatty ? `the model's own, applied by the server: ${chat_template ?? 'not reported'}` : 'none: the text was sent raw',
    };
    const request = { ...(chatty ? { messages: [{ role: 'user', content: message }] } : { prompt: message }), max_tokens: sampling.max_tokens, temperature: sampling.temperature };
    variants.push({ model, settings, runs: await times(runs, async () => {
      const calls: Call[] = [];
      const choice = (await send(fetcher, `${origin}/v1/${chatty ? 'chat/' : ''}completions`, {}, request, calls)).choices?.[0];
      const reply = chatty ? choice?.message?.content : choice?.text;
      // An empty reply the model ended with `stop` is its own output and is kept; no choice or no string still throws.
      if (typeof reply !== 'string' || (!reply && choice.finish_reason !== 'stop')) throw new Error(`${id}: a missing reply: nothing was recorded`);
      return { reply, ...(typeof choice.finish_reason === 'string' && { finish_reason: choice.finish_reason }), usage: usageOf(calls), calls };
    }) });
  }
  return { id, message, model: variants[0].model, date, settings: sampling, variants };
}

const times = async <T>(n: number, run: () => Promise<T>) => {
  const runs = [];
  for (let i = 0; i < n; i++) runs.push(await run());
  return runs;
};

export async function record(id: keyof typeof SPECS, keys: Keys, { date, dir = 'data/recorded', fetcher = fetch }: { date: string; dir?: string; fetcher?: typeof fetch }) {
  // Before any call, for every maker the set needs (p6 D4): its key is set, the folder exists, the file does not.
  for (const k of SPECS[id].keys) if (!keys[k]) throw new Error(`${k} is not set: nothing was called`);
  if (!existsSync(dir)) throw new Error(`${dir} does not exist: nothing was called. Run this from the repo root.`);
  if (existsSync(`${dir}/${id}.json`)) throw new Error(`${dir}/${id}.json exists: nothing was called. Remove it first; git keeps the old one.`);
  const [a, b] = [keys.ANTHROPIC_API_KEY ?? '', keys.MISTRAL_API_KEY ?? ''];
  const runs = SPECS[id].runs;
  if (id === 'R-5.1') return local(id, keys, date, fetcher);
  if (id in SETS) return setOf(id as keyof typeof SETS, keys, date, fetcher);
  if (id === 'R-1.1') return scaleway(id, keys.SCW_SECRET_KEY ?? '', date, fetcher);
  if (id === 'R-1.5') {
    const variants = [];
    // The variants' order is the order they show in (1.5 brief R7), fixed here, before recording.
    for (const search of ['off', 'on'] as const) {
      const tools = search === 'on' ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] : undefined;
      variants.push({ settings: { search, ...(tools && { tools }) }, runs: await times(runs, () => claude(id, a, claudeBody(Q15, tools), fetcher)) });
    }
    return { id, message: Q15, model: A, date, settings: A_SETTINGS, variants };
  }
  if (id === 'R-1.6') {
    const first = { runs: await times(runs, () => claude(id, a, claudeBody(Q16), fetcher)) };
    const { model, settings } = await mistralModel(b, fetcher);
    const user: Msg[] = [{ role: 'user', content: Q16 }];
    const second = { model, settings, runs: await times(runs, () => mistral(id, b, mistralBody(MISTRAL_MODEL, user, 4096), fetcher)) };
    return { id, message: Q16, model: A, date, settings: A_SETTINGS, variants: [first, second] };
  }
  const { model, settings } = await mistralModel(b, fetcher);
  const cutChat = await trim(b, fetcher);
  const variants = [{ runs: await times(runs, async () => {
    const run = await mistral(id, b, mistralBody(MISTRAL_MODEL, cutChat.kept, 4096), fetcher);
    const count = (run.calls.at(-1)?.response as { usage?: { prompt_tokens?: number } })?.usage?.prompt_tokens;
    if (typeof count !== 'number' || !Number.isInteger(count) || count > LIMIT) throw new Error('R-1.8: real prompt count is missing or over 2,048: no set was recorded');
    return run;
  }) }];
  return { id, message: String(cutChat.kept.at(-1)?.content), model, date, settings, trim: cutChat, variants };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2] as keyof typeof SPECS;
  if (!(id in SPECS)) throw new Error(`Usage: node scripts/record.ts <${Object.keys(SPECS).join('|')}>`);
  const out = await record(id, process.env, { date: new Date().toISOString().slice(0, 10) });
  writeFileSync(`data/recorded/${id}.json`, `${JSON.stringify(out, null, 2)}\n`, { flag: 'wx' });
  console.log(`data/recorded/${id}.json: now read every run, then write its summary in the lesson's recorded.yaml.`);
}
