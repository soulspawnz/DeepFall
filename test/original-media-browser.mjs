import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[5]??'http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 const palette=await page.evaluate(async()=>{
  const {atlas,spritesLoaded}=await import('/sprites.mjs');await spritesLoaded;
  const pixels=atlas.getContext('2d').getImageData(0,0,atlas.width,atlas.height).data;
  let invalid=0,lit=0;for(let i=0;i<pixels.length;i+=4){const g=pixels[i+1];if(g)lit++;if(pixels[i]!==Math.round(g*.32)||pixels[i+2]!==Math.round(g*.42))invalid++;}
  return {invalid,lit,width:atlas.width,height:atlas.height};
 });
 assert.equal(palette.invalid,0);assert.ok(palette.lit>10000);assert.equal(palette.width,320);
 assert.equal(await page.locator('#sid-music').isDisabled(),false);
 await page.locator('#sound').click();await page.waitForFunction(()=>document.querySelector('#sound').getAttribute('aria-pressed')==='true');
 await page.locator('#sid-demo').click();
 await page.waitForFunction(()=>document.querySelector('#sid-meter').value>.001);
 await page.waitForFunction(()=>document.querySelector('#sid-readout').innerText.includes('LAST: WIN'),null,{timeout:15000});
 await page.locator('#sid-effects').click();
 await page.waitForFunction(()=>document.querySelector('#sid-meter').value>.001);
 await page.locator('#sid-music').click();
 await page.waitForFunction(()=>document.querySelector('#sid-meter').value===0);
 await page.locator('#sid-music').click();
 await page.waitForFunction(()=>document.querySelector('#sid-meter').value>.001);
 await page.locator('#sid-effects').click();
 await page.locator('#play').click();await page.waitForTimeout(3200);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');
 await page.keyboard.press('KeyP');
 await page.screenshot({path:process.argv[4]+'/original-sprites-sid.png',fullPage:true});
 await page.locator('#sid-model').selectOption('8580');
 await page.waitForFunction(()=>document.querySelector('#sid-state').innerText.includes('8580'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({palette,audio:'original sound routines audible through real AudioWorklet, both SID models',errors}));
}finally{await browser.close();}
