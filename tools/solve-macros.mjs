import {Game} from '../engine.mjs';
import {ACTIONS,cloneGame,simulateStep} from '../simulation.mjs';
import {diamondPotential,generationTargets,planningKey} from '../route-planner.mjs';
import {cliArgs,integer,isMain,saveWin,solverResult,validateCave} from './solver-utils.mjs';
const dirs=ACTIONS.slice(0,4);
function stats(g){let gems=0,enemies=0;for(const row of g.grid)for(const t of row){if(t==='*'||t==='d')gems++;if(t==='b')enemies++;}return{gems,enemies};}
function routes(g){
 const paths=[],queue=[{...g.player,path:[]}],seen=new Set([`${g.player.x},${g.player.y}`]),setups=generationTargets(g),enemies=[];
 g.grid.forEach((r,y)=>r.forEach((t,x)=>{if(t==='b')enemies.push([x,y]);}));
 for(let n=0;n<queue.length;n++){
  const p=queue[n],tile=g.tile(p.x,p.y);
  if(p.path.length){
   let priority=tile==='*'?10000-p.path.length*8:tile==='X'&&g.collected>=g.target?1e6:0;
   if(tile==='.'&&['O','*'].includes(g.tile(p.x,p.y-1)))priority=Math.max(priority,1000-p.path.length*3-Math.min(100,...enemies.map(([x,y])=>Math.abs(x-p.x)+Math.abs(y-p.y)))*8);
   if(setups.has(`${p.x},${p.y}`))priority=Math.max(priority,setups.get(`${p.x},${p.y}`).value-p.path.length*3);
   if(priority)paths.push({...p,priority});
  }
  for(const [dx,dy]of dirs){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`,tile=g.tile(x,y);if(seen.has(key)||!([' ','.','*'].includes(tile)||(g.collected>=g.target&&tile==='X')))continue;seen.add(key);queue.push({x,y,path:[...p.path,[dx,dy,false]]});}
 }
 paths.sort((a,b)=>b.priority-a.priority);return paths.slice(0,20).map(p=>p.path);
}
// Independent bounded macro search. Importing this module never starts a job.
export function solveMacro(index,maxNodes=4000,{difficulty=1,maxMs=180000,onProgress=()=>{}}={}){
 validateCave(index,difficulty);integer(maxNodes,'Node limit',1,100000);integer(maxMs,'Time limit',1,3600000);
 const start=new Game(index,'classic',null,{campaign:'original',difficulty});start.start();const birth=[];
 while(!start.born&&start.status==='playing'){start.step();birth.push([0,0,false]);}
 const initial=stats(start),seen=new Map(),open=[{g:start,parent:null,actions:birth,value:0}],started=Date.now();let best=start.collected;
 function result(node){const parts=[];for(let p=node;p;p=p.parent)parts.push(p.actions);return solverResult(node.g,parts.reverse().flat(),'macro-best-first',{nodeLimit:maxNodes});}
 for(let count=0;count<maxNodes&&open.length&&Date.now()-started<maxMs;count++){
  open.sort((a,b)=>b.value-a.value);const node=open.shift(),g=node.g;
  if(g.collected>best){best=g.collected;onProgress({index,diamonds:best,target:g.target,nodes:count,ticks:g.tick});}
  const candidates=routes(g);for(const a of ACTIONS)candidates.push([[a[0],a[1],Boolean(a[2])]]);
  for(const n of [3,8])candidates.push(Array.from({length:n},()=>[0,0,false]));
  for(const actions of candidates){
   let copy=cloneGame(g);const actual=[];
   for(const a of actions){if(copy.tick>=4000)break;const next=simulateStep(copy,a);if(next.status==='dead')break;copy=next;actual.push(a);if(copy.status==='won')return result({g:copy,parent:node,actions:actual});}
   if(!actual.length||diamondPotential(copy)<copy.target)continue;
   const key=planningKey(copy),previous=seen.get(key);if(previous!==undefined&&previous<=copy.tick)continue;seen.set(key,copy.tick);
   const s=stats(copy),value=copy.collected*5000+(initial.enemies-s.enemies)*3000+(s.gems+copy.collected-initial.gems)*60-copy.tick*2+(copy.amoeba.dead==='*'?4000:0);
   open.push({g:copy,parent:node,actions:actual,value});
  }
  if(open.length>2500){open.sort((a,b)=>b.value-a.value);open.length=2500;}
 }
 return null;
}
if(isMain(import.meta.url)){
 try{
  const {indices,output,values:[nodes,maxMs,difficulty]}=cliArgs(process.argv.slice(2),[{name:'Node limit',value:4000,min:1,max:100000},{name:'Time limit',value:180000,min:1,max:3600000},{name:'Difficulty',value:1,min:1,max:5}]);
  for(const index of indices){const result=solveMacro(index,nodes,{difficulty,maxMs,onProgress:p=>console.log('[PROGRESS]',JSON.stringify(p))});if(result)console.log(saveWin(output,result)?'[SAVED]':'[EXISTS]',result.cave,result.ticks);else console.log('[NO ROUTE]',index);}
 }catch(error){console.error('[FAIL]',error.message);process.exitCode=1;}
}
