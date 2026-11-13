// 정적 파일 서빙: 경로 탈출 차단, Range 요청(오디오 탐색), 캐시 헤더 지원
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

/**
 * @param {{prefix: string, dir: string}[]} mounts URL 접두사 → 디렉터리. 긴 접두사부터 매칭.
 */
export function createStaticHandler(mounts) {
  const sorted = [...mounts]
    .map((m) => ({ prefix: m.prefix, dir: path.resolve(m.dir) }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      return send(res, 400, 'Bad Request');
    }
    if (pathname.includes('\0')) return send(res, 400, 'Bad Request');

    const mount = sorted.find((m) => pathname.startsWith(m.prefix));
    if (!mount) return send(res, 404, 'Not Found');

    let rel = pathname.slice(mount.prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const filePath = path.resolve(mount.dir, '.' + path.sep + rel);
    // 마운트 디렉터리 밖으로 나가는 요청(../)은 거부
    if (filePath !== mount.dir && !filePath.startsWith(mount.dir + path.sep)) {
      return send(res, 403, 'Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) return send(res, 404, 'Not Found');

      const ext = path.extname(filePath).toLowerCase();
      const isMedia = ext === '.mp3' || ext === '.ogg' || ext === '.wav' || ext === '.png' || ext === '.jpg';
      const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        ETag: etag,
        // 소리·이미지는 길게 캐시, 코드는 매번 검증 (세션 직전 수정이 바로 반영되도록)
        'Cache-Control': isMedia ? 'public, max-age=86400' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      };

      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        return res.end();
      }

      let start = 0;
      let end = stat.size - 1;
      let status = 200;
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m || (m[1] === '' && m[2] === '')) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
          return res.end();
        }
        if (m[1] === '') {
          start = Math.max(0, stat.size - Number(m[2]));
        } else {
          start = Number(m[1]);
          if (m[2] !== '') end = Math.min(end, Number(m[2]));
        }
        if (start > end || start >= stat.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
          return res.end();
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length'] = end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || stat.size === 0) return res.end();

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
  };
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
