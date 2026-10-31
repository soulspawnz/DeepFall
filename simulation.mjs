import {Game} from './engine.mjs';

export const ACTIONS=[[0,-1],[1,0],[0,1],[-1,0],[0,0],[0,-1,true],[1,0,true],[0,1,true],[-1,0,true]];

// A simulation must never share mutable physics state with its parent.
export function cloneGame(game) {
 const copy=Object.create(Game.prototype);Object.assign(copy,game);
 const state=game.snapshot();Object.assign(copy,state);
 copy.falling=new Set(state.falling);copy.facings=new Map(state.facings);copy.blasts=new Map(state.blasts);
 copy.history=[];copy.events=[];
 return copy;
}

export function simulateStep(game,action) {
 const copy=cloneGame(game);copy.step({dx:action[0],dy:action[1],snap:Boolean(action[2])});return copy;
}
