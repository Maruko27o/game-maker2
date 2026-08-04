// エフェクト（旧「しっぽ」スロット）。
//
// もともと しっぽ枠は「地の黒いしっぽはそのままで、その横に小さい飾りを置く」だけの
// 作りだった。だから しっぽ に見えないのが構造上あたりまえで、27点中5点は しっぽ から
// 離れて空中に浮いていた。側面図では しっぽ は体の陰になって目立たない位置でもある。
//
// そこで枠の性格ごと変えて、ウマ全体にかかる「エフェクト」にした。
//  ・出す場所は マイウマ（全身）と アイコン（顔）だけ。走っているウマには出さない（重いので）
//  ・ウマ本体の後ろに描く。頭・顔・背中のコスチュームを隠さないため
//  ・レアリティで派手さが変わる：N は静止、R はゆっくり動く、SR ははっきり動く
//
// 形は少数の「種類（kind）」と「粒の形（shape）」の組み合わせで作る。1点ずつ手描き
// すると質がばらつくので、共通の部品から組み立てて見栄えを揃えている。

export type EffectKind =
  | 'glow' // 後ろのやわらかい光
  | 'motes' // まわりに漂う粒
  | 'petals' // 上から舞い落ちる
  | 'bubbles' // 下から昇る
  | 'rays' // 後ろから放射する光
  | 'orbit' // まわりを回る
  | 'flames' // 足もとで揺れる
  | 'aurora'; // 後ろに広がる帯

export type EffectShape =
  | 'dot' | 'star' | 'heart' | 'note' | 'leaf' | 'maple' | 'clover' | 'snow'
  | 'feather' | 'petal' | 'bubble' | 'shard' | 'candy' | 'gem' | 'ribbon'
  | 'pom' | 'cloud' | 'lantern' | 'moon' | 'shell' | 'splash' | 'comet'
  | 'bolt' | 'flame' | 'bell';

export type EffectDef = {
  id: string; // 既存のパーツID（tail_*）をそのまま使う＝持ち物はそのまま引き継がれる
  name: string; // 表示名
  kind: EffectKind;
  shape: EffectShape;
  /** 主色・副色。glow / rays / aurora の色にも使う。 */
  colors: [string, string];
  /** 粒の数のめやす（kind によっては未使用）。 */
  count?: number;
};

