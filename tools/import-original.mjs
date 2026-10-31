// Offline import of pinned reference data; no source or assets fetched at runtime.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const reference = new URL('../vendor/original-caves/', import.meta.url);
const source = await readFile(new URL('caves.js', reference), 'utf8');
const provenance = JSON.parse(await readFile(new URL('SOURCES.json', reference), 'utf8'));
const expected = provenance.files.find(file => file.file === 'caves.js').sha256;
if (createHash('sha256').update(source).digest('hex') !== expected) throw new Error('Reference hash mismatch');
const section = source.match(/var DATA = (\[[\s\S]*?\n  \])/);
if (!section) throw new Error('Missing cave data');
const bytes = JSON.parse(section[1].replace(/0x[\da-f]+/gi, hex => String(Number(hex))).replace(/,\s*\]/g, ']'));
if (bytes.length !== 20 || bytes.some(cave => cave.at(-1) !== 255)) throw new Error('Incomplete original data');
await writeFile(new URL('../original-data.mjs', import.meta.url), `// Original Boulder Dash I cave bytes. Provenance: docs/original-caves.json.\nexport const ORIGINAL_BYTES = ${JSON.stringify(bytes)};\n`);
await mkdir(new URL('../docs/', import.meta.url), {recursive:true});
await writeFile(new URL('../docs/original-caves.json', import.meta.url), JSON.stringify(provenance,null,2)+'\n');
// Independent reference decoder, with only its documented difficulty selectors changed.
// The production decoder is separately implemented in original-caves.mjs.
const hashes = {};
for (let difficulty = 1; difficulty <= 5; difficulty++) {
  const context = {};
  const referenceSource = source.replace('cave[0x04], //', `cave[${4+difficulty-1}], //`)
    .replace('cave[0x09], //', `cave[${9+difficulty-1}], //`)
    .replace('cave[0x0E], //', `cave[${14+difficulty-1}], //`);
  vm.runInNewContext(referenceSource, context, {timeout:1000});
  for (const cave of context.CAVES) {
    const flat = [];
    for(let y=0;y<22;y++) for(let x=0;x<40;x++) flat.push(cave.map[x][y]);
    hashes[`${cave.index+1}:${difficulty}`] = {sha256:createHash('sha256').update(Buffer.from(flat)).digest('hex'),target:cave.diamondsNeeded,time:cave.caveTime};
  }
}
await writeFile(new URL('../test/original-goldens.json', import.meta.url), JSON.stringify(hashes,null,2)+'\n');
console.log('[OK] Imported 20 cave byte streams; 100 independent decoder golden hashes generated.');
