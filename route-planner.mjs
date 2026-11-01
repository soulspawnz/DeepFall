import {Game} from './engine.mjs';
import {ACTIONS,cloneGame} from './simulation.mjs';

const dirs=ACTIONS.slice(0,4);
export const PRIORITY_DEFAULTS=Object.freeze({collection:1,supply:1,distance:1,speed:1,mobility:1,preparation:1,amoeba:1,push:1});
const priorityNames=Object.keys(PRIORITY_DEFAULTS);
export function validPriorityWeights(w){return w&&Object.keys(w).length===priorityNames.length&&priorityNames.every(k=>Number.isFinite(w[k])&&w[k]>=.2&&w[k]<=5);}
export function priorityProfile(w){return stateHash(JSON.stringify(priorityNames.map(k=>w[k])));}
export function validPriorityLearning(s){
 const metric=x=>x&&Number.isFinite(x.fitness)&&Math.abs(x.fitness)<1e6&&validPriorityWeights(x.weights)&&typeof x.profile==='string'&&x.profile===priorityProfile(x.weights);
 return Boolean(s&&s.version===1&&Number.isInteger(s.trials)&&s.trials>0&&s.trials<=1e9&&Number.isInteger(s.lastImprovement)&&s.lastImprovement>=1&&s.lastImprovement<=s.trials&&metric(s.champion)&&Array.isArray(s.recent)&&s.recent.length>0&&s.recent.length<=32&&s.recent.every((r,i)=>metric(r)&&Number.isInteger(r.trial)&&r.trial>0&&r.trial<=s.trials&&(!i||r.trial>s.recent[i-1].trial)));
}
export function choosePlanningPriorities(state,seed=1,learn=true){
 const saved=validPriorityLearning(state)?state:null,weights={...(saved?.champion.weights??PRIORITY_DEFAULTS)},trial=(saved?.trials??0)+1;
 let kind=!learn?'evaluation':!saved?'reference':trial%5===0?'champion':'explore';
 if(kind==='explore'){
  let random=(seed^Math.imul(trial,2654435761))>>>0||1;const rng=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return(random>>>0)/4294967296;};
  const keys=[...priorityNames],radius=Math.min(1,.35+(saved.trials-saved.lastImprovement)*.07);
  for(let n=0;n<2+trial%3;n++){const i=Math.floor(rng()*keys.length),key=keys.splice(i,1)[0];weights[key]=Math.round(Math.max(.2,Math.min(5,weights[key]*Math.exp((rng()<.5?-1:1)*radius*(.75+rng()))))*1000)/1000;}
 }
 return {profile:priorityProfile(weights),kind,weights};
}
export function learnPlanningPriorities(state,choice,fitness){
 if(!validPriorityWeights(choice?.weights)||choice.profile!==priorityProfile(choice.weights)||!Number.isFinite(fitness)||Math.abs(fitness)>=1e6)throw new Error('Invalid planning-priority observation.');
 const saved=validPriorityLearning(state)?state:null,trial=(saved?.trials??0)+1,observation={trial,profile:choice.profile,weights:{...choice.weights},fitness};
 const improved=!saved||fitness>saved.champion.fitness+1e-7;
 return {version:1,trials:trial,lastImprovement:improved?trial:saved.lastImprovement,champion:improved?{profile:choice.profile,weights:{...choice.weights},fitness}:{...saved.champion,weights:{...saved.champion.weights}},recent:[...(saved?.recent??[]),observation].slice(-32)};
}
// An optimistic upper bound, not a reachability claim. Amoebas and magic walls
// can create more diamonds, so do not prune those worlds with this bound.
export function diamondPotential(g){
 let total=g.collected;
 for(const row of g.grid)for(const t of row){if(t==='a'||t==='M')return Infinity;if(t==='*'||t==='d')total++;if(t==='b')total+=9;}
 return total;
}
function stateHash(text){let a=2166136261,b=5381;for(let n=0;n<text.length;n++){a=Math.imul(a^text.charCodeAt(n),16777619);b=Math.imul(b,33)^text.charCodeAt(n);}return (a>>>0).toString(36)+(b>>>0).toString(36);}
// Setup destinations are proposals, never substitutes for physics checks.
export function generationTargets(g){
 const targets=new Map();
 const add=(x,y,kind,value)=>{if(g.tile(x,y)!=='.')return;const key=`${x},${y}`;if((targets.get(key)?.value??0)<value)targets.set(key,{kind,value});};
 for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid[y].length;x++){
  const tile=g.tile(x,y);
  if(tile==='a'&&g.amoeba.dead!=='O')for(const [dx,dy]of dirs)add(x+dx,y+dy,'amoeba-access',1800);
  if(tile!=='M'||g.magic.remaining<=0)continue;
  // Output is one cell below the wall; a blocked outlet consumes the input
  // without producing a diamond. Clear it before encouraging activation.
  add(x,y+1,'magic-outlet',7000);
  let yy=y-1;const dirt=[];
  while(yy>=0&&['.',' '].includes(g.tile(x,yy))){if(g.tile(x,yy)==='.')dirt.push(yy);yy--;}
  if(g.tile(x,yy)==='O')for(const dy of dirt)add(x,dy,'magic-feed',g.tile(x,y+1)===' '?6500:1200);
 }
 return targets;
}
const distanceCache=new Map();
function goalDistances(g){
 const exit=g.collected>=g.target,key=+exit+':'+(g.magic.remaining>0)+':'+g.grid.map(r=>r.join('')).join('');
 const cached=distanceCache.get(key);if(cached!==undefined)return cached;
 const width=g.grid[0].length,height=g.grid.length,d=new Float64Array(width*height).fill(Infinity),queue=[];
 const goal=exit?'X':g.grid.some(r=>r.includes('*'))?'*':'b';
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(g.grid[y][x]===goal){d[y*width+x]=0;queue.push(y*width+x);}
 if(!exit&&!queue.length)for(const cell of generationTargets(g).keys()){const [x,y]=cell.split(',').map(Number);d[y*width+x]=0;queue.push(y*width+x);}
 for(let i=0;i<queue.length;i++){
  const cell=queue[i],x=cell%width,y=Math.floor(cell/width);
  for(const [dx,dy]of dirs){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height)continue;const t=g.grid[yy][xx]??'#',k=yy*width+xx;if(t==='#'||t==='+'||t==='M'||t==='a')continue;const value=d[cell]+(t==='O'?4:1);if(value<d[k]){d[k]=value;queue.push(k);}}
 }
 distanceCache.set(key,d);if(distanceCache.size>256)distanceCache.delete(distanceCache.keys().next().value);return d;
}
export function planningKey(g){
 // Preserve the snapshot key's property order and exact bytes without making
 // a deep world copy. Serialization reads the state synchronously.
 return JSON.stringify({grid:g.grid,player:g.player,collected:g.collected,falling:[...g.falling],facings:[...g.facings],blasts:[...g.blasts],magic:g.magic,amoeba:g.grid.some(r=>r.includes('a'))?g.amoeba:{dead:null,slow:0},randomState:g.randomState,born:g.born,birthRemaining:g.birthRemaining,playerAlive:g.playerAlive});
}
const criticalCache=new WeakMap();
function corridorTargets(g,distances=undefined){
 if(criticalCache.has(g))return criticalCache.get(g);
 distances??=goalDistances(g);const distance=p=>Math.min(100,distances[p.y*g.grid[0].length+p.x]);
 const critical=new Set();let cursor={...g.player};const traced=new Set();
 for(let n=0;n<160;n++){
  const k=`${cursor.x},${cursor.y}`;if(traced.has(k)||distance(cursor)===0)break;traced.add(k);
  if(g.tile(cursor.x,cursor.y)==='O'){
   let y=cursor.y+1;while(g.tile(cursor.x,y)==='O')y++;
   if(g.tile(cursor.x,y)==='.')critical.add(`${cursor.x},${y}`);
   for(const dx of [-1,1])if(g.tile(cursor.x+dx,cursor.y)==='.')critical.add(`${cursor.x+dx},${cursor.y}`);
  }
  const next=dirs.map(([dx,dy])=>({x:cursor.x+dx,y:cursor.y+dy})).filter(p=>!['#','+','M','a'].includes(g.tile(p.x,p.y))&&!traced.has(`${p.x},${p.y}`)).sort((a,b)=>distance(a)-distance(b))[0];
  if(!next||distance(next)>=distance(cursor))break;cursor=next;
 }
 criticalCache.set(g,critical);return critical;
}
function paths(g,w,facts){
 const q=[{...g.player,path:[]}],seen=new Set([`${g.player.x},${g.player.y}`]),goals=[],pushes=[],critical=facts.critical,setups=facts.setups;
 const distances=goalDistances(g),distance=p=>Math.min(100,distances[p.y*g.grid[0].length+p.x]);
 for(let i=0;i<q.length;i++){
  const p=q[i],tile=g.tile(p.x,p.y);
  if(p.path.length){
   const setup=setups.get(`${p.x},${p.y}`);
   const priority=tile==='X'&&g.collected>=g.target?100000:tile==='*'?10000*w.collection:setup?setup.value*w.preparation*(setup.kind==='amoeba-access'?w.amoeba:1):tile==='.'&&critical.has(`${p.x},${p.y}`)?6000*w.preparation:tile==='.'&&['O','*'].includes(g.tile(p.x,p.y-1))?1000*w.preparation:tile==='.'&&distance(p)<7?(700-distance(p)*60)*w.preparation:0;
   const support=tile==='.'&&['O','*'].includes(g.tile(p.x,p.y-1));
   if(priority)goals.push({path:p.path,value:priority-p.path.length*w.speed-(support&&!setup&&!critical.has(`${p.x},${p.y}`)?distance(p)*20*w.distance:0),snap:tile!=='X',setup:setup?.kind,support});
  }
  for(const dx of [-1,1])if(g.tile(p.x+dx,p.y)==='O'&&g.tile(p.x+dx*2,p.y)===' ')
   pushes.push({path:[...p.path,...Array.from({length:8},()=>[dx,0,false])],value:500*w.push-p.path.length*w.speed-distance(p)*20*w.distance});
  for(const [dx,dy]of dirs){
   const x=p.x+dx,y=p.y+dy,k=`${x},${y}`,t=g.tile(x,y);
   if(seen.has(k)||!([' ','.','*'].includes(t)||(t==='X'&&g.collected>=g.target)))continue;
   seen.add(k);q.push({x,y,path:[...p.path,[dx,dy,false]]});
  }
 }
 goals.sort((a,b)=>b.value-a.value);
 return [...goals.slice(0,24).flatMap(g=>{
  const snap=[...g.path.slice(0,-1),[g.path.at(-1)[0],g.path.at(-1)[1],true]];
  const retreat=g.path.slice(0,-1).slice(-4).reverse().map(([dx,dy])=>[-dx,-dy,false]);
  return [...(g.snap?[g.path,snap]:[g.path]),...(g.support||g.setup?[[...snap,...retreat,...Array.from({length:8},()=>[0,0,false])]]:[])];
 }),...pushes.sort((a,b)=>b.value-a.value).slice(0,8).flatMap(p=>[p.path,[...p.path,...Array.from({length:8},()=>[-p.path.at(-1)[0],0,false])]])];
}
function trace(node){const chunks=[];for(let n=node;n;n=n.parent)chunks.push(n.actions);return chunks.reverse().flat();}
function mobility(g){let n=0;for(const [dx,dy]of dirs)if([' ','.','*','X'].includes(g.tile(g.player.x+dx,g.player.y+dy)))n++;return n;}
export function planningPriority(g,length,w=PRIORITY_DEFAULTS,facts=null){
 let available=facts?.available??0;if(!facts)for(const row of g.grid)for(const t of row)if(t==='*'||t==='d')available++;
 const distance=facts?.distance??Math.min(100,goalDistances(g)[g.player.y*g.grid[0].length+g.player.x]);
 let preparation=facts?.preparation??0;
 if(!facts){for(const cell of corridorTargets(g)){const [x,y]=cell.split(',').map(Number);preparation=Math.max(preparation,Math.max(0,3-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*60);}
 for(const [cell,setup]of generationTargets(g)){const [x,y]=cell.split(',').map(Number);preparation=Math.max(preparation,Math.max(0,5-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*(setup.kind==='magic-outlet'?80:50));}}
 const pending=facts?.pending??(g.amoeba.dead==='*'?g.grid.reduce((n,r)=>n+r.filter(t=>t==='a').length,0):0);
 const needed=Math.max(0,g.target-g.collected);
 const pushes=[-1,1].filter(dx=>g.tile(g.player.x+dx,g.player.y)==='O'&&g.tile(g.player.x+2*dx,g.player.y)===' ').length;
 return Math.min(g.collected,g.target)*2000*w.collection+Math.min(available,needed)*300*w.supply+Math.min(pending,needed)*250*w.amoeba-length*2*w.speed+mobility(g)*3*w.mobility-distance*12*w.distance+preparation*w.preparation+(w.push-1)*80*pushes;
}
export function planningOutcomeFitness(g,length){
 const needed=Math.max(0,g.target-g.collected),supply=g.grid.reduce((n,row)=>n+row.filter(t=>t==='*'||t==='d'||(t==='a'&&g.amoeba.dead==='*')).length,0);
 const distance=Math.min(100,goalDistances(g)[g.player.y*g.grid[0].length+g.player.x]);
 return (g.status==='won'?100000:0)+Math.min(g.collected,g.target)/Math.max(1,g.target)*10000+Math.min(supply,needed)/Math.max(1,g.target)*3000-distance*10-length*.05-(g.status==='dead'?2000:0);
}
function scout(context,pass,fixture,fastTrappedTimer){
 const g=new Game(context.index,'classic',fixture,{...context,fastTrappedTimer});g.start();const input=[],visits=new Map(),order=dirs.slice(pass).concat(dirs.slice(0,pass));
 while(g.status==='playing'&&input.length<700){
  let chosen=[0,0,false];
  if(g.born){
   const q=[{...g.player,first:null,distance:0}],seen=new Set([`${g.player.x},${g.player.y}`]);let best=-Infinity;
   for(let n=0;n<q.length;n++){
    const p=q[n],tile=g.tile(p.x,p.y),k=`${p.x},${p.y}`;
    if(p.first){const score=tile==='X'&&g.collected>=g.target?100000-p.distance:tile==='*'?10000-p.distance*10:(tile==='.'?200:10)-p.distance-(visits.get(k)??0)*30;if(score>best){best=score;chosen=p.first;}}
    for(const [dx,dy]of order){
     const x=p.x+dx,y=p.y+dy,k=`${x},${y}`,t=g.tile(x,y),push=t==='O'&&dy===0&&g.tile(x+dx,y)===' '&&!g.falling.has(k);
     if(seen.has(k)||!([' ','.','*'].includes(t)||(t==='X'&&g.collected>=g.target)||push)||g.falling.has(`${x},${y-1}`)||g.falling.has(k)||order.some(([ex,ey])=>['b','f'].includes(g.tile(x+ex,y+ey))))continue;
     seen.add(k);q.push({x,y,first:p.first??[dx,dy,false],distance:p.distance+1});
    }
   }
   const k=`${g.player.x},${g.player.y}`;visits.set(k,(visits.get(k)??0)+1);
  }
  g.step({dx:chosen[0],dy:chosen[1],snap:false});input.push(chosen);
 }
 return input;
}
function escapeRoutes(g,w,getKey,analyze){
 let beam=[{g,path:[]}];const seen=new Set();
 for(let depth=0;depth<8;depth++){
  const next=[];
  for(const node of beam)for(const a of ACTIONS){
   const copy=cloneGame(node.g);copy.step({dx:a[0],dy:a[1],snap:Boolean(a[2])});if(copy.status==='dead')continue;
   const key=getKey(copy);if(seen.has(key))continue;seen.add(key);
   const path=[...node.path,[a[0],a[1],Boolean(a[2])]];
   if(copy.status==='won')return [{g:copy,path}];
   next.push({g:copy,path,value:planningPriority(copy,path.length,w,analyze(copy))});
  }
  next.sort((a,b)=>b.value-a.value);beam=next.slice(0,16);if(!beam.length)break;
 }
 return beam.slice(0,4);
}
// A bounded best-first search over entire alternative routes, not just the
// next greedy move. Every edge is checked by the real game physics.
export function* planRoute(context,{seed=1,maxNodes=1800,maxTicks=1800,prefixes=[],fixture=null,fastTrappedTimer=true,guide=()=>0,visited=[],exploration=.25,weights=PRIORITY_DEFAULTS}={}){
 if(!validPriorityWeights(weights))throw new Error('Invalid planning-priority weights.');
 const namespace='s4:'+priorityProfile(weights)+':';
 // These caches are local to an immutable search graph, never attached to a
 // live Game. Every successor is stepped before it enters the caches.
 const keys=new WeakMap(),worlds=new WeakMap(),emptySetups=new Map();
 function getKey(g){let key=keys.get(g);if(key===undefined){key=planningKey(g);keys.set(g,key);}return key;}
 function world(g){
  let f=worlds.get(g);if(f)return f;
  let available=0,amoeba=0,butterflies=0,magic=false;
  for(const row of g.grid)for(const t of row){if(t==='*'||t==='d')available++;else if(t==='a')amoeba++;else if(t==='b')butterflies++;else if(t==='M')magic=true;}
  f={available,pending:g.amoeba.dead==='*'?amoeba:0,amoeba,magic,potential:amoeba||magic?Infinity:g.collected+available+butterflies*9};worlds.set(g,f);return f;
 }
 function analyze(g){
  const f=world(g);if(f.analyzed)return f;
  const distances=goalDistances(g);f.critical=corridorTargets(g,distances);f.setups=f.amoeba||f.magic?generationTargets(g):emptySetups;
  f.distance=Math.min(100,distances[g.player.y*g.grid[0].length+g.player.x]);f.preparation=0;
  for(const cell of f.critical){const [x,y]=cell.split(',').map(Number);f.preparation=Math.max(f.preparation,Math.max(0,3-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*60);}
  for(const [cell,setup]of f.setups){const [x,y]=cell.split(',').map(Number);f.preparation=Math.max(f.preparation,Math.max(0,5-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*(setup.kind==='magic-outlet'?80:50));}
  f.analyzed=true;return f;
 }
 const start=new Game(context.index,'classic',fixture,{...context,fastTrappedTimer});start.start();
 const birth=[];while(!start.born&&start.status==='playing'){start.step();birth.push([0,0,false]);}
 const root={g:start,parent:null,actions:birth,length:birth.length};root.value=planningPriority(start,root.length,weights,analyze(start));
 const open=[root],seen=new Map([[getKey(start),root.length]]);let best=root,expanded=0;
 const completed=new Map(visited);
 function add(g,parent,actions){
  if(!actions.length||g.status==='dead'||world(g).potential<g.target||(mobility(g)===0&&g.isTrapped()))return;
  const length=(parent?.length??0)+actions.length;if(length>maxTicks)return;
  const node={g,parent,actions,length,value:planningPriority(g,length,weights,analyze(g))};
  if(g.collected>best.g.collected||(g.collected===best.g.collected&&node.value>best.value))best=node;
  const key=getKey(g),prior=seen.get(key);if(prior!==undefined&&prior<=length)return;
  if((completed.get(namespace+stateHash(key))??Infinity)<=length)return;
  seen.set(key,length);open.push(node);
 }
 // Re-simulate saved inputs from birth; a past death is never resumed as alive.
 // Seed checkpoints at collections and at intervals so blocked endings can
 // branch earlier, before the route sealed off the remaining diamonds.
 const seeds=[...prefixes.slice(0,12),...Array.from({length:3},(_,n)=>scout(context,(seed+n)%4,fixture,fastTrappedTimer))];
 for(const prefix of seeds){
  let g=new Game(context.index,'classic',fixture,{...context,fastTrappedTimer});g.start();let chunk=[];
  for(let i=0;i<prefix.length&&i<maxTicks;i++){
   const old=g.collected,a=prefix[i];g.step({dx:a[0],dy:a[1],snap:Boolean(a[2])});chunk.push([a[0],a[1],Boolean(a[2])]);
   if(g.status==='won')return {game:g,input:chunk,expanded,seed,finished:true};
   if(g.status!=='playing')break;
   if(g.born&&(g.collected>old||i%16===0))add(cloneGame(g),null,chunk.map(a=>[...a]));
  }
  if(g.status==='playing'&&g.born)add(g,null,chunk.map(a=>[...a]));
 }
 for(;expanded<maxNodes&&open.length;expanded++){
  open.sort((a,b)=>b.value-a.value||a.length-b.length);
  // Periodic breadth expansion prevents a high-diamond dead end from consuming
  // the entire search before earlier corridor-opening choices are revisited.
  const breadthEvery=exploration>0?Math.round(1/Math.max(.05,Math.min(.8,exploration)))+1:Infinity;
  let pick=0;if(expanded%breadthEvery===breadthEvery-1){let shortest=Infinity;for(let i=0;i<open.length;i++)if(open[i].length<shortest){shortest=open[i].length;pick=i;}}
  const [node]=open.splice(pick,1),g=node.g;
  const fingerprint=namespace+stateHash(getKey(g));if((completed.get(fingerprint)??Infinity)<=node.length)continue;
  completed.set(fingerprint,node.length);
  if(g.status==='won')return {game:g,input:trace(node),expanded,seed,finished:true};
  const routes=paths(g,weights,analyze(g));
  for(const a of ACTIONS)routes.push([[a[0],a[1],Boolean(a[2])]]);
  routes.push(Array.from({length:4},()=>[0,0,false]));
  if(g.grid.some(r=>r.includes('a')))for(const ticks of [8,32])routes.push(Array.from({length:ticks},()=>[0,0,false]));
  // Rotate equal-priority alternatives deterministically between attempts.
  const offset=(seed+expanded)%4;
  const transitions=new Map(),branchChoices=new Map();
  for(const route of routes.slice(offset).concat(routes.slice(0,offset))){
   let next=g,pathKey='';const actual=[],points=[[g.player.x,g.player.y]];
   for(let i=0;i<route.length;i++){
    if(node.length+actual.length>=maxTicks)break;
    const a=route[i],previousCollected=next.collected;pathKey+=`${a[0]+1}${a[1]+1}${+a[2]}`;
    let successor=transitions.get(pathKey);
    if(!successor){successor=cloneGame(next);successor.step({dx:a[0],dy:a[1],snap:a[2]});transitions.set(pathKey,successor);}
    next=successor;actual.push(a);
    const last=points.at(-1);if(points.length<33&&(last[0]!==next.player.x||last[1]!==next.player.y))points.push([next.player.x,next.player.y]);
    if(next.status==='won')return {game:next,input:[...trace(node),...actual],expanded:expanded+1,seed,finished:true};
    if(next.status==='dead')break;
    // Keep escape branches along a corridor instead of only at its end.
    if(i<route.length-1&&(i===route.length-2||next.collected>previousCollected||i%4===3||(i>0&&(route[i-1][0]!==a[0]||route[i-1][1]!==a[1]))))add(next,node,actual.map(a=>[...a]));
   }
   if(points.length>1){const key=JSON.stringify(points);if(!branchChoices.has(key))branchChoices.set(key,{points,dead:next.status==='dead'});}
   const count=open.length;add(next,node,actual);if(open.length>count)open.at(-1).value+=Math.max(-10,Math.min(10,guide(g,route)));
   if(next.status==='playing'&&next.falling.has(`${next.player.x},${next.player.y-1}`)){
    for(const escape of escapeRoutes(next,weights,getKey,analyze)){
     const actions=[...actual,...escape.path];
     if(escape.g.status==='won')return {game:escape.g,input:[...trace(node),...actions],expanded:expanded+1,seed,finished:true};
     add(escape.g,node,actions);
    }
   }
  }
  if(open.length>1800){open.sort((a,b)=>b.value-a.value);const groups=new Map();for(let i=0;i<open.length;i++){const n=open[i],k=`${n.g.collected}:${Math.floor(n.g.player.x/8)}:${Math.floor(n.g.player.y/6)}`;const count=(groups.get(k)??0)+1;groups.set(k,count);if(count>40){open.splice(i,1);i--;}}if(open.length>1800)open.length=1800;}
  if(expanded%8===0){
   const choices=[...branchChoices.values()],first=new Set(),branches=[];
   for(const b of choices){const key=JSON.stringify(b.points[1]);if(!first.has(key)){first.add(key);branches.push(b);}}
   for(const b of choices)if(!branches.includes(b)&&branches.length<12)branches.push(b);
   yield {decision:expanded+1,diamonds:best.g.collected,ticks:best.length,frontier:open.length,searchPosition:[g.player.x,g.player.y],searchDiamonds:g.collected,searchTicks:node.length,previewInput:trace(node),previewBranches:branches.slice(0,12)};
  }
 }
 open.sort((a,b)=>b.value-a.value);const groups=new Map(),candidates=[];
 for(const n of open){const k=`${n.g.collected}:${Math.floor(n.g.player.x/5)}:${Math.floor(n.g.player.y/4)}`,count=groups.get(k)??0;if(count>=3)continue;groups.set(k,count+1);candidates.push(n);if(candidates.length>=64)break;}
 return {game:best.g,input:trace(best),expanded,seed,finished:false,frontier:candidates.map(trace),visited:[...completed].slice(-6000)};
}
