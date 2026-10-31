import {LearningPlayer,recoverLearningReplays} from './learning-player.mjs';
let cancelled=false,acknowledge=null,serial=0,waiting=0;
const summary=run=>{const {input,...result}=run;return result;};
function publish(data){return new Promise(resolve=>{waiting=++serial;acknowledge=resolve;self.postMessage({...data,id:waiting});});}
async function consume(generator,phase,attempt){
 let step;
 do{
  step=generator.next();
  if(!step.done&&step.value.decision%8===0){self.postMessage({type:'progress',phase,attempt,...step.value});await new Promise(resolve=>setTimeout(resolve,0));}
 }while(!step.done&&!cancelled);
 return step.done?step.value:null;
}
self.onmessage=async({data})=>{
 if(data.type==='ack'){if(data.id===waiting){const done=acknowledge;acknowledge=null;done?.();}return;}
 if(data.type==='stop'){cancelled=true;acknowledge?.();return;}
 if(!['train','recover'].includes(data.type))return;
 cancelled=false;
 try {
  if(data.type==='recover'){
   const records=await consume(recoverLearningReplays(data.context,data.saved),'recovery',0);
   if(records&&!cancelled)await publish({type:'recovered',records,saved:data.saved});
   self.postMessage({type:'done',recovered:true});return;
  }
  const player=new LearningPlayer(data.context,data.saved);
  player.upgrade();
  if(!player.baseline&&!cancelled){
   const run=await consume(player.attempt({learn:false}),'baseline',0);
   if(run&&!cancelled){player.baseline=summary(run);await publish({type:'record',kind:'baseline',attempt:0,run,saved:player.export()});}
  }
  for(let n=0;n<Math.min(100,Math.max(1,Number(data.count)||10))&&!cancelled;n++){
   const run=await consume(player.attempt({exploration:Math.min(.8,Math.max(.05,Number(data.exploration)||.25))}),'training',player.attempts+1);
   if(!run||cancelled)break;
   await publish({type:'record',kind:'training',attempt:player.attempts,run,saved:player.export(),watch:Boolean(data.watch)});
  }
  if(!cancelled){
   const run=await consume(player.attempt({learn:false}),'evaluation',player.attempts);
   if(run&&!cancelled){player.evaluation=summary(run);await publish({type:'record',kind:'evaluation',attempt:player.attempts,run,saved:player.export()});}
  }
  self.postMessage({type:'done'});
 } catch(error){self.postMessage({type:'error',message:error.message});}
};
