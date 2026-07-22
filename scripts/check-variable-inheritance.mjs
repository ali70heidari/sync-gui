import assert from 'node:assert/strict';
import { flattenMappings } from '../lib/config.js';

const rows = flattenMappings({
  remotes: [{ id: 'remote', label: 'Remote', kind: 'local', root: 'C:\\tmp' }],
  projects: [{
    id: 'project',
    label: 'Project',
    root: 'C:\\tmp',
    remotes: [{
      id: 'remote',
      categories: [{
        id: 'grandparent',
        variables: { account: 'root', project: 'old' },
        mappings: [],
        categories: [{
          id: 'parent',
          variables: { project: 'new' },
          mappings: [{
            id: 'mapping',
            label: 'Mapping',
            type: 'dir',
            local: './backend',
            remote: './backend',
            variables: { module: 'backend' }
          }],
          categories: []
        }]
      }]
    }],
    streams: [],
    syncTargets: []
  }]
});

assert.equal(rows.length, 1);
assert.deepEqual(rows[0].mapping.variables, {
  account: 'root',
  project: 'new',
  module: 'backend'
});
console.log('variable inheritance check passed');
