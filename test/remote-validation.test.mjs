import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runSync } from '../lib/sync.js';
import { writeConfig } from '../lib/config.js';

test('runSync throws an error when a target references an unknown remote ID', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-gui-remote-test-'));
  const oldConfigPath = process.env.SYNC_GUI_CONFIG;
  const configPath = path.join(tempDir, 'config.json');
  process.env.SYNC_GUI_CONFIG = configPath;

  try {
    const dummyFile = path.join(tempDir, 'source.txt');
    await fs.writeFile(dummyFile, 'content', 'utf8');

    await writeConfig({
      remotes: [{ id: 'remote-1', name: 'Valid Remote', kind: 'local', root: tempDir }],
      projects: [],
      categories: [],
      items: [
        {
          id: 'item-1',
          name: 'Test Item',
          type: 'file',
          source: dummyFile,
          targets: [
            {
              name: 'Target 1',
              remoteIds: ['remote-nonexistent'],
              dest: path.join(tempDir, 'dest.txt'),
            }
          ]
        }
      ]
    });

    await assert.rejects(
      async () => {
        await runSync({ direction: 'up', itemTargets: { 'item-1': [0] } });
      },
      /references unknown remote "remote-nonexistent"/
    );
  } finally {
    if (oldConfigPath) {
      process.env.SYNC_GUI_CONFIG = oldConfigPath;
    } else {
      delete process.env.SYNC_GUI_CONFIG;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
