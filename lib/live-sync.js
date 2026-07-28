export const LIVE_SYNC_MS = 10000;

export function buildItemTargetMap(item, direction = 'up') {
  if (!item?.targets?.length) return {};
  return {
    [item.id]: direction === 'up' ? item.targets.map((_, index) => index) : [0]
  };
}

export function buildBulkTargetMap(items, direction = 'up') {
  return Object.assign({}, ...items.map(item => buildItemTargetMap(item, direction)));
}

export function pickDueLiveItem(items, liveIds, lastRunAt, now = Date.now()) {
  for (const item of items) {
    if (!liveIds.includes(item.id)) continue;
    if (!item.targets?.length) continue;
    if (now - (lastRunAt[item.id] || 0) >= LIVE_SYNC_MS) return item;
  }
  return null;
}
