#!/usr/bin/env node
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT, 'dist_tmp');
const FLATTEN = path.join(__dirname, 'flatten.js');

function tscPath() {
  const bin = path.join(ROOT, 'node_modules', '.bin', 'tsc' + (process.platform === 'win32' ? '.cmd' : ''));
  return fs.existsSync(bin) ? bin : 'tsc';
}

ensureDir(TMP_DIR);

console.log('Starting tsc --watch ->', TMP_DIR);
let tsc = null;
try {
  const tscModule = require.resolve('typescript/lib/tsc');
  tsc = cp.spawn(process.execPath, [tscModule, '--watch', '--outDir', TMP_DIR], { stdio: 'inherit' });
} catch (e) {
  // fallback to calling tsc from PATH
  tsc = cp.spawn('tsc', ['--watch', '--outDir', TMP_DIR], { stdio: 'inherit' });
}

let debounce = null;
let running = false;

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function runFlatten() {
  if (running) return;
  running = true;
  console.log('Detected changes — running flatten.js');
  const p = cp.spawn(process.execPath, [FLATTEN], { cwd: ROOT, stdio: 'inherit' });
  p.on('exit', () => { running = false; });
}

// Watch TMP_DIR for changes (recursive watch supported on Windows)
try {
  fs.watch(TMP_DIR, { recursive: true }, (ev, filename) => {
    if (!filename) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(runFlatten, 150);
  });
} catch (e) {
  console.warn('File watch failed, flatten will not run automatically:', e && e.message);
}

process.on('exit', () => { try { if (tsc) tsc.kill(); } catch (e) {} });
