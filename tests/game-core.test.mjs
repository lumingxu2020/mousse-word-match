import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED, LEVEL_UNITS, challengeTotal, filterWords, firstIncompleteLevel, isLevelUnlocked, normalizeWords, parseVocabularyText, shuffle, starsFor, normalizeProgress, challengeRounds} from '../dist/game-core.js';

test('课本词库包含 92 个词并覆盖 9 个关卡', () => {
  assert.equal(SEED.length, 92);
  assert.deepEqual([...new Set(SEED.map(word => word.unit))], LEVEL_UNITS);
  assert.equal(new Set(SEED.map(word => word.en.toLowerCase())).size, 92);
});

test('闯关只逐关解锁', () => {
  const progress = {};
  assert.equal(isLevelUnlocked(1, progress), true);
  assert.equal(isLevelUnlocked(2, progress), false);
  progress[1] = {completed:true, stars:2};
  assert.equal(isLevelUnlocked(2, progress), true);
  assert.equal(firstIncompleteLevel(progress), 2);
});

test('闯关总分累计每关最高分并兼容旧进度', () => {
  const progress = {
    1: {completed:true, stars:3, best:700},
    2: {completed:true, stars:2, best:620},
    3: {completed:true, stars:1}
  };
  assert.equal(challengeTotal(progress), 1320);
  assert.equal(challengeTotal({}), 0);
});

test('评分与筛选规则正确', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(filterWords(SEED, 'Unit 6').length, 5);
  assert.equal(filterWords(SEED, '全部单元', '食物').length > 5, true);
});

test('导入解析支持分隔符、OCR 行并跳过标题', () => {
  assert.deepEqual(parseVocabularyText('Words and expressions\napple = 苹果\nbanana，香蕉\nice cream 冰激凌'), [
    {en:'apple', zh:'苹果'}, {en:'banana', zh:'香蕉'}, {en:'ice cream', zh:'冰激凌'}
  ]);
});

test('词库规范化去重并保留纯文本', () => {
  const words = normalizeWords([{en:'<img onerror=x>',zh:'测试',unit:'自定义',category:'自定义'},{en:'Apple',zh:'苹果'},{en:'apple',zh:'重复'}]);
  assert.equal(words.length, 2);
  assert.equal(words[0].en, '<img onerror=x>');
  assert.equal(words[1].en, 'Apple');
});

test('Fisher-Yates 洗牌不修改原数组', () => {
  const input = [1,2,3,4];
  const output = shuffle(input, () => 0);
  assert.deepEqual(input, [1,2,3,4]);
  assert.deepEqual([...output].sort(), input);
});

test('迁移旧分数并过滤损坏备份成绩', () => {
  const migrated = normalizeProgress({1:600, 2:{completed:true,best:800,stars:2}, 3:{best:'bad'},4:null});
  assert.equal(challengeTotal(migrated), 1400);
  assert.equal(isLevelUnlocked(3, migrated), true);
  assert.deepEqual(normalizeProgress(null), {});
  assert.equal(migrated[3], undefined);
});

test('每个单元全部词语只出现一次，末轮不会只剩一对', () => {
  for (const unit of LEVEL_UNITS) {
    const pool = filterWords(SEED, unit);
    const rounds = challengeRounds(pool);
    assert.deepEqual(rounds.flat(), pool);
    assert.ok(rounds.every(round => round.length >= 2 && round.length <= 6));
    assert.equal(new Set(rounds.flat().map(word => word.id)).size, pool.length);
  }
});
