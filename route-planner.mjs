import {Game,STEP} from './engine.mjs';
import {ACTIONS,cloneGame} from './simulation.mjs';
const amoebaDirs=ACTIONS.slice(0,4),cell=(x,y)=>`${x},${y}`;
const loose=g=>g.grid.reduce((n,r)=>n+r.filter(t=>t==='*'||t==='d').length,0);
const barrier=(g,x,y)=>['#','+','M','X','O','*'].includes(g.tile(x,y))&&!g.falling.has(cell(x,y));

// Dirt and the occupied player cell remain potential growth space. Moving
// enemies and falling objects must not be mistaken for durable enclosure.
export function amoebaState(g){
 const cells=[];g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a')cells.push([x,y]);}));
 const required=Math.max(0,g.target-g.collected-loose(g)),frontier=new Map();
 for(const [x,y]of cells)for(const [dx,dy]of amoebaDirs){const xx=x+dx,yy=y+dy;if(['.',' '].includes(g.tile(xx,yy)))frontier.set(cell(xx,yy),[xx,yy]);}
 const region=new Set(cells.map(([x,y])=>cell(x,y))),queue=[...cells],limit=g.amoeba.max+1;
 for(let n=0;n<queue.length&&region.size<limit;n++)for(const [dx,dy]of amoebaDirs){const x=queue[n][0]+dx,y=queue[n][1]+dy,k=cell(x,y);if(region.has(k)||barrier(g,x,y))continue;region.add(k);queue.push([x,y]);if(region.size>=limit)break;}
 const phase=g.amoeba.dead==='O'?'rocks':g.amoeba.dead==='*'?'diamonds':!cells.length?'none':region.size<=g.amoeba.max?'bounded':'growing';
 const distance=cells.length?Math.min(...cells.map(([x,y])=>Math.abs(x-g.player.x)+Math.abs(y-g.player.y))):100;
 return {phase,size:cells.length,required,frontier:[...frontier.values()],capacity:region.size,region,distance,outside:!region.has(cell(g.player.x,g.player.y)),viable:phase==='bounded'&&region.size>=required};
}

export function amoebaSummary(g){const s=amoebaState(g);return {phase:s.phase,size:s.size,capacity:s.capacity,openings:s.frontier.length,required:s.required,outside:s.outside};}
export function validAmoebaSummary(s){return Boolean(s&&['none','growing','bounded','diamonds','rocks'].includes(s.phase)&&['size','capacity','openings','required'].every(k=>Number.isInteger(s[k])&&s[k]>=0&&s[k]<=10000)&&typeof s.outside==='boolean');}

function providers(g,holes){
 const result=[];
 for(const [x,y]of holes){
  const dirt=[];for(let yy=y;yy>=Math.max(1,y-7);yy--){const t=g.tile(x,yy);if(t==='.')dirt.push([x,yy]);else if(t==='O'){const goal=dirt[0]??[[x+1,y],[x-1,y]].find(p=>[' ','.'].includes(g.tile(...p)));if(goal)result.push({goal,hole:[x,y],cost:dirt.length+(y-yy)*.2,kind:dirt.length?'amoeba-cap':'amoeba-settle'});break;}else if(t!==' ')break;}
  for(const dx of [-1,1])for(let n=1;n<=4;n++){
   const xx=x+dx*n,t=g.tile(xx,y);if(t==='O'){
    const next=g.tile(xx-dx,y),goal=next==='.'?[xx-dx,y]:[xx+dx,y];
    if([' ','.'].includes(g.tile(...goal)))result.push({goal,hole:[x,y],cost:n*2,kind:next==='.'?'amoeba-clear':'amoeba-push',action:next===' '?[-dx,0,false]:null});break;
   }if(![' ','.'].includes(t))break;
  }
 }
 return result;
}

// A rectangle is a proposed fence, not an assumed wall. Its holes still need
// real rock placement, settling, sufficient yield, and a verified retreat.
export function amoebaFence(g,state=amoebaState(g)){
 if(!state.size||g.amoeba.dead)return null;
 const cells=[];g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a')cells.push([x,y]);}));
 const xs=cells.map(p=>p[0]),ys=cells.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),tried=new Set();let best=null;
 for(let left=0;left<=3;left++)for(let right=0;right<=3;right++)for(let top=0;top<=3;top++)for(let bottom=0;bottom<=2;bottom++){
  const x0=Math.max(0,minX-left-1),x1=Math.min(g.grid[0].length-1,maxX+right+1),y0=Math.max(0,minY-top-1),y1=Math.min(g.grid.length-1,maxY+bottom+1),ring=[];
  const bounds=[x0,x1,y0,y1].join(',');if(tried.has(bounds))continue;tried.add(bounds);
  for(let x=x0+1;x<x1;x++){ring.push([x,y0]);if(y1!==y0)ring.push([x,y1]);}for(let y=y0+1;y<y1;y++){ring.push([x0,y]);if(x1!==x0)ring.push([x1,y]);}
  let yieldSize=0;for(let y=y0+1;y<y1;y++)for(let x=x0+1;x<x1;x++)if(!barrier(g,x,y))yieldSize++;
  if(yieldSize<state.required||yieldSize>g.amoeba.max)continue;
  const holes=ring.filter(([x,y])=>!barrier(g,x,y)),feeds=providers(g,holes),cost=holes.reduce((n,p)=>n+Math.min(20,...feeds.filter(f=>f.hole[0]===p[0]&&f.hole[1]===p[1]).map(f=>f.cost)),0)+yieldSize*.03;
  if(!best||cost<best.cost)best={x0,x1,y0,y1,ring,holes,yieldSize,cost};
 }
 return best;
}

export function amoebaTargets(g,fence=amoebaFence(g)){
 const targets=new Map();if(!fence)return targets;
 for(const p of providers(g,fence.holes)){
  const k=cell(...p.goal),old=targets.get(k);if(!old||p.cost<old.cost)targets.set(k,{...p,value:6500-p.cost*100});
 }
 return targets;
}

