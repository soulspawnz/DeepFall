import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.mjs';
import {cloneGame} from '../simulation.mjs';
import {amoebaState,amoebaFence,amoebaTargets,amoebaEscape,amoebaContainPlan,planRoute,amoebaSummary} from '../route-planner.mjs';
import {learningReplay,verifyLearningReplay,validLearningReplay} from '../learning-archive.mjs';
import {inputFingerprint,planningPrefixes} from '../learning-player.mjs';
function layout(rows,extra={}){let player;const grid=rows.map((r,y)=>[...r].map((t,x)=>{if(t==='@'){player={x,y};return ' ';}return t;}));return {grid,player,original:true,birth:0,target:4,time:150,amoebaMax:8,amoebaTime:75,...extra};}
const pocket=()=>layout(['##########','# @      #','#   O   X#','#   .    #','####a#####','####a#####','####.#####','####.#####','##########']);
test('dirt, occupied cells, enemies and falling objects do not establish stable enclosure',()=>{
 const g=new Game(0,'classic',pocket());g.start();const before=g.snapshot(),s=amoebaState(g);assert.equal(s.phase,'growing');assert.ok(s.frontier.length);assert.deepEqual(g.snapshot(),before);
 g.grid[3][4]='O';g.falling.add('4,3');assert.equal(amoebaState(g).phase,'growing');g.falling.clear();assert.equal(amoebaState(g).phase,'bounded');assert.equal(amoebaState(g).capacity,4);
 g.grid[3][4]=' ';g.player={x:4,y:3};assert.equal(amoebaState(g).phase,'growing');g.grid[3][4]='f';assert.equal(amoebaState(g).phase,'growing');
});
test('containment targets propose a real cap and exclude insufficient conversion pockets',()=>{
 const g=new Game(0,'classic',pocket());g.start();const f=amoebaFence(g),targets=amoebaTargets(g,f);assert.ok(f);assert.ok(f.yieldSize>=4);assert.equal(targets.get('4,3').kind,'amoeba-cap');assert.equal(g.collected,0);
 g.grid[3][4]='O';g.target=5;const state=amoebaState(g);assert.equal(state.phase,'bounded');assert.equal(state.viable,false);
});
test('event planning seals the pocket, retreats outside and waits for actual diamond conversion',()=>{
 const f={...pocket(),amoebaTime:1},g=new Game(0,'classic',f);g.start();const before=g.snapshot(),r=amoebaContainPlan(g,{depth:48,width:32,maxInputs:220});assert.ok(r.game);assert.equal(r.game.amoeba.dead,'*');assert.notEqual(r.game.status,'dead');assert.deepEqual(g.snapshot(),before);
 const replay=new Game(0,'classic',f);replay.start();for(const[dx,dy,snap]of r.input)replay.step({dx,dy,snap});assert.deepEqual(replay.snapshot(),r.game.snapshot());assert.ok(replay.collected+replay.grid.flat().filter(t=>t==='a'||t==='*').length>=4);
});
test('a bounded colony still growing is not reported as confirmed diamonds',()=>{
 const g=new Game(0,'classic',pocket());g.start();const r=amoebaContainPlan(g,{depth:48,width:32,maxInputs:220});assert.ok(r.game);assert.equal(r.phase,'bounded');assert.equal(r.game.amoeba.dead,null);assert.ok(amoebaState(r.game).outside);
});
test('escape forecasts include growth and delayed gravity rather than trusting current mobility',()=>{
 const g=new Game(0,'classic',layout(['#########','#      X#','#   O   #','#       #','#   @   #','##aa#####','#########'],{target:1,amoebaMax:20}));g.start();g.falling.add('4,2');const before=g.snapshot(),r=amoebaEscape(g,{depth:12,width:12,hold:4});assert.ok(r.game);assert.notEqual(r.game.status,'dead');assert.deepEqual(g.snapshot(),before);const replay=cloneGame(g);for(const[dx,dy,snap]of r.input)replay.step({dx,dy,snap});assert.deepEqual(replay.snapshot(),r.game.snapshot());
});
test('rock conversion gets no diamond phase and event work rejects invalid bounds',()=>{
 const g=new Game(0,'classic',pocket());g.start();g.amoeba.dead='O';assert.equal(amoebaState(g).phase,'rocks');assert.equal(amoebaContainPlan(g).simulated,0);assert.throws(()=>amoebaContainPlan(g,{width:1000}),/bounds/);assert.throws(()=>amoebaEscape(g,{depth:1000}),/bounds/);
});
test('a long pursuing fall requires leaving its shaft before an escape is accepted',()=>{
 const g=new Game(0,'classic',layout(['#########','#   O  X#','#       #','#       #','#       #','#       #','#   @   #','#       #','##aa#####','#########'],{target:1,amoebaMax:8,amoebaTime:75}));g.start();g.falling.add('4,1');const r=amoebaEscape(g,{depth:8,width:12,hold:2});assert.ok(r.game);assert.notEqual(r.game.player.x,4);const replay=cloneGame(g);for(const[dx,dy,snap]of r.input)replay.step({dx,dy,snap});for(let n=0;n<10;n++)replay.step();assert.notEqual(replay.status,'dead');
});
test('the full planner harvests a capped pocket and reaches the real exit',()=>{
 const f={...pocket(),amoebaTime:1},steps=planRoute({campaign:'original',index:0,difficulty:1},{fixture:f,maxNodes:192,maxTicks:500});let step;do{step=steps.next();}while(!step.done);
 assert.equal(step.value.game.status,'won');assert.equal(step.value.game.collected,4);const replay=new Game(0,'classic',f);replay.start();for(const[dx,dy,snap]of step.value.input)replay.step({dx,dy,snap});assert.deepEqual(replay.snapshot(),step.value.game.snapshot());
});
test('imported amoeba metadata must match the actual replayed world',()=>{
 const c={campaign:'original',index:7,difficulty:1},g=new Game(7,'classic',null,c),input=Array.from({length:30},()=>[0,0,false]);g.start();for(const[dx,dy,snap]of input)g.step({dx,dy,snap});
 const run={...c,status:'budget',diamonds:g.collected,target:g.target,ticks:input.length,score:g.score,remaining:g.remaining,route:inputFingerprint(input),input,fastTrappedTimer:true,amoebaPlanning:amoebaSummary(g),searchAmoebaSteps:0},record=learningReplay(c,'training',1,run);verifyLearningReplay(record);
 const corrupt=structuredClone(record);corrupt.run.amoebaPlanning.size++;assert.throws(()=>verifyLearningReplay(corrupt),/amoeba/);corrupt.run.amoebaPlanning.phase='imaginary';assert.equal(validLearningReplay(corrupt),false);
});
test('strategic branch memory remains inside the seed budget while other routes still rotate',()=>{
 const frontier=Array.from({length:64},(_,i)=>[...Array.from({length:i+1},()=>[0,0,false]),[1,0,false]]),memories=[{status:'budget',input:[[0,1,false]]}],before=JSON.stringify({frontier,memories}),prefixes=planningPrefixes(memories,frontier,6,{strategic:true});
 for(const input of frontier.slice(0,8))assert.ok(prefixes.slice(0,12).includes(input));assert.ok(prefixes.slice(0,12).includes(frontier[42]));assert.equal(prefixes[0],memories[0].input);assert.equal(new Set(prefixes.map(JSON.stringify)).size,prefixes.length);assert.equal(JSON.stringify({frontier,memories}),before);
 assert.equal(planningPrefixes([],frontier,6)[0],frontier[42]);
});
