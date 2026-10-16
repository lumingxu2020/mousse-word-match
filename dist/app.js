import {SEED, LEVEL_UNITS, shuffle, filterWords, starsFor, firstIncompleteLevel, isLevelUnlocked, challengeTotal, parseVocabularyText, normalizeWords} from './game-core.js?v=2.1.0';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
};

let words;
try { words = normalizeWords(storage.get('wordSquadLibrary', SEED)); } catch { words = structuredClone(SEED); }
let progress = storage.get('wordSquadProgress', {});
let game = {words:[], selected:null, matched:0, score:0, combo:0, mistakes:0, locked:false, level:null, startedAt:0};
let soundOn = storage.get('wordSquadSound', true);
let voices = [];
let toastTimer;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('data-')) node.dataset[key.slice(5)] = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) if (child) node.append(child);
  return node;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2200);
}

function renderSoundButton() {
  $('#soundToggle').setAttribute('aria-pressed', String(soundOn));
  $('#soundToggle').replaceChildren(document.createTextNode(soundOn ? '🔊 ' : '🔇 '), el('span', {text:soundOn ? '语音' : '静音'}));
}

function saveProgress() {
  storage.set('wordSquadProgress', progress);
}

async function loadSharedLibrary() {
  try {
    const response = await fetch('/api/library', {headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error('接口不可用');
    const data = await response.json();
    words = normalizeWords(data.words);
    storage.set('wordSquadLibrary', words);
    setSyncState('已连接 NAS，共享词库已同步', 'online');
  } catch {
    setSyncState('当前使用本机词库；连接 NAS 后会自动同步', 'offline');
  }
  refreshLibraryViews();
}

async function persistLibrary(message = '词库已保存') {
  words = normalizeWords(words);
  storage.set('wordSquadLibrary', words);
  refreshLibraryViews();
  try {
    const response = await adminFetch('/api/library', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({words})});
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '保存失败');
    setSyncState('已保存到 NAS，共享设备刷新后可见', 'online');
    toast(message);
  } catch {
    setSyncState('已保存到本机，NAS 暂时无法连接', 'offline');
    toast(`${message}（仅本机）`);
  }
}

function setSyncState(text, state) {
  $('#syncState').textContent = text;
  $('#syncState').className = `sync-state ${state}`;
}

async function adminFetch(url, options = {}, retry = true) {
  let token = localStorage.getItem('wordSquadAdminToken') || '';
  if (!token) token = prompt('请输入词库管理密码')?.trim() || '';
  if (!token) throw new Error('已取消管理操作');
  const response = await fetch(url, {...options, headers:{...(options.headers || {}), 'X-Admin-Token':token}});
  if (response.status === 401 && retry) {
    localStorage.removeItem('wordSquadAdminToken');
    toast('管理密码不正确，请重新输入');
    return adminFetch(url, options, false);
  }
  if (response.ok) localStorage.setItem('wordSquadAdminToken', token);
  return response;
}

function fillSelect(select, values, selected) {
  select.replaceChildren(...values.map(value => el('option', {value, text:value, selected:value === selected})));
}

function refreshOptions() {
  const unit = $('#unit').value || '全部单元';
  const category = $('#category').value || '全部分类';
  fillSelect($('#unit'), ['全部单元', ...new Set(words.map(word => word.unit))], unit);
  fillSelect($('#category'), ['全部分类', ...new Set(words.map(word => word.category))], category);
  fillSelect($('#importUnit'), [...new Set([...LEVEL_UNITS, ...words.map(word => word.unit), '自定义词库'])], $('#importUnit').value || '自定义词库');
}

function refreshLibraryViews() {
  refreshOptions();
  renderHome();
  renderLibrary();
}

function configureMode() {
  const challenge = $('#mode').value === 'challenge';
  $('#category').disabled = challenge;
  if (challenge) {
    const level = firstIncompleteLevel(progress);
    const currentUnit = LEVEL_UNITS.indexOf($('#unit').value) + 1;
    const target = currentUnit > 0 && isLevelUnlocked(currentUnit, progress) ? currentUnit : level;
    $('#unit').value = LEVEL_UNITS[target - 1];
    $('#category').value = '全部分类';
  }
}

