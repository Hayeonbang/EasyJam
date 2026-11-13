import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticHandler } from '../server/static.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handler = createStaticHandler([
  { prefix: '/assets/', dir: path.join(ROOT, 'assets') },
  { prefix: '/', dir: path.join(ROOT, 'public') },
]);

async function withServer(fn) {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const get = (p, headers = {}) =>
    new Promise((resolve, reject) => {
      // fetch는 ../ 를 미리 정리해 버리므로 원시 요청을 보낸다
      const req = http.request({ host: '127.0.0.1', port, path: p, headers }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.end();
    });
  try {
    await fn(get);
  } finally {
    server.close();
  }
}

test('첫 화면과 자바스크립트를 올바른 형식으로 준다', () =>
  withServer(async (get) => {
    const index = await get('/');
    assert.equal(index.status, 200);
    assert.match(index.headers['content-type'], /text\/html/);
    const js = await get('/js/core/song.js');
    assert.match(js.headers['content-type'], /javascript/);
    assert.equal((await get('/nope.html')).status, 404);
  }));

test('폴더 밖 파일은 내주지 않는다', () =>
  withServer(async (get) => {
    for (const p of ['/../package.json', '/assets/../package.json', '/assets/../../../../etc/passwd', '/%2e%2e/package.json', '/assets/%2e%2e/server/server.js', '/..%2fpackage.json']) {
      const res = await get(p);
      assert.ok(res.status === 403 || res.status === 404, `${p} → ${res.status}`);
      assert.ok(!res.body.toString().includes('"easyjam"'));
    }
  }));

test('오디오는 범위 요청으로 일부만 받을 수 있다 (탐색에 필요)', () =>
  withServer(async (get) => {
    const part = await get('/assets/sounds/backing/sunny.mp3', { Range: 'bytes=100-199' });
    assert.equal(part.status, 206);
    assert.equal(part.body.length, 100);
    assert.match(part.headers['content-range'], /^bytes 100-199\/\d+$/);
    assert.equal((await get('/assets/sounds/backing/sunny.mp3', { Range: 'bytes=999999999-' })).status, 416);
  }));

test('바뀌지 않은 파일은 304로 답한다', () =>
  withServer(async (get) => {
    const first = await get('/css/app.css');
    const again = await get('/css/app.css', { 'If-None-Match': first.headers.etag });
    assert.equal(again.status, 304);
  }));
