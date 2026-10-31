import {writeFile} from 'node:fs/promises';
import {LearningPlayer} from '../learning-player.mjs';
const index=Number(process.argv[2]??0),count=Number(process.argv[3]??10),output=process.argv[4];
const player=new LearningPlayer({campaign:'original',index,difficulty:1});
const summary=r=>{const {input,...rest}=r;return rest;};
const before=summary(player.run({learn:false,maxDecisions:120}));
console.log('[BASELINE]',JSON.stringify(before));
for(let n=0;n<count;n++)console.log('[ATTEMPT]',JSON.stringify(summary(player.run({maxDecisions:120}))));
const after=summary(player.run({learn:false,maxDecisions:120}));
const report={before,after,attempts:player.attempts,wins:player.results.filter(r=>r.status==='won').length,routes:new Set(player.results.map(r=>r.route)).size};
console.log('[EVALUATION]',JSON.stringify(report));
if(output){await writeFile(output,JSON.stringify({report,saved:player.export()}));console.log('[OK] Saved learning and evaluation');}
