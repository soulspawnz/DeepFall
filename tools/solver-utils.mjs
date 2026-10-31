import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Game} from '../engine.mjs';
import {ORIGINAL_CAVES} from '../original-caves.mjs';

export function integer(value,name,min,max){
 const number=Number(value);if((typeof value==='string'&&!value.trim())||!Number.isInteger(number)||number<min||number>max)throw new Error(`${name} must be an integer from ${min} to ${max}.`);return number;
}
export function validateCave(index,difficulty){integer(index,'Cave index',0,ORIGINAL_CAVES.length-1);integer(difficulty,'Difficulty',1,5);}
export function isMain(url){return Boolean(process.argv[1])&&pathToFileURL(path.resolve(process.argv[1])).href===url;}
export function cliArgs(args,defaults){
 const [indices,output,...rest]=args;
 if(!indices||!output||rest.length>defaults.length)throw new Error('Supply comma-separated zero-based cave indices and an output directory; see docs/DEVELOPMENT.md.');
 const selected=[...new Set(indices.split(',').map(i=>integer(i,'Cave index',0,19)))];
 return {indices:selected,output:path.resolve(output),values:defaults.map((d,i)=>integer(rest[i]??d.value,d.name,d.min,d.max))};
}
export function solverResult(game,input,solver,extra={}){
 return {format:'deepfall-offline-solver-1',campaign:'original',index:game.index,cave:ORIGINAL_CAVES[game.index].id,difficulty:game.difficulty,
  status:game.status==='playing'?'budget':game.status,diamonds:game.collected,target:game.target,ticks:input.length,score:game.score,remaining:game.remaining,reason:game.reason,
  fastTrappedTimer:game.fastTrappedTimer,solver,...extra,input:input.map(([dx,dy,snap=false])=>[dx,dy,Boolean(snap)])};
}
export function verifySolverResult(result){
 validateCave(result.index,result.difficulty);
 if(result.format!=='deepfall-offline-solver-1'||result.campaign!=='original'||result.cave!==ORIGINAL_CAVES[result.index].id||!Array.isArray(result.input)||result.input.length<1||result.input.length>4000||result.ticks!==result.input.length||typeof result.fastTrappedTimer!=='boolean'||!Number.isFinite(result.score)||!Number.isFinite(result.remaining))throw new Error('Invalid solver recording.');
 const game=new Game(result.index,'classic',null,{campaign:'original',difficulty:result.difficulty,fastTrappedTimer:result.fastTrappedTimer});game.start();
 for(const a of result.input){
  if(!Array.isArray(a)||a.length!==3||!Number.isInteger(a[0])||!Number.isInteger(a[1])||Math.abs(a[0])+Math.abs(a[1])>1||typeof a[2]!=='boolean'||game.status!=='playing')throw new Error('Invalid solver input.');
  game.step({dx:a[0],dy:a[1],snap:a[2]});
 }
 const status=game.status==='playing'?'budget':game.status;
 if(status!==result.status||game.collected!==result.diamonds||game.target!==result.target||game.score!==result.score||Math.abs(game.remaining-result.remaining)>1e-7)throw new Error('Solver recording does not reproduce.');
 return game;
}
export function saveWin(directory,result){
 verifySolverResult(result);if(result.status!=='won')throw new Error('Only verified escapes can be saved as wins.');
 fs.mkdirSync(directory,{recursive:true});
 const filename=path.join(directory,`winning-${result.cave}-level-${result.difficulty}.json`);
 // Exclusive creation protects existing results; no implicit checkpoint writes.
 try{fs.writeFileSync(filename,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code==='EEXIST')return false;throw error;}
 return true;
}
