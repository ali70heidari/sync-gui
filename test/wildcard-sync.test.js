import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('local sync expands brace wildcard tokens into destination paths', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'sync-gui-wildcard-'));
  const projectRoot = path.join(tmp, 'project');
  const remoteRoot = path.join(tmp, 'remote');
  const configPath = path.join(tmp, 'sync-config.json');

  await fsp.mkdir(path.join(projectRoot, 'users', 'alice', 'hello'), { recursive: true });
  await fsp.mkdir(path.join(projectRoot, 'users', 'bob', 'hello'), { recursive: true });
  await fsp.writeFile(path.join(projectRoot, 'users', 'alice', 'hello', 'file.txt'), 'alice\n');
  await fsp.writeFile(path.join(projectRoot, 'users', 'bob', 'hello', 'file.txt'), 'bob\n');

  await fsp.writeFile(configPath, JSON.stringify({
    remotes: [
      { id: 'out-a', name: 'Output_A', kind: 'local' },
      { id: 'out-b', name: 'Output_B', kind: 'local' }
    ],
    projects: [{
      id: 'demo',
      name: 'Demo_Project',
      remoteId: 'out-a'
    }],
    items: [{
      id: 'hello',
      name: 'Hello',
      source: path.join(projectRoot, 'users', '{project}', 'hello', 'file.txt'),
      type: 'file',
      projectId: 'demo',
      targets: [
        { name: 'Outputs', remoteIds: ['out-a', 'out-b'], dest: path.join(remoteRoot, '{SERVER_NAME}', 'file_{project}.txt') }
      ]
    }]
  }), 'utf8');

  process.env.SYNC_CONFIG = configPath;
  const { runSync } = await import(`../lib/sync.js?case=${Date.now()}`);
  const result = await runSync({
    direction: 'up',
    itemTargets: { hello: [0] }
  });

  assert.equal(result.exitCode, 0, result.output);
  assert.equal(await fsp.readFile(path.join(remoteRoot, 'Output_A', 'file_alice.txt'), 'utf8'), 'alice\n');
  assert.equal(await fsp.readFile(path.join(remoteRoot, 'Output_A', 'file_bob.txt'), 'utf8'), 'bob\n');
  assert.equal(await fsp.readFile(path.join(remoteRoot, 'Output_B', 'file_alice.txt'), 'utf8'), 'alice\n');
  assert.equal(await fsp.readFile(path.join(remoteRoot, 'Output_B', 'file_bob.txt'), 'utf8'), 'bob\n');
});
