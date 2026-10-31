import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 await page.locator('#watch-tests').click();
 assert.ok(await page.getByText('Replay unavailable: inputs were not recorded.',{exact:true}).count()===2);
 for(const image of await page.locator('.playtest-card img').all())assert.ok(await image.evaluate(e=>e.complete&&e.naturalWidth>0));
 await page.getByRole('button',{name:'WATCH AUTOMATED ARCHIVE',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#watch-tests').textContent.includes('1/300'));
 await page.clock.runFor(10000);
 await page.screenshot({path:process.argv[4]+'/original-live-replay.png',fullPage:true});
 await page.clock.runFor(12000);
 assert.equal(await page.locator('#status-text').innerText(),'BACK ABOVE GROUND');
 await page.clock.runFor(3000);
 assert.match(await page.locator('#watch-tests').innerText(),/2\/300/);
 await page.locator('#watch-tests').click();assert.equal(await page.locator('#watch-tests').innerText(),'WATCH PLAYTESTS');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('[OK] Visible replay completes Cave A, advances to attempt two, stops, and fits mobile.');
}finally{await browser.close();}
