import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const html=await readFile(new URL('../../../_temp/deepfall/original-reference/disassembly.html',import.meta.url),'utf8');
const sourceHash=createHash('sha256').update(html).digest('hex');
const expected='76aa7779e9b10cb4764a1de4e6e956f07a95cac9634b923a8b0caf4613d3a387';
if(sourceHash!==expected)throw new Error('Disassembly source changed');
const plain=html.replace(/<[^>]*>/g,'');
const memory=new Map();
for(const line of plain.split(/\r?\n/)){
 const match=line.match(/^([\da-f]{4})\s+((?:[\da-f]{2}(?:[ \t]+|$))+)/i);if(!match)continue;
 let address=parseInt(match[1],16);
 for(const byte of match[2].trim().split(/\s+/))memory.set(address++,parseInt(byte,16));
}
const ranges=[[0x7971,0x7a85],[0x7aa1,0x7ac1],[0x7cdf,0x7cf3],[0x6e28,0x6e64],[0x7080,0x708b],[0x718a,0x7190],[0x709d,0x70c4],[0x6d91,0x6dab]];
const blocks=ranges.map(([start,end])=>({start,bytes:Array.from({length:end-start+1},(_,offset)=>{
 const value=memory.get(start+offset);if(value===undefined)throw new Error(`Missing byte ${(start+offset).toString(16)}`);return value;
})}));
await writeFile(new URL('../original-sfx-data.mjs',import.meta.url),`// Original C64 gameplay sound routines only; title music is not included.\n// Source: Retrointernals annotated disassembly, SHA-256 ${sourceHash}.\nexport const SFX_BLOCKS = ${JSON.stringify(blocks)};\n`);
await writeFile(new URL('../docs/original-sfx-provenance.json',import.meta.url),JSON.stringify({source:'https://www.retrointernals.org/boulder-dash/boulder-dash-disassembly.html',sha256:sourceHash,ranges:ranges.map(([from,to])=>({from:from.toString(16),to:to.toString(16)})),tables:{boulder:[0x32,0x09,0x07,0,0x81,0,0xf0],diamond:[0x78,0x14,0x07,0,0x11,0,0xf0],explosion:[0x32,0x14,0x0f,0,0x81,0x1b,0],crack:[0x32,0x2f,0,0,0x81,0x19,1]}},null,2)+'\n');
console.log('[OK] Original gameplay SFX machine-code blocks extracted and pinned.');
