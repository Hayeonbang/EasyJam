// EasyJam 서버: 정적 파일 + 합주 방 WebSocket
//
//   npm start                      → http://0.0.0.0:8000
//   PORT=9000 npm start            → 포트 변경
//   npm run cert && npm start      → certificate/ 에 인증서가 있으면 자동으로 HTTPS
//
// 다른 기기에서 카메라(타악기)를 쓰려면 브라우저 정책상 HTTPS가 필요하다.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createStaticHandler } from './static.js';
import { RoomManager } from './rooms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const KEY = process.env.SSL_KEY || path.join(ROOT, 'certificate', 'key.pem');
const CERT = process.env.SSL_CERT || path.join(ROOT, 'certificate', 'cert.pem');
const useHttps = fs.existsSync(KEY) && fs.existsSync(CERT);

const serveStatic = createStaticHandler([
  { prefix: '/assets/', dir: path.join(ROOT, 'assets') },
  { prefix: '/', dir: path.join(ROOT, 'public') },
]);

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

function onRequest(req, res) {
  if (req.url === '/api/info') {
    // 진행자 화면에서 "이 주소로 접속하세요"를 보여 주는 데 쓴다
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ addresses: lanAddresses(), port: PORT, https: useHttps }));
  }
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  serveStatic(req, res);
}

const server = useHttps
  ? https.createServer({ key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) }, onRequest)
  : http.createServer(onRequest);

const rooms = new RoomManager();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

wss.on('connection', (ws) => {
  const conn = {
    room: null,
    pid: null,
    send(obj) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
    },
    close() {
      ws.close();
    },
  };
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return; // 깨진 메시지는 조용히 버린다
    }
    try {
      rooms.handleMessage(conn, msg);
    } catch (err) {
      console.error('메시지 처리 오류:', err);
    }
  });
  ws.on('close', () => rooms.handleClose(conn));
  ws.on('error', () => ws.terminate());
});

// 응답 없는 연결(절전에 들어간 태블릿 등)을 정리한다
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 10_000);

const ticker = setInterval(() => rooms.tick(), 1000);

server.listen(PORT, HOST, () => {
  const scheme = useHttps ? 'https' : 'http';
  console.log(`EasyJam 서버 실행 중: ${scheme}://localhost:${PORT}`);
  for (const a of lanAddresses()) console.log(`  같은 Wi-Fi의 다른 기기: ${scheme}://${a}:${PORT}`);
  if (!useHttps) console.log('  (다른 기기에서 카메라를 쓰려면 `npm run cert` 후 다시 실행하세요)');
});

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(ticker);
  for (const ws of wss.clients) ws.close(1001);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
