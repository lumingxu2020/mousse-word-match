import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {SEED, normalizeWords} from './dist/game-core.js';

const execFileAsync = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(root, 'dist');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const libraryFile = path.join(dataDir, 'library.json');
const previousFile = path.join(dataDir, 'library.previous.json');
const tokenFile = path.join(dataDir, 'admin-token.txt');
const port = Number(process.env.PORT || 3093);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

fs.mkdirSync(dataDir, {recursive:true});
if (!fs.existsSync(libraryFile)) writeJson(libraryFile, {version:1, updatedAt:new Date().toISOString(), words:SEED});
const adminToken = loadAdminToken();

function loadAdminToken() {
  const configured = process.env.WORD_MATCH_ADMIN_TOKEN?.trim();
  if (configured && configured.length >= 10) return configured;
  if (fs.existsSync(tokenFile)) return fs.readFileSync(tokenFile, 'utf8').trim();
  const generated = randomBytes(18).toString('base64url');
  fs.writeFileSync(tokenFile, `${generated}\n`, {mode:0o600});
  console.log(`初始词库管理密码已保存到 ${tokenFile}`);
  return generated;
}

function authorized(req) {
  const supplied = String(req.headers['x-admin-token'] || '');
  if (!supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(adminToken)) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(adminToken));
}

function writeJson(target, value) {
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {mode:0o600});
  fs.renameSync(temp, target);
}

function readLibrary() {
  const data = JSON.parse(fs.readFileSync(libraryFile, 'utf8'));
  return {words:normalizeWords(data.words), revision:Number(data.revision) || 0};
}

function headers(extra = {}) {
  return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'", ...extra};
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, headers({'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'}));
  res.end(body);
}

async function readBody(req, limit = 30 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求内容过大'), {status:413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON 格式不正确'), {status:400}); }
}

async function recognizeImages(images) {
  if (!Array.isArray(images) || !images.length || images.length > 5) throw Object.assign(new Error('请选择 1–5 张图片'), {status:400});
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-match-ocr-'));
  try {
    const texts = [];
    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      const extension = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[image?.type];
      if (!extension || typeof image.data !== 'string') throw Object.assign(new Error('只支持 JPG、PNG、WebP 图片'), {status:400});
      const buffer = Buffer.from(image.data, 'base64');
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw Object.assign(new Error('每张图片须小于 10MB'), {status:413});
      const input = path.join(tempDir, `image-${index}${extension}`);
      fs.writeFileSync(input, buffer, {mode:0o600});
      const {stdout} = await execFileAsync('tesseract', [input, 'stdout', '-l', 'eng+chi_sim', '--psm', '3'], {timeout:120000, maxBuffer:10 * 1024 * 1024});
      texts.push(stdout);
    }
    return texts.join('\n');
  } finally { fs.rmSync(tempDir, {recursive:true, force:true}); }
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(requested); } catch { sendJson(res, 400, {error:'网址格式不正确'}); return; }
  const file = path.resolve(staticDir, `.${decoded}`);
  if (!file.startsWith(`${staticDir}${path.sep}`)) { sendJson(res, 404, {error:'找不到页面'}); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { sendJson(res, 404, {error:'找不到页面'}); return; }
    const extension = path.extname(file).toLowerCase();
    const cache = 'no-cache';
    res.writeHead(200, headers({'Content-Type':mime[extension] || 'application/octet-stream','Content-Length':stat.size,'Cache-Control':cache}));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, {ok:true});
    if (url.pathname === '/api/library' && req.method === 'GET') return sendJson(res, 200, readLibrary());
    if (url.pathname === '/api/library' && req.method === 'PUT') {
      if (!authorized(req)) return sendJson(res, 401, {error:'请输入正确的词库管理密码'});
      const body = await readBody(req, 2 * 1024 * 1024);
      const current = readLibrary();
      if (body.revision !== current.revision) return sendJson(res, 409, {error:'词库已在其他设备更新，请先核对服务端版本', revision:current.revision});
      const words = normalizeWords(body.words);
      if (fs.existsSync(libraryFile)) fs.copyFileSync(libraryFile, previousFile);
      writeJson(libraryFile, {version:1, revision:current.revision + 1, updatedAt:new Date().toISOString(), words});
      return sendJson(res, 200, {ok:true, count:words.length, revision:current.revision + 1});
    }
    if (url.pathname === '/api/ocr' && req.method === 'POST') {
      if (!authorized(req)) return sendJson(res, 401, {error:'请输入正确的词库管理密码'});
      const body = await readBody(req);
      const text = await recognizeImages(body.images);
      return sendJson(res, 200, {text});
    }
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, {error:'接口不存在'});
    if (!['GET','HEAD'].includes(req.method)) return sendJson(res, 405, {error:'不支持该操作'});
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    const unavailable = error.code === 'ENOENT' && /tesseract/.test(error.path || error.message);
    sendJson(res, unavailable ? 503 : error.status || 500, {error:unavailable ? 'NAS 尚未安装文字识别组件' : error.message || '服务器错误'});
  }
});

server.listen(port, '0.0.0.0', () => console.log(`词语突击队运行在 http://0.0.0.0:${port}`));
