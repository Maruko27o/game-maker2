import { describe, it, expect } from 'vitest';
import { GALLERY_MAX, parseGallery, toggleItem, sameItem, ownedOnly, type GalleryItem } from './gallery';

// ギャラリー（飾り棚）。ここに入るのは見た目だけで、強さにも確率にもかかわらない。
//
// 見張りたいのは
//   ・外から来た値をそのまま信じないこと（セーブもランキングも中身が保証されない）
//   ・飾れる数を超えないこと
//   ・持っていないものが並ばないこと
// の3つ。

const FRAME: GalleryItem = { k: 'frame', frame: { kind: 'animal', animal: 'cat' } };
const MASTER: GalleryItem = { k: 'frame', frame: { kind: 'animalMaster', animal: 'cat' } };
const TITLE: GalleryItem = { k: 'title', id: 'rookie' };
const TROPHY: GalleryItem = { k: 'trophy', rank: 1 };
const BADGE: GalleryItem = { k: 'badge', id: 'badge_1st' };

describe('飾り棚の検証', () => {
  it('正しい形はそのまま通る（JSONを往復しても同じ）', () => {
    const all = [FRAME, MASTER, TITLE, TROPHY, BADGE];
    expect(parseGallery(JSON.parse(JSON.stringify(all)))).toEqual(all);
  });

  it('知らない形は黙って落とす（1件おかしいだけで棚ごと消さない）', () => {
    const mixed = [FRAME, { k: 'title', id: 'no_such_title' }, { k: 'trophy', rank: 9 }, { k: 'badge', id: 'nope' }, null, 3, TROPHY];
    expect(parseGallery(mixed)).toEqual([FRAME, TROPHY]);
  });

  it('配列でなければ空', () => {
    for (const bad of [undefined, null, 0, 'x', {}]) expect(parseGallery(bad)).toEqual([]);
  });

  it('同じものは1つだけ', () => {
    expect(parseGallery([TROPHY, TROPHY, TROPHY])).toEqual([TROPHY]);
  });

  it('飾れる数を超えて受け取らない', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ k: 'badge', id: 'badge_1st', n: i }));
    // 中身が同じなので重複が落ち、1件になる
    expect(parseGallery(many)).toHaveLength(1);
    const varied: unknown[] = [
      { k: 'trophy', rank: 1 }, { k: 'trophy', rank: 2 }, { k: 'trophy', rank: 3 },
      { k: 'badge', id: 'badge_1st' }, { k: 'badge', id: 'badge_2nd' }, { k: 'badge', id: 'badge_3rd' },
      { k: 'badge', id: 'badge_first_win' }, { k: 'badge', id: 'badge_streak3' },
      { k: 'badge', id: 'badge_all_course' }, { k: 'badge', id: 'badge_jump' },
    ];
    expect(parseGallery(varied)).toHaveLength(GALLERY_MAX);
  });

  it('動物ちがいのフレームは別物として扱う', () => {
    const cat: GalleryItem = { k: 'frame', frame: { kind: 'animal', animal: 'cat' } };
    const dog: GalleryItem = { k: 'frame', frame: { kind: 'animal', animal: 'dog' } };
    expect(sameItem(cat, dog)).toBe(false);
    expect(sameItem(cat, MASTER)).toBe(false); // 動物は同じでも種類がちがう
    expect(parseGallery([cat, dog])).toHaveLength(2);
  });
});

describe('飾る／はずす', () => {
  it('押すと入り、もう一度押すと出る', () => {
    const a = toggleItem([], TROPHY);
    expect(a).toEqual([TROPHY]);
    expect(toggleItem(a, TROPHY)).toEqual([]);
  });

  it('満杯のときは、押しても勝手に押し出さない', () => {
    const full: GalleryItem[] = [
      { k: 'trophy', rank: 1 }, { k: 'trophy', rank: 2 }, { k: 'trophy', rank: 3 },
      { k: 'badge', id: 'badge_1st' }, { k: 'badge', id: 'badge_2nd' }, { k: 'badge', id: 'badge_3rd' },
      { k: 'badge', id: 'badge_jump' }, { k: 'badge', id: 'badge_record' },
    ];
    expect(full).toHaveLength(GALLERY_MAX);
    expect(toggleItem(full, TITLE)).toEqual(full); // 増えない
    // 満杯でも「はずす」はできる
    expect(toggleItem(full, full[0])).toHaveLength(GALLERY_MAX - 1);
  });
});

describe('持っているものだけ並べる', () => {
  it('引退などで失ったものは、棚に残っていても出さない', () => {
    const owned = { frames: [], titles: ['rookie'], trophies: [] as (1 | 2 | 3)[], badges: [] };
    expect(ownedOnly([FRAME, TITLE, TROPHY, BADGE], owned)).toEqual([TITLE]);
  });

  it('持っているものはそのまま残る', () => {
    const owned = {
      frames: [{ kind: 'animal', animal: 'cat' } as const],
      titles: ['rookie'],
      trophies: [1] as (1 | 2 | 3)[],
      badges: ['badge_1st'],
    };
    expect(ownedOnly([FRAME, TITLE, TROPHY, BADGE], owned)).toHaveLength(4);
  });
});