function startGame({level = null} = {}) {
  if (level && !isLevelUnlocked(level, progress)) { toast('先完成上一关，就能解锁这里啦'); return; }
  if (level) {
    $('#mode').value = 'challenge';
    $('#unit').value = LEVEL_UNITS[level - 1];
    $('#category').value = '全部分类';
  }
  configureMode();
  let activeLevel = null;
  if ($('#mode').value === 'challenge') {
    activeLevel = LEVEL_UNITS.indexOf($('#unit').value) + 1;
    if (activeLevel < 1 || !isLevelUnlocked(activeLevel, progress)) {
      activeLevel = firstIncompleteLevel(progress);
      $('#unit').value = LEVEL_UNITS[activeLevel - 1];
    }
  }
  const unit = $('#unit').value;
  const category = $('#category').value;
  const count = Number($('#pairCount').value);
  const pool = filterWords(words, unit, category);
  if (pool.length < 2) { toast('这个组合至少需要两个词语'); return; }
  const chosen = shuffle(pool).slice(0, Math.min(count, pool.length));
  const cards = shuffle(chosen.flatMap(word => [
    {...word, text:word.en, side:'EN', lang:'en-US'},
    {...word, text:word.zh, side:'中文', lang:'zh-CN'}
  ]));
  game = {words:chosen, selected:null, matched:0, score:0, combo:0, mistakes:0, locked:false, level:activeLevel, startedAt:Date.now()};
  $('#totalScoreWrap').hidden = !activeLevel;
  updateGameStats();
  $('#progressBar').style.width = '0%';
  $('#gameMeta').textContent = activeLevel ? `闯关模式 · 第 ${activeLevel} 关` : '自由练习';
  $('#missionTitle').textContent = activeLevel ? LEVEL_UNITS[activeLevel - 1] : `${unit} · ${category}`;
  $('#board').replaceChildren(...cards.map((card, index) => {
    const button = el('button', {type:'button', className:'card', text:card.text, 'aria-label':`${card.side}：${card.text}`});
    Object.assign(button.dataset, {id:card.id, index:String(index), type:card.side, lang:card.lang});
    button.addEventListener('click', () => pickCard(button));
    return button;
  }));
  showScreen('play');
}

function updateGameStats() {
  $('#score').textContent = String(game.score);
  if (game.level) {
    const previousBest = Number(progress[game.level]?.best || 0);
    const projectedTotal = challengeTotal(progress) - previousBest + Math.max(previousBest, game.score);
    $('#totalScore').textContent = String(projectedTotal);
  }
  $('#combo').textContent = `×${game.combo}`;
  $('#mistakes').textContent = String(game.mistakes);
}

function pickCard(card) {
  if (game.locked || card === game.selected || card.classList.contains('matched')) return;
  speak(card.textContent, card.dataset.lang);
  card.classList.add('selected');
  card.setAttribute('aria-pressed', 'true');
  if (!game.selected) { game.selected = card; return; }
  const first = game.selected;
  if (first.dataset.id === card.dataset.id) {
    for (const item of [first, card]) {
      item.classList.remove('selected');
      item.classList.add('matched');
      item.setAttribute('aria-pressed', 'false');
    }
    game.matched += 1;
    game.combo += 1;
    game.score += 100 + Math.max(0, game.combo - 1) * 20;
    game.selected = null;
    $('#progressBar').style.width = `${game.matched / game.words.length * 100}%`;
    updateGameStats();
    if (game.matched === game.words.length) { game.locked = true; setTimeout(finishGame, 450); }
    return;
  }
  game.locked = true;
  $('#board').classList.add('locked');
  first.classList.add('wrong');
  card.classList.add('wrong');
  game.mistakes += 1;
  game.combo = 0;
  game.score = Math.max(0, game.score - 10);
  updateGameStats();
  setTimeout(() => {
    for (const item of [first, card]) {
      item.classList.remove('selected', 'wrong');
      item.setAttribute('aria-pressed', 'false');
    }
    game.selected = null;
    game.locked = false;
    $('#board').classList.remove('locked');
    first.focus();
  }, 520);
}