// Vertex cuts follow existing rock boundaries instead of requiring a rectangle.
// Feed costs only propose a cut; shared rocks and gravity are resolved by play.
export function amoebaCutFence(g){
 const s=amoebaState(g);if(!s.size||g.amoeba.dead)return null;
 const nodes=[],colony=[];g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a')colony.push([x,y]);if(!barrier(g,x,y))nodes.push([x,y]);}));
 const indices=new Map(nodes.map((p,i)=>[cell(...p),i])),costs=new Map();
 for(const p of providers(g,nodes)){const k=cell(...p.hole);costs.set(k,Math.min(costs.get(k)??60,1+p.cost));}
 const distance=nodes.map(([x,y])=>Math.min(...colony.map(([xx,yy])=>Math.abs(x-xx)+Math.abs(y-yy))));let best=null;
 for(const inner of [0,1,2,3])for(const outer of [4,6,8,10]){
  if(outer<=inner+1)continue;const N=nodes.length*2+2,S=N-2,T=N-1,adj=Array.from({length:N},()=>[]),INF=1e6;
  const edge=(u,v,c)=>{const a={v,c,r:adj[v].length},b={v:u,c:0,r:adj[u].length};adj[u].push(a);adj[v].push(b);};
  nodes.forEach(([x,y],i)=>{edge(i*2,i*2+1,distance[i]<=inner?INF:costs.get(cell(x,y))??60);if(distance[i]<=inner)edge(S,i*2,INF);if(distance[i]>=outer)edge(i*2+1,T,INF);for(const[dx,dy]of amoebaDirs){const j=indices.get(cell(x+dx,y+dy));if(j!==undefined)edge(i*2+1,j*2,INF);}});
  let flow=0;
  for(;;){const level=Array(N).fill(-1),q=[S];level[S]=0;for(let n=0;n<q.length;n++)for(const e of adj[q[n]])if(e.c>1e-8&&level[e.v]<0){level[e.v]=level[q[n]]+1;q.push(e.v);}if(level[T]<0)break;const it=Array(N).fill(0);
   function dfs(u,f){if(u===T)return f;for(;it[u]<adj[u].length;it[u]++){const e=adj[u][it[u]];if(e.c>1e-8&&level[e.v]===level[u]+1){const z=dfs(e.v,Math.min(f,e.c));if(z){e.c-=z;adj[e.v][e.r].c+=z;return z;}}}return 0;}
   for(let f;(f=dfs(S,INF))>0;)flow+=f;
  }
  const seen=new Set([S]),q=[S];for(let n=0;n<q.length;n++)for(const e of adj[q[n]])if(e.c>1e-8&&!seen.has(e.v)){seen.add(e.v);q.push(e.v);}
  const holes=nodes.filter((p,i)=>seen.has(i*2)&&!seen.has(i*2+1)),region=new Set(nodes.filter((p,i)=>seen.has(i*2+1)).map(p=>cell(...p)));
  if(region.size<s.required||region.size>g.amoeba.max||!holes.length||holes.length>12||flow>=120)continue;
  const ring=new Map(holes.map(p=>[cell(...p),p]));for(const k of region){const[x,y]=k.split(',').map(Number);for(const[dx,dy]of amoebaDirs)if(!region.has(cell(x+dx,y+dy)))ring.set(cell(x+dx,y+dy),[x+dx,y+dy]);}
  const points=[...ring.values()],cost=flow+region.size*.001;
  if(!best||cost<best.cost)best={ring:points,holes,region,yieldSize:region.size,cost,x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))};
 }
 return best;
}

const insideFence=(f,x,y)=>f.region?f.region.has(cell(x,y)):x>f.x0&&x<f.x1&&y>f.y0&&y<f.y1;

export function amoebaFenceScore(g,fence){
 if(!fence||g.amoeba.dead)return -100000;
 let outside=0;g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a'&&!insideFence(fence,x,y))outside++;}));
 const holes=fence.ring.filter(([x,y])=>!barrier(g,x,y)),sealed=fence.holes.length-holes.length,feeds=providers(g,holes);
 const approach=Math.min(80,...feeds.map(p=>Math.abs(p.goal[0]-g.player.x)+Math.abs(p.goal[1]-g.player.y)+p.cost));
 return sealed*1600-outside*3000-approach*25;
}

export function amoebaApproach(start,{limit=180}={}){
 let g=cloneGame(start);const input=[],visits=new Map();
 for(let n=0;n<limit&&g.status==='playing';n++){
  const state=amoebaState(g);if(!state.size||g.amoeba.dead)break;
  const falling=g.falling.has(cell(g.player.x,g.player.y-1))||g.falling.has(cell(g.player.x,g.player.y-2));
  if(state.distance<=4&&!falling&&exitReachable(g))return {game:g,input};
  const colony=[];g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a')colony.push([x,y]);}));
  const q=[{...g.player,first:null,length:0}],seen=new Set([cell(g.player.x,g.player.y)]),choices=new Map();
  for(let i=0;i<q.length;i++){
   const p=q[i];if(p.first){const d=Math.min(...colony.map(([x,y])=>Math.abs(x-p.x)+Math.abs(y-p.y))),value=Math.max(0,d-3)*20+p.length+(visits.get(cell(p.x,p.y))??0)*8,key=p.first.join(',');if(!choices.has(key)||value<choices.get(key).value)choices.set(key,{a:p.first,value});}
   for(const[dx,dy]of amoebaDirs){const x=p.x+dx,y=p.y+dy,k=cell(x,y);if(seen.has(k)||![' ','.','*'].includes(g.tile(x,y))||g.falling.has(cell(x,y-1))||amoebaDirs.some(([ex,ey])=>['b','f'].includes(g.tile(x+ex,y+ey))))continue;seen.add(k);q.push({x,y,first:p.first??[dx,dy,false],length:p.length+1});}
  }
  let next=null;for(const c of [...choices.values()].sort((a,b)=>a.value-b.value)){const copy=cloneGame(g);copy.step({dx:c.a[0],dy:c.a[1],snap:false});if(copy.status!=='dead'){next=copy;input.push(c.a);break;}}
  if(!next)break;g=next;const k=cell(g.player.x,g.player.y);visits.set(k,(visits.get(k)??0)+1);
 }
 return {game:g,input};
}

function exitReachable(g){
 const q=[[g.player.x,g.player.y]],seen=new Set(q.map(p=>cell(...p)));
 for(let i=0;i<q.length;i++){const[x,y]=q[i];if(g.tile(x,y)==='X')return true;for(const[dx,dy]of amoebaDirs){const xx=x+dx,yy=y+dy,k=cell(xx,yy);if(!seen.has(k)&&[' ','.','*','X'].includes(g.tile(xx,yy))){seen.add(k);q.push([xx,yy]);}}}return false;
}

