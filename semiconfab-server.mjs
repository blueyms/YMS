import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('/workspace/SemiconFab');
const port = Number(process.env.PORT || 8000);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/jsonl; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm',
  '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, file, extra = {}) {
  const stat = fs.statSync(file);
  res.writeHead(status, {
    'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    ...extra,
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad Request');
      return;
    }

    const rel = pathname.replace(/^\/+/, '');
    const target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    // 1) exact file
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      send(res, 200, target);
      return;
    }

    // 2) clean URL: /twin -> twin.html (Cloudflare Pages behavior)
    const htmlFile = target + '.html';
    if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) {
      send(res, 200, htmlFile);
      return;
    }

    // 3) directory -> index.html
    const indexFile = path.join(target, 'index.html');
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
      send(res, 200, indexFile);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p>' + pathname + '</p>');
  })
  .listen(port, () => {
    console.log(`SemiconFab served at http://localhost:${port}/ (root: ${root})`);
  });
