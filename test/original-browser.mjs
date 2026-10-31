import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { decodeOriginal } from '../original-caves.mjs';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#classic-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.cave-button').count(),20);
 for(let difficulty=1;difficulty<=5;difficulty++) {
  await page.locator('#difficulty').selectOption(String(difficulty));
  for(let i=0;i<20;i++) {
   const cave=decodeOriginal(i,difficulty);
   await page.locator('.cave-button').nth(i).click();
   assert.equal(await page.locator('#target').innerText(),String(cave.target));
   assert.equal(await page.locator('#cave-name').innerText(),cave.name.toUpperCase());
   assert.equal(await page.locator('#game').getAttribute('width'),cave.bonus?'320':'640');
   const seconds=cave.time;
   assert.equal(await page.locator('#timer').innerText(),`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);
  }
 }
 await page.locator('#difficulty').selectOption('1');
 await page.locator('.cave-button').nth(0).click();
 await page.screenshot({path:process.argv[4]+'/original-intro.png',fullPage:true});
 await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#status-text').textContent==='EXPEDITION IN PROGRESS');
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(130);await page.keyboard.up('ArrowUp');
 await page.keyboard.press('KeyP');
 assert.equal(await page.locator('#overlay').isVisible(),true);
 await page.locator('.cave-button').nth(4).click();
 await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#status-text').textContent==='BONUS ATTEMPT OVER',null,{timeout:20000});
 assert.match(await page.locator('#play').innerText(),/CONTINUE/);
 await page.locator('#play').click();
 assert.equal(await page.locator('#cave-name').innerText(),'GUARDS');
 await page.locator('.cave-button').nth(7).click();
 await page.screenshot({path:process.argv[4]+'/original-amoeba.png',fullPage:true});
 await page.locator('.cave-button').nth(8).click();
 await page.screenshot({path:process.argv[4]+'/original-magic-wall.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:process.argv[4]+'/original-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#campaign').selectOption('deepfall');
 assert.equal(await page.locator('.cave-button').count(),3);
 assert.equal(await page.locator('#difficulty').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('[OK] Original campaign: all 100 UI variants, birth/pause, bonus-failure continuation, mobile layout, and prototype campaign retained.');
} finally {await browser.close();}
