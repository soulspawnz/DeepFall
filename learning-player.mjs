import {Game} from './engine.mjs';
import {ACTIONS,cloneGame} from './simulation.mjs';

export const LEARNING_VERSION='deepfall-experience-2';
const LIMIT=3000;
function validSummary(r){return r&&['won','dead','budget'].includes(r.status)&&Number.isInteger(r.diamonds)&&r.diamonds>=0&&r.diamonds<=10000&&Number.isInteger(r.target)&&r.target>=0&&r.target<=1000&&Number.isInteger(r.ticks)&&r.ticks>0&&r.ticks<=4000&&Number.isFinite(r.score)&&Number.isFinite(r.remaining)&&typeof r.route==='string'&&r.route.length<=32;}
function validInput(input){return Array.isArray(input)&&input.length>0&&input.length<=4000&&input.every(a=>Array.isArray(a)&&a.length===3&&Number.isInteger(a[0])&&Number.isInteger(a[1])&&Math.abs(a[0])+Math.abs(a[1])<=1&&typeof a[2]==='boolean');}
function hash(text) {
 let a=2166136261,b=5381;
 for(let n=0;n<text.length;n++){const c=text.charCodeAt(n);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
 return (a>>>0).toString(36)+(b>>>0).toString(36);
}
export function contextKey(context){return `${context.campaign}:${context.difficulty}:${context.index}`;}
function signature(g) {
 // Remaining time is deliberately excluded: experience transfers across waits.
 const s=g.snapshot();delete s.remaining;delete s.tick;
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
 constructor(context, saved=null) {
  this.context={campaign:context.campaign,index:context.index,difficulty:context.difficulty};
  const valid=saved?.version===LEARNING_VERSION&&contextKey(saved.context??{})===contextKey(this.context);
  this.values=new Map(valid&&Array.isArray(saved.values)?saved.values.slice(-LIMIT).filter(entry=>Array.isArray(entry)&&entry.length===2&&typeof entry[0]==='string'&&entry[0].length<=128&&Number.isFinite(entry[1]?.mean)&&Math.abs(entry[1].mean)<1e7&&Number.isInteger(entry[1]?.n)&&entry[1].n>0&&entry[1].n<=1e9):[]);
  this.attempts=valid&&Number.isInteger(saved.attempts)?Math.min(1e9,Math.max(0,saved.attempts)):0;
  this.results=valid&&Array.isArray(saved.results)?saved.results.slice(-100).filter(validSummary):[];
  this.best=valid&&validSummary(saved.best)&&saved.best.status==='won'&&contextKey(saved.best)===contextKey(this.context)&&validInput(saved.best.input)?saved.best:null;
  this.baseline=valid&&validSummary(saved.baseline)?saved.baseline:null;this.evaluation=valid&&validSummary(saved.evaluation)?saved.evaluation:null;
 }
 export() {return {version:LEARNING_VERSION,context:this.context,attempts:this.attempts,values:[...this.values],results:this.results,best:this.best,baseline:this.baseline,evaluation:this.evaluation};}
 *attempt({seed=this.attempts+1,exploration=.25,learn=true,maxDecisions=120,fixture=null}={}) {
  const game=new Game(this.context.index,'classic',fixture,this.context);game.start();
  const rng=randomGenerator(seed),input=[],history=[],visits=new Map();
  while(!game.born&&game.status==='playing'){game.step();input.push([0,0,false]);}
  let current=game;
  for(let decision=0;decision<maxDecisions&&current.status==='playing';decision++) {
   const state=signature(current),choices=targets(current),scored=[];
   let totalVisits=1;
   for(const choice of choices)totalVisits+=this.values.get(`${state}/${choice.id}`)?.n??0;
   for(const choice of choices) {
    const {next,actions,digs}=roll(current,choice.path),entry=this.values.get(`${state}/${choice.id}`);
    const position=`${next.player.x},${next.player.y}`,stuck=signature(next)===state;
    const immediate=(Math.min(next.collected,next.target)-Math.min(current.collected,current.target))*30+(next.status==='won'?2000:0)-(!canSurvive(next)?4000:0)
      -actions.length*.15+Math.min(digs,8)*.15-(visits.get(position)??0)*3-(stuck?8:0);
    const curiosity=learn?5*Math.sqrt(Math.log(totalVisits+1)/((entry?.n??0)+1)):0;
    // The learned return already includes the eventual outcome; adding the
    // greedy immediate reward again would bias against learned detours.
    scored.push({choice,next,actions,key:`${state}/${choice.id}`,score:(entry?entry.mean:immediate)+curiosity-(visits.get(position)??0)*3});
   }
   scored.sort((a,b)=>b.score-a.score);
   const safe=scored.filter(c=>canSurvive(c.next));
   const pool=safe.length?safe:scored;
   // Exploration can choose a different safe route, rather than random suicide.
   const chosen=learn&&rng()<exploration?pool[Math.floor(rng()*Math.min(5,pool.length))]:pool[0];
   if(!chosen)break;
   history.push(chosen.key);current=chosen.next;input.push(...chosen.actions);
   const position=`${current.player.x},${current.player.y}`;visits.set(position,(visits.get(position)??0)+1);
   yield {decision:decision+1,diamonds:current.collected,ticks:input.length};
  }
  const status=current.status==='playing'?'budget':current.status;
  const result={...this.context,status,diamonds:current.collected,target:current.target,ticks:input.length,
   score:current.score,remaining:current.remaining,reason:current.reason,route:hash(JSON.stringify(input)),seed,exploration:learn?exploration:0,input};
  if(learn) {
   const outcome=(status==='won'?2000:status==='dead'?-400:-200)+Math.min(current.collected,current.target)*10-input.length*.15;
   for(let i=history.length-1;i>=0;i--) {
    const key=history[i],old=this.values.get(key)??{n:0,mean:0};
    const value=outcome-Math.min(100,(history.length-1-i)*.1);
    const n=old.n+1,mean=old.mean+(value-old.mean)/Math.min(n,8);
    this.values.delete(key);this.values.set(key,{n,mean});
   }
   while(this.values.size>LIMIT)this.values.delete(this.values.keys().next().value);
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
 const original=new LearningPlayer(context,saved),fresh=new LearningPlayer(context),records=[];
 if(original.attempts!==original.results.length||original.attempts>100)throw new Error('Older inputs are unavailable for a complete verified reconstruction. Existing recordings are preserved.');
 const verify=(actual,expected)=>{
  if(actual.route!==expected.route||actual.status!==expected.status||actual.diamonds!==expected.diamonds||actual.ticks!==expected.ticks||actual.score!==expected.score)
   throw new Error('An older attempt could not be reproduced exactly. No unverified replay was saved.');
 };
 if(original.baseline){const run=yield* fresh.attempt({learn:false});verify(run,original.baseline);records.push({kind:'baseline',attempt:0,run});}
 for(let n=0;n<original.results.length;n++){
  const expected=original.results[n],run=yield* fresh.attempt({seed:expected.seed,exploration:expected.exploration??.25});
  verify(run,expected);records.push({kind:'training',attempt:n+1,run});
 }
 if(original.evaluation){const run=yield* fresh.attempt({learn:false});verify(run,original.evaluation);records.push({kind:'evaluation',attempt:original.attempts,run});}
 return records;
}
