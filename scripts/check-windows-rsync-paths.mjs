import assert from 'node:assert/strict';

function toMsysPath(value) {
  const raw = String(value).replace(/\\/g, '/');
  const rawMatch = raw.match(/^([A-Za-z]):\/(.*)$/);
  if (rawMatch) return `/${rawMatch[1].toLowerCase()}/${rawMatch[2]}`;
  return raw;
}

assert.equal(
  toMsysPath('C:\\Users\\hamid\\Documents\\Work Projects\\kasb\\backend\\admin'),
  '/c/Users/hamid/Documents/Work Projects/kasb/backend/admin'
);

console.log('ok');
