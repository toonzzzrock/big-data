// node serve.js [port]  : rebuild from ../summarize then serve dist/ (dist/index.html also opens directly via file://)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
const root = path.join(__dirname, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const port = Number(process.argv[2]) || 4173;
http.createServer((req, res) => {
  const p = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }).end(fs.readFileSync(f));
}).listen(port, () => console.log('http://localhost:' + port));
