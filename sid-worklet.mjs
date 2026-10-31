import { SIDEngine } from './sid-engine.mjs';

class DeepfallSID extends AudioWorkletProcessor {
  constructor() {
    super(); this.engine = new SIDEngine(sampleRate,'6581','original'); this.blocks = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'configure') this.engine.configure(data.settings);
      else if (data.type === 'effect') this.engine.trigger(data.names);
      else if (data.type === 'reset') this.engine.reset();
      else if (data.type === 'demo') this.engine.soundCheck();
    };
    this.port.postMessage({ type: 'ready', ...this.engine.stats() });
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    try {
      this.engine.render(output);
      if (++this.blocks % 150 === 0) {
        let peak = 0, square = 0;
        for (const value of output) { peak = Math.max(peak, Math.abs(value)); square += value * value; }
        this.port.postMessage({ type: 'stats', ...this.engine.stats(), peak, rms: Math.sqrt(square / output.length) });
      }
    } catch (error) {
      output.fill(0); this.port.postMessage({ type: 'error', message: error.message }); return false;
    }
    return true;
  }
}
registerProcessor('deepfall-resid', DeepfallSID);
