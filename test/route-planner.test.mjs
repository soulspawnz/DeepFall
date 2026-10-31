import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LearningPlayer,contextKey} from '../learning-player.mjs';
import {Game} from '../engine.mjs';
import {verifyLearningReplay,learningReplay} from '../learning-archive.mjs';

test('planning preserves prior learning, uses saved runs and reproduces a real original exit',()=>{
 const context={campaign:'original',index:0,difficulty:1},p=new LearningPlayer(context);
 const baseline=p.run({learn:false});p.attempts=37;p.values.set('historical-entry',{n:5,mean:42});
 p.rememberPartials([baseline]);p.upgrade();
 const run=p.run({searchNodes:32});assert.equal(run.status,'won');assert.equal(p.attempts,38);assert.ok(run.reusedPartials>0);
 assert.deepEqual(p.values.get('historical-entry'),{n:5,mean:42});assert.ok(verifyLearningReplay(learningReplay(context,'training',38,run)));
 const restored=new LearningPlayer(context,JSON.parse(JSON.stringify(p.export()))),evaluation=restored.run({learn:false,searchNodes:32});
 assert.equal(evaluation.status,'won');assert.equal(evaluation.route,p.best.route);assert.equal(restored.attempts,38);
 const g=new Game(0,'classic',null,{...context,fastTrappedTimer:true});g.start();for(const [dx,dy,snap]of evaluation.input)g.step({dx,dy,snap});assert.equal(g.status,'won');
 assert.equal(contextKey(restored.partials[0]),contextKey(context));
});
test('unfinished search branches and explored states survive serialization for a later attempt',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));for(let x=1;x<8;x++)grid[3][x]=' ';grid[3][4]='*';
 const fixture={grid,player:{x:2,y:3},target:1,time:150},context={campaign:'original',index:1,difficulty:1},p=new LearningPlayer(context);p.upgrade();
 const run=p.run({fixture,searchNodes:8});assert.equal(run.status,'budget');assert.equal(run.diamonds,1);assert.ok(p.partials.length);assert.ok(p.searchVisited.length);assert.ok(p.frontier.length);
 const saved=p.export(),restored=new LearningPlayer(context,JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(restored.frontier,p.frontier);assert.deepEqual(restored.searchVisited,p.searchVisited);
 const next=restored.run({fixture,searchNodes:8});assert.equal(next.status,'budget');assert.equal(next.diamonds,1);assert.ok(next.reusedPartials>0);assert.equal(restored.attempts,2);
});
