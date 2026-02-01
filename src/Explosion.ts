import { EXPLOSION_RADIUS, EXPLOSION_DAMAGE_RADIUS, KNOCKBACK_DAMAGE_MULTIPLIER, KNOCKBACK_MIN_FORCE, KNOCKBACK_MAX_FORCE, KNOCKBACK_DAMAGE_THRESHOLD } from './constants.ts';
import { Ant } from './Ant.ts';
import { Terrain } from './Terrain.ts';
import { compactArray } from './utils/compactArray.ts';
import { CircularBuffer } from './utils/CircularBuffer.ts';

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

interface DebrisChunk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  size: number;
  color: string;
}

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trail: CircularBuffer<{ x: number; y: number }>;
  color: string;
}

interface SmokeWaveParticle {
  x: number;
  y: number;
  vx: number;
  life: number;
  maxLife: number;
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
  debrisChunks: DebrisChunk[];

  // Shockwave
  shockwaveRadius: number;
  shockwaveAlpha: number;

  // Enhanced effects
  emberParticles: EmberParticle[];
  smokeWaveParticles: SmokeWaveParticle[];
  secondaryExplosionTimer: number;
  secondaryExplosionActive: boolean;
  secondaryRadius: number;
  secondaryAlpha: number;
  brightnessFlash: number;

  constructor(x: number, y: number, explosionRadius: number = EXPLOSION_RADIUS, _baseDamage: number = 50) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.maxRadius = explosionRadius;
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

