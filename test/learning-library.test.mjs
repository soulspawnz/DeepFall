import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LearningPlayer} from '../learning-player.mjs';
import {learningReplay,selectLearningReplays,verifyLearningReplay,validateLearningModel} from '../learning-archive.mjs';

test('replay filtering, stable sorting and bounded pages retain the archive',()=>{
 const records=Array.from({length:32},(_,i)=>({id:String(i),order:i,kind:i%2?'training':'evaluation',run:{status:i%3?'dead':'won',ticks:100-i,diamonds:i}}));
 const latest=selectLearningReplays(records);assert.equal(latest.records.length,10);assert.equal(latest.records[0].id,'31');assert.equal(latest.total,32);
 const filtered=selectLearningReplays(records,{status:'won',kind:'training',size:25,sort:'steps'});
 assert.ok(filtered.records.every(r=>r.kind==='training'&&r.run.status==='won'));assert.equal(filtered.records[0].id,'27');
 assert.equal(selectLearningReplays(records,{page:99,size:10}).page,3);assert.equal(records.length,32);
 assert.equal(selectLearningReplays(records,{status:'budget'}).matched,0);
});
test('imports verify actual replay outcome and reject bad models before storage',()=>{
 const context={campaign:'original',index:0,difficulty:1},p=new LearningPlayer(context),run=p.run({learn:false});
 const record=learningReplay(context,'baseline',0,run);assert.ok(verifyLearningReplay(record));
 assert.throws(()=>verifyLearningReplay({...record,run:{...run,score:run.score+1}}),/recorded outcome/);
 assert.throws(()=>verifyLearningReplay({...record,run:{...run,route:'forged'}}),/recorded outcome/);
 assert.equal(validateLearningModel(p.export(),context).policyRevision,2);
 assert.throws(()=>validateLearningModel(p.export(),{...context,index:1}),/same cave/);
 assert.throws(()=>validateLearningModel({...p.export(),values:[['bad',{n:0,mean:4}]]},context),/invalid data/);
});
test('upgrading decision credit preserves history and best runs but removes incompatible values',()=>{
 const c={campaign:'original',index:0,difficulty:1},old=new LearningPlayer(c,null,1);old.attempts=37;old.values.set('old',{n:2,mean:4});
 const upgraded=new LearningPlayer(c,old.export());upgraded.upgrade();
 assert.equal(upgraded.attempts,37);assert.equal(upgraded.policyStartAttempt,37);assert.equal(upgraded.values.size,0);assert.equal(upgraded.policyRevision,2);
});