function shaftThreat(g){
 for(const k of g.falling){const[x,y]=k.split(',').map(Number);if(y<g.player.y&&(x===g.player.x||Math.abs(x-g.player.x)===1&&g.player.y-y<=3))return true;}return false;
}

// A finite physics forecast, not a promise of permanent safety. Waiting is
// included in the returned inputs, so growth and delayed falls cannot be skipped.
export function amoebaEscape(start,{depth=12,width=12,hold=4}={}){
 if(!Number.isInteger(depth)||depth<0||depth>24||!Number.isInteger(width)||width<1||width>32||!Number.isInteger(hold)||hold<0||hold>16)throw new Error('Invalid amoeba escape bounds.');
 let simulated=0,beam=[{g:start,input:[]}];const seen=new Set();
 for(let n=0;n<=depth&&beam.length;n++){
  const choices=[];
  for(const node of beam){
   const s=amoebaState(node.g),outside=s.phase==='bounded'?s.outside:s.distance>=4;
   if(outside||s.phase==='diamonds'||node.g.status==='won'){
    const g=cloneGame(node.g),input=[...node.input];for(let t=0;t<hold&&g.status==='playing';t++){g.step();input.push([0,0,false]);simulated++;}
    const after=amoebaState(g),remainsOutside=s.phase!=='bounded'||after.phase==='diamonds'||after.viable&&after.outside;
    if(g.status!=='dead'&&remainsOutside&&!shaftThreat(g)&&exitReachable(g))return {game:g,input,simulated};
   }
   if(n===depth)continue;
   for(const a of ACTIONS){const g=cloneGame(node.g);g.step({dx:a[0],dy:a[1],snap:Boolean(a[2])});simulated++;if(g.status==='dead')continue;const key=JSON.stringify(g.snapshot());if(seen.has(key))continue;seen.add(key);const s=amoebaState(g);choices.push({g,input:[...node.input,[a[0],a[1],Boolean(a[2])]],value:(s.outside?1000:0)+s.distance*20-g.falling.size});}
  }
  choices.sort((a,b)=>b.value-a.value);const positions=new Set();beam=choices.filter(c=>{const k=cell(c.g.player.x,c.g.player.y);if(positions.has(k))return false;positions.add(k);return true;}).slice(0,width);
 }
 return {simulated};
}

export function amoebaContainPlan(start,{depth=96,width=48,maxInputs=300}={}){
 if(!Number.isInteger(depth)||depth<1||depth>128||!Number.isInteger(width)||width<1||width>64||!Number.isInteger(maxInputs)||maxInputs<1||maxInputs>4000)throw new Error('Invalid amoeba containment bounds.');
 const initial=amoebaState(start),fence=amoebaFence(start,initial);let simulated=0,checks=0,best=null;
 if(!fence)return {simulated,partials:[]};
 let beam=[{g:start,input:[]}];const seen=new Set();
 for(let n=0;n<Math.min(depth,maxInputs)&&beam.length;n++){
  const choices=[];
  for(const node of beam)for(const a of ACTIONS){
   const g=cloneGame(node.g);g.step({dx:a[0],dy:a[1],snap:Boolean(a[2])});simulated++;if(g.status==='dead'||g.amoeba.dead==='O')continue;
   const input=[...node.input,[a[0],a[1],Boolean(a[2])]],s=amoebaState(g),key=JSON.stringify(g.snapshot());if(seen.has(key))continue;seen.add(key);if(seen.size>8000)seen.delete(seen.values().next().value);
   if(checks<4&&(s.viable&&s.outside||s.phase==='diamonds'&&g.collected+loose(g)+s.size>=g.target)){
    checks++;const retreat=amoebaEscape(g,{depth:Math.min(12,Math.max(0,maxInputs-input.length-4)),hold:Math.min(4,maxInputs-input.length)});simulated+=retreat.simulated;
    if(retreat.game){
     const end=retreat.game,path=[...input,...retreat.input];
     for(let t=0;t<128&&path.length<maxInputs&&end.status==='playing'&&!end.amoeba.dead;t++){const state=amoebaState(end);if(!state.viable||!state.outside)break;end.step();path.push([0,0,false]);simulated++;}
     const state=amoebaState(end);if(end.status!=='dead'&&(state.phase==='diamonds'&&end.collected+loose(end)+state.size>=end.target||state.viable&&state.outside))return {game:end,input:path,simulated,phase:state.phase,partials:[]};
    }
   }
   let outside=0;g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a'&&(x<=fence.x0||x>=fence.x1||y<=fence.y0||y>=fence.y1))outside++;}));
   const holes=fence.ring.filter(([x,y])=>!barrier(g,x,y)),sealed=fence.holes.length-holes.length,feeds=providers(g,holes);
   const approach=Math.min(80,...feeds.map(p=>Math.abs(p.goal[0]-g.player.x)+Math.abs(p.goal[1]-g.player.y)+p.cost));
   const value=sealed*1600-outside*3000-approach*25-input.length+(s.viable?3000:0);
   const candidate={g,input,value,group:`${g.player.x},${g.player.y}:${sealed}:${outside}`};choices.push(candidate);
   if(sealed>0&&!outside&&(!best||value>best.value))best=candidate;
  }
  choices.sort((a,b)=>b.value-a.value);const groups=new Set();beam=choices.filter(c=>{if(groups.has(c.group))return false;groups.add(c.group);return true;}).slice(0,width);
 }
 return {simulated,partials:best?[{game:best.g,input:best.input}]:[]};
}

function capRoutes(g,fence){
 const targets=amoebaTargets(g,{holes:fence.ring.filter(p=>!barrier(g,...p))}),q=[{...g.player,input:[]}],seen=new Set([cell(g.player.x,g.player.y)]),routes=[];
 for(let i=0;i<q.length;i++){
  const p=q[i],target=targets.get(cell(p.x,p.y));
  if(target){const input=p.input,snap=input.length?[...input.slice(0,-1),[input.at(-1)[0],input.at(-1)[1],true]]:[];
   for(const a of [input,snap])if(a.length){routes.push(a);routes.push([...a,...input.slice(-4).reverse().map(([dx,dy])=>[-dx,-dy,false]),...Array.from({length:8},()=>[0,0,false])]);}
   if(target.action)for(const n of [1,4,8])routes.push([...input,...Array.from({length:n},()=>target.action)]);
  }
  if(p.input.length>=32)continue;
  for(const[dx,dy]of amoebaDirs){const x=p.x+dx,y=p.y+dy,k=cell(x,y);if(seen.has(k)||![' ','.','*'].includes(g.tile(x,y)))continue;seen.add(k);q.push({x,y,input:[...p.input,[dx,dy,false]]});}
 }
 for(const a of ACTIONS)routes.push([[a[0],a[1],Boolean(a[2])]]);
 for(const n of [4,16,64])routes.push(Array.from({length:n},()=>[0,0,false]));return routes;
}

