import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveExploration,LearningPlayer} from '../learning-player.mjs';
import {validateLearningModel} from '../learning-archive.mjs';
const run=(status='budget',diamonds=5,ticks=200)=>({status,diamonds,target:10,ticks});
const state=(value=.25,adjustedAt=0)=>({value,adjustedAt,reason:'Previous review.'});
test('automatic exploration warms up, widens a plateau and respects limits and review cadence',()=>{
 assert.equal(adaptiveExploration({attempts:4,results:Array.from({length:4},()=>run())}).value,.25);
 let model={attempts:5,results:Array.from({length:5},()=>run())};let next=adaptiveExploration(model);assert.equal(next.value,.35);assert.equal(next.adjustedAt,5);
 assert.deepEqual(adaptiveExploration({...model,attempts:8,autoExploration:next}),next);
 for(let n=10;n<=40;n+=5){model={attempts:n,results:Array.from({length:n},()=>run()),autoExploration:next};next=adaptiveExploration(model);}
 assert.equal(next.value,.6);
});
test('reliable escapes reduce exploration, fresh partial progress counts, and evaluations do not',()=>{
 const won=Array.from({length:20},()=>run('won',10));
 assert.equal(adaptiveExploration({attempts:20,results:won,autoExploration:state(.3,15)}).value,.25);
 assert.equal(adaptiveExploration({attempts:20,results:won,autoExploration:state(.1,15)}).value,.1);
 const partial=[...Array.from({length:10},()=>run('budget',5)),...Array.from({length:5},()=>run('budget',9))];
 assert.equal(adaptiveExploration({attempts:15,results:partial,autoExploration:state(.4,10)}).value,.35);
 const faster=[...Array.from({length:4},()=>run('won',10,400)),...Array.from({length:6},()=>run()),run('won',10,300),run('won',10,310),run(),run(),run()];
 assert.equal(adaptiveExploration({attempts:15,results:faster,autoExploration:state(.4,10)}).value,.35);
 const flat=Array.from({length:20},()=>run('budget',9));
 assert.equal(adaptiveExploration({attempts:20,results:flat,evaluation:run('won',10),autoExploration:state(.25,15)}).value,.35);
 const evals=Array.from({length:50},()=>({...run('won',10),kind:'evaluation'}));
 assert.equal(adaptiveExploration({attempts:20,results:[...flat,...evals],autoExploration:state(.25,15)}).value,.35);
});
test('overlapping success windows cannot repeatedly reinforce an old escape',()=>{
 const rows=Array.from({length:20},()=>run('budget',9));rows[12]=run('won',10);
 assert.ok(adaptiveExploration({attempts:20,results:rows,autoExploration:state(.2,15)}).value>.2);
});
test('automatic state survives serialization without changing old learned values and rejects corrupt imports',()=>{
 const context={campaign:'original',index:0,difficulty:1},p=new LearningPlayer(context);p.attempts=20;p.values.set('kept',{n:3,mean:7});p.autoExploration=state(.35,20);
 const restored=new LearningPlayer(context,JSON.parse(JSON.stringify(p.export())));assert.deepEqual(restored.autoExploration,p.autoExploration);assert.deepEqual(restored.values.get('kept'),{n:3,mean:7});
 assert.equal(new LearningPlayer(context,{...p.export(),autoExploration:undefined}).autoExploration,null);
 assert.throws(()=>validateLearningModel({...p.export(),autoExploration:state(.9,20)},context),/automatic exploration/);
});
