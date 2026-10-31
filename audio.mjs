export class SIDAudio {
  constructor(onUpdate) {
    this.onUpdate = onUpdate; this.enabled = false; this.initializing = null;
    this.settings = { model: '6581', master: .35, profile: 'original', music: true, effects: true, paused: false };
  }
  async enable() {
    if (this.initializing) return this.initializing;
    this.initializing = this.open();
    try { await this.initializing; } finally { this.initializing = null; }
  }
  async open() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is unavailable');
    if (!this.context) {
      this.context = new Audio({ latencyHint: 'interactive' });
      this.outputGain = this.context.createGain();this.outputGain.gain.value=0;this.outputTarget=0;
      this.outputGain.connect(this.context.destination);
    }
    // Resume in the user's click handler, before asynchronous module loading.
    await this.context.resume();
    if (!this.node) {
      try {
        await this.context.audioWorklet.addModule(new URL('./sid-worklet.mjs', import.meta.url));
        this.node = new AudioWorkletNode(this.context, 'deepfall-resid', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        this.node.port.onmessage = ({ data }) => {
          this.stats = data;
          if (data.type === 'error') { this.disable(); this.onUpdate({ error: data.message }); }
          else this.onUpdate(data);
        };
        this.node.onprocessorerror = () => { this.disable(); this.onUpdate({ error: 'Audio processor stopped. Reload to retry.' }); };
        this.node.connect(this.outputGain);
      } catch (error) { await this.context.suspend(); throw error; }
    }
    this.enabled = true; this.configure(this.settings);
  }
  muteOutput(immediate=false) {
    if(!this.outputGain)return;
    const target=this.enabled&&(!this.settings.paused||(this.settings.music&&this.settings.mood==='pause'))?1:0;
    if(target===this.outputTarget&&!immediate)return;
    this.outputTarget=target;const gain=this.outputGain.gain,now=this.context.currentTime;
    gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);
    if(immediate)gain.setValueAtTime(target,now);else gain.linearRampToValueAtTime(target,now+.005);
  }
  disable() { this.enabled = false; this.muteOutput(true);this.context?.suspend().catch(()=>{}); }
  configure(settings) {
    Object.assign(this.settings, settings);
    // This native output gate does not wait for a worklet message to silence
    // a paused cave, even if an SID envelope is currently held open.
    this.muteOutput();
    this.node?.port.postMessage({ type: 'configure', settings: this.settings });
  }
  effects(names) { if (this.enabled) this.node.port.postMessage({ type: 'effect', names }); }
  reset() { this.node?.port.postMessage({ type: 'reset' }); }
  demo() { if (this.enabled) this.node.port.postMessage({ type: 'demo' }); }
}
