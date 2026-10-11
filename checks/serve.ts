// A static server for the browser checkers: a built site on 127.0.0.1 only, and only files under its root.
import { globSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

// The URL path of every page: index.html is /, a/index.html is /a/.
export const pages = (dir: string) => globSync('**/*.html', { cwd: dir }).sort().map((f) => `/${f.replace(/(^|\/)index\.html$/, '$1')}`);

export async function serve(dir: string) {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    let file = '';
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
      file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    } catch {
      // a malformed URL gets the 404 below
    }
    // join() resolves any ../ first, so this also refuses an escape from the root.
    if (!file.startsWith(root + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) return res.writeHead(404).end();
    const type = TYPES[extname(file)] ?? 'application/octet-stream'; const zip = /^(text|image\/svg)/.test(type) || type.includes('javascript'); res.writeHead(200, { 'content-type': type, ...(zip ? { 'content-encoding': 'gzip' } : {}) }).end(zip ? gzipSync(readFileSync(file)) : readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((done) => server.close(() => done()));
    },
  };
}