function harvestRoutes(g){
 const q=[{...g.player,input:[]}],seen=new Set([cell(g.player.x,g.player.y)]),paths=[],pushes=[];let gems=0,near=100,exit=100;
 for(let i=0;i<q.length;i++){
  const p=q[i],t=g.tile(p.x,p.y);
  if(t==='*'){gems++;near=Math.min(near,p.input.length);if(p.input.length)paths.push(p.input);}
  if(t==='X'){exit=p.input.length;if(g.collected>=g.target)paths.unshift(p.input);}
  if(p.input.length>40)continue;
  for(const[dx,dy]of amoebaDirs){const x=p.x+dx,y=p.y+dy,k=cell(x,y);
   if(!dy&&g.tile(x,y)==='O'&&g.tile(x+dx,y)===' ')for(const n of [1,4,8,16,32])pushes.push([...p.input,...Array.from({length:n},()=>[dx,0,false])]);
   if(seen.has(k)||![' ','.','*','X'].includes(g.tile(x,y)))continue;seen.add(k);q.push({x,y,input:[...p.input,[dx,dy,false]]});
  }
 }
 if(near===100)g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='*')near=Math.min(near,Math.abs(x-g.player.x)+Math.abs(y-g.player.y));}));
 return {routes:[...paths.slice(0,16),...pushes.slice(0,48),...ACTIONS.map(a=>[[a[0],a[1],Boolean(a[2])]])],gems,near,exit};
}

// Coarse duplicate pruning is a search heuristic, never a claim of equivalent
// RNG states or a substitute for replaying every accepted input.
const sequenceKey=g=>JSON.stringify([g.grid,g.player,[...g.falling],[...g.facings],Math.floor(g.remaining/8)]);
const sequenceScore=(g,length)=>{const f=harvestRoutes(g);return g.status==='won'?1e9:Math.min(g.target,g.collected+f.gems)*3000+g.collected*1000-(g.collected>=g.target?f.exit:f.near)*20-length*.2;};

export function* amoebaHarvestSearch(start,{maxInputs=1200,layers=24,width=96,maxSimulated=400000}={}){
 if(!Number.isInteger(maxInputs)||maxInputs<1||maxInputs>4000||!Number.isInteger(layers)||layers<1||layers>40||!Number.isInteger(width)||width<1||width>128||!Number.isInteger(maxSimulated)||maxSimulated<1||maxSimulated>600000)throw new Error('Invalid amoeba harvest bounds.');
 let beam=[{g:start,input:[],value:sequenceScore(start,0)}],best=beam[0],simulated=0;const seen=new Set();
 for(let layer=0;layer<layers&&beam.length&&simulated<maxSimulated;layer++){
  const all=[];
  for(const node of beam)for(const path of harvestRoutes(node.g).routes){
   if(node.input.length+path.length>maxInputs||simulated+path.length>maxSimulated)continue;
   const g=cloneGame(node.g),input=[...node.input];for(const[dx,dy,snap]of path){g.step({dx,dy,snap});input.push([dx,dy,snap]);simulated++;if(g.status!=='playing')break;}
   if(g.status==='dead')continue;if(g.status==='won')return {game:g,input,simulated,phase:'escaped'};
   const k=sequenceKey(g);if(seen.has(k))continue;seen.add(k);if(seen.size>20000)seen.delete(seen.values().next().value);
   const c={g,input,value:sequenceScore(g,input.length)};all.push(c);if(c.value>best.value)best=c;
  }
  all.sort((a,b)=>b.value-a.value);beam=all.slice(0,width);
  yield {game:best.g,input:best.input,stage:'harvest',layer:layer+1,simulated};
 }
 return {game:best.g,input:best.input,simulated,phase:'harvest',partials:[]};
}

