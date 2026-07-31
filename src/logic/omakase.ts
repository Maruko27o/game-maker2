// おまかせ（自動で買い目を決める）の買い目づくり。
//
// 「このウマは絶対に入れたい、あとは任せる」を成立させる。パドックで選んでいる
// ウマは必ず買い目に入り、足りないぶんはランダムに埋める。3連単のような着順が
// ある馬券では、選んだウマの着順もランダムになる（1着固定ではない）。
// 何も選んでいなければ従来どおり全部ランダム。

/** Fisher-Yates（配列を破壊的にシャッフル）。 */
function shuffle<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param sel  いま選んでいるウマ（entrant index）
 * @param all  出走している全ウマの index
 * @param pick その馬券に必要な頭数（単勝1・馬連/ワイド2・3連単3…）
 * @param rng  0..1 の乱数
 */
export function fillPicks(sel: number[], all: number[], pick: number, rng: () => number): number[] {
  const chosen: number[] = [];
  for (const i of sel) {
    if (chosen.length >= pick) break;
    if (all.includes(i) && !chosen.includes(i)) chosen.push(i);
  }
  const need = pick - chosen.length;
  const rest = shuffle(all.filter((i) => !chosen.includes(i)), rng);
  // 選んだウマと、埋めたウマをまとめてから並びもシャッフルする。
  // こうすると3連単で「選んだウマが必ず1着」にならず、着順もランダムになる。
  return shuffle(chosen.concat(rest.slice(0, Math.max(0, need))), rng);
}
