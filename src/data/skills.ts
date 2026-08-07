// 固有スキル図鑑（個体値厳選アップデート）。1頭につき1つ持つ。
//
// レア度は星1〜5。出現比は 5:4:3:2:1（星1が一番出やすく、星5が一番レア）。
// まず星の段を比で抽選し、その段の中から等確率で1つ選ぶ。
//
// ★重要★ 効果（effect の文言）はこの時点では「予定」であり、レースの挙動・倍率には
// 一切つながっていない。シムへの接続は最後のPRでまとめて行い、そこで倍率バランスの
// 回帰テスト（oddsBaseline）と突き合わせて調整する。

export type SkillStar = 1 | 2 | 3 | 4 | 5;

export type Skill = {
  id: string;
  name: string;
  star: SkillStar;
  effect: string; // 図鑑に出す説明（＝将来の効果の予定）
};

/** 星ごとの出現比（星1:星2:星3:星4:星5 = 5:4:3:2:1）。 */
export const STAR_WEIGHTS: Record<SkillStar, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

export const SKILLS: Skill[] = [
  // ---- 星1（よく出る・ささやかな効果） ----
  { id: 'straight_run', name: 'まっすぐ走り', star: 1, effect: '直線でほんの少しだけ速くなる' },
  { id: 'morning_pep', name: '朝型', star: 1, effect: 'レース序盤にほんの少し元気が出る' },
  { id: 'brave_gate', name: '物おじしない', star: 1, effect: 'ゲートで出遅れにくい' },
  { id: 'friendly', name: '人なつっこい', star: 1, effect: '気分が下がりにくい' },
  { id: 'tight_turn', name: '小回り', star: 1, effect: 'コーナーで少し内に寄れる' },
  { id: 'rain_ear', name: '垂れ耳', star: 1, effect: '雨の日に少しだけ強い' },
  { id: 'easy_going', name: 'のんびり屋', star: 1, effect: '終盤までスタミナを少し節約する' },
  { id: 'big_eater', name: '食いしんぼう', star: 1, effect: 'レースのあとの回復が速い' },
  { id: 'side_by_side', name: '足音', star: 1, effect: '並ばれたときに少し粘る' },
  { id: 'early_bird', name: '早起き', star: 1, effect: '短いレースで少しだけ強い' },
  { id: 'sand_lover', name: 'すなずき', star: 1, effect: 'ダートのコースで少しだけ強い' },
  { id: 'grass_lover', name: '草かんむり', star: 1, effect: '芝のコースで少しだけ強い' },

  // ---- 星2 ----
  { id: 'start_dash', name: 'スタートダッシュ', star: 2, effect: 'ゲートを出た直後の加速が上がる' },
  { id: 'sticky_legs', name: '粘り腰', star: 2, effect: '終盤の失速を抑える' },
  { id: 'inner_gate', name: '内ラチ好き', star: 2, effect: '内枠のときに伸びる' },
  { id: 'outer_gate', name: '外回り', star: 2, effect: '外枠のときに伸びる' },
  { id: 'uphill', name: '坂道', star: 2, effect: '上り坂で強い' },
  { id: 'downhill', name: '下り坂', star: 2, effect: '下り坂で伸びる' },
  { id: 'muddy', name: '泥んこ', star: 2, effect: '荒れた馬場に強い' },
  { id: 'my_pace', name: 'マイペース', star: 2, effect: '前後のウマに乱されにくい' },
  { id: 'deep_breath', name: '深呼吸', star: 2, effect: 'スタミナの消費を抑える' },
  { id: 'slipstream', name: '風よけ', star: 2, effect: '前のウマの後ろで脚をためられる' },

  // ---- 星3 ----
  { id: 'cornering', name: 'コーナリング', star: 3, effect: 'コーナーでも加速を落とさない' },
  { id: 'last_spurt', name: '差し切り', star: 3, effect: '直線で末脚がぐんと伸びる' },
  { id: 'front_hold', name: '逃げ切り', star: 3, effect: '先頭に立つと粘り強くなる' },
  { id: 'guts_lump', name: '根性の塊', star: 3, effect: '残り200mで踏ん張れる' },
  { id: 'race_read', name: '読みの深さ', star: 3, effect: '位置取りがうまくなる' },
  { id: 'supple', name: 'しなやかさ', star: 3, effect: 'どんな馬場でも安定して走れる' },
  { id: 'solo_lead', name: '断トツ', star: 3, effect: 'ひとりで先頭に立つと加速する' },
  { id: 'closer_pro', name: '追い込み職人', star: 3, effect: '最後方から一気に伸びる' },

  // ---- 星4（レア） ----
  { id: 'burst', name: '瞬発', star: 4, effect: '仕掛けた瞬間の加速がするどい' },
  { id: 'ironwall', name: '鉄壁', star: 4, effect: '囲まれても走りが崩れない' },
  { id: 'stayer_king', name: '長距離王', star: 4, effect: '長いコースで無類の強さ' },
  { id: 'sprint_king', name: '短距離王', star: 4, effect: '短いコースで無類の強さ' },
  { id: 'clutch', name: '勝負師', star: 4, effect: '接戦になるほど強くなる' },
  { id: 'endless', name: '無限スタミナ', star: 4, effect: 'スタミナがほとんど減らない' },

  // ---- 星5（超レア） ----
  { id: 'sky_legs', name: '天かける脚', star: 5, effect: '直線でとんでもなく伸びる' },
  { id: 'unbroken', name: '不屈の魂', star: 5, effect: 'どんな不利も跳ね返す' },
  { id: 'lightning', name: '電光石火', star: 5, effect: 'スタートから一気に先頭へ' },
  { id: 'thousand_wind', name: '千里の風', star: 5, effect: 'すべての力が少しずつ底上げされる' },
];

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** 星の段ごとにまとめた図鑑用のリスト（星5→星1の順）。 */
export const SKILLS_BY_STAR: { star: SkillStar; skills: Skill[] }[] = ([5, 4, 3, 2, 1] as SkillStar[]).map(
  (star) => ({ star, skills: SKILLS.filter((s) => s.star === star) }),
);

/** その星の段が出る確率（0..1）。図鑑に「出やすさ」を出すために使う。 */
export function starChance(star: SkillStar): number {
  const total = Object.values(STAR_WEIGHTS).reduce((a, b) => a + b, 0);
  return STAR_WEIGHTS[star] / total;
}
