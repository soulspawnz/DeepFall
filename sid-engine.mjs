import { OriginalSFX } from './original-sfx.mjs';
import { jsSID } from './vendor/jssid/resid.mjs';

export const PAL_CLOCK = 985248;
export const SID_FRAME_HZ = 50;
export const EFFECTS = Object.freeze({
  dig: { priority: 1, wave: 0x80, hz: [650, 320, 150], ad: 0x02, sr: 0x02 },
  push: { priority: 2, wave: 0x10, hz: [145, 110, 76, 48], ad: 0x03, sr: 0x04 },
  land: { priority: 2, wave: 0x80, hz: [950, 420, 180, 90], ad: 0x03, sr: 0x04 },
  gem: { priority: 4, wave: 0x40, hz: [1046, 1318, 1568, 2093, 2637, 2093], ad: 0x02, sr: 0x63, pw: 0x480 },
  rewind: { priority: 5, wave: 0x20, hz: [1568, 1397, 1175, 988, 784, 659, 523, 392, 294, 196], ad: 0x03, sr: 0x75 },
  unlock: { priority: 6, wave: 0x40, hz: [659, 659, 784, 784, 988, 988, 1318, 1318, 1568, 1568], ad: 0x02, sr: 0x85, pw: 0x600 },
  win: { priority: 7, wave: 0x40, hz: [659, 659, 784, 784, 988, 988, 1318, 1318, 988, 988, 1318, 1318, 1568, 1568, 1976, 1976, 1976, 1976], ad: 0x02, sr: 0xa6, pw: 0x600 },
  blast: { priority: 8, wave: 0x80, hz: [3500, 3000, 2400, 1900, 1400, 1000, 720, 480, 300, 180, 90, 45], ad: 0x05, sr: 0x97 },
  death: { priority: 9, wave: 0x20, hz: [988, 932, 880, 830, 784, 740, 698, 659, 587, 523, 440, 392, 330, 262, 196, 131], ad: 0x04, sr: 0x97 },
});

// Original 8-bar E-minor score. One monophonic line per SID voice.
const ROOTS = [40, 40, 36, 38, 40, 43, 36, 38];
const MELODY = [
  [76, 0, 0, 0, 79, 0, 78, 0, 74, 0, 0, 0, 71, 0, 74, 0],
  [76, 0, 0, 0, 83, 0, 81, 0, 79, 0, 78, 0, 76, 0, 0, 0],
  [72, 0, 0, 0, 76, 0, 79, 0, 83, 0, 81, 0, 79, 0, 76, 0],
  [74, 0, 0, 0, 78, 0, 81, 0, 79, 0, 78, 0, 74, 0, 0, 0],
  [76, 0, 79, 0, 83, 0, 0, 0, 81, 0, 79, 0, 78, 0, 74, 0],
  [79, 0, 0, 0, 83, 0, 86, 0, 83, 0, 81, 0, 79, 0, 0, 0],
  [76, 0, 0, 0, 79, 0, 83, 0, 81, 0, 79, 0, 76, 0, 72, 0],
  [74, 0, 78, 0, 81, 0, 78, 0, 74, 0, 71, 0, 75, 0, 0, 0],
];
const noteHz = note => 440 * 2 ** ((note - 69) / 12);

