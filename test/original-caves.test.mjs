import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ORIGINAL_CAVES, decodeOriginal, nextOriginal } from '../original-caves.mjs';
const goldens=JSON.parse(readFileSync(new URL('./original-goldens.json',import.meta.url)));
test('every cell in all 100 original cave/difficulty combinations matches the independent reference decoder',()=>{
  for(let difficulty=1;difficulty<=5;difficulty++) for(let index=0;index<20;index++) {
    const cave=decodeOriginal(index,difficulty), expected=goldens[`${cave.rawIndex+1}:${difficulty}`];
    const hash=createHash('sha256').update(Buffer.from(cave.codes.flat())).digest('hex');
    assert.equal(hash,expected.sha256,`${cave.id}/${difficulty}`);
    assert.equal(cave.target,expected.target); assert.equal(cave.time,expected.time);
    assert.equal(cave.grid.length,22); assert(cave.grid.every(row=>row.length===40));
    assert.equal(cave.grid.flat().filter(tile=>tile==='I').length,1);
    assert.equal(cave.grid.flat().filter(tile=>tile==='X').length,1);
  }
});
test('campaign interleaves four intermissions and advances difficulty after intermission four',()=>{
  assert.equal(ORIGINAL_CAVES.map(cave=>cave.id).join(','),'A,B,C,D,I1,E,F,G,H,I2,I,J,K,L,I3,M,N,O,P,I4');
  assert.deepEqual(nextOriginal(3,1),{index:4,difficulty:1});
  assert.deepEqual(nextOriginal(19,1),{index:0,difficulty:2});
  assert.deepEqual(nextOriginal(19,5),{index:0,difficulty:5});
});
test('published Intro landmarks and difficulty metadata match the original byte specification',()=>{
  const a=decodeOriginal(0,1), hard=decodeOriginal(0,5);
  assert.deepEqual(a.player,{x:3,y:2}); assert.equal(a.codes[16][38],4);
  for(let x=1;x<=30;x++) assert.equal(a.codes[7][x],2);
  for(let x=9;x<=38;x++) assert.equal(a.codes[14][x],2);
  assert.equal(a.target,12); assert.equal(a.time,150); assert.equal(hard.time,30);
  assert.equal(a.diamondValue,10); assert.equal(a.extraDiamondValue,15);
  assert.notDeepEqual(a.codes,hard.codes);
});
test('directional enemies, magic wall and amoeba objects are preserved, and boundary exits are not overwritten',()=>{
  assert(decodeOriginal(1).facings.length>0);
  assert(decodeOriginal(7).grid.flat().includes('a'));
  assert(decodeOriginal(8).grid.flat().includes('M'));
  const maze=decodeOriginal(2); assert.equal(maze.grid[18][39],'X');
});
