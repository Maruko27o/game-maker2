// おまかせ（自動で買い目を決める）の買い目づくり。
//
// 「このウマは絶対に入れたい、あとは任せる」を成立させる。パドックで選んでいる
// ウマは必ず残し、足りないぶんだけランダムに埋める。3連単は選んだ順がそのまま
// 着順になる（タップした順に①②③と表示されているので、その見た目どおり）。
// 何も選んでいなければ従来どおり全部ランダム。

/**
 * @param sel  いま選んでいるウマ（entrant index・タップ順）
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
  if (need <= 0) return chosen;

  const rest = all.filter((i) => !chosen.includes(i));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return chosen.concat(rest.slice(0, need));
}
