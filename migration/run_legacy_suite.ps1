# Startet die Legacy-Streamlit-Suite (ocv_teaching@master) lokal wie auf Render, aber ohne Tracking.
#
# - Code unveraendert aus migration/.work/ocv_teaching (siehe setup_legacy.ps1).
# - supabase wird durch migration/stubs/supabase ersetzt (PYTHONPATH), die echte .env wird nicht
#   verwendet; die Events, die das Original senden wuerde, landen in migration/.work/tracking-*.jsonl.
# - ipapi.co (serverseitige Geo-Abfrage) laeuft ueber einen toten Proxy in den except-Zweig.
# - Eigenes, leeres Home-Verzeichnis: eine globale ~/.streamlit/config.toml (gibt es auf Render nicht)
#   soll das Ergebnis nicht beeinflussen.
#
# Aufruf: powershell -ExecutionPolicy Bypass -File migration\run_legacy_suite.ps1 [-Port 8501]
param([int]$Port = 8501)
$ErrorActionPreference = "Stop"
$work = Join-Path $PSScriptRoot ".work"
$home_ = Join-Path $work "streamlit-home"
New-Item -ItemType Directory -Force $home_ | Out-Null

$env:PYTHONPATH = Join-Path $PSScriptRoot "stubs"
$env:SUPABASE_URL = "http://supabase.stub.invalid"
$env:SUPABASE_ANON_KEY = "stub"
$env:STUB_TRACKING_LOG = Join-Path $work "tracking-browser.jsonl"
$env:HTTPS_PROXY = "http://127.0.0.1:9"
$env:HTTP_PROXY = "http://127.0.0.1:9"
$env:NO_PROXY = "localhost,127.0.0.1"
$env:USERPROFILE = $home_
$env:HOME = $home_

Set-Location (Join-Path $work "ocv_teaching")
& (Join-Path $work "venv-ocv\Scripts\streamlit.exe") run app.py --server.port $Port
