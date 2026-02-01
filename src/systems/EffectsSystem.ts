import { BASE_WIDTH, BASE_HEIGHT } from '../constants.ts';
import { ConfettiParticle, Firework, FloatingText } from '../types/GameTypes.ts';
import { compactArray } from '../utils/compactArray.ts';
import { CircularBuffer } from '../utils/CircularBuffer.ts';

export class EffectsSystem {
  // Screen flash
  screenFlashIntensity: number = 0;
  screenFlashColor: string = '#FFF';

  // Hitstop (time slowdown on impact)
  hitstopTimer: number = 0;

  // Confetti particles
  confetti: ConfettiParticle[] = [];

  // Fireworks
  fireworks: Firework[] = [];
  fireworkSpawnTimer: number = 0;

  // Floating damage numbers
  floatingTexts: FloatingText[] = [];

  update(deltaTime: number): number {
    // Handle hitstop (time slowdown)
    let effectiveDelta = deltaTime;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= deltaTime;
      effectiveDelta = deltaTime * 0.1; // 10% speed during hitstop
      if (this.hitstopTimer <= 0) {
        this.hitstopTimer = 0;
      }
    }

    // Update screen flash
    if (this.screenFlashIntensity > 0) {
      this.screenFlashIntensity -= deltaTime * 3; // Fade out over ~0.33 seconds
      if (this.screenFlashIntensity < 0) this.screenFlashIntensity = 0;
    }

    return effectiveDelta;
  }

  triggerScreenFlash(color: string, intensity: number): void {
    this.screenFlashColor = color;
    this.screenFlashIntensity = Math.max(this.screenFlashIntensity, intensity);
  }

  triggerHitstop(duration: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  // Floating text methods
  addFloatingText(text: FloatingText): void {
    this.floatingTexts.push(text);
  }

  updateFloatingTexts(effectiveDelta: number): void {
    for (const ft of this.floatingTexts) {
      ft.y += ft.vy * effectiveDelta;
      ft.vy += 10 * effectiveDelta; // Slight deceleration
      ft.life -= effectiveDelta;
    }
    compactArray(this.floatingTexts, ft => ft.life > 0);
  }

  // Confetti methods
  spawnConfetti(): void {
    const colors = ['#FF6B6B', '#4ECB71', '#FFD93D', '#4D96FF', '#FF6FB5', '#FFF'];
    for (let i = 0; i < 100; i++) {
      this.confetti.push({
        x: Math.random() * BASE_WIDTH,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 100,
        vy: 50 + Math.random() * 100,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        life: 3 + Math.random() * 2,
      });
    }
  }

  updateConfetti(deltaTime: number): void {
    for (const particle of this.confetti) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 80 * deltaTime; // Gravity
      particle.vx *= 0.99; // Air resistance
      particle.rotation += particle.rotationSpeed * deltaTime;
      particle.life -= deltaTime;
    }
    compactArray(this.confetti, p => p.life > 0 && p.y < BASE_HEIGHT + 50);
  }

  // Firework methods
  spawnInitialFireworks(): void {
    // Spawn several fireworks immediately
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.spawnFirework();
      }, i * 300);
    }
    // Start continuous firework spawning
    this.fireworkSpawnTimer = 0.5;
  }

  spawnFirework(): void {
    const colors = ['#FF6B6B', '#4ECB71', '#FFD93D', '#4D96FF', '#FF6FB5', '#FFF', '#FF9500'];
    this.fireworks.push({
      x: 50 + Math.random() * (BASE_WIDTH - 100),
      y: BASE_HEIGHT,
      vy: -200 - Math.random() * 100,
      targetY: 80 + Math.random() * 150,
      exploded: false,
      color: colors[Math.floor(Math.random() * colors.length)],
      sparks: [],
    });
  }

  updateFireworks(deltaTime: number, shouldSpawn: boolean = false): void {
    // Spawn new fireworks periodically during game over
    if (shouldSpawn) {
      this.fireworkSpawnTimer -= deltaTime;
      if (this.fireworkSpawnTimer <= 0) {
        this.fireworkSpawnTimer = 0.8 + Math.random() * 0.5;
        this.spawnFirework();
      }
    }

    for (const firework of this.fireworks) {
      if (!firework.exploded) {
        // Move firework upward
        firework.y += firework.vy * deltaTime;
        firework.vy += 100 * deltaTime; // Gravity slows it down

        // Explode when reaching target
        if (firework.y <= firework.targetY || firework.vy >= 0) {
          firework.exploded = true;

          // Create explosion sparks
          const sparkCount = 40 + Math.floor(Math.random() * 20);
          for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2;
            const speed = 80 + Math.random() * 100;
            const colorVariation = Math.random() > 0.3 ? firework.color : '#FFF';
            firework.sparks.push({
              x: firework.x,
              y: firework.y,
              vx: Math.cos(angle) * speed * (0.5 + Math.random() * 0.5),
              vy: Math.sin(angle) * speed * (0.5 + Math.random() * 0.5),
              life: 1.0 + Math.random() * 0.5,
              color: colorVariation,
              size: 2 + Math.random() * 2,
              trail: new CircularBuffer<{ x: number; y: number }>(5),
            });
          }
        }
      } else {
        // Update sparks
        for (const spark of firework.sparks) {
          // Store trail
          spark.trail.push({ x: spark.x, y: spark.y });

          spark.x += spark.vx * deltaTime;
          spark.y += spark.vy * deltaTime;
          spark.vy += 80 * deltaTime; // Gravity
          spark.vx *= 0.98; // Air resistance
          spark.life -= deltaTime;
          spark.size *= 0.995;
        }
        compactArray(firework.sparks, s => s.life > 0);
      }
    }

    // Remove completed fireworks
    compactArray(this.fireworks, f => !f.exploded || f.sparks.length > 0);
  }

  clear(): void {
    this.confetti = [];
    this.fireworks = [];
    this.floatingTexts = [];
    this.screenFlashIntensity = 0;
    this.hitstopTimer = 0;
    this.fireworkSpawnTimer = 0;
  }
}
