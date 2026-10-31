import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {solve} from '../tools/solve-campaign.mjs';
import {solveMacro} from '../tools/solve-macros.mjs';
import {verifySolverResult,saveWin,cliArgs} from '../tools/solver-utils.mjs';

test('solver imports have no CLI execution or file-writing side effects',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deepfall-import-'));
 try{
  const imports=['../tools/solve-campaign.mjs','../tools/solve-macros.mjs'].map(p=>`await import(${JSON.stringify(new URL(p,import.meta.url).href)});`).join('');
  const child=spawnSync(process.execPath,['--input-type=module','-e',imports],{cwd:dir,encoding:'utf8',timeout:5000});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');assert.deepEqual(fs.readdirSync(dir),[]);
 }finally{fs.rmdirSync(dir);}
});
test('legacy F fixture remains an exact verified escape and uses normalized inputs',()=>{
 const record=JSON.parse(fs.readFileSync(new URL('./winning-F.json',import.meta.url),'utf8'));
 const g=verifySolverResult(record);assert.equal(g.status,'won');assert.equal(g.collected,5);assert.equal(record.ticks,216);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deepfall-save-'));
 try{assert.equal(saveWin(dir,record),true);const file=path.join(dir,'winning-F-level-1.json'),saved=fs.readFileSync(file,'utf8');assert.equal(saveWin(dir,record),false);assert.equal(fs.readFileSync(file,'utf8'),saved);fs.unlinkSync(file);}finally{fs.rmdirSync(dir);}
 assert.throws(()=>verifySolverResult({...record,diamonds:36}));
});
test('solver arguments reject malformed caves and honor explicit search bounds',()=>{
 assert.throws(()=>solve(-1));assert.throws(()=>solve(0,1,0));assert.throws(()=>solveMacro(20));assert.throws(()=>solveMacro(0,0));
 assert.throws(()=>cliArgs(['1,,2','out'],[]));assert.throws(()=>cliArgs(['2'],[]));
 const run=solve(6,1,1);assert.equal(run.ticks,1);assert.equal(run.status,'budget');assert.ok(verifySolverResult(run));
 assert.equal(solveMacro(0,1,{maxMs:1}),null);
});

test('comparison beam still discovers an independently verified original F exit',()=>{
 const result=solve(6,1,300);assert.equal(result.status,'won');assert.equal(verifySolverResult(result).status,'won');
});
