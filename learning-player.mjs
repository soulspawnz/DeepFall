import {Game} from './engine.mjs';
import {ACTIONS,cloneGame} from './simulation.mjs';
import {planRoute,choosePlanningPriorities,learnPlanningPriorities,validPriorityLearning,planningOutcomeFitness} from './route-planner.mjs';
import {amoebaSummary,validAmoebaSummary} from './route-planner.mjs';

export const LEARNING_VERSION='deepfall-experience-2';
const LIMIT=20000;
function validSummary(r){return r&&['won','dead','budget'].includes(r.status)&&Number.isInteger(r.diamonds)&&r.diamonds>=0&&r.diamonds<=10000&&Number.isInteger(r.target)&&r.target>=0&&r.target<=1000&&Number.isInteger(r.ticks)&&r.ticks>0&&r.ticks<=4000&&Number.isFinite(r.score)&&Number.isFinite(r.remaining)&&typeof r.route==='string'&&r.route.length<=32&&(r.amoebaPlanning===undefined||validAmoebaSummary(r.amoebaPlanning));}
function validInput(input){return Array.isArray(input)&&input.length>0&&input.length<=4000&&input.every(a=>Array.isArray(a)&&a.length===3&&Number.isInteger(a[0])&&Number.isInteger(a[1])&&Math.abs(a[0])+Math.abs(a[1])<=1&&typeof a[2]==='boolean');}
function hash(text) {
 let a=2166136261,b=5381;
 for(let n=0;n<text.length;n++){const c=text.charCodeAt(n);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
 return (a>>>0).toString(36)+(b>>>0).toString(36);
}
export const inputFingerprint=input=>hash(JSON.stringify(input));
export function planningPrefixes(memories,frontier,seed,{learn=true,strategic=false}={}){
 const prefixes=memories.map(r=>r.status==='won'&&learn?r.input.slice(0,Math.max(1,Math.floor(r.input.length*(.6+(seed%7)*.05)))):r.input),offset=(seed*7)%Math.max(1,frontier.length);
 if(strategic)prefixes.push(...frontier.slice(0,8));
 prefixes.push(...frontier.slice(offset),...frontier.slice(0,offset));
 const seen=new Set();return prefixes.filter(input=>{const key=JSON.stringify(input);if(seen.has(key))return false;seen.add(key);return true;});
}
export function contextKey(context){return `${context.campaign}:${context.difficulty}:${context.index}`;}
export function adaptiveExploration(model){
 const rows=(model.results??[]).filter(r=>(!r.kind||r.kind==='training')&&['won','dead','budget'].includes(r.status)),attempts=Math.max(0,Number(model.attempts)||0),old=model.autoExploration;
 const valid=old&&Number.isFinite(old.value)&&old.value>=.1&&old.value<=.6&&Number.isInteger(old.adjustedAt)&&old.adjustedAt>=0&&old.adjustedAt<=attempts&&typeof old.reason==='string';
 const value=valid?old.value:.25,adjustedAt=valid?old.adjustedAt:0;
 if(rows.length<5)return {value:.25,adjustedAt:0,reason:'Building a baseline from the first five training attempts.'};
 if(valid&&attempts-adjustedAt<5)return {value,adjustedAt,reason:old.reason};
 const freshCount=valid?Math.min(10,attempts-adjustedAt):10,fresh=rows.slice(-freshCount),prior=rows.slice(-freshCount-10,-freshCount),recent=rows.slice(-10);
 const rate=r=>r.filter(x=>x.status==='won').length/Math.max(1,r.length);
 const progress=r=>Math.max(0,...r.map(x=>Math.min(x.diamonds,x.target)/Math.max(1,x.target)));
 const speed=r=>{const wins=r.filter(x=>x.status==='won').map(x=>x.ticks).sort((a,b)=>a-b);return wins.length>=2?wins[Math.floor(wins.length/2)]:null;};
 const faster=speed(fresh)!==null&&speed(prior)!==null&&speed(fresh)<speed(prior)*.95;
 const improving=prior.length&&(rate(fresh)>rate(prior)+.1||progress(fresh)>progress(prior)+.05||faster);
 let next=value,reason;
 if(recent.length>=5&&rate(recent)>=.6){next-=.05;reason='Recent escapes are consistent; focus on reliable routes.';}
 else if(improving){next-=.05;reason='New training progress; reinforce promising routes.';}
 else if(rate(recent)===0){next+=.1;reason='No recent escapes; broaden the search.';}
 else if(prior.length&&progress(fresh)<progress(prior)-.05){next+=.1;reason='Recent training progress fell back; try more alternatives.';}
 else {next+=.05;reason='Progress has levelled off; explore more alternatives.';}
 return {value:Math.round(Math.max(.1,Math.min(.6,next))*100)/100,adjustedAt:attempts,reason};
}
function signature(g,revision=1) {
 // Remaining time is deliberately excluded: experience transfers across waits.
 const s=g.snapshot();delete s.remaining;delete s.tick;delete s.trappedFor;
 if(revision>=2)delete s.score;
 if(!g.grid.some(r=>r.includes('a')))s.amoeba={dead:null,slow:0};
 if(!s.magic.active)s.magic.remaining=0;
 return hash(JSON.stringify(s));
}
function randomGenerator(seed) {
 let state=seed>>>0||1;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
function targets(g) {
 const dirs=ACTIONS.slice(0,4),q=[{...g.player,path:[]}],seen=new Set([`${g.player.x},${g.player.y}`]),goals=[];
 for(let i=0;i<q.length;i++) {
  const p=q[i],tile=g.tile(p.x,p.y);
  if(p.path.length) {
   if(tile==='X'&&g.collected>=g.target)goals.push({id:`exit:${p.x},${p.y}`,path:p.path,priority:10000-p.path.length});
   else if(tile==='*')goals.push({id:`gem:${p.x},${p.y}`,path:p.path,priority:1000-p.path.length});
   else if(tile==='.'&&['O','*'].includes(g.tile(p.x,p.y-1)))goals.push({id:`support:${p.x},${p.y}`,path:p.path,priority:100-p.path.length});
  }
  if(p.path.length>=36)continue;
  for(const [dx,dy]of dirs) {
   const x=p.x+dx,y=p.y+dy,k=`${x},${y}`,t=g.tile(x,y);
   if(seen.has(k)||!([' ','.','*'].includes(t)||(t==='X'&&g.collected>=g.target)))continue;
   seen.add(k);q.push({x,y,path:[...p.path,[dx,dy,false]]});
  }
 }
 goals.sort((a,b)=>b.priority-a.priority);
 return [...goals.slice(0,8),...ACTIONS.map((a,i)=>({id:`step:${i}`,path:[[a[0],a[1],Boolean(a[2])]]}))];
}
const survivalCache=new WeakMap();
function canSurvive(g,depth=2) {
 if(g.status==='won')return true;
 if(g.status!=='playing')return false;
 if(!depth)return true;
 const cached=survivalCache.get(g);if(cached?.[depth]!==undefined)return cached[depth];
 let safe=false;
 for(const a of ACTIONS){const next=cloneGame(g);next.step({dx:a[0],dy:a[1],snap:Boolean(a[2])});if(canSurvive(next,depth-1)){safe=true;break;}}
 survivalCache.set(g,{...cached,[depth]:safe});return safe;
}
function roll(g,path) {
 let next=cloneGame(g);const actions=[],checkpoints=[];let digs=0;
 for(const a of path) {
  checkpoints.push({game:cloneGame(next),length:actions.length,digs});
  if(checkpoints.length>4)checkpoints.shift();
  next.step({dx:a[0],dy:a[1],snap:a[2]});actions.push(a);
  if(next.events.includes('dig'))digs++;
  if(next.status!=='playing')break;
 }
 if(next.status==='dead'||!canSurvive(next)) {
  // A planned corridor may become unsafe mid-route. Return a viable prefix so
  // the next decision can take an escape turn instead of committing to death.
  const safe=checkpoints.reverse().find(p=>p.length>0&&canSurvive(p.game));
  if(safe){next=safe.game;actions.length=safe.length;digs=safe.digs;}
 }
 return {next,actions,digs};
}

// Monte Carlo control over physics-simulated routes. Persistent action values
// are updated from whole-attempt outcomes, including failure after the quota.
export class LearningPlayer {
 constructor(context, saved=null,revision=null) {
  this.context={campaign:context.campaign,index:context.index,difficulty:context.difficulty};
  const valid=saved?.version===LEARNING_VERSION&&contextKey(saved.context??{})===contextKey(this.context);
  this.policyRevision=revision??(valid?(saved.policyRevision??1):2);
  this.policyStartAttempt=valid?(saved.policyStartAttempt??0):0;
  this.values=new Map(valid&&Array.isArray(saved.values)?saved.values.slice(-(this.policyRevision>=2?LIMIT:3000)).filter(entry=>Array.isArray(entry)&&entry.length===2&&typeof entry[0]==='string'&&entry[0].length<=128&&Number.isFinite(entry[1]?.mean)&&Math.abs(entry[1].mean)<1e7&&Number.isInteger(entry[1]?.n)&&entry[1].n>0&&entry[1].n<=1e9):[]);
  this.attempts=valid&&Number.isInteger(saved.attempts)?Math.min(1e9,Math.max(0,saved.attempts)):0;
  this.results=valid&&Array.isArray(saved.results)?saved.results.slice(-100).filter(validSummary):[];
  this.best=valid&&validSummary(saved.best)&&saved.best.status==='won'&&contextKey(saved.best)===contextKey(this.context)&&validInput(saved.best.input)?saved.best:null;
  this.baseline=valid&&validSummary(saved.baseline)?saved.baseline:null;this.evaluation=valid&&validSummary(saved.evaluation)?saved.evaluation:null;
  this.planningRevision=valid&&saved.planningRevision===1?1:0;
  this.planningAttempts=valid&&Number.isInteger(saved.planningAttempts)?Math.max(0,saved.planningAttempts):0;
  this.partials=valid&&Array.isArray(saved.partials)?saved.partials.filter(r=>validSummary(r)&&validInput(r.input)&&contextKey(r)===contextKey(this.context)).slice(0,8):[];
  this.frontier=valid&&Array.isArray(saved.frontier)?saved.frontier.filter(validInput).slice(0,64):[];
  this.searchVisited=valid&&Array.isArray(saved.searchVisited)?saved.searchVisited.filter(e=>Array.isArray(e)&&typeof e[0]==='string'&&e[0].length<=32&&Number.isInteger(e[1])&&e[1]>=0&&e[1]<=4000).slice(-6000):[];
  this.priorityLearning=valid&&validPriorityLearning(saved.priorityLearning)?JSON.parse(JSON.stringify(saved.priorityLearning)):null;
  const auto=valid?saved.autoExploration:null;
  this.autoExploration=auto&&Number.isFinite(auto.value)&&auto.value>=.1&&auto.value<=.6&&Number.isInteger(auto.adjustedAt)&&auto.adjustedAt>=0&&auto.adjustedAt<=this.attempts&&typeof auto.reason==='string'&&auto.reason.length<=200?{value:auto.value,adjustedAt:auto.adjustedAt,reason:auto.reason}:null;
 }
 export() {return {version:LEARNING_VERSION,policyRevision:this.policyRevision,policyStartAttempt:this.policyStartAttempt,planningRevision:this.planningRevision,planningAttempts:this.planningAttempts,partials:this.partials,frontier:this.frontier,searchVisited:this.searchVisited,priorityLearning:this.priorityLearning,autoExploration:this.autoExploration,context:this.context,attempts:this.attempts,values:[...this.values],results:this.results,best:this.best,baseline:this.baseline,evaluation:this.evaluation};}
 upgrade(){this.planningRevision=1;}
 rememberPartials(runs){
  const sorted=[...this.partials,...runs].filter(r=>validSummary(r)&&validInput(r.input)&&contextKey(r)===contextKey(this.context));
  sorted.sort((a,b)=>(b.status==='won')-(a.status==='won')||b.diamonds-a.diamonds||a.ticks-b.ticks);
  const routes=new Set();this.partials=sorted.filter(r=>{if(routes.has(r.route))return false;routes.add(r.route);return true;}).slice(0,8);
 }
 *plannedAttempt({seed=this.attempts+1,exploration=.25,learn=true,searchNodes=600,fixture=null,fastTrappedTimer=true}={}){
  const priorities=choosePlanningPriorities(this.priorityLearning,seed,learn);
  const memories=[...(this.best?[this.best]:[]),...this.partials];
  const strategic=new Game(this.context.index,'classic',fixture,{...this.context,fastTrappedTimer}).grid.some(r=>r.includes('a'));
  const prefixes=planningPrefixes(memories,this.frontier,seed,{learn,strategic});
  const guide=(g,path)=>{const end=path.at(-1),id=path.length===1?`step:${ACTIONS.findIndex(a=>a[0]===end[0]&&a[1]===end[1]&&Boolean(a[2])===end[2])}`:`gem:${g.player.x+path.reduce((n,a)=>n+a[0],0)},${g.player.y+path.reduce((n,a)=>n+a[1],0)}`;return Math.tanh((this.values.get(`${signature(g,this.policyRevision)}/${id}`)?.mean??0)/500)*5;};
  const planned=yield* planRoute(this.context,{seed:learn?seed:1,maxNodes:searchNodes,prefixes,fixture,fastTrappedTimer,guide,visited:learn?this.searchVisited:[],exploration:learn?exploration:0,weights:priorities.weights});
  const game=planned.game,input=planned.input,status=game.status==='playing'?'budget':game.status;
  const run={...this.context,status,diamonds:game.collected,target:game.target,ticks:input.length,score:game.score,remaining:game.remaining,reason:game.reason,route:inputFingerprint(input),seed,exploration:learn?exploration:0,fastTrappedTimer,input,plannerRevision:7,planningPriorities:priorities,priorityFitness:planningOutcomeFitness(game,input.length),searchExpanded:planned.expanded,searchTacticalSteps:planned.tacticalSteps??0,searchAmoebaSteps:planned.amoebaSteps??0,searchBudget:searchNodes,reusedPartials:memories.length};
  if(game.amoeba.dead||game.grid.some(r=>r.includes('a')))run.amoebaPlanning=amoebaSummary(game);
  if(learn){
   this.priorityLearning=learnPlanningPriorities(this.priorityLearning,priorities,run.priorityFitness);
   this.attempts++;this.planningAttempts++;const {input:_,...summary}=run;this.results.push(summary);this.results=this.results.slice(-100);
   this.rememberPartials([run]);this.frontier=(planned.frontier??[]).filter(validInput).slice(0,64);this.searchVisited=planned.visited??this.searchVisited;
   if(status==='won'&&(!this.best||run.ticks<this.best.ticks))this.best=run;
   // Preserve the existing table and add decision credit from the verified
   // selected trajectory. Search uses those values only as bounded advice.
   const replay=new Game(this.context.index,'classic',fixture,{...this.context,fastTrappedTimer}),history=[];replay.start();
   for(const a of input){const key=`${signature(replay,this.policyRevision)}/step:${ACTIONS.findIndex(b=>b[0]===a[0]&&b[1]===a[1]&&Boolean(b[2])===a[2])}`,collected=replay.collected;replay.step({dx:a[0],dy:a[1],snap:a[2]});history.push({key,reward:(replay.collected-collected)*30+(replay.status==='won'?2000:0)-.15});}
   let value=status==='dead'?-400:status==='budget'?-100:0;
   for(let i=history.length-1;i>=0;i--){value=history[i].reward+.97*value;const {key}=history[i],old=this.values.get(key)??{n:0,mean:0};this.values.set(key,{n:old.n+1,mean:old.mean+(value-old.mean)/Math.min(old.n+1,8)});}
   while(this.values.size>LIMIT)this.values.delete(this.values.keys().next().value);
  }
  return run;
 }
 *attempt({seed=this.attempts+1,exploration=.25,learn=true,maxDecisions=120,fixture=null,fastTrappedTimer=true,searchNodes=600}={}) {
  if(this.planningRevision)return yield* this.plannedAttempt({seed,exploration,learn,fixture,fastTrappedTimer,searchNodes});
  const game=new Game(this.context.index,'classic',fixture,{...this.context,fastTrappedTimer});game.start();
  const rng=randomGenerator(seed),input=[],history=[],visits=new Map();
  while(!game.born&&game.status==='playing'){game.step();input.push([0,0,false]);}
  let current=game;
  for(let decision=0;decision<maxDecisions&&current.status==='playing';decision++) {
   const state=signature(current,this.policyRevision),choices=targets(current),scored=[];
   let totalVisits=1;
   for(const choice of choices)totalVisits+=this.values.get(`${state}/${choice.id}`)?.n??0;
   for(const choice of choices) {
    const {next,actions,digs}=roll(current,choice.path),entry=this.values.get(`${state}/${choice.id}`);
    const position=`${next.player.x},${next.player.y}`,stuck=signature(next,this.policyRevision)===state;
    const immediate=(Math.min(next.collected,next.target)-Math.min(current.collected,current.target))*30+(next.status==='won'?2000:0)-(!canSurvive(next)?4000:0)
      -actions.length*.15+Math.min(digs,8)*.15-(visits.get(position)??0)*3-(stuck?8:0);
    const curiosity=learn?5*Math.sqrt(Math.log(totalVisits+1)/((entry?.n??0)+1)):0;
    // The learned return already includes the eventual outcome; adding the
    // greedy immediate reward again would bias against learned detours.
    scored.push({choice,next,actions,immediate,key:`${state}/${choice.id}`,score:(entry?entry.mean:immediate)+curiosity-(visits.get(position)??0)*3});
   }
   scored.sort((a,b)=>b.score-a.score);
   const safe=scored.filter(c=>canSurvive(c.next));
   const pool=safe.length?safe:scored;
   // Exploration can choose a different safe route, rather than random suicide.
   const chosen=learn&&rng()<exploration?pool[Math.floor(rng()*Math.min(5,pool.length))]:pool[0];
   if(!chosen)break;
   history.push(this.policyRevision>=2?{key:chosen.key,reward:chosen.immediate}:chosen.key);current=chosen.next;input.push(...chosen.actions);
   const position=`${current.player.x},${current.player.y}`;visits.set(position,(visits.get(position)??0)+1);
   yield {decision:decision+1,diamonds:current.collected,ticks:input.length};
  }
  const status=current.status==='playing'?'budget':current.status;
  const result={...this.context,status,diamonds:current.collected,target:current.target,ticks:input.length,
   score:current.score,remaining:current.remaining,reason:current.reason,route:inputFingerprint(input),seed,exploration:learn?exploration:0,fastTrappedTimer,input};
  if(learn) {
   const outcome=(status==='won'?2000:status==='dead'?-400:-200)+Math.min(current.collected,current.target)*10-input.length*.15;
   let future=status==='dead'?-400:status==='budget'?-100:0;
   for(let i=history.length-1;i>=0;i--) {
    const key=this.policyRevision>=2?history[i].key:history[i],old=this.values.get(key)??{n:0,mean:0};
    const value=this.policyRevision>=2?(future=history[i].reward+.92*future):outcome-Math.min(100,(history.length-1-i)*.1);
    const n=old.n+1,mean=old.mean+(value-old.mean)/Math.min(n,8);
    this.values.delete(key);this.values.set(key,{n,mean});
   }
   while(this.values.size>(this.policyRevision>=2?LIMIT:3000))this.values.delete(this.values.keys().next().value);
   this.attempts++;const {input:_,...summary}=result;this.results.push(summary);this.results=this.results.slice(-100);
   if(status==='won'&&(!this.best||result.ticks<this.best.ticks))this.best=result;
  }
  return result;
 }
 run(options) {const steps=this.attempt(options);let next;do{next=steps.next();}while(!next.done);return next.value;}
}

// Recover older simulated traces only when every stored fingerprint matches.
export function* recoverLearningReplays(context,saved){
 if(saved?.version!==LEARNING_VERSION||contextKey(saved.context??{})!==contextKey(context))throw new Error('Recovery requires a matching learning version and cave.');
 if(saved.planningRevision)throw new Error('Planned runs require their saved input recordings. Import the replay backup to restore missing runs.');
 const original=new LearningPlayer(context,saved),fresh=new LearningPlayer(context,null,saved.policyRevision??1),records=[];
 if(saved.policyStartAttempt>0)throw new Error('Pre-upgrade input traces cannot be reconstructed by the newer policy. Import their saved replay backup instead.');
 if(original.attempts!==original.results.length||original.attempts>100)throw new Error('Older inputs are unavailable for a complete verified reconstruction. Existing recordings are preserved.');
 const verify=(actual,expected)=>{
  if(actual.route!==expected.route||actual.status!==expected.status||actual.diamonds!==expected.diamonds||actual.ticks!==expected.ticks||actual.score!==expected.score)
   throw new Error('An older attempt could not be reproduced exactly. No unverified replay was saved.');
 };
 if(original.baseline){const run=yield* fresh.attempt({learn:false,fastTrappedTimer:Boolean(original.baseline.fastTrappedTimer)});verify(run,original.baseline);records.push({kind:'baseline',attempt:0,run});}
 for(let n=0;n<original.results.length;n++){
  const expected=original.results[n],run=yield* fresh.attempt({seed:expected.seed,exploration:expected.exploration??.25,fastTrappedTimer:Boolean(expected.fastTrappedTimer)});
  verify(run,expected);records.push({kind:'training',attempt:n+1,run});
 }
 if(original.evaluation){const run=yield* fresh.attempt({learn:false,fastTrappedTimer:Boolean(original.evaluation.fastTrappedTimer)});verify(run,original.evaluation);records.push({kind:'evaluation',attempt:original.attempts,run});}
 return records;
}
