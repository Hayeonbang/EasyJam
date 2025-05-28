const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// HTTP 서버 생성
const server = http.createServer((req, res) => {
    let filePath = '';

    // 요청된 URL에 따라 파일 경로 설정
    if (req.url.startsWith('/assets/')) {
        filePath = path.join(__dirname, '../assets', req.url.substring(8));  // assets 폴더 경로 처리
    } else if (req.url.startsWith('/js/')) {
        filePath = path.join(__dirname, '../public', 'js', req.url.substring(4));  // js 폴더 경로 처리
    } else if (req.url.startsWith('/css/')) {
        filePath = path.join(__dirname, '../public', 'css', req.url.substring(5));  // css 폴더 경로 처리
    } else {
        filePath = path.join(__dirname, '../public', req.url === '/' ? 'index.html' : req.url.substring(1));  // 기본 경로
    }

    console.log('Requested file path:', filePath); // 디버깅을 위해 파일 경로 로그 출력

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.mp3': 'audio/mpeg'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // 파일을 읽고 응답
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// WebSocket 서버 생성
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        console.log('received:', message);
    });

    ws.send('Connected to WebSocket server');
});

server.listen(8000, '0.0.0.0', () => {
    console.log('Server is running at http://0.0.0.0:8000');
});