export class SIDEngine {
  constructor(rate = 48000, model = '6581', profile = 'deepfall') {
    this.profile=profile; this.rate = rate;
    this.model = model;
    this.master = 0.35;
    this.music = true;
    this.effects = true;
    this.paused = false;
    this.samples = 0;
    this.frame = 0;
    this.nextFrame = 0;
    this.clockFrames = 0;
    this.registerWrites = 0;
    this.effectCount = 0;
    this.lastEffect = 'none';
    this.effect = null;
    this.gates = [0, 0, 0];
    this.demoFrame = null;
    this.setModel(model);
  }
  setModel(model) {
    if (!['6581', '8580'].includes(model)) return;
    this.model = model;
    this.sid = new jsSID.ReSID({ clock: PAL_CLOCK, model: model === '6581' ? 0 : 1, sampleRate: this.rate, method: jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE });
    this.sid.reset(); this.effect = null; this.gates = [0, 0, 0];
    this.originalSFX=new OriginalSFX((r,v)=>this.write(r,v));
    if(this.profile==='original')return;
    this.write(0x15, 0); this.write(0x16, 155);
    this.write(0x17, 0x53); // moderate resonance; voices 1 and 2 through the shared filter
    this.write(0x18, 0x1f); // low-pass + full hardware master volume
  }
  write(register, value) { this.sid.write(register, value & 255); this.registerWrites++; }
  frequency(voice, hz) {
    const word = Math.min(65535, Math.max(0, Math.round(hz * 16777216 / PAL_CLOCK)));
    this.write(voice * 7, word & 255); this.write(voice * 7 + 1, word >> 8);
  }
  pulse(voice, width) { this.write(voice * 7 + 2, width & 255); this.write(voice * 7 + 3, (width >> 8) & 15); }
  gate(voice, waveform) { this.gates[voice] = waveform; this.write(voice * 7 + 4, waveform); }
  instrument(voice, wave, hz, ad, sr, width = 0x800) {
    this.gate(voice, wave); // gate low first; PAL update later supplies the rising edge
    this.frequency(voice, hz); this.pulse(voice, width);
    this.write(voice * 7 + 5, ad); this.write(voice * 7 + 6, sr);
  }
  configure(settings) {
    if(settings.effects===false&&this.profile==='original')for(let i=0;i<3;i++)this.gate(i,0);
    if(settings.profile&&this.profile!==settings.profile){this.profile=settings.profile;this.setModel(this.model);}
    if(settings.scene)this.originalSFX.scene=settings.scene;
    if (typeof settings.music === 'boolean' && this.music !== settings.music) {
      this.music = settings.music;
      if (!this.music) { this.gate(0, 0); this.gate(1, 0); if (!this.effect) this.gate(2, 0); }
    }
    if (typeof settings.effects === 'boolean') { this.effects = settings.effects; if (!this.effects && this.effect) { this.effect = null; this.gate(2, 0); } }
    if (Number.isFinite(settings.master)) this.master = Math.min(.6, Math.max(0, settings.master));
    if (typeof settings.paused === 'boolean') this.paused = settings.paused;
    if (settings.model && settings.model !== this.model) this.setModel(settings.model);
  }
  reset() { if(this.profile==='original')this.originalSFX.reset(); this.frame = 0; this.effect = null; this.demoFrame = null; for (let i = 0; i < 3; i++) this.gate(i, 0); }
  trigger(names) {
    if (!this.effects) return;
    if(this.profile==='original'){for(const name of names){this.originalSFX.trigger(name);this.effectCount++;this.lastEffect=name;}return;}
    const name = [...new Set(names)].filter(name => EFFECTS[name]).sort((a, b) => EFFECTS[b].priority - EFFECTS[a].priority)[0];
    if (!name || (this.effect && this.effect.patch.priority > EFFECTS[name].priority)) return;
    this.effect = { name, patch: EFFECTS[name], age: 0 };
    this.effectCount++; this.lastEffect = name;
    const p = EFFECTS[name]; this.instrument(2, p.wave, p.hz[0], p.ad, p.sr, p.pw);
  }
  soundCheck() { this.demoFrame = this.frame; }
  clockFrame() {
    if (this.demoFrame !== null) {
      const elapsed = this.frame - this.demoFrame;
      const showcase = ['gem', 'dig', 'land', 'push', 'unlock', 'rewind', 'blast', 'death', 'win'];
      if (elapsed % 50 === 0 && elapsed / 50 < showcase.length) this.trigger([showcase[elapsed / 50]]);
      if (elapsed >= showcase.length * 50) this.demoFrame = null;
    }
    if(this.profile==='original'){if(this.effects)this.originalSFX.tick();this.frame++;return;}
    const step = Math.floor(this.frame / 6), sub = this.frame % 6;
    const bar = Math.floor(step / 16) % 8, beat = step % 16, root = ROOTS[bar];
    if (this.music) {
      const lead = MELODY[bar][beat];
      if (sub === 0 && lead) this.instrument(0, 0x40, noteHz(lead), 0x13, 0x85, 0x650);
      if (sub === 1 && lead) this.gate(0, 0x41);
      this.pulse(0, 0x780 + Math.round(0x340 * Math.sin(this.frame / 31)));
      if (sub === 0 && beat % 2 === 0) this.instrument(1, 0x20, noteHz(root + (beat % 8 === 6 ? 12 : 0)), 0x02, 0x73);
      if (sub === 1 && beat % 2 === 0) this.gate(1, 0x21);
      if (sub === 4 && beat % 2 === 0) this.gate(1, 0x20);
      // Tracker-style fast chord arpeggio and noise percussion share voice 3.
      if (!this.effect) {
        const chord = [0, bar === 2 || bar === 5 || bar === 6 ? 4 : 3, 7];
        const percussion = beat % 8 === 4 && sub < 2;
        if (percussion) {
          this.frequency(2, 1400); this.write(19, 0x00); this.write(20, 0x02); this.gate(2, 0x81);
        } else {
          this.frequency(2, noteHz(root + 24 + chord[this.frame % 3]));
          this.write(19, 0x02); this.write(20, 0x43); this.gate(2, 0x11);
        }
      }
    }
    if (this.effect) {
      const effect = this.effect, p = effect.patch;
      if (effect.age === 1) this.gate(2, p.wave | 1);
      this.frequency(2, p.hz[Math.min(effect.age, p.hz.length - 1)]);
      if (effect.age === p.hz.length) this.gate(2, p.wave);
      if (++effect.age > p.hz.length + 7) { this.effect = null; this.gate(2, 0); }
    } else if (!this.music) this.gate(2, 0);
    // A slow cutoff movement goes through reSID's model-specific filter curve.
    this.write(0x16, 145 + Math.round(18 * Math.sin(this.frame / 95)));
    this.frame++;
  }
  render(buffer) {
    buffer.fill(0);
    if (this.paused) return;
    let offset = 0;
    while (offset < buffer.length) {
      if (this.samples >= this.nextFrame) {
        if(this.clockFrames%20===0)this.clockFrame();
        if(this.profile==='original'&&this.effects)this.originalSFX.subtick();
        this.nextFrame = Math.round(++this.clockFrames * this.rate / 1000);
      }
      const count = Math.min(buffer.length - offset, this.nextFrame - this.samples);
      const cycles = Math.floor((this.sid.sample_offset + count * this.sid.cycles_per_sample) / 65536);
      const written = this.sid.clock(cycles, buffer, count, 1, offset);
      if (written !== count) throw new Error(`SID sample accounting: ${written}/${count}`);
      this.samples += count; offset += count;
    }
    for (let i = 0; i < buffer.length; i++) buffer[i] *= this.master;
  }
  stats() { return { model: this.model, clock: PAL_CLOCK, frame: this.frame, samples: this.samples, writes: this.registerWrites, effects: this.effectCount, lastEffect: this.lastEffect, voices: 3 }; }
}
