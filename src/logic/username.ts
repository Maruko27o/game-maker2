// Default usernames (改修④). Each account gets an arbitrary friendly name on
// first sign-in (adjective + horse noun + number); the player can change it. Kept
// wholesome and horse-themed to match the game.
const ADJ = [
  'あかい', 'あおい', 'きいろい', 'みどりの', 'はやい', 'つよい', 'げんきな', 'しずかな',
  'ゆうかんな', 'ほしの', 'かぜの', 'もりの', 'ひかる', 'まるい', 'ちいさな', 'おおきな',
  'ふわふわ', 'きらきら', 'のんびり', 'すばやい',
];
const NOUN = [
  'ウマ', 'こうま', 'おうじ', 'じょおう', 'ナイト', 'ペガサス', 'スター', 'コメット',
  'ダッシュ', 'たてがみ', 'ひづめ', 'くさはら', 'にんじん', 'りんご', 'くも', 'かみなり',
  'サラブレ', 'ポニー', 'キャロット', 'クローバー',
];

/** A random default username, e.g. "かぜのペガサス372". Pass a seeded rng for tests. */
export function randomUsername(rng: () => number = Math.random): string {
  const a = ADJ[Math.floor(rng() * ADJ.length)];
  const n = NOUN[Math.floor(rng() * NOUN.length)];
  const num = 100 + Math.floor(rng() * 900);
  return `${a}${n}${num}`;
}

/** Trim + clamp a username to what the server accepts (1..32 chars). */
export function normalizeUsername(name: string): string {
  return name.trim().slice(0, 32);
}
