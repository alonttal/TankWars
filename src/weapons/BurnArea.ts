import { BASE_HEIGHT } from '../constants.ts';
import { Tank } from '../Tank.ts';
import { Terrain } from '../Terrain.ts';

interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  alpha: number;
}

export class BurnArea {
  x: number;
  y: number;
  radius: number;
  duration: number; // Total duration in seconds
  damagePerSecond: number;
  timeRemaining: number;
  active: boolean;

  private fireParticles: FireParticle[];
  private smokeParticles: SmokeParticle[];
  private particleSpawnTimer: number;
  private damageTickTimer: number;

  constructor(x: number, y: number, radius: number, duration: number, damagePerSecond: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.duration = duration;
    this.damagePerSecond = damagePerSecond;
    this.timeRemaining = duration;
    this.active = true;

    this.fireParticles = [];
    this.smokeParticles = [];
    this.particleSpawnTimer = 0;
    this.damageTickTimer = 0;

    // Spawn initial fire particles
    this.spawnInitialParticles();
  }

  private spawnInitialParticles(): void {
    // Create a burst of fire particles
    for (let i = 0; i < 30; i++) {
      this.spawnFireParticle();
    }
  }

  private spawnFireParticle(): void {
    const offsetX = (Math.random() - 0.5) * this.radius * 2;
    const offsetY = Math.random() * 10;

    this.fireParticles.push({
      x: this.x + offsetX,
      y: this.y - offsetY,
      vx: (Math.random() - 0.5) * 30,
      vy: -30 - Math.random() * 50,
      life: 0.3 + Math.random() * 0.5,
      maxLife: 0.8,
      size: 4 + Math.random() * 6,
    });
  }

  private spawnSmokeParticle(): void {
    const offsetX = (Math.random() - 0.5) * this.radius * 1.5;

    this.smokeParticles.push({
      x: this.x + offsetX,
      y: this.y - 10 - Math.random() * 20,
      vx: (Math.random() - 0.5) * 15,
      vy: -20 - Math.random() * 30,
      life: 1.0 + Math.random() * 0.5,
      size: 8 + Math.random() * 8,
      alpha: 0.4 + Math.random() * 0.2,
    });
  }

  update(deltaTime: number, tanks: Tank[], terrain: Terrain): void {
    if (!this.active) return;

    // Update remaining time
    this.timeRemaining -= deltaTime;
    if (this.timeRemaining <= 0) {
      this.active = false;
      return;
    }

    // Update Y position to follow terrain
    this.y = BASE_HEIGHT - terrain.getHeightAt(this.x);

    // Spawn particles
    this.particleSpawnTimer -= deltaTime;
    if (this.particleSpawnTimer <= 0) {
      this.particleSpawnTimer = 0.05; // Spawn every 50ms

      // Spawn fire particles
      const intensity = this.timeRemaining / this.duration;
      const particleCount = Math.ceil(3 * intensity);
      for (let i = 0; i < particleCount; i++) {
        this.spawnFireParticle();
      }

      // Occasional smoke
      if (Math.random() < 0.5) {
        this.spawnSmokeParticle();
      }
    }

    // Update fire particles
    for (const particle of this.fireParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 30 * deltaTime; // Fire rises
      particle.size *= 0.97;
      particle.life -= deltaTime;
    }
    this.fireParticles = this.fireParticles.filter(p => p.life > 0);

    // Update smoke particles
    for (const particle of this.smokeParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 15 * deltaTime; // Smoke rises slower
      particle.vx *= 0.98;
      particle.size += deltaTime * 15; // Expands
      particle.alpha *= 0.98;
      particle.life -= deltaTime;
    }
    this.smokeParticles = this.smokeParticles.filter(p => p.life > 0);

    // Apply damage to tanks in range
    this.damageTickTimer -= deltaTime;
    if (this.damageTickTimer <= 0) {
      this.damageTickTimer = 0.5; // Damage tick every 0.5 seconds

      for (const tank of tanks) {
        if (!tank.isAlive) continue;

        const dx = tank.x - this.x;
        const dy = (tank.y - 10) - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + 20) { // Tank radius approximation
          // Apply damage based on proximity
          const proximityFactor = 1 - (distance / (this.radius + 20));
          const damage = Math.ceil(this.damagePerSecond * 0.5 * proximityFactor);
          if (damage > 0) {
            tank.takeDamage(damage);
          }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active && this.fireParticles.length === 0 && this.smokeParticles.length === 0) return;

    const intensity = Math.max(0, this.timeRemaining / this.duration);

    // Draw ground fire glow
    if (this.active) {
      const glowGradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius * 1.5
      );
      glowGradient.addColorStop(0, `rgba(255, 100, 0, ${0.4 * intensity})`);
      glowGradient.addColorStop(0.5, `rgba(255, 50, 0, ${0.2 * intensity})`);
      glowGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.5, this.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw smoke particles (behind fire)
    for (const particle of this.smokeParticles) {
      const alpha = (particle.life / 1.5) * particle.alpha;
      const gray = 50 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw fire particles
    for (const particle of this.fireParticles) {
      const lifeRatio = particle.life / particle.maxLife;

      // Fire gradient colors (yellow -> orange -> red)
      const r = 255;
      const g = Math.floor(200 * lifeRatio);
      const b = 0;
      const alpha = lifeRatio;

      // Outer glow
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Main flame
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Check if burn area is complete (no particles left and time expired)
  isComplete(): boolean {
    return !this.active && this.fireParticles.length === 0 && this.smokeParticles.length === 0;
  }
}
