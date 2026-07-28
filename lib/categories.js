export function visibleCategoryContents(categories, items, projectId, parentId = '') {
  return {
    categories: categories.filter(category =>
      category.projectId === projectId && (category.parentId || '') === parentId
    ),
    items: items.filter(item =>
      item.projectId === projectId && (item.categoryId || '') === parentId
    )
  };
}

export function categoryBreadcrumbs(categories, categoryId) {
  const byId = new Map(categories.map(category => [category.id, category]));
  const result = [];
  const seen = new Set();
  let current = byId.get(categoryId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    result.unshift(current);
    current = byId.get(current.parentId);
  }
  return result;
}

export function removeCategory(categories, items, categoryId) {
  const removed = categories.find(category => category.id === categoryId);
  if (!removed) return { categories, items };
  const parentId = removed.parentId || '';
  return {
    categories: categories
      .filter(category => category.id !== categoryId)
      .map(category => category.parentId === categoryId ? { ...category, parentId } : category),
    items: items.map(item => item.categoryId === categoryId ? { ...item, categoryId: parentId } : item)
  };
}
