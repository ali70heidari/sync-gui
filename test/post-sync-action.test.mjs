import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runSync } from '../lib/sync.js';
import { writeConfig } from '../lib/config.js';

test('runSync executes post-upload command upon successful upload', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-gui-postsync-test-'));
  const oldConfigPath = process.env.SYNC_CONFIG;
  const configPath = path.join(tempDir, 'config.json');
  process.env.SYNC_CONFIG = configPath;
  process.env.SYNC_GUI_CONFIG = configPath;


  try {
    const dummyFile = path.join(tempDir, 'source.txt');
    const destFile = path.join(tempDir, 'dest.txt');
    const markerFile = path.join(tempDir, 'post-sync-executed.txt');
    await fs.writeFile(dummyFile, 'content', 'utf8');

    await writeConfig({
      remotes: [{ id: 'local-remote', name: 'Local', kind: 'local', root: tempDir }],
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
              remoteIds: ['local-remote'],
              dest: destFile,
              postSyncCommand: `echo "post-sync-success" > '${markerFile}'`
            }
          ]
        }
      ]
    });

    const result = await runSync({ direction: 'up', itemTargets: { 'item-1': [0] } });
    assert.equal(result.exitCode, 0);

    const markerExists = await fs.readFile(markerFile, 'utf8').then(s => s.trim()).catch(() => null);
    assert.equal(markerExists, 'post-sync-success');
    assert.match(result.output, /after successful upload/);
  } finally {
    if (oldConfigPath) {
      process.env.SYNC_CONFIG = oldConfigPath;
      process.env.SYNC_GUI_CONFIG = oldConfigPath;
    } else {
      delete process.env.SYNC_CONFIG;
      delete process.env.SYNC_GUI_CONFIG;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
