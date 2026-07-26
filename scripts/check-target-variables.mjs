import assert from 'node:assert/strict';

function applyKnownPathTokens(pattern, values) {
  return pattern.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (token, name) => (
    values[name] === undefined ? token : values[name]
  ));
}

function targetTokenValues(remote, target) {
  return {
    ...(target.variables || {}),
    SERVER_NAME: remote.name || target.name || remote.id || target.remoteId || ''
  };
}

const remote = { id: 'kasb', name: 'kasb' };
const target = {
  name: 'Kasb fixed path',
  dest: '/absolute/fixed/path/index.php',
  variables: { project: 'kasb', domain: 'files_program' }
};

const resolved = applyKnownPathTokens(
  'C:\\server files\\index files\\{SERVER_NAME}\\{project}_{domain}_index.php',
  targetTokenValues(remote, target)
);

assert.equal(
  resolved,
  'C:\\server files\\index files\\kasb\\kasb_files_program_index.php'
);

console.log('ok');
