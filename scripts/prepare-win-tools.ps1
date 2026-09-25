param(
    [string]$MsysPath = "C:\msys64\usr\bin"
)

$targetDir = "$PSScriptRoot\..\src-tauri\vendor\win-tools"
$targetBin = "$targetDir\usr\bin"
$targetTmp = "$targetDir\tmp"
$targetHome = "$targetDir\home\sync-gui\.ssh"

New-Item -ItemType Directory -Force -Path $targetBin | Out-Null
New-Item -ItemType Directory -Force -Path $targetTmp | Out-Null
New-Item -ItemType Directory -Force -Path $targetHome | Out-Null

if (-not (Test-Path "$MsysPath\bash.exe")) {
    Write-Warning "MSYS2 not found at $MsysPath. Run scripts\setup-win.ps1 first to install MSYS2 dependencies."
    exit 0
}

Write-Host "Copying MSYS2 runtime and tools from $MsysPath..." -ForegroundColor Cyan

# Copy all msys DLLs
Copy-Item "$MsysPath\msys-*.dll" -Destination $targetBin -Force

# Copy essential tools
$tools = @("bash.exe", "rsync.exe", "ssh.exe", "sshpass.exe", "ssh-keygen.exe", "ssh-keyscan.exe", "mkdir.exe", "find.exe", "stty.exe", "sh.exe", "rm.exe", "cat.exe", "cp.exe")
foreach ($tool in $tools) {
    if (Test-Path "$MsysPath\$tool") {
        Copy-Item "$MsysPath\$tool" -Destination $targetBin -Force
    }
}

$count = (Get-ChildItem $targetBin).Count
Write-Host "Successfully bundled $count binaries and DLLs into $targetBin" -ForegroundColor Green
