import {LEARNING_VERSION,LearningPlayer,contextKey} from './learning-player.mjs';
import {ORIGINAL_CAVES} from './original-caves.mjs';
import {learningReplay,replayAttempt,readLearningModel,saveLearningRecords,learningReplayPage,allLearningReplays,importLearningModel,importLearningReplays} from './learning-archive.mjs';

const outcome={won:'Escaped',dead:'Died',budget:'Attempt limit'};
function downloadJSON(name,value){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function mountLearning({getContext,pause,onWatch}){
 const section=document.createElement('section');section.className='playtest-library learning-player';section.setAttribute('aria-label','Learning player');
 const header=document.createElement('div');header.className='learning-heading';section.append(header);
 const title=document.createElement('h3');title.textContent='Learning player';header.append(title);
 const content=document.createElement('div');content.id='learning-content';section.append(content);
 function text(tag,value,parent=content){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
 const toggle=text('button','HIDE CONTENT',header);toggle.setAttribute('aria-controls',content.id);
 let collapsed=false;try{collapsed=localStorage.getItem('deepfall.learning.collapsed')==='true';}catch{}
 function collapse(){content.hidden=collapsed;toggle.textContent=collapsed?'SHOW CONTENT':'HIDE CONTENT';toggle.setAttribute('aria-expanded',String(!collapsed));}
 toggle.addEventListener('click',()=>{collapsed=!collapsed;collapse();try{localStorage.setItem('deepfall.learning.collapsed',String(collapsed));}catch{}});collapse();
 text('p','Train on the selected cave. The player explores routes and remembers which choices led to good or bad outcomes. Simulated training and AI replays are separate from your live runs.');
 text('p','Every completed training attempt, baseline and evaluation is saved in this browser, including failures. Old replays are not automatically deleted. Export all replays for a separate backup; clearing browser data removes local learning and replays.');
 const controls=document.createElement('div');controls.className='learning-controls';content.append(controls);
 const countLabel=text('label','Attempts ',controls),count=document.createElement('select');count.setAttribute('aria-label','Training attempts');
 for(const n of [10,25,50,100]){const option=text('option',String(n),count);option.value=String(n);}countLabel.append(count);
 const exploreLabel=text('label','Explore new routes ',controls),explore=document.createElement('select');explore.setAttribute('aria-label','Exploration');
 for(const v of [.1,.25,.5]){const option=text('option',`${v*100}%`,explore);option.value=String(v);}explore.value='0.25';exploreLabel.append(explore);
 function button(label,fn,parent=controls){const b=text('button',label,parent);b.addEventListener('click',fn);return b;}
 let worker=null,saved=null,loadedKey='',ready=false,loadPromise=Promise.resolve(),generation=0,historyGeneration=0,page=0,history={total:0,training:0,records:[]},pendingSave=Promise.resolve();
 const status=text('p','Loading saved learning…');status.id='learning-status';status.setAttribute('role','status');
 const progress=text('p','');progress.id='learning-progress';
 const historyInfo=text('p','');historyInfo.id='learning-history-status';
 const filters=document.createElement('div');filters.className='learning-controls learning-filters';content.append(filters);
 function select(label,options,initial){const l=text('label',label+' ',filters),s=document.createElement('select');s.setAttribute('aria-label',label);for(const [value,name]of options){const o=text('option',name,s);o.value=value;}s.value=initial;l.append(s);s.addEventListener('change',()=>{page=0;refreshHistory().catch(e=>status.textContent=e.message);});return s;}
 const pageSize=select('Attempts per page',[10,25,50,100].map(n=>[String(n),String(n)]),'10');
 const sort=select('Sort replays',[['newest','Newest first'],['oldest','Oldest first'],['steps','Fewest steps'],['diamonds','Most diamonds']],'newest');
 const resultFilter=select('Replay result',[['all','All results'],['won','Escaped'],['dead','Died'],['budget','Attempt limit']],'all');
 const kindFilter=select('Replay type',[['all','All types'],['training','Training'],['baseline','Baseline'],['evaluation','Evaluation']],'all');
 const table=document.createElement('table');table.className='learning-results';table.innerHTML='<caption>Saved AI replays for this cave</caption><thead><tr><th>Run</th><th>Result</th><th>Diamonds</th><th>Steps</th><th>Replay</th></tr></thead><tbody></tbody>';content.append(table);const tbody=table.querySelector('tbody');
 const pager=document.createElement('div');pager.className='learning-controls';content.append(pager);
 const train=button('TRAIN PLAYER',()=>startJob('train',false));
 const stop=button('STOP TRAINING',async()=>{
  worker?.terminate();worker=null;ready=false;render();status.textContent='Stopping and finishing replay storage…';
  try{await pendingSave;await load(true);status.textContent='Stopped. Completed attempts, replays and learning are kept.';}catch(error){status.textContent=`Replay storage error: ${error.message}`;}
 });
 const watchNext=button('WATCH NEXT ATTEMPT',()=>startJob('train',true));
 const watchBest=button('WATCH BEST RUN',()=>{if(saved?.best){pause();onWatch({...saved.best,mode:'classic',learningAttempts:saved.attempts,replayKind:'best'});}});
 const exportLearning=button('EXPORT LEARNING',()=>{if(saved)downloadJSON(`deepfall-learning-${loadedKey.replaceAll(':','-')}.json`,saved);});
 let importing=false;
 const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;content.append(fileInput);
 let importKind='learning';
 const importModel=button('IMPORT LEARNING',()=>{importKind='learning';fileInput.click();});
 const importReplays=button('IMPORT REPLAYS',()=>{importKind='replays';fileInput.click();});
 fileInput.addEventListener('change',async()=>{
  const file=fileInput.files[0];fileInput.value='';if(!file||worker||importing)return;
  const context={...getContext()},key=loadedKey;importing=true;ready=false;render();status.textContent='Checking import…';
  try{
   if(file.size>32*1024*1024)throw new Error('Choose a JSON backup smaller than 32 MB.');
   const data=JSON.parse(await file.text());
   if(importKind==='learning'){await importLearningModel(data,context);if(key===loadedKey){await load(true);status.textContent='Learning imported. Continue training or evaluate it with Watch Next Attempt.';}}
   else {const result=await importLearningReplays(data,(n,total)=>{if(key===loadedKey)status.textContent=`Verifying replay ${n}/${total}…`;});if(key===loadedKey){await refreshHistory();status.textContent=`Imported ${result.added} replays; ${result.duplicates} duplicates skipped. Learning weights are imported separately.`;}}
  }catch(error){if(key===loadedKey)status.textContent=`Import failed: ${error.message}`;}
  finally{importing=false;if(key===loadedKey)ready=true;render();}
 });
 const recover=button('RECOVER EARLIER REPLAYS',()=>startJob('recover',false));
 const watchAll=button('WATCH ALL REPLAYS',async()=>{
  try{const records=await allLearningReplays(getContext());if(records.length){pause();onWatch(records.map(replayAttempt));}}catch(error){status.textContent=error.message;}
 });
 const exportAll=button('EXPORT ALL REPLAYS',async()=>{
  try{downloadJSON('deepfall-all-learning-replays.json',{format:'deepfall-learning-replays-1',runs:await allLearningReplays()});}catch(error){status.textContent=error.message;}
 });
 const previous=button('PREVIOUS REPLAYS',async()=>{page=Math.max(0,page-1);await refreshHistory();},pager);
 const next=button('NEXT REPLAYS',async()=>{page++;await refreshHistory();},pager);

 function render(){
  const results=saved?.results??[],wins=results.filter(r=>r.status==='won').length,recent=results.slice(-10),recentWins=recent.filter(r=>r.status==='won').length;
  const describe=r=>r.status==='won'?`escaped in ${r.ticks} steps`:`${r.diamonds}/${r.target} diamonds, ${r.status==='budget'?'attempt limit reached':'died'}`;
  const prior=results.slice(-20,-10),priorWins=prior.filter(r=>r.status==='won').length;
  const improved=saved?.evaluation&&saved?.baseline&&(saved.evaluation.status==='won'&&(saved.baseline.status!=='won'||saved.evaluation.ticks<saved.baseline.ticks)||saved.evaluation.diamonds>saved.baseline.diamonds);
  progress.textContent=`${saved?.attempts??0} attempts learned · ${wins}/${results.length} wins in retained history · last ${recent.length}: ${recentWins} wins${prior.length?` (previous ${prior.length}: ${priorWins})`:''} · ${new Set(results.map(r=>r.route)).size} distinct routes · ${saved?.values?.length??0} remembered decisions.`+(saved?.best?` Best win: ${saved.best.ticks} steps, ${saved.best.diamonds}/${saved.best.target} diamonds.`:' No winning route saved yet.')+(saved?.baseline?` Before learning: ${describe(saved.baseline)}.`:'')+(saved?.evaluation?` Current learned policy: ${describe(saved.evaluation)}. ${improved?'Measured improvement over baseline.':'No measured improvement over baseline yet; different routes alone are not progress.'}`:'')+((saved?.policyRevision??1)<2&&saved?.attempts?' Next training upgrades decision credit; saved replays and best runs are preserved.':'');
  train.disabled=!ready||Boolean(worker);stop.disabled=!worker;watchNext.disabled=!ready||Boolean(worker);watchBest.disabled=!saved?.best;exportLearning.disabled=!saved;
  const missing=Math.max(0,(saved?.attempts??0)-history.training);recover.hidden=!missing;recover.disabled=!ready||Boolean(worker);
  historyInfo.textContent=`${history.total} archived replays for this cave, including ${history.training} training attempts.`+(missing?` ${missing} earlier attempts have summaries only; recovery saves only traces that reproduce exactly.`:'')+` ${history.matched??0} match filters.`+(history.matched?` Showing ${page*Number(pageSize.value)+1}–${Math.min(history.matched,(page+1)*Number(pageSize.value))}. Page ${page+1} of ${Math.ceil(history.matched/Number(pageSize.value))}.`:' No matching replays.')+' Watch All plays the entire cave archive in chronological order.';
  watchAll.disabled=!history.total;exportAll.disabled=!ready;previous.disabled=page===0;next.disabled=(page+1)*Number(pageSize.value)>=(history.matched??0);
  if(saved?.policyStartAttempt>0)progress.textContent+=` Updated learning method: ${saved.attempts-saved.policyStartAttempt} attempts since upgrade; ${saved.policyStartAttempt} earlier attempts remain archived.`;
  importModel.disabled=importReplays.disabled=!ready||Boolean(worker)||importing;
  tbody.replaceChildren();
  for(const record of history.records){
   const label=record.kind==='baseline'?'Before learning':record.kind==='evaluation'?`Evaluation after ${record.attempt}`:`Attempt ${record.attempt}`;
   const row=document.createElement('tr');for(const value of [label,outcome[record.run.status],`${record.run.diamonds}/${record.run.target}`,record.run.ticks])text('td',String(value),row);
   const cell=document.createElement('td');row.append(cell);
   button(record.kind==='training'?`WATCH ATTEMPT ${record.attempt}`:record.kind==='baseline'?'WATCH BASELINE':`WATCH EVALUATION ${record.attempt}`,()=>{pause();onWatch(replayAttempt(record));},cell);
   if(record.reconstructed)text('small','Verified reconstruction',cell);tbody.append(row);
  }
 }
 async function refreshHistory(){
  const token=++historyGeneration,key=loadedKey,context={...getContext()};
  const value=await learningReplayPage(context,page,Number(pageSize.value),{sort:sort.value,status:resultFilter.value,kind:kindFilter.value});
  if(token!==historyGeneration||key!==loadedKey)return;
  history=value;page=value.page;render();
 }
 function load(force=false){
  const context={...getContext()},key=contextKey(context);
  if(worker&&key!==loadedKey){worker.terminate();worker=null;}
  if(!force&&key===loadedKey)return loadPromise;
  if(worker)return loadPromise;
  const token=++generation;loadedKey=key;ready=false;saved=null;page=0;history={total:0,training:0,records:[]};render();status.textContent='Loading saved learning and replay history…';
  loadPromise=(async()=>{
   try{
    let model=await readLearningModel(context),legacy=false;
    if(!model){try{model=JSON.parse(localStorage.getItem('deepfall.learning.'+key)??'null');legacy=Boolean(model);}catch{}}
    const normalized=model?.version===LEARNING_VERSION?new LearningPlayer(context,model).export():null;
    if(legacy&&normalized)await saveLearningRecords(context,normalized);
    if(token!==generation)return;saved=normalized;ready=true;await refreshHistory();
    if(token!==generation)return;
    status.textContent=`${context.campaign==='original'?'Original campaign':'Deepfall'} · cave ${context.campaign==='original'?ORIGINAL_CAVES[context.index].id:context.index+1} · difficulty ${context.difficulty}. Learning and all completed replays stay in this browser.`;render();
   }catch(error){if(token===generation){ready=false;status.textContent=`Replay storage unavailable: ${error.message}. Training is disabled until replays can be saved.`;render();}}
  })();return loadPromise;
 }
 async function startJob(type,watch){
  if(worker||importing)return;await load();if(!ready||worker||importing)return;
  const context={...getContext()},key=contextKey(context);if(key!==loadedKey)return;pause();
  try{
   const job=new Worker(new URL('./learning-worker.mjs',import.meta.url),{type:'module'});worker=job;render();
   status.textContent=type==='recover'?'Verifying earlier replay inputs…':watch?'Planning an exploratory attempt to watch…':'Training in simulation…';
   job.onmessage=async({data})=>{
    if(worker!==job)return;
    try{
     if(data.type==='progress'){
      const label={baseline:'Measuring untrained player',evaluation:'Measuring learned player',recovery:'Verifying earlier replays'}[data.phase]??`Training attempt ${data.attempt}`;
      status.textContent=`${label}: ${data.diamonds} diamonds, ${data.ticks} steps.`;return;
     }
     if(data.type==='record'||data.type==='recovered'){
      const records=data.type==='record'?[learningReplay(context,data.kind,data.attempt,data.run)]:data.records.map(r=>learningReplay(context,r.kind,r.attempt,r.run,true));
      pendingSave=saveLearningRecords(context,data.saved,records);await pendingSave;
      if(worker!==job)return;saved=data.saved;await refreshHistory();
      status.textContent=data.type==='recovered'?'Earlier replays recovered and fingerprint-verified.':`${data.kind==='training'?`Attempt ${data.attempt}`:data.kind}: replay and learning saved.`;
      job.postMessage({type:'ack',id:data.id});
      if(data.type==='record'&&data.watch&&data.kind==='training')onWatch(replayAttempt(records[0]));
     }
     if(data.type==='done'||data.type==='error'){
      job.terminate();worker=null;status.textContent=data.type==='error'?`Training stopped: ${data.message}`:data.recovered?'Earlier replays recovered and verified.':'Training finished. All completed replays saved.';render();
     }
    }catch(error){job.terminate();worker=null;ready=false;status.textContent=`Could not save replay: ${error.message}. Training stopped; existing records are preserved.`;render();}
   };
   job.onerror=()=>{if(worker!==job)return;job.terminate();worker=null;status.textContent='Training worker stopped unexpectedly. Saved replays and completed learning are preserved.';render();};
   job.postMessage({type,context,saved,count:watch?1:Number(count.value),exploration:Number(explore.value),watch});
  }catch(error){worker?.terminate();worker=null;status.textContent=error.message;render();}
 }
 document.querySelector('.sid-panel')?.before(section);if(!section.isConnected)document.querySelector('main').append(section);
 load();return {refresh:load};
}
