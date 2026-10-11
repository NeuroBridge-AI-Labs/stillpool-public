// The one count (plan T9.3, D11, Emanuel 10-10-26): Vercel's same-origin script, on every page, and only when the address
// holds nothing else, so a restore link's #p= never reaches a request (S3). The flag is PUBLIC_ANALYTICS=1 at build.
export const analyticsSrc = (flag: string | undefined, { search, hash }: Pick<Location, 'search' | 'hash'>) =>
  flag === '1' && !search && !hash ? '/_vercel/insights/script.js' : undefined;