function finishGame() {
  const stars = starsFor(game.mistakes);
  const seconds = Math.max(1, Math.round((Date.now() - game.startedAt) / 1000));
  const best = Number(storage.get('wordSquadBest', 0));
  if (game.score > best) storage.set('wordSquadBest', game.score);
  if (game.level) {
    const previous = progress[game.level] || {};
    progress[game.level] = {completed:true, stars:Math.max(stars, previous.stars || 0), best:Math.max(game.score, previous.best || 0)};
    saveProgress();
  }
  const totalScore = challengeTotal(progress);
  renderHome();
  speak('任务完成', 'zh-CN');
  $('#winStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const allCleared = game.level === LEVEL_UNITS.length && LEVEL_UNITS.every((_, index) => progress[index + 1]?.completed);
  $('#winTitle').textContent = allCleared ? '九关全部完成！' : game.level ? `第 ${game.level} 关完成！` : '配对训练完成！';
  $('#winSummary').textContent = game.level
    ? `${game.words.length} 对词语 · ${game.mistakes} 次错误 · ${seconds} 秒 · 本关 ${game.score} 分 · 闯关总分 ${totalScore} 分`
    : `${game.words.length} 对词语 · ${game.mistakes} 次错误 · ${seconds} 秒 · ${game.score} 分`;
  const hasNext = game.level && game.level < LEVEL_UNITS.length;
  $('#nextLevel').textContent = hasNext ? '下一关 →' : '再玩一次';
  $('#winDialog').showModal();
}

function renderHome() {
  const completed = LEVEL_UNITS.filter((_, i) => progress[i + 1]?.completed).length;
  $('#wordCount').textContent = String(words.length);
  $('#bestScore').textContent = String(challengeTotal(progress));
  $('#cleared').textContent = `${completed}/${LEVEL_UNITS.length}`;
  const next = firstIncompleteLevel(progress);
  $('#quickStart').textContent = completed === LEVEL_UNITS.length ? '重新挑战第一关 →' : `开始第 ${next} 关 →`;
  const map = LEVEL_UNITS.map((unit, index) => {
    const level = index + 1;
    const record = progress[level];
    const unlocked = isLevelUnlocked(level, progress);
    const button = el('button', {type:'button', className:`level ${record?.completed ? 'done' : ''} ${level === next ? 'current' : ''}`, disabled:!unlocked, 'aria-label':`${unit}，${record?.completed ? `已获${record.stars}颗星` : unlocked ? '可挑战' : '未解锁'}`});
    const number = el('span', {className:'level-num', text:record?.completed ? '✓' : unlocked ? String(level) : '🔒'});
    const copy = el('span', {}, [el('h4', {text:unit}), el('p', {text:`${words.filter(word => word.unit === unit).length} 个词 · ${index < 6 ? '课本单元' : '拓展任务'}`})]);
    const starText = record?.completed ? `${'★'.repeat(record.stars)}${'☆'.repeat(3 - record.stars)}\n${record.best || 0} 分` : unlocked ? '→' : '';
    button.append(number, copy, el('span', {className:'level-stars', text:starText}));
    if (unlocked) button.addEventListener('click', () => startGame({level}));
    return button;
  });
  $('#levelMap').replaceChildren(...map);
}

function renderLibrary() {
  const query = ($('#librarySearch').value || '').trim().toLocaleLowerCase();
  const shown = words.filter(word => !query || [word.en, word.zh, word.unit, word.category].some(value => value.toLocaleLowerCase().includes(query)));
  $('#libraryCount').textContent = String(words.length);
  if (!shown.length) { $('#wordTable').replaceChildren(el('p', {className:'empty-list', text:'没有找到匹配的词语'})); return; }
  $('#wordTable').replaceChildren(...shown.map(word => {
    const english = el('div', {}, [el('strong', {text:word.en}), el('small', {text:`${word.unit} · ${word.category}`})]);
    const chinese = el('div', {text:word.zh});
    const remove = el('button', {type:'button', className:'delete-word', text:'×', 'aria-label':`删除 ${word.en}`});
    remove.addEventListener('click', async () => {
      if (!confirm(`确定从共享词库中删除“${word.en}”吗？`)) return;
      words = words.filter(item => item.id !== word.id);
      await persistLibrary(`已删除 ${word.en}`);
    });
    return el('div', {className:'word-row'}, [english, chinese, remove]);
  }));
}

function showScreen(id) {
  $$('.screen').forEach(screen => screen.classList.toggle('active', screen.id === id));
  $$('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.screen === id));
  if (id === 'library') renderLibrary();
  window.scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices();
  const saved = storage.get('wordSquadVoices', {});
  populateVoiceSelect($('#englishVoice'), 'en', saved.en);
  populateVoiceSelect($('#chineseVoice'), 'zh', saved.zh);
}

function populateVoiceSelect(select, language, savedName) {
  const matching = voices.filter(voice => voice.lang.toLowerCase().startsWith(language));
  const preferred = matching.find(voice => /child|kid|young|xiaoxiao|yunxi|samantha|tingting/i.test(voice.name)) || matching[0];
  select.replaceChildren(...matching.map(voice => el('option', {value:voice.name, text:`${voice.name} (${voice.lang})`, selected:voice.name === (savedName || preferred?.name)})));
  if (!matching.length) select.append(el('option', {text:'使用设备默认声音', value:''}));
}

function speak(text, language) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = language.startsWith('en') ? 0.82 : 0.9;
  utterance.pitch = 1.12;
  const select = language.startsWith('en') ? $('#englishVoice') : $('#chineseVoice');
  utterance.voice = voices.find(voice => voice.name === select.value) || voices.find(voice => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase())) || null;
  speechSynthesis.speak(utterance);
}

