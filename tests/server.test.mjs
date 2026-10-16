import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {SEED} from '../dist/game-core.js';

test('服务端鉴权、共享词库持久化和静态页面', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-match-test-'));
  const port = 19100 + process.pid % 400;
  const token = 'server-test-admin';
  let child;
  const start = () => new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['server.mjs'], {cwd:path.resolve(import.meta.dirname, '..'), env:{...process.env, DATA_DIR:dataDir, PORT:String(port), WORD_MATCH_ADMIN_TOKEN:token}, stdio:['ignore','pipe','pipe']});
    const timer = setTimeout(() => reject(new Error('服务启动超时')), 8000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`服务提前退出 ${code}`)); });
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
  });
  t.after(() => { child?.kill(); fs.rmSync(dataDir, {recursive:true, force:true}); });
  await start();
  const home = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
  const appScript = await fetch(`http://127.0.0.1:${port}/app.js`);
  assert.equal(appScript.headers.get('cache-control'), 'no-cache');
  const denied = await fetch(`http://127.0.0.1:${port}/api/library`, {method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({words:SEED})});
  assert.equal(denied.status, 401);
  const custom = [...SEED, {id:'custom-test',en:'test word',zh:'测试词',unit:'自定义词库',category:'自定义'}];
  const saved = await fetch(`http://127.0.0.1:${port}/api/library`, {method:'PUT', headers:{'content-type':'application/json','x-admin-token':token}, body:JSON.stringify({words:custom})});
  assert.equal(saved.status, 200);
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
  await start();
  const restored = await (await fetch(`http://127.0.0.1:${port}/api/library`)).json();
  assert.equal(restored.words.length, 93);
  assert.equal(restored.words.at(-1).en, 'test word');
});
