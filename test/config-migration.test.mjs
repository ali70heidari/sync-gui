import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('readConfig recovers categories referenced by existing items', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-gui-config-'));
  process.env.SYNC_CONFIG = path.join(dir, 'sync-config.json');
  await fs.writeFile(process.env.SYNC_CONFIG, JSON.stringify({
    remotes: [],
    projects: [],
    categories: [],
    items: [{ id: 'i', name: 'Item', projectId: '', categoryId: 'server-123' }]
  }));

  const { readConfig } = await import(`../lib/config.js?recover=${Date.now()}`);
  const config = await readConfig();

  assert.deepEqual(config.categories, [{
    id: 'server-123',
    name: 'server',
    projectId: '',
    parentId: ''
  }]);
});
