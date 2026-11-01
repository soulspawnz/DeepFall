import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.mjs';
import {cloneGame} from '../simulation.mjs';
import {planningKey} from '../route-planner.mjs';

function referenceKey(game){const state=game.snapshot();delete state.remaining;delete state.tick;delete state.trappedFor;delete state.score;if(!game.grid.some(row=>row.includes('a')))state.amoeba={dead:null,slow:0};return JSON.stringify(state);}
test('search keys remain byte-compatible with persisted snapshot keys across all original variants',()=>{
 for(let difficulty=1;difficulty<=5;difficulty++)for(let index=0;index<20;index++){
  const game=new Game(index,'classic',null,{campaign:'original',difficulty});game.start();
  for(let n=0;n<35;n++){
   assert.equal(planningKey(game),referenceKey(game));game.step({dx:n%3===0?1:0,dy:n%3===1?1:0,snap:n%7===0});
  }
 }
});

test('simulation cloning retains scalar and snapshot state while isolating all mutable physics collections',()=>{
 const game=new Game(0,'echo');game.start();game.step({dx:1});game.blasts.set('4,4',{age:2,result:'*'});game.facings.set('5,5',2);game.falling.add('6,6');
 const before=game.snapshot(),copy=cloneGame(game);assert.deepEqual(copy.snapshot(),before);assert.equal(copy.mode,game.mode);assert.equal(copy.status,game.status);assert.equal(copy.fastTrappedTimer,game.fastTrappedTimer);assert.deepEqual(copy.history,[]);assert.deepEqual(copy.events,[]);
 copy.grid[1][1]='#';copy.player.x++;copy.magic.remaining++;copy.amoeba.slow++;copy.falling.clear();copy.facings.clear();copy.blasts.get('4,4').age++;
 assert.deepEqual(game.snapshot(),before);assert.notEqual(copy.history,game.history);assert.notEqual(copy.events,game.events);
});
