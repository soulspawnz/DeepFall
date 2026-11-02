import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const {chromium}=await import(pathToFileURL(process.argv[2]).href),output=resolve(process.argv[4]),base=process.argv[5]??'http://127.0.0.1:8767/',localUI=process.argv.includes('--local-ui');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]}),reports=[];
const profiles=[['small-phone',320,568],['phone-se',375,667],['phone',390,844],['android-size',412,915],['phone-landscape',844,390],['small-landscape',667,375],['tablet',768,1024],['tablet-landscape',1024,768]];
try{
 for(const[name,width,height]of profiles){
  const only=process.argv.find(a=>a.startsWith('--profile='))?.slice(10);if(only&&name!==only)continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  try{
  page.on('pageerror',e=>errors.push(e.message));
  if(process.argv.includes('--lumen'))await page.addInitScript(()=>localStorage.setItem('deepfall.presentation','lumen'));
  if(localUI)for(const file of ['fullscreen.mjs','fullscreen.css'])await context.route(new URL(file,base).href,route=>route.fulfill({path:new URL('../'+file,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),contentType:file.endsWith('.css')?'text/css':'text/javascript'}));
  await page.addInitScript(()=>{const Native=window.AudioContext;window.__mobileGains=[];window.AudioContext=class extends Native{constructor(...a){super(...a);window.__mobileAudio=this;}createGain(){const n=super.createGain();window.__mobileGains.push(n);return n;}};});
  await page.goto(base,{waitUntil:'networkidle'});
  // Observe inputs consumed by the real engine without changing its rules/state.
  await page.evaluate(async engineURL=>{const{Game}=await import(engineURL),step=Game.prototype.step,rewind=Game.prototype.rewind;window.__mobileSteps=[];Game.prototype.step=function(input={}){const result=step.call(this,input);window.__mobileState={player:{...this.player},diamonds:this.collected,status:this.status,born:this.born};window.__mobileSteps.push({...input,...window.__mobileState});if(window.__mobileSteps.length>300)window.__mobileSteps.shift();return result;};Game.prototype.rewind=function(){const target=this.history[Math.max(0,this.history.length-16)],result=rewind.call(this);window.__mobileRewind={result,expected:target?{player:target.player,diamonds:target.collected,remaining:target.remaining}:null,actual:{player:{...this.player},diamonds:this.collected,remaining:this.remaining}};return result;};},new URL('engine.mjs',base).href);
  const state=()=>page.evaluate(()=>window.__mobileState);
  const layout=()=>page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return {viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,canvas:rect(document.querySelector('#game')),stage:rect(document.querySelector('.screen-wrap')),controls:rect(document.querySelector('.touch-controls')),buttons:[...document.querySelectorAll('.touch-controls button')].map(rect)};});
  const cdp=await context.newCDPSession(page);
  async function hold(selector,{cancel=false,drag=false,duration=280}={}){
   const box=await page.locator(selector).boundingBox(),viewport=page.viewportSize();assert(box&&box.width>=44&&box.height>=44&&box.y>=0&&box.y+box.height<=viewport.height+1,`${name}: visible touch target ${selector}`);const p={x:box.x+box.width/2,y:box.y+box.height/2,id:1};
   await page.evaluate(()=>{window.__mobileSteps=[];});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await page.waitForTimeout(duration);
   if(drag){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,x:Math.min(width-4,p.x+90),y:Math.max(4,p.y-80)}]});await page.waitForTimeout(150);}
   await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(260);
   const steps=await page.evaluate(()=>window.__mobileSteps);assert(steps.length>=2);assert(steps.slice(-2).every(s=>(s.dx??0)===0&&(s.dy??0)===0),`${name}: release/cancel clears input`);return steps;
  }
  function checkTargets(info,fullscreen=false){assert(!info.overflow,`${name}: page overflow`);assert(info.controls.width>0,`${name}: controls visible`);for(const r of info.buttons){assert(r.width>=44&&r.height>=44,`${name}: 44px targets`);if(fullscreen)assert(r.x>=0&&r.y>=0&&r.right<=info.viewport.width+1&&r.bottom<=info.viewport.height+1,`${name}: touch target fits fullscreen`);}if(fullscreen){assert(info.stage.y>=0&&info.stage.bottom<=info.viewport.height+1,`${name}: game fits fullscreen`);assert(Math.abs(info.stage.width/info.stage.height-4/3)<.02,`${name}: 4:3 stage`);}}

  await page.locator('#campaign').selectOption('deepfall');await page.locator('#play').tap();await page.waitForTimeout(250);
  await page.locator('.touch-controls').scrollIntoViewIfNeeded();const normal=await layout();checkTargets(normal);assert(normal.canvas.bottom>40&&normal.canvas.y<normal.viewport.height,`${name}: game remains visible with controls`);
  const initial=await state();await page.locator('#snap-touch').tap();const snapped=await hold('[data-dir=right]');assert(snapped.some(s=>s.snap&&s.dx===1));const snapState=await state();assert.equal(snapState.diamonds,1,`${name}: touch snap collects`);assert.deepEqual(snapState.player,initial.player,`${name}: snap does not move`);
  await page.locator('#snap-touch').tap();const moving=await hold('[data-dir=right]',{duration:220});assert(moving.some(s=>s.dx===1&&!s.snap));assert((await state()).player.x>initial.player.x,`${name}: touch moves player`);
  for(const[dir,dx,dy]of [['left',-1,0],['up',0,-1],['down',0,1]]){const steps=await hold(`[data-dir=${dir}]`,{duration:150});assert(steps.some(s=>s.dx===dx&&s.dy===dy),`${name}: ${dir} input`);}
  await hold('[data-dir=left]',{cancel:true,drag:true,duration:150});assert.equal((await state()).status,'playing');
  await page.locator('#pause').tap();assert.equal(await page.locator('#status-text').innerText(),'EXPEDITION PAUSED');await page.locator('#play').tap();assert.equal(await page.locator('#status-text').innerText(),'EXPEDITION IN PROGRESS');

  if(name==='phone'){
   await page.locator('.touch-controls').scrollIntoViewIfNeeded();
   const right=await page.locator('[data-dir=right]').boundingBox(),up=await page.locator('[data-dir=up]').boundingBox(),r={x:right.x+22,y:right.y+22,id:1},u={x:up.x+22,y:up.y+22,id:2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r,u]});await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.__mobileSteps.at(-1).dy),-1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);assert(await page.evaluate(()=>{const s=window.__mobileSteps.at(-1);return s.dx===0&&s.dy===0;}));
  }
  await page.locator('#echo-mode').tap();await page.locator('#play').tap();await page.waitForTimeout(250);await page.locator('.touch-controls').scrollIntoViewIfNeeded();await hold('[data-dir=right]',{duration:300});await page.locator('#rewind').tap();assert.equal(await page.locator('#charges').innerText(),'2');const rewound=await page.evaluate(()=>window.__mobileRewind);assert(rewound.result);assert.deepEqual(rewound.actual,rewound.expected,`${name}: Echo restores its actual selected history checkpoint`);
  await page.locator('#classic-mode').tap();await page.locator('#campaign').selectOption('original');await page.locator('#play').tap();await page.waitForFunction(()=>document.querySelector('#status-text').textContent==='EXPEDITION IN PROGRESS');
  if(name==='phone'){await page.locator('#fullscreen').tap();await page.waitForFunction(()=>document.querySelector('#fullscreen').getAttribute('aria-pressed')==='true');assert(await page.evaluate(()=>document.fullscreenElement?.classList.contains('cabinet')));checkTargets(await layout(),true);await page.locator('#fullscreen').tap();await page.waitForFunction(()=>!document.fullscreenElement);}
  // Explicitly cover viewport fallback without claiming native mobile Safari.
  await page.evaluate(()=>{document.querySelector('.cabinet').requestFullscreen=undefined;});await page.locator('#fullscreen').tap();const full=await layout();checkTargets(full,true);await hold('[data-dir=up]',{duration:150});
  await page.screenshot({path:resolve(output,name+'-fullscreen.png')});
  await page.setViewportSize({width:height,height:width});await page.waitForTimeout(200);const rotated=await layout();checkTargets(rotated,true);await hold('[data-dir=right]',{duration:150});await page.screenshot({path:resolve(output,name+'-rotated.png')});await page.locator('#fullscreen').tap();assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.cabinet>.touch-controls').count(),1);
  await page.locator('#restart').tap();assert.equal(await page.locator('#diamonds').innerText(),'00');assert.equal(await page.locator('#timer').innerText(),'02:30');assert.equal(await page.locator('#overlay').isVisible(),false);
  let sound='not sampled on this profile';if(name==='phone'){
   await page.locator('#sound').tap();await page.evaluate(()=>{const c=window.__mobileAudio,a=c.createAnalyser();a.fftSize=2048;window.__mobileGains[0].connect(a);const sink=c.createGain();sink.gain.value=0;a.connect(sink);sink.connect(c.destination);window.__mobileAC=()=>{const s=new Float32Array(a.fftSize);a.getFloatTimeDomainData(s);const m=s.reduce((n,v)=>n+v,0)/s.length;return Math.sqrt(s.reduce((n,v)=>n+(v-m)**2,0)/s.length);};});await page.waitForFunction(()=>window.__mobileAC()>.00001);await page.locator('#sound').tap();await page.waitForFunction(()=>window.__mobileAudio.state==='suspended'&&document.querySelector('#sound').getAttribute('aria-pressed')==='false');
   // Suspension freezes analyser data/parameter sampling. Resume only this
   // isolated diagnostic context to verify the output gate, then suspend it.
   await page.evaluate(()=>window.__mobileAudio.resume());await page.waitForFunction(()=>window.__mobileAC()<1e-6&&window.__mobileGains[0].gain.value===0);await page.evaluate(()=>window.__mobileAudio.suspend());sound=(process.argv.includes('--lumen')?'Lumen stereo':'SID')+' AC output; sound off suspends; isolated resume confirms zero-gain silence';
  }
  assert.deepEqual(errors,[]);reports.push({name,viewport:{width,height},normal,fullscreen:full,rotated,sound,errors,checks:['all directions','hold/release','drag/cancel','snap collect without moving','pause/resume','Echo rewind','original campaign','4:3 fullscreen fallback','orientation change','restart']});console.log('[OK] '+name+': touch gameplay, cancellation, snap, Echo, original cave, rotation and fullscreen');
  }catch(error){reports.push({name,error:String(error.stack??error)});console.error('[FAIL] '+name+': '+error.message);await page.screenshot({path:resolve(output,name+'-failure.png')}).catch(()=>{});}finally{await context.close();}
 }
 await writeFile(resolve(output,'mobile-results.json'),JSON.stringify({base,localUI,presentation:process.argv.includes('--lumen')?'lumen':'retro',engine:'Chromium touch emulation; not physical devices or Safari',reports},null,2));
 assert(reports.length&&reports.every(r=>!r.error),'See mobile-results.json for failed profiles');
}finally{await browser.close();}
