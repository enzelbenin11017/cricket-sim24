// Web Audio API Synthesizer for Cricket Stadium Sounds
class CricketAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdOscs: OscillatorNode[] = [];
  private crowdFilters: BiquadFilterNode[] = [];
  private isCrowdPlaying = false;

  constructor() {
    // Initialized lazily upon user interaction
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Setup crowd noise
      this.setupCrowdAmbient();
    } catch (e) {
      console.warn("Audio Context failed to initialize", e);
    }
  }

  private setupCrowdAmbient() {
    if (!this.ctx || !this.masterGain) return;

    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // Soft background hum
    this.crowdGain.connect(this.masterGain);

    // Create a multi-oscillator pink-noise like drone for crowd stadium atmosphere
    const frequencies = [80, 150, 220, 310, 440, 600, 850];
    frequencies.forEach((freq, idx) => {
      if (!this.ctx || !this.crowdGain) return;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const oscGain = this.ctx.createGain();

      // Slightly detune them to avoid phase locking
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq + Math.random() * 5, this.ctx.currentTime);

      // Lowpass filter to muffle individual tones into a ambient roar
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140 + Math.random() * 40, this.ctx.currentTime);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);

      // Gain modulation for dynamic crowd waves
      oscGain.gain.setValueAtTime(0.02 + Math.random() * 0.02, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.crowdGain);

      this.crowdOscs.push(osc);
      this.crowdFilters.push(filter);
    });
  }

  startAmbient() {
    this.init();
    if (!this.ctx || this.isCrowdPlaying) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      this.crowdOscs.forEach(osc => osc.start());
      this.isCrowdPlaying = true;
      this.simulateCrowdLiveliness();
    } catch (e) {
      // already started
    }
  }

  // Periodic wave of crowd sound
  private simulateCrowdLiveliness() {
    if (!this.ctx || !this.crowdGain || !this.isCrowdPlaying) return;

    const now = this.ctx.currentTime;
    const baseLevel = 0.06;
    const variation = 0.04 * Math.sin(now / 4) + 0.02 * Math.cos(now / 11);
    
    this.crowdGain.gain.setTargetAtTime(Math.max(0.02, baseLevel + variation), now, 2);

    // Schedule next fluctuation
    setTimeout(() => this.simulateCrowdLiveliness(), 2000);
  }

  // A crisp wooden sound for bat hitting ball
  playBatHit(strength: number = 0.8) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    
    // Core transient: short high pitch decay
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(5, now);

    // Envelope
    gainNode.gain.setValueAtTime(strength * 0.7, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start();
    osc.stop(now + 0.15);

    // High frequency crisp component (tick)
    const tickOsc = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    
    tickOsc.type = 'sine';
    tickOsc.frequency.setValueAtTime(2200, now);
    tickOsc.frequency.exponentialRampToValueAtTime(1000, now + 0.02);

    tickGain.gain.setValueAtTime(strength * 0.4, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    tickOsc.connect(tickGain);
    tickGain.connect(this.masterGain);

    tickOsc.start();
    tickOsc.stop(now + 0.04);
  }

  // High-paced swoosh of delivery release
  playSwoosh() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
    filter.Q.setValueAtTime(10, now);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start();
    osc.stop(now + 0.25);
  }

  // Wooden crash when ball bowls the stumps
  playStumpCrash() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // We combine multiple descending low-frequency tones to sound like heavy wooden stumps falling
    const frequencies = [120, 180, 240, 80];
    frequencies.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.01);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25 + i * 0.05);

      gain.gain.setValueAtTime(0.4, now + i * 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(now + 0.5);
    });

    // Add some noise splash for the plastic bails flying
    const bufferSize = this.ctx.sampleRate * 0.3; // 300ms
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1500, now);
    noiseFilter.Q.setValueAtTime(4, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start();
    noise.stop(now + 0.3);
  }

  // Generates massive crowd roar when hitting a boundary
  playBoundaryCheer() {
    this.init();
    if (!this.ctx || !this.masterGain || !this.crowdGain) return;

    const now = this.ctx.currentTime;

    // Elevate crowd gain dramatically
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
    this.crowdGain.gain.linearRampToValueAtTime(0.65, now + 0.5); // Giant roar
    this.crowdGain.gain.exponentialRampToValueAtTime(0.25, now + 3.0); // Maintain excitement
    this.crowdGain.gain.exponentialRampToValueAtTime(0.08, now + 6.0); // Settles back

    // Create a high-pitched applause-like component
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800 + i * 200, now);
      
      // Muffle to sound like distant roaring crowd clapping
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.Q.setValueAtTime(3, now);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 3.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(now + 4.0);
    }
  }

  // Generates low mumbles of sigh and disappointment when wicket falls
  playWicketSigh() {
    this.init();
    if (!this.ctx || !this.masterGain || !this.crowdGain) return;

    const now = this.ctx.currentTime;

    // Drop ambient crowd momentarily
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
    this.crowdGain.gain.linearRampToValueAtTime(0.02, now + 0.2); // Quiet gasp

    // Create a low frequency deep noise wash representing "Ooooh!"
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(65, now + 1.2); // Descending groan

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.Q.setValueAtTime(5, now);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(now + 2.0);

    // Recover crowd slowly to general chatter
    this.crowdGain.gain.setValueAtTime(0.02, now + 2.0);
    this.crowdGain.gain.exponentialRampToValueAtTime(0.08, now + 4.5);
  }
}

export const audioEngine = new CricketAudioEngine();
