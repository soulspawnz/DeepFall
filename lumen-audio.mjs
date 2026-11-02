// Bounded, original stereo synthesis. No samples, downloads or SID emulation.
const hz=note=>440*2**((note-69)/12);
const roots=[40,36,43,38],melody=[76,0,79,83,81,79,74,0,76,79,83,86,83,79,78,74];
export class LumenAudio {
 constructor(onUpdate){this.onUpdate=onUpdate;this.enabled=false;this.settings={model:'6581',master:.35,profile:'original',music:true,effects:true,paused:false,mood:'play'};this.voices=new Set();this.count=0;this.lastEffect='none';this.musicKey='';}
 async enable(){
  if(!this.context){
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Web Audio is unavailable');
   this.context=new Audio({latencyHint:'interactive'});const c=this.context;
   this.outputGain=c.createGain();this.outputGain.gain.value=0;this.outputGain.connect(c.destination);
   this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-16;this.compressor.ratio.value=4;this.compressor.connect(this.outputGain);
   this.dry=c.createGain();this.dry.gain.value=.8;this.dry.connect(this.compressor);
   this.reverb=c.createConvolver();const impulse=c.createBuffer(2,Math.floor(c.sampleRate*.85),c.sampleRate);let seed=113;
   for(let ch=0;ch<2;ch++){const data=impulse.getChannelData(ch);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*(1-i/data.length)**3;}}
   this.reverb.buffer=impulse;this.wet=c.createGain();this.wet.gain.value=.23;this.wet.connect(this.reverb);this.reverb.connect(this.compressor);
   this.analyser=c.createAnalyser();this.analyser.fftSize=512;this.outputGain.connect(this.analyser);this.meter=new Float32Array(512);
  }
  await this.context.resume();this.enabled=true;this.configure(this.settings);
  if(!this.timer)this.timer=setInterval(()=>this.tick(),80);
 }
 voice(frequency,{at=this.context.currentTime,duration=.2,volume=.15,type='sine',pan=0,kind='effect',endFrequency=frequency}={}){
  if(!this.enabled||this.voices.size>=48)return;
  const c=this.context,osc=c.createOscillator(),gain=c.createGain(),panner=c.createStereoPanner();
  osc.type=type;osc.frequency.setValueAtTime(Math.max(20,frequency),at);osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),at+duration);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.00001,at+duration);
  panner.pan.value=pan;osc.connect(gain);gain.connect(panner);panner.connect(this.dry);panner.connect(this.wet);
  const v={osc,gain,panner,kind};this.voices.add(v);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();this.voices.delete(v);};
  osc.start(at);osc.stop(at+duration+.02);
 }
 stopVoices(kind){for(const v of this.voices)if(!kind||v.kind===kind){try{v.osc.stop();}catch{}v.gain.gain.cancelScheduledValues(this.context.currentTime);v.gain.gain.setValueAtTime(0,this.context.currentTime);}}
 configure(settings){
  const previousMood=this.settings.mood;Object.assign(this.settings,settings);if(!this.context)return;
  const audible=this.enabled&&this.settings.mood!=='silent'&&(!this.settings.paused||(this.settings.music&&this.settings.mood==='pause'));
  this.outputGain.gain.cancelScheduledValues(this.context.currentTime);this.outputGain.gain.setTargetAtTime(audible?this.settings.master:0,this.context.currentTime,.008);
  if(!audible){this.stopVoices();this.musicKey='';}
  if(!this.settings.effects)this.stopVoices('effect');
  if(previousMood!==this.settings.mood)this.stopVoices(['pause','silent'].includes(this.settings.mood)?undefined:'music');
  this.syncMusic();
 }
 syncMusic(){
  if(!this.enabled||!this.context)return;
  const s=this.settings,key=s.music&&s.mood!=='silent'&&(s.mood==='pause'||s.mood==='death'||(!s.paused&&s.scene?.active))?s.mood:'';
  if(key===this.musicKey)return;this.stopVoices('music');this.musicKey=key;this.beat=0;this.nextBeat=this.context.currentTime+.03;
 }
 tick(){
  if(!this.enabled)return;this.syncMusic();const c=this.context,key=this.musicKey;
  // Schedule only a short lookahead; bound catch-up after background throttling.
  if(this.nextBeat<c.currentTime-.2)this.nextBeat=c.currentTime+.02;
  for(let n=0;key&&this.nextBeat<c.currentTime+.18&&n<4;n++){
   const at=this.nextBeat,b=this.beat++,root=roots[Math.floor(b/16)%4];
   if(key==='death'){
    if(b<4)this.voice(hz([64,62,59,52][b]),{at,duration:.7,volume:.14,kind:'music',pan:b%2?.25:-.25});
    this.nextBeat+=.48;if(b>=4)this.nextBeat=Infinity;
   }else if(key==='pause'){
    if(b%4===0)for(const [i,note]of [52,59,64].entries())this.voice(hz(note),{at:at+i*.07,duration:1.15,volume:.06,kind:'music',pan:(i-1)*.5});this.nextBeat+=.4;
   }else{
    if(b%4===0){this.voice(hz(root),{at,duration:.66,volume:.18,type:'triangle',kind:'music'});this.voice(hz(root+19),{at,duration:.8,volume:.045,kind:'music',pan:-.4});}
    const note=melody[b%16];if(note){this.voice(hz(note),{at,duration:.32,volume:.085,kind:'music',pan:b%2?.45:-.45});this.voice(hz(note+12),{at,duration:.14,volume:.025,kind:'music',pan:b%2?-.3:.3});}
    this.nextBeat+=.21;
   }
  }
  this.analyser.getFloatTimeDomainData(this.meter);let peak=0;for(const sample of this.meter)peak=Math.max(peak,Math.abs(sample));
  this.onUpdate({model:'LUMEN',peak,effects:this.count,writes:0,lastEffect:this.lastEffect});
 }
 effects(names){
  if(!this.enabled||!this.settings.effects||this.settings.paused||this.settings.mood==='silent')return;
  const at=this.context.currentTime;
  for(const name of [...new Set(names)].slice(0,6)){
   this.count++;this.lastEffect=name;
   if(name==='gem'||name==='unlock'||name==='win'){
    const notes=name==='gem'?[88,95]:name==='unlock'?[76,80,83,88]:[76,79,83,88,91,95];
    notes.forEach((note,i)=>{this.voice(hz(note),{at:at+i*.065,duration:.28,volume:.2,pan:(i%2?1:-1)*.35});this.voice(hz(note)*2.002,{at:at+i*.065,duration:.16,volume:.045});});
   }else if(name==='death'||name==='blast'){
    this.voice(name==='death'?190:95,{duration:.65,volume:.45,type:'sawtooth',endFrequency:28});
    this.voice(47,{duration:.8,volume:.35,type:'sine',endFrequency:25});
   }else if(name==='rewind')this.voice(1600,{duration:.5,volume:.2,type:'triangle',endFrequency:90,pan:-.5});
   else if(name==='land'||name==='rockLand'||name==='push'){
    this.voice(name==='land'?140:100,{duration:.16,volume:.32,type:'triangle',endFrequency:32});this.voice(640,{duration:.04,volume:.08,type:'square',pan:.2});
   }else if(name==='diamondLand')this.voice(hz(91),{duration:.12,volume:.12,pan:.35,endFrequency:hz(79)});
   else if(name==='birth')[64,71,76].forEach((note,i)=>this.voice(hz(note),{at:at+i*.08,duration:.22,volume:.12,pan:(i-1)*.3}));
   else if(name==='step')this.voice(115,{duration:.035,volume:.045,type:'triangle',endFrequency:55});
   else if(name==='dig')this.voice(380,{duration:.055,volume:.12,type:'triangle',endFrequency:95,pan:-.2});
  }
 }
 demo(){this.effects(['gem','push','unlock']);}
 reset(){this.stopVoices();this.musicKey='';if(this.context){this.beat=0;this.nextBeat=this.context.currentTime+.03;}}
 disable(){this.enabled=false;clearInterval(this.timer);this.timer=null;this.stopVoices();this.musicKey='';if(this.context){this.outputGain.gain.cancelScheduledValues(this.context.currentTime);this.outputGain.gain.setValueAtTime(0,this.context.currentTime);this.context.suspend().catch(()=>{});}}
}
