import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,TRAPPED_DELAY,TRAPPED_TIMER_RATE} from '../engine.mjs';

function cave(mode='classic',fastTrappedTimer=true){
 const grid=Array.from({length:22},()=>Array(40).fill('#'));
 grid[5][5]=' ';
 const game=new Game(0,mode,{grid,player:{x:5,y:5},target:1,time:150},{fastTrappedTimer});game.start();return game;
}
test('confirmed steel entrapment drains at 10x only after its grace period',()=>{
 const game=cave();assert.equal(game.isTrapped(),true);
 for(let n=0;n<Math.ceil(TRAPPED_DELAY/STEP)-1;n++)game.step();
 assert.equal(game.timerRate,1);const before=game.remaining;
 game.step();assert.equal(game.timerRate,TRAPPED_TIMER_RATE);assert.ok(Math.abs(before-game.remaining-STEP*10)<1e-8);
 game.remaining=.1;game.step();assert.equal(game.status,'dead');assert.equal(game.remaining,0);
});
test('standing still, dirt, snap diamonds and an unlocked exit keep normal time',()=>{
 for(const tile of [' ','.','*','X']){
  const game=cave();game.set(6,5,tile);if(tile==='X')game.collected=game.target;
  for(let n=0;n<20;n++)game.step();assert.equal(game.timerRate,1,tile);assert.equal(game.trappedFor,0,tile);
 }
});
test('a possible probabilistic push or vacating enemy never counts as trapped',()=>{
 for(const beyond of [' ','f']){
  const game=cave();game.original=true;game.set(6,5,'O');game.set(7,5,beyond);
  assert.equal(game.isTrapped(),false);
 }
 const game=cave();game.set(6,5,'b');assert.equal(game.isTrapped(),false);
});
test('temporary falling/rolling blocks, amoeba and explosions defer confirmation',()=>{
 const game=cave();game.set(6,5,'O');game.set(6,6,' ');assert.equal(game.isTrapped(),false);
 game.set(6,6,'#');game.set(6,5,'+');game.falling.add('10,10');assert.equal(game.isTrapped(),false);
 game.falling.clear();game.set(10,10,'a');assert.equal(game.isTrapped(),false);
 game.set(10,10,'#');game.blasts.set('6,5',{age:0,result:' '});assert.equal(game.isTrapped(),false);
});
test('a stable boulder cage is trapped even when an isolated enemy is moving elsewhere',()=>{
 const game=cave();for(const [x,y]of [[4,5],[6,5],[5,4],[5,6]])game.set(x,y,'O');
 game.set(10,10,'f');game.set(11,10,' ');assert.equal(game.isTrapped(),true);
 game.set(9,9,'O');game.set(9,10,'f');assert.equal(game.isTrapped(),false,'enemy can vacate a gravity path');
});
test('birth, pause, rewind, release and legacy recordings preserve correct timing',()=>{
 const legacy=cave('classic',false);for(let n=0;n<20;n++)legacy.step();assert.equal(legacy.timerRate,1);assert.ok(Math.abs(150-legacy.remaining-20*STEP)<1e-8);
 const game=cave('echo');game.born=false;assert.equal(game.isTrapped(),false);game.born=true;
 for(let n=0;n<12;n++)game.step();assert.equal(game.timerRate,10);
 game.pause();const snapshot=game.snapshot();game.step();assert.deepEqual(game.snapshot(),snapshot);
 assert.ok(game.rewind());assert.equal(game.timerRate,1);assert.equal(game.trappedFor,0);
 for(let n=0;n<12;n++)game.step();game.set(6,5,' ');game.step();assert.equal(game.timerRate,1);assert.equal(game.trappedFor,0);
});
