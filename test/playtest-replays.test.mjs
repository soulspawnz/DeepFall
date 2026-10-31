import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../engine.mjs';
test('all 300 recorded play attempts reproduce their actual result',async()=>{
 const report=JSON.parse(await readFile(new URL('../docs/playtest-original.json',import.meta.url)));
 assert.equal(report.attempts.length,300);
 const groups=new Map();
 for(const attempt of report.attempts){
  const key=`${attempt.index}:${attempt.difficulty}`;groups.set(key,(groups.get(key)??0)+1);
  const g=new Game(attempt.index,'classic',null,{campaign:'original',difficulty:attempt.difficulty});g.start();
  for(const [dx,dy] of attempt.input){g.step({dx,dy});g.events=[];}
  assert.equal(g.status,attempt.status,key);assert.equal(g.collected,attempt.diamonds,key);
 }
 assert.equal(groups.size,100);assert.ok([...groups.values()].every(n=>n===3));
});
