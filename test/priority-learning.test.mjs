import test from 'node:test';
import assert from 'node:assert/strict';
import {PRIORITY_DEFAULTS,choosePlanningPriorities,learnPlanningPriorities,validPriorityLearning,planningPriority,planRoute} from '../route-planner.mjs';
import {LearningPlayer} from '../learning-player.mjs';
import {validateLearningModel,verifyLearningReplay,learningReplay} from '../learning-archive.mjs';
import {Game} from '../engine.mjs';

test('measured outcomes select continuous priority weights; evaluation does not mutate them',()=>{
 const reference=choosePlanningPriorities(null,1,true);assert.deepEqual(reference.weights,PRIORITY_DEFAULTS);
 let state=learnPlanningPriorities(null,reference,100),before=JSON.stringify(state);
 const candidate=choosePlanningPriorities(state,2,true);assert.equal(candidate.kind,'explore');assert.notDeepEqual(candidate.weights,state.champion.weights);assert.equal(JSON.stringify(state),before);
 const rejected=learnPlanningPriorities(state,candidate,99);assert.deepEqual(rejected.champion.weights,reference.weights);
 state=learnPlanningPriorities(state,candidate,120);assert.deepEqual(state.champion.weights,candidate.weights);assert.equal(state.trials,2);
 before=JSON.stringify(state);assert.deepEqual(choosePlanningPriorities(state,900,false).weights,candidate.weights);assert.equal(JSON.stringify(state),before);
 for(let i=0;i<80;i++){const choice=choosePlanningPriorities(state,i+10,true);state=learnPlanningPriorities(state,choice,100+i);assert.ok(validPriorityLearning(state));for(const w of Object.values(choice.weights))assert.ok(w>=.2&&w<=5);}
 assert.equal(state.recent.length,32);
});

test('priority multipliers change actual state rankings rather than just displayed metadata',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));for(let x=1;x<13;x++)grid[3][x]=' ';grid[3][11]='*';
 const g=new Game(0,'classic',{grid,player:{x:2,y:3},target:2,time:150});g.start();const other=new Game(0,'classic',{grid,player:{x:10,y:3},target:2,time:150});other.start();
 g.collected=1;
 const collect={...PRIORITY_DEFAULTS,collection:5,distance:.2},approach={...PRIORITY_DEFAULTS,collection:.2,distance:5};
 assert.ok(planningPriority(g,1,collect)>planningPriority(other,1,collect));
 assert.ok(planningPriority(g,1,approach)<planningPriority(other,1,approach),'distance-focused policy must reverse the collection-focused ordering');
});

test('existing model data and partial inputs survive priority learning and imports',()=>{
 const c={campaign:'original',index:0,difficulty:1},player=new LearningPlayer(c);player.values.set('historical',{n:3,mean:4});player.attempts=17;player.upgrade();
 const first=player.run({searchNodes:16});assert.equal(first.planningPriorities.kind,'reference');assert.equal(player.attempts,18);assert.ok(player.priorityLearning);assert.deepEqual(player.values.get('historical'),{n:3,mean:4});
 assert.ok(verifyLearningReplay(learningReplay(c,'training',18,first)));
 assert.throws(()=>learningReplay(c,'training',18,{...first,priorityFitness:NaN}));
 assert.throws(()=>learningReplay(c,'training',18,{...first,planningPriorities:{...first.planningPriorities,weights:{collection:999}}}));
 const restored=new LearningPlayer(c,validateLearningModel(JSON.parse(JSON.stringify(player.export())),c));assert.deepEqual(restored.priorityLearning,player.priorityLearning);assert.deepEqual(restored.partials,player.partials);
 const saved=JSON.stringify(restored.export()),evaluation=restored.run({learn:false,searchNodes:16});assert.equal(JSON.stringify(restored.export()),saved);assert.equal(evaluation.status,'won');
 const next=restored.run({searchNodes:16});assert.equal(next.planningPriorities.kind,'explore');assert.ok(verifyLearningReplay(learningReplay(c,'training',19,next)));
 assert.throws(()=>validateLearningModel({...player.export(),priorityLearning:{version:1}},c));
});

test('learned priorities cannot admit an insufficient-diamond branch',()=>{
 const grid=Array.from({length:22},()=>Array(40).fill('#'));for(let x=1;x<8;x++)grid[3][x]=' ';grid[3][4]='*';
 const fixture={grid,player:{x:2,y:3},target:2,time:150},generator=planRoute({campaign:'original',index:0,difficulty:1},{fixture,maxNodes:4,weights:{...PRIORITY_DEFAULTS,collection:5,supply:.2}});let step;do{step=generator.next();}while(!step.done);
 assert.equal(step.value.finished,false);assert.equal(step.value.game.collected,0);
});
