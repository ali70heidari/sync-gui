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

  const source2 = path.join(tmp, 'source-config');
  const destination2 = path.join(tmp, 'destination-config');
  await fsp.mkdir(source2, { recursive: true });
  await fsp.mkdir(destination2, { recursive: true });
  await fsp.writeFile(path.join(source2, 'keep.txt'), 'local keep');
  await fsp.writeFile(path.join(source2, 'local.log'), 'ignored local');
  await fsp.writeFile(path.join(destination2, 'remote.tmp'), 'ignored remote');
  await fsp.writeFile(configPath, JSON.stringify({
    remotes: [{ id: 'local', name: 'Local', kind: 'local' }],
    projects: [],
    items: [{
      id: 'project',
      name: 'Project',
      source: source2,
      type: 'folder',
      localSyncIgnore: '*.log',
      targets: [{ remoteIds: ['local'], dest: destination2, remoteSyncIgnore: '*.tmp' }]
    }]
  }));

  const upload = await runSync({ direction: 'up', itemTargets: { project: [0] } });
  assert.equal(upload.exitCode, 0, upload.output);
  await assert.rejects(fsp.access(path.join(destination2, 'local.log')));
  assert.equal(await fsp.readFile(path.join(destination2, 'keep.txt'), 'utf8'), 'local keep');

  await fsp.writeFile(path.join(destination2, 'download.txt'), 'remote keep');
  const configDownload = await runSync({ direction: 'down', itemTargets: { project: [0] } });
  assert.equal(configDownload.exitCode, 0, configDownload.output);
  await assert.rejects(fsp.access(path.join(source2, 'remote.tmp')));
  assert.equal(await fsp.readFile(path.join(source2, 'download.txt'), 'utf8'), 'remote keep');
});
