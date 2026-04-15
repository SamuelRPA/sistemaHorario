/**
 * Añade import { apiUrl } y envuelve el primer argumento de fetch hacia /api.
 * Ejecutar: node scripts/apply-api-url.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '../frontend/src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(jsx|js)$/.test(p) && !p.endsWith('apiUrl.js')) out.push(p);
  }
  return out;
}

function addImport(content, filePath) {
  const rel = path.relative(path.dirname(filePath), path.join(srcRoot, 'apiUrl.js')).replace(/\\/g, '/');
  const stmt = `import { apiUrl } from '${rel}';`;
  if (content.includes(stmt) || content.includes("from '") && content.includes("/apiUrl.js'")) return content;
  const lines = content.split('\n');
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, stmt);
  return lines.join('\n');
}

function transform(content) {
  let s = content;
  const replacers = [
    [/fetch\(\s*'(\/api[^']*)'\s*,/g, "fetch(apiUrl('$1'),"],
    [/fetch\(\s*`(\/api[^`]*?)`\s*,/g, 'fetch(apiUrl(`$1`),'],
    [/return\s+fetch\(\s*'(\/api[^']*)'\s*,/g, "return fetch(apiUrl('$1'),"],
    [/return\s+fetch\(\s*`(\/api[^`]*?)`\s*,/g, 'return fetch(apiUrl(`$1`),'],
    [/await\s+fetch\(\s*'(\/api[^']*)'\s*,/g, "await fetch(apiUrl('$1'),"],
    [/await\s+fetch\(\s*`(\/api[^`]*?)`\s*,/g, 'await fetch(apiUrl(`$1`),'],
  ];
  for (const [re, rep] of replacers) {
    s = s.replace(re, rep);
  }
  return s;
}

for (const file of walk(srcRoot)) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('/api')) continue;
  const next = transform(s);
  if (next === s) continue;
  fs.writeFileSync(file, addImport(next, file), 'utf8');
  console.log('patched', path.relative(srcRoot, file));
}
