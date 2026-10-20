// Shared by the Playwright scripts: a tiny static server for the site, and browser launching.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

export const root = fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

/** Serves the repo root. `override(path, body)` swaps what a path returns, to test updates. */
export async function startServer() {
  // E2E_BASE=https://... points a script at an already-deployed site instead of the local files.
  if (process.env.E2E_BASE) return { base: process.env.E2E_BASE.replace(/\/$/, ''), override() {}, clearOverrides() {}, close() {} };
  const overrides = new Map();
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const type = types[extname(path === '/' ? '/index.html' : path)] ?? 'application/octet-stream';
    if (overrides.has(path)) return void res.writeHead(200, { 'content-type': type }).end(overrides.get(path));
    try {
      const file = await readFile(join(root, path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }).end(file);
    } catch { res.writeHead(404).end('not found'); }
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  return {
    base: `http://localhost:${server.address().port}`,
    override: (path, body) => overrides.set(path, body),
    clearOverrides: () => overrides.clear(),
    close: () => server.close(),
  };
}

export function engineFromArgs() {
  return process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
}

export async function launch(engine) {
  if (engine === 'webkit') return webkit.launch();
  return chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
}

export function reporter() {
  const results = [];
  return {
    check(name, ok, extra = '') {
      results.push(ok);
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !extra ? '' : '  ' + extra}`);
    },
    done(label) {
      console.log(`\n${label}: ${results.filter(Boolean).length}/${results.length} passed`);
      return results.every(Boolean);
    },
  };
}
