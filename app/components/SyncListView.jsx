'use client';
import { useState, useEffect, useRef } from 'react';
import EditorModal from './EditorModal';
import ConfirmModal from './ConfirmModal';
import TargetPicker from './TargetPicker';
import { toast } from './Toast';
import { buildBulkTargetMap, buildItemTargetMap, pickDueLiveItem } from '../../lib/live-sync';
import { categoryBreadcrumbs, removeCategory, visibleCategoryContents } from '../../lib/categories';

const PAGE_SIZE = 30;
const LS_KEY = 'sync-gui-settings';

function blankItem() {
  return { id: '', name: '', source: '', type: 'folder', projectId: '', categoryId: '', targets: [{ name: '', remoteIds: [], dest: '', variables: {} }] };
}

function resolveProject(id, projects) { return projects.find(p => p.id === id); }
function parseVariablesInput(value) {
  const variables = {};
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const nextValue = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    variables[key] = nextValue;
  }
  return variables;
}

function formatVariablesInput(variables) {
  return Object.entries(variables || {}).map(([key, value]) => `${key}=${value}`).join('\n');
}

function describeJob(job, items) {
  const names = (job.itemIds || [])
    .map(id => items.find(item => item.id === id)?.name)
    .filter(Boolean);
  if (!names.length) return `${job.itemIds?.length || 0} item(s)`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

export default function SyncListView({ config, onRefresh }) {
  const { items = [], projects = [], categories = [], remotes = [] } = config;
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('ready');
  const [history, setHistory] = useState([]);
  const [syncingIds, setSyncingIds] = useState([]);
  const [syncTargetPicker, setSyncTargetPicker] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [liveItemIds, setLiveItemIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}').liveItemIds || [];
  });

  const pollRef = useRef(null);
  const mountedRef = useRef(true);
  const liveLastRunRef = useRef({});

  const [dryRun, setDryRun] = useState(() => {
    if (typeof window === 'undefined') return false;
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}').dryRun || false;
  });
  const [noDelete, setNoDelete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}').noDelete || false;
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ dryRun, noDelete, liveItemIds }));
  }, [dryRun, noDelete, liveItemIds]);
  useEffect(() => {
    loadHistory();
    const id = setInterval(loadHistory, 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!liveItemIds.length) return;
    const id = setInterval(() => {
      if (!mountedRef.current || pollRef.current || status === 'running') return;
      const nextItem = pickDueLiveItem(items, liveItemIds, liveLastRunRef.current);
      if (!nextItem) return;
      // ponytail: live mode runs one card at a time to avoid overlapping jobs in the single-job UI; upgrade path is per-job tracking.
      doSync([nextItem.id], 'up', buildItemTargetMap(nextItem, 'up'), { liveItemId: nextItem.id });
    }, 1000);
    return () => clearInterval(id);
  }, [items, liveItemIds, status, dryRun, noDelete]);

  async function loadHistory() {
    const r = await fetch('/api/history');
    if (r.ok) setHistory((await r.json()).history || []);
  }

  async function clearHistory() {
    try {
      const r = await fetch('/api/history', { method: 'DELETE' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not clear history.');
      setHistory(data.history || []);
      setConfirmClearHistory(false);
      toast('History cleared.');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function saveConfig(nextItems, nextCategories = categories) {
    const r = await fetch('/api/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { remotes, projects, categories: nextCategories, items: nextItems } })
    });
    if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
    onRefresh();
  }

  function openNew() {
    setEditing({
      ...blankItem(),
      projectId: activeCategoryId
        ? categories.find(category => category.id === activeCategoryId)?.projectId || projectFilter
        : projectFilter,
      categoryId: activeCategoryId,
      targets: [{ name: '', remoteIds: [], dest: '', variables: {}, variablesText: '' }]
    });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditing({
      ...item,
      targets: (item.targets || []).map(t => ({
        ...t,
        remoteIds: t.remoteIds?.length ? t.remoteIds : [t.remoteId].filter(Boolean),
        variables: t.variables || {},
        variablesText: formatVariablesInput(t.variables || {})
      }))
    });
    setShowForm(true);
  }

  function save() {
    if (!editing.name) { toast('Name is required.', 'error'); return; }
    if (!editing.source) { toast('Source path is required.', 'error'); return; }
    const validTargets = (editing.targets || [])
      .filter(t => t.dest && (t.remoteIds?.length || t.remoteId))
      .map(t => ({
        name: t.name || '',
        dest: t.dest,
        remoteIds: t.remoteIds?.length ? t.remoteIds : [t.remoteId].filter(Boolean),
        variables: parseVariablesInput(t.variablesText || '')
      }));
    if (!validTargets.length) { toast('At least one target with a destination path and remote is required.', 'error'); return; }
    const idx = items.findIndex(i => i.id === editing.id);
    const next = [...items];
    if (!editing.id) editing.id = editing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
    const saved = { ...editing, targets: validTargets };
    if (idx >= 0) next[idx] = saved;
    else next.push(saved);
    saveConfig(next).then(() => { setShowForm(false); toast('Item saved.'); }).catch(e => toast(e.message, 'error'));
  }

  function removeItem(id) { setConfirmDelete(items.find(i => i.id === id)); }
  async function doRemove() {
    try { await saveConfig(items.filter(i => i.id !== confirmDelete.id)); setConfirmDelete(null); toast('Item deleted.'); }
    catch (e) { toast(e.message, 'error'); }
  }

  function openNewCategory() {
    const projectId = activeCategoryId
      ? categories.find(category => category.id === activeCategoryId)?.projectId
      : projectFilter;
    if (!projectId) {
      toast('Select a project before adding a category.', 'error');
      return;
    }
    setEditingCategory({ id: '', name: '', projectId, parentId: activeCategoryId });
  }

  function openEditCategory(category) {
    setEditingCategory({ ...category });
  }

  async function saveCategory() {
    if (!editingCategory.name.trim()) return toast('Category name is required.', 'error');
    const next = [...categories];
    const index = next.findIndex(category => category.id === editingCategory.id);
    const saved = {
      ...editingCategory,
      name: editingCategory.name.trim(),
      id: editingCategory.id || `category-${Date.now().toString(36)}`
    };
    if (index >= 0) next[index] = saved;
    else next.push(saved);
    try {
      await saveConfig(items, next);
      setEditingCategory(null);
      toast('Category saved.');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function doRemoveCategory() {
    const next = removeCategory(categories, items, confirmDeleteCategory.id);
    try {
      await saveConfig(next.items, next.categories);
      if (activeCategoryId === confirmDeleteCategory.id) setActiveCategoryId(confirmDeleteCategory.parentId || '');
      setConfirmDeleteCategory(null);
      toast('Category removed; its contents were moved up one level.');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function doSync(itemIds, direction, targetMap = {}, options = {}) {
    const { liveItemId = null } = options;
    setStatus('running');
    setSyncingIds(itemIds);
    if (liveItemId) liveLastRunRef.current[liveItemId] = Date.now();
    const label = direction === 'up' ? 'up' : 'down';
    setOutput(`> syncing ${itemIds.length} item(s) ${label}${liveItemId ? ' [live]' : ''}\n`);
    fetch('/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun, noDelete, direction, itemTargets: targetMap })
    }).then(r => r.json()).then(data => {
      if (data.error) {
        setOutput(o => o + (data.error || 'Failed') + '\n');
        setStatus('failed');
        setSyncingIds([]);
        return;
      }
      setOutput(o => o + `Job #${data.id} started.\n`);
      pollJob(data.id);
    });
  }

  function handleSingleSync(item, direction, targetIndices) {
    setSyncTargetPicker(null);
    doSync([item.id], direction, { [item.id]: targetIndices });
  }

  function handleSyncAll(direction) {
    const targets = buildBulkTargetMap(paged, direction);
    const ids = Object.keys(targets);
    if (!ids.length) { toast('No visible items with targets to sync.', 'error'); return; }
    doSync(ids, direction, targets);
  }

  function toggleLiveSync(itemId) {
    setLiveItemIds(current => current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId]
    );
  }

  function pollJob(id) {
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        clearInterval(pollRef.current);
        return;
      }
      const r = await fetch(`/api/run?id=${id}`);
      if (!r.ok) return;
      const job = await r.json();
      if (job.status !== 'running') {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setOutput(job.output || '');
        setStatus(job.status === 'succeeded' ? 'done' : 'failed');
        setSyncingIds([]);
        loadHistory();
        if (job.status === 'succeeded') toast('Sync completed.');
        else toast('Sync failed.', 'error');
      }
    }, 1000);
  }

  function toggleTargetRemote(targetIndex, remoteId, checked) {
    const ts = [...editing.targets];
    const current = new Set(ts[targetIndex].remoteIds?.length ? ts[targetIndex].remoteIds : [ts[targetIndex].remoteId].filter(Boolean));
    if (checked) current.add(remoteId);
    else current.delete(remoteId);
    ts[targetIndex] = { ...ts[targetIndex], remoteIds: [...current] };
    delete ts[targetIndex].remoteId;
    setEditing({ ...editing, targets: ts });
  }

  const q = search.toLowerCase();
  const activeCategory = categories.find(category => category.id === activeCategoryId);
  const visibleProjectId = activeCategory?.projectId || projectFilter;
  const contents = visibleProjectId
    ? visibleCategoryContents(categories, items, visibleProjectId, activeCategoryId)
    : {
        categories: categories.filter(category => !(category.parentId || '')),
        items: items.filter(item => !(item.categoryId || ''))
      };
  const visibleCategories = contents.categories.filter(category =>
    !q || category.name.toLowerCase().includes(q)
  );
  const visibleItems = contents.items.filter(item =>
    (!q || item.name.toLowerCase().includes(q) || item.source.toLowerCase().includes(q))
    && (!projectFilter || item.projectId === projectFilter)
  );
  const cards = [
    ...visibleCategories.map(category => ({ kind: 'category', value: category })),
    ...visibleItems.map(item => ({ kind: 'item', value: item }))
  ];
  const totalPages = Math.ceil(cards.length / PAGE_SIZE) || 1;
  const pagedCards = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const paged = pagedCards.filter(card => card.kind === 'item').map(card => card.value);
  const breadcrumbs = categoryBreadcrumbs(categories, activeCategoryId);

  return (
    <div className="stage">
      <div className="stage-title">
        <h2>Sync Items</h2>
        <div className="stage-actions">
          <label className="search-box">
            <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </label>
          {projects.length > 0 && (
            <select
              className="filter-select"
              aria-label="Filter projects"
              value={projectFilter}
              onChange={e => { setProjectFilter(e.target.value); setActiveCategoryId(''); setPage(0); }}
            >
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="toggles">
            <label><input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} /> Dry-run</label>
            <label><input type="checkbox" checked={noDelete} onChange={e => setNoDelete(e.target.checked)} /> No-delete</label>
          </div>
          <span className={`status ${status}`}>
            {status === 'running' ? `${syncingIds.length} running` : status}
          </span>
          {items.length > 0 && (
            <>
              <button className="primary" onClick={() => handleSyncAll('up')}>Sync All Up</button>
              <button className="primary" onClick={() => handleSyncAll('down')} style={{ marginLeft: 4 }}>Sync All Down</button>
            </>
          )}
          <button className="primary" onClick={openNewCategory}>+ Category</button>
          <button className="primary" onClick={openNew}>+ Add</button>
        </div>
      </div>

      {status === 'running' && <div className="progress-bar"><div className="progress-fill" /></div>}

      {(projectFilter || activeCategoryId) && (
        <nav className="category-breadcrumbs" aria-label="Category path">
          <button onClick={() => { setActiveCategoryId(''); setPage(0); }}>
            {projects.find(project => project.id === visibleProjectId)?.name || 'Root'}
          </button>
          {breadcrumbs.map(category => (
            <span key={category.id}>
              <span aria-hidden="true">/</span>
              <button onClick={() => { setActiveCategoryId(category.id); setPage(0); }}>{category.name}</button>
            </span>
          ))}
        </nav>
      )}

      {items.length === 0 && categories.length === 0 ? (
        <div className="empty-state" style={{ padding: 48, fontSize: 15 }}>
          No categories or sync items yet.
          <br /><button className="primary" onClick={openNew} style={{ marginTop: 16 }}>+ Add sync item</button>
        </div>
      ) : pagedCards.length === 0 ? (
        <p className="empty-state">No cards match this view.</p>
      ) : (
        <div className="item-list">
          {pagedCards.map(card => {
            if (card.kind === 'category') {
              const category = card.value;
              const childCount = categories.filter(child => child.parentId === category.id).length;
              const itemCount = items.filter(item => item.categoryId === category.id).length;
              return (
                <div
                  key={`category-${category.id}`}
                  className="item-card category-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setProjectFilter(category.projectId); setActiveCategoryId(category.id); setPage(0); }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setProjectFilter(category.projectId);
                      setActiveCategoryId(category.id);
                      setPage(0);
                    }
                  }}
                >
                  <div className="item-head">
                    <span className="type-icon" aria-hidden="true">📁</span>
                    <span className="item-name">{category.name}</span>
                    <div className="item-actions">
                      <button className="card-btn card-btn-edit" onClick={event => { event.stopPropagation(); openEditCategory(category); }} title="Edit" aria-label="Edit category">⚙</button>
                      <button className="card-btn card-btn-del" onClick={event => { event.stopPropagation(); setConfirmDeleteCategory(category); }} title="Delete" aria-label="Delete category">×</button>
                    </div>
                  </div>
                  <div className="category-summary">
                    {childCount} folder(s) · {itemCount} sync item(s)
                  </div>
                </div>
              );
            }
            const item = card.value;
            const project = resolveProject(item.projectId, projects);
            const liveEnabled = liveItemIds.includes(item.id);
            return (
              <div key={item.id} className={`item-card ${item.type}`}>
                <div className="item-head">
                  <span className="type-icon" aria-hidden="true">{item.type === 'folder' ? '📁' : '📄'}</span>
                  <span className="item-name">{item.name}</span>
                  <div className="item-actions">
                    <button className="card-btn card-btn-edit" onClick={() => openEdit(item)} title="Edit" aria-label="Edit">⚙</button>
                    <button className="card-btn card-btn-del" onClick={() => removeItem(item.id)} title="Delete" aria-label="Delete">✕</button>
                  </div>
                </div>
                <div className="item-footer">
                  <div className="item-meta">
                    <span className="group-tag">{project?.name || 'No project'}</span>
                  </div>
                  <div className="item-actions-bottom">
                    <button className="btn-up" onClick={() => setSyncTargetPicker({ item, direction: 'up' })} title="Sync up" aria-label="Sync up">↑</button>
                    <button className="btn-down" onClick={() => setSyncTargetPicker({ item, direction: 'down' })} title="Sync down" aria-label="Sync down">↓</button>
                    <button
                      className={`live-icon ${liveEnabled ? 'active' : ''}`}
                      onClick={() => toggleLiveSync(item.id)}
                      title={liveEnabled ? 'Disable live sync (10s)' : 'Enable live sync (10s)'}
                      aria-label={liveEnabled ? 'Disable live sync (10s)' : 'Enable live sync (10s)'}
                    >
                      L
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {(output || status !== 'ready') && (
        <div className="console-panel" style={{ marginTop: 16 }}>
          <div className="console-head">
            <span>Output</span>
            <button onClick={() => setOutput('')}>Clear</button>
          </div>
          <pre>{output || 'Ready to sync.'}</pre>
        </div>
      )}

      {history.length > 0 && (
        <div className="side-panel" style={{ marginTop: 16 }}>
          <div className="side-panel-head">
            <span className="tab active">Recent Jobs</span>
            <button className="history-clear" onClick={() => setConfirmClearHistory(true)}>Clear history</button>
          </div>
          {history.slice(0, 15).map(j => (
            <div key={j.id} className={`history-item-mini ${j.status}`} onClick={() => { setOutput(j.output || ''); setStatus(j.status === 'succeeded' ? 'done' : 'failed'); }}>
              <span className={`status-dot ${j.status}`} />
              <span className="h-direction">{j.direction}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{describeJob(j, items)}</span>
              <span className="h-time">{new Date(j.startedAt).toLocaleTimeString()}</span>
              <span className={`h-status ${j.status}`}>{j.status}</span>
            </div>
          ))}
        </div>
      )}

      {syncTargetPicker && (
        <TargetPicker
          item={syncTargetPicker.item}
          remotes={remotes}
          direction={syncTargetPicker.direction}
          onStart={ti => handleSingleSync(syncTargetPicker.item, syncTargetPicker.direction, ti)}
          onClose={() => setSyncTargetPicker(null)}
        />
      )}

      {showForm && (
        <EditorModal title={editing.id ? 'Edit Sync Item' : 'New Sync Item'} onClose={() => setShowForm(false)} onSave={save}>
          <div className="form">
            <label>Name <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Static assets" /></label>
            <label>Source path (local) <input value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })} placeholder="/home/user/project/dist" /></label>
            <label>Type
              <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>
                <option value="folder">Folder</option>
                <option value="file">File</option>
              </select>
            </label>
            <label>Project (optional)
              <select value={editing.projectId} onChange={e => setEditing({ ...editing, projectId: e.target.value, categoryId: '' })}>
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Category (optional)
              <select value={editing.categoryId || ''} onChange={e => setEditing({ ...editing, categoryId: e.target.value })}>
                <option value="">Project root</option>
                {categories
                  .filter(category => category.projectId === editing.projectId)
                  .map(category => {
                    const depth = categoryBreadcrumbs(categories, category.id).length - 1;
                    return <option key={category.id} value={category.id}>{'— '.repeat(depth)}{category.name}</option>;
                  })}
              </select>
            </label>
            <div className="form-section">Targets</div>
            {(editing.targets || []).map((t, i) => (
              <div key={i} className="target-row">
                <div className="target-row-fields">
                  <input className="target-name" value={t.name || ''} onChange={e => { const ts = [...editing.targets]; ts[i] = { ...ts[i], name: e.target.value }; setEditing({ ...editing, targets: ts }); }} placeholder="Label (optional)" />
                  <div className="target-remotes">
                    {remotes.map(r => {
                      const selected = (t.remoteIds?.length ? t.remoteIds : [t.remoteId].filter(Boolean)).includes(r.id);
                      return (
                        <label key={r.id}>
                          <input type="checkbox" checked={selected} onChange={e => toggleTargetRemote(i, r.id, e.target.checked)} />
                          {r.name} ({r.kind})
                        </label>
                      );
                    })}
                  </div>
                  <input className="target-dest" value={t.dest} onChange={e => { const ts = [...editing.targets]; ts[i] = { ...ts[i], dest: e.target.value }; setEditing({ ...editing, targets: ts }); }} placeholder="/remote/path" />
                  <textarea
                    className="target-vars"
                    value={t.variablesText || ''}
                    onChange={e => { const ts = [...editing.targets]; ts[i] = { ...ts[i], variablesText: e.target.value }; setEditing({ ...editing, targets: ts }); }}
                    placeholder={'project=kasb\ndomain=files_program'}
                    rows={3}
                  />
                </div>
                <button type="button" className="target-remove" onClick={() => { const ts = editing.targets.filter((_, j) => j !== i); setEditing({ ...editing, targets: ts }); }} disabled={editing.targets.length <= 1}>&times;</button>
              </div>
            ))}
            <button type="button" className="target-add" onClick={() => setEditing({ ...editing, targets: [...(editing.targets || []), { name: '', remoteIds: [], dest: '', variables: {}, variablesText: '' }] })}>+ Add target</button>
          </div>
        </EditorModal>
      )}

      {confirmDelete && (
        <ConfirmModal title="Delete Sync Item" message={`Delete "${confirmDelete.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={doRemove} onCancel={() => setConfirmDelete(null)} />
      )}

      {editingCategory && (
        <EditorModal title={editingCategory.id ? 'Edit Category' : 'New Category'} onClose={() => setEditingCategory(null)} onSave={saveCategory}>
          <div className="form">
            <label>Name
              <input value={editingCategory.name} onChange={event => setEditingCategory({ ...editingCategory, name: event.target.value })} placeholder="Category name" />
            </label>
          </div>
        </EditorModal>
      )}

      {confirmDeleteCategory && (
        <ConfirmModal
          title="Remove Category"
          message={`Remove "${confirmDeleteCategory.name}"? Its sync items and subcategories will be moved up one level.`}
          confirmLabel="Remove"
          onConfirm={doRemoveCategory}
          onCancel={() => setConfirmDeleteCategory(null)}
        />
      )}

      {confirmClearHistory && (
        <ConfirmModal title="Clear Job History" message="Clear all completed jobs from history?" confirmLabel="Clear history" onConfirm={clearHistory} onCancel={() => setConfirmClearHistory(false)} />
      )}
    </div>
  );
}
