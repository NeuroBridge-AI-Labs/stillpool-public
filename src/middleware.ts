// Runs markExternal (src/lib/external.ts) over the HTML of every page, in dev and at build.
import { defineMiddleware } from 'astro:middleware';
import { markExternal } from './lib/external.ts';

export const onRequest = defineMiddleware(async (_, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  return new Response(markExternal(await response.text(), import.meta.env.SITE), response);
});
