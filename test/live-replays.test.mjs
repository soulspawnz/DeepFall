import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.mjs';
import {LiveRecording, applyReplayAction, loadLiveRuns, saveLiveRun, importLiveRun, REPLAY_STORAGE_KEY} from '../live-replays.mjs';
import {LearningPlayer} from '../learning-player.mjs';

test('consumed inputs, snap and rewind reproduce a winning state exactly',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));
 for(let x=1;x<=5;x++)grid[3][x]=' ';
 grid[3][3]='*';grid[3][4]='X';
 const fixture={grid,player:{x:2,y:3},target:1,time:150};
 const game=new Game(0,'echo',fixture), recording=new LiveRecording({campaign:'original',index:0,difficulty:1,mode:'echo'});
 game.start();
 for(const input of [{dx:1,dy:0,snap:true},{dx:1,dy:0,snap:false}]){recording.step(input);game.step(input);}
 assert.ok(game.rewind());recording.rewind();
 for(let n=0;n<2;n++){const input={dx:1,dy:0,snap:false};recording.step(input);game.step(input);}
 const run=recording.finish(game);assert.equal(run.result.status,'won');assert.equal(run.result.rewindsUsed,1);
 const playback=new Game(0,'echo',fixture);playback.start();
 for(const action of run.actions)applyReplayAction(playback,action);
 assert.deepEqual(playback.snapshot(),game.snapshot());assert.equal(playback.status,'won');assert.equal(playback.rewinds,2);
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 saveLiveRun(storage,run);assert.deepEqual(loadLiveRuns(storage),[run]);
 data.set(REPLAY_STORAGE_KEY,'broken');assert.deepEqual(loadLiveRuns(storage),[]);
 data.set(REPLAY_STORAGE_KEY,JSON.stringify([{...run,index:99},run]));assert.deepEqual(loadLiveRuns(storage),[run]);
 assert.throws(()=>saveLiveRun(storage,{...run,actions:[[99,0,false]]}));
});

test('unsuccessful attempts are not saved as wins',()=>{
 const game=new Game();const recording=new LiveRecording({campaign:'deepfall',index:0,difficulty:1,mode:'echo'});
 assert.equal(recording.finish(game),null);
});
test('live import verifies the actual cave, deduplicates and preserves storage on a corrupt win',()=>{
 const context={campaign:'original',index:0,difficulty:1},ai=new LearningPlayer(context).run({learn:false});
 // Synthetic recording fixture using real simulated winning inputs.
 const run={version:1,...context,mode:'classic',source:'live-input',fastTrappedTimer:true,actions:ai.input,result:{status:'won',diamonds:ai.diamonds,score:ai.score}};
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(importLiveRun(storage,run),true);assert.equal(importLiveRun(storage,run),false);
 assert.throws(()=>importLiveRun(storage,{...run,result:{...run.result,score:ai.score+1}}),/saved win/);
 assert.equal(loadLiveRuns(storage).length,1);
});
