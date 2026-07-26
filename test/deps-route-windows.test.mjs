import test from 'node:test';
import assert from 'node:assert/strict';

function commandExists(command, locationOutput) {
  return locationOutput.split(/\r?\n/).some((line) => {
    const normalized = line.trim().replace(/\\/g, '/').toLowerCase();
    return normalized.endsWith(`/${command.toLowerCase()}`) || normalized.endsWith(`/${command.toLowerCase()}.exe`);
  });
}

test('Windows dependency parsing matches command names instead of full paths', () => {
  const out = [
    'C:\\msys64\\usr\\bin\\bash.exe',
    'C:\\msys64\\usr\\bin\\rsync.exe',
    'C:\\msys64\\usr\\bin\\sshpass.exe',
    'C:\\Windows\\System32\\OpenSSH\\ssh.exe',
  ].join('\r\n');

  assert.equal(commandExists('bash', out), true);
  assert.equal(commandExists('rsync', out), true);
  assert.equal(commandExists('sshpass', out), true);
  assert.equal(commandExists('ssh', out), true);
  assert.equal(commandExists('scp', out), false);
});
