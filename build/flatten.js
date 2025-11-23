#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT, 'dist_tmp');
const OUT_DIR = path.join(ROOT, 'dist');

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) clearDir(full), fs.rmdirSync(full);
    else fs.unlinkSync(full);
  }
}

if (!fs.existsSync(TMP_DIR)) {
  console.error('Temporary compile directory not found:', TMP_DIR);
  process.exit(1);
}

// prepare out dir
ensureDir(OUT_DIR);
clearDir(OUT_DIR);

const jsFiles = walk(TMP_DIR).filter(f => f.endsWith('.js'));

// Map original absolute path -> flattened basename (no extension)
const map = Object.create(null);
for (const f of jsFiles) {
  const rel = path.relative(TMP_DIR, f).replace(/\\/g, '/');
  const noext = rel.replace(/\.js$/, '');
  const dotted = noext.split('/').join('.');
  map[f] = dotted; // maps absolute -> dotted
}

// Replace require(...) of relative modules that point inside TMP_DIR
const requireRegex = /require\((['"])(\.\.?(?:\/|[^'"\\)]+)?)\1\)/g;

for (const f of jsFiles) {
  let src = fs.readFileSync(f, 'utf8');

  src = src.replace(requireRegex, (match, quote, reqPath) => {
    // resolve the path that was required, relative to f
    try {
      const baseDir = path.dirname(f);
      // try with .js appended (commonjs compiled output)
      const candidate = path.resolve(baseDir, reqPath + '.js');
      const candidate2 = path.resolve(baseDir, reqPath);
      let resolved = null;
      if (fs.existsSync(candidate) && map[candidate]) resolved = candidate;
      else if (fs.existsSync(candidate2) && map[candidate2]) resolved = candidate2;
      if (resolved && map[resolved]) {
        return `require('./${map[resolved]}')`;
      }
    } catch (e) {
      // fallthrough
    }
    return match; // leave unchanged
  });

  const outName = map[f] + '.js';
  const outPath = path.join(OUT_DIR, outName);
  fs.writeFileSync(outPath, src, 'utf8');
}

console.log('Flattened', jsFiles.length, 'files to', OUT_DIR);
