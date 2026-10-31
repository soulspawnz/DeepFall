import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.mjs';
import { decodeOriginal } from '../original-caves.mjs';
import { readFileSync } from 'node:fs';
function fixture(rows,extra={}) {
 let player;
 const grid=rows.map((row,y)=>[...row].map((tile,x)=>{if(tile==='@'){player={x,y};return ' ';}return tile;}));
 const game=new Game(0,'classic',{grid,player,original:true,birth:0,target:1,time:150,...extra});game.start();return game;
}
test('original stationary rocks first enter falling state, then descend once per scan',()=>{
 const game=fixture(['#####','# O #','#   #','# @ #','#####']);
 game.step();assert.equal(game.tile(2,1),'O');assert(game.falling.has('2,1'));
 game.step();assert.equal(game.tile(2,2),'O');assert.equal(game.status,'playing');
 game.step();assert.equal(game.status,'dead');
});
test('original entrance protects the player while the cave warms up, without spending the level timer',()=>{
 const game=new Game(0,'classic',null,{campaign:'original',difficulty:1});game.start();
 const spawn={...game.player};
 game.step({dx:1});assert.equal(game.born,false);assert.deepEqual(game.player,spawn);assert.equal(game.remaining,150);
 while(!game.born) game.step();
 assert.equal(game.tile(spawn.x,spawn.y),' ');assert.equal(game.status,'playing');
});
test('magic walls transform falling rocks to diamonds, and diamonds to rocks, with shared timed activation',()=>{
 for(const [from,to] of [['O','*'],['*','O']]) {
  const game=fixture(['#######',`#  ${from}  #`,'#  M  #','#     #','#@....#','#######'],{magicTime:2,falling:['3,1']});
  game.step();assert.equal(game.tile(3,1),' ');assert.equal(game.tile(3,3),to);assert(game.magic.active);assert(game.magic.remaining<2);
 }
 const blocked=fixture(['#######','#  O  #','#  M  #','#  .  #','#@....#','#######'],{magicTime:2,falling:['3,1']});
 blocked.step();assert.equal(blocked.tile(3,1),' ');assert.equal(blocked.tile(3,3),'.');
 const expired=fixture(['#######','#  O  #','#  M  #','#     #','#@....#','#######'],{magicTime:0,falling:['3,1']});
 expired.step();assert.equal(expired.tile(3,1),'O');assert.equal(expired.magic.active,false);
});
test('enclosed amoeba becomes diamonds; oversized unconfined amoeba becomes boulders',()=>{
 const enclosed=fixture(['#######','#@.#..#','###a###','#######']);
 enclosed.step();assert.equal(enclosed.amoeba.dead,'*');enclosed.step();assert.equal(enclosed.tile(3,2),'*');
 const large=fixture(['#######','#@....#','#.aa..#','#.....#','#######'],{amoebaMax:1});
 large.step();assert.equal(large.amoeba.dead,'O');large.step();assert.equal(large.tile(2,2),'O');
});
test('enemy contact with amoeba detonates, and butterfly diamond explosions resolve after five stages',()=>{
 const contact=fixture(['#######','#@....#','#..ba.#','#.....#','#######']);
 contact.step();assert.equal(contact.tile(3,2),'d');assert(contact.blasts.size>0);
 const crush=fixture(['#######','#  O  #','#..b..#','#.....#','#@....#','#######'],{falling:['3,1']});
 crush.step();assert.equal(crush.tile(3,2),'d');
 for(let i=0;i<5;i++) crush.step();
 assert.equal(crush.tile(3,2),'*');assert.equal(crush.blasts.size,0);
});
test('an enemy explosion consumes brick and magic walls, preserving steel and outboxes',()=>{
 const game=fixture(['#######','#@....#','#..O..#','#.+fM.#','#..X..#','#######'],{falling:['3,2']});
 game.step();assert.equal(game.tile(2,3),'e');assert.equal(game.tile(4,3),'e');assert.equal(game.tile(3,4),'X');assert.equal(game.tile(0,0),'#');
});
test('original diamond values include the specified zero extra value',()=>{
 const game=fixture(['#######','#@**X #','#######'],{diamondValue:15,extraDiamondValue:0});
 game.step({dx:1});assert.equal(game.score,15);game.step({dx:1});assert.equal(game.score,15);
});
test('echo restores original mechanics, random state and birth state coherently',()=>{
 const game=new Game(7,'echo',null,{campaign:'original',difficulty:1});game.start();
 const state=game.snapshot();for(let i=0;i<8;i++) game.step();
 assert(game.rewind());assert.deepEqual(game.snapshot(),state);assert.equal(game.rewinds,2);
});
test('all 100 original variants initialize and survive bounded unattended simulation without invalid state',()=>{
 for(let d=1;d<=5;d++) for(let i=0;i<20;i++) {
  const game=new Game(i,'classic',null,{campaign:'original',difficulty:d});game.start();
  for(let tick=0;tick<60;tick++) game.step();
  assert(Number.isFinite(game.remaining));assert(Number.isFinite(game.score));
  assert(game.grid.every(row=>row.length===40));
  assert.equal(game.target,decodeOriginal(i,d).target);
 }
});
test('the original Intro has a complete winning route under the original rules',()=>{
 const input=JSON.parse(readFileSync(new URL('./original-intro-winning-input.json',import.meta.url)));
 const game=new Game(0,'classic',null,{campaign:'original',difficulty:1});game.start();
 for(const [dx,dy] of input)game.step({dx,dy});
 assert.equal(game.status,'won');assert.equal(game.collected,14);assert.deepEqual(game.player,{x:38,y:16});
});
