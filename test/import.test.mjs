import assert from 'node:assert/strict';
import test from 'node:test';

import { applyImport } from '../lib/import.js';

test('imports new entries and remaps their relationships', () => {
  const existing = { remotes: [], projects: [], items: [] };
  const imported = {
    remotes: [{ id: 'remote-export', name: 'Server' }],
    projects: [{ id: 'project-export', name: 'Site', remoteId: 'remote-export' }],
    items: [{ id: 'item-export', name: 'Assets', projectId: 'project-export' }],
  };

  const result = applyImport(existing, imported, {
    remotes: { Server: { action: 'replace' } },
    projects: { Site: { action: 'replace' } },
    items: { 'Assets@Site': { action: 'replace' } },
  });

  assert.equal(result.remotes.length, 1);
  assert.equal(result.projects[0].remoteId, result.remotes[0].id);
  assert.equal(result.items[0].projectId, result.projects[0].id);
});
