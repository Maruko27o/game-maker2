import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

beforeEach(() => {
  useStore.getState().resetAll();
});

describe('mailbox: frame delivery', () => {
  it('adds one mail per period+metric and never duplicates', () => {
    useStore.getState().receiveFrames([
      { period: '2026-06', rank: 1, metric: 'odds' },
      { period: '2026-06', rank: 2, metric: 'payout' },
    ]);
    expect(useStore.getState().mailbox?.length).toBe(2);
    // same awards again → deduped (id = frame-<period>-<metric>)
    useStore.getState().receiveFrames([{ period: '2026-06', rank: 1, metric: 'odds' }]);
    expect(useStore.getState().mailbox?.length).toBe(2);
    // a new month adds a new one
    useStore.getState().receiveFrames([{ period: '2026-07', rank: 3, metric: 'odds' }]);
    expect(useStore.getState().mailbox?.length).toBe(3);
  });

  it('markMailRead flips a single item; equip/unequip toggles the frame', () => {
    useStore.getState().receiveFrames([{ period: '2026-06', rank: 1, metric: 'odds' }]);
    const box = useStore.getState().mailbox!;
    expect(box[0].read).toBe(false);
    useStore.getState().markMailRead(box[0].id);
    expect(useStore.getState().mailbox![0].read).toBe(true);

    useStore.getState().equipFrame({ period: '2026-06', rank: 1, metric: 'odds' });
    expect(useStore.getState().equippedFrame).toEqual({ period: '2026-06', rank: 1, metric: 'odds' });
    useStore.getState().equipFrame(null);
    expect(useStore.getState().equippedFrame).toBeNull();
  });
});
