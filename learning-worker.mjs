import {LearningPlayer} from './learning-player.mjs';
let cancelled=false;
self.onmessage=async({data})=>{
 if(data.type==='stop'){cancelled=true;return;}
 if(data.type!=='train')return;
 cancelled=false;
 try {
  const player=new LearningPlayer(data.context,data.saved);
  async function evaluate(phase){
   const attempt=player.attempt({learn:false});let next;
   do{next=attempt.next();if(!next.done&&next.value.decision%8===0){self.postMessage({type:'progress',phase,...next.value});await new Promise(resolve=>setTimeout(resolve,0));}}while(!next.done&&!cancelled);
   if(!next.done)return null;const {input,...result}=next.value;return result;
  }
  if(!player.baseline&&!cancelled)player.baseline=await evaluate('baseline');
  for(let n=0;n<Math.min(100,Math.max(1,Number(data.count)||10))&&!cancelled;n++) {
   const attempt=player.attempt({exploration:Math.min(.8,Math.max(.05,Number(data.exploration)||.25))});
   let step;
   do {
    step=attempt.next();
    if(!step.done&&step.value.decision%8===0){self.postMessage({type:'progress',attempt:player.attempts+1,...step.value});await new Promise(resolve=>setTimeout(resolve,0));}
   } while(!step.done&&!cancelled);
   if(cancelled)break;
   const {input,...result}=step.value;
   self.postMessage({type:'result',result,saved:player.export(),replay:data.watch?{...step.value,mode:'classic',learningAttempts:player.attempts}:null});
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  if(!cancelled){player.evaluation=await evaluate('evaluation');self.postMessage({type:'evaluation',saved:player.export()});}
  self.postMessage({type:'done'});
 } catch(error){self.postMessage({type:'error',message:error.message});}
};
