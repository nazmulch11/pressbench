// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRemoteServer } from './serve';

const REMOTE_HTML = '<!doctype html><title>remote</title>';

let parent: string;
let base: string;
let server: ReturnType<typeof createRemoteServer>;

beforeAll(async () => {
  parent = mkdtempSync(join(tmpdir(), 'pressbench-remote-'));
  const root = join(parent, 'remote');
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'remote.html'), REMOTE_HTML);
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>index</title>');
  writeFileSync(join(root, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  writeFileSync(join(root, 'assets', 'php.wasm'), new Uint8Array([0, 97, 115, 109]));
  writeFileSync(join(parent, 'secret.txt'), 'outside the served folder');

  server = createRemoteServer(root);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${String(port)}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(parent, { recursive: true, force: true });
});

describe('createRemoteServer', () => {
  it('TC-PG-018a serves the remote page, the service worker and WebAssembly with their types', async () => {
    const page = await fetch(`${base}/remote.html`);
    const worker = await fetch(`${base}/sw.js`);
    const wasm = await fetch(`${base}/assets/php.wasm`);

    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await page.text()).toContain('<title>remote</title>');
    expect(worker.status).toBe(200);
    expect(worker.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(wasm.status).toBe(200);
    expect(wasm.headers.get('content-type')).toBe('application/wasm');
    expect(new Uint8Array(await wasm.arrayBuffer())).toEqual(new Uint8Array([0, 97, 115, 109]));
  });

  it('TC-PG-018b serves index.html for the root and 404 for a missing file', async () => {
    const root = await fetch(`${base}/`);
    const missing = await fetch(`${base}/assets/missing.js`);

    expect(root.status).toBe(200);
    expect(await root.text()).toContain('<title>index</title>');
    expect(missing.status).toBe(404);
  });

  it('TC-PG-018c refuses a path that leaves the served folder', async () => {
    const response = await fetch(`${base}/..%2fsecret.txt`);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('outside the served folder');
  });

  it('TC-PG-018d answers HEAD without a body, refuses other methods and malformed paths', async () => {
    const head = await fetch(`${base}/remote.html`, { method: 'HEAD' });
    const post = await fetch(`${base}/remote.html`, { method: 'POST' });
    const malformed = await fetch(`${base}/%E0%A4%A.js`);

    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe(String(REMOTE_HTML.length));
    expect(await head.text()).toBe('');
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
    expect(malformed.status).toBe(404);
  });
});
