import {LEARNING_VERSION,contextKey} from './learning-player.mjs';

let database;
function openArchive(){
 if(!database)database=new Promise((resolve,reject)=>{
  const request=indexedDB.open('deepfall-learning-history',1);
  request.onupgradeneeded=()=>{
   const db=request.result;db.createObjectStore('models',{keyPath:'key'});
   const runs=db.createObjectStore('runs',{keyPath:'id'});
   runs.createIndex('context','contextKey');runs.createIndex('contextOrder',['contextKey','order']);runs.createIndex('contextKind',['contextKey','kind']);
  };
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);};
  request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Replay storage is waiting for another game tab to close.'));
 }).catch(error=>{database=null;throw error;});
 return database;
}
const resultOf=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const finished=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Replay storage transaction was cancelled.'));});

export function validLearningReplay(record){
 const run=record?.run,c=record?.context;
 return record?.version===1&&['training','baseline','evaluation'].includes(record.kind)&&Number.isInteger(record.attempt)&&record.attempt>=0
  &&c&&['original','deepfall'].includes(c.campaign)&&Number.isInteger(c.index)&&c.index>=0&&c.index<(c.campaign==='original'?20:3)&&Number.isInteger(c.difficulty)&&c.difficulty>=1&&c.difficulty<=5
  &&record.contextKey===contextKey(c)&&contextKey(run??{})===record.contextKey&&['won','dead','budget'].includes(run?.status)
  &&(run.fastTrappedTimer===undefined||typeof run.fastTrappedTimer==='boolean')
  &&typeof run.route==='string'&&run.route.length<=32&&Number.isFinite(run.score)&&Number.isInteger(run.diamonds)&&Number.isInteger(run.target)
  &&Array.isArray(run.input)&&run.input.length>0&&run.input.length<=4000&&run.ticks===run.input.length
  &&run.input.every(a=>Array.isArray(a)&&a.length===3&&Number.isInteger(a[0])&&Number.isInteger(a[1])&&Math.abs(a[0])+Math.abs(a[1])<=1&&typeof a[2]==='boolean');
}
export function learningReplay(context,kind,attempt,run,reconstructed=false){
 const key=contextKey(context),record={version:1,id:`${key}:${kind}:${attempt}:${run.route}`,contextKey:key,context:{...context},kind,attempt,
  order:kind==='baseline'?-1:attempt*2+(kind==='evaluation'?1:0),modelVersion:LEARNING_VERSION,savedAt:new Date().toISOString(),reconstructed,
  run:{...run,input:run.input.map(a=>[...a])}};
 if(!validLearningReplay(record))throw new Error('Invalid learning replay.');return record;
}
export function replayAttempt(record){return {...record.run,...record.context,mode:'classic',learningAttempts:record.attempt,replayKind:record.kind,reconstructed:record.reconstructed};}
export async function readLearningModel(context){
 const db=await openArchive(),tx=db.transaction('models','readonly');
 return (await resultOf(tx.objectStore('models').get(contextKey(context))))?.model??null;
}
export async function saveLearningRecords(context,model,records=[]){
 if(records.some(r=>!validLearningReplay(r)||r.contextKey!==contextKey(context)))throw new Error('Invalid replay history.');
 const db=await openArchive(),tx=db.transaction(['models','runs'],'readwrite'),done=finished(tx);
 tx.objectStore('models').put({key:contextKey(context),model});const runs=tx.objectStore('runs');
 for(const record of records){const request=runs.get(record.id);request.onsuccess=()=>{if(!request.result)runs.put(record);};}
 await done;
}
export async function learningReplayPage(context,page=0,size=25){
 const db=await openArchive(),tx=db.transaction('runs','readonly'),store=tx.objectStore('runs'),key=contextKey(context);
 const count=resultOf(store.index('context').count(key)),trainingCount=resultOf(store.index('contextKind').count([key,'training']));
 const records=new Promise((resolve,reject)=>{
  const rows=[],request=store.index('contextOrder').openCursor(IDBKeyRange.bound([key,-1],[key,Number.MAX_SAFE_INTEGER]));let skipped=false;
  request.onerror=()=>reject(request.error);request.onsuccess=()=>{
   const cursor=request.result;if(!cursor||rows.length>=size){resolve(rows);return;}
   if(!skipped&&page>0){skipped=true;cursor.advance(page*size);return;}
   rows.push(cursor.value);cursor.continue();
  };
 });
 const [total,training,rows]=await Promise.all([count,trainingCount,records]);return {total,training,records:rows};
}
export async function allLearningReplays(context=null){
 const db=await openArchive(),store=db.transaction('runs','readonly').objectStore('runs');
 const records=await resultOf(context?store.index('context').getAll(contextKey(context)):store.getAll());
 return records.filter(validLearningReplay).sort((a,b)=>a.contextKey.localeCompare(b.contextKey)||a.order-b.order);
}
