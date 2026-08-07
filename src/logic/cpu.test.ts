import { describe, it, expect } from 'vitest';
import { cpuName, makeCpu } from './cpu';
import { mulberry32 } from './stats';

// 同じレースに同じ名前の COM が並ぶと、実況（「3番◯◯」）も順位パネルも
// どちらのウマの話か分からなくなる。名前は 14×12＝168通りしかないので、
// 18頭立てだと放っておくと半分以上のレースでぶつかる。

describe('COM の名前', () => {
  it('同じレースに同じ名前が出ない（18頭立て×400レース）', () => {
    let collided = 0;
    for (let seed = 0; seed < 400; seed++) {
      const rng = mulberry32(seed);
      const taken = new Set<string>();
      const names = Array.from({ length: 18 }, () => cpuName(rng, taken));
      if (new Set(names).size !== names.length) collided++;
    }
    expect(collided).toBe(0);
  });

  it('プレイヤーのウマとも重ならない（taken に先に入れておける）', () => {
    const rng = mulberry32(1234);
    const taken = new Set<string>(['カゼマル']);
    for (let i = 0; i < 2000; i++) expect(cpuName(rng, taken)).not.toBe('カゼマル');
  });

  it('makeCpu も taken を通して重複を避ける', () => {
    const rng = mulberry32(77);
    const taken = new Set<string>();
    const names = Array.from({ length: 18 }, (_, i) =>
      makeCpu(`c${i}`, rng, [40, 46], 0.3, undefined, undefined, taken).entrant.name,
    );
    expect(new Set(names).size).toBe(18);
    // 見た目に渡す名前と出走表の名前は必ず同じ（順位パネルとレース画面がずれない）
    const rng2 = mulberry32(77);
    const t2 = new Set<string>();
    for (let i = 0; i < 18; i++) {
      const c = makeCpu(`c${i}`, rng2, [40, 46], 0.3, undefined, undefined, t2);
      expect(c.look.name).toBe(c.entrant.name);
    }
  });

  it('taken を渡さないときは前と同じ名前が出る（乱数の並びを変えない）', () => {
    const a = mulberry32(9);
    const b = mulberry32(9);
    for (let i = 0; i < 50; i++) expect(cpuName(a)).toBe(cpuName(b, undefined));
  });

  it('名前を指定したときは抽選しない（グランプリの持ち上がりなど）', () => {
    const rng = mulberry32(5);
    const c = makeCpu('x', rng, [40, 46], 0, 'きめうち');
    expect(c.entrant.name).toBe('きめうち');
    expect(c.look.name).toBe('きめうち');
  });
});
