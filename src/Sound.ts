// Sound effects and music using Web Audio API (no external files needed)
export class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private musicEnabled: boolean = true;
  private musicPlaying: boolean = false;
  private musicInterval: number | null = null;
  private musicGain: GainNode | null = null;
  private currentBeat: number = 0;

  // Charging sound
  private chargingOsc: OscillatorNode | null = null;
  private chargingGain: GainNode | null = null;

  constructor() {
    // AudioContext is created on first user interaction to comply with browser policies
  }

  private getContext(): AudioContext | null {
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
      } catch {
        console.warn('Web Audio API not supported');
        return null;
      }
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    }
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  // Background music - military/march style
  startMusic(): void {
    if (!this.musicEnabled || this.musicPlaying) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.musicPlaying = true;
    this.currentBeat = 0;

    // Create master gain for music
    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.15, ctx.currentTime);
    this.musicGain.connect(ctx.destination);

    // Play music loop
    const tempo = 140; // BPM
    const beatDuration = 60000 / tempo;

    this.playMusicBeat();
    this.musicInterval = window.setInterval(() => {
      this.playMusicBeat();
    }, beatDuration);
  }

  private playMusicBeat(): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain || !this.musicPlaying) return;

    const now = ctx.currentTime;

    // Melody pattern (16 beats loop) - military march feel
    const melodyNotes = [
      330, 330, 392, 392, 440, 440, 392, 0,    // E4 E4 G4 G4 A4 A4 G4 rest
      349, 349, 330, 330, 294, 294, 262, 0,    // F4 F4 E4 E4 D4 D4 C4 rest
    ];

    // Bass pattern (follows root notes)
    const bassNotes = [
      131, 0, 131, 0, 147, 0, 147, 0,          // C3, D3
      131, 0, 131, 0, 98, 0, 98, 0,            // C3, G2
    ];

    // Drum pattern
    const kickPattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    const snarePattern = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    const hihatPattern = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    const beat = this.currentBeat % 16;

    // Play melody
    const melodyFreq = melodyNotes[beat];
    if (melodyFreq > 0) {
      this.playNote(melodyFreq, 'square', 0.08, 0.15, now);
    }

    // Play bass
    const bassFreq = bassNotes[beat];
    if (bassFreq > 0) {
      this.playNote(bassFreq, 'triangle', 0.12, 0.2, now);
    }

    // Play drums
    if (kickPattern[beat]) {
      this.playKick(now);
    }
    if (snarePattern[beat]) {
      this.playSnare(now);
    }
    if (hihatPattern[beat]) {
      this.playHihat(now);
    }

    this.currentBeat++;
  }

  private playNote(
    freq: number,
    type: OscillatorType,
    volume: number,
    duration: number,
    time: number
  ): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playKick(time: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playSnare(time: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;

    // Noise component
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGain);

    noiseGain.gain.setValueAtTime(0.15, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    noise.start(time);

    // Tone component
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.connect(oscGain);
    oscGain.connect(this.musicGain);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);

    oscGain.gain.setValueAtTime(0.1, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private playHihat(time: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain) return;

    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    gain.gain.setValueAtTime(0.03, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.start(time);
  }

  stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    if (this.musicGain) {
      const ctx = this.getContext();
      if (ctx) {
        this.musicGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      }
      this.musicGain = null;
    }

    this.musicPlaying = false;
  }

  toggleMusic(): boolean {
    if (this.musicPlaying) {
      this.stopMusic();
      this.musicEnabled = false;
    } else {
      this.musicEnabled = true;
      this.startMusic();
    }
    return this.musicEnabled;
  }

  // Charging power sound - rising tone
  startCharging(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Stop any existing charging sound
    this.stopCharging();

    this.chargingOsc = ctx.createOscillator();
    this.chargingGain = ctx.createGain();

    this.chargingOsc.connect(this.chargingGain);
    this.chargingGain.connect(ctx.destination);

    this.chargingOsc.type = 'sine';
    this.chargingOsc.frequency.setValueAtTime(100, ctx.currentTime);

    this.chargingGain.gain.setValueAtTime(0, ctx.currentTime);
    this.chargingGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);

    this.chargingOsc.start();
  }

  updateChargingPitch(power: number): void {
    if (!this.chargingOsc || !this.chargingGain) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Map power (0-100) to frequency (100-600 Hz)
    const minFreq = 100;
    const maxFreq = 600;
    const frequency = minFreq + (power / 100) * (maxFreq - minFreq);

    this.chargingOsc.frequency.setValueAtTime(frequency, ctx.currentTime);
  }

  stopCharging(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    if (this.chargingGain) {
      this.chargingGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
    }

    if (this.chargingOsc) {
      this.chargingOsc.stop(ctx.currentTime + 0.05);
      this.chargingOsc = null;
    }

    this.chargingGain = null;
  }

  // Shooting sound - short, punchy "pew" sound
  playShoot(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Create oscillator for the main tone
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Start with higher frequency, drop quickly (classic shoot sound)
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

    // Quick attack, short decay
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);

    // Add a bit of noise for "punch"
    this.playNoiseBurst(0.1, 0.08);
  }

  // Explosion sound - low rumble with noise
  playExplosion(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Low frequency rumble
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);

    // Add noise for explosion texture
    this.playNoiseBurst(0.5, 0.4);

    // Secondary lower boom
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(20, now + 0.4);

    gain2.gain.setValueAtTime(0.5, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc2.start(now);
    osc2.stop(now + 0.4);
  }

  // White noise burst for texture
  private playNoiseBurst(duration: number, volume: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with random noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // Fade out
    }

    const noise = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    // Add a low-pass filter for a more "bassy" explosion
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.start(now);
  }

  // Menu selection sound
  playMenuSelect(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(550, now + 0.05);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Game over sound
  playGameOver(victory: boolean): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Stop background music
    this.stopMusic();

    const now = ctx.currentTime;

    if (victory) {
      // Victory fanfare - ascending notes
      const notes = [440, 550, 660, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.2);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.2);
      });
    } else {
      // Defeat sound - descending
      const notes = [440, 350, 280, 220];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.2);

        gain.gain.setValueAtTime(0, now + i * 0.2);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.2 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.25);

        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.25);
      });
    }
  }
}

// Global sound manager instance
export const soundManager = new SoundManager();
