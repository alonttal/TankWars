import {
  GRAVITY,
  PROJECTILE_RADIUS,
  MAP_WIDTH,
  MAP_HEIGHT,
} from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Ant } from './Ant.ts';
import { WeaponConfig, WEAPON_CONFIGS } from './weapons/WeaponTypes.ts';

export interface ProjectileState {
  active: boolean;
  hit: boolean;
  hitX: number;
  hitY: number;
  shouldCluster: boolean; // True if cluster bomb should split
  clusterX: number;
  clusterY: number;
  clusterVx: number;
  clusterVy: number;
}

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  type: 'fire' | 'smoke';
}

interface ImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: { x: number; y: number }[];
  owner: Ant;
  time: number; // For pulsing glow animation
  trailParticles: TrailParticle[];
  impactParticles: ImpactParticle[];
  private trailSpawnTimer: number;

  // Weapon system
  weaponConfig: WeaponConfig;
  bouncesRemaining: number;
  hasReachedApex: boolean; // For cluster bomb
  previousVy: number; // To detect apex (velocity changes from negative to positive)
  isClusterBomblet: boolean; // True if this is a bomblet from a cluster split

  constructor(
    startX: number,
    startY: number,
    angle: number,
    power: number,
    wind: number,
    owner: Ant,
    weaponConfig: WeaponConfig = WEAPON_CONFIGS.standard,
    isClusterBomblet: boolean = false
  ) {
    this.x = startX;
    this.y = startY;
    this.owner = owner;
    this.weaponConfig = weaponConfig;
    this.isClusterBomblet = isClusterBomblet;

    // Apply weapon speed multiplier
    const adjustedPower = power * weaponConfig.projectileSpeed;

    // Convert angle to radians and calculate initial velocity
    const angleRad = (angle * Math.PI) / 180;
    this.vx = Math.cos(angleRad) * adjustedPower + wind * 0.5;
    this.vy = -Math.sin(angleRad) * adjustedPower; // Negative because Y increases downward

    this.active = true;
    this.trail = [];
    this.time = 0;
    this.trailParticles = [];
    this.impactParticles = [];
    this.trailSpawnTimer = 0;

    // Weapon-specific initialization
    this.bouncesRemaining = weaponConfig.maxBounces;
    this.hasReachedApex = false;
    this.previousVy = this.vy;
  }

  private spawnImpactParticles(x: number, y: number): void {
    const dustColors = ['#8B7355', '#A0896C', '#6B5344', '#9B8B7A', '#7D6B5D'];

    // Spawn dust burst particles
    for (let i = 0; i < 20; i++) {
      const angle = -Math.PI + Math.random() * Math.PI; // Upward arc
      const speed = 40 + Math.random() * 80;
      this.impactParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: 3 + Math.random() * 4,
        color: dustColors[Math.floor(Math.random() * dustColors.length)],
      });
    }

    // Spawn some sparks/debris
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6;
      const speed = 60 + Math.random() * 100;
      this.impactParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 2 + Math.random() * 2,
        color: '#FFD700',
      });
    }
  }

  update(deltaTime: number, terrain: Terrain, ants: Ant[], wind: number): ProjectileState {
    if (!this.active) {
      // Still update trail and impact particles even when projectile is gone
      this.updateTrailParticles(deltaTime);
      this.updateImpactParticles(deltaTime);
      return { active: false, hit: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
    }

    // Update animation time
    this.time += deltaTime;

    // Store trail point
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 50) {
      this.trail.shift();
    }

    // Spawn trail particles with weapon-specific colors
    this.trailSpawnTimer -= deltaTime;
    if (this.trailSpawnTimer <= 0) {
      this.trailSpawnTimer = 0.02; // Spawn every 20ms

      // Fire particle
      this.trailParticles.push({
        x: this.x + (Math.random() - 0.5) * 4,
        y: this.y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 20 - this.vx * 0.1,
        vy: (Math.random() - 0.5) * 20 - this.vy * 0.1,
        life: 0.2 + Math.random() * 0.2,
        size: 2 + Math.random() * 3,
        type: 'fire',
      });

      // Occasional smoke
      if (Math.random() < 0.3) {
        this.trailParticles.push({
          x: this.x,
          y: this.y,
          vx: (Math.random() - 0.5) * 10,
          vy: -10 - Math.random() * 20,
          life: 0.4 + Math.random() * 0.4,
          size: 3 + Math.random() * 3,
          type: 'smoke',
        });
      }
    }

    // Update trail particles
    this.updateTrailParticles(deltaTime);

    // Store previous vy for apex detection
    this.previousVy = this.vy;

    // Apply physics
    this.vx += wind * deltaTime * 0.5; // Wind affects horizontal velocity
    this.vy += GRAVITY * deltaTime; // Gravity

    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Check if out of bounds
    if (this.x < -50 || this.x > MAP_WIDTH + 50 || this.y > MAP_HEIGHT + 50) {
      this.active = false;
      this.trail = []; // Clear trail on deactivation
      return { active: false, hit: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
    }

    // Check terrain collision (ground and floating platforms)
    if (terrain.isPointInTerrain(this.x, this.y)) {
      this.active = false;
      this.trail = []; // Clear trail on hit
      // Spawn impact dust burst
      this.spawnImpactParticles(this.x, this.y);
      return { active: false, hit: true, hitX: this.x, hitY: this.y, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
    }

    // Check ant collision
    for (const ant of ants) {
      if (!ant.isAlive || ant === this.owner) continue;

      const dx = this.x - ant.x;
      const dy = this.y - (ant.y - 10); // Approximate ant center
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 25) { // Hit radius
        this.active = false;
        this.trail = []; // Clear trail on hit
        return { active: false, hit: true, hitX: this.x, hitY: this.y, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
      }
    }

    return { active: true, hit: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
  }

  private updateTrailParticles(deltaTime: number): void {
    for (const particle of this.trailParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;

      if (particle.type === 'fire') {
        particle.vy += 50 * deltaTime; // Light gravity
        particle.size *= 0.95; // Shrink
      } else {
        particle.vy -= 30 * deltaTime; // Smoke rises
        particle.size += deltaTime * 5; // Expands
      }

      particle.life -= deltaTime;
    }

    this.trailParticles = this.trailParticles.filter(p => p.life > 0);
  }

  private updateImpactParticles(deltaTime: number): void {
    for (const particle of this.impactParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 150 * deltaTime; // Gravity
      particle.vx *= 0.98; // Air resistance
      particle.life -= deltaTime;
    }
    this.impactParticles = this.impactParticles.filter(p => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active && this.trail.length === 0 && this.trailParticles.length === 0 && this.impactParticles.length === 0) return;

    const color = this.weaponConfig.trailColor;
    const sizeMultiplier = this.weaponConfig.projectileSize;

    // Draw impact particles first (behind everything)
    for (const particle of this.impactParticles) {
      const alpha = particle.life / particle.maxLife;
      ctx.globalAlpha = alpha;

      // Draw particle
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Add glow for spark particles
      if (particle.color === '#FFD700' || particle.color === '#44FF44') {
        ctx.fillStyle = particle.color === '#44FF44'
          ? `rgba(100, 255, 100, ${alpha * 0.5})`
          : `rgba(255, 200, 50, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Draw trail line with gradient (weapon-colored)
    if (this.trail.length > 1) {
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = (i / this.trail.length) * 0.6;
        const width = 1 + (i / this.trail.length) * 2;
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
    }

    // Draw trail particles (smoke first, then fire)
    const smokeParticles = this.trailParticles.filter(p => p.type === 'smoke');
    const fireParticles = this.trailParticles.filter(p => p.type === 'fire');

    for (const particle of smokeParticles) {
      const alpha = (particle.life / 0.8) * 0.4;
      const gray = 100 + Math.floor(Math.random() * 50);
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const particle of fireParticles) {
      const alpha = particle.life / 0.4;
      // Use weapon trail color for fire particles
      ctx.fillStyle = `rgba(${color.r}, ${Math.floor(color.g * 0.7)}, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw projectile with pulsing glow
    if (this.active) {
      const pulse = 0.7 + Math.sin(this.time * 20) * 0.3; // Pulsing between 0.7 and 1.0
      const baseRadius = PROJECTILE_RADIUS * sizeMultiplier;

      // Outer glow (pulsing)
      const glowSize = baseRadius * 3 * pulse;
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
      gradient.addColorStop(0, `rgba(255, 255, 200, ${0.8 * pulse})`);
      gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.5 * pulse})`);
      gradient.addColorStop(0.6, `rgba(${color.r}, ${Math.floor(color.g * 0.5)}, 0, ${0.3 * pulse})`);
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(this.x, this.y, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright glow
      ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
