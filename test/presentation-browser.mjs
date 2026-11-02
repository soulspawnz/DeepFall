import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
const base=process.argv[5]??'http://127.0.0.1:8767/';
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {Game}=await import('./engine.mjs');const start=Game.prototype.start;Game.prototype.start=function(...args){window.checkedGame=this;return start.apply(this,args);};
  for(const [path,name]of [['./audio.mjs','SIDAudio'],['./lumen-audio.mjs','LumenAudio']]){const Type=(await import(path))[name],enable=Type.prototype.enable;Type.prototype.enable=async function(...args){window.checkedAudio=this;return enable.apply(this,args);};}
 });
 await page.clock.install();await page.getByRole('button',{name:/ENTER THE CAVE/}).click();await page.clock.runFor(3200);
 await page.locator('#game').screenshot({path:process.argv[4]+'/presentation-c64.png'});
 await page.locator('#pause').click();
 const state=await page.evaluate(()=>JSON.stringify(window.checkedGame));
 await page.getByLabel('LOOK & SOUND').selectOption('lumen');
 assert.equal(await page.evaluate(()=>JSON.stringify(window.checkedGame)),state,'changing presentation must not change the cave');
 assert.equal(await page.locator('#game').getAttribute('width'),'1920');assert.equal(await page.locator('#sid-model').isEnabled(),false);
 await page.locator('#pause').click();await page.clock.runFor(500);
 await page.locator('#game').screenshot({path:process.argv[4]+'/presentation-lumen.png'});
 await page.locator('#pause').click();await page.clock.resume();
 await page.locator('#sound').click();await page.waitForFunction(()=>window.checkedAudio?.enabled);
 await page.waitForFunction(()=>Number(document.querySelector('#sid-meter').value)>.0001,null,{timeout:10000});
 await page.evaluate(()=>{const a=window.checkedAudio,c=a.context,split=c.createChannelSplitter(2),left=c.createAnalyser(),right=c.createAnalyser(),sink=c.createGain();sink.gain.value=0;a.outputGain.connect(split);split.connect(left,0);split.connect(right,1);left.connect(sink);right.connect(sink);sink.connect(c.destination);window.stereoDifference=()=>{const l=new Float32Array(2048),r=new Float32Array(2048);left.getFloatTimeDomainData(l);right.getFloatTimeDomainData(r);return Math.sqrt(l.reduce((n,x,i)=>n+(x-r[i])**2,0)/l.length);};});
 await page.waitForFunction(()=>window.stereoDifference()>.00001,null,{timeout:10000});
 assert.match(await page.locator('#sid-state').innerText(),/LUMEN/);
 await page.locator('#sid-music').click();await page.waitForTimeout(1300);
 assert.ok(await page.evaluate(()=>window.checkedAudio.voices.size===0),'pause music off drains every voice');
 await page.locator('#sid-music').click();await page.waitForTimeout(300);
 // Switching styles with sound on must leave only the selected context running.
 const oldState=await page.evaluate(()=>{window.previousAudio=window.checkedAudio;return JSON.stringify(window.checkedGame);});
 await page.getByLabel('LOOK & SOUND').selectOption('retro');
 await page.waitForFunction(()=>window.previousAudio.context.state==='suspended'&&window.checkedAudio!==window.previousAudio&&window.checkedAudio.enabled);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.checkedGame)),oldState);
 assert.equal(await page.locator('#game').getAttribute('width'),'640');assert.equal(await page.locator('#sid-model').isEnabled(),true);
 await page.getByLabel('LOOK & SOUND').selectOption('lumen');await page.waitForFunction(()=>document.querySelector('#presentation').disabled===false);
 await page.locator('#sound').click();
 await page.waitForFunction(()=>window.checkedAudio.context.state==='suspended');
 // Suspended contexts may expose the preceding render quantum's parameter value.
 await page.evaluate(()=>window.checkedAudio.context.resume());await page.waitForFunction(()=>window.checkedAudio.outputGain.gain.value===0);await page.evaluate(()=>window.checkedAudio.context.suspend());
 // Exercise the new synth directly in this isolated test context.
 await page.evaluate(async()=>{
  const {LumenAudio}=await import('./lumen-audio.mjs');window.lifecycleAudio=new LumenAudio(()=>{});await window.lifecycleAudio.enable();
  const a=window.lifecycleAudio;a.configure({music:false,scene:{active:true},mood:'play'});
  a.effects(['birth','rockLand','diamondLand','step']);for(let n=0;n<100;n++)a.effects(['gem','blast','dig']);
 });
 assert.ok(await page.evaluate(()=>window.lifecycleAudio.voices.size<=48));
 await page.waitForTimeout(1400);assert.equal(await page.evaluate(()=>window.lifecycleAudio.voices.size),0);
 await page.evaluate(()=>{const a=window.lifecycleAudio;a.configure({music:true,mood:'death',scene:{active:false}});a.effects(['death']);});
 await page.waitForTimeout(3200);assert.equal(await page.evaluate(()=>window.lifecycleAudio.voices.size),0,'death theme must end');
 await page.evaluate(()=>window.lifecycleAudio.configure({mood:'silent',paused:true}));await page.waitForTimeout(200);
 assert.ok(await page.evaluate(()=>window.lifecycleAudio.outputGain.gain.value<.000001));
 await page.evaluate(()=>window.lifecycleAudio.disable());
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByLabel('LOOK & SOUND').inputValue(),'lumen');
 assert.match(await page.locator('#sound').innerText(),/SOUND OFF/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.clock.install();await page.getByRole('button',{name:/ENTER THE CAVE/}).click();await page.clock.runFor(3200);
 await page.locator('.cabinet').screenshot({path:process.argv[4]+'/presentation-lumen-mobile.png'});
 await page.getByRole('button',{name:/^I1 Intermission/}).click();assert.equal(await page.locator('#game').getAttribute('width'),'960');
 assert.deepEqual(errors,[]);console.log('[OK] Both renderers, same paused game across switches, stereo output, pause/music-off, context handoff, mute, preference persistence and mobile fit.');
}finally{await browser.close();}
