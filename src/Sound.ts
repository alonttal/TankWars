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

  // Volume controls (0-100)
  private masterVolume: number = 80;
  private musicVolume: number = 60;
  private sfxVolume: number = 80;

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

  // Volume controls
  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(100, volume));
    this.updateMusicVolume();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(100, volume));
    this.updateMusicVolume();
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(100, volume));
  }

  private getEffectiveVolume(baseVolume: number, isMusic: boolean): number {
    const volumeMultiplier = isMusic ? this.musicVolume : this.sfxVolume;
    return (baseVolume * this.masterVolume * volumeMultiplier) / 10000;
  }

  private updateMusicVolume(): void {
    if (this.musicGain) {
      const ctx = this.getContext();
      if (ctx) {
        const volume = this.getEffectiveVolume(0.15, true);
        this.musicGain.gain.setValueAtTime(volume, ctx.currentTime);
      }
    }
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
    const musicVol = this.getEffectiveVolume(0.15, true);
    this.musicGain.gain.setValueAtTime(musicVol, ctx.currentTime);
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
    const vol = this.getEffectiveVolume(1, false);

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
    gainNode.gain.setValueAtTime(0.3 * vol, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);

    // Add a bit of noise for "punch"
    this.playNoiseBurst(0.1, 0.08 * vol);
  }

  // Explosion sound - low rumble with noise
  playExplosion(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(1, false);

    // Low frequency rumble
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

    gainNode.gain.setValueAtTime(0.4 * vol, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);

    // Add noise for explosion texture
    this.playNoiseBurst(0.5, 0.4 * vol);

    // Secondary lower boom
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(20, now + 0.4);

    gain2.gain.setValueAtTime(0.5 * vol, now);
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

  // Bounce sound for bouncer weapon
  playBounce(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const volume = this.getEffectiveVolume(0.3, false);

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Metallic ping sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Power-up collection sound
  playPowerUpCollect(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const volume = this.getEffectiveVolume(0.3, false);

    // Ascending magical chime
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(volume, now + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.15);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    });
  }

  // Cluster bomb split sound
  playClusterSplit(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const volume = this.getEffectiveVolume(0.25, false);

    // Pop sound
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }
  // Water splash sound - noise burst with lowpass sweep + sine sub-tone
  playWaterSplash(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.5, false);

    // Noise burst with lowpass sweep
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseGain.gain.setValueAtTime(0.35 * vol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.start(now);

    // Sine sub-tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);

    oscGain.gain.setValueAtTime(0.2 * vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Ant death sound - varies by death type
  playAntDeath(deathType: string): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.5, false);

    switch (deathType) {
      case 'ghost': {
        // Tremolo sine - eerie warble
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const mainGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.6);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(12, now);

        lfoGain.gain.setValueAtTime(0.15 * vol, now);

        lfo.connect(lfoGain);
        lfoGain.connect(mainGain.gain);

        mainGain.gain.setValueAtTime(0.2 * vol, now);
        mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.connect(mainGain);
        mainGain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);
        lfo.start(now);
        lfo.stop(now + 0.6);
        break;
      }
      case 'splatter': {
        // Wet noise burst
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.4 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        noise.start(now);
        break;
      }
      case 'disintegrate': {
        // Crackle - rapid random clicks
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() > 0.95 ? (Math.random() * 2 - 1) : 0;
        }

        const noise = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2000, now);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.3 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        noise.start(now);
        break;
      }
      case 'vaporize': {
        // Rising hiss
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(6000, now + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.3 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        noise.start(now);
        break;
      }
      case 'drown': {
        // Bubbling tone
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const mainGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(8, now);
        lfo.frequency.linearRampToValueAtTime(3, now + 0.8);

        lfoGain.gain.setValueAtTime(80, now);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        mainGain.gain.setValueAtTime(0.25 * vol, now);
        mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

        osc.connect(mainGain);
        mainGain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.8);
        lfo.start(now);
        lfo.stop(now + 0.8);
        break;
      }
    }
  }

  // Hit thud - mid-freq smack that cuts through explosions
  playHit(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.8, false);

    // Mid-frequency smack (higher than explosion so it cuts through)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    gain.gain.setValueAtTime(0.35 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);

    // Higher-pitched click layer for presence
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    gain2.gain.setValueAtTime(0.2 * vol, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc2.start(now);
    osc2.stop(now + 0.06);

    this.playNoiseBurst(0.05, 0.1 * vol);
  }

  // Turn change chime - two-note E4→A4
  playTurnChange(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.3, false);

    // E4 (329.63 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(329.63, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25 * vol, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc1.start(now);
    osc1.stop(now + 0.12);

    // A4 (440 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, now + 0.11);

    gain2.gain.setValueAtTime(0, now + 0.11);
    gain2.gain.linearRampToValueAtTime(0.25 * vol, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.23);

    osc2.start(now + 0.11);
    osc2.stop(now + 0.23);
  }

  // Footstep - quiet triangle tap
  playFootstep(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.5, false);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);

    gain.gain.setValueAtTime(0.25 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Jump - rising sine
  playJump(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.3, false);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.12);

    gain.gain.setValueAtTime(0.25 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Falling whistle - descending sine
  playFallingWhistle(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.5, false);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.4);

    gain.gain.setValueAtTime(0.3 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Napalm ignite - noise with bandpass sweep
  playNapalmIgnite(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.5, false);

    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2, now);
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.4 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    noise.start(now);
  }

  // Shield absorb - two staggered triangle tones (metallic ring)
  playShieldAbsorb(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.35, false);

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(600, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

    gain1.gain.setValueAtTime(0.3 * vol, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(800, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.25 * vol, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc2.start(now + 0.05);
    osc2.stop(now + 0.2);
  }

  // Wind change - soft lowpass noise whoosh with bell-curve envelope
  playWindChange(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.2, false);

    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Bell-curve envelope
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.15 * vol, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.start(now);
  }

  // Power-up spawn - 3-note descending sparkle G5-E5-C5
  playPowerUpSpawn(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(0.3, false);

    const notes = [784, 659, 523]; // G5, E5, C5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25 * vol, now + i * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.1);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.1);
    });
  }

  // Sniper shot - loud sawtooth crack + highpass noise burst
  playSniperShot(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.getEffectiveVolume(1, false);

    // Sawtooth crack
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    gain.gain.setValueAtTime(0.45 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);

    // Highpass noise burst
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, now);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseGain.gain.setValueAtTime(0.35 * vol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.start(now);
  }
}

// Global sound manager instance
export const soundManager = new SoundManager();
