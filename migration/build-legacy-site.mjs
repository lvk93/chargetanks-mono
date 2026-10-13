// Baut den Legacy-Build der Webseite (migration/.work/chargetanks, Stand chargetanks@main).
//
//   node migration/build-legacy-site.mjs verify
//     Baut mit den VITE_*-Werten aus legacy/chargetanks/.env (nur als Prozess-Umgebung, nichts wird
//     gespeichert oder ausgegeben) und vergleicht die Asset-Dateinamen (Content-Hashes) mit dem
//     live ausgelieferten index.html. Der Build wird danach geloescht und nie im Browser geoeffnet,
//     weil er Tracking an Supabase senden wuerde.
//
//   node migration/build-legacy-site.mjs plain
//     Baut ohne VITE_SUPABASE_*; das Original-Tracking ist dann inaktiv (getSupabaseClient -> null).
//     Dieser Build dient den Messungen und Screenshots.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const mode = process.argv[2];
const root = resolve('migration/.work/chargetanks');
const legacyEnvFile = resolve('../legacy/chargetanks/.env');

function parseDotenv(text) {
  const values = {};
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const key = line.slice(0, line.indexOf('=')).trim();
    let value = line.slice(line.indexOf('=') + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function build(extraEnv) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('VITE_')) delete env[key];
  Object.assign(env, extraEnv);
  rmSync(join(root, 'dist'), { recursive: true, force: true });
  const result = spawnSync('npm', ['run', 'build'], { cwd: root, env, shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    throw new Error('Build fehlgeschlagen');
  }
}

function assetNames(html) {
  return [...html.matchAll(/\/assets\/([\w.-]+\.(?:js|css))/g)].map((m) => m[1]).sort();
}

if (mode === 'verify') {
  const dotenv = parseDotenv(readFileSync(legacyEnvFile, 'utf8'));
  const viteVars = Object.fromEntries(Object.entries(dotenv).filter(([k]) => k.startsWith('VITE_')));
  console.log(`Verwende VITE-Variablen: ${Object.keys(viteVars).join(', ')} (Werte nicht ausgegeben)`);
  build(viteVars);
  const localHtml = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  const local = assetNames(localHtml);
  const localFiles = readdirSync(join(root, 'dist', 'assets')).sort();
  const liveHtml = await (await fetch('https://chargetanks.com/')).text();
  const live = assetNames(liveHtml);
  const same = JSON.stringify(local) === JSON.stringify(live);
  // Byte-Vergleich aller ausgelieferten Dateien (HTML-Snapshots, Metadateien, Bilder, JS-Chunks).
  const files = ['index.html', 'blog/index.html', 'blog/two-tank-battery-model/index.html', 'tools/index.html',
    'sitemap.xml', 'robots.txt', 'llms.txt', 'site.webmanifest', 'favicon.svg', '_redirects', '_headers',
    ...readdirSync(join(root, 'dist', 'images')).filter((f) => f.includes('.')).map((f) => `images/${f}`),
    ...readdirSync(join(root, 'dist', 'images', 'introduction_post')).map((f) => `images/introduction_post/${f}`),
    ...localFiles.map((f) => `assets/${f}`)];
  const byteChecks = [];
  for (const file of files) {
    const localBytes = readFileSync(join(root, 'dist', file));
    const urlPath = file.endsWith('index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`;
    const response = await fetch(`https://chargetanks.com${urlPath}`, { redirect: 'manual' });
    const liveBytes = Buffer.from(await response.arrayBuffer());
    byteChecks.push(`${file}: http=${response.status} lokal=${localBytes.length}B live=${liveBytes.length}B identisch=${localBytes.equals(liveBytes)}`);
  }
  const report = [
    `# Nachweis Legacy-Build == live (${new Date().toISOString()})`,
    `commit=${spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()}`,
    `node=${process.version}`,
    `live_index_assets=${live.join(',')}`,
    `local_index_assets=${local.join(',')}`,
    `local_dist_assets=${localFiles.join(',')}`,
    `identisch=${same}`,
    '',
    '# Byte-Vergleich der ausgelieferten Dateien (live per GET, ohne JS-Ausfuehrung)',
    ...byteChecks,
  ];
  writeFileSync('migration/env/site-build-verification.txt', report.join('\n') + '\n');
  console.log(report.join('\n'));
  rmSync(join(root, 'dist'), { recursive: true, force: true });
} else if (mode === 'plain') {
  build({});
  console.log('Build ohne Tracking-Variablen:', readdirSync(join(root, 'dist', 'assets')).join(', '));
} else {
  console.error('Aufruf: node migration/build-legacy-site.mjs verify|plain');
  process.exit(2);
}
