import {Game} from '../engine.mjs';
import {ACTIONS,cloneGame,simulateStep} from '../simulation.mjs';
import {planningKey} from '../route-planner.mjs';
import {cliArgs,integer,isMain,saveWin,solverResult,validateCave} from './solver-utils.mjs';
export {ACTIONS};
export const clone=cloneGame,step=simulateStep;

function distances(g,exit=false){
 const width=g.grid[0].length,height=g.grid.length,d=new Int16Array(width*height).fill(-1),queue=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(g.tile(x,y)===(exit?'X':'*')){d[y*width+x]=0;queue.push([x,y]);}
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of ACTIONS.slice(0,4)){
  const xx=x+dx,yy=y+dy,k=yy*width+xx;
  if(xx<0||xx>=width||yy<0||yy>=height||d[k]>=0||['#','+','M','a'].includes(g.tile(xx,yy)))continue;
  d[k]=d[y*width+x]+1;queue.push([xx,yy]);
 }}return d;
}
// Independent, short-horizon comparison policy; no persistent learning.
export function solve(index,seed=1,limit=1600,{difficulty=1}={}){
 validateCave(index,difficulty);integer(seed,'Seed',1,0xffffffff);integer(limit,'Tick limit',1,4000);
 let game=new Game(index,'classic',null,{campaign:'original',difficulty});game.start();const input=[],visits=new Map();
 let rng=seed;const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return(rng>>>0)/4294967296;};
 while(game.status==='playing'&&input.length<limit){
  if(!game.born){game.step();input.push([0,0,false]);continue;}
  const map=distances(game,game.collected>=game.target),old=game;
  let beam=[{g:game,first:null,value:0}],best;
  for(let depth=0;depth<4;depth++){
   const next=[],seen=new Set();
   for(const node of beam){for(const a of ACTIONS){
    const copy=step(node.g,a);if(copy.status==='dead')continue;
    const signature=planningKey(copy);if(seen.has(signature))continue;seen.add(signature);
    const first=node.first??a;
    if(copy.status==='won'){best={g:copy,first,value:1e9};break;}
    const key=`${copy.player.x},${copy.player.y}`,distance=map[copy.player.y*copy.grid[0].length+copy.player.x];
    const stationary=copy.player.x===old.player.x&&copy.player.y===old.player.y;
    const value=(copy.collected-old.collected)*1000-(distance<0?100:distance)*8-(visits.get(key)??0)*4-depth*.1-(stationary?3:0)+random()*.5;
    next.push({g:copy,first,value});
   }if(best?.g.status==='won')break;}
   if(best?.g.status==='won')break;
   next.sort((a,b)=>b.value-a.value);beam=next.slice(0,5);if(!beam.length)break;best=beam[0];
  }
  if(!best)break;
  const a=best.first;game=step(game,a);input.push([a[0],a[1],Boolean(a[2])]);
  const key=`${game.player.x},${game.player.y}`;visits.set(key,(visits.get(key)??0)+1);
 }
 return solverResult(game,input,'short-horizon-beam',{seed,tickLimit:limit});
}
if(isMain(import.meta.url)){
 try{
  const {indices,output,values:[seeds,limit,difficulty]}=cliArgs(process.argv.slice(2),[{name:'Seeds',value:12,min:1,max:100},{name:'Tick limit',value:1600,min:1,max:4000},{name:'Difficulty',value:1,min:1,max:5}]);
  for(const index of indices)for(let seed=1;seed<=seeds;seed++){
   const result=solve(index,seed,limit,{difficulty});const {input,...summary}=result;console.log('[RESULT]',JSON.stringify(summary));
   if(result.status==='won'){console.log(saveWin(output,result)?'[SAVED]':'[EXISTS]',result.cave);break;}
  }
 }catch(error){console.error('[FAIL]',error.message);process.exitCode=1;}
}
