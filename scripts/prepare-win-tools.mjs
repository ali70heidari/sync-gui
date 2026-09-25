import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const targetVendorDir = path.join(root, 'src-tauri', 'vendor', 'win-tools');
const targetBinDir = path.join(targetVendorDir, 'usr', 'bin');

export function prepareWindowsTools() {
  if (process.platform !== 'win32') {
    // On Linux / macOS, ensure directories exist so Tauri resource bundle pattern doesn't error out
    fs.mkdirSync(path.join(targetVendorDir, 'usr', 'bin'), { recursive: true });
    fs.mkdirSync(path.join(targetVendorDir, 'tmp'), { recursive: true });
    fs.mkdirSync(path.join(targetVendorDir, 'home', 'sync-gui', '.ssh'), { recursive: true });
    console.log('[prepare-win-tools] Non-Windows platform detected; placeholder vendor structure verified.');
    return;
  }

  const candidateSources = [
    process.env.SYNC_GUI_WIN_TOOLS_BIN,
    'C:\\msys64\\usr\\bin',
    'C:\\msys2\\usr\\bin'
  ].filter(Boolean);

  const msysBin = candidateSources.find(p => (
    fs.existsSync(path.join(p, 'bash.exe')) &&
    fs.existsSync(path.join(p, 'rsync.exe'))
  ));

  if (!msysBin) {
    console.warn('[prepare-win-tools] MSYS2 binaries not found in standard paths (C:\\msys64\\usr\\bin).');
    console.warn('[prepare-win-tools] If building for Windows distribution, please install MSYS2 with rsync, openssh, and sshpass.');
    return;
  }

  fs.mkdirSync(targetBinDir, { recursive: true });
  fs.mkdirSync(path.join(targetVendorDir, 'tmp'), { recursive: true });
  fs.mkdirSync(path.join(targetVendorDir, 'home', 'sync-gui', '.ssh'), { recursive: true });

  const entries = fs.readdirSync(msysBin);
  const essentialTools = new Set([
    'bash.exe',
    'rsync.exe',
    'ssh.exe',
    'sshpass.exe',
    'ssh-keygen.exe',
    'ssh-keyscan.exe',
    'mkdir.exe',
    'find.exe',
    'stty.exe',
    'sh.exe',
    'rm.exe',
    'cat.exe',
    'cp.exe'
  ]);

  let copiedCount = 0;
  for (const entry of entries) {
    const isMsysDll = entry.toLowerCase().startsWith('msys-') && entry.toLowerCase().endsWith('.dll');
    const isEssentialTool = essentialTools.has(entry.toLowerCase());

    if (isMsysDll || isEssentialTool) {
      const srcFile = path.join(msysBin, entry);
      const dstFile = path.join(targetBinDir, entry);
      fs.copyFileSync(srcFile, dstFile);
      copiedCount++;
    }
  }

  console.log(`[prepare-win-tools] Successfully bundled ${copiedCount} MSYS2 binaries and DLLs into ${targetBinDir}`);
}

prepareWindowsTools();
