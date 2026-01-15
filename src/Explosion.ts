import { EXPLOSION_RADIUS, EXPLOSION_DAMAGE_RADIUS } from './constants.ts';
import { Tank } from './Tank.ts';
import { Terrain } from './Terrain.ts';

export class Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  active: boolean;
  particles: { x: number; y: number; vx: number; vy: number; life: number }[];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.maxRadius = EXPLOSION_RADIUS;
    this.alpha = 1;
    this.active = true;

    // Create explosion particles
    this.particles = [];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50, // Bias upward
        life: 0.5 + Math.random() * 0.5,
      });
    }
  }

  applyDamage(tanks: Tank[], terrain: Terrain, _shooter: Tank): void {
    // Damage terrain
    terrain.createCrater(this.x, this.y, EXPLOSION_RADIUS);

    // Damage tanks
    for (const tank of tanks) {
      if (!tank.isAlive) continue;

      const dx = tank.x - this.x;
      const dy = (tank.y - 10) - this.y; // Tank center
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < EXPLOSION_DAMAGE_RADIUS) {
        // Damage falls off with distance
        const damageMultiplier = 1 - (distance / EXPLOSION_DAMAGE_RADIUS);
        const damage = Math.floor(50 * damageMultiplier + 10);
        tank.takeDamage(damage);
      }
    }

    // Update tank positions after terrain deformation
    for (const tank of tanks) {
      if (tank.isAlive) {
        tank.updatePosition(terrain);
      }
    }
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    // Expand explosion
    this.radius += deltaTime * 200;
    this.alpha -= deltaTime * 2;

    // Update particles
    for (const particle of this.particles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 100 * deltaTime; // Gravity on particles
      particle.life -= deltaTime;
    }

    // Remove dead particles
    this.particles = this.particles.filter(p => p.life > 0);

    if (this.alpha <= 0 && this.particles.length === 0) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    // Draw explosion circle
    if (this.alpha > 0) {
      // Outer glow
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius
      );
      gradient.addColorStop(0, `rgba(255, 255, 200, ${this.alpha})`);
      gradient.addColorStop(0.3, `rgba(255, 150, 50, ${this.alpha * 0.8})`);
      gradient.addColorStop(0.7, `rgba(255, 50, 0, ${this.alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw particles
    for (const particle of this.particles) {
      const particleAlpha = particle.life;
      ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, ${particleAlpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