    // Create debris chunks (flying terrain pieces)
    this.debrisChunks = [];
    const dirtColors = ['#8B4513', '#A0522D', '#6B4423', '#5C4033', '#704214'];
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2; // Upward arc (-180 to 0)
      const speed = 80 + Math.random() * 120;
      this.debrisChunks.push({
        x: x + (Math.random() - 0.5) * EXPLOSION_RADIUS * 0.5,
        y: y,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * speed - 80, // Mostly upward
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15,
        life: 0.8 + Math.random() * 0.6,
        size: 4 + Math.random() * 6,
        color: dirtColors[Math.floor(Math.random() * dirtColors.length)],
      });
    }

    // Create ember particles with trails
    this.emberParticles = [];
    const emberColors = ['#FF6B00', '#FF8C00', '#FFA500', '#FFD700', '#FF4500'];
    for (let i = 0; i < 20; i++) {
      const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6; // Mostly upward
      const speed = 80 + Math.random() * 150;
      this.emberParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * speed - 100,
        life: 0.8 + Math.random() * 1.2,
        maxLife: 2.0,
        size: 2 + Math.random() * 3,
        trail: new CircularBuffer<{ x: number; y: number }>(8),
        color: emberColors[Math.floor(Math.random() * emberColors.length)],
      });
    }

    // Create ground-level smoke wave particles
    this.smokeWaveParticles = [];
    for (let i = 0; i < 12; i++) {
      const direction = i < 6 ? -1 : 1; // Half go left, half go right
      this.smokeWaveParticles.push({
        x: x,
        y: y,
        vx: direction * (60 + Math.random() * 80),
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        size: 15 + Math.random() * 15,
      });
    }

    // Secondary explosion setup
    this.secondaryExplosionTimer = 0.08 + Math.random() * 0.05;
    this.secondaryExplosionActive = false;
    this.secondaryRadius = 0;
    this.secondaryAlpha = 0;

    // Initial brightness flash
    this.brightnessFlash = 0.8;
  }

  applyDamage(ants: Ant[], terrain: Terrain, _shooter: Ant): void {
    // Damage terrain
    terrain.createCrater(this.x, this.y, EXPLOSION_RADIUS);

    // Damage ants and apply knockback
    for (const ant of ants) {
      if (!ant.isAlive) continue;

      const dx = ant.x - this.x;
      const dy = (ant.y - 10) - this.y; // Ant center
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < EXPLOSION_DAMAGE_RADIUS) {
        // Damage falls off with distance
        const damageMultiplier = 1 - (distance / EXPLOSION_DAMAGE_RADIUS);
        const damage = Math.floor(50 * damageMultiplier + 10);
        ant.takeDamage(damage);

        // Apply knockback if damage is significant enough
        if (damage >= KNOCKBACK_DAMAGE_THRESHOLD) {
          const knockbackForce = this.calculateKnockbackForce(damage, distance, EXPLOSION_DAMAGE_RADIUS);
          ant.applyKnockback(this.x, this.y, knockbackForce);
        }
      }
    }

    // Update ant positions after terrain deformation (only for grounded ants)
    for (const ant of ants) {
      if (ant.isAlive && ant.isGrounded) {
        ant.updatePosition(terrain);
      }
    }
  }

  // Apply damage with custom weapon config parameters
  applyDamageWithConfig(
    ants: Ant[],
    terrain: Terrain,
    _shooter: Ant,
    explosionRadius: number,
    baseDamage: number,
    craterDepthMultiplier: number
  ): void {
    // Damage terrain with weapon-specific crater
    terrain.createCrater(this.x, this.y, explosionRadius, craterDepthMultiplier);

    // Calculate damage radius based on explosion radius
    const damageRadius = explosionRadius * 1.15;

    // Damage ants and apply knockback
    for (const ant of ants) {
      if (!ant.isAlive) continue;

      const dx = ant.x - this.x;
      const dy = (ant.y - 10) - this.y; // Ant center
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < damageRadius) {
        // Damage falls off with distance
        const damageMultiplier = 1 - (distance / damageRadius);
        const damage = Math.floor(baseDamage * damageMultiplier + baseDamage * 0.2);
        ant.takeDamage(damage);

        // Apply knockback if damage is significant enough
        if (damage >= KNOCKBACK_DAMAGE_THRESHOLD) {
          const knockbackForce = this.calculateKnockbackForce(damage, distance, damageRadius);
          ant.applyKnockback(this.x, this.y, knockbackForce);
        }
      }
    }

    // Update ant positions after terrain deformation (only for grounded ants)
    for (const ant of ants) {
      if (ant.isAlive && ant.isGrounded) {
        ant.updatePosition(terrain);
      }
    }
  }

  // Calculate knockback force based on damage and distance
  private calculateKnockbackForce(damage: number, distance: number, damageRadius: number): number {
    // Distance factor: stronger knockback when closer to explosion
    const distanceFactor = 1 - (distance / damageRadius);

    // Calculate force based on damage and distance
    let force = damage * KNOCKBACK_DAMAGE_MULTIPLIER * distanceFactor;

    // Clamp to min/max
    force = Math.max(KNOCKBACK_MIN_FORCE, Math.min(KNOCKBACK_MAX_FORCE, force));

    return force;
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    // Expand explosion
    this.radius += deltaTime * 200;
    this.alpha -= deltaTime * 2;

    // Expand shockwave (faster than main explosion)
    this.shockwaveRadius += deltaTime * 300;
    this.shockwaveAlpha -= deltaTime * 2.5;

    // Update brightness flash
    if (this.brightnessFlash > 0) {
      this.brightnessFlash -= deltaTime * 4;
      if (this.brightnessFlash < 0) this.brightnessFlash = 0;
    }

    // Handle secondary explosion with delay
    if (this.secondaryExplosionTimer > 0) {
      this.secondaryExplosionTimer -= deltaTime;
      if (this.secondaryExplosionTimer <= 0) {
        this.secondaryExplosionActive = true;
        this.secondaryRadius = 5;
        this.secondaryAlpha = 0.9;
      }
    }

    // Update secondary explosion
    if (this.secondaryExplosionActive) {
      this.secondaryRadius += deltaTime * 180;
      this.secondaryAlpha -= deltaTime * 2.5;
      if (this.secondaryAlpha <= 0) {
        this.secondaryExplosionActive = false;
      }
    }

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
    compactArray(this.particles, p => p.life > 0);

    // Update debris chunks
    for (const debris of this.debrisChunks) {
      debris.x += debris.vx * deltaTime;
      debris.y += debris.vy * deltaTime;
      debris.vy += 200 * deltaTime; // Gravity
      debris.rotation += debris.rotationSpeed * deltaTime;
      debris.life -= deltaTime;
    }
    compactArray(this.debrisChunks, d => d.life > 0);

    // Update ember particles with trails
    for (const ember of this.emberParticles) {
      // Store trail position
      ember.trail.push({ x: ember.x, y: ember.y });

      ember.x += ember.vx * deltaTime;
      ember.y += ember.vy * deltaTime;
      ember.vy += 120 * deltaTime; // Gravity
      ember.vx *= 0.99; // Air resistance
      ember.life -= deltaTime;
    }
    compactArray(this.emberParticles, e => e.life > 0);

    // Update smoke wave particles
    for (const smoke of this.smokeWaveParticles) {
      smoke.x += smoke.vx * deltaTime;
      smoke.vx *= 0.95; // Decelerate
      smoke.size += deltaTime * 20; // Expand
      smoke.life -= deltaTime;
    }
    compactArray(this.smokeWaveParticles, s => s.life > 0);

    // Check if explosion is complete
    const hasActiveParticles = this.particles.length > 0 ||
      this.debrisChunks.length > 0 ||
      this.emberParticles.length > 0 ||
      this.smokeWaveParticles.length > 0;

    if (this.alpha <= 0 && this.shockwaveAlpha <= 0 && !this.secondaryExplosionActive && !hasActiveParticles) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    // Draw brightness flash (screen-wide glow effect)
    if (this.brightnessFlash > 0) {
      const flashGradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, 200
      );
      flashGradient.addColorStop(0, `rgba(255, 255, 200, ${this.brightnessFlash * 0.5})`);
      flashGradient.addColorStop(0.5, `rgba(255, 200, 100, ${this.brightnessFlash * 0.2})`);
      flashGradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 200, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw ground-level smoke wave
    for (const smoke of this.smokeWaveParticles) {
      const alpha = (smoke.life / smoke.maxLife) * 0.4;
      ctx.fillStyle = `rgba(80, 70, 60, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(smoke.x, smoke.y, smoke.size, smoke.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

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

    // Draw secondary explosion (delayed "pop")
    if (this.secondaryExplosionActive && this.secondaryAlpha > 0) {
      const secGradient = ctx.createRadialGradient(
        this.x, this.y - 10, 0,
        this.x, this.y - 10, this.secondaryRadius
      );
      secGradient.addColorStop(0, `rgba(255, 255, 255, ${this.secondaryAlpha})`);
      secGradient.addColorStop(0.3, `rgba(255, 200, 100, ${this.secondaryAlpha * 0.8})`);
      secGradient.addColorStop(0.7, `rgba(255, 100, 50, ${this.secondaryAlpha * 0.4})`);
      secGradient.addColorStop(1, 'rgba(200, 50, 0, 0)');

      ctx.fillStyle = secGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 10, this.secondaryRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw particles by type (smoke first, then dust, then fire on top)
    // Smoke particles (gray, semi-transparent)
    for (const particle of this.particles) {
      if (particle.type !== 'smoke') continue;
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio * 0.4;
      const gray = 60 + Math.random() * 30;
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dust particles (brown/tan)
    for (const particle of this.particles) {
      if (particle.type !== 'dust') continue;
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio * 0.6;
      ctx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fire particles (orange/yellow)
    for (const particle of this.particles) {
      if (particle.type !== 'fire') continue;
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio;
      const green = 100 + Math.random() * 100;
      ctx.fillStyle = `rgba(255, ${green}, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw debris chunks (rotating dirt pieces)
    for (const debris of this.debrisChunks) {
      const alpha = Math.min(1, debris.life * 2);
      ctx.save();
      ctx.translate(debris.x, debris.y);
      ctx.rotate(debris.rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = debris.color;

      // Draw irregular polygon shape
      ctx.beginPath();
      const points = 5;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const radius = debris.size * (0.6 + Math.random() * 0.4);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw ember particles with trails
    for (const ember of this.emberParticles) {
      const lifeRatio = ember.life / ember.maxLife;
      const alpha = Math.min(1, lifeRatio * 1.5);

      // Draw trail
      if (ember.trail.length > 1) {
        for (let i = 1; i < ember.trail.length; i++) {
          const trailAlpha = alpha * (i / ember.trail.length) * 0.6;
          const trailSize = ember.size * (i / ember.trail.length);
          const pt = ember.trail.get(i)!;
          ctx.fillStyle = `rgba(255, 150, 50, ${trailAlpha})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw ember head with glow
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = ember.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
