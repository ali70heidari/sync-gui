import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('.syncignore excludes matches and preserves ignored destination files', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'sync-gui-ignore-'));
  const source = path.join(tmp, 'source');
  const destination = path.join(tmp, 'destination');
  const configPath = path.join(tmp, 'sync-config.json');

  await fsp.mkdir(path.join(source, 'node_modules'), { recursive: true });
  await fsp.mkdir(path.join(source, 'src'), { recursive: true });
  await fsp.mkdir(path.join(destination, 'node_modules'), { recursive: true });
  await fsp.writeFile(path.join(source, '.syncignore'), 'node_modules/\n*.log\n');
  await fsp.writeFile(path.join(source, 'node_modules', 'new.js'), 'ignored');
  await fsp.writeFile(path.join(source, 'node_modules', 'existing.js'), 'local-preserved');
  await fsp.writeFile(path.join(source, 'src', 'app.js'), 'copied');
  await fsp.writeFile(path.join(source, 'debug.log'), 'ignored');
  await fsp.writeFile(path.join(destination, 'node_modules', 'existing.js'), 'preserved');
  await fsp.writeFile(configPath, JSON.stringify({
    remotes: [{ id: 'local', name: 'Local', kind: 'local' }],
    projects: [],
    items: [{
      id: 'project',
      name: 'Project',
      source,
      type: 'folder',
      targets: [{ remoteIds: ['local'], dest: destination }]
    }]
  }));

  process.env.SYNC_CONFIG = configPath;
  const { runSync } = await import(`../lib/sync.js?syncignore=${Date.now()}`);
  const result = await runSync({ direction: 'up', itemTargets: { project: [0] } });

  assert.equal(result.exitCode, 0, result.output);
  assert.equal(await fsp.readFile(path.join(destination, 'src', 'app.js'), 'utf8'), 'copied');
  assert.equal(await fsp.readFile(path.join(destination, 'node_modules', 'existing.js'), 'utf8'), 'preserved');
  await assert.rejects(fsp.access(path.join(destination, 'node_modules', 'new.js')));
  await assert.rejects(fsp.access(path.join(destination, 'debug.log')));
  await assert.rejects(fsp.access(path.join(destination, '.syncignore')));

  await fsp.writeFile(path.join(destination, 'src', 'app.js'), 'downloaded');
  await fsp.writeFile(path.join(destination, 'node_modules', 'existing.js'), 'must not overwrite');
  const download = await runSync({ direction: 'down', itemTargets: { project: [0] } });

  assert.equal(download.exitCode, 0, download.output);
  assert.equal(await fsp.readFile(path.join(source, 'src', 'app.js'), 'utf8'), 'downloaded');
  assert.equal(await fsp.readFile(path.join(source, 'node_modules', 'existing.js'), 'utf8'), 'local-preserved');
  assert.equal(await fsp.readFile(path.join(source, '.syncignore'), 'utf8'), 'node_modules/\n*.log\n');
});
