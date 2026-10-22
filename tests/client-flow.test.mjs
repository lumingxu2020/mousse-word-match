import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/game-core.js';

function client({saved = {}, fetch = async () => ({ok:false,status:503,json:async()=>({error:'offline'})})} = {}) {
  const values = new Map(Object.entries(saved).map(([key,value]) => [key,JSON.stringify(value)]));
  const nodes = new Map();
  class Node {
    constructor() { this.dataset={}; this.style={}; this.children=[]; this.value=''; this.textContent=''; this.classes=new Set(); this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:n=>this.classes.has(n),toggle:()=>{}}; }
    setAttribute() {}
    addEventListener(name, fn) { this[name]=fn; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children=items; }
    focus() {}
    showModal() { this.open=true; }
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id,new Node()); return nodes.get(id); };
  const timers = new Map(); let nextTimer=0;
  const context = vm.createContext({...core, console, structuredClone, Date,
    localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
    document:{querySelector:selector=>selector==='#board .card:not(.matched)' ? get('#board').children.find(n=>!n.classes.has('matched'))||null : get(selector),querySelectorAll:()=>[],createElement:()=>new Node()},
    setTimeout:(fn)=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    fetch,prompt:()=>null,window:{},matchMedia:()=>({matches:true})});
  const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*\n/,'').split("\n$$('.nav-btn').forEach")[0];
  vm.runInContext(source,context);
  vm.runInContext('renderHome=()=>{};renderLibrary=()=>{};refreshOptions=()=>{};showScreen=()=>{};',context);
  get('#mode').value='challenge';get('#unit').value='Unit 1';get('#category').value='全部分类';get('#pairCount').value='4';
  return {get,values,run:code=>vm.runInContext(code,context),flush:()=>{const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());}};
}

function matchRound(c) {
  const cards=c.get('#board').children;
  for (const first of cards.filter(n=>n.dataset.type==='EN')) {
    c.run(`pickCard(document.querySelector('#board').children[${cards.indexOf(first)}])`);
    const second=cards.find(n=>n.dataset.id===first.dataset.id&&n!==first);
    c.run(`pickCard(document.querySelector('#board').children[${cards.indexOf(second)}])`);
  }
}

test('完整单元分两轮：首轮不解锁，末轮保存跨轮总分', () => {
  const c=client();c.run('startGame({level:1})');
  assert.equal(c.get('#pairCount').disabled,true);
  matchRound(c);assert.equal(c.run('game.matched'),6);assert.equal(c.values.has('wordSquadProgress')&&JSON.parse(c.values.get('wordSquadProgress'))[1],undefined);
  c.flush();assert.equal(c.run('game.round'),1);assert.equal(c.run('game.score'),900);
  matchRound(c);c.flush();
  assert.equal(c.run('game.matched'),12);assert.equal(c.run('progress[1].best'),2520);
  assert.equal(c.get('#winDialog').open,true);
});

test('错配后重新生成会清除锁定和旧回调，通关回调不影响新局', () => {
  const c=client();c.run('startGame({level:1})');
  const cards=c.get('#board').children;
  const second=cards.findIndex(n=>n.dataset.id!==cards[0].dataset.id);
  c.run(`pickCard(document.querySelector('#board').children[0]);pickCard(document.querySelector('#board').children[${second}]);startGame({level:1})`);
  const first=c.get('#board').children[0];c.run('pickCard(document.querySelector("#board").children[0])');c.flush();
  assert.equal(c.run('game.selected')===first,true);
  c.run('startGame({level:1})');matchRound(c);c.flush();matchRound(c);c.run('startGame({level:1})');c.flush();
  assert.equal(c.run('game.completed'),false);assert.equal(c.get('#winDialog').open,undefined);
});

test('取消管理操作会保留待同步草稿，刷新读取服务端也不覆盖草稿', async () => {
  const draft=[...core.SEED,{en:'draft',zh:'草稿',id:'draft',unit:'自定义',category:'自定义'}];
  const c=client({saved:{wordSquadLibrary:draft,wordSquadLibraryRevision:0},fetch:async()=>({ok:true,json:async()=>({words:core.SEED,revision:0})})});
  assert.equal(await c.run('persistLibrary()'),false);
  assert.equal(JSON.parse(c.values.get('wordSquadPendingLibrary')).words.length,93);
  await c.run('loadSharedLibrary()');assert.equal(c.run('words.length'),93);
  assert.match(c.get('#syncState').textContent,/未同步修改/);
});

test('正确鉴权后保存新版本并清理待同步草稿', async () => {
  const c=client({fetch:async()=>({ok:true,status:200,json:async()=>({revision:1})})});
  c.run("localStorage.setItem('wordSquadAdminToken','test-token')");
  assert.equal(await c.run('persistLibrary()'),true);
  assert.equal(c.values.has('wordSquadPendingLibrary'),false);
  assert.equal(c.run('libraryRevision'),1);
});
