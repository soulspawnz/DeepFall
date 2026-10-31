import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 await page.getByLabel('Render training in game',{exact:true}).uncheck();
 const explore=page.getByLabel('Exploration',{exact:true});assert.equal(await explore.inputValue(),'auto');assert.match(await page.locator('#learning-exploration').innerText(),/Auto · 25%.*baseline/);
 async function train(count){await page.getByLabel('Training attempts',{exact:true}).selectOption(String(count));await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Training finished.'),null,{timeout:120000});}
 await train(5);assert.match(await page.locator('#learning-exploration').innerText(),/Auto · 20%.*consistent/);
 await train(1);
 let stored=await page.evaluate(async()=>{const a=await import('./learning-archive.mjs'),c={campaign:'original',index:0,difficulty:1};return {model:await a.readLearningModel(c),runs:await a.allLearningReplays(c)};});
 assert.equal(stored.model.attempts,6);assert.equal(stored.model.autoExploration.value,.2);
 const sixth=stored.runs.find(r=>r.kind==='training'&&r.attempt===6);assert.equal(sixth.run.exploration,.2);assert.equal(sixth.run.explorationMode,'auto');assert.match(sixth.run.explorationReason,/consistent/);
 assert.ok(stored.runs.filter(r=>r.kind==='evaluation').every(r=>r.run.exploration===0));
 await explore.selectOption('0.5');assert.match(await page.locator('#learning-exploration').innerText(),/Manual · 50%/);await train(1);
 stored=await page.evaluate(async()=>{const a=await import('./learning-archive.mjs'),c={campaign:'original',index:0,difficulty:1};return {model:await a.readLearningModel(c),runs:await a.allLearningReplays(c)};});
 assert.equal(stored.model.autoExploration.value,.2);assert.equal(stored.runs.find(r=>r.kind==='training'&&r.attempt===7).run.exploration,.5);
 await page.reload({waitUntil:'networkidle'});assert.equal(await explore.inputValue(),'0.5');await explore.selectOption('auto');assert.match(await page.locator('#learning-exploration').innerText(),/Auto · 20%/);
 await page.locator('#caves button').nth(1).click();await page.waitForFunction(()=>document.querySelector('#learning-exploration').textContent.includes('25%'));await page.locator('#caves button').nth(0).click();await page.waitForFunction(()=>document.querySelector('#learning-exploration').textContent.includes('20%'));
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.locator('.learning-player').screenshot({path:process.argv[4]+'/adaptive-exploration.png'});assert.deepEqual(errors,[]);
 console.log('[OK] Auto adapts after completed attempts, actual saved runs use its percentage, evaluation is excluded, manual override and per-cave controller persistence work.');
}finally{await browser.close();}
