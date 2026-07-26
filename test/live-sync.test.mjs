import assert from 'node:assert/strict';
import test from 'node:test';

import { LIVE_SYNC_MS, buildItemTargetMap, pickDueLiveItem } from '../lib/live-sync.js';

test('buildItemTargetMap selects every upload target for a card', () => {
  assert.deepEqual(buildItemTargetMap({ id: 'a', targets: [{}, {}, {}] }), { a: [0, 1, 2] });
  assert.deepEqual(buildItemTargetMap({ id: 'a', targets: [{}] }, 'down'), { a: [0] });
});

test('pickDueLiveItem skips cards until their 10-second window has passed', () => {
  const items = [
    { id: 'a', targets: [{}] },
    { id: 'b', targets: [{}] }
  ];
  const liveIds = ['a', 'b'];
  const now = 50_000;

  assert.equal(pickDueLiveItem(items, liveIds, { a: now - LIVE_SYNC_MS + 1, b: now - LIVE_SYNC_MS - 1 }, now)?.id, 'b');
  assert.equal(pickDueLiveItem(items, liveIds, { a: now, b: now }, now), null);
});
