import assert from 'node:assert/strict';
import test from 'node:test';

import { categoryBreadcrumbs, removeCategory, visibleCategoryContents } from '../lib/categories.js';

const categories = [
  { id: 'a', name: 'A', projectId: 'p', parentId: '' },
  { id: 'b', name: 'B', projectId: 'p', parentId: 'a' },
  { id: 'other', name: 'Other', projectId: 'q', parentId: '' }
];
const items = [
  { id: 'root', projectId: 'p', categoryId: '' },
  { id: 'nested', projectId: 'p', categoryId: 'a' }
];

test('visibleCategoryContents returns only immediate cards in the open folder', () => {
  assert.deepEqual(visibleCategoryContents(categories, items, 'p', 'a'), {
    categories: [categories[1]],
    items: [items[1]]
  });
});

test('categoryBreadcrumbs builds the path to a nested category', () => {
  assert.deepEqual(categoryBreadcrumbs(categories, 'b').map(category => category.id), ['a', 'b']);
});

test('removing a category moves its direct contents to its parent', () => {
  const result = removeCategory(categories, items, 'a');
  assert.equal(result.categories.find(category => category.id === 'b').parentId, '');
  assert.equal(result.items.find(item => item.id === 'nested').categoryId, '');
});
