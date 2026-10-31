import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 await page.getByLabel('Training attempts',{exact:true}).selectOption('1');await page.clock.install();
 await page.locator('#play').click();await page.clock.runFor(7000);await page.locator('#pause').click();const originalTime=await page.locator('#timer').innerText();
 await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#game').dataset.trainingPreview==='true',null,{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.replay-caption').textContent.includes('chosen run'),null,{timeout:60000});
 const before=await page.locator('#game').getAttribute('data-training-tick');await page.clock.runFor(2000);
 assert.ok(Number(await page.locator('#game').getAttribute('data-training-tick'))>Number(before??0));assert.match(await page.locator('#status-text').innerText(),/LIVE TRAINING/);
 assert.equal(await page.getByRole('button',{name:'Stop in-game training',exact:true}).isVisible(),true);
 await page.screenshot({path:process.argv[4]+'/training-in-game-preview.png',fullPage:false});
 await page.clock.runFor(20000);await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Training finished.'),null,{timeout:60000});
 assert.equal(await page.locator('#game').getAttribute('data-training-preview'),null);assert.equal(await page.locator('#status-text').innerText(),'EXPEDITION PAUSED');assert.equal(await page.locator('#diamonds').innerText(),'00');assert.equal(await page.locator('#timer').innerText(),originalTime);
 const saved=await page.evaluate(async()=>{const a=await import('./learning-archive.mjs'),c={campaign:'original',index:0,difficulty:1};return {model:await a.readLearningModel(c),runs:await a.allLearningReplays(c)};});assert.equal(saved.model.attempts,1);assert.equal(saved.runs.filter(r=>r.kind==='training').length,1);
 await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#game').dataset.trainingPreview==='true');await page.getByRole('button',{name:'Stop in-game training',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Stopped'));assert.equal(await page.locator('#game').getAttribute('data-training-preview'),null);
 assert.deepEqual(errors,[]);console.log('[OK] Real candidate inputs animate in the game; completed runs persist; preview restores the manual cave and can be stopped from the game controls.');
}finally{await browser.close();}
