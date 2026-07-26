import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('local sync expands brace wildcard tokens into destination paths', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'sync-gui-wildcard-'));
  const projectRoot = path.join(tmp, 'project');
  const remoteRoot = path.join(tmp, 'remote');
  const configPath = path.join(tmp, 'sync-projects.json');

  await fsp.mkdir(path.join(projectRoot, 'users', 'alice', 'hello'), { recursive: true });
  await fsp.mkdir(path.join(projectRoot, 'users', 'bob', 'hello'), { recursive: true });
  await fsp.writeFile(path.join(projectRoot, 'users', 'alice', 'hello', 'file.txt'), 'alice\n');
  await fsp.writeFile(path.join(projectRoot, 'users', 'bob', 'hello', 'file.txt'), 'bob\n');

  await fsp.writeFile(configPath, JSON.stringify({
    projects: [{
      id: 'demo',
      root: projectRoot,
      remotes: [{
        id: 'out',
        categories: [{
          id: 'files',
          categories: [],
          mappings: [{
            id: 'hello',
            type: 'file',
            local: 'users/{name}/hello/file.txt',
            remote: 'file_{name}.txt'
          }]
        }]
      }],
      streams: [],
      syncTargets: []
    }],
    remotes: [{ id: 'out', kind: 'local', root: remoteRoot }]
  }), 'utf8');

  process.env.SYNC_GUI_CONFIG = configPath;
  const { runSync } = await import(`../lib/sync.js?case=${Date.now()}`);
  const result = await runSync({
    direction: 'up',
    targetIds: ['demo/out/files/hello']
  });

  assert.equal(result.exitCode, 0, result.output);
  assert.equal(await fsp.readFile(path.join(remoteRoot, 'file_alice.txt'), 'utf8'), 'alice\n');
  assert.equal(await fsp.readFile(path.join(remoteRoot, 'file_bob.txt'), 'utf8'), 'bob\n');
});
