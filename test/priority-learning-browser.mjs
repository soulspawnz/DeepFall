import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});await page.getByLabel('Training attempts',{exact:true}).selectOption('5');await page.getByLabel('Render training in game',{exact:true}).uncheck();
 await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Training finished.'),null,{timeout:120000});
 const saved=await page.evaluate(async()=>{const a=await import('./learning-archive.mjs'),c={campaign:'original',index:0,difficulty:1};return {model:await a.readLearningModel(c),records:await a.allLearningReplays(c)};});
 const runs=saved.records.filter(r=>r.kind==='training');assert.equal(runs.length,5);assert.equal(saved.model.priorityLearning.trials,5);assert.equal(saved.records.filter(r=>r.kind==='evaluation').length,1);
 assert.equal(runs[0].run.planningPriorities.kind,'reference');assert.equal(runs[1].run.planningPriorities.kind,'explore');assert.notDeepEqual(runs[1].run.planningPriorities.weights,runs[0].run.planningPriorities.weights);
 assert.equal(saved.model.priorityLearning.champion.fitness,Math.max(...runs.map(r=>r.run.priorityFitness)));
 await page.getByText('Planning priorities',{exact:true}).click();assert.match(await page.locator('#learning-priorities').innerText(),/5 completed priority trials/);
 assert.equal(await page.getByRole('table',{name:'Planning priority multipliers'}).locator('tr').count(),8);
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#learning-priorities').textContent.includes('5 completed priority trials'));
 const restored=await page.evaluate(async()=>{const a=await import('./learning-archive.mjs');return (await a.readLearningModel({campaign:'original',index:0,difficulty:1})).priorityLearning;});assert.deepEqual(restored,saved.model.priorityLearning);
 await page.setViewportSize({width:390,height:844});await page.getByText('Planning priorities',{exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:process.argv[4]+'/priority-learning-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('[OK] Worker applies and records distinct priority weights, retains the best measured profile, excludes evaluation from learning, persists and renders on mobile.');
}finally{await browser.close();}
