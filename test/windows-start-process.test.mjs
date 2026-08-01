import assert from 'node:assert/strict';
import test from 'node:test';

test('Windows launcher exits outside the Start-Process invocation', async () => {
  const { windowsStartProcessScript } = await import(`../lib/sync.js?launcher=${Date.now()}`);
  const script = windowsStartProcessScript();

  assert.match(script, /-RedirectStandardError \$env:SYNC_GUI_STDERR ; exit \$p\.ExitCode$/);
});