export function* amoebaContainSearch(start,{fence=amoebaCutFence(start),maxInputs=1600,layers=24,width=96,maxSimulated=260000}={}){
 if(!Number.isInteger(maxInputs)||maxInputs<1||maxInputs>4000||!Number.isInteger(layers)||layers<1||layers>40||!Number.isInteger(width)||width<1||width>128||!Number.isInteger(maxSimulated)||maxSimulated<1||maxSimulated>600000)throw new Error('Invalid amoeba sequence bounds.');
 if(!fence)return {simulated:0,partials:[]};
 const holes=g=>fence.ring.filter(p=>!barrier(g,...p)),score=(g,input)=>{
  const h=holes(g),s=amoebaState(g),targets=amoebaTargets(g,{holes:h});let outside=0;
  g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='a'&&!insideFence(fence,x,y))outside++;}));
  return (fence.holes.length-h.length)*2000-outside*4000+(s.viable?30000:0)-Math.min(80,...[...targets.values()].map(t=>Math.abs(t.goal[0]-g.player.x)+Math.abs(t.goal[1]-g.player.y)+t.cost))*20-input.length*.5;
 };
 let beam=[{g:start,input:[]}],best=beam[0],simulated=0,checks=0;const seen=new Set();
 for(let layer=0;layer<layers&&beam.length&&simulated<maxSimulated;layer++){
  const all=[];
  for(const node of beam)for(const path of capRoutes(node.g,fence)){
   if(node.input.length+path.length>Math.min(800,maxInputs)||simulated+path.length>maxSimulated)continue;
   const g=cloneGame(node.g),input=[...node.input];for(const[dx,dy,snap]of path){g.step({dx,dy,snap});input.push([dx,dy,snap]);simulated++;if(g.status!=='playing')break;}
   if(g.status==='dead'||g.amoeba.dead==='O')continue;
   const s=amoebaState(g);
   if(checks<8&&(s.viable||s.phase==='diamonds')&&input.length+28<=maxInputs){
    checks++;const retreat=amoebaEscape(g,{depth:24,width:32,hold:4});simulated+=retreat.simulated;
    if(retreat.game){
     const end=retreat.game,steps=[...input,...retreat.input],bound=Math.min(maxInputs-steps.length,Math.max(0,Math.floor((end.remaining-10)/STEP)));
     yield {game:end,input:steps,stage:'contained',layer:layer+1,simulated};
     for(let t=0;t<bound&&end.status==='playing'&&!end.amoeba.dead;t++){
      const state=amoebaState(end);if(!state.viable||!state.outside||shaftThreat(end))break;
      end.step();steps.push([0,0,false]);simulated++;
      if(t%64===63)yield {game:end,input:[...steps],stage:'conversion',layer:layer+1,simulated};
     }
     if(end.status==='playing'&&end.amoeba.dead==='*'){
      for(let n=0;n<2&&steps.length<maxInputs;n++){end.step();steps.push([0,0,false]);simulated++;}
      if(end.status!=='dead')return {game:end,input:steps,simulated,phase:'diamonds',partials:[]};
     }
    }
   }
   const k=sequenceKey(g);if(seen.has(k))continue;seen.add(k);if(seen.size>20000)seen.delete(seen.values().next().value);
   const c={g,input,value:score(g,input)};all.push(c);if(best.value===undefined||c.value>best.value)best=c;
  }
  all.sort((a,b)=>b.value-a.value);const groups=new Map();beam=all.filter(n=>{const k=holes(n.g).map(p=>cell(...p)).join(';')+':'+cell(n.g.player.x,n.g.player.y),count=groups.get(k)??0;groups.set(k,count+1);return count<2;}).slice(0,width);
  yield {game:best.g,input:best.input,stage:'caps',layer:layer+1,simulated};
 }
 return {simulated,partials:best.input.length?[{game:best.g,input:best.input}]:[]};
}

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
  if(tile==='a'&&!g.amoeba.dead)for(const [dx,dy]of dirs)add(x+dx,y+dy,'amoeba-access',360);
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
// A butterfly is future supply, not a collectable destination. Propose dirt
// supports that can release a rock near it, then validate the whole setup and
// retreat with real physics. Never count a proposal as a generated diamond.
export function butterflyTargets(g){
 const enemies=[];g.grid.forEach((row,y)=>row.forEach((tile,x)=>{if(tile==='b')enemies.push([x,y]);}));
 const targets=new Map();if(!enemies.length||g.collected>=g.target)return targets;
 for(let y=1;y<g.grid.length-1;y++)for(let x=1;x<g.grid[y].length-1;x++){
  if(g.tile(x,y)!=='O')continue;
  const enemy=enemies.filter(([ex,ey])=>ey>y&&ey-y<=10&&Math.abs(ex-x)<=10).sort((a,b)=>Math.abs(a[0]-x)+a[1]-y-Math.abs(b[0]-x)-b[1]+y)[0];if(!enemy)continue;
  const shaft=[];let blocked=false;for(let yy=y+1;yy<=enemy[1];yy++){const t=g.tile(x,yy);if(!['.',' ','b'].includes(t)){blocked=true;break;}if(t==='.')shaft.push([x,yy]);}
  if(blocked||!shaft.length)continue;
  for(const [xx,yy]of shaft){const cell=`${xx},${yy}`,value=8000-Math.abs(enemy[0]-x)*200+(yy-y)*100;if((targets.get(cell)?.value??0)<value)targets.set(cell,{kind:'butterfly-release',value,rock:[x,y],shaft});}
 }
 return targets;
}
// Estimate the next useful setup, including horizontal relocation. Butterfly
// proximity alone is not a lure: an unobstructed enemy can circle indefinitely.
export function butterflyReadiness(g){
 const enemies=[];g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='b')enemies.push([x,y]);}));
 let best={value:0,distance:100};
 if(!enemies.length)return best;
 for(let y=1;y<g.grid.length-1;y++)for(let x=1;x<g.grid[y].length-1;x++){
  if(g.grid[y][x]!=='O')continue;
  for(const [ex,ey]of enemies){
   if(ey<=y||ey-y>10||Math.abs(ex-x)>10)continue;
   let dx=0,dirt=0,destination=null;
   if(x!==ex){dx=Math.sign(ex-x);destination=g.tile(x+dx,y)==='.'?[x+dx,y]:[x-dx,y];}
   else for(let yy=y+1;yy<ey;yy++){const tile=g.tile(x,yy);if(tile==='.') {dirt++;destination=[x,yy];}else if(tile!==' ') {dirt+=10;break;}}
   destination??=[x+1,y];
   const distance=Math.abs(g.player.x-destination[0])+Math.abs(g.player.y-destination[1]);
   const value=Math.max(0,6000-Math.abs(ex-x)*700-(ey-y)*120-dirt*120-distance*20);
   if(value>best.value)best={value,distance,rock:[x,y]};
  }
 }
 return best;
}
// Bounded event search: compare a complete push/drop/escape sequence with
// collection branches, rather than requiring every setup step to earn gems.
export function butterflyTrapPlan(start,{depth=64,width=64}={}){
 if(!Number.isInteger(depth)||depth<1||depth>128||!Number.isInteger(width)||width<1||width>96)throw new Error('Invalid butterfly search bounds.');
 let simulated=0;const supply=g=>g.grid.reduce((n,row)=>n+row.filter(t=>t==='*'||t==='d').length,0),initialSupply=supply(start);
 if(initialSupply>=start.target-start.collected||!start.grid.some(r=>r.includes('b')))return {simulated};
 let beam=[{g:start,input:[]}];const seen=new Set();
 for(let n=0;n<depth&&beam.length;n++){
  const choices=[];
  for(const node of beam)for(const action of ACTIONS){
   const g=cloneGame(node.g);g.step({dx:action[0],dy:action[1],snap:Boolean(action[2])});simulated++;
   if(g.status==='dead'||diamondPotential(g)<g.target)continue;
   const input=[...node.input,[action[0],action[1],Boolean(action[2])]],available=supply(g);
   if(g.status==='won'||g.collected>start.collected||g.collected+available>start.collected+initialSupply)return {game:g,input,simulated};
   const key=planningKey(g);if(seen.has(key))continue;seen.add(key);if(seen.size>12000)seen.delete(seen.values().next().value);
   const readiness=butterflyReadiness(g);
   choices.push({g,input,value:readiness.value-input.length,group:`${g.player.x},${g.player.y}:${readiness.rock}:${[...g.facings.keys()].join(';')}`});
  }
  choices.sort((a,b)=>b.value-a.value);const groups=new Set();beam=[];
  for(const c of choices){if(groups.has(c.group))continue;groups.add(c.group);beam.push(c);if(beam.length>=width)break;}
 }
 return {simulated};
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
 const q=[{...g.player,path:[]}],seen=new Set([`${g.player.x},${g.player.y}`]),goals=[],pushes=[],critical=facts.critical,setups=new Map(facts.setups);
 if(facts.amoeba&&!g.amoeba.dead)for(const [key,setup]of amoebaTargets(g))setups.set(key,setup);
 const distances=goalDistances(g),distance=p=>Math.min(100,distances[p.y*g.grid[0].length+p.x]);
 for(let i=0;i<q.length;i++){
  const p=q[i],tile=g.tile(p.x,p.y);
  if(p.path.length){
   const setup=setups.get(`${p.x},${p.y}`);
   const priority=tile==='X'&&g.collected>=g.target?100000:tile==='*'?10000*w.collection:setup?setup.value*w.preparation*(setup.kind==='amoeba-access'?w.amoeba:1):tile==='.'&&critical.has(`${p.x},${p.y}`)?6000*w.preparation:tile==='.'&&['O','*'].includes(g.tile(p.x,p.y-1))?1000*w.preparation:tile==='.'&&distance(p)<7?(700-distance(p)*60)*w.preparation:0;
   const support=tile==='.'&&['O','*'].includes(g.tile(p.x,p.y-1));
   if(priority)goals.push({path:p.path,value:priority-p.path.length*w.speed-(support&&!setup&&!critical.has(`${p.x},${p.y}`)?distance(p)*20*w.distance:0),snap:tile!=='X',setup:setup?.kind,action:setup?.action,support});
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
  const options=[...(g.snap?[g.path,snap]:[g.path]),...(g.support||g.setup?[[...snap,...retreat,...Array.from({length:8},()=>[0,0,false])]]:[]),...(g.setup==='butterfly-release'?[2,16].map(wait=>[...snap,...retreat,...Array.from({length:wait},()=>[0,0,false])]):[]),...(g.action?[1,4,8].map(n=>[...g.path,...Array.from({length:n},()=>g.action)]):[])];
  if(g.setup?.startsWith('amoeba-'))for(const option of options)option.amoebaWork=true;
  return options;
 }),...pushes.sort((a,b)=>b.value-a.value).slice(0,8).flatMap(p=>[p.path,[...p.path,...Array.from({length:8},()=>[-p.path.at(-1)[0],0,false])]])];
}
function trace(node){const chunks=[];for(let n=node;n;n=n.parent)chunks.push(n.actions);return chunks.reverse().flat();}
function mobility(g){let n=0;for(const [dx,dy]of dirs)if([' ','.','*','X'].includes(g.tile(g.player.x+dx,g.player.y+dy)))n++;return n;}
export function planningPriority(g,length,w=PRIORITY_DEFAULTS,facts=null){
 let available=facts?.available??0;if(!facts)for(const row of g.grid)for(const t of row)if(t==='*'||t==='d')available++;
 const distance=facts?.distance??Math.min(100,goalDistances(g)[g.player.y*g.grid[0].length+g.player.x]);
 let preparation=facts?.preparation??0;
 if(!facts){for(const cell of corridorTargets(g)){const [x,y]=cell.split(',').map(Number);preparation=Math.max(preparation,Math.max(0,3-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*60);}
 for(const [cell,setup]of [...generationTargets(g),...butterflyTargets(g)]){const [x,y]=cell.split(',').map(Number);preparation=Math.max(preparation,Math.max(0,5-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*(setup.kind==='magic-outlet'?80:50));}preparation=Math.max(preparation,butterflyReadiness(g).value*.3);}
 const pending=facts?.pending??(g.amoeba.dead==='*'?g.grid.reduce((n,r)=>n+r.filter(t=>t==='a').length,0):0);
 const needed=Math.max(0,g.target-g.collected);
 const pushes=[-1,1].filter(dx=>g.tile(g.player.x+dx,g.player.y)==='O'&&g.tile(g.player.x+2*dx,g.player.y)===' ').length;
 const colony=facts?.colony??(g.grid.some(r=>r.includes('a'))?amoebaState(g):null),containment=colony?.viable?1200+Math.min(colony.size,colony.required)*80+(colony.outside?300:0):0;
 return Math.min(g.collected,g.target)*2000*w.collection+Math.min(available,needed)*300*w.supply+Math.min(pending,needed)*250*w.amoeba+containment*w.amoeba-length*2*w.speed+mobility(g)*3*w.mobility-distance*12*w.distance+preparation*w.preparation+(w.push-1)*80*pushes;
}
export function planningOutcomeFitness(g,length){
 const needed=Math.max(0,g.target-g.collected),supply=g.grid.reduce((n,row)=>n+row.filter(t=>t==='*'||t==='d'||(t==='a'&&g.amoeba.dead==='*')).length,0);
 const distance=Math.min(100,goalDistances(g)[g.player.y*g.grid[0].length+g.player.x]);
 const colony=g.grid.some(r=>r.includes('a'))?amoebaState(g):null,controlled=colony?.viable&&colony.outside?1200:0;
 return (g.status==='won'?100000:0)+Math.min(g.collected,g.target)/Math.max(1,g.target)*10000+Math.min(supply,needed)/Math.max(1,g.target)*3000+controlled-distance*10-length*.05-(g.status==='dead'?2000:0);
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
 let namespace='s7:'+priorityProfile(weights)+':',amoebaGoal=null;
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
  const distances=goalDistances(g);f.critical=corridorTargets(g,distances);const butterfly=butterflyTargets(g);f.setups=f.amoeba||f.magic?generationTargets(g):butterfly.size?new Map():emptySetups;for(const [cell,setup]of butterfly)if(!f.setups.has(cell))f.setups.set(cell,setup);
  f.distance=Math.min(100,distances[g.player.y*g.grid[0].length+g.player.x]);f.preparation=0;
  for(const cell of f.critical){const [x,y]=cell.split(',').map(Number);f.preparation=Math.max(f.preparation,Math.max(0,3-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*60);}
  for(const [cell,setup]of f.setups){const [x,y]=cell.split(',').map(Number);f.preparation=Math.max(f.preparation,Math.max(0,5-Math.abs(x-g.player.x)-Math.abs(y-g.player.y))*(setup.kind==='magic-outlet'?80:50));}
  f.preparation=Math.max(f.preparation,butterflyReadiness(g).value*.3);
  f.colony=f.amoeba?amoebaState(g):null;
  f.analyzed=true;return f;
 }
 const start=new Game(context.index,'classic',fixture,{...context,fastTrappedTimer});start.start();
 const birth=[];while(!start.born&&start.status==='playing'){start.step();birth.push([0,0,false]);}
 const root={g:start,parent:null,actions:birth,length:birth.length};root.value=planningPriority(start,root.length,weights,analyze(start));
 const needsGeneration=world(start).available<start.target;
 const open=[root],seen=new Map([[getKey(start),root.length]]);let best=root,expanded=0;
 const completed=new Map(visited);
 function add(g,parent,actions){
  if(!actions.length||g.status==='dead'||world(g).potential<g.target||(mobility(g)===0&&g.isTrapped()))return;
  const length=(parent?.length??0)+actions.length;if(length>maxTicks)return;
  const harvest=Boolean(parent?.harvest||needsGeneration&&g.collected+world(g).available+world(g).pending>=g.target),facts=analyze(g),containment=Boolean(facts.colony?.viable&&facts.colony.outside);
  const node={g,parent,actions,length,harvest,containment,amoebaFocus:amoebaGoal&&facts.colony&&!g.amoeba.dead?amoebaFenceScore(g,amoebaGoal):-Infinity,value:harvest?planningOutcomeFitness(g,length):planningPriority(g,length,weights,facts)};
  if(g.collected>best.g.collected||(g.collected===best.g.collected&&(Number(harvest)>Number(Boolean(best.harvest))||harvest===Boolean(best.harvest)&&node.value>best.value)))best=node;
  const key=getKey(g),prior=seen.get(key);if(prior!==undefined&&prior<=length)return;
  if((completed.get(namespace+stateHash(key))??Infinity)<=length)return;
  seen.set(key,length);open.push(node);
 }
 // Re-simulate saved inputs from birth; a past death is never resumed as alive.
 // Seed checkpoints at collections and at intervals so blocked endings can
 // branch earlier, before the route sealed off the remaining diamonds.
 const approach=world(start).amoeba?amoebaApproach(start):null;
 const seeds=[...prefixes.slice(0,12),...Array.from({length:3},(_,n)=>scout(context,(seed+n)%4,fixture,fastTrappedTimer)),...(approach?.input.length?[[...birth,...approach.input]]:[])];
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
 const trap=maxTicks>best.length?butterflyTrapPlan(best.g,{depth:Math.min(64,maxTicks-best.length)}):{simulated:0};
 if(trap.game){const input=[...trace(best),...trap.input];if(trap.game.status==='won')return {game:trap.game,input,expanded,seed,finished:true,tacticalSteps:trap.simulated};add(trap.game,null,input);}
 const sequencePartials=[];let sequenceSteps=0;
 if(approach&&needsGeneration&&maxNodes>=256&&birth.length+approach.input.length<maxTicks){
  const prefix=[...birth,...approach.input],limit=maxTicks-prefix.length;
  function progress(stage,base){const c=amoebaState(stage.game);return {decision:0,diamonds:Math.max(best.g.collected,stage.game.collected),ticks:best.length,frontier:open.length,searchPosition:[stage.game.player.x,stage.game.player.y],searchDiamonds:stage.game.collected,searchTicks:base.length+stage.input.length,previewInput:[...base,...stage.input],previewBranches:[],amoeba:{phase:c.phase,size:c.size,capacity:c.capacity,openings:c.frontier.length},amoebaStage:stage.stage,amoebaLayer:stage.layer,amoebaSimulated:stage.simulated};}
  const containment=amoebaContainSearch(approach.game,{maxInputs:limit,maxSimulated:Math.min(260000,maxNodes*440)});let step;
  do{step=containment.next();if(!step.done)yield progress(step.value,prefix);}while(!step.done);
  const setup=step.value;sequenceSteps+=setup.simulated;
  for(const p of setup.partials??[]){const input=[...prefix,...p.input];add(p.game,null,input);sequencePartials.push(input);}
  if(setup.game){
   const base=[...prefix,...setup.input];add(setup.game,null,base);sequencePartials.push(base);
   if(base.length<maxTicks){
    const harvest=amoebaHarvestSearch(setup.game,{maxInputs:maxTicks-base.length,maxSimulated:Math.min(400000,maxNodes*670)});
    do{step=harvest.next();if(!step.done)yield progress(step.value,base);}while(!step.done);
    const result=step.value,input=[...base,...result.input];sequenceSteps+=result.simulated;
    if(result.game.status==='won')return {game:result.game,input,expanded,seed,finished:true,tacticalSteps:trap.simulated,amoebaSteps:sequenceSteps};
    add(result.game,null,input);sequencePartials.push(input);
   }
  }
 }
 const workers=open.filter(n=>world(n.g).amoeba&&!n.g.amoeba.dead&&n.length<maxTicks&&analyze(n.g).colony.distance<=8).sort((a,b)=>analyze(a.g).colony.distance+a.length*.02-analyze(b.g).colony.distance-b.length*.02);
 const reference=approach?.game.status==='playing'?(amoebaCutFence(approach.game)??amoebaFence(approach.game)):null;
 const work=reference?workers.map(node=>({node,fence:reference})).sort((a,b)=>amoebaFenceScore(b.node.g,reference)-amoebaFenceScore(a.node.g,reference)+a.node.length*.01-b.node.length*.01)[0]:workers.slice(0,24).map(node=>({node,fence:amoebaFence(node.g)})).filter(p=>p.fence).sort((a,b)=>a.fence.cost-b.fence.cost)[0],near=work?.node;
 if(near){amoebaGoal=work.fence;namespace='s7:'+stateHash(priorityProfile(weights)+JSON.stringify(amoebaGoal.ring))+':';for(const n of open)n.amoebaFocus=world(n.g).amoeba&&!n.g.amoeba.dead?amoebaFenceScore(n.g,amoebaGoal):-Infinity;}
 if(near&&amoebaGoal){const c=analyze(near.g).colony;yield {decision:0,diamonds:best.g.collected,ticks:best.length,frontier:open.length,searchPosition:[near.g.player.x,near.g.player.y],searchDiamonds:near.g.collected,searchTicks:near.length,previewInput:trace(near),previewBranches:[],amoeba:{phase:c.phase,size:c.size,capacity:c.capacity,openings:c.frontier.length}};}
 const amoeba=near&&amoebaState(near.g).distance<=8?amoebaContainPlan(near.g,{maxInputs:maxTicks-near.length}):{simulated:0,partials:[]};
 amoeba.simulated+=sequenceSteps;const preparations=[...sequencePartials];
 if(amoeba.game){const input=[...trace(near),...amoeba.input];add(amoeba.game,null,input);preparations.push(input);}
 for(const partial of amoeba.partials){const input=[...trace(near),...partial.input];add(partial.game,null,input);preparations.push(input);}
 const tier=n=>n.harvest?2:n.containment?1:0;
 for(;expanded<maxNodes&&open.length;expanded++){
  open.sort((a,b)=>tier(b)-tier(a)||b.value-a.value||a.length-b.length);
  // Periodic breadth expansion prevents a high-diamond dead end from consuming
  // the entire search before earlier corridor-opening choices are revisited.
  const breadthEvery=exploration>0?Math.round(1/Math.max(.05,Math.min(.8,exploration)))+1:Infinity;
  let pick=0;if(expanded%breadthEvery===breadthEvery-1){let shortest=Infinity;const stage=tier(open[0]);for(let i=0;i<open.length;i++)if(tier(open[i])===stage&&open[i].length<shortest){shortest=open[i].length;pick=i;}}
  if(amoebaGoal&&tier(open[0])===0&&expanded%4===2){let value=-Infinity;for(let i=0;i<open.length;i++){const score=open[i].amoebaFocus-open[i].length*.2;if(score>value){value=score;pick=i;}}}
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
  const transitions=new Map(),branchChoices=new Map();let retreatChecks=0;
  for(const route of routes.slice(offset).concat(routes.slice(0,offset))){
   let next=g,pathKey='';const actual=[],points=[[g.player.x,g.player.y]];
   for(let i=0;i<route.length;i++){
    if(node.length+actual.length>=maxTicks)break;
    const a=route[i],previousCollected=next.collected;pathKey+=`${a[0]+1}${a[1]+1}${+a[2]}`;
    let successor=transitions.get(pathKey);
    if(!successor){successor=cloneGame(next);successor.step({dx:a[0],dy:a[1],snap:a[2]});transitions.set(pathKey,successor);}
    next=successor;actual.push(a);
    const last=points.at(-1);if(points.length<33&&(last[0]!==next.player.x||last[1]!==next.player.y))points.push([next.player.x,next.player.y]);
    if(next.status==='won')return {game:next,input:[...trace(node),...actual],expanded:expanded+1,seed,finished:true,tacticalSteps:trap.simulated,amoebaSteps:amoeba.simulated};
    if(next.status==='dead')break;
    // Keep escape branches along a corridor instead of only at its end.
    if(i<route.length-1&&(i===route.length-2||next.collected>previousCollected||i%4===3||(i>0&&(route[i-1][0]!==a[0]||route[i-1][1]!==a[1]))))add(next,node,actual.map(a=>[...a]));
   }
   if(points.length>1){const key=JSON.stringify(points);if(!branchChoices.has(key))branchChoices.set(key,{points,dead:next.status==='dead'});}
   const count=open.length;add(next,node,actual);if(open.length>count)open.at(-1).value+=Math.max(-10,Math.min(10,guide(g,route)));
   if(route.amoebaWork&&next.status==='playing'&&world(next).amoeba&&retreatChecks++<2){const retreat=amoebaEscape(next,{depth:8,width:8,hold:4});amoeba.simulated+=retreat.simulated;if(retreat.game)add(retreat.game,node,[...actual,...retreat.input]);}
   if(next.status==='playing'&&next.falling.has(`${next.player.x},${next.player.y-1}`)){
    for(const escape of escapeRoutes(next,weights,getKey,analyze)){
     const actions=[...actual,...escape.path];
     if(escape.g.status==='won')return {game:escape.g,input:[...trace(node),...actions],expanded:expanded+1,seed,finished:true,tacticalSteps:trap.simulated,amoebaSteps:amoeba.simulated};
     add(escape.g,node,actions);
    }
   }
  }
  if(open.length>1800){open.sort((a,b)=>tier(b)-tier(a)||b.value-a.value);const groups=new Map();for(let i=0;i<open.length;i++){const n=open[i],k=`${tier(n)}:${n.g.collected}:${Math.floor(n.g.player.x/8)}:${Math.floor(n.g.player.y/6)}`;const count=(groups.get(k)??0)+1;groups.set(k,count);if(count>40){open.splice(i,1);i--;}}if(open.length>1800)open.length=1800;}
  if(expanded%8===0||amoebaGoal&&expanded%8===2){
   const choices=[...branchChoices.values()],first=new Set(),branches=[];
   for(const b of choices){const key=JSON.stringify(b.points[1]);if(!first.has(key)){first.add(key);branches.push(b);}}
   for(const b of choices)if(!branches.includes(b)&&branches.length<12)branches.push(b);
   const c=analyze(g).colony;
   yield {decision:expanded+1,diamonds:best.g.collected,ticks:best.length,frontier:open.length,searchPosition:[g.player.x,g.player.y],searchDiamonds:g.collected,searchTicks:node.length,previewInput:trace(node),previewBranches:branches.slice(0,12),...(c?{amoeba:{phase:c.phase,size:c.size,capacity:c.capacity,openings:c.frontier.length}}:{})};
  }
 }
 open.sort((a,b)=>tier(b)-tier(a)||b.value-a.value);const groups=new Map(),candidates=[];
 for(const n of open){const k=`${n.g.collected}:${Math.floor(n.g.player.x/5)}:${Math.floor(n.g.player.y/4)}`,count=groups.get(k)??0;if(count>=3)continue;groups.set(k,count+1);candidates.push(n);if(candidates.length>=64)break;}
 const strategic=[],positions=new Set();for(const n of [...open].sort((a,b)=>b.amoebaFocus-a.amoebaFocus)){if(!Number.isFinite(n.amoebaFocus))continue;const c=analyze(n.g).colony,k=`${Math.floor(n.g.player.x/3)},${Math.floor(n.g.player.y/3)}:${c?.frontier.length}:${c?.capacity}`;if(positions.has(k))continue;positions.add(k);strategic.push(trace(n));if(strategic.length>=12)break;}
 const unique=new Set(),frontier=[...preparations,...strategic,...candidates.map(trace)].filter(input=>{const key=JSON.stringify(input);if(unique.has(key))return false;unique.add(key);return true;}).slice(0,64);
 return {game:best.g,input:trace(best),expanded,seed,finished:false,frontier,visited:[...completed].slice(-6000),tacticalSteps:trap.simulated,amoebaSteps:amoeba.simulated};
}
