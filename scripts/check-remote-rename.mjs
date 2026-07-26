import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyRemoteRenameMigrations } from '../lib/config.js';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-gui-rename-'));
const oldRoot = path.join(tmp, 'server files', 'index files', 'old-server');
const oldFile = path.join(oldRoot, 'myapp_site_index.php');
const newFile = path.join(tmp, 'server files', 'index files', 'new-server', 'myapp_site_index.php');

await fs.mkdir(oldRoot, { recursive: true });
await fs.writeFile(oldFile, 'ok', 'utf8');

const previousConfig = {
  remotes: [{ id: 'r1', name: 'old-server', kind: 'ssh' }],
  projects: [{ id: 'p1', name: 'myapp', remoteId: 'r1' }],
  items: [{
    id: 'i1',
    name: 'Index',
    source: path.join(tmp, 'server files', 'index files', '{SERVER_NAME}', 'myapp_site_index.php'),
    type: 'file',
    projectId: 'p1',
    targets: [{ name: 'T', dest: '/x', remoteIds: ['r1'] }]
  }]
};

const nextConfig = {
  ...previousConfig,
  remotes: [{ id: 'r1', name: 'new-server', kind: 'ssh' }]
};

await applyRemoteRenameMigrations(previousConfig, nextConfig);

assert.equal(await fs.readFile(newFile, 'utf8'), 'ok');
await assert.rejects(() => fs.access(oldFile));

console.log('ok');
