import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {LearningPlayer}=await import('./learning-player.mjs'),{Game}=await import('./engine.mjs'),{learningReplay,saveLearningRecords}=await import('./learning-archive.mjs');
  const context={campaign:'original',index:0,difficulty:1},p=new LearningPlayer(context),won=p.run({learn:false});
  function other(input){const g=new Game(0,'classic',null,{...context,fastTrappedTimer:true});g.start();for(const [dx,dy,snap]of input)g.step({dx,dy,snap});return {...won,input,status:g.status==='playing'?'budget':g.status,ticks:input.length,diamonds:g.collected,score:g.score,remaining:g.remaining,route:'fixture-'+input.length};}
  const budget=other(won.input.slice(0,40)),dead=other(Array.from({length:1600},()=>[0,0,false]));
  // Synthetic history, using real engine results. No user model is touched.
  const records=Array.from({length:150},(_,i)=>learningReplay(context,'training',i+1,i%10===0?won:i%2?dead:budget));
  for(const attempt of [25,50,75,100,125,150])records.push(learningReplay(context,'evaluation',attempt,won));records.push(learningReplay(context,'baseline',0,won));
  p.attempts=150;p.best=won;p.baseline=won;p.evaluation=won;p.results=records.filter(r=>r.kind==='training').slice(-100).map(r=>{const {input,...summary}=r.run;return summary;});
  await saveLearningRecords(context,p.export(),records);
 });
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('tab',{name:'Graphs',exact:true}).click();
 const graphs=page.getByRole('region',{name:'Learning progress graphs',exact:true});
 await page.waitForFunction(()=>document.querySelector('.learning-chart-stats').getAttribute('aria-label').startsWith('150 recorded'));
 assert.match(await graphs.locator('.learning-chart-stats').getAttribute('aria-label'),/15 escapes \(10.0%\).*first escape #1/);
 assert.equal(await graphs.locator('.chart-evaluation').count(),6);
 await page.getByRole('button',{name:'WIN RATE',exact:true}).click();assert.match(await graphs.locator('svg').getAttribute('aria-label'),/Rolling training win rate/);
 await page.getByLabel('Show evaluation results',{exact:true}).uncheck();assert.equal(await graphs.locator('.chart-evaluation').count(),0);
 assert.match(await graphs.locator('.learning-chart-stats').getAttribute('aria-label'),/15 escapes \(10.0%\)/);
 await page.getByLabel('Show evaluation results',{exact:true}).check();
 await page.getByLabel('Graph history range',{exact:true}).selectOption('25');assert.equal(await graphs.locator('.chart-evaluation').count(),1);
 const slider=page.getByLabel('Inspect learning run',{exact:true});await slider.focus();await slider.press('Home');assert.match(await slider.getAttribute('aria-valuetext'),/Attempt 126/);
 await page.getByRole('button',{name:'ESCAPE STEPS',exact:true}).click();assert.equal(await graphs.locator('.chart-win').count(),2);assert.match(await graphs.locator('.learning-chart-note').innerText(),/Successful escapes only/);
 await page.getByRole('tab',{name:'Replays',exact:true}).click();await page.getByLabel('Replay result',{exact:true}).selectOption('dead');await page.getByRole('tab',{name:'Graphs',exact:true}).click();assert.match(await graphs.locator('.learning-chart-stats').getAttribute('aria-label'),/^150 recorded/);
 await slider.focus();await slider.press('End');assert.match(await page.locator('#learning-chart-selected').innerText(),/Evaluation after 150/);
 await page.clock.install();await page.getByRole('button',{name:'PLAY SELECTED RUN',exact:true}).click();await page.clock.runFor(45000);assert.equal(await page.locator('#status-text').innerText(),'BACK ABOVE GROUND');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await graphs.scrollIntoViewIfNeeded();await graphs.screenshot({path:process.argv[4]+'/learning-graphs-mobile.png'});
 assert.ok(Number((await graphs.locator('svg').getAttribute('viewBox')).split(' ')[2])<=400);
 await page.locator('#caves button').nth(1).click();await page.waitForFunction(()=>document.querySelector('.learning-chart-note').textContent.includes('No recorded runs'));
 assert.match(await graphs.locator('.learning-chart-stats').getAttribute('aria-label'),/^0 recorded/);assert.deepEqual(errors,[]);
 console.log('[OK] Full archive statistics, distinct evaluations, graph modes, range and keyboard inspection, selected replay, filter independence, mobile layout and cave isolation.');
}finally{await browser.close();}