function openImport(text = '') {
  $('#importText').value = text;
  updateImportPreview();
  $('#importDialog').showModal();
}

function updateImportPreview() {
  const parsed = parseVocabularyText($('#importText').value);
  const existing = new Set(words.map(word => word.en.toLocaleLowerCase('en')));
  const unique = parsed.filter((pair, i) => !existing.has(pair.en.toLocaleLowerCase('en')) && parsed.findIndex(item => item.en.toLocaleLowerCase('en') === pair.en.toLocaleLowerCase('en')) === i);
  $('#previewResult').textContent = `识别到 ${parsed.length} 对，其中 ${unique.length} 对可导入`;
  return unique;
}

async function importWords(event) {
  event.preventDefault();
  const pairs = updateImportPreview();
  if (!pairs.length) { toast('没有可导入的新词语'); return; }
  const unit = $('#importUnit').value;
  const category = $('#importCategory').value.trim() || '自定义';
  const added = pairs.map((pair, index) => ({id:`custom-${Date.now()}-${index}`, ...pair, unit, category}));
  words = [...words, ...added];
  await persistLibrary(`已导入 ${added.length} 个词`);
  $('#importDialog').close();
  $('#importText').value = '';
}

async function filesToOcr(files) {
  const chosen = [...files].slice(0, 5);
  if (!chosen.length) return;
  if (chosen.some(file => file.size > 10 * 1024 * 1024)) { toast('每张图片不能超过 10MB'); return; }
  toast(`正在识别 ${chosen.length} 张图片…`);
  try {
    const images = await Promise.all(chosen.map(async file => ({name:file.name, type:file.type, data:(await readAsDataUrl(file)).split(',')[1]})));
    const response = await adminFetch('/api/ocr', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({images})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '识别失败');
    const pairs = parseVocabularyText(result.text);
    openImport(pairs.length ? pairs.map(pair => `${pair.en} = ${pair.zh}`).join('\n') : result.text);
    toast(`识别完成，请核对 ${pairs.length} 对词语`);
  } catch (error) {
    openImport();
    toast(`图片识别暂不可用：${error.message}`);
  } finally { $('#imageInput').value = ''; }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}

