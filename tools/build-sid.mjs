// Make a self-contained ES module from pinned, unchanged upstream sources.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../vendor/jssid/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('UPSTREAM.json', root), 'utf8'));
for (const file of manifest.files) {
  const actual = createHash('sha256').update(await readFile(new URL(file.file, root))).digest('hex');
  if (actual !== file.sha256) throw new Error(`Upstream integrity mismatch: ${file.file}`);
}
const names = ['jssid.core.js', 'stream.js', 'jsxcompressor.js', 'jssid.resid.js'];
const sources = await Promise.all(names.map(name => readFile(new URL(name, root), 'utf8')));
const header = `/* Deepfall module wrapper, 2026-10-31.\n * jsSID by Joe Hohertz; reSID by Dag Lem; GPL-2.0.\n * See vendor/jssid/LICENSE.md and UPSTREAM.json.\n * Upstream bodies unchanged. JXG declared for ES-module strict mode.\n */\nvar JXG;\n`;
await writeFile(new URL('resid.mjs', root), header + sources.join('\n') + '\nexport { jsSID };\n');
console.log('[OK] reSID module built; pinned sources verified.');
