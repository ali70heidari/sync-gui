'use client';
import { useState, useEffect, useRef } from 'react';
import { ArrowsLeftRight, FolderOpen, ComputerTower, Upload, Download, TerminalWindow } from '@phosphor-icons/react';
import SyncListView from './components/SyncListView';
import ProjectsView from './components/ProjectsView';
import RemotesView from './components/RemotesView';
import HealthCheck from './components/HealthCheck';
import ToastContainer from './components/Toast';
import ImportModal from './components/ImportModal';
import TerminalPanel from './components/TerminalPanel';

export default function Page() {
  const [tab, setTab] = useState('items');
  const [config, setConfig] = useState({ remotes: [], projects: [], categories: [], items: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [terminalRemote, setTerminalRemote] = useState(null);
  const [terminalPickerOpen, setTerminalPickerOpen] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    const r = await fetch('/api/config');
    if (r.ok) setConfig((await r.json()).config);
  }

  function refresh() { loadConfig(); setRefreshKey(k => k + 1); }
  function goItems() { setTab('items'); refresh(); }

  async function handleExport() {
    const r = await fetch('/api/export');
    if (!r.ok) return;
    const { config } = await r.json();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sync-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleImportPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const r = await fetch('/api/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'analyze', data }),
        });
        if (!r.ok) return;
        const analysis = await r.json();
        analysis._importData = data;
        setImportAnalysis(analysis);
      } catch { }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleImportApply(resolutions) {
    const data = importAnalysis._importData;
    const r = await fetch('/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apply', data, resolutions }),
    });
    setImportAnalysis(null);
    if (r.ok) refresh();
  }

  function openTerminalLauncher() {
    const remotes = config.remotes || [];
    if (remotes.length === 1) {
      setTerminalRemote(remotes[0]);
      setTerminalPickerOpen(false);
      return;
    }
    setTerminalPickerOpen(open => !open);
  }

  function openTerminalRemote(remote) {
    setTerminalRemote(remote);
    setTerminalPickerOpen(false);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-icon">
            <ArrowsLeftRight size={18} weight="bold" />
          </div>
          <div>
            <h1>Sync GUI</h1>
            <p className="subtitle">File synchronization</p>
          </div>
        </div>
        <div className="top-actions">
          <button className={`topbar-tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
            <ArrowsLeftRight size={14} /> Sync Items
          </button>
          <button className={`topbar-tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
            <FolderOpen size={14} /> Projects
          </button>
          <button className={`topbar-tab ${tab === 'remotes' ? 'active' : ''}`} onClick={() => setTab('remotes')}>
            <ComputerTower size={14} /> Remotes
          </button>
          <div className="topbar-divider" />
          <button className="topbar-btn" onClick={handleExport}>
            <Upload size={13} /> Export
          </button>
          <button className="topbar-btn" onClick={() => fileInput.current?.click()}>
            <Download size={13} /> Import
          </button>
          <input ref={fileInput} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportPick} />
        </div>
      </header>
      <main>
        <HealthCheck />
        {tab === 'items' && <SyncListView config={config} onRefresh={refresh} />}
        {tab === 'projects' && <ProjectsView key={'pv' + refreshKey} config={config} onBack={goItems} onRefresh={refresh} />}
        {tab === 'remotes' && (
          <RemotesView
            key={'rv' + refreshKey}
            config={config}
            onBack={goItems}
            onRefresh={refresh}
            activeTerminalRemote={terminalRemote}
            onOpenTerminal={openTerminalRemote}
          />
        )}
        {terminalRemote && (
          <div className="page-terminal-dock">
            <TerminalPanel
              key={terminalRemote.id}
              remote={terminalRemote}
              onClose={() => setTerminalRemote(null)}
              onNew={() => setTerminalPickerOpen(true)}
              className="page-terminal-panel"
            />
          </div>
        )}
      </main>
      <div className="terminal-launcher">
        {terminalPickerOpen && (
          <div className="terminal-launcher-menu">
            <div className="terminal-launcher-head">Open terminal</div>
            {(config.remotes || []).length === 0 ? (
              <div className="terminal-launcher-empty">No remotes configured</div>
            ) : (
              (config.remotes || []).map(remote => (
                <button
                  key={remote.id}
                  className={terminalRemote?.id === remote.id ? 'active' : ''}
                  onClick={() => openTerminalRemote(remote)}
                >
                  <span>{remote.name || remote.host || remote.root || remote.id}</span>
                  <small>{remote.kind === 'ssh' ? `${remote.username}@${remote.host}` : remote.root}</small>
                </button>
              ))
            )}
          </div>
        )}
        <button
          className={`terminal-launcher-btn ${terminalRemote ? 'active' : ''}`}
          onClick={openTerminalLauncher}
          aria-label="Open terminal"
        >
          <TerminalWindow size={22} weight="bold" />
        </button>
      </div>
      <ToastContainer />
      {importAnalysis && (
        <ImportModal
          analysis={importAnalysis}
          onApply={handleImportApply}
          onClose={() => setImportAnalysis(null)}
        />
      )}
    </div>
  );
}
