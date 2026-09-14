/**
 * server.js - Lightweight local HTTP server using Node.js standard library (no dependencies)
 * Usage:
 *   node server.js [port]
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.argv[2], 10) || 8000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.tp': 'text/xml; charset=utf-8',
    '.psp': 'text/xml; charset=utf-8',
    '.xml': 'text/xml; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/config.js') {
        const convexUrl = process.env.CONVEX_URL || 'http://127.0.0.1:3210';
        const body = `window.TECHPROT_CONVEX_URL=${JSON.stringify(convexUrl)};`;
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.js'], 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
        res.end(body);
        return;
    }
    if (reqPath === '/') reqPath = '/index.html';

    const filePath = path.join(__dirname, reqPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`500 Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log('=======================================================');
    console.log(`  TechProt Web Server rodando em:`);
    console.log(`  -> http://localhost:${PORT}`);
    console.log(`  -> Pressione Ctrl+C para encerrar`);
    console.log('=======================================================');
});
