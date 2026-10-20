/* Neon Cortex — fully synthesized WebAudio sound effects and procedural synthwave soundtrack. */
(function (NC) {
  'use strict';

  const THROTTLE = {
    pulse: 0.05, scatter: 0.07, rail: 0.04, die: 0.035, emp: 0.07, jump: 0.12, disable: 0.25,
    coin: 0.1, freeze: 0.1, exec: 0.08, leak: 0.08, trap: 0.1, error: 0.12
  };
  const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am  F  C  G
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  const Audio = {
    ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null,
    musicVol: 0.5, sfxVol: 0.7, muted: false,
    last: {}, musicOn: false, intensity: 0, step: 0, nextTime: 0, timer: null, bpm: 108,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
      this.applyVolumes();
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      if (this.wantMusic) this.startMusic();
    },

    setVolumes(music, sfx) { this.musicVol = music; this.sfxVol = sfx; this.applyVolumes(); },
    applyVolumes() {
      if (!this.ctx) return;
      this.musicBus.gain.value = this.musicVol * 0.55;
      this.sfxBus.gain.value = this.sfxVol;
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    },

    tone(freq, dur, o) {
      o = o || {};
      const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
      if (o.detune) osc.detune.value = o.detune;
      const vol = o.vol || 0.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.filter) {
        const f = ctx.createBiquadFilter();
        f.type = o.filterType || 'lowpass';
        f.frequency.value = o.filter;
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(t); osc.stop(t + dur + 0.02);
    },

    noise(dur, o) {
      o = o || {};
      const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = o.type || 'lowpass';
      f.frequency.setValueAtTime(o.freq || 2000, t);
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      f.Q.value = o.q || 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(o.vol || 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    },

    play(name) {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const th = THROTTLE[name];
      if (th) {
        if (this.last[name] && now - this.last[name] < th) return;
        this.last[name] = now;
      }
      switch (name) {
        case 'pulse': this.tone(980, 0.06, { type: 'square', slide: 520, vol: 0.022, filter: 3000 }); break;
        case 'scatter': this.noise(0.09, { type: 'bandpass', freq: 2400, vol: 0.09 }); this.tone(260, 0.08, { type: 'square', slide: 120, vol: 0.03, filter: 1500 }); break;
        case 'rail':
          this.tone(1800, 0.32, { type: 'sawtooth', slide: 70, vol: 0.07, filter: 5000 });
          this.noise(0.25, { type: 'highpass', freq: 3000, sweep: 400, vol: 0.06 });
          break;
        case 'freeze': this.tone(1800, 0.35, { type: 'sine', slide: 2600, vol: 0.05 }); this.tone(1200, 0.3, { type: 'triangle', slide: 900, vol: 0.04, delay: 0.03 }); this.noise(0.3, { type: 'highpass', freq: 6000, vol: 0.04 }); break;
        case 'die': this.noise(0.12, { freq: 1600, sweep: 300, vol: 0.06 }); this.tone(240, 0.1, { slide: 60, vol: 0.04 }); break;
        case 'bigdie': this.noise(0.7, { freq: 900, sweep: 80, vol: 0.25 }); this.tone(130, 0.7, { slide: 28, vol: 0.2 }); break;
        case 'emp': this.tone(420, 0.14, { type: 'sine', slide: 60, vol: 0.035 }); break;
        case 'exec': this.tone(160, 0.2, { type: 'sawtooth', slide: 50, vol: 0.06, filter: 1200 }); this.noise(0.15, { type: 'bandpass', freq: 800, vol: 0.06 }); break;
        case 'leak':
          this.tone(110, 0.32, { type: 'square', vol: 0.09, filter: 900 });
          this.tone(104, 0.32, { type: 'square', vol: 0.07, filter: 900 });
          this.noise(0.2, { type: 'bandpass', freq: 500, vol: 0.08 });
          break;
        case 'place': this.tone(520, 0.08, { type: 'triangle', vol: 0.08 }); this.tone(780, 0.12, { type: 'triangle', vol: 0.08, delay: 0.06 }); break;
        case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.035, filter: 3500, delay: i * 0.05 })); break;
        case 'sell': [784, 587, 392].forEach((f, i) => this.tone(f, 0.1, { type: 'triangle', vol: 0.06, delay: i * 0.05 })); break;
        case 'error': this.tone(150, 0.09, { type: 'square', vol: 0.05, filter: 800 }); this.tone(130, 0.1, { type: 'square', vol: 0.05, filter: 800, delay: 0.1 }); break;
        case 'click': this.tone(1400, 0.035, { type: 'sine', vol: 0.035 }); break;
        case 'hover': this.tone(2200, 0.02, { type: 'sine', vol: 0.012 }); break;
        case 'wave':
          this.tone(180, 0.7, { type: 'sawtooth', slide: 820, vol: 0.06, filter: 1800 });
          this.tone(90, 0.6, { type: 'square', vol: 0.04, filter: 400 });
          break;
        case 'boss':
          for (let i = 0; i < 4; i++) {
            this.tone(i % 2 ? 420 : 620, 0.22, { type: 'square', vol: 0.06, filter: 2000, delay: i * 0.24 });
          }
          this.tone(55, 1.2, { type: 'sawtooth', vol: 0.1, filter: 300 });
          break;
        case 'disable': this.tone(240, 0.18, { type: 'square', slide: 90, vol: 0.035, filter: 1400 }); break;
        case 'coin': this.tone(1320, 0.08, { type: 'square', vol: 0.03, filter: 4000 }); this.tone(1760, 0.14, { type: 'square', vol: 0.03, filter: 4000, delay: 0.07 }); break;
        case 'jump': this.tone(300, 0.14, { type: 'sine', slide: 1100, vol: 0.025 }); break;
        case 'trap': this.tone(2200, 0.3, { type: 'triangle', slide: 700, vol: 0.05 }); break;
        case 'killswitch':
          this.tone(2400, 0.6, { type: 'sawtooth', slide: 200, vol: 0.06, filter: 6000 });
          this.noise(1.6, { freq: 2500, sweep: 60, vol: 0.4, delay: 0.25 });
          this.tone(80, 1.6, { slide: 22, vol: 0.3, delay: 0.25 });
          break;
        case 'restore':
          this.tone(1600, 1.8, { type: 'sawtooth', slide: 90, vol: 0.06, filter: 2400 });
          this.tone(800, 1.8, { type: 'square', slide: 45, vol: 0.03, filter: 1200 });
          break;
        case 'victory': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, { type: 'square', vol: 0.04, filter: 3000, delay: i * 0.11 })); break;
        case 'defeat': [392, 330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.45, { type: 'sawtooth', vol: 0.05, filter: 1200, delay: i * 0.16 })); break;
        case 'unlock': [440, 660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.06, delay: i * 0.07 })); this.noise(0.4, { type: 'highpass', freq: 5000, vol: 0.03 }); break;
      }
    },

    // ------------------------------------------------------------ music
    startMusic() {
      this.wantMusic = true;
      if (!this.ctx || this.musicOn) return;
      this.musicOn = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 30);
    },
    stopMusic() {
      this.wantMusic = false;
      this.musicOn = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    },
    setIntensity(i) { this.intensity = i; },

    schedule() {
      if (!this.ctx || this.ctx.state !== 'running') { if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1; return; }
      const spb = 60 / this.bpm / 4;
      while (this.nextTime < this.ctx.currentTime + 0.15) {
        this.playStep(this.step, this.nextTime, spb);
        this.nextTime += spb;
        this.step = (this.step + 1) % 64;
      }
    },

    mnote(freq, t, dur, type, vol, cutoff) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.3), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(f); f.connect(g); g.connect(this.musicBus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },

    playStep(s, t, spb) {
      const ctx = this.ctx;
      const chord = CHORDS[Math.floor(s / 16) % 4];
      const hi = this.intensity >= 1;
      if (s % 2 === 0) {
        const oct = (s % 8 === 6) ? 12 : 0;
        this.mnote(mtof(chord[0] - 24 + oct), t, spb * 1.9, 'sawtooth', 0.09, hi ? 900 : 600);
      }
      if (s % 16 === 0) {
        chord.forEach(m => this.mnote(mtof(m), t, spb * 15, 'triangle', 0.022, 1800));
      }
      const arpIdx = [0, 1, 2, 1, 0, 2, 1, 2][s % 8];
      if (hi || s % 2 === 0) {
        this.mnote(mtof(chord[arpIdx] + 12 + (Math.floor(s / 8) % 2) * 12), t, spb * 0.9, 'square', hi ? 0.022 : 0.014, hi ? 3200 : 2000);
      }
      if (hi) {
        if (s % 4 === 0) {
          const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
          g.gain.setValueAtTime(0.32, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          osc.connect(g); g.connect(this.musicBus);
          osc.start(t); osc.stop(t + 0.2);
        }
        if (s % 4 === 2) this.noise(0.04, { type: 'highpass', freq: 7000, vol: 0.05, bus: this.musicBus, delay: Math.max(0, t - ctx.currentTime) });
        if (s % 16 === 12) this.noise(0.12, { type: 'bandpass', freq: 1800, vol: 0.07, bus: this.musicBus, delay: Math.max(0, t - ctx.currentTime) });
      }
    }
  };

  NC.Audio = Audio;
})(globalThis.NC = globalThis.NC || {});
