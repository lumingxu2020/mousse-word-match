export const SEED_ROWS = [
  ['sad','不愉快的；伤心的；难过的','Unit 1','情绪'],['angry','发怒的；生气的','Unit 1','情绪'],['tired','困倦的；疲倦的；累的','Unit 1','情绪'],['hungry','饥饿的','Unit 1','情绪'],['fun','有趣的','Unit 1','描述'],['show','演出','Unit 1','活动'],['turn','轮到的机会','Unit 1','常用词'],['apple','苹果','Unit 1','食物'],["o’clock",'点钟','Unit 1','时间'],['want','想要','Unit 1','常用词'],['for','为了；供','Unit 1','常用词'],['dinner','正餐；主餐','Unit 1','食物'],
  ['eat','吃','Unit 2','动作'],['banana','香蕉','Unit 2','食物'],['yummy','美味的；很好吃的','Unit 2','描述'],['rice','米；米饭','Unit 2','食物'],['noodle','面条','Unit 2','食物'],['milk','奶；牛奶','Unit 2','食物'],['bread','面包','Unit 2','食物'],['like','喜欢；喜爱','Unit 2','动作'],['but','但是；然而','Unit 2','常用词'],['food','食物','Unit 2','食物'],['us','我们','Unit 2','人物'],['cake','蛋糕','Unit 2','食物'],['sweet','糖果','Unit 2','食物'],['ice cream','冰激凌','Unit 2','食物'],
  ['weather','天气','Unit 3','天气'],['windy','风大的；多风的','Unit 3','天气'],['snowy','多雪的；积雪的','Unit 3','天气'],['rainy','多雨的','Unit 3','天气'],['sunny','阳光充足的','Unit 3','天气'],['worry','担心','Unit 3','情绪'],['wait','等；等候','Unit 3','动作'],['later','之后','Unit 3','时间'],['egg','蛋','Unit 3','食物'],['other','另外的','Unit 3','描述'],['in','在……里','Unit 3','常用词'],
  ['spring','春天；春季','Unit 4','季节'],['summer','夏天；夏季','Unit 4','季节'],['autumn','秋天；秋季','Unit 4','季节'],['winter','冬天；冬季','Unit 4','季节'],['season','季节','Unit 4','季节'],['year','年','Unit 4','时间'],['lot','大量；许多','Unit 4','常用词'],['make','制作','Unit 4','动作'],['some','一些；若干','Unit 4','常用词'],['hat','帽子','Unit 4','服饰'],
  ['shirt','衬衫','Unit 5','服饰'],['skirt','半身裙；裙子','Unit 5','服饰'],['coat','外套','Unit 5','服饰'],['shoe','鞋','Unit 5','服饰'],['put','放','Unit 5','动作'],['them','它们；他们；她们','Unit 5','人物'],['sun','阳光','Unit 5','天气'],['jump','跳；跃','Unit 5','动作'],
  ['paper-cut','剪纸','Unit 6','活动'],['up','向上地','Unit 6','方向'],['lucky','运气好的；幸运的','Unit 6','描述'],['kite','风筝','Unit 6','物品'],['card','贺卡','Unit 6','物品'],
  ['warm','温暖的','浙江拓展','天气'],['enjoy','享受……的乐趣','浙江拓展','动作'],['Longjing tea','龙井茶','浙江拓展','浙江文化'],['Tianmu Mountain','天目山','浙江拓展','浙江文化'],['Dongpo Pork','东坡肉','浙江拓展','浙江文化'],['seafood','海鲜','浙江拓展','食物'],['stinky tofu','臭豆腐','浙江拓展','食物'],['Jinhua ham','金华火腿','浙江拓展','浙江文化'],['also','也','浙江拓展','常用词'],['during','在……期间','浙江拓展','时间'],['festival','节日','浙江拓展','节日'],
  ['fox','狐狸','阅读拓展','动物'],['stork','鹳','阅读拓展','动物'],['always','总是','阅读拓展','常用词'],['see','看见；看到','阅读拓展','动作'],['idea','想法；主意','阅读拓展','常用词'],['soup','汤','阅读拓展','食物'],['king','国王','阅读拓展','人物'],['new','未用过的；崭新的','阅读拓展','描述'],['magic','有魔力的','阅读拓展','描述'],['only','只限；只有','阅读拓展','常用词'],['clever','聪明的；聪颖的','阅读拓展','描述'],['great','非常好的','阅读拓展','描述'],['right','对的','阅读拓展','描述'],
  ['Kate','凯特','专有名词','人物'],['Sally','萨莉','专有名词','人物'],['Danny','丹尼','专有名词','人物'],['Jeff','杰夫','专有名词','人物'],["Children’s Day",'儿童节','专有名词','节日'],['Mid-Autumn Festival','中秋节','专有名词','节日'],['Dragon Boat Festival','端午节','专有名词','节日'],['Christmas','圣诞节','专有名词','节日']
];

