import { describe, it, expect } from 'vitest';
import { migrate, MAX_HORSES } from './store';
import { TEAM_SIZE } from './data/coins';

// チーム編成（個体値厳選アップデートの土台）の migrate 回帰テスト。
// この段階では team はデータとして持つだけで、表示・挙動・牧場収入には一切影響しない。
// 目的：既存セーブが「所持ウマ全員がチームに入る」形で欠損なく移行されること。
function horse(id: string) {
  return { id, name: id, parts: {}, stats: {}, style: 'nige' } as unknown;
}
function baseSave(extra: Record<string, unknown> = {}) {
  return {
    version: 6,
    owned: { body_bay: 1 },
    horses: [horse('h1'), horse('h2'), horse('h3')],
    savedAt: 123,
    ...extra,
  };
}

describe('migrate: チーム編成 team の移行', () => {
  it('既存セーブ（team なし）は所持ウマ全員をチームにする', () => {
    const res = migrate(baseSave());
    expect(res).not.toBeNull();
    expect(res!.data.team).toEqual(['h1', 'h2', 'h3']);
  });

  it('保存済み team を維持する（順序も保つ）', () => {
    const res = migrate(baseSave({ team: ['h2', 'h1'] }));
    expect(res!.data.team).toEqual(['h2', 'h1']);
  });

  it('実在しないID・非文字列は team から除外する', () => {
    const res = migrate(baseSave({ team: ['h1', 'ghost', 42, null, 'h3'] }));
    expect(res!.data.team).toEqual(['h1', 'h3']);
  });

  it('所持ウマが居ない新規相当セーブでは team は空', () => {
    const res = migrate(baseSave({ horses: [] }));
    expect(res!.data.team).toEqual([]);
  });

  it('team は TEAM_SIZE を超えない', () => {
    const many = Array.from({ length: 9 }, (_, i) => horse(`h${i}`));
    const res = migrate(baseSave({ horses: many }));
    expect(res!.data.team!.length).toBeLessThanOrEqual(TEAM_SIZE);
  });
});

describe('migrate: 所持上限を全プレイヤー30に開放', () => {
  it('旧セーブの maxHorses(6 など) に関わらず MAX_HORSES に引き上げる', () => {
    expect(MAX_HORSES).toBe(30);
    expect(migrate(baseSave({ maxHorses: 6 }))!.data.maxHorses).toBe(30);
    expect(migrate(baseSave({ maxHorses: 15 }))!.data.maxHorses).toBe(30);
    expect(migrate(baseSave())!.data.maxHorses).toBe(30); // 欠損でも30
  });
});

describe('migrate: 既存ウマにも固有スキルを付与（置いていかれない）', () => {
  it('スキル未設定の既存ウマにスキルが入り、IDから決まる固定値になる', () => {
    const res = migrate(baseSave());
    const hs = res!.data.horses;
    expect(hs).toHaveLength(3);
    for (const h of hs) expect(h.skill).toBeTruthy();
    // 同じセーブを2回移行しても同じスキル（クラウド突合でブレない）
    const again = migrate(baseSave());
    expect(again!.data.horses.map((h) => h.skill)).toEqual(hs.map((h) => h.skill));
  });

  it('すでにスキルを持つウマは上書きしない（厳選の結果を壊さない）', () => {
    const hs = [{ ...(horse('h1') as object), skill: 'sky_legs' }];
    const res = migrate(baseSave({ horses: hs }));
    expect(res!.data.horses[0].skill).toBe('sky_legs');
  });
});
