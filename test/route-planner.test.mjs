import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LearningPlayer,contextKey} from '../learning-player.mjs';
import {Game} from '../engine.mjs';
import {verifyLearningReplay,learningReplay} from '../learning-archive.mjs';
import {diamondPotential,planRoute} from '../route-planner.mjs';

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

test('diamond supply counts future butterfly blasts and exempts regenerating worlds',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));
 grid[3][2]=' ';grid[4][4]='b';grid[4][5]='*';grid[4][6]='d';
 const g=new Game(0,'classic',{grid,player:{x:2,y:3},target:36,time:150});g.collected=25;
 assert.equal(diamondPotential(g),36);
 g.grid[4][5]=' ';g.grid[4][6]=' ';assert.equal(diamondPotential(g),34);
 g.grid[4][6]='M';assert.equal(diamondPotential(g),Infinity);
 g.grid[4][6]='a';assert.equal(diamondPotential(g),Infinity);
});

test('branch previews describe bounded, actual movement from the expanded candidate',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));
 for(let y=2;y<7;y++)for(let x=2;x<12;x++)grid[y][x]='.';grid[4][10]='*';
 const fixture={grid,player:{x:4,y:4},target:1,time:150};
 const progress=planRoute({campaign:'original',index:0,difficulty:1},{fixture,maxNodes:1}).next();
 assert.equal(progress.done,false);const {previewBranches,searchPosition}=progress.value;
 assert.ok(previewBranches.length>1&&previewBranches.length<=12);
 for(const b of previewBranches){
  assert.deepEqual(b.points[0],searchPosition);assert.equal(typeof b.dead,'boolean');assert.ok(b.points.length<=33);
  for(let i=1;i<b.points.length;i++){const [x,y]=b.points[i],[px,py]=b.points[i-1];assert.equal(Math.abs(x-px)+Math.abs(y-py),1);assert.notEqual(grid[y][x],'#');}
 }
});

test('a butterfly blast that destroys a required loose diamond cannot seed the best partial',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));
 for(let y=1;y<9;y++)for(let x=1;x<11;x++)grid[y][x]='.';
 grid[3][5]=' ';grid[2][6]='O';grid[4][6]=' ';grid[5][6]='b';grid[4][5]='*';grid[7][9]='X';
 const fixture={grid,player:{x:5,y:3},target:10,time:150,original:true,birth:0};
 const context={campaign:'original',index:3,difficulty:1};
 const doomed=[[1,0,true],[-1,0,false],[-1,0,false],...Array.from({length:6},()=>[0,0,false])];
 const g=new Game(3,'classic',fixture,context);g.start();for(const [dx,dy,snap]of doomed)g.step({dx,dy,snap});
 assert.equal(g.status,'playing');assert.equal(diamondPotential(g),9);
 const planner=planRoute(context,{fixture,maxNodes:0,prefixes:[doomed]});let step;do{step=planner.next();}while(!step.done);
 assert.ok(diamondPotential(step.value.game)>=10,'reject the doomed checkpoint even when supplied as a saved prefix');
});
