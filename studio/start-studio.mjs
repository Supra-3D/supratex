import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Run from any working directory: the studio is served beside this script.
const root = await realpath(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
let port = 8088;
let openBrowser = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === '--port') port = Number(args[++index]);
  else if (argument.startsWith('--port=')) port = Number(argument.slice(7));
  else if (argument === '--open') openBrowser = true;
  else if (argument === '--help' || argument === '-h') {
    console.log('Usage: node start-studio.mjs [--port 8088] [--open]');
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${argument}`);
    process.exit(1);
  }
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('The port must be an integer between 1 and 65535.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ktx2': 'image/ktx2',
  '.hdr': 'image/vnd.radiance',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
};

function isInsideRoot(candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot);
}

function respond(request, response, status, message, headers = {}) {
  const body = `${message}\n`;
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    respond(request, response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }
  try {
    let pathname;
    try {
      pathname = decodeURIComponent((request.url || '/').split(/[?#]/, 1)[0]);
    } catch {
      respond(request, response, 400, 'Malformed URL');
      return;
    }
    if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\') || pathname.includes(':')) {
      respond(request, response, 400, 'Invalid path');
      return;
    }
    if (pathname === '/') pathname = '/studio.html';
    const candidate = resolve(root, `.${pathname}`);
    if (!isInsideRoot(candidate)) {
      respond(request, response, 403, 'Forbidden');
      return;
    }
    // Resolve symlinks before serving, so they cannot escape the studio folder.
    const filePath = await realpath(candidate);
    if (!isInsideRoot(filePath)) {
      respond(request, response, 403, 'Forbidden');
      return;
    }
    const info = await stat(filePath);
    if (!info.isFile()) {
      respond(request, response, 404, 'File not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else {
      const stream = createReadStream(filePath);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    }
  } catch (error) {
    const missing = error.code === 'ENOENT' || error.code === 'ENOTDIR';
    const denied = error.code === 'EACCES' || error.code === 'EPERM';
    respond(request, response, missing ? 404 : denied ? 403 : 500,
      missing ? 'File not found' : denied ? 'Forbidden' : 'Unable to serve file');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Try: node start-studio.mjs --port ${port + 1}`
    : `Server error: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/studio.html`;
  console.log(`\nSupratex Studio: ${url}\nPress Ctrl+C to stop the server.\n`);
  if (openBrowser) {
    const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const parameters = process.platform === 'win32' ? ['/d', '/c', 'start', '""', url] : [url];
    const browser = spawn(command, parameters, { windowsHide: true, stdio: 'ignore' });
    browser.on('error', () => console.log(`Open this URL in your browser: ${url}`));
    browser.unref();
  }
});
