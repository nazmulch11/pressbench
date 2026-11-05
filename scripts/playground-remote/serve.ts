import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.zip': 'application/zip',
};

/** The file under `root` for a request path, or `undefined` when the path is malformed or leaves `root`. */
function fileFor(root: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const path = resolve(root, `.${decoded}`);
  if (path !== root && !path.startsWith(root + sep)) {
    return undefined;
  }
  return path;
}

async function regularFile(path: string): Promise<{ path: string; size: number } | undefined> {
  const info = await stat(path).catch(() => undefined);
  if (info?.isDirectory() === true) {
    return regularFile(join(path, 'index.html'));
  }
  return info?.isFile() === true ? { path, size: info.size } : undefined;
}

/**
 * A static file server for a Playground remote build, used by E2E (docs/TESTING.md). It does what upstream's
 * `.htaccess` does (WebAssembly content type) and nothing else: no fallback page, so a missing file is a clear 404.
 */
export function createRemoteServer(root: string): Server {
  const base = resolve(root);
  return createServer((request, response) => {
    const method = request.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }
    const { pathname } = new URL(request.url ?? '/', 'http://remote');
    const path = fileFor(base, pathname);
    const found = path === undefined ? Promise.resolve(undefined) : regularFile(path);
    found.then(
      (file) => {
        if (file === undefined) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
          return;
        }
        response.writeHead(200, {
          'content-type': CONTENT_TYPES[extname(file.path)] ?? 'application/octet-stream',
          'content-length': file.size,
          'cache-control': 'no-cache',
        });
        if (method === 'HEAD') {
          response.end();
          return;
        }
        // pipeline closes the file when the browser aborts and survives a read error (the server must not die).
        pipeline(createReadStream(file.path), response, (error) => {
          if (error !== null) {
            response.destroy();
          }
        });
      },
      () => response.destroy(),
    );
  });
}
