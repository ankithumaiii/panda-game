/**
 * Panda Hide & Seek - Procedural Web Audio Engine
 * High-performance sound effects and zen forest ambient synthesized in real-time.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.ambientPlaying = false;
    this.ambientTimer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.startAmbience();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  // --- Sound Effects ---

  // Compressed Air Tranquilizer Dart Shot
  playShoot() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // 1. High-pressure air puff (filtered noise)
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    filter.Q.setValueAtTime(4, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);

    // 2. Dart "Thwip / Twing" harmonic tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.09);

    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Hit Confirmation (Cute chirp/squeak + score ding)
  playHit(isCrit = false, isGolden = false) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Panda cute happy chirp
    const pandaOsc = this.ctx.createOscillator();
    const pandaGain = this.ctx.createGain();
    pandaOsc.type = 'triangle';
    pandaOsc.frequency.setValueAtTime(isCrit ? 620 : 480, t);
    pandaOsc.frequency.linearRampToValueAtTime(isCrit ? 940 : 720, t + 0.08);
    pandaOsc.frequency.linearRampToValueAtTime(isCrit ? 820 : 640, t + 0.16);

    pandaGain.gain.setValueAtTime(0.35, t);
    pandaGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    pandaOsc.connect(pandaGain);
    pandaGain.connect(this.sfxGain);
    pandaOsc.start(t);
    pandaOsc.stop(t + 0.22);

    // Tactical hit chime
    const ding = this.ctx.createOscillator();
    const dingGain = this.ctx.createGain();
    ding.type = 'sine';
    ding.frequency.setValueAtTime(isCrit ? 1500 : 1100, t);
    ding.frequency.exponentialRampToValueAtTime(isCrit ? 1900 : 1350, t + 0.12);

    dingGain.gain.setValueAtTime(isCrit ? 0.45 : 0.25, t);
    dingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    ding.connect(dingGain);
    dingGain.connect(this.sfxGain);
    ding.start(t);
    ding.stop(t + 0.26);

    if (isGolden) {
      this.playGong();
    }
  }

  // Golden Panda Ancient Zen Gong
  playGong() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const freqs = [180, 240, 360, 540, 720];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25 / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 2.5);
    });
  }

  // Reload Bolt Action Sound
  playReload() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Bolt slide click 1 (eject)
    this.triggerMechanicalClick(t, 900, 0.05);

    // Magazine load click 2
    this.triggerMechanicalClick(t + 0.25, 1400, 0.07);

    // Bolt lock click 3
    this.triggerMechanicalClick(t + 0.55, 1100, 0.06);
  }

  triggerMechanicalClick(time, freq, dur) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + dur);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  // Dry Fire / Empty Click
  playEmpty() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    this.triggerMechanicalClick(t, 2200, 0.02);
  }

  // Scope Zoom Sound (Optic click & glass slide)
  playScope(zoomIn = true) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (zoomIn) {
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.12);
    } else {
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.exponentialRampToValueAtTime(250, t + 0.1);
    }

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  // Zen Slow Motion Activation
  playZenTime(activate = true) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (activate) {
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.6);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    } else {
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(500, t + 0.35);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  // Sonar Radar Scan
  playRadar() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.15);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.82);
  }

  // Prankster Mud Splatter
  playSplatter() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Squish tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(70, t + 0.15);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Panda Sneak / Peep Sound
  playPandaPeep() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.linearRampToValueAtTime(840, t + 0.08);
    osc.frequency.linearRampToValueAtTime(620, t + 0.15);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Combo Fanfare
  playComboStreak(comboCount) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const pentatonic = [392, 440, 493.88, 587.33, 659.25, 783.99, 880];
    const pitch = pentatonic[Math.min(comboCount, pentatonic.length - 1)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // Ambient Bamboo Forest Generator (Breeze + Wind Chime)
  startAmbience() {
    if (this.ambientPlaying || !this.ctx) return;
    this.ambientPlaying = true;

    const playRandomChime = () => {
      if (!this.enabled || !this.ctx) {
        this.ambientTimer = setTimeout(playRandomChime, 4000);
        return;
      }
      const t = this.ctx.currentTime;
      const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      const note = notes[Math.floor(Math.random() * notes.length)];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, t);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);

      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start(t);
      osc.stop(t + 3.1);

      const nextDelay = 3500 + Math.random() * 4500;
      this.ambientTimer = setTimeout(playRandomChime, nextDelay);
    };

    playRandomChime();
  }
}

// Global Audio Instance
window.soundEngine = new SoundEngine();
