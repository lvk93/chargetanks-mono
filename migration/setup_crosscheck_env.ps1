# Gegenprobe zur Golden-Erzeugung: zweite Legacy-venv mit aelteren Rechenbibliotheken
# (Stand der frueheren lokalen Entwicklungsumgebung), sonst identisch zu setup_legacy.ps1.
# Zweck: zeigen, dass die Golden-Werte nicht von den auf Render ungepinnten Versionen abhaengen.
# Aufruf: powershell -ExecutionPolicy Bypass -File migration\setup_crosscheck_env.ps1
$ErrorActionPreference = "Stop"
$work = Join-Path $PSScriptRoot ".work"
$venv = Join-Path $work "venv-ocv-old"
$py = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $py)) { py -3.11 -m venv $venv; if ($LASTEXITCODE) { throw "venv" } }
$constraints = Join-Path $work "crosscheck-constraints.txt"
[System.IO.File]::WriteAllLines($constraints, @("numpy==1.26.4", "scipy==1.16.0", "pandas==2.3.0", "plotly==6.2.0"),
    (New-Object System.Text.UTF8Encoding($false)))
& $py -m pip install --quiet --upgrade pip; if ($LASTEXITCODE) { throw "pip" }
& $py -m pip install --quiet -r (Join-Path $work "req.noedit.txt") -c $constraints; if ($LASTEXITCODE) { throw "requirements" }
& $py -m pip install --quiet -e (Join-Path $work "ocv_teaching") -c $constraints; if ($LASTEXITCODE) { throw "ocv_teaching" }
& $py -m pip freeze --exclude-editable | Set-Content -Encoding ascii (Join-Path $PSScriptRoot "env\ocv_teaching-crosscheck.freeze.txt")
Write-Host "venv-ocv-old bereit"
