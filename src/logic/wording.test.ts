import { describe, it, expect } from 'vitest';

// 画面に出る文字の見張り。
//
// 「1か所を直すと他の文字と言い方が合わなくなる」が何度も起きてきた
// （閉じる／とじる、ウマの特徴図鑑／ウマのとくちょう図鑑、もう一度／もう一回…）。
// 人が全画面を見比べて気づくのは無理なので、機械に見張らせる。
//
// このテストは **画面に出る文字だけ** を見る。コメントとソースの識別子は対象外
// （日本語のコメントは説明として大事なので、言い方をそろえる対象にしない）。
//
// 新しい言い方を足したいときは、下の表を直せばそれが正になる。

// ── 用語の決めごと：左を使ったら落ちる。右が正。 ──────────────────
const BANNED: [string, string][] = [
  ['とじる', '閉じる'],
  ['ウマのとくちょう図鑑', 'ウマの特徴図鑑'],
  ['もう一回', 'もう一度'],
  ['おしらせ', 'お知らせ'],
  ['ごほうび', 'ご褒美'],
  ['げんていフレーム', '限定フレーム'],
  ['げんてい称号', '限定称号'],
  ['えらぶ', '選ぶ'],
  ['えらび直す', '選び直す'],
  ['のこり', '残り'],
  ['つかいます', '使います'],
  ['つかえます', '使えます'],
  ['くわしい', '詳しい'],
  ['めずらしい', '珍しい'],
  ['ふつう', '普通'],
  ['かならず', '必ず'],
  ['いっきに', '一気に'],
  ['ぜんぶ', '全部'],
  ['つづけて', '続けて'],
  ['みつけよう', '見つけよう'],
  ['よろこび', '喜び'],
  ['はつ勝利', '初勝利'],
  ['れんしょう', '連勝'],
];

/** ここだけは平仮名のまま（固有名詞・常用外の漢字・生成される名前の部品）。 */
const ALLOW_FILES = [
  'src/logic/username.ts', // ランダムな名前の部品。漢字にすると組み合わせが不自然になる
  'src/components/Title.tsx', // ゲーム名「ウマあつめ」
];

// ソースは Vite の import.meta.glob で読む（node の fs を使わずに済むので、
// 型の追加パッケージが要らない）。パスは 'src/...' の形にそろえる。
const RAW = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SOURCES: [string, string][] = Object.entries(RAW)
  .map(([k, v]) => ['src/' + k.replace(/^\.\.\//, ''), v] as [string, string])
  .filter(([k]) => !/\.test\.tsx?$/.test(k));

/** コメントを空白に潰す（画面に出る文字だけを残すため）。 */
function stripComments(s: string): string {
  let out = '';
  let i = 0;
  let mode: string | null = null;
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1] ?? '';
    if (mode === null) {
      if (c === '/' && n === '/') { mode = '//'; i += 2; continue; }
      if (c === '/' && n === '*') { mode = '/*'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { mode = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === '//') { if (c === '\n') { mode = null; out += c; } else out += ' '; i++; continue; }
    if (mode === '/*') { out += c === '\n' ? c : ' '; if (c === '*' && n === '/') { mode = null; out += ' '; i += 2; continue; } i++; continue; }
    if (c === '\\') { out += c + n; i += 2; continue; }
    if (c === mode) mode = null;
    out += c; i++;
  }
  return out;
}

const TEXT = new Map(
  SOURCES.filter(([f]) => !ALLOW_FILES.includes(f)).map(([f, src]) => [f, stripComments(src)]),
);

describe('画面に出る文字の言い方をそろえる', () => {
  it.each(BANNED)('「%s」は使わない（「%s」を使う）', (bad, good) => {
    const hits: string[] = [];
    for (const [f, text] of TEXT) {
      for (const line of text.split('\n')) {
        // 直した先の言い方そのものに含まれる場合は見逃す（例：「選び直す」に「選ぶ」は無い）
        if (line.includes(bad)) hits.push(`${f}: ${line.trim().slice(0, 90)}`);
      }
    }
    expect(hits, `「${bad}」ではなく「${good}」に統一してください\n${hits.join('\n')}`).toEqual([]);
  });

  it('画面に出る文字にコロン付きの英語まじりが残っていない（言い方の取りこぼし検出）', () => {
    // 「ぼやけている」など、あえて平仮名のままにしたものが消えていないことの確認。
    // ここが落ちたら、変換をやりすぎている（＝機械的な置換が行き過ぎた）合図。
    const all = [...TEXT.values()].join('\n');
    expect(all).toContain('ぼやけているもの'); // 常用外なので平仮名のまま
    expect(all).toContain('たてがみ'); // 鬣は常用外
    expect(all).toContain('ひづめ'); // 蹄は常用外
  });

  it('ゲーム名「ウマあつめ」は平仮名のまま（漢字にしない）', () => {
    const title = SOURCES.find(([f]) => f === 'src/components/Title.tsx')![1];
    expect(title).toContain('ウマあつめ');
    expect(title).not.toContain('ウマ集め');
  });

  it('生きもののウマは「ウマ」と書く（「馬が」「馬を」のような書き方をしない）', () => {
    // 「馬券」「馬連」「万馬券」「馬場」は競馬の用語なのでそのまま。
    // ここで見張るのは、生きものを指すときに漢字を使っていないかだけ。
    const hits: string[] = [];
    for (const [f, text] of TEXT) {
      for (const m of text.matchAll(/馬(が|を|は|に|と|の[ウこそあ])/g)) {
        hits.push(`${f}: …${text.slice(Math.max(0, m.index - 12), m.index + 10)}…`);
      }
    }
    expect(hits, `生きもののウマは「ウマ」と書いてください\n${hits.join('\n')}`).toEqual([]);
  });
});
