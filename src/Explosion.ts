import { EXPLOSION_RADIUS, EXPLOSION_DAMAGE_RADIUS } from './constants.ts';
import { Tank } from './Tank.ts';
import { Terrain } from './Terrain.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: 'fire' | 'dust' | 'smoke';
  size: number;
}

export class Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  active: boolean;
  particles: Particle[];

  // Shockwave
  shockwaveRadius: number;
  shockwaveAlpha: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.maxRadius = EXPLOSION_RADIUS;
    this.alpha = 1;
    this.active = true;

    // Shockwave starts at explosion center
    this.shockwaveRadius = 5;
    this.shockwaveAlpha = 0.8;

    // Create explosion particles
    this.particles = [];

    // Fire particles (original style)
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        type: 'fire',
        size: 3 + Math.random() * 2,
      });
    }

    // Dust particles (rise from ground)
    for (let i = 0; i < 12; i++) {
      const offsetX = (Math.random() - 0.5) * EXPLOSION_RADIUS;
      this.particles.push({
        x: x + offsetX,
        y: y,
        vx: (Math.random() - 0.5) * 30,
        vy: -30 - Math.random() * 50,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4,
        type: 'dust',
        size: 4 + Math.random() * 4,
      });
    }

    // Smoke particles (linger longer)
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 20,
        vy: -20 - Math.random() * 30,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 2.0,
        type: 'smoke',
        size: 8 + Math.random() * 8,
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

    // Expand shockwave (faster than main explosion)
    this.shockwaveRadius += deltaTime * 300;
    this.shockwaveAlpha -= deltaTime * 2.5;

    // Update particles
    for (const particle of this.particles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;

      // Different physics per particle type
      if (particle.type === 'fire') {
        particle.vy += 80 * deltaTime; // Gravity
      } else if (particle.type === 'dust') {
        particle.vy += 40 * deltaTime; // Lighter gravity
        particle.vx *= 0.98; // Air resistance
      } else if (particle.type === 'smoke') {
        particle.vy -= 10 * deltaTime; // Smoke rises
        particle.vx *= 0.95; // More air resistance
        particle.size += deltaTime * 8; // Smoke expands
      }

      particle.life -= deltaTime;
    }

    // Remove dead particles
    this.particles = this.particles.filter(p => p.life > 0);

    if (this.alpha <= 0 && this.shockwaveAlpha <= 0 && this.particles.length === 0) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    // Draw shockwave ring
    if (this.shockwaveAlpha > 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.shockwaveAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner shockwave
      ctx.strokeStyle = `rgba(255, 200, 100, ${this.shockwaveAlpha * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shockwaveRadius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw explosion circle
    if (this.alpha > 0) {
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

    // Draw particles by type (smoke first, then dust, then fire on top)
    const smokeParticles = this.particles.filter(p => p.type === 'smoke');
    const dustParticles = this.particles.filter(p => p.type === 'dust');
    const fireParticles = this.particles.filter(p => p.type === 'fire');

    // Smoke particles (gray, semi-transparent)
    for (const particle of smokeParticles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio * 0.4;
      const gray = 60 + Math.random() * 30;
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dust particles (brown/tan)
    for (const particle of dustParticles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio * 0.6;
      ctx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fire particles (orange/yellow)
    for (const particle of fireParticles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio;
      const green = 100 + Math.random() * 100;
      ctx.fillStyle = `rgba(255, ${green}, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
