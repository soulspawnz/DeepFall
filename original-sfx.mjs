import { SFX_BLOCKS } from './original-sfx-data.mjs';

// Bounded interpreter for the published gameplay sound routines only.
// CIA timer entropy is replaced by a reproducible PRNG; this is not a C64 CPU.
export class OriginalSFX {
  constructor(write) { this.writeSID=write; this.reset(); }
  reset() {
    this.m=new Uint8Array(65536);
    for(const block of SFX_BLOCKS) this.m.set(block.bytes,block.start);
    this.m[0x94]=1; this.m[0x980a]=8; this.random=0x12345678; this.scene={};this.bonus=0;this.lastSecond=null;
    for(let i=0;i<25;i++)this.writeSID(i,0);
    this.writeSID(24,15);
  }
  write(a,v) { this.m[a]=v&255; if(a>=0xd400&&a<=0xd418)this.writeSID(a-0xd400,v&255); }
  call(entry,stop=-1) {
    let pc=entry,a=0,x=0,y=0,c=0,z=false,n=false;
    const stack=[],read=()=>this.m[pc++],word=()=>read()|(read()<<8);
    const flags=v=>{v&=255;z=v===0;n=!!(v&128);return v;};
    const branch=ok=>{const d=read();if(ok)pc+=(d&128)?d-256:d;};
    for(let budget=0;budget<4096;budget++) {
      if(pc===stop)return;
      const at=pc,op=read();let addr,v;
      switch(op) {
        case 0xa9:a=flags(read());break;case 0xa5:a=flags(this.m[read()]);break;
        case 0xad:a=flags(this.m[word()]);break;case 0xbd:a=flags(this.m[word()+x]);break;
        case 0xa2:x=flags(read());break;case 0xae:x=flags(this.m[word()]);break;
        case 0xac:y=flags(this.m[word()]);break;
        case 0x8d:this.write(word(),a);break;case 0x85:this.write(read(),a);break;
        case 0x9d:this.write(word()+x,a);break;case 0x8e:this.write(word(),x);break;case 0x8c:this.write(word(),y);break;
        case 0x20:addr=word();if(addr===0x6ad0){this.random^=this.random<<13;this.random^=this.random>>>17;this.random^=this.random<<5;a=flags(this.random&255);}else{stack.push(pc);pc=addr;}break;
        case 0x60:if(!stack.length)return;pc=stack.pop();break;
        case 0x4c:pc=word();break;
        case 0xf0:branch(z);break;case 0xd0:branch(!z);break;case 0x10:branch(!n);break;case 0x90:branch(!c);break;case 0xb0:branch(c);break;
        case 0xca:x=flags(x-1);break;case 0xe8:x=flags(x+1);break;
        case 0xce:addr=word();this.write(addr,flags(this.m[addr]-1));break;
        case 0xc6:addr=read();this.write(addr,flags(this.m[addr]-1));break;
        case 0xee:addr=word();this.write(addr,flags(this.m[addr]+1));break;
        case 0x29:a=flags(a&read());break;case 0x2d:a=flags(a&this.m[word()]);break;
        case 0xc9:v=read();c=+(a>=v);flags(a-v);break;case 0xe0:v=read();c=+(x>=v);flags(x-v);break;
        case 0x4e:addr=word();c=this.m[addr]&1;this.write(addr,flags(this.m[addr]>>>1));break;
        case 0x4a:c=a&1;a=flags(a>>>1);break;case 0x0a:c=a>>>7;a=flags(a<<1);break;
        case 0x18:c=0;break;case 0x38:c=1;break;
        case 0x09:a=flags(a|read());break;
        case 0xe5:v=a-this.m[read()]-(1-c);c=+(v>=0);a=flags(v);break;
        case 0x69:v=a+read()+c;c=+(v>255);a=flags(v);break;
        default:throw new Error(`Original SFX opcode ${op.toString(16)} at ${at.toString(16)}`);
      }
    }
    throw new Error('Original SFX instruction budget exceeded');
  }
  trigger(name) {
    if(name==='gem') {this.m[0x980d]++;this.m.copyWithin(0x987d,0x718a,0x7191);}
    else if(['push','land','rockLand','rockFall'].includes(name))this.call(0x6e56);
    else if(['diamondLand','diamondFall'].includes(name))this.call(0x6e28);
    else if(['blast','death'].includes(name))this.call(0x6d91);
    else if(['unlock','birth','rewind'].includes(name))this.call(0x7087);
    else if(name==='dig'||name==='step')this.m[0x9808]=name==='dig'?0xa5:0x35;
    else if(name==='win'){this.bonus=207;this.bonusStep=0;}
  }
  tick() {
    if(this.bonus||this.scene.active===false)return;
    this.m[0x43]=this.scene.amoeba?1:0;this.m[0x8d]=this.scene.magic?1:0;this.m[0xc2]++;
    this.call(0x7971);
    if(this.scene.magic&&!(this.m[0xc2]&1))this.call(0x7aa1,0x7ac2);
    const second=Math.ceil(this.scene.remaining??100);
    if(second<10&&second>0&&second!==this.lastSecond){this.m[0xad]=second;this.call(0x709d);}
    this.lastSecond=second;
  }
  subtick() {
    if(!this.bonus)return;
    this.write(18,0x10);this.write(15,(this.bonus-2*(15-this.bonusStep))&255);
    this.write(20,0xa0);this.write(19,0);this.write(18,0x11);
    if(++this.bonusStep===15){this.bonusStep=0;this.write(18,0x10);if(--this.bonus<Math.max(1,208-(this.scene.remaining??0)))this.bonus=0;}
  }
}