export const SEED = SEED_ROWS.map((row, index) => ({id:`w${index}`, en:row[0], zh:row[1], unit:row[2], category:row[3]}));
export const LEVEL_UNITS = ['Unit 1','Unit 2','Unit 3','Unit 4','Unit 5','Unit 6','浙江拓展','阅读拓展','专有名词'];

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function filterWords(words, unit = '全部单元', category = '全部分类') {
  return words.filter(word => (unit === '全部单元' || word.unit === unit) && (category === '全部分类' || word.category === category));
}

export function starsFor(mistakes) {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

export function firstIncompleteLevel(progress) {
  const index = LEVEL_UNITS.findIndex((_, i) => !progress[i + 1]?.completed);
  return index === -1 ? LEVEL_UNITS.length : index + 1;
}

export function isLevelUnlocked(level, progress) {
  return level === 1 || Boolean(progress[level - 1]?.completed);
}

export function challengeTotal(progress) {
  return LEVEL_UNITS.reduce((total, _, index) => {
    const score = Number(progress?.[index + 1]?.best);
    return total + (Number.isFinite(score) && score > 0 ? score : 0);
  }, 0);
}

export function parseVocabularyText(text) {
  const ignored = /^(unit\s*\d+|word(s)?( and expressions| list)?|proper nouns?|names?|others?|[a-z])$/i;
  const pairs = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || ignored.test(line)) continue;
    let en = '', zh = '';
    const delimited = line.match(/^\s*([A-Za-z][A-Za-z’' .-]{0,80}?)\s*(?:=|\t|[,，：:])\s*([\u3400-\u9fff（），；、·…\s]{1,100})\s*$/);
    if (delimited) [, en, zh] = delimited;
    else {
      const splitAt = line.search(/[\u3400-\u9fff]/);
      if (splitAt > 0) {
        en = line.slice(0, splitAt).replace(/[=:：,，\s]+$/g, '').trim();
        zh = line.slice(splitAt).trim();
      }
    }
    en = en.replace(/^[^A-Za-z]+|[^A-Za-z’' .-]+$/g, '').trim();
    zh = zh.replace(/\s+/g, '').trim();
    if (/^[A-Za-z][A-Za-z’' .-]{0,80}$/.test(en) && /[\u3400-\u9fff]/.test(zh)) pairs.push({en, zh});
  }
  return pairs;
}

export function normalizeWords(input) {
  if (!Array.isArray(input)) throw new Error('词库格式不正确');
  const seen = new Set();
  const output = [];
  for (const item of input) {
    const en = String(item?.en || '').trim().slice(0, 100);
    const zh = String(item?.zh || '').trim().slice(0, 150);
    const unit = String(item?.unit || '自定义词库').trim().slice(0, 40);
    const category = String(item?.category || '自定义').trim().slice(0, 40);
    const key = en.toLocaleLowerCase('en');
    if (!en || !zh || seen.has(key)) continue;
    seen.add(key);
    output.push({id:String(item?.id || `custom-${cryptoId()}`).slice(0, 100), en, zh, unit, category});
  }
  if (output.length < 2 || output.length > 2000) throw new Error('词库须包含 2–2000 个有效词语');
  return output;
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
