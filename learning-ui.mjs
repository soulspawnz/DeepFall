import {LEARNING_VERSION,LearningPlayer,contextKey} from './learning-player.mjs';
import {ORIGINAL_CAVES} from './original-caves.mjs';

export function mountLearning({getContext,pause,onWatch}) {
 const section=document.createElement('section');section.className='playtest-library learning-player';section.setAttribute('aria-label','Learning player');
 const title=document.createElement('h3');title.textContent='Learning player';section.append(title);
 const intro=document.createElement('p');intro.textContent='Train on the selected cave. The player explores routes and remembers which choices led to good or bad outcomes. Simulated training and AI replays are separate from your live runs.';section.append(intro);
 const controls=document.createElement('div');controls.className='learning-controls';section.append(controls);
 const countLabel=document.createElement('label');countLabel.textContent='Attempts ';const count=document.createElement('select');count.setAttribute('aria-label','Training attempts');
 for(const n of [10,25,50,100]){const option=document.createElement('option');option.value=String(n);option.textContent=String(n);count.append(option);}controls.append(countLabel);countLabel.append(count);
 const exploreLabel=document.createElement('label');exploreLabel.textContent='Explore new routes ';const explore=document.createElement('select');explore.setAttribute('aria-label','Exploration');
 for(const [v,text]of [[.1,'10%'],[.25,'25%'],[.5,'50%']]){const option=document.createElement('option');option.value=String(v);option.textContent=text;explore.append(option);}explore.value='0.25';controls.append(exploreLabel);exploreLabel.append(explore);
 function button(text,fn){const b=document.createElement('button');b.textContent=text;b.addEventListener('click',fn);controls.append(b);return b;}
 let worker=null,saved=null,activeContext=null,loadedKey='',storageWarning='',watchRequested=false;
 const status=document.createElement('p');status.setAttribute('role','status');status.id='learning-status';section.append(status);
 const progress=document.createElement('p');progress.id='learning-progress';section.append(progress);
 const table=document.createElement('table');table.className='learning-results';table.innerHTML='<caption>Recent simulated attempts</caption><thead><tr><th>Attempt</th><th>Result</th><th>Diamonds</th><th>Steps</th></tr></thead><tbody></tbody>';section.append(table);
 const tbody=table.querySelector('tbody');
 const train=button('TRAIN PLAYER',()=>{
  if(worker)return;const watchAttempt=watchRequested;watchRequested=false;load();pause();activeContext={...getContext()};
  try {
   worker=new Worker(new URL('./learning-worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{
    if(data.type==='progress'){status.textContent=`${data.phase==='baseline'?'Measuring untrained player':data.phase==='evaluation'?'Measuring learned player':`Training attempt ${data.attempt}`}: ${data.diamonds} diamonds, ${data.ticks} steps.`;return;}
    if(data.type==='result'||data.type==='evaluation'){
     saved=data.saved;storageWarning='';
     try{localStorage.setItem('deepfall.learning.'+contextKey(activeContext),JSON.stringify(saved));}catch{storageWarning=' Browser storage is full or unavailable; export learning to keep it.';}
     render();status.textContent=data.type==='evaluation'?`Learned player evaluation saved.${storageWarning}`:`Attempt ${saved.attempts}: ${data.result.status} (${data.result.diamonds}/${data.result.target}).${storageWarning}`;
     if(data.replay)onWatch(data.replay);
    }
    if(data.type==='done'||data.type==='error'){
     worker?.terminate();worker=null;train.disabled=false;stop.disabled=true;
     status.textContent=data.type==='error'?`Training stopped: ${data.message}`:`Training finished.${storageWarning}`;render();
    }
   };
   worker.onerror=()=>{worker?.terminate();worker=null;train.disabled=false;stop.disabled=true;status.textContent='Training worker stopped unexpectedly. Completed attempts remain saved.';render();};
   train.disabled=true;watchNext.disabled=true;stop.disabled=false;status.textContent=watchAttempt?'Planning an exploratory attempt to watch…':'Training in simulation…';
   worker.postMessage({type:'train',context:activeContext,saved,count:watchAttempt?1:Number(count.value),exploration:Number(explore.value),watch:watchAttempt});
  }catch(error){worker?.terminate();worker=null;train.disabled=false;stop.disabled=true;status.textContent=error.message;render();}
 });
 const stop=button('STOP TRAINING',()=>{
  worker?.terminate();worker=null;train.disabled=false;stop.disabled=true;status.textContent='Stopped. Completed attempts and their learning are kept.';render();
 });stop.disabled=true;
 const watchNext=button('WATCH NEXT ATTEMPT',()=>{watchRequested=true;train.click();});
 const watch=button('WATCH BEST RUN',()=>{
  if(!saved?.best)return;pause();onWatch({...saved.best,mode:'classic',input:saved.best.input,learningAttempts:saved.attempts});
 });
 const download=button('EXPORT LEARNING',()=>{
  if(!saved)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(saved)],{type:'application/json'}));const a=document.createElement('a');
  a.href=url;a.download=`deepfall-learning-${contextKey(saved.context).replaceAll(':','-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 function render(){
  const results=saved?.results??[],wins=results.filter(r=>r.status==='won').length,recent=results.slice(-10),recentWins=recent.filter(r=>r.status==='won').length;
  const unique=new Set(results.map(r=>r.route)).size;
  const describe=r=>r.status==='won'?`escaped in ${r.ticks} steps`:`${r.diamonds}/${r.target} diamonds, ${r.status==='budget'?'attempt limit reached':'died'}`;
  progress.textContent=`${saved?.attempts??0} attempts learned · ${wins}/${results.length} wins in retained history · last ${recent.length}: ${recentWins} wins · ${unique} distinct routes.`+(saved?.best?` Best win: ${saved.best.ticks} steps, ${saved.best.diamonds}/${saved.best.target} diamonds.`:' No winning route saved yet.')+(saved?.baseline?` Before learning: ${describe(saved.baseline)}.`:'')+(saved?.evaluation?` Current learned policy: ${describe(saved.evaluation)}.`:'');
  watch.disabled=!saved?.best;watchNext.disabled=Boolean(worker);download.disabled=!saved;
  tbody.replaceChildren();
  results.slice(-10).reverse().forEach((r,i)=>{const tr=document.createElement('tr');for(const text of [saved.attempts-i,{won:'Escaped',dead:'Died',budget:'Attempt limit'}[r.status],`${r.diamonds}/${r.target}`,r.ticks]){const td=document.createElement('td');td.textContent=String(text);tr.append(td);}tbody.append(tr);});
 }
 function load(){
  const context=getContext(),key=contextKey(context);
  if(worker&&key!==loadedKey){worker.terminate();worker=null;train.disabled=false;stop.disabled=true;}
  if(worker||key===loadedKey)return;loadedKey=key;saved=null;
  try{const data=JSON.parse(localStorage.getItem('deepfall.learning.'+key)??'null');if(data?.version===LEARNING_VERSION)saved=new LearningPlayer(context,data).export();}catch{}
  status.textContent=`${context.campaign==='original'?'Original campaign':'Deepfall'} · cave ${context.campaign==='original'?ORIGINAL_CAVES[context.index].id:context.index+1} · difficulty ${context.difficulty}. Learning stays in this browser.`;render();
 }
 document.querySelector('.sid-panel')?.before(section);if(!section.isConnected)document.querySelector('main').append(section);
 load();return {refresh:load};
}
