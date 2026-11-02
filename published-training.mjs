import {contextKey} from './learning-player.mjs';
import {validateLearningModel,verifyLearningReplay} from './learning-archive.mjs';

let snapshot;
const contexts=new Map();
export async function publishedTraining(context){
 const key=contextKey(context);
 if(!snapshot)snapshot=fetch(new URL('./docs/training/snapshot.json',import.meta.url)).then(async response=>{
  if(!response.ok)throw new Error('Published training is unavailable. Your local learning is unchanged.');
  const data=await response.json();
  if(data.format!=='deepfall-published-training-1'||!Array.isArray(data.models)||data.models.length>100||!Array.isArray(data.runs)||data.runs.length>10000)throw new Error('Unsupported published training snapshot.');
  return data;
 }).catch(error=>{snapshot=null;throw error;});
 if(!contexts.has(key))contexts.set(key,(async()=>{
  const data=await snapshot,raw=data.models.find(model=>contextKey(model.context)===key);
  const model=raw?validateLearningModel(raw,context):null,records=[];
  for(const record of data.runs.filter(record=>record.contextKey===key)){
   verifyLearningReplay(record);records.push(record);
   if(records.length%10===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {model,records,publishedAt:data.publishedAt};
 })().catch(error=>{contexts.delete(key);throw error;}));
 return contexts.get(key);
}

export async function allPublishedReplays(){
 const data=await snapshot;
 return data?.runs??[];
}
