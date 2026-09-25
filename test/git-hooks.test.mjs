import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { getPostCommitHook, setPostCommitHook } from '../lib/git-hooks.js';

const execFileAsync = promisify(execFile);

test('git hook installs and checks branch restriction', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-gui-git-test-'));
  try {
    await execFileAsync('git', ['init', tempDir]);
    await execFileAsync('git', ['-C', tempDir, 'config', 'user.email', 'test@example.com']);
    await execFileAsync('git', ['-C', tempDir, 'config', 'user.name', 'Test']);

    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'hello', 'utf8');

    const item = { id: 'item-1', source: testFile };
    const installResult = await setPostCommitHook(item, 'install');
    assert.equal(installResult.installed, true);

    const hookFile = path.join(tempDir, '.git', 'hooks', 'post-commit');
    const contents = await fs.readFile(hookFile, 'utf8');
    assert.match(contents, /branch=\$\(git branch --show-current\)/);
    assert.match(contents, /"\$branch" = main/);
    assert.match(contents, /"\$branch" = master/);

    const status = await getPostCommitHook(item);
    assert.equal(status.installed, true);

    const removeResult = await setPostCommitHook(item, 'remove');
    assert.equal(removeResult.installed, false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
