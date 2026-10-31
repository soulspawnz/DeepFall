import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 const fixture=await page.evaluate(async()=>{
  const {LearningPlayer}=await import('./learning-player.mjs'),{learningReplay,saveLearningRecords}=await import('./learning-archive.mjs');
  const context={campaign:'original',index:0,difficulty:1},player=new LearningPlayer(context),run=player.run({learn:false});
  // Test fixtures: repeated, real simulated inputs, not claims of training.
  const records=Array.from({length:32},(_,i)=>learningReplay(context,'training',i+1,run));records.push(learningReplay(context,'baseline',0,run));
  await saveLearningRecords(context,player.export(),records);
  return {model:player.export(),backup:{format:'deepfall-learning-replays-1',runs:[records[0],learningReplay(context,'training',33,run)]}};
 });
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#learning-history-status').textContent.startsWith('33 archived'));
 const rows=page.locator('.learning-results tbody tr');assert.equal(await rows.count(),10);assert.match(await rows.first().innerText(),/Attempt 32/);
 await page.getByLabel('Attempts per page',{exact:true}).selectOption('25');await page.waitForFunction(()=>document.querySelectorAll('.learning-results tbody tr').length===25);
 await page.getByRole('button',{name:'NEXT REPLAYS',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.learning-results tbody tr').length===8);
 await page.getByLabel('Sort replays',{exact:true}).selectOption('oldest');await page.waitForFunction(()=>document.querySelector('.learning-results tbody tr').textContent.includes('Before learning'));
 await page.getByLabel('Replay result',{exact:true}).selectOption('dead');await page.waitForFunction(()=>document.querySelectorAll('.learning-results tbody tr').length===0);
 await page.getByLabel('Replay result',{exact:true}).selectOption('all');await page.getByLabel('Replay type',{exact:true}).selectOption('baseline');await page.waitForFunction(()=>document.querySelectorAll('.learning-results tbody tr').length===1);
 await page.getByRole('button',{name:'HIDE CONTENT',exact:true}).click();assert.equal(await page.locator('#learning-content').isVisible(),false);
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#learning-content').isVisible(),false);await page.getByRole('button',{name:'SHOW CONTENT',exact:true}).click();
 async function upload(button,data){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:button,exact:true}).click();await(await chooser).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});}
 await page.locator('.learning-backups summary').click();
 await upload('IMPORT LEARNING',fixture.model);await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Learning imported.'));
 await upload('IMPORT REPLAYS',fixture.backup);await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Imported 1 replays; 1 duplicates'));
 const invalid=structuredClone(fixture.backup);invalid.runs[1].run.score++;
 await upload('IMPORT REPLAYS',invalid);await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Import failed:'));
 assert.match(await page.locator('#learning-history-status').innerText(),/34 archived replays/);
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#learning-history-status').textContent.startsWith('34 archived'));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:process.argv[4]+'/learning-library-controls.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('[OK] Collapse persists; page size, sorting and filters work; model/replay imports persist, verify outcomes, skip duplicates and reject corruption atomically; mobile fits.');
}finally{await browser.close();}
