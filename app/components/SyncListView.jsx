'use client';
import { useState, useEffect, useRef } from 'react';
import EditorModal from './EditorModal';
import ConfirmModal from './ConfirmModal';
import TargetPicker from './TargetPicker';
import { toast } from './Toast';

const PAGE_SIZE = 30;
const LS_KEY = 'sync-gui-settings';

function blankItem() {
  return { id: '', name: '', source: '', type: 'folder', projectId: '', targets: [{ name: '', remoteIds: [], dest: '', variables: {} }] };
}

function resolveProject(id, projects) { return projects.find(p => p.id === id); }
function resolveRemote(id, remotes) { return remotes.find(r => r.id === id); }
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

export default function SyncListView({ config, onRefresh }) {
  const { items = [], projects = [], remotes = [] } = config;
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('ready');
  const [history, setHistory] = useState([]);
  const [syncingIds, setSyncingIds] = useState([]);
  const [syncTargetPicker, setSyncTargetPicker] = useState(null);

  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const [dryRun, setDryRun] = useState(() => {
    if (typeof window === 'undefined') return false;
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}').dryRun || false;
  });
  const [noDelete, setNoDelete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}').noDelete || false;
  });

  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify({ dryRun, noDelete })); }, [dryRun, noDelete]);
  useEffect(() => { loadHistory(); const id = setInterval(loadHistory, 5000); return () => clearInterval(id); }, []);
  useEffect(() => { return () => { mountedRef.current = false; if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  async function loadHistory() {
    const r = await fetch('/api/history');
    if (r.ok) setHistory((await r.json()).history || []);
  }

  async function saveConfig(nextItems) {
    const r = await fetch('/api/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { remotes, projects, items: nextItems } })
    });
    if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
    onRefresh();
  }

  function openNew() { setEditing(blankItem()); setShowForm(true); }
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
    if (!editing.projectId) { toast('Select a project.', 'error'); return; }
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

  function doSync(itemIds, direction, targetMap = {}) {
    setStatus('running'); setSyncingIds(itemIds);
    const label = direction === 'up' ? '↑' : '↓';
    setOutput(`> syncing ${itemIds.length} item(s) ${label}\n`);
    fetch('/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun, noDelete, direction, itemTargets: targetMap })
    }).then(r => r.json()).then(data => {
      if (data.error) { setOutput(o => o + (data.error || 'Failed') + '\n'); setStatus('failed'); setSyncingIds([]); return; }
      setOutput(o => o + `Job #${data.id} started.\n`);
      pollJob(data.id);
    });
  }

  function handleSingleSync(item, direction, targetIndices) {
    setSyncTargetPicker(null);
    doSync([item.id], direction, { [item.id]: targetIndices });
  }

  function handleSyncAll(direction) {
    const targets = {};
    for (const item of items) {
      if (!item.targets?.length) continue;
      if (direction === 'up') {
        targets[item.id] = item.targets.map((_, i) => i);
      } else {
        targets[item.id] = [0];
      }
    }
    const ids = Object.keys(targets);
    if (!ids.length) { toast('No items with targets to sync.', 'error'); return; }
    doSync(ids, direction, targets);
  }

  function pollJob(id) {
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) { clearInterval(pollRef.current); return; }
      const r = await fetch(`/api/run?id=${id}`);
      if (!r.ok) return;
      const job = await r.json();
      if (job.status !== 'running') {
        clearInterval(pollRef.current);
        setOutput(job.output || '');
        setStatus(job.status === 'succeeded' ? 'done' : 'failed');
        setSyncingIds([]); loadHistory();
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
  const filtered = items.filter(i => {
    if (q && !i.name.toLowerCase().includes(q) && !i.source.toLowerCase().includes(q)) return false;
    if (projectFilter && i.projectId !== projectFilter) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="stage">
      <div className="stage-title">
        <h2>Sync Items</h2>
        <div className="stage-actions">
          <label className="search-box">
            <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </label>
          {projects.length > 0 && (
            <select className="filter-select" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(0); }}>
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
          {items.length > 0 && <>
            <button className="primary" onClick={() => handleSyncAll('up')}>Sync All ↑</button>
            <button className="primary" onClick={() => handleSyncAll('down')} style={{ marginLeft: 4 }}>Sync All ↓</button>
          </>}
          <button className="primary" onClick={openNew}>+ New</button>
        </div>
      </div>

      {status === 'running' && <div className="progress-bar"><div className="progress-fill" /></div>}

      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: 48, fontSize: 15 }}>
          No sync items yet.
          <br /><button className="primary" onClick={openNew} style={{ marginTop: 16 }}>+ Create your first sync</button>
        </div>
      ) : paged.length === 0 ? (
        <p className="empty-state">No items match your search.</p>
      ) : (
        <div className="item-list">
          {paged.map(item => {
            const project = resolveProject(item.projectId, projects);
            return (
            <div key={item.id} className={`item-card ${item.type}`}>
              <div className="item-head">
                <span className="type-icon">{item.type === 'folder' ? '📁' : '📄'}</span>
                <span className="item-name">{item.name}</span>
                <div className="item-actions">
                  <button className="btn-up" onClick={() => setSyncTargetPicker({ item, direction: 'up' })} title="Sync up" aria-label="Sync up">↑</button>
                  <button className="btn-down" onClick={() => setSyncTargetPicker({ item, direction: 'down' })} title="Sync down" aria-label="Sync down">↓</button>
                  <button className="card-btn card-btn-edit" onClick={() => openEdit(item)} aria-label="Edit">⚙</button>
                  <button className="card-btn card-btn-del" onClick={() => removeItem(item.id)} aria-label="Delete">✕</button>
                </div>
              </div>
              <div className="item-meta">
                <span className="group-tag">{project?.name || '?'}</span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next →</button>
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
          </div>
          {history.slice(0, 15).map(j => (
            <div key={j.id} className={`history-item-mini ${j.status}`} onClick={() => { setOutput(j.output || ''); setStatus(j.status === 'succeeded' ? 'done' : 'failed'); }}>
              <span className={`status-dot ${j.status}`} />
              <span className="h-direction">{j.direction === 'up' ? '↑' : '↓'}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{j.itemIds.length} item(s)</span>
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
            <label>Project
              <select value={editing.projectId} onChange={e => setEditing({ ...editing, projectId: e.target.value })}>
                <option value="">— Select —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
    </div>
  );
}
