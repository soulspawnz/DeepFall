import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector';
import {performance} from 'node:perf_hooks';

const [modelFile,archiveFile,prefix,nodesArg='600',repeatsArg='3',sourceArg]=process.argv.slice(2);
const nodes=Number(nodesArg),repeats=Number(repeatsArg),root=sourceArg?path.resolve(sourceArg):fileURLToPath(new URL('..',import.meta.url));
if(!modelFile||!archiveFile||!prefix||!Number.isInteger(nodes)||nodes<1||nodes>2000||!Number.isInteger(repeats)||repeats<1||repeats>10)throw new Error('Usage: node --expose-gc tools/profile-search.mjs MODEL ARCHIVE OUTPUT_PREFIX [nodes=600] [repeats=3] [source-root]');
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
async function json(file){if((await stat(file)).size>32*1024*1024)throw new Error('Backup exceeds 32 MB.');return JSON.parse(await readFile(file,'utf8'));}
const {LearningPlayer,contextKey}=await import(pathToFileURL(path.join(root,'learning-player.mjs')).href);
const {validateLearningModel,validLearningReplay,learningReplay,verifyLearningReplay}=await import(pathToFileURL(path.join(root,'learning-archive.mjs')).href);
const saved=await json(modelFile),archive=await json(archiveFile),context=saved.context;validateLearningModel(saved,context);
if(archive.format!=='deepfall-learning-replays-1'||!Array.isArray(archive.runs)||archive.runs.some(r=>!validLearningReplay(r)))throw new Error('Invalid replay archive.');
const partials=archive.runs.filter(r=>r.contextKey===contextKey(context)).map(r=>r.run).sort((a,b)=>(b.status==='won')-(a.status==='won')||b.diamonds-a.diamonds||a.ticks-b.ticks).slice(0,24);
await mkdir(path.dirname(path.resolve(prefix)),{recursive:true});
const sources={};for(const name of ['engine.mjs','simulation.mjs','route-planner.mjs','learning-player.mjs'])sources[name]=hash(await readFile(path.join(root,name),'utf8'));
function execute(){
 const player=new LearningPlayer(context,JSON.parse(JSON.stringify(saved)));player.rememberPartials(partials);player.upgrade();
 global.gc?.();const cpu=process.cpuUsage(),memory=process.memoryUsage(),start=performance.now(),progress=createHash('sha256');
 const generator=player.attempt({searchNodes:nodes,seed:saved.attempts+1,exploration:.5});let step;
 do{step=generator.next();if(!step.done)progress.update(JSON.stringify(step.value));}while(!step.done);
 const elapsedMs=performance.now()-start,used=process.cpuUsage(cpu),run=step.value;
 const fingerprint={run:hash(run),model:hash(player.export()),progress:progress.digest('hex')};
 verifyLearningReplay(learningReplay(context,'training',player.attempts,run));
 return {elapsedMs,cpuMs:(used.user+used.system)/1000,heapDeltaBytes:process.memoryUsage().heapUsed-memory.heapUsed,fingerprint,status:run.status,diamonds:run.diamonds,ticks:run.ticks,expanded:run.searchExpanded};
}
const session=new Session();session.connect();const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');
const profiled=execute(),{profile}=await post('Profiler.stop');session.disconnect();
await writeFile(prefix+'.cpuprofile',JSON.stringify(profile),{flag:'wx'});
const byId=new Map(profile.nodes.map(n=>[n.id,n])),totals=new Map();let total=0;
for(let i=0;i<profile.samples.length;i++){const node=byId.get(profile.samples[i]),micros=profile.timeDeltas[i]??0,key=(node.callFrame.functionName||'(anonymous)')+' @ '+path.basename(node.callFrame.url||'native')+':'+(node.callFrame.lineNumber+1);totals.set(key,(totals.get(key)??0)+micros);total+=micros;}
const hot=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,18).map(([frame,micros])=>({frame,selfPercent:Math.round(micros/total*10000)/100}));
console.log('[PROFILE]',JSON.stringify({elapsedMs:profiled.elapsedMs,hot}));
const samples=[];for(let i=0;i<repeats;i++){const run=execute();if(JSON.stringify(run.fingerprint)!==JSON.stringify(profiled.fingerprint))throw new Error('Repeated benchmark changed inputs, model or search progress.');samples.push(run);console.log('[SAMPLE]',JSON.stringify({sample:i+1,...run}));}
const sorted=samples.map(s=>s.elapsedMs).sort((a,b)=>a-b),medianMs=sorted[Math.floor(sorted.length/2)];
const summary={node:process.version,context,seed:saved.attempts+1,exploration:.5,nodes,repeats,sourceHashes:sources,modelHash:hash(saved),archiveHash:hash(archive),gcExposed:typeof global.gc==='function',profiled,hot,samples,medianMs};
await writeFile(prefix+'.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log('[SUMMARY]',JSON.stringify({medianMs,...samples[0].fingerprint,diamonds:samples[0].diamonds,ticks:samples[0].ticks,expanded:samples[0].expanded}));
