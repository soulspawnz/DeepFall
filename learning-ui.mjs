import {LEARNING_VERSION,LearningPlayer,contextKey,adaptiveExploration} from './learning-player.mjs';
import {ORIGINAL_CAVES} from './original-caves.mjs';
import {learningReplay,replayAttempt,readLearningModel,saveLearningRecords,selectLearningReplays,learningProgress,allLearningReplays,importLearningModel,importLearningReplays} from './learning-archive.mjs';

const outcome={won:'Escaped',dead:'Died',budget:'Attempt limit'};
function downloadJSON(name,value){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function mountLearningCharts(parent,watch){
 const panel=document.createElement('section');panel.className='learning-charts';panel.setAttribute('aria-label','Learning progress graphs');parent.append(panel);
 function el(tag,value,target=panel){const e=document.createElement(tag);e.textContent=value;target.append(e);return e;}
 const heading=el('div','');heading.className='learning-chart-heading';el('h4','Learning history',heading);
 const rangeLabel=el('label','Show ',heading),range=el('select','',rangeLabel);range.setAttribute('aria-label','Graph history range');
 for(const [value,label]of [['0','All attempts'],['25','Last 25'],['50','Last 50'],['100','Last 100']]){const option=el('option',label,range);option.value=value;}
 const stats=el('div','');stats.className='learning-chart-stats';stats.setAttribute('role','group');
 const controls=el('div','');controls.className='learning-chart-controls';
 let metric='diamonds',data=learningProgress([]),expected=0,selectedId=null,visible=[],showEvaluations=true,chartWidth=720;
 const buttons=new Map();
 for(const [value,label]of [['diamonds','DIAMONDS'],['winrate','WIN RATE'],['steps','ESCAPE STEPS']]){const b=el('button',label,controls);b.type='button';b.addEventListener('click',()=>{metric=value;draw();});buttons.set(value,b);}
 const evalLabel=el('label','',controls),evalToggle=document.createElement('input');evalToggle.type='checkbox';evalToggle.checked=true;evalToggle.setAttribute('aria-label','Show evaluation results');evalLabel.append(evalToggle,document.createTextNode(' Evaluations'));
 const legend=el('p','');legend.className='learning-chart-legend';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 720 230');svg.setAttribute('role','img');svg.classList.add('learning-chart');panel.append(svg);
 const note=el('p','');note.className='learning-chart-note';note.id='learning-chart-note';svg.setAttribute('aria-describedby',note.id);
 const inspect=el('div','');inspect.className='learning-chart-inspect';
 const sliderLabel=el('label','Inspect run ',inspect),slider=el('input','',sliderLabel);slider.type='range';slider.min='0';slider.step='1';slider.setAttribute('aria-label','Inspect learning run');
 const detail=el('p','',inspect);detail.setAttribute('aria-live','polite');detail.id='learning-chart-selected';
 const play=el('button','PLAY SELECTED RUN',inspect);play.type='button';play.addEventListener('click',()=>{const r=visible[Number(slider.value)];if(r)watch(r);});
 function shape(tag,attrs,text){const e=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;svg.append(e);return e;}
 function draw(){
  for(const [key,b]of buttons)b.setAttribute('aria-pressed',String(metric===key));
  const count=Number(range.value),training=count?data.training.slice(-count):data.training;
  const cutoff=count&&training.length?training[0].attempt:0;
  const evaluations=showEvaluations?data.evaluations.filter(r=>r.attempt>=cutoff):[];
  const baselines=!cutoff?data.baselines:[];
  visible=[...training.map(p=>p.record),...evaluations,...baselines].sort((a,b)=>a.attempt-b.attempt||(a.order??0)-(b.order??0)||a.id.localeCompare(b.id));
  const prior=visible.findIndex(r=>r.id===selectedId);slider.max=String(Math.max(0,visible.length-1));slider.value=String(prior>=0?prior:Math.max(0,visible.length-1));
  slider.disabled=play.disabled=!visible.length;inspect.hidden=!visible.length;svg.replaceChildren();
  chartWidth=Math.max(320,Math.min(960,panel.clientWidth||720));svg.setAttribute('viewBox',`0 0 ${chartWidth} 230`);
  const left=46,right=chartWidth-16,top=18,bottom=194,first=cutoff,last=Math.max(first+1,...visible.map(r=>r.attempt));
  const value=r=>metric==='diamonds'?r.run.diamonds:metric==='winrate'?(r.run.status==='won'?100:0):r.run.status==='won'?r.run.ticks:null;
  const maximum=metric==='winrate'?100:metric==='diamonds'?Math.max(1,...visible.map(r=>Math.max(r.run.diamonds,r.run.target))):Math.max(100,...visible.filter(r=>r.run.status==='won').map(r=>r.run.ticks));
  const tickStep=metric==='winrate'?25:metric==='diamonds'?Math.max(1,Math.ceil(maximum/5)):Math.max(25,Math.ceil(maximum/100)*25),upper=Math.ceil(maximum/tickStep)*tickStep;
  const x=n=>left+(n-first)/(last-first)*(right-left),y=n=>bottom-n/upper*(bottom-top);
  svg.setAttribute('aria-label',metric==='diamonds'?'Diamonds collected over training attempts, with evaluation results':metric==='winrate'?'Rolling training win rate, with individual evaluation outcomes':'Steps to escape for successful runs only');
  for(let v=0;v<=upper;v+=tickStep){const yy=y(v);shape('line',{x1:left,x2:right,y1:yy,y2:yy,class:'chart-grid'});shape('text',{x:left-8,y:yy+3,'text-anchor':'end',class:'chart-axis'},metric==='winrate'?`${v}%`:String(v));}
  shape('text',{x:left,y:218,class:'chart-axis'},`Attempt ${first}`);shape('text',{x:right,y:218,'text-anchor':'end',class:'chart-axis'},String(last));
  const xStep=Math.max(1,Math.ceil((last-first)/20)*5);for(let n=first+xStep;n<last-(last-first)*.12;n+=xStep){shape('line',{x1:x(n),x2:x(n),y1:top,y2:bottom,class:'chart-grid'});shape('text',{x:x(n),y:218,'text-anchor':'middle',class:'chart-axis'},String(n));}
  if(metric==='diamonds'&&visible.length){const target=visible[0].run.target;shape('line',{x1:left,x2:right,y1:y(target),y2:y(target),class:'chart-quota'});shape('text',{x:right-4,y:Math.max(top+10,y(target)-6),'text-anchor':'end',class:'chart-axis'},`Quota ${target}`);}
  const points=training.map(p=>({record:p.record,value:metric==='winrate'?p.rollingWinRate:value(p.record)})).filter(p=>p.value!==null);
  if(points.length)shape('path',{d:points.map((p,i)=>`${i?'L':'M'}${x(p.record.attempt).toFixed(2)},${y(p.value).toFixed(2)}`).join(' '),class:metric==='winrate'?'chart-best':'chart-training-line'});
  if(metric!=='winrate'){
   const best=training.map(p=>({attempt:p.attempt,value:metric==='diamonds'?p.bestDiamonds:p.bestWinTicks})).filter(p=>p.value!==null);
   if(best.length)shape('path',{d:best.map((p,i)=>`${i?'H':'M'}${x(p.attempt).toFixed(2)}${i?'V':','}${y(p.value).toFixed(2)}`).join(' '),class:'chart-best'});
  }
  function point(record,v,evaluation=false,baseline=false){
   if(v===null)return;const cx=x(record.attempt),cy=y(v),r=evaluation?4:record.run.status==='won'?3.5:2;
   const p=shape(evaluation?'path':'circle',evaluation?{d:`M${cx},${cy-r}l${r},${r}l${-r},${r}l${-r},${-r}Z`,class:'chart-evaluation'}:{cx,cy,r,class:baseline?'chart-baseline':record.run.status==='won'?'chart-win':'chart-point'});
   const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${record.kind} ${record.attempt}: ${outcome[record.run.status]}, ${record.run.diamonds}/${record.run.target} diamonds, ${record.run.ticks} steps`;p.append(title);
   p.addEventListener('pointerenter',()=>select(record));p.addEventListener('click',()=>select(record));
  }
  const stride=Math.max(1,Math.ceil(points.length/500));points.forEach((p,i)=>{if(i%stride===0||p.record.run.status==='won'||i===points.length-1)point(p.record,p.value);});
  evaluations.forEach(r=>point(r,value(r),true));baselines.forEach(r=>point(r,value(r),false,true));
  const marker=shape('circle',{r:6,class:'chart-selected',visibility:'hidden'});
  function select(record){const index=visible.findIndex(r=>r.id===record.id);if(index<0)return;slider.value=String(index);selectedId=record.id;const r=record.run,v=metric==='winrate'&&record.kind==='training'?data.training.find(p=>p.record.id===record.id)?.rollingWinRate:value(record);
   detail.textContent=`${record.kind==='baseline'?'Baseline':record.kind==='evaluation'?`Evaluation after ${record.attempt}`:`Attempt ${record.attempt}`} · ${outcome[r.status]} · ${r.diamonds}/${r.target} diamonds · ${r.ticks} steps`+(['auto','manual'].includes(r.explorationMode)&&Number.isFinite(r.exploration)?` · ${r.explorationMode==='auto'?'Auto':'Manual'} ${Math.round(r.exploration*100)}%`:'');
   detail.title=typeof r.explorationReason==='string'?r.explorationReason:'';
   slider.setAttribute('aria-valuetext',detail.textContent);marker.setAttribute('visibility',v===null||v===undefined?'hidden':'visible');if(v!==null&&v!==undefined){marker.setAttribute('cx',String(x(record.attempt)));marker.setAttribute('cy',String(y(v)));}
  }
  slider.oninput=()=>{const r=visible[Number(slider.value)];if(r)select(r);};if(visible.length)select(visible[Number(slider.value)]);
  const s=data.summary;stats.setAttribute('aria-label',`${s.count} recorded training runs · ${s.wins} escape${s.wins===1?'':'s'} (${s.winRate===null?'—':s.winRate.toFixed(1)+'%'}) · first escape ${s.firstWin===null?'—':'#'+s.firstWin} · best escape ${s.bestWinTicks===null?'—':s.bestWinTicks+' steps'}`);
  stats.replaceChildren();for(const [label,value]of [['Recorded runs',s.count],['Training escapes',s.wins],['Win rate',s.winRate===null?'—':s.winRate.toFixed(1)+'%'],['First escape',s.firstWin===null?'—':'#'+s.firstWin],['Best escape',s.bestWinTicks===null?'—':s.bestWinTicks+' steps']]){const cell=el('div','',stats);el('span',label,cell);el('strong',String(value),cell);}
  legend.textContent=(metric==='winrate'?'Green: rolling training win rate (up to 10 runs). Amber diamonds: individual evaluation outcomes.':`Green dots: training${metric==='steps'?' escapes':''}. Bright line: ${metric==='steps'?'best escape':'most diamonds'} so far. Amber diamonds: evaluations.`)+(baselines.length?' Hollow circle: baseline.':'');
  const missing=Math.max(0,expected-s.count),hasValues=points.length||evaluations.some(r=>value(r)!==null)||baselines.some(r=>value(r)!==null);
  note.textContent=!visible.length?'No recorded runs for this cave yet. Complete training to build a history.':!hasValues&&metric==='steps'?'No escapes in this range yet. Failed runs are excluded from escape speed.':metric==='steps'?'Successful escapes only; fewer steps is faster.':metric==='diamonds'?'Collecting the quota does not count as an escape. Inspect a point or use the slider to play its run.':'Evaluations are excluded from the training win rate.';
  if(missing)note.textContent+=` ${missing} training inputs are missing from this archive; gaps are not filled in.`;
 }
 range.addEventListener('change',draw);evalToggle.addEventListener('change',()=>{showEvaluations=evalToggle.checked;draw();});
 new ResizeObserver(()=>{const width=Math.max(320,Math.min(960,panel.clientWidth||720));if(width!==chartWidth)draw();}).observe(panel);
 draw();return {update(records,attempts=0){data=learningProgress(records);expected=attempts;draw();}};
}

export function mountLearning({getContext,pause,onWatch,onTrainingPreview=()=>{}}){
 const section=document.createElement('section');section.className='playtest-library learning-player';section.setAttribute('aria-label','Learning player');
 const header=document.createElement('div');header.className='learning-heading';section.append(header);
 const title=document.createElement('h3');title.textContent='Learning player';header.append(title);
 const content=document.createElement('div');content.id='learning-content';section.append(content);
 function text(tag,value,parent=content){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
 const toggle=text('button','HIDE CONTENT',header);toggle.setAttribute('aria-controls',content.id);
 let collapsed=false;try{collapsed=localStorage.getItem('deepfall.learning.collapsed')==='true';}catch{}
 function collapse(){content.hidden=collapsed;toggle.textContent=collapsed?'SHOW CONTENT':'HIDE CONTENT';toggle.setAttribute('aria-expanded',String(!collapsed));}
 toggle.addEventListener('click',()=>{collapsed=!collapsed;collapse();try{localStorage.setItem('deepfall.learning.collapsed',String(collapsed));}catch{}});collapse();
 const contextLabel=text('p','',header);contextLabel.className='learning-context';header.insertBefore(contextLabel,toggle);
 const nav=text('div','');nav.className='learning-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Learning player views');
 const views=new Map(),viewTabs=new Map();let activeView='overview';
 for(const [key,label]of [['overview','Overview'],['graphs','Graphs'],['replays','Replays'],['data','Data']]){
  const tab=text('button',label,nav);tab.type='button';tab.id=`learning-tab-${key}`;tab.setAttribute('role','tab');tab.setAttribute('aria-label',label);tab.setAttribute('aria-controls',`learning-view-${key}`);
  const panel=text('div','');panel.id=`learning-view-${key}`;panel.className='learning-view';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);views.set(key,panel);viewTabs.set(key,tab);
  tab.addEventListener('click',()=>showView(key));tab.addEventListener('keydown',event=>{const keys=[...views.keys()],index=keys.indexOf(key);let next;if(event.key==='ArrowRight')next=keys[(index+1)%keys.length];else if(event.key==='ArrowLeft')next=keys[(index+keys.length-1)%keys.length];else if(event.key==='Home')next=keys[0];else if(event.key==='End')next=keys.at(-1);if(next){event.preventDefault();showView(next);viewTabs.get(next).focus();}});
 }
 function showView(key){activeView=key;for(const [name,panel]of views){panel.hidden=name!==key;const tab=viewTabs.get(name);tab.setAttribute('aria-selected',String(name===key));tab.tabIndex=name===key?0:-1;}}
 showView(activeView);
 const workspace=document.createElement('div');workspace.className='learning-workspace';views.get('overview').append(workspace);
 const overview=document.createElement('div');overview.className='learning-overview';workspace.append(overview);text('h4','Progress',overview);
 const metrics=document.createElement('dl');metrics.className='learning-metrics';overview.append(metrics);
 function metric(label){const cell=document.createElement('div');metrics.append(cell);text('dt',label,cell);return text('dd','—',cell);}
 const attemptsMetric=metric('Training attempts'),winsMetric=metric('Wins · last 10'),baselineMetric=metric('Before learning'),policyMetric=metric('Evaluated policy');
 const trend=text('p','Train to measure progress.',overview);trend.className='learning-trend';
 const bestLine=document.createElement('div');bestLine.className='learning-best';overview.append(bestLine);const bestInfo=text('span','No escape saved yet.',bestLine);
 const training=document.createElement('div');training.className='learning-training';workspace.append(training);text('h4','Train on this cave',training);
 text('p','Explore new routes, then test the learned choices.',training).className='learning-hint';
 const controls=document.createElement('div');controls.className='learning-controls';training.append(controls);
 const countLabel=text('label','Attempts ',controls),count=document.createElement('select');count.setAttribute('aria-label','Training attempts');
 for(const n of [1,5,10,25,50,100]){const option=text('option',String(n),count);option.value=String(n);}count.value='10';countLabel.append(count);
 const exploreLabel=text('label','Exploration ',controls),explore=document.createElement('select');explore.setAttribute('aria-label','Exploration');
 const automatic=text('option','Auto',explore);automatic.value='auto';
 for(const v of [.1,.25,.5]){const option=text('option',`${v*100}%`,explore);option.value=String(v);}explore.value='auto';
 try{const previous=localStorage.getItem('deepfall.exploration-mode');if(['auto','0.1','0.25','0.5'].includes(previous))explore.value=previous;}catch{}
 exploreLabel.append(explore);
 const exploreInfo=text('p','',training);exploreInfo.id='learning-exploration';exploreInfo.className='learning-exploration-note';exploreInfo.setAttribute('aria-live','polite');let activeExploration=null;
 explore.addEventListener('change',()=>{try{localStorage.setItem('deepfall.exploration-mode',explore.value);}catch{}renderExploration();});
 function button(label,fn,parent=controls){const b=text('button',label,parent);b.addEventListener('click',fn);return b;}
 let worker=null,saved=null,loadedKey='',ready=false,loadPromise=Promise.resolve(),generation=0,historyGeneration=0,page=0,history={total:0,training:0,records:[]},pendingSave=Promise.resolve();
 const actions=document.createElement('div');actions.className='learning-controls learning-actions';training.append(actions);
 const previewLabel=text('label','',training);previewLabel.className='learning-preview-toggle';const previewToggle=document.createElement('input');previewToggle.type='checkbox';previewToggle.checked=true;previewToggle.setAttribute('aria-label','Render training in game');previewLabel.append(previewToggle,document.createTextNode(' Render training in game'));
 const rewindsLabel=text('label','',training);rewindsLabel.className='learning-preview-toggle';const rewindsToggle=document.createElement('input');rewindsToggle.type='checkbox';try{rewindsToggle.checked=localStorage.getItem('deepfall.learning.search-rewinds')==='true';}catch{}rewindsToggle.setAttribute('aria-label','Show search rewinds');rewindsToggle.title='Show changing search candidates. Turn off to play completed attempts continuously.';rewindsLabel.append(rewindsToggle,document.createTextNode(' Show search rewinds'));
 text('p','Off: each completed attempt plays continuously. On: watch the search switch and rewind between candidates. This controls the preview, not Echo gameplay rewinds.',training).className='learning-preview-help';
 previewToggle.addEventListener('change',()=>{rewindsToggle.disabled=!previewToggle.checked;});rewindsToggle.addEventListener('change',()=>{try{localStorage.setItem('deepfall.learning.search-rewinds',String(rewindsToggle.checked));}catch{}});
 const activity=text('div','');activity.className='learning-activity';nav.after(activity);
 const status=text('p','Loading saved learning…',activity);status.id='learning-status';status.setAttribute('role','status');
 const charts=mountLearningCharts(views.get('graphs'),record=>{pause();onWatch(replayAttempt(record));});
 const report=document.createElement('details');report.className='learning-report';views.get('overview').append(report);text('summary','Full learning report',report);
 const progress=text('p','',report);progress.id='learning-progress';
 const archiveHeader=document.createElement('div');archiveHeader.className='learning-archive-heading';views.get('replays').append(archiveHeader);text('h4','Saved replays',archiveHeader);
 const historyInfo=text('p','',views.get('replays'));historyInfo.id='learning-history-status';
 const filters=document.createElement('div');filters.className='learning-controls learning-filters';views.get('replays').append(filters);
 function select(label,options,initial){const visible={'Attempts per page':'Rows','Sort replays':'Sort','Replay result':'Result','Replay type':'Type'}[label];const l=text('label',visible+' ',filters),s=document.createElement('select');s.setAttribute('aria-label',label);for(const [value,name]of options){const o=text('option',name,s);o.value=value;}s.value=initial;l.append(s);s.addEventListener('change',()=>{page=0;refreshHistory().catch(e=>status.textContent=e.message);});return s;}
 const pageSize=select('Attempts per page',[10,25,50,100].map(n=>[String(n),String(n)]),'10');
 const sort=select('Sort replays',[['newest','Newest first'],['oldest','Oldest first'],['steps','Fewest steps'],['diamonds','Most diamonds']],'newest');
 const resultFilter=select('Replay result',[['all','All results'],['won','Escaped'],['dead','Died'],['budget','Attempt limit']],'all');
 const kindFilter=select('Replay type',[['all','All types'],['training','Training'],['baseline','Baseline'],['evaluation','Evaluation']],'all');
 const tableWrap=document.createElement('div');tableWrap.className='learning-table-wrap';views.get('replays').append(tableWrap);
 const table=document.createElement('table');table.className='learning-results';table.innerHTML='<caption>Saved AI replays for this cave</caption><thead><tr><th>Run</th><th>Result</th><th>Diamonds</th><th>Steps</th><th><span class="learning-sr-only">Replay</span></th></tr></thead><tbody></tbody>';tableWrap.append(table);const tbody=table.querySelector('tbody');
 const pager=document.createElement('div');pager.className='learning-controls learning-pager';views.get('replays').append(pager);
 const backups=document.createElement('div');backups.className='learning-backups';views.get('data').append(backups);text('h4','Backups & data',backups);
 text('p','Every completed AI attempt stays in this browser. Export backups before clearing browser data. AI replays are separate from live recordings.',backups);
 const backupGrid=text('div','',backups);backupGrid.className='learning-backup-grid';
 function backupGroup(title,description){const box=text('div','',backupGrid);box.className='learning-backup-card';text('h5',title,box);text('p',description,box);const c=text('div','',box);c.className='learning-controls';return c;}
 const modelBackupControls=backupGroup('Learning model','Decisions and remembered routes for this cave and difficulty.'),replayBackupControls=backupGroup('Replay archive','Every recorded AI attempt across all caves, including failures.');
 const train=button('TRAIN PLAYER',()=>startJob('train',false),actions);train.className='learning-primary';
 const stop=button('STOP TRAINING',async()=>{
  worker?.terminate();worker=null;onTrainingPreview(null);ready=false;render();status.textContent='Stopping and finishing replay storage…';
  try{await pendingSave;await load(true);status.textContent='Stopped. Completed attempts, replays and learning are kept.';}catch(error){status.textContent=`Replay storage error: ${error.message}`;}
 },actions);
 activity.append(stop);
 const watchNext=button('WATCH NEXT ATTEMPT',()=>startJob('train',true),actions);
 const watchBest=button('WATCH BEST RUN',()=>{const run=saved?.best??saved?.partials?.[0];if(run){pause();onWatch({...run,mode:'classic',learningAttempts:saved.attempts,replayKind:saved.best?'best':'partial'});}},bestLine);
 const exportLearning=button('EXPORT LEARNING',()=>{if(saved)downloadJSON(`deepfall-learning-${loadedKey.replaceAll(':','-')}.json`,saved);},modelBackupControls);
 let importing=false;
 const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;content.append(fileInput);
 let importKind='learning';
 const importModel=button('IMPORT LEARNING',()=>{importKind='learning';fileInput.click();},modelBackupControls);
 const importReplays=button('IMPORT REPLAYS',()=>{importKind='replays';fileInput.click();},replayBackupControls);
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
 const recover=button('RECOVER EARLIER REPLAYS',()=>startJob('recover',false),replayBackupControls);
 const watchAll=button('WATCH ALL REPLAYS',async()=>{
  try{const records=await allLearningReplays(getContext());if(records.length){pause();onWatch(records.map(replayAttempt));}}catch(error){status.textContent=error.message;}
 },archiveHeader);watchAll.title='Play the entire cave archive in chronological order.';
 const exportAll=button('EXPORT ALL REPLAYS',async()=>{
  try{downloadJSON('deepfall-all-learning-replays.json',{format:'deepfall-learning-replays-1',runs:await allLearningReplays()});}catch(error){status.textContent=error.message;}
 },replayBackupControls);
 const previous=button('PREVIOUS REPLAYS',async()=>{page=Math.max(0,page-1);await refreshHistory();},pager);
 const next=button('NEXT REPLAYS',async()=>{page++;await refreshHistory();},pager);

 function render(){
  renderExploration();explore.disabled=previewToggle.disabled=Boolean(worker);rewindsToggle.disabled=Boolean(worker)||!previewToggle.checked;
  section.classList.toggle('is-training',Boolean(worker));viewTabs.get('replays').textContent=history.total?`Replays (${history.total})`:'Replays';
  const results=saved?.results??[],wins=results.filter(r=>r.status==='won').length,recent=results.slice(-10),recentWins=recent.filter(r=>r.status==='won').length;
  const describe=r=>r.status==='won'?`escaped in ${r.ticks} steps`:`${r.diamonds}/${r.target} diamonds, ${r.status==='budget'?'attempt limit reached':'died'}`;
  const prior=results.slice(-20,-10),priorWins=prior.filter(r=>r.status==='won').length;
  const improved=saved?.evaluation&&saved?.baseline&&(saved.evaluation.status==='won'&&(saved.baseline.status!=='won'||saved.evaluation.ticks<saved.baseline.ticks)||saved.evaluation.diamonds>saved.baseline.diamonds);
  const compact=r=>!r?'Not measured':r.status==='won'?`${r.ticks} steps · escaped`:`${r.diamonds}/${r.target} · ${r.status==='dead'?'died':'attempt limit'}`;
  attemptsMetric.textContent=String(saved?.attempts??0);winsMetric.textContent=`${recentWins} / ${recent.length}`;
  baselineMetric.textContent=compact(saved?.baseline);policyMetric.textContent=compact(saved?.evaluation);
  trend.textContent=saved?.evaluation?(improved?'Evaluation improved on the baseline.':'No measured improvement yet.'):'Complete a training batch to evaluate progress.';
  trend.classList.toggle('improved',Boolean(improved));bestInfo.textContent=saved?.best?`Best escape · ${saved.best.ticks} steps`:saved?.partials?.length?`Best partial · ${saved.partials[0].diamonds}/${saved.partials[0].target} · no escape yet`:'No escape saved yet.';
  progress.textContent=`${saved?.attempts??0} attempts learned · ${wins}/${results.length} wins in retained history · last ${recent.length}: ${recentWins} wins${prior.length?` (previous ${prior.length}: ${priorWins})`:''} · ${new Set(results.map(r=>r.route)).size} distinct routes · ${saved?.values?.length??0} remembered decisions.`+(saved?.best?` Best win: ${saved.best.ticks} steps, ${saved.best.diamonds}/${saved.best.target} diamonds.`:' No winning route saved yet.')+(saved?.baseline?` Before learning: ${describe(saved.baseline)}.`:'')+(saved?.evaluation?` Current learned policy: ${describe(saved.evaluation)}. ${improved?'Measured improvement over baseline.':'No measured improvement over baseline yet; different routes alone are not progress.'}`:'')+(!saved?.planningRevision&&saved?.attempts?' Next training adds route planning and partial-run memory; existing decisions and replays are kept.':'');
  train.disabled=!ready||Boolean(worker);train.hidden=Boolean(worker);stop.disabled=!worker;stop.hidden=!worker;watchNext.disabled=!ready||Boolean(worker);watchBest.disabled=!saved?.best&&!saved?.partials?.length;watchBest.textContent=saved?.best||!saved?.partials?.length?'WATCH BEST RUN':'WATCH BEST PROGRESS';exportLearning.disabled=!saved;
  const missing=Math.max(0,(saved?.attempts??0)-history.training);recover.hidden=!missing;recover.disabled=!ready||Boolean(worker);
  historyInfo.textContent=`${history.total} archived replays · ${history.training} training attempts · ${history.matched??0} match filters`+(history.matched?` · ${page*Number(pageSize.value)+1}–${Math.min(history.matched,(page+1)*Number(pageSize.value))} · Page ${page+1}/${Math.ceil(history.matched/Number(pageSize.value))}`:' · No matching replays')+(missing?` · ${missing} earlier inputs missing`:'.');
  watchAll.disabled=!history.total;exportAll.disabled=!ready;previous.disabled=page===0;next.disabled=(page+1)*Number(pageSize.value)>=(history.matched??0);
  if(saved?.policyStartAttempt>0)progress.textContent+=` Updated learning method: ${saved.attempts-saved.policyStartAttempt} attempts since upgrade; ${saved.policyStartAttempt} earlier attempts remain archived.`;
  if(saved?.planningRevision)progress.textContent+=` Planner: ${saved.planningAttempts??0} attempts, ${saved.partials?.length??0} retained routes, ${saved.frontier?.length??0} saved search branches.`;
  importModel.disabled=importReplays.disabled=!ready||Boolean(worker)||importing;
  tbody.replaceChildren();
  for(const record of history.records){
   const label=record.kind==='baseline'?'Before learning':record.kind==='evaluation'?`Evaluation after ${record.attempt}`:`Attempt ${record.attempt}`;
   const row=document.createElement('tr');for(const [i,value]of [label,outcome[record.run.status],`${record.run.diamonds}/${record.run.target}`,record.run.ticks].entries()){const cell=text('td','',row);if(i===1){const badge=text('span',String(value),cell);badge.className=`learning-outcome ${record.run.status}`;}else cell.textContent=String(value);}
   const cell=document.createElement('td');row.append(cell);
   const watchLabel=record.kind==='training'?`WATCH ATTEMPT ${record.attempt}`:record.kind==='baseline'?'WATCH BASELINE':`WATCH EVALUATION ${record.attempt}`;
   const playButton=button('PLAY',()=>{pause();onWatch(replayAttempt(record));},cell);playButton.setAttribute('aria-label',watchLabel);playButton.title=watchLabel;
   if(record.run.plannerRevision)playButton.title+=` · planned route · ${record.run.searchExpanded} search states · ${record.run.reusedPartials} remembered routes`;
   if(record.reconstructed)text('small','Verified reconstruction',cell);tbody.append(row);
  }
 }
 function renderExploration(){
  if(explore.value!=='auto'){exploreInfo.textContent=`Manual · ${Math.round(Number(explore.value)*100)}% for each training attempt.`;return;}
  const choice=worker&&activeExploration?activeExploration:adaptiveExploration(saved??{attempts:0,results:[]});
  exploreInfo.textContent=`Auto · ${Math.round(choice.value*100)}% ${worker&&activeExploration?`for attempt ${activeExploration.attempt}`:'next attempt'}. ${choice.reason}`;
 }
 async function refreshHistory(){
  const token=++historyGeneration,key=loadedKey,context={...getContext()};
  const records=await allLearningReplays(context),value=selectLearningReplays(records,{page,size:Number(pageSize.value),sort:sort.value,status:resultFilter.value,kind:kindFilter.value});
  if(token!==historyGeneration||key!==loadedKey)return;
  history=value;page=value.page;charts.update(records,saved?.attempts??0);render();
 }
 function load(force=false){
  const context={...getContext()},key=contextKey(context);
  if(worker&&key!==loadedKey){worker.terminate();worker=null;onTrainingPreview(null);}
  if(!force&&key===loadedKey)return loadPromise;
  if(worker)return loadPromise;
  const token=++generation;loadedKey=key;ready=false;saved=null;activeExploration=null;page=0;history={total:0,training:0,records:[]};charts.update([]);render();status.textContent='Loading saved learning and replay history…';
  loadPromise=(async()=>{
   try{
    let model=await readLearningModel(context),legacy=false;
    if(!model){try{model=JSON.parse(localStorage.getItem('deepfall.learning.'+key)??'null');legacy=Boolean(model);}catch{}}
    const normalized=model?.version===LEARNING_VERSION?new LearningPlayer(context,model).export():null;
    if(legacy&&normalized)await saveLearningRecords(context,normalized);
    if(token!==generation)return;saved=normalized;ready=true;await refreshHistory();
    if(token!==generation)return;
    contextLabel.textContent=`${context.campaign==='original'?'Original':'Deepfall'} · ${context.campaign==='original'?ORIGINAL_CAVES[context.index].id:context.index+1} · Level ${context.difficulty}`;
    status.textContent='Ready. Completed attempts are saved locally.';render();
   }catch(error){if(token===generation){ready=false;status.textContent=`Replay storage unavailable: ${error.message}. Training is disabled until replays can be saved.`;render();}}
  })();return loadPromise;
 }
 async function startJob(type,watch){
  if(worker||importing)return;await load();if(!ready||worker||importing)return;
  const context={...getContext()},key=contextKey(context);if(key!==loadedKey)return;pause();
  try{
   const job=new Worker(new URL('./learning-worker.mjs',import.meta.url),{type:'module'}),preview=type==='train'&&previewToggle.checked,searchRewinds=rewindsToggle.checked;worker=job;activeExploration=null;render();
   status.textContent=type==='recover'?'Verifying earlier replay inputs…':watch?'Planning an exploratory attempt to watch…':'Training in simulation…';
   job.onmessage=async({data})=>{
    if(worker!==job)return;
    try{
     if(data.type==='exploration'){activeExploration=data;renderExploration();if(preview)onTrainingPreview({type:'start',context,attempt:data.attempt,exploration:data.value,searchRewinds});return;}
     if(data.type==='progress'){
      const label={baseline:'Measuring untrained player',evaluation:'Measuring learned player',recovery:'Verifying earlier replays'}[data.phase]??`Training attempt ${data.attempt}`;
      if(preview&&searchRewinds&&data.phase==='training'&&data.previewInput)onTrainingPreview({type:'route',context,attempt:data.attempt,input:data.previewInput,decision:data.decision,branches:data.previewBranches,searchRewinds});
      status.textContent=data.frontier!==undefined?`${label}: ${data.decision} search states · best ${data.diamonds} diamonds · ${data.frontier} open branches.`:`${label}: ${data.diamonds} diamonds, ${data.ticks} steps.`;return;
     }
     if(data.type==='record'||data.type==='recovered'){
      const records=data.type==='record'?[learningReplay(context,data.kind,data.attempt,data.run)]:data.records.map(r=>learningReplay(context,r.kind,r.attempt,r.run,true));
      pendingSave=saveLearningRecords(context,data.saved,records);await pendingSave;
      if(worker!==job)return;saved=data.saved;await refreshHistory();
      status.textContent=data.type==='recovered'?'Earlier replays recovered and fingerprint-verified.':`${data.kind==='training'?`Attempt ${data.attempt}`:data.kind}: replay and learning saved.`;
      if(preview&&data.type==='record'&&data.kind==='training')await onTrainingPreview({type:'route',context,attempt:data.attempt,input:data.run.input,final:true,status:data.run.status,searchRewinds});
      if(worker!==job)return;
      job.postMessage({type:'ack',id:data.id});
      if(data.type==='record'&&data.watch&&data.kind==='training'&&!preview)onWatch(replayAttempt(records[0]));
     }
     if(data.type==='done'||data.type==='error'){
      job.terminate();worker=null;onTrainingPreview(null);status.textContent=data.type==='error'?`Training stopped: ${data.message}`:data.recovered?'Earlier replays recovered and verified.':'Training finished. All completed replays saved.';render();
     }
    }catch(error){job.terminate();worker=null;onTrainingPreview(null);ready=false;status.textContent=`Could not save replay: ${error.message}. Training stopped; existing records are preserved.`;render();}
   };
   job.onerror=()=>{if(worker!==job)return;job.terminate();worker=null;onTrainingPreview(null);status.textContent='Training worker stopped unexpectedly. Saved replays and completed learning are preserved.';render();};
   const priorRuns=type==='train'?(await allLearningReplays(context)).map(r=>r.run).sort((a,b)=>(b.status==='won')-(a.status==='won')||b.diamonds-a.diamonds||a.ticks-b.ticks).slice(0,24):[];
   if(worker!==job)return;
   job.postMessage({type,context,saved,partialRuns:priorRuns,count:watch?1:Number(count.value),explorationMode:explore.value==='auto'?'auto':'manual',exploration:explore.value==='auto'?undefined:Number(explore.value),watch});
  }catch(error){worker?.terminate();worker=null;onTrainingPreview(null);status.textContent=error.message;render();}
 }
 document.querySelector('.sid-panel')?.before(section);if(!section.isConnected)document.querySelector('main').append(section);
 load();return {refresh:load,stop:()=>{if(worker)stop.click();}};
}
