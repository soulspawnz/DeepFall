import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;window.__sidTestGains=[];
  window.AudioContext=class extends Native{constructor(...args){super(...args);window.__sidTestContext=this;}createGain(){const node=super.createGain();window.__sidTestGains.push(node);return node;}};
 });
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});await page.locator('#sound').click();
 await page.evaluate(()=>{
  const context=window.__sidTestContext,analyser=context.createAnalyser();analyser.fftSize=2048;
  window.__sidTestGains[0].connect(analyser);const sink=context.createGain();sink.gain.value=0;analyser.connect(sink);sink.connect(context.destination);
  window.__sidAC=()=>{const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);const mean=samples.reduce((n,v)=>n+v,0)/samples.length;return Math.sqrt(samples.reduce((n,v)=>n+(v-mean)**2,0)/samples.length);};
 });
 await page.waitForFunction(()=>window.__sidAC()>.00001);
 await page.locator('#play').click();await page.locator('#pause').click();await page.waitForFunction(()=>window.__sidAC()>.00001);
 await page.locator('#sid-music').click();await page.waitForTimeout(150);
 assert.ok(await page.evaluate(()=>window.__sidAC()<1e-6));
 await page.locator('#sound').click();await page.locator('#sound').click();await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>window.__sidAC()<1e-6));
 await page.locator('#sid-model').selectOption('8580');await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>window.__sidAC()<1e-6));
 await page.locator('#sid-music').click();await page.waitForFunction(()=>window.__sidAC()>.00001);
 await page.locator('#pause').click();await page.waitForFunction(()=>window.__sidAC()>.00001);
 await page.locator('#pause').click();await page.waitForFunction(()=>window.__sidAC()>.00001);
 await page.locator('#pause').click();
 console.log('[OK] Pause theme plays; music-off keeps pause silent through sound toggles and chip switching; resume is clean.');
 await page.locator('#caves button').nth(1).click();await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();
 await page.getByRole('button',{name:'WATCH BASELINE',exact:true}).waitFor({state:'visible',timeout:60000});
 await page.getByRole('button',{name:'STOP TRAINING',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Stopped'));
 await page.getByRole('button',{name:'WATCH BASELINE',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#status-text').textContent==='SIGNAL LOST',null,{timeout:30000});
 await page.waitForTimeout(3200);assert.ok(await page.evaluate(()=>window.__sidAC()>.00001),'death lament plays after the original effect');
 await page.waitForTimeout(3200);assert.ok(await page.evaluate(()=>window.__sidAC()<1e-6),'death theme finishes without a held tone');
 await page.screenshot({path:process.argv[4]+'/sid-death-tail-cleared.png',fullPage:true});
 await page.locator('#restart').click();await page.waitForFunction(()=>window.__sidAC()>.00001,null,{timeout:5000});
 assert.deepEqual(errors,[]);console.log('[OK] Real B death effect finishes instead of hanging; restart produces audio again.');
}finally{await browser.close();}
