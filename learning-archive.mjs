import {LEARNING_VERSION,LearningPlayer,contextKey,inputFingerprint} from './learning-player.mjs';
import {Game} from './engine.mjs';
import {validPriorityWeights,priorityProfile} from './route-planner.mjs';

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
  &&(run.planningPriorities===undefined||(validPriorityWeights(run.planningPriorities?.weights)&&run.planningPriorities.profile===priorityProfile(run.planningPriorities.weights)&&['reference','explore','champion','evaluation'].includes(run.planningPriorities.kind)&&Number.isFinite(run.priorityFitness)&&Math.abs(run.priorityFitness)<1e6))
  &&typeof run.route==='string'&&run.route.length<=32&&Number.isFinite(run.score)&&Number.isFinite(run.remaining)&&Number.isInteger(run.diamonds)&&run.diamonds>=0&&run.diamonds<=10000&&Number.isInteger(run.target)&&run.target>=0&&run.target<=1000
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
export function selectLearningReplays(records,{page=0,size=10,sort='newest',status='all',kind='all'}={}){
 const filtered=records.filter(r=>(status==='all'||r.run.status===status)&&(kind==='all'||r.kind===kind));
 const compare=sort==='oldest'?(a,b)=>a.order-b.order:sort==='steps'?(a,b)=>a.run.ticks-b.run.ticks:sort==='diamonds'?(a,b)=>b.run.diamonds-a.run.diamonds:(a,b)=>b.order-a.order;
 filtered.sort((a,b)=>compare(a,b)||a.id.localeCompare(b.id));
 size=[10,25,50,100].includes(size)?size:10;page=Math.max(0,Math.min(page,Math.ceil(filtered.length/size)-1));
 return {total:records.length,training:records.filter(r=>r.kind==='training').length,matched:filtered.length,page,records:filtered.slice(page*size,(page+1)*size)};
}
export function learningProgress(records,window=10){
 window=Math.max(1,Math.floor(window));
 const unique=[...new Map(records.map(r=>[r.id,r])).values()].sort((a,b)=>a.attempt-b.attempt||String(a.savedAt??'').localeCompare(String(b.savedAt??''))||a.id.localeCompare(b.id));
 const rows=unique.filter(r=>r.kind==='training');let wins=0,bestDiamonds=0,bestWinTicks=null;
 const training=rows.map((record,i)=>{
  const r=record.run;if(r.status==='won'){wins++;bestWinTicks=Math.min(bestWinTicks??Infinity,r.ticks);}bestDiamonds=Math.max(bestDiamonds,r.diamonds);
  const recent=rows.slice(Math.max(0,i-window+1),i+1);
  return {record,attempt:record.attempt,rollingWinRate:recent.filter(r=>r.run.status==='won').length/recent.length*100,cumulativeWinRate:wins/(i+1)*100,bestDiamonds,bestWinTicks};
 });
 return {training,evaluations:unique.filter(r=>r.kind==='evaluation'),baselines:unique.filter(r=>r.kind==='baseline'),window,
  summary:{count:rows.length,wins,winRate:rows.length?wins/rows.length*100:null,firstWin:rows.find(r=>r.run.status==='won')?.attempt??null,bestWinTicks,
   deaths:rows.filter(r=>r.run.status==='dead').length,limited:rows.filter(r=>r.run.status==='budget').length}};
}
export async function learningReplayPage(context,page=0,size=10,options={}){
 return selectLearningReplays(await allLearningReplays(context),{...options,page,size});
}
export async function allLearningReplays(context=null){
 const db=await openArchive(),store=db.transaction('runs','readonly').objectStore('runs');
 const records=await resultOf(context?store.index('context').getAll(contextKey(context)):store.getAll());
 return records.filter(validLearningReplay).sort((a,b)=>a.contextKey.localeCompare(b.contextKey)||a.order-b.order);
}

export function validateLearningModel(model,context){
 if(model?.version!==LEARNING_VERSION||contextKey(model.context??{})!==contextKey(context))throw new Error('Choose the same cave and difficulty as the learning file.');
 if(!Number.isInteger(model.attempts)||model.attempts<0||model.attempts>1e9||!Array.isArray(model.values)||model.values.length>20000||![1,2].includes(model.policyRevision??1))throw new Error('Invalid or unsupported learning model.');
 const normalized=new LearningPlayer(context,model).export();
 if(normalized.values.length!==model.values.length||normalized.results.length!==(model.results??[]).length||(model.best&&!normalized.best))throw new Error('The learning file contains invalid data.');
 if((model.planningRevision!==undefined&&![0,1].includes(model.planningRevision))||normalized.partials.length!==(model.partials??[]).length||normalized.frontier.length!==(model.frontier??[]).length||normalized.searchVisited.length!==(model.searchVisited??[]).length)throw new Error('Invalid planning memory.');
 if(model.autoExploration&&!normalized.autoExploration)throw new Error('Invalid automatic exploration state.');
 if(model.priorityLearning&&!normalized.priorityLearning)throw new Error('Invalid learned planning priorities.');
 if(normalized.best)verifyLearningReplay(learningReplay(context,'training',normalized.attempts,normalized.best));
 for(const run of normalized.partials)verifyLearningReplay(learningReplay(context,'training',normalized.attempts,run));
 return normalized;
}
export function verifyLearningReplay(record){
 if(!validLearningReplay(record))throw new Error('Invalid or unsupported replay file.');
 const game=new Game(record.context.index,'classic',null,{...record.context,fastTrappedTimer:Boolean(record.run.fastTrappedTimer)});game.start();
 for(const [dx,dy,snap]of record.run.input)game.step({dx,dy,snap});
 const r=record.run;
 if(inputFingerprint(r.input)!==r.route||game.status!==(r.status==='budget'?'playing':r.status)||game.collected!==r.diamonds||game.target!==r.target||game.score!==r.score||Math.abs(game.remaining-r.remaining)>1e-7)throw new Error('A replay does not match its recorded outcome. Nothing was imported.');
 return learningReplay(record.context,record.kind,record.attempt,r,Boolean(record.reconstructed));
}
export async function importLearningModel(model,context){
 const normalized=validateLearningModel(model,context),existing=await readLearningModel(context);
 if(existing?.attempts>normalized.attempts)throw new Error('This browser has more training. Export it first; the older file was not imported.');
 await saveLearningRecords(context,normalized);return normalized;
}
export async function importLearningReplays(backup,onProgress=()=>{}){
 if(backup?.format!=='deepfall-learning-replays-1'||!Array.isArray(backup.runs)||!backup.runs.length||backup.runs.length>10000)throw new Error('Choose an exported AI replay backup (up to 10,000 runs).');
 const verified=[];
 for(let i=0;i<backup.runs.length;i++){
  verified.push(verifyLearningReplay(backup.runs[i]));
  if(i%10===0){onProgress(i+1,backup.runs.length);await new Promise(resolve=>setTimeout(resolve,0));}
 }
 const db=await openArchive(),tx=db.transaction('runs','readwrite'),done=finished(tx),store=tx.objectStore('runs');let added=0;
 for(const r of new Map(verified.map(r=>[r.id,r])).values()){const request=store.get(r.id);request.onsuccess=()=>{if(!request.result){store.put(r);added++;}};}
 await done;return {added,duplicates:verified.length-added};
}