function downloadBackup() {
  const backup = {version:2, exportedAt:new Date().toISOString(), words, progress};
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'}));
  const link = el('a', {href:url, download:`词语突击队备份-${new Date().toISOString().slice(0, 10)}.json`});
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function restoreBackup(file) {
  try {
    const backup = JSON.parse(await file.text());
    words = normalizeWords(backup.words ?? backup);
    if (backup.progress && typeof backup.progress === 'object') { progress = backup.progress; saveProgress(); }
    await persistLibrary('备份已恢复');
  } catch (error) { toast(`导入失败：${error.message}`); }
  $('#backupInput').value = '';
}

$$('.nav-btn').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.screen)));
$('#quickStart').addEventListener('click', () => startGame({level:firstIncompleteLevel(progress) === LEVEL_UNITS.length && progress[LEVEL_UNITS.length]?.completed ? 1 : firstIncompleteLevel(progress)}));
$('#generateGame').addEventListener('click', () => startGame());
$('#mode').addEventListener('change', configureMode);
$('#librarySearch').addEventListener('input', renderLibrary);
$('#soundToggle').addEventListener('click', () => { soundOn = !soundOn; storage.set('wordSquadSound', soundOn); renderSoundButton(); toast(soundOn ? '语音已打开' : '语音已关闭'); });
$$('.theme-card').forEach(button => button.addEventListener('click', () => { document.body.dataset.theme = button.dataset.themeChoice; storage.set('wordSquadTheme', button.dataset.themeChoice); $$('.theme-card').forEach(item => item.classList.toggle('active', item === button)); toast('主题已切换'); }));
for (const select of [$('#englishVoice'), $('#chineseVoice')]) select.addEventListener('change', () => storage.set('wordSquadVoices', {en:$('#englishVoice').value, zh:$('#chineseVoice').value}));
$('#previewVoice').addEventListener('click', () => { speak('Excellent work', 'en-US'); setTimeout(() => speak('做得真棒', 'zh-CN'), 1300); });
$('#manualImport').addEventListener('click', () => openImport());
$('#importText').addEventListener('input', updateImportPreview);
$('#importForm').addEventListener('submit', importWords);
$$('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
$('#imageInput').addEventListener('change', event => filesToOcr(event.target.files));
for (const eventName of ['dragenter','dragover']) $('#dropZone').addEventListener(eventName, event => { event.preventDefault(); $('#dropZone').classList.add('dragging'); });
for (const eventName of ['dragleave','drop']) $('#dropZone').addEventListener(eventName, event => { event.preventDefault(); $('#dropZone').classList.remove('dragging'); });
$('#dropZone').addEventListener('drop', event => filesToOcr(event.dataTransfer.files));
$('#exportBackup').addEventListener('click', downloadBackup);
$('#importBackup').addEventListener('click', () => $('#backupInput').click());
$('#backupInput').addEventListener('change', event => event.target.files[0] && restoreBackup(event.target.files[0]));
$('#resetLibrary').addEventListener('click', async () => { if (!confirm('恢复课本词库会替换共享词库。建议先导出备份，确定继续吗？')) return; words = structuredClone(SEED); await persistLibrary('已恢复 92 个课本词语'); });
$('#backHome').addEventListener('click', () => { $('#winDialog').close(); showScreen('home'); });
$('#nextLevel').addEventListener('click', () => { const next = game.level && game.level < LEVEL_UNITS.length ? game.level + 1 : game.level || null; $('#winDialog').close(); next ? startGame({level:next}) : startGame(); });

const savedTheme = storage.get('wordSquadTheme', 'tactical');
document.body.dataset.theme = ['tactical','space','candy'].includes(savedTheme) ? savedTheme : 'tactical';
$$('.theme-card').forEach(button => button.classList.toggle('active', button.dataset.themeChoice === document.body.dataset.theme));
renderSoundButton();
if ('speechSynthesis' in window) { speechSynthesis.addEventListener?.('voiceschanged', loadVoices); loadVoices(); }
refreshOptions();
renderHome();
renderLibrary();
startGame();
showScreen('home');
loadSharedLibrary();
