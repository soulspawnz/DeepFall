import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
let smoothRun;
try{
 for(const searchRewinds of [false,true]){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
  const toggle=page.getByLabel('Show search rewinds',{exact:true});assert.equal(await toggle.isChecked(),false);await toggle.setChecked(searchRewinds);
  await page.getByLabel('Training attempts',{exact:true}).selectOption('1');await page.clock.install();
  await page.locator('#play').click();await page.clock.runFor(7000);await page.locator('#pause').click();const originalTime=await page.locator('#timer').innerText();
  await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.trainingPreview==='true',null,{timeout:60000});
  assert.equal(await toggle.isDisabled(),true);assert.equal(await page.locator('#game').getAttribute('data-training-style'),searchRewinds?'search':'smooth');
  await page.waitForFunction(()=>/chosen run|continuous completed-run/.test(document.querySelector('.replay-caption').textContent),null,{timeout:60000});
  let previous=0,sawMovement=false;
  for(let n=0;n<40;n++){
   await page.clock.runFor(500);const tick=await page.locator('#game').getAttribute('data-training-tick');if(tick===null)break;
   const current=Number(tick);if(!searchRewinds)assert.ok(current>=previous,'continuous playback must never move backwards');sawMovement||=current>previous;previous=current;
   if(n===3)await page.screenshot({path:process.argv[4]+`/training-preview-${searchRewinds?'search':'smooth'}.png`,fullPage:false});
  }
  assert.ok(sawMovement);await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Training finished.'),null,{timeout:60000});
  assert.equal(await page.locator('#game').getAttribute('data-training-preview'),null);assert.equal(await page.locator('#status-text').innerText(),'EXPEDITION PAUSED');assert.equal(await page.locator('#diamonds').innerText(),'00');assert.equal(await page.locator('#timer').innerText(),originalTime);
  const saved=await page.evaluate(async()=>{const a=await import('./learning-archive.mjs'),c={campaign:'original',index:0,difficulty:1};return {model:await a.readLearningModel(c),runs:await a.allLearningReplays(c)};});assert.equal(saved.model.attempts,1);assert.equal(saved.runs.filter(r=>r.kind==='training').length,1);
  const run=saved.runs.find(r=>r.kind==='training').run;if(!searchRewinds)smoothRun=run;else assert.deepEqual(run,smoothRun,'display preference must not change actual learning inputs/outcomes');
  await page.getByRole('button',{name:'WATCH NEXT ATTEMPT',exact:true}).click();
  await page.waitForFunction(()=>/chosen run|continuous completed-run/.test(document.querySelector('.replay-caption').textContent),null,{timeout:60000});
  await page.clock.runFor(20000);await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Training finished.'),null,{timeout:60000});
  assert.equal(await page.locator('#watch-tests').innerText(),'WATCH PLAYTESTS','WATCH NEXT must not replay the same attempt twice after preview');
  await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#game').dataset.trainingPreview==='true');await page.getByRole('button',{name:'Stop in-game training',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Stopped'));assert.equal(await page.locator('#game').getAttribute('data-training-preview'),null);
  await toggle.check();await page.reload({waitUntil:'networkidle'});assert.equal(await toggle.isChecked(),true);await toggle.uncheck();await page.reload({waitUntil:'networkidle'});assert.equal(await toggle.isChecked(),false);
  await page.getByLabel('Render training in game',{exact:true}).uncheck();assert.equal(await toggle.isDisabled(),true);
  assert.deepEqual(errors,[]);await page.close();console.log(`[OK] ${searchRewinds?'Search':'Smooth'} preview: movement, recording, manual-cave restoration, stop and preference persistence.`);
 }
}finally{await browser.close();}