// 粒の形。原点まわり・半径およそ 10 で描き、置くときに拡大縮小する。
export const SHAPE_PATH: Record<EffectShape, string> = {
  dot: 'M 0,-8 A 8,8 0 1,1 0,8 A 8,8 0 1,1 0,-8 Z',
  star: 'M 0,-11 L 3,-3.5 L 11,-3 L 4.8,2 L 7,10 L 0,5.5 L -7,10 L -4.8,2 L -11,-3 L -3,-3.5 Z',
  heart: 'M 0,9 C -9,2 -10,-4 -6,-7 C -3,-9 -0.5,-7 0,-5 C 0.5,-7 3,-9 6,-7 C 10,-4 9,2 0,9 Z',
  note: 'M -1,8 A 4,3.2 0 1,1 3,6.5 L 3,-8 L 9,-10 L 9,-5 L 5,-3.6 L 5,6.5 A 4,3.2 0 1,1 -1,8 Z',
  leaf: 'M 0,10 C -8,4 -9,-6 0,-10 C 9,-6 8,4 0,10 Z',
  maple: 'M 0,-11 L 3,-4 L 9,-6 L 6,-1 L 11,2 L 5,4 L 7,10 L 0,6 L -7,10 L -5,4 L -11,2 L -6,-1 L -9,-6 L -3,-4 Z',
  clover: 'M 0,2 A 4.5,4.5 0 1,1 0,-7 A 4.5,4.5 0 1,1 6,-1 A 4.5,4.5 0 1,1 0,2 Z M -1,2 L -1,10 L 1,10 L 1,2 Z',
  snow: 'M -1,-11 L 1,-11 L 1,11 L -1,11 Z M -10,-5.5 L -9,-7.2 L 10,3.8 L 9,5.5 Z M 9,-7.2 L 10,-5.5 L -9,5.5 L -10,3.8 Z',
  feather: 'M 1,10 C -6,4 -8,-4 -2,-10 C 6,-5 6,3 1,10 Z',
  petal: 'M 0,10 C -7,5 -8,-3 0,-10 C 8,-3 7,5 0,10 Z',
  bubble: 'M 0,-9 A 9,9 0 1,1 0,9 A 9,9 0 1,1 0,-9 Z',
  shard: 'M 0,-11 L 5,0 L 0,11 L -5,0 Z',
  candy: 'M 0,-6 A 6,6 0 1,1 0,6 A 6,6 0 1,1 0,-6 Z M 6,-6 L 11,-9 L 10,0 L 11,9 L 6,6 Z',
  gem: 'M 0,-10 L 8,-3 L 5,9 L -5,9 L -8,-3 Z',
  ribbon: 'M 0,0 L -9,-6 L -7,3 Z M 0,0 L 9,-6 L 7,3 Z M -2,0 L 2,0 L 1,9 L -1,9 Z',
  pom: 'M 0,-8 L 3,-3 L 8,-4 L 5,0 L 8,4 L 3,3 L 0,8 L -3,3 L -8,4 L -5,0 L -8,-4 L -3,-3 Z',
  cloud: 'M -10,4 A 5,5 0 0,1 -6,-3 A 6,6 0 0,1 4,-6 A 5,5 0 0,1 10,4 Z',
  lantern: 'M 0,-9 C 7,-9 9,-4 9,0 C 9,4 7,9 0,9 C -7,9 -9,4 -9,0 C -9,-4 -7,-9 0,-9 Z',
  moon: 'M 4,-10 A 10,10 0 1,0 4,10 A 8,8 0 1,1 4,-10 Z',
  shell: 'M 0,9 L -10,-4 C -6,-9 6,-9 10,-4 Z',
  splash: 'M 0,-9 C 4,-4 9,-4 9,0 C 9,5 4,9 0,9 C -5,9 -9,5 -9,0 C -9,-5 -4,-4 0,-9 Z',
  comet: 'M 6,-6 A 6,6 0 1,1 5,-7 L 14,-14 L 8,-3 Z',
  bolt: 'M 3,-12 L -6,1 L 0,1 L -3,12 L 7,-2 L 1,-2 Z',
  flame: 'M 0,10 C -7,10 -9,3 -6,-2 C -5,1 -3,2 -2,1 C -4,-4 -1,-9 3,-12 C 2,-6 8,-5 6,2 C 5,6 4,10 0,10 Z',
  bell: 'M 0,-10 C 6,-10 8,-5 8,2 L 10,6 L -10,6 L -8,2 C -8,-5 -6,-10 0,-10 Z M 0,7 A 3,3 0 1,1 0,12 A 3,3 0 1,1 0,7 Z',
};

