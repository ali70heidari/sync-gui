import assert from 'node:assert/strict';
import test from 'node:test';

test('terminal key mapping sends DEL for Backspace', async () => {
  const { terminalKeyInput } = await import(`../lib/terminal-keys.js?keys=${Date.now()}`);

  assert.equal(terminalKeyInput({ key: 'Backspace' }), '\x7f');
  assert.equal(terminalKeyInput({ key: 'Tab' }), '\t');
  assert.equal(terminalKeyInput({ key: 'Enter' }), '\n');
});
