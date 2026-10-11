// The one count (D11): loads Vercel's script on any page, in a PUBLIC_ANALYTICS=1 build only, and only for an address with
// nothing after it. Settings.astro imports this before restore.ts, which strips a #p= from the address: the guard must see
// the address as it arrived (S3). The outer test is static, so a build without the count drops the script path (F11).
import { analyticsSrc } from './analytics.ts';

if (import.meta.env.PUBLIC_ANALYTICS === '1') {
  const src = analyticsSrc(import.meta.env.PUBLIC_ANALYTICS, location);
  if (src) document.head.append(Object.assign(document.createElement('script'), { defer: true, src }));
}
