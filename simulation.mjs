import {Game} from './engine.mjs';

export const ACTIONS=[[0,-1],[1,0],[0,1],[-1,0],[0,0],[0,-1,true],[1,0,true],[0,1,true],[-1,0,true]];

// A simulation must never share mutable physics state with its parent.
export function cloneGame(game) {
 const copy=Object.create(Game.prototype);Object.assign(copy,game);
 // Copy mutable physics fields directly; snapshot() would allocate temporary
 // arrays and a second object only to wrap those collections again.
 copy.grid=game.grid.map(row=>[...row]);copy.player={...game.player};
 copy.magic={...game.magic};copy.amoeba={...game.amoeba};
 copy.falling=new Set(game.falling);copy.facings=new Map(game.facings);
 copy.blasts=new Map();for(const [cell,blast]of game.blasts)copy.blasts.set(cell,{...blast});
 copy.history=[];copy.events=[];
 return copy;
}

export function simulateStep(game,action) {
 const copy=cloneGame(game);copy.step({dx:action[0],dy:action[1],snap:Boolean(action[2])});return copy;
}
