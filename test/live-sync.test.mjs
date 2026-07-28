import assert from 'node:assert/strict';
import test from 'node:test';

import { LIVE_SYNC_MS, buildBulkTargetMap, buildItemTargetMap, pickDueLiveItem } from '../lib/live-sync.js';

test('buildItemTargetMap selects every upload target for a card', () => {
  assert.deepEqual(buildItemTargetMap({ id: 'a', targets: [{}, {}, {}] }), { a: [0, 1, 2] });
  assert.deepEqual(buildItemTargetMap({ id: 'a', targets: [{}] }, 'down'), { a: [0] });
});

test('buildBulkTargetMap selects only the cards supplied by the visible list', () => {
  const visible = [
    { id: 'project-a-1', targets: [{}, {}] },
    { id: 'project-a-2', targets: [{}] }
  ];

  assert.deepEqual(buildBulkTargetMap(visible, 'up'), {
    'project-a-1': [0, 1],
    'project-a-2': [0]
  });
  assert.deepEqual(buildBulkTargetMap(visible, 'down'), {
    'project-a-1': [0],
    'project-a-2': [0]
  });
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
