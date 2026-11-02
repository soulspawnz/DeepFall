import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
const base=process.argv[5]??'http://127.0.0.1:8767/';
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 // Isolated context: a real, separately identified local baseline must survive demo viewing.
 const before=await page.evaluate(async()=>{
  const {LearningPlayer}=await import('./learning-player.mjs'),{learningReplay,saveLearningRecords}=await import('./learning-archive.mjs');
  const c={campaign:'original',difficulty:1,index:0},p=new LearningPlayer(c),r=p.run({learn:false});
  await saveLearningRecords(c,p.export(),[learningReplay(c,'baseline',0,r)]);
  localStorage.setItem('deepfall.learning.collapsed','true');
  return JSON.stringify({model:p.export(),run:r});
 });
 async function stored(){return page.evaluate(async()=>{
  const {readLearningModel,allLearningReplays}=await import('./learning-archive.mjs'),c={campaign:'original',difficulty:1,index:0};
  return JSON.stringify({model:await readLearningModel(c),runs:await allLearningReplays()});
 });}
 const original=await stored();assert.ok(before.length>0);
 await page.goto(base+'?demo=1#learning-player',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Published training demo ready'),null,{timeout:120000});
 assert.equal(await page.getByRole('tab',{name:'Graphs',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#learning-content').isVisible(),true);
 assert.equal(await page.getByLabel('Learning history source').inputValue(),'published');
 assert.match(await page.locator('.learning-chart-stats').getAttribute('aria-label'),/75 recorded training runs/);
 await page.getByRole('tab',{name:'Overview',exact:true}).click();assert.equal(await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).isEnabled(),false);
 await page.getByRole('tab',{name:'Data',exact:true}).click();assert.equal(await page.getByRole('button',{name:'IMPORT LEARNING',exact:true}).isEnabled(),false);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'EXPORT ALL REPLAYS',exact:true}).click();assert.equal((await download).suggestedFilename(),'deepfall-all-learning-replays.json');
 await page.getByRole('button',{name:/^B Rooms/}).click();
 await page.waitForFunction(()=>document.querySelector('#learning-history-status').textContent.startsWith('261 archived'),null,{timeout:120000});
 await page.getByRole('tab',{name:'Graphs',exact:true}).click();assert.match(await page.locator('.learning-chart-stats').getAttribute('aria-label'),/first escape #196/);
 await page.locator('.learning-player').screenshot({path:process.argv[4]+'/published-training-B-mobile.png'});
 await page.getByRole('button',{name:/^G Amoeba/}).click();
 await page.waitForFunction(()=>document.querySelector('#learning-history-status').textContent.startsWith('31 archived'),null,{timeout:120000});
 assert.match(await page.locator('.learning-chart-stats').getAttribute('aria-label'),/first escape #8/);
 await page.getByRole('tab',{name:'Replays',exact:true}).click();await page.getByLabel('Replay result',{exact:true}).selectOption('won');
 assert.ok(await page.locator('.learning-results tbody tr').count()>0);
 await page.clock.install();await page.locator('.learning-results tbody button').first().click();
 await page.clock.runFor(80000);assert.equal(await page.locator('#status-text').innerText(),'BACK ABOVE GROUND');
 assert.equal(await stored(),original);
 await page.getByRole('button',{name:/^I Greed/}).click();
 await page.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('No published training'),null,{timeout:120000});
 assert.match(await page.locator('#learning-history-status').textContent(),/^0 archived/);
 await page.getByLabel('Learning history source').selectOption('local');
 await page.getByRole('button',{name:/^A Intro/}).click();
 await page.waitForFunction(()=>document.querySelector('#learning-history-status').textContent.startsWith('1 archived'),null,{timeout:120000});
 await page.getByRole('tab',{name:'Overview',exact:true}).click();assert.equal(await page.getByRole('button',{name:'TRAIN PLAYER',exact:true}).isEnabled(),true);
 assert.equal(await stored(),original);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const unavailable=await browser.newPage();await unavailable.route('**/docs/training/snapshot.json',route=>route.fulfill({status:404,body:'Unavailable'}));
 await unavailable.goto(base+'?demo=1');
 await unavailable.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Published training unavailable'),null,{timeout:30000});
 await unavailable.getByLabel('Learning history source').selectOption('local');
 await unavailable.waitForFunction(()=>document.querySelector('#learning-status').textContent.startsWith('Ready.'),null,{timeout:30000});
 await unavailable.close();
 assert.deepEqual(errors,[]);
 console.log('[OK] Mobile demo graphs/replay/export, actual G escape playback, empty cave, disabled writes, source switching and byte-identical local history/model preservation.');
}finally{await browser.close();}
