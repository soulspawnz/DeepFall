import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OriginalSFX} from '../original-sfx.mjs';
import {SIDEngine} from '../sid-engine.mjs';
test('original driver executes all effects and ambient paths within its code bounds',()=>{
 const writes=[],s=new OriginalSFX((r,v)=>writes.push([r,v]));
 for(const name of ['gem','dig','step','land','diamondFall','push','unlock','blast','death','win']) {
  s.trigger(name);for(let i=0;i<100;i++){s.tick();for(let j=0;j<20;j++)s.subtick();}
 }
 for(const scene of [{amoeba:true},{magic:true},{remaining:9},{remaining:1}]) {s.scene=scene;for(let i=0;i<60;i++)s.tick();}
 assert.ok(writes.length>1000);assert.ok(writes.every(([r,v])=>r>=0&&r<=24&&v>=0&&v<=255));
});
test('original boulder table reaches SID voice one unchanged',()=>{
 const writes=[],s=new OriginalSFX((r,v)=>writes.push([r,v]));s.trigger('land');s.tick();
 for(const [r,v] of [[0,0x32],[1,9],[2,7],[3,0],[4,0x81],[5,0],[6,0xf0]])assert.ok(writes.some(([a,b])=>a===r&&b===v));
});
test('original sound renders finite non-silent reSID audio',()=>{
 const s=new SIDEngine(48000,'6581','original');s.trigger(['gem']);const out=new Float32Array(48000);s.render(out);
 assert.ok(out.every(Number.isFinite));assert.ok(out.some(x=>Math.abs(x)>.001));assert.equal(s.frame,50);
});
