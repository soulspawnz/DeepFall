import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.mjs';
import {butterflyTargets,butterflyTrapPlan,butterflyReadiness,planRoute,planningKey,PRIORITY_DEFAULTS} from '../route-planner.mjs';
function fixture(){
 const grid=Array.from({length:10},(_,y)=>Array.from({length:11},(_,x)=>x===0||x===10||y===0||y===9?'#':'.'));
 for(const [x,y]of [[5,5],[6,5],[5,6],[6,6],[4,4],[6,3]])grid[y][x]=' ';
 grid[3][7]='O';grid[4][7]='#';grid[6][5]='b';grid[8][9]='X';
 return {grid,player:{x:4,y:4},original:true,birth:0,target:9,time:150};
}
test('butterfly setup targets include lower shaft preparation without inventing diamonds',()=>{
 const layout=fixture();layout.grid[4][7]='.';const g=new Game(0,'classic',layout);g.start();const before=planningKey(g),targets=butterflyTargets(g);
 assert.ok(targets.has('7,4'));assert.ok(targets.has('7,6'));assert.equal(g.collected,0);assert.equal(g.grid.flat().filter(t=>t==='*'||t==='d').length,0);assert.equal(planningKey(g),before);
 assert.ok(butterflyReadiness(g).value>0);
});
test('event search relocates a rock and creates nine real diamonds with an exact, living replay',()=>{
 const layout=fixture(),g=new Game(0,'classic',layout);g.start();const before=g.snapshot(),r=butterflyTrapPlan(g);
 assert.ok(r.game);assert.ok(r.simulated<=64*64*9);assert.deepEqual(g.snapshot(),before);
 const replay=new Game(0,'classic',layout);replay.start();let pushed=false,blast=false;
 for(const [dx,dy,snap]of r.input){replay.step({dx,dy,snap});pushed||=replay.events.includes('push');blast||=replay.events.includes('blast');}
 assert.ok(pushed);assert.ok(blast);assert.equal(replay.status,'playing');assert.equal(replay.grid.flat().filter(t=>t==='*'||t==='d').length,9);assert.deepEqual(replay.snapshot(),r.game.snapshot());
});
test('a generated supply is harvested through the real exit even with collection-averse weights',()=>{
 const layout=fixture(),steps=planRoute({campaign:'original',index:0,difficulty:1},{fixture:layout,maxNodes:128,maxTicks:400,weights:{...PRIORITY_DEFAULTS,collection:.2,supply:5,preparation:5}});let step;do{step=steps.next();}while(!step.done);
 assert.equal(step.value.game.status,'won');assert.equal(step.value.game.collected,9);
 const replay=new Game(0,'classic',layout);replay.start();for(const [dx,dy,snap]of step.value.input)replay.step({dx,dy,snap});assert.equal(replay.status,'won');assert.deepEqual(replay.snapshot(),step.value.game.snapshot());
});
test('event search skips sufficient supply and rejects unbounded tactical work',()=>{
 const g=new Game(0,'classic',fixture());g.start();g.collected=g.target;assert.equal(butterflyTrapPlan(g).simulated,0);
 assert.throws(()=>butterflyTrapPlan(g,{depth:100000}),/bounds/);assert.throws(()=>butterflyTrapPlan(g,{width:0}),/bounds/);
});
