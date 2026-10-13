# Richtet die Legacy-Referenz fuer die Migration ein (Phase 0/1).
#
# - Liest die Legacy-Repos nur (git clone); geschrieben wird ausschliesslich nach migration/.work/.
# - Referenz ist der Live-Stand: ocv_teaching@master (Render) und chargetanks@main (Netlify),
#   jeweils fest auf den Commit gepinnt, der bei der Bestandsaufnahme live war.
# - Python-Umgebung der Streamlit-Suite wie im Dockerfile: requirements.txt ohne "-e .",
#   danach "pip install -e .". Die tatsaechlich installierten Versionen landen in migration/env/.
# - requirements.txt ist auf Render ungepinnt. Die pip-Schicht des Live-Images wurde am 2026-03-09
#   um 22:04:49 UTC gebaut (Last-Modified von Streamlits index.html live; Tornado 6.5.4 live, 6.5.5
#   erschien erst am 2026-03-10). --uploaded-prior-to rekonstruiert genau diesen Paketstand.
#
# Aufruf (PowerShell 5.1):  powershell -ExecutionPolicy Bypass -File migration\setup_legacy.ps1
param(
    [string]$LegacyRoot = (Join-Path $PSScriptRoot "..\..\legacy"),
    [string]$OcvCommit = "deb0609214a70972d5a343b2f09a6414a59638f3",  # ocv_teaching@master
    [string]$SiteCommit = "3199678a334a3e807d6e934c3961331db752dc22", # chargetanks@main
    [string]$UploadedPriorTo = "2026-03-09T22:04:49Z",               # Stand der Render-pip-Schicht
    [string]$PlaywrightVersion = "1.50.0",
    [switch]$SkipPython,
    [switch]$SkipNode
)
$ErrorActionPreference = "Stop"
$work = Join-Path $PSScriptRoot ".work"
$envDir = Join-Path $PSScriptRoot "env"
New-Item -ItemType Directory -Force $work, $envDir | Out-Null

function Invoke-Checked([scriptblock]$Block, [string]$What) {
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "$What fehlgeschlagen (Exit $LASTEXITCODE)" }
}

function Write-Utf8NoBom([string]$Path, [string[]]$Lines) {
    [System.IO.File]::WriteAllLines($Path, $Lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-LegacyClone([string]$Source, [string]$Target, [string]$Branch, [string]$Commit) {
    # LF-Zeilenenden wie auf Netlify/Render (Linux): die Webseite bettet Markdown roh ins Bundle ein,
    # mit CRLF (Git-for-Windows-Standard) waere der Build nicht mehr identisch mit live.
    if (-not (Test-Path (Join-Path $Target ".git"))) {
        Invoke-Checked { git clone --quiet -c core.autocrlf=false --branch $Branch $Source $Target } "git clone $Source"
    }
    Invoke-Checked { git -C $Target config core.autocrlf false } "core.autocrlf setzen"
    Invoke-Checked { git -C $Target checkout --quiet --detach $Commit } "git checkout $Commit"
    $head = (git -C $Target rev-parse HEAD).Trim()
    if ($head -ne $Commit) { throw "Unerwarteter HEAD $head in $Target" }
    Write-Host "OK  $Target @ $Commit"
}

Get-LegacyClone (Join-Path $LegacyRoot "ocv_teaching") (Join-Path $work "ocv_teaching") "master" $OcvCommit
Get-LegacyClone (Join-Path $LegacyRoot "chargetanks") (Join-Path $work "chargetanks") "main" $SiteCommit

if (-not $SkipPython) {
    # --- Streamlit-Suite (Python 3.11 wie python:3.11-slim im Dockerfile) ---
    $venv = Join-Path $work "venv-ocv"
    $py = Join-Path $venv "Scripts\python.exe"
    if (-not (Test-Path $py)) { Invoke-Checked { py -3.11 -m venv $venv } "venv-ocv anlegen" }
    Invoke-Checked { & $py -m pip install --quiet --upgrade pip } "pip upgrade"
    Invoke-Checked { & $py -m pip install --quiet --upgrade --uploaded-prior-to $UploadedPriorTo setuptools wheel } "setuptools/wheel"
    $reqLines = Get-Content (Join-Path $work "ocv_teaching\requirements.txt") |
        Where-Object { $_ -notmatch '^\s*-e\s*\.\s*$' }
    $reqFile = Join-Path $work "req.noedit.txt"
    Write-Utf8NoBom $reqFile $reqLines
    Invoke-Checked { & $py -m pip install --quiet --uploaded-prior-to $UploadedPriorTo -r $reqFile } "requirements installieren"
    Invoke-Checked { & $py -m pip install --quiet --uploaded-prior-to $UploadedPriorTo -e (Join-Path $work "ocv_teaching") } "ocv_teaching installieren"
    $freeze = & $py -m pip freeze --exclude-editable
    $pyVersion = (& $py -c "import sys;print(sys.version.split()[0])")
    Write-Utf8NoBom (Join-Path $envDir "ocv_teaching.freeze.txt") (@("# pip freeze der Legacy-Suite (Python $pyVersion, --uploaded-prior-to $UploadedPriorTo)") + $freeze)

    # --- Mess-Werkzeuge (Playwright), getrennt von der Legacy-Umgebung ---
    $tvenv = Join-Path $work "venv-tools"
    $tpy = Join-Path $tvenv "Scripts\python.exe"
    if (-not (Test-Path $tpy)) { Invoke-Checked { py -3.11 -m venv $tvenv } "venv-tools anlegen" }
    Invoke-Checked { & $tpy -m pip install --quiet --upgrade pip } "pip upgrade (tools)"
    Invoke-Checked { & $tpy -m pip install --quiet "playwright==$PlaywrightVersion" "pillow" } "playwright installieren"
    Invoke-Checked { & $tpy -m playwright install chromium } "chromium bereitstellen"
    $tfreeze = & $tpy -m pip freeze
    Write-Utf8NoBom (Join-Path $envDir "tools.freeze.txt") (@("# pip freeze der Mess-Werkzeuge") + $tfreeze)
}

if (-not $SkipNode) {
    # --- Webseite (React/Vite) exakt nach package-lock.json ---
    Push-Location (Join-Path $work "chargetanks")
    try { Invoke-Checked { npm ci --no-audit --no-fund } "npm ci" } finally { Pop-Location }
    Write-Utf8NoBom (Join-Path $envDir "node.txt") @("node " + (node --version), "npm " + (npm --version))
}
Write-Host "Setup abgeschlossen."
