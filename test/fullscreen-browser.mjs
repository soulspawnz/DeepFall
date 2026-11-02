import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.argv.includes('--local-ui'))for(const file of ['fullscreen.mjs','fullscreen.css'])await page.route(new URL(file,process.argv[5]??'http://127.0.0.1:8767/').href,route=>route.fulfill({path:new URL('../'+file,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),contentType:file.endsWith('.css')?'text/css':'text/javascript'}));
 await page.goto(process.argv[5]??'http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 await page.locator('#fullscreen').click();
 await page.waitForFunction(()=>document.querySelector('#fullscreen').getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>document.fullscreenElement?.classList.contains('cabinet')),true);
 const box=await page.locator('.screen-wrap').boundingBox();assert.ok(Math.abs(box.width/box.height-4/3)<.01);
 await page.locator('#play').click();await page.waitForTimeout(2800);
 await page.screenshot({path:process.argv[4]+'/fullscreen-4x3.png'});
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>!document.fullscreenElement);
 assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'),'false');
 // Exercise the viewport fallback used where the browser lacks native fullscreen.
 await page.evaluate(()=>{document.querySelector('.cabinet').requestFullscreen=undefined;});
 await page.setViewportSize({width:390,height:844});await page.locator('#fullscreen').click();
 assert.equal(await page.locator('.cabinet').evaluate(e=>e.classList.contains('fullscreen-active')),true);
 const mobile=await page.locator('.screen-wrap').boundingBox();assert.ok(Math.abs(mobile.width/mobile.height-4/3)<.01);
 assert.equal(await page.locator('.cabinet .touch-controls').count(),1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.keyboard.press('Escape');assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('.cabinet .touch-controls').count(),1);
 assert.deepEqual(errors,[]);console.log('[OK] Native 4:3 fullscreen, F exit, mobile fallback, touch controls and Escape exit.');
}finally{await browser.close();}
