import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CAVES, makeCave, WIDTH, HEIGHT } from '../engine.mjs';

function fixture(rows, extra = {}, mode = 'classic') {
  let player;
  const grid = rows.map((row, y) => [...row].map((tile, x) => {
    if (tile === '@') { player = { x, y }; return ' '; }
    return tile;
  }));
  const game = new Game(0, mode, { grid, player, ...extra }); game.start(); return game;
}
test('digging and snap collection change terrain, but snap leaves the player in place', () => {
  const game = fixture(['#######', '#@.* X#', '#######']);
  game.step({ dx: 1 }); assert.equal(game.player.x, 2); assert.equal(game.tile(2, 1), ' ');
  game.step({ dx: 1, snap: true }); assert.equal(game.player.x, 2); assert.equal(game.collected, 1);
});
test('a loose object moves once per tick and a falling rock kills on the following tick', () => {
  const game = fixture(['#####', '# O #', '#   #', '# @ #', '#####']);
  game.step(); assert.equal(game.tile(2, 2), 'O'); assert.equal(game.status, 'playing');
  game.step(); assert.equal(game.status, 'dead');
});
test('a stationary rock directly above the player is supported until the player moves', () => {
  const game = fixture(['######', '# O  #', '# @  #', '#....#', '######']);
  game.step(); assert.equal(game.status, 'playing'); assert.equal(game.tile(2, 1), 'O');
  game.step({ dx: 1 }); assert.equal(game.tile(2, 2), 'O'); assert.equal(game.status, 'playing');
});
test('rounded supports roll left, only if both the side and diagonal are clear', () => {
  const game = fixture(['#######', '#  O  #', '#  +  #', '#@....#', '#######']);
  game.step(); assert.equal(game.tile(2, 1), 'O'); assert.equal(game.tile(3, 1), ' ');
  game.step(); assert.equal(game.tile(2, 2), 'O');
});
test('horizontal pushes work when clear; walls and vertical pushes block', () => {
  const game = fixture(['########', '#@O ...#', '#......#', '########']);
  game.step({ dx: 1 }); assert.equal(game.player.x, 2); assert.equal(game.tile(3, 1), 'O');
  game.step({ dx: 1 }); assert.equal(game.player.x, 2);
});
test('exit remains closed below quota and wins immediately on entering at quota', () => {
  const game = fixture(['#######', '#@*X  #', '#######'], { target: 1 });
  game.step({ dx: 1 }); assert.equal(game.collected, 1);
  game.step({ dx: 1 }); assert.equal(game.status, 'won'); assert.equal(game.player.x, 3);
  const closed = fixture(['#####', '#@X #', '#####'], { target: 1 });
  closed.step({ dx: 1 }); assert.equal(closed.player.x, 1); assert.equal(closed.status, 'playing');
});
test('butterfly crush makes diamonds and steel boundaries survive the blast', () => {
  const game = fixture(['#######', '#  O  #', '#     #', '#..b..#', '#.....#', '#@....#', '#######']);
  game.step(); game.step();
  assert.equal(game.tile(3, 3), '*'); assert.equal(game.tile(3, 2), '*');
  assert.equal(game.grid.flat().filter(tile => tile === '*').length, 9);
});
test('enemy adjacency is lethal', () => {
  const game = fixture(['#####', '#@f #', '#...#', '#####']);
  game.step(); assert.equal(game.status, 'dead'); assert.equal(game.tile(0, 1), '#');
});
test('pause freezes the world and the timer expires', () => {
  const game = fixture(['#####', '#@..#', '#####'], { time: .2 });
  game.pause(); game.step(); assert.equal(game.remaining, .2); assert.equal(game.tick, 0);
  game.pause(); game.step(); game.step(); assert.equal(game.status, 'dead');
});
test('echo restores a complete pre-death state without restoring spent charges', () => {
  const game = fixture(['#####', '# O #', '#   #', '# @ #', '#####'], {}, 'echo');
  game.step(); game.step(); assert.equal(game.status, 'dead');
  assert.equal(game.rewind(), true); assert.equal(game.status, 'playing'); assert.equal(game.tick, 0);
  assert.equal(game.tile(2, 1), 'O'); assert.equal(game.rewinds, 2); assert.equal(game.falling.size, 0);
  assert.equal(game.rewind(), false);
  game.step(); assert.equal(game.rewind(), true); assert.equal(game.rewinds, 1);
});
test('classic mode cannot rewind', () => {
  const game = fixture(['#####', '#@..#', '#####']);
  game.step({ dx: 1 }); assert.equal(game.rewind(), false);
});
test('all caves are deterministic, bounded, and winnable along their switchback route', () => {
  for (let index = 0; index < CAVES.length; index++) {
    assert.deepEqual(makeCave(index), makeCave(index));
    const game = new Game(index, 'classic');
    assert.equal(game.grid.length, HEIGHT); assert(game.grid.every(row => row.length === WIDTH));
    game.start();
    const walk = (dx, dy, steps) => { for (let i = 0; i < steps; i++) game.step({ dx, dy }); };
    walk(1, 0, 35); walk(0, 1, 5); walk(-1, 0, 35); walk(0, 1, 5); walk(1, 0, 35); walk(0, 1, 5);
    assert.equal(game.status, 'won', `cave ${index + 1}: ${game.reason}`);
    assert(game.collected >= game.target);
  }
});
