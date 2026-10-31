import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningProgress} from '../learning-archive.mjs';
function record(kind,attempt,status,diamonds=5,ticks=200){return {id:`${kind}-${attempt}`,kind,attempt,run:{status,diamonds,ticks,target:10}};}
test('learning statistics separate evaluations and baseline from real training outcomes',()=>{
 const records=[record('baseline',0,'dead'),record('training',1,'dead',7,10),record('training',2,'budget',9,15),record('evaluation',2,'won',10,100),record('training',3,'won',10,300),record('evaluation',3,'won',10,300),record('training',4,'won',10,250)];
 const copy=structuredClone(records),p=learningProgress([...records,records[0]],2);
 assert.equal(p.summary.count,4);assert.equal(p.summary.wins,2);assert.equal(p.summary.winRate,50);assert.equal(p.summary.firstWin,3);assert.equal(p.summary.bestWinTicks,250);
 assert.equal(p.summary.deaths,1);assert.equal(p.summary.limited,1);assert.equal(p.evaluations.length,2);assert.equal(p.baselines.length,1);
 assert.deepEqual(p.training.map(p=>p.rollingWinRate),[0,0,50,100]);assert.deepEqual(p.training.map(p=>p.bestWinTicks),[null,null,300,250]);
 assert.deepEqual(p.training.map(p=>p.bestDiamonds),[7,9,10,10]);assert.deepEqual(records,copy);
});
test('graphs use all archived training, retain gaps and do not invent successes for an empty history',()=>{
 const records=Array.from({length:150},(_,i)=>record('training',i+10,i===0?'won':'dead',i===0?10:5,300));
 const p=learningProgress(records.reverse());assert.equal(p.summary.count,150);assert.equal(p.summary.firstWin,10);assert.equal(p.training[0].attempt,10);assert.equal(p.training.at(-1).attempt,159);assert.equal(p.training.at(-1).bestWinTicks,300);
 assert.equal(p.training.at(-1).rollingWinRate,0);assert.equal(learningProgress([]).summary.winRate,null);assert.equal(learningProgress([]).summary.bestWinTicks,null);
 assert.equal(learningProgress([record('evaluation',20,'won',10,100)]).summary.wins,0);
});
