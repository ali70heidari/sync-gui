import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';

const db = await getDb();
const parentId = 'check-parent-template';
const childId = 'check-child-template';

await deleteTemplateRows();
await db.template.create({
  data: {
    id: parentId,
    name: 'Check parent template',
    relativePath: '',
    relativeRemotePath: '',
    variableKeys: '[]'
  }
});
await db.template.create({
  data: {
    id: childId,
    name: 'Check child template',
    parentTemplateId: parentId,
    relativePath: '',
    relativeRemotePath: '',
    variableKeys: '[]'
  }
});

const child = await db.template.findUnique({ where: { id: childId } });
assert.equal(child?.parentTemplateId, parentId);

await deleteTemplateRows();
await db.$disconnect();
console.log('template parent check passed');

async function deleteTemplateRows() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.template.deleteMany({ where: { id: childId } });
      await db.template.deleteMany({ where: { id: parentId } });
      return;
    } catch (error) {
      if (!String(error.message).includes('timed out') && !String(error.message).includes('locked')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
