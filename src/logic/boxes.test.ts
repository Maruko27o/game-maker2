import { describe, it, expect } from 'vitest';
import { openBox, stackBox, takeBox, boxCount, tallyBoxResults } from './boxes';
import {
  BOXES,
  BOX_KINDS,
  dropTable,
  boxOfDow,
  boxMailId,
  FLASH_STEPS,
  FLASH_MS,
  RARITY_FX,
} from '../data/boxes';
import type { BoxRarity } from '../data/boxes';
import { mulberry32 } from './stats';
import type { MailItem } from '../types';

describe('週末のボックス', () => {
  it('曜日と箱の対応（土＝ラッキー／日＝ゴールド／平日は無し）', () => {
    expect(boxOfDow(6)).toBe('lucky');
    expect(boxOfDow(0)).toBe('gold');
    for (const d of [1, 2, 3, 4, 5]) expect(boxOfDow(d)).toBeNull();
  });

  it('土と日で中身のジャンルが違う（混同しないため）', () => {
    // 土＝育成系：コイン以外がちゃんと入っている
    const lucky = new Set(BOXES.lucky.slots.map((s) => s.reward.type));
    expect(lucky.has('item')).toBe(true);
    expect(lucky.has('ticket')).toBe(true);
    expect(lucky.has('dye')).toBe(true);
    // 日＝お金系：ぜんぶコイン
    expect(BOXES.gold.slots.every((s) => s.reward.type === 'coins')).toBe(true);
  });

  it('排出率の合計はぴったり100%（i ボタンの表と実際がずれない）', () => {
    for (const k of BOX_KINDS) {
      const sum = dropTable(BOXES[k]).reduce((n, r) => n + r.pct, 0);
      expect(sum).toBeCloseTo(100, 9);
    }
  });

  it('限定枠の確率どおりに出る（フレーム 0.1%・称号 0.3%）', () => {
    // 当たりの回数はポアソン分布なので、割合そのものではなく回数を ±4σ で見る。
    const trials = 400_000;
    for (const kind of BOX_KINDS) {
      expect(BOXES[kind].frameRate).toBe(0.001);
      expect(BOXES[kind].titleRate).toBe(0.003);
      const rng = mulberry32(12345);
      let frames = 0;
      let titles = 0;
      for (let i = 0; i < trials; i++) {
        const t = openBox(kind, rng, { frame: false, title: false }).reward.type;
        if (t === 'frame') frames++;
        if (t === 'title') titles++;
      }
      for (const [hits, rate] of [[frames, BOXES[kind].frameRate], [titles, BOXES[kind].titleRate]] as const) {
        const mu = trials * rate;
        const band = 4 * Math.sqrt(mu);
        expect(hits).toBeGreaterThan(mu - band);
        expect(hits).toBeLessThan(mu + band);
      }
    }
  });

  it('もう持っている限定枠は二度と出ない（一度きりの約束）', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 200_000; i++) {
      const t = openBox('lucky', rng, { frame: true, title: true }).reward.type;
      expect(t).not.toBe('frame');
      expect(t).not.toBe('title');
    }
  });

  it('フレームを持っていても称号はちゃんと出る（片方だけ取得ずみ）', () => {
    const rng = mulberry32(555);
    let titles = 0;
    for (let i = 0; i < 200_000; i++) {
      if (openBox('gold', rng, { frame: true, title: false }).reward.type === 'title') titles++;
    }
    const mu = 200_000 * 0.003; // 称号はどちらの箱も 0.3%
    expect(titles).toBeGreaterThan(mu - 4 * Math.sqrt(mu));
    expect(titles).toBeLessThan(mu + 4 * Math.sqrt(mu));
  });

  it('ゴールドボックスは 500 〜 100,000 コインの6段', () => {
    const amounts = BOXES.gold.slots.map((s) => (s.reward.type === 'coins' ? s.reward.amount : 0));
    expect(amounts).toEqual([500, 1_000, 2_500, 10_000, 25_000, 100_000]);
    // 段は必ず上がっていく（並べ替えを間違えると i ボタンの表が変になる）
    for (let i = 1; i < amounts.length; i++) expect(amounts[i]).toBeGreaterThan(amounts[i - 1]);
  });

  it('100,000コインの1%は残っている（夢のある一撃は消さない）', () => {
    const rows = dropTable(BOXES.gold);
    const pct = (label: string) => rows.find((r) => r.label === label)!.pct;
    // 限定枠(0.4%)を除いたぶんが配られるので、ぴったり1%ではなく 0.996% になる
    expect(pct('コイン 100,000')).toBeCloseTo(1, 1);
    expect(pct('コイン 25,000')).toBeCloseTo(1, 1);
    expect(pct('コイン 10,000')).toBeCloseTo(3, 1);
  });

  it('ゴールドボックス1箱あたりの平均は 2,000 コイン強', () => {
    // 出しすぎないことの歯止め。
    //
    // 平均 3,730 だったころは、10個開ければ約37,000コイン。対戦の優勝賞金 12,000 を
    // ボックス3個ぶんで超えてしまい、勝ち抜きトーナメントを戦う意味が薄かった。
    // 100,000の1%（平均への寄与1,000）は残したまま、下の段だけ絞ってある。
    const total = BOXES.gold.slots.reduce((n, s) => n + s.weight, 0);
    const avg = BOXES.gold.slots.reduce(
      (n, s) => n + (s.reward.type === 'coins' ? s.reward.amount : 0) * (s.weight / total),
      0,
    );
    expect(avg).toBeGreaterThan(2_000);
    expect(avg).toBeLessThan(2_600);
    // 対戦の優勝賞金(12,000)を超えるには、ボックスが5個以上いる
    expect(avg * 5).toBeLessThan(12_000);
  });

  it('必ず何かが当たる（空っぽで返らない）', () => {
    const rng = mulberry32(7);
    for (const k of BOX_KINDS) {
      for (let i = 0; i < 5000; i++) {
        const r = openBox(k, rng, { frame: false, title: false });
        expect(r.reward).toBeTruthy();
        expect(r.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('同じ箱は行が増えず個数だけ増える（×2 → ×4）', () => {
    let box: MailItem[] = [];
    for (let i = 1; i <= 4; i++) {
      box = stackBox(box, 'lucky', 1000 + i);
      expect(box.filter((m) => m.kind === 'box').length).toBe(1);
      expect(boxCount(box, 'lucky')).toBe(i);
    }
    // 増えたら未読になっていちばん手前に出る
    expect(box[0].id).toBe(boxMailId('lucky'));
    expect(box[0].read).toBe(false);
  });

  it('土と日の箱は別の行としてたまる（中身が違うので混ざらない）', () => {
    let box: MailItem[] = [];
    box = stackBox(box, 'lucky', 1);
    box = stackBox(box, 'gold', 2);
    box = stackBox(box, 'lucky', 3);
    expect(box.filter((m) => m.kind === 'box').length).toBe(2);
    expect(boxCount(box, 'lucky')).toBe(2);
    expect(boxCount(box, 'gold')).toBe(1);
  });

  it('ほかのメールを押しのけない（フレームやお知らせは残る）', () => {
    const notice: MailItem = { id: 'n1', at: 0, read: true, kind: 'notice', title: 'お知らせ' };
    const box = stackBox(stackBox([notice], 'lucky', 1), 'lucky', 2);
    expect(box.find((m) => m.id === 'n1')).toEqual(notice);
  });

  it('開けると1つ減り、0になったら行ごと消える', () => {
    let box = stackBox(stackBox([], 'gold', 1), 'gold', 2);
    box = takeBox(box, 'gold')!;
    expect(boxCount(box, 'gold')).toBe(1);
    box = takeBox(box, 'gold')!;
    expect(boxCount(box, 'gold')).toBe(0);
    expect(box.some((m) => m.kind === 'box')).toBe(false);
    // 持っていない箱は開けられない
    expect(takeBox(box, 'gold')).toBeNull();
    expect(takeBox([], 'lucky')).toBeNull();
  });

  it('表に載っている中身は、実際にちゃんと出てくる', () => {
    for (const k of BOX_KINDS) {
      const rng = mulberry32(4242);
      const seen = new Set<string>();
      for (let i = 0; i < 200_000; i++) seen.add(openBox(k, rng, { frame: true, title: true }).label);
      for (const s of BOXES[k].slots) expect(seen.has(s.label)).toBe(true);
    }
  });
});

describe('開封演出（段階的に光る）', () => {
  const ORDER: BoxRarity[] = ['normal', 'rare', 'epic', 'legend'];

  it('レアリティの段だけ光る（グレー1回／青は2回／紫は3回／金は4回）', () => {
    expect(FLASH_STEPS.normal).toEqual(['normal']);
    expect(FLASH_STEPS.rare).toEqual(['normal', 'rare']);
    expect(FLASH_STEPS.epic).toEqual(['normal', 'rare', 'epic']);
    expect(FLASH_STEPS.legend).toEqual(['normal', 'rare', 'epic', 'legend']);
  });

  it('どの段も「下から順に上がって、そのレアリティで止まる」', () => {
    for (let i = 0; i < ORDER.length; i++) {
      const steps = FLASH_STEPS[ORDER[i]];
      expect(steps.length).toBe(i + 1); // 段数＝レアリティの高さ
      expect(steps).toEqual(ORDER.slice(0, i + 1)); // 飛ばさず順に上がる
      expect(steps[steps.length - 1]).toBe(ORDER[i]); // 最後は自分の色
    }
  });

  it('段が上がるほど溜めが長い（期待を引っぱる）', () => {
    for (let i = 1; i < ORDER.length; i++) {
      expect(FLASH_MS[ORDER[i]]).toBeGreaterThan(FLASH_MS[ORDER[i - 1]]);
    }
    // 金でも4段合わせて4秒は超えない（毎回見るものなので長すぎない）
    const longest = FLASH_STEPS.legend.reduce((n, r) => n + FLASH_MS[r], 0);
    expect(longest).toBeLessThan(4000);
  });

  it('どの段にも色が用意されている（var() が欠けて演出が消えない）', () => {
    for (const r of ORDER) {
      expect(RARITY_FX[r].glow).toMatch(/^#[0-9a-f]{6}$/i);
      expect(RARITY_FX[r].ring).toMatch(/^#[0-9a-f]{6}$/i);
      expect(RARITY_FX[r].label.length).toBeGreaterThan(0);
      expect(FLASH_MS[r]).toBeGreaterThan(0);
    }
  });
});

describe('まとめて開ける', () => {
  it('同じ中身は1行にまとまり、合計が合う', () => {
    const t = tallyBoxResults([
      { kind: 'gold', rarity: 'normal', label: 'コイン 5,000', reward: { type: 'coins', amount: 5000 } },
      { kind: 'gold', rarity: 'normal', label: 'コイン 5,000', reward: { type: 'coins', amount: 5000 } },
      { kind: 'gold', rarity: 'epic', label: 'コイン 100,000', reward: { type: 'coins', amount: 100000 } },
    ]);
    expect(t.rows).toEqual([
      { label: 'コイン 5,000', rarity: 'normal', count: 2 },
      { label: 'コイン 100,000', rarity: 'epic', count: 1 },
    ]);
    expect(t.coins).toBe(110_000);
    expect(t.best?.rarity).toBe('epic'); // 溜め演出はいちばんレアなものに合わせる
  });

  it('育成アイテム・チケット・染料もそれぞれ数える', () => {
    const t = tallyBoxResults([
      { kind: 'lucky', rarity: 'normal', label: '育成アイテム ×1', reward: { type: 'item', stat: 'any', amount: 1 } },
      { kind: 'lucky', rarity: 'rare', label: '育成アイテム ×3', reward: { type: 'item', stat: 'any', amount: 3 } },
      { kind: 'lucky', rarity: 'rare', label: '厳選チケット ×1', reward: { type: 'ticket', amount: 1 } },
      { kind: 'lucky', rarity: 'normal', label: '染料 ×1', reward: { type: 'dye' } },
      { kind: 'lucky', rarity: 'legend', label: '限定フレーム', reward: { type: 'frame' } },
    ]);
    expect(t.items).toBe(4);
    expect(t.tickets).toBe(1);
    expect(t.dyes).toBe(1);
    expect(t.frame).toBe(true);
    expect(t.title).toBe(false);
    expect(t.best?.rarity).toBe('legend');
  });

  it('並びは出た順のまま（レア順に並べ替えない）', () => {
    const t = tallyBoxResults([
      { kind: 'gold', rarity: 'epic', label: 'B', reward: { type: 'coins', amount: 1 } },
      { kind: 'gold', rarity: 'normal', label: 'A', reward: { type: 'coins', amount: 1 } },
    ]);
    expect(t.rows.map((r) => r.label)).toEqual(['B', 'A']);
  });

  it('空なら何も無い', () => {
    const t = tallyBoxResults([]);
    expect(t.rows).toEqual([]);
    expect(t.best).toBeNull();
    expect(t.coins).toBe(0);
  });
});
