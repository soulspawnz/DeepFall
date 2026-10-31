import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.mjs';
import {generationTargets,planningKey,planRoute} from '../route-planner.mjs';
import {LearningPlayer} from '../learning-player.mjs';
function fixture(rows,extra={}){let player;const grid=rows.map((r,y)=>[...r].map((t,x)=>{if(t==='@'){player={x,y};return ' ';}return t;}));return {grid,player,original:true,birth:0,target:1,time:150,...extra};}

test('magic setup distinguishes blocked outlet, rock feed, and expired activation',()=>{
 const layout=fixture(['#########','#   O   #','#   .   #','#   M   #','# @ .   #','#      X#','#########'],{magicTime:20});
 const game=new Game(0,'classic',layout);game.start();
 const targets=generationTargets(game);assert.equal(targets.get('4,4').kind,'magic-outlet');assert.equal(targets.get('4,2').kind,'magic-feed');assert.ok(targets.get('4,4').value>targets.get('4,2').value);
 const idleKey=planningKey(game);game.magic.remaining=0;assert.notEqual(planningKey(game),idleKey);assert.equal(generationTargets(game).size,0);
});

test('planner clears an outlet, converts a rock, collects a real diamond and exits',()=>{
 const layout=fixture(['#########','#   O   #','#   .   #','#   M   #','# @ .   #','#      X#','#########'],{magicTime:20});
 const context={campaign:'original',index:0,difficulty:1},steps=planRoute(context,{fixture:layout,maxNodes:64,maxTicks:300});let next;do{next=steps.next();}while(!next.done);
 assert.equal(next.value.game.status,'won');assert.equal(next.value.game.collected,1);
 const replay=new Game(0,'classic',layout);replay.start();let activated=false,produced=false;
 for(const [dx,dy,snap]of next.value.input){replay.step({dx,dy,snap});activated||=replay.magic.active;produced||=replay.grid.some(r=>r.includes('*'));}
 assert.ok(activated);assert.ok(produced);assert.equal(replay.status,'won');
});

test('amoeba access and pending conversion are handled without turning rock conversion into a goal',()=>{
 const game=new Game(0,'classic',fixture(['########','#@.....#','#..a...#','#.....X#','########']));game.start();
 assert.equal(generationTargets(game).get('3,1').kind,'amoeba-access');
 game.amoeba.dead='O';assert.equal(generationTargets(game).size,0);
});

test('planner harvests an enclosed amoeba after real conversion and moves the blocking rock',()=>{
 const layout=fixture(['#########','#       #','#   O  X#','#       #','####a####','#########']);
 layout.player={x:2,y:2};
 const context={campaign:'original',index:0,difficulty:1},steps=planRoute(context,{fixture:layout,maxNodes:64,maxTicks:300});let next;do{next=steps.next();}while(!next.done);
 assert.equal(next.value.game.status,'won');assert.equal(next.value.game.collected,1);
 const replay=new Game(0,'classic',layout);replay.start();let converted=false;
 for(const [dx,dy,snap]of next.value.input){replay.step({dx,dy,snap});converted||=replay.amoeba.dead==='*';}
 assert.ok(converted);assert.equal(replay.status,'won');
});

test('generation planning keeps old learning and replay summaries on upgrade',()=>{
 const context={campaign:'original',index:7,difficulty:1},old=new LearningPlayer(context);old.upgrade();old.attempts=12;old.values.set('old-decision',{n:4,mean:12});old.searchVisited=[['s2:old',31]];
 const restored=new LearningPlayer(context,JSON.parse(JSON.stringify(old.export())));restored.upgrade();
 assert.equal(restored.attempts,12);assert.deepEqual(restored.values.get('old-decision'),{n:4,mean:12});assert.deepEqual(restored.searchVisited,[['s2:old',31]]);
});
