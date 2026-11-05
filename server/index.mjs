/**
 * YMS 表单接收服务（本地数据库版，零第三方依赖）
 *
 * 启动：npm run api
 * 端口：8787，可用 PORT 覆盖
 * 数据库：server/data/yms.db（Node 内置 node:sqlite）
 *
 * 接口：
 *   GET  /api/health        健康检查
 *   POST /api/submissions   表单提交，body: { clientId, kind, payload }
 *   GET  /api/submissions   最近提交记录，支持 ?limit=20
 *
 * 可选鉴权：设置环境变量 YMS_API_TOKEN 后，业务接口需携带 Authorization: Bearer <token>
 * 内网穿透：本地启动后执行 cloudflared tunnel --url http://localhost:8787（或 ngrok http 8787），
 *           把拿到的 https 公网地址填入站点「同步地址」即可从 GitHub Pages 提交。
 */

import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 8787);
const API_TOKEN = process.env.YMS_API_TOKEN || '';
const ALLOW_ORIGINS = (process.env.YMS_ALLOW_ORIGINS ||
  'https://blueyms.github.io,http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(currentDir, 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'yms.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const corsHeaders = (req) => {
  const origin = req.headers.origin || '';
  const allowed = ALLOW_ORIGINS.includes(origin) ? origin : '';
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  };
};

const sendJson = (res, status, data, extra = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(data));
};

const readBody = (req, limit = 1024 * 1024) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', chunk => {
    size += chunk.length;
    if (size > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try {
      resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
    } catch {
      reject(new Error('请求体不是合法 JSON'));
    }
  });
  req.on('error', reject);
});

const authorized = (req) => {
  if (!API_TOKEN) return true;
  const header = req.headers.authorization || '';
  return header === `Bearer ${API_TOKEN}`;
};

const parseSubmission = (body) => {
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
  const payload = body.payload;
  if (!clientId || clientId.length > 64) throw new Error('clientId 缺失或过长');
  if (!kind || kind.length > 40) throw new Error('kind 缺失或过长');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload 必须是对象');
  const text = JSON.stringify(payload);
  if (text.length > 64 * 1024) throw new Error('payload 超过 64KB');
  return { clientId, kind, payload, text };
};

const server = createServer(async (req, res) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'yms-form-api', time: new Date().toISOString() }, headers);
    return;
  }

  if (!authorized(req)) {
    sendJson(res, 401, { ok: false, error: '未授权的访问令牌' }, headers);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    try {
      const body = await readBody(req);
      const item = parseSubmission(body);
      const existing = db.prepare('SELECT id, created_at FROM submissions WHERE client_id = ?').get(item.clientId);
      if (existing) {
        sendJson(res, 200, { ok: true, id: existing.id, duplicate: true }, headers);
        return;
      }
      const createdAt = new Date().toISOString();
      const info = db.prepare(
        'INSERT INTO submissions (client_id, kind, payload, created_at) VALUES (?, ?, ?, ?)'
      ).run(item.clientId, item.kind, item.text, createdAt);
      sendJson(res, 201, { ok: true, id: Number(info.lastInsertRowid), createdAt, duplicate: false }, headers);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message }, headers);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/submissions') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20)));
    const rows = db.prepare(
      'SELECT id, client_id, kind, payload, created_at FROM submissions ORDER BY id DESC LIMIT ?'
    ).all(limit).map(row => ({
      id: row.id,
      clientId: row.client_id,
      kind: row.kind,
      payload: JSON.parse(row.payload),
      createdAt: row.created_at
    }));
    sendJson(res, 200, { ok: true, total: rows.length, items: rows }, headers);
    return;
  }

  sendJson(res, 404, { ok: false, error: '接口不存在' }, headers);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[yms-form-api] listening on http://0.0.0.0:${PORT}`);
  console.log(`[yms-form-api] sqlite: ${join(dataDir, 'yms.db')}`);
  console.log(`[yms-form-api] allowed origins: ${ALLOW_ORIGINS.join(', ')}`);
});
