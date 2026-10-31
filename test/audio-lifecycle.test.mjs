import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SIDEngine} from '../sid-engine.mjs';
import {SIDAudio} from '../audio.mjs';

function render(engine,seconds){const buffer=new Float32Array(4800);for(let n=0;n<Math.ceil(seconds*10);n++)engine.render(buffer);return buffer;}
function acRms(buffer){const mean=buffer.reduce((n,v)=>n+v,0)/buffer.length;return Math.sqrt(buffer.reduce((n,v)=>n+(v-mean)**2,0)/buffer.length);}

test('original one-shots finish after the cave becomes inactive, on both SID models',()=>{
 for(const model of ['6581','8580'])for(const effect of ['death','blast','gem','dig','rewind']){
  const engine=new SIDEngine(48000,model,'original');engine.configure({music:false,scene:{active:true,remaining:100}});engine.trigger([effect]);render(engine,.1);
  engine.configure({scene:{active:false,amoeba:false,magic:false,remaining:100}});const tail=render(engine,3);
  assert.equal(engine.originalSFX.m[0x9811],0,`${model}/${effect} effect counter`);
  assert.equal(engine.originalSFX.m[0x9808],0,`${model}/${effect} dig counter`);
  assert.ok(acRms(tail)<1e-6,`${model}/${effect} sustained tone`);
 }
});
test('death stops ambient sources but allows music to reclaim its voices',()=>{
 const engine=new SIDEngine(48000,'6581','original');engine.configure({music:true,scene:{active:true,amoeba:true,magic:true,remaining:5}});engine.trigger(['death']);render(engine,.1);
 engine.configure({scene:{active:false,amoeba:true,magic:true,remaining:5}});const tail=render(engine,3);
 assert.equal(engine.originalSFX.m[0x43],0);assert.equal(engine.originalSFX.m[0x8d],0);assert.equal(engine.originalSFX.m[0x9811],0);
 assert.ok(acRms(tail)>.00001,'music still plays after death effect ends');
});
test('muting effects during the win bonus cannot stall the music driver',()=>{
 const engine=new SIDEngine(48000,'6581','original');engine.configure({scene:{active:false,remaining:100}});engine.trigger(['win']);render(engine,.1);assert.ok(engine.originalSFX.bonus>0);
 engine.configure({effects:false,music:true});render(engine,.2);assert.equal(engine.originalSFX.bonus,0);assert.ok(engine.originalSFX.m[0xc1]>0);
});
test('the native output gate mutes pause and disable independently of worklet updates',async()=>{
 const audio=new SIDAudio(()=>{}),events=[],gain={value:1,cancelScheduledValues(){},setValueAtTime(value){this.value=value;events.push(['set',value]);},linearRampToValueAtTime(value){this.value=value;events.push(['ramp',value]);}};
 audio.context={currentTime:1,suspend(){events.push(['suspend',gain.value]);return Promise.resolve();}};audio.outputGain={gain};audio.outputTarget=1;audio.enabled=true;
 audio.configure({paused:true});assert.equal(gain.value,0);
 audio.configure({model:'8580'});assert.equal(gain.value,0);
 audio.configure({paused:false});assert.equal(gain.value,1);
 audio.disable();assert.equal(gain.value,0);assert.deepEqual(events.at(-1),['suspend',0]);
 audio.enabled=true;audio.configure({paused:true});assert.equal(gain.value,0);audio.configure({paused:false});assert.equal(gain.value,1);
});
test('pause and death have distinct SID themes, and music-off keeps pause silent',()=>{
 for(const model of ['6581','8580']){
  const paused=new SIDEngine(48000,model,'original');paused.configure({paused:true,mood:'pause'});
  const pauseAudio=render(paused,1);assert.ok(acRms(pauseAudio)>1e-5);
  const dead=new SIDEngine(48000,model,'original');dead.configure({mood:'death',scene:{active:false}});dead.trigger(['death']);
  const deathAudio=render(dead,3.2);assert.ok(acRms(deathAudio)>1e-5);assert.notDeepEqual(deathAudio,pauseAudio);
  assert.ok(acRms(render(dead,6))<1e-6,'death theme finishes');
  paused.configure({music:false});assert.equal(acRms(render(paused,.1)),0);
  paused.configure({music:true,mood:'silent'});assert.equal(acRms(render(paused,.1)),0,'hidden tab remains silent');
 }
});
