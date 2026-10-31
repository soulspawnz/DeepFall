import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.mjs';
import {cloneGame} from '../simulation.mjs';
import {LearningPlayer,LEARNING_VERSION} from '../learning-player.mjs';

test('learning changes the evaluated policy, explores routes, survives serialization and retains a real win',()=>{
 const context={campaign:'original',index:0,difficulty:1},learner=new LearningPlayer(context);
 const before=learner.run({learn:false});assert.equal(learner.attempts,0);
 for(let n=0;n<10;n++)learner.run();
 const after=learner.run({learn:false});
 assert.equal(before.status,'won');assert.equal(after.status,'won');
 assert.ok(after.ticks<before.ticks,`learned ${after.ticks}, untrained ${before.ticks}`);
 assert.ok(new Set(learner.results.map(r=>r.route)).size>=3);
 assert.equal(learner.attempts,10);assert.ok(learner.values.size>0);
 const stored=JSON.parse(JSON.stringify(learner.export())),restored=new LearningPlayer(context,stored);
 assert.deepEqual(restored.run({learn:false}),after);
 const playback=new Game(0,'classic',null,context);playback.start();
 for(const [dx,dy,snap]of restored.best.input)playback.step({dx,dy,snap});
 assert.equal(playback.status,'won');assert.equal(playback.score,restored.best.score);
 assert.equal(playback.collected,restored.best.diamonds);
 assert.equal(new LearningPlayer({...context,index:1},stored).attempts,0);
 assert.equal(new LearningPlayer(context,{...stored,version:'old'}).attempts,0);
 console.log(`[OK] A learned policy: ${before.ticks} -> ${after.ticks} steps; ${new Set(learner.results.map(r=>r.route)).size} routes.`);
});

test('physics clones cannot change their parent',()=>{
 const g=new Game(0,'classic',null,{campaign:'original',difficulty:1});g.start();
 const original=g.snapshot(),copy=cloneGame(g);copy.step({dx:1,dy:0});copy.grid[1][1]='O';copy.magic.active=true;copy.amoeba.slow=0;
 assert.deepEqual(g.snapshot(),original);
});

test('malformed stored action values are rejected without crashing',()=>{
 const context={campaign:'original',index:0,difficulty:1};
 const p=new LearningPlayer(context,{version:LEARNING_VERSION,context,values:[null,4,{},['key',{n:1,mean:Infinity}],['ok',{n:2,mean:3}]]});
 assert.equal(p.values.size,1);
});
