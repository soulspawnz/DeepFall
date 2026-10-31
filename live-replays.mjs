import {Game} from './engine.mjs';
export const REPLAY_STORAGE_KEY = 'deepfall.live-wins.v1';

// Passive recording only: the game supplies the input it actually consumed.
export class LiveRecording {
  constructor(meta) {
    this.run = {version:1, ...meta, source:'live-input', recordedAt:new Date().toISOString(), actions:[]};
  }
  step(input) {
    if (this.run.actions.length >= 50000) { this.overflow = true; return; }
    this.run.actions.push([input.dx ?? 0, input.dy ?? 0, Boolean(input.snap)]);
  }
  rewind() { this.run.actions.push({rewind:true}); }
  finish(game) {
    if (this.overflow || game.status !== 'won') return null;
    return {...this.run, result:{status:game.status, diamonds:game.collected, score:game.score,
      remaining:game.remaining, rewindsUsed:3-game.rewinds}};
  }
}

export function validLiveRun(run) {
  return run?.version===1 && run.source==='live-input' && ['original','deepfall'].includes(run.campaign)
    && (run.fastTrappedTimer===undefined || typeof run.fastTrappedTimer==='boolean')
    && Number.isInteger(run.index) && run.index>=0 && run.index<(run.campaign==='original'?20:3)
    && Number.isInteger(run.difficulty) && run.difficulty>=1 && run.difficulty<=5
    && ['echo','classic'].includes(run.mode) && run.result?.status==='won'
    && Array.isArray(run.actions) && run.actions.length>0 && run.actions.length<=50000
    && run.actions.every(a=>a?.rewind===true || (Array.isArray(a) && a.length===3
      && Number.isInteger(a[0]) && Number.isInteger(a[1]) && Math.abs(a[0])+Math.abs(a[1])<=1 && typeof a[2]==='boolean'));
}

export function loadLiveRuns(storage) {
  try {
    const value=JSON.parse(storage.getItem(REPLAY_STORAGE_KEY) ?? '[]');
    return Array.isArray(value)?value.filter(validLiveRun).slice(0,10):[];
  } catch { return []; }
}

export function saveLiveRun(storage, run) {
  if (!validLiveRun(run)) throw new Error('The recording is incomplete.');
  const runs=[run,...loadLiveRuns(storage)].slice(0,10);
  storage.setItem(REPLAY_STORAGE_KEY,JSON.stringify(runs));
  return runs;
}

export function applyReplayAction(game, action) {
  if (action?.rewind) {
    if (!game.rewind()) throw new Error('Replay rewind could not be reproduced.');
  } else {
    const [dx,dy,snap=false]=action;
    game.step({dx,dy,snap});
  }
}

export function importLiveRun(storage,run){
 if(!validLiveRun(run))throw new Error('Choose an exported live recording.');
 const game=new Game(run.index,run.mode,null,{campaign:run.campaign,difficulty:run.difficulty,fastTrappedTimer:Boolean(run.fastTrappedTimer)});game.start();
 for(const action of run.actions)applyReplayAction(game,action);
 if(game.status!=='won'||game.collected!==run.result.diamonds||game.score!==run.result.score)throw new Error('The recording does not reproduce its saved win.');
 const runs=loadLiveRuns(storage);
 if(runs.some(r=>r.campaign===run.campaign&&r.index===run.index&&r.difficulty===run.difficulty&&r.mode===run.mode&&JSON.stringify(r.actions)===JSON.stringify(run.actions)))return false;
 if(runs.length>=10)throw new Error('The live-recording library is full (10 runs). Existing recordings were preserved.');
 storage.setItem(REPLAY_STORAGE_KEY,JSON.stringify([run,...runs]));return true;
}