// 27点。名前は元の しっぽ の名前を活かし、エフェクトとして無理があるものだけ変えた。
export const EFFECTS: EffectDef[] = [
  { id: 'tail_ribbon', name: 'リボンのまい', kind: 'petals', shape: 'ribbon', colors: ['#ff8ac4', '#ffd0e6'], count: 7 },
  { id: 'tail_fire', name: 'ほのおのオーラ', kind: 'flames', shape: 'flame', colors: ['#ff7a2d', '#ffd34d'], count: 7 },
  { id: 'tail_ice', name: 'こおりのオーラ', kind: 'motes', shape: 'shard', colors: ['#6fd6ff', '#d6f4ff'], count: 9 },
  { id: 'tail_sparkle', name: 'きらめき', kind: 'orbit', shape: 'star', colors: ['#ffd34d', '#fff3b8'], count: 10 },
  { id: 'tail_flower', name: 'はなふぶき', kind: 'petals', shape: 'petal', colors: ['#ff9ec4', '#ffe2ee'], count: 9 },
  { id: 'tail_bubble', name: 'あわ', kind: 'bubbles', shape: 'bubble', colors: ['#7fe0ff', '#dff6ff'], count: 9 },
  { id: 'tail_star', name: 'ほしのまたたき', kind: 'motes', shape: 'star', colors: ['#ffd34d', '#fff3b8'], count: 8 },
  { id: 'tail_lightning', name: 'いなずま', kind: 'rays', shape: 'bolt', colors: ['#ffe066', '#fff7cf'], count: 6 },
  { id: 'tail_heart', name: 'ハートのオーラ', kind: 'motes', shape: 'heart', colors: ['#ff6f9c', '#ffd0e0'], count: 8 },
  { id: 'tail_leaf', name: 'このはまい', kind: 'petals', shape: 'leaf', colors: ['#69b34a', '#c8e6a0'], count: 8 },
  { id: 'tail_music', name: 'おんぷ', kind: 'motes', shape: 'note', colors: ['#a06bff', '#ddc9ff'], count: 8 },
  { id: 'tail_bell', name: 'すずのね', kind: 'motes', shape: 'bell', colors: ['#e8b73a', '#ffe9a8'], count: 7 },
  { id: 'tail_puff', name: 'ふわふわ', kind: 'glow', shape: 'dot', colors: ['#f0d9a4', '#fff2d8'], count: 6 },
  { id: 'tail_paint', name: 'ペイントしぶき', kind: 'motes', shape: 'splash', colors: ['#4fb0ff', '#ff8ac4'], count: 9 },
  { id: 'tail_rainbow', name: 'にじのアーチ', kind: 'aurora', shape: 'dot', colors: ['#ff6f6f', '#4fb0ff'] },
  { id: 'tail_candy', name: 'あまいかおり', kind: 'motes', shape: 'candy', colors: ['#ff7fb0', '#ffe1ee'], count: 8 },
  { id: 'tail_feather', name: 'はねふわり', kind: 'petals', shape: 'feather', colors: ['#b9d2ea', '#ffffff'], count: 8 },
  { id: 'tail_moon', name: 'つきあかり', kind: 'glow', shape: 'moon', colors: ['#8fa8ff', '#e6ecff'], count: 5 },
  { id: 'tail_clover', name: 'しあわせのかぜ', kind: 'petals', shape: 'clover', colors: ['#5fbf5a', '#c8ecb0'], count: 8 },
  { id: 'tail_snowflake', name: 'こなゆき', kind: 'petals', shape: 'snow', colors: ['#9fd8f5', '#e8f7ff'], count: 10 },
  { id: 'tail_pom', name: 'ポンポン', kind: 'motes', shape: 'pom', colors: ['#ff8ac4', '#7fe0ff'], count: 9 },
  { id: 'tail_shell', name: 'しおかぜ', kind: 'bubbles', shape: 'shell', colors: ['#5fc9c0', '#d5f2ef'], count: 8 },
  { id: 'tail_cloud', name: 'くものうえ', kind: 'glow', shape: 'cloud', colors: ['#c6dcf4', '#ffffff'], count: 5 },
  { id: 'tail_maple', name: 'もみじまい', kind: 'petals', shape: 'maple', colors: ['#e05a3a', '#ffb45e'], count: 8 },
  { id: 'tail_lantern', name: 'ちょうちんあかり', kind: 'glow', shape: 'lantern', colors: ['#ff9f43', '#ffe0a8'], count: 5 },
  { id: 'tail_gem', name: 'ほうせきのかがやき', kind: 'rays', shape: 'gem', colors: ['#b06bff', '#ffd7f2'], count: 6 },
  { id: 'tail_comet', name: 'すいせい', kind: 'orbit', shape: 'comet', colors: ['#4fb0ff', '#dff0ff'], count: 6 },
];

export const effectById: Record<string, EffectDef> = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));
