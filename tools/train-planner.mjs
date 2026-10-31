import {readFile,writeFile,stat} from 'node:fs/promises';
import {LearningPlayer,contextKey} from '../learning-player.mjs';
import {validateLearningModel,validLearningReplay,learningReplay,verifyLearningReplay} from '../learning-archive.mjs';

const [modelFile,archiveFile,outputPrefix,countArg='5',nodesArg='600']=process.argv.slice(2);
const count=Number(countArg),searchNodes=Number(nodesArg);
if(!modelFile||!archiveFile||!outputPrefix||!Number.isInteger(count)||count<1||count>100||!Number.isInteger(searchNodes)||searchNodes<1||searchNodes>2000)throw new Error('Usage: node tools/train-planner.mjs MODEL_JSON REPLAY_JSON OUTPUT_PREFIX [attempts=5] [search_nodes=600]');
async function json(file){if((await stat(file)).size>32*1024*1024)throw new Error('Backup exceeds 32 MB.');return JSON.parse(await readFile(file,'utf8'));}
const saved=await json(modelFile),archive=await json(archiveFile),context=saved.context;
validateLearningModel(saved,context);
if(archive.format!=='deepfall-learning-replays-1'||!Array.isArray(archive.runs)||archive.runs.some(r=>!validLearningReplay(r)))throw new Error('Choose a valid exported AI replay archive.');
const player=new LearningPlayer(context,saved),oldKeys=[...player.values.keys()],records=[];
player.rememberPartials(archive.runs.filter(r=>r.contextKey===contextKey(context)).map(r=>r.run));player.upgrade();
async function save(){await writeFile(outputPrefix+'.model.json',JSON.stringify(player.export()));await writeFile(outputPrefix+'.replays.json',JSON.stringify({format:'deepfall-learning-replays-1',runs:records}));}
for(let n=0;n<count;n++){
 const generator=player.attempt({searchNodes});let step;
 do{step=generator.next();if(!step.done&&step.value.decision%80===1)console.log('[SEARCH]',JSON.stringify({attempt:player.attempts+1,...step.value}));}while(!step.done);
 const run=step.value,record=learningReplay(context,'training',player.attempts,run);verifyLearningReplay(record);records.push(record);await save();
 console.log('[ATTEMPT]',JSON.stringify({attempt:player.attempts,status:run.status,diamonds:run.diamonds,ticks:run.ticks,searchExpanded:run.searchExpanded,reusedPartials:run.reusedPartials}));
 if(run.status==='won')break;
}
const evaluation=player.run({learn:false,searchNodes}),{input,...summary}=evaluation;player.evaluation=summary;
const record=learningReplay(context,'evaluation',player.attempts,evaluation);verifyLearningReplay(record);records.push(record);await save();
console.log('[EVALUATION]',JSON.stringify({status:evaluation.status,diamonds:evaluation.diamonds,ticks:evaluation.ticks,preservedDecisionKeys:oldKeys.filter(k=>player.values.has(k)).length,previousDecisionKeys:oldKeys.length,newReplays:records.length}));
