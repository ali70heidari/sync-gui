'use client';
import { useState, useEffect } from 'react';
import { Warning, CaretDown, CaretUp, Copy, Check } from '@phosphor-icons/react';

const INFO = {
  bash: {
    label: 'Bash',
    why: 'Command shell required to execute rsync and system commands',
    level: 'critical',
    fix: {
      linux: 'Pre-installed on all Linux distributions',
      win: 'Installed automatically with MSYS2',
    },
  },
  rsync: {
    label: 'rsync',
    why: 'File synchronization engine — transfers, compares, and deletes files',
    level: 'critical',
    fix: {
      linux: 'sudo apt install rsync',
      win: 'Installed automatically with MSYS2 (pacman -S rsync)',
    },
  },
  sshpass: {
    label: 'sshpass',
    why: [
      'Lets rsync connect to SSH servers using a password without prompting the terminal.',
      'Without it, password-based SSH authentication will fail (key-based auth still works).',
      'Ubuntu does not ship sshpass by default because passwords passed as CLI arguments can be visible to other processes on the same machine.',
      'If you use SSH keys for authentication, this tool is not needed.',
    ],
    level: 'recommended',
    fix: {
      linux: 'sudo apt install sshpass',
      win: 'pacman -S sshpass (inside MSYS2)',
    },
  },
  ssh: {
    label: 'SSH client',
    why: 'Secure shell connection to remote servers for file transfer',
    level: 'critical',
    fix: {
      linux: 'sudo apt install openssh-client',
      win: 'Installed automatically with MSYS2 (pacman -S openssh)',
    },
  },
};

function CodeBlock({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="code-block">
      <code>{text}</code>
      <button className="code-copy" onClick={copy}>
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </div>
  );
}

export default function HealthCheck() {
  const [deps, setDeps] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/deps')
      .then(r => r.json())
      .then(data => { if (!cancelled) setDeps(data); })
      .catch(() => { if (!cancelled) setDeps({ ok: false, deps: {}, error: 'API unreachable' }); });
    return () => { cancelled = true; };
  }, []);

  if (!deps || deps.ok) return null;

  const missing = deps.deps
    ? Object.entries(deps.deps).filter(([, v]) => !v).map(([k]) => ({ name: k, info: INFO[k] }))
    : [];

  const isWin = deps.platform === 'win32';

  return (
    <div className="health-banner">
      <div className="health-header" onClick={() => setExpanded(!expanded)}>
        <Warning size={18} />
        <span className="health-title">
          {missing.length} system tool{missing.length > 1 ? 's' : ''} missing
        </span>
        <span className="health-names">
          {missing.map(m => m.info?.label || m.name).join(', ')}
        </span>
        <span className="health-toggle">
          {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
          {expanded ? ' less' : ' details'}
        </span>
      </div>

      {expanded && (
        <div className="health-body">
          {isWin && !deps.msys2 && (
            <div className="health-msys2-warning">
              <div className="health-msys2-title">MSYS2 not installed</div>
              <div className="health-msys2-desc">
                MSYS2 provides the Unix environment (bash, rsync, ssh, sshpass) required on Windows.
                Run <strong>setup-win.ps1</strong> or download from msys2.org.
              </div>
            </div>
          )}

          {missing.map(({ name, info }) => (
            <div key={name} className={`health-item ${info?.level === 'critical' ? 'critical' : 'recommended'}`}>
              <div className="health-item-header">
                <span className="health-item-name">{info?.label || name}</span>
                <span className={`health-level-badge ${info?.level}`}>
                  {info?.level === 'critical' ? 'REQUIRED' : 'RECOMMENDED'}
                </span>
              </div>
              <div className="health-item-desc">
                {Array.isArray(info?.why)
                  ? info.why.map((line, i) => <div key={i} style={{ marginBottom: i < info.why.length - 1 ? 4 : 0 }}>{line}</div>)
                  : info?.why}
              </div>
              <CodeBlock text={isWin ? info?.fix?.win : info?.fix?.linux} />
            </div>
          ))}

          <div className="health-footer">
            {isWin
              ? 'Run setup-win.ps1 to install all dependencies automatically'
              : 'Quick install:  sudo apt install rsync sshpass openssh-client'}
          </div>
        </div>
      )}
    </div>
  );
}
