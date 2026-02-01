import {
  GRAVITY,
  MAP_WIDTH,
  MAP_HEIGHT,
  WATER_LEVEL,
} from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Ant } from './Ant.ts';
import { WeaponConfig, WEAPON_CONFIGS } from './weapons/WeaponTypes.ts';

export interface ProjectileState {
  active: boolean;
  hit: boolean;
  hitWater: boolean;
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

  private spawnBounceParticles(x: number, y: number): void {
    // Smaller particle burst for bounces
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI + Math.random() * Math.PI;
      const speed = 30 + Math.random() * 50;
      this.impactParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color: '#FFD700',
      });
    }
  }

  // Calculate terrain surface normal at a point for bounce reflection
  private getSurfaceNormal(terrain: Terrain, x: number): { nx: number; ny: number } {
    // Sample terrain height at nearby points to estimate slope
    const sampleDist = 4;
    const heightLeft = terrain.getHeightAt(x - sampleDist);
    const heightRight = terrain.getHeightAt(x + sampleDist);

    // Calculate slope (rise over run)
    const slope = (heightRight - heightLeft) / (sampleDist * 2);

    // Normal is perpendicular to slope (pointing upward)
    // For a slope dy/dx, the normal is (-dy, dx) normalized
    const nx = -slope;
    const ny = -1; // Negative because Y increases downward

    // Normalize
    const len = Math.sqrt(nx * nx + ny * ny);
    return { nx: nx / len, ny: ny / len };
  }

  // Reflect velocity off a surface with given normal
  private reflectVelocity(normal: { nx: number; ny: number }, damping: number = 0.6): void {
    // v' = v - 2(v·n)n
    const dot = this.vx * normal.nx + this.vy * normal.ny;
    this.vx = (this.vx - 2 * dot * normal.nx) * damping;
    this.vy = (this.vy - 2 * dot * normal.ny) * damping;
  }

  update(deltaTime: number, terrain: Terrain, ants: Ant[], wind: number): ProjectileState {
    if (!this.active) {
      // Still update trail and impact particles even when projectile is gone
      this.updateTrailParticles(deltaTime);
      this.updateImpactParticles(deltaTime);
      return { active: false, hit: false, hitWater: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
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
    this.vy += GRAVITY * (this.weaponConfig.gravityMultiplier ?? 1) * deltaTime; // Gravity with weapon multiplier

    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Check water collision (before out-of-bounds)
    if (this.y >= WATER_LEVEL) {
      this.active = false;
      this.trail = [];
      return { active: false, hit: false, hitWater: true, hitX: this.x, hitY: WATER_LEVEL, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
    }

    // Check if out of bounds (very lenient - allow projectiles to go off-screen)
    // Only deactivate if WAY off screen (500px) or below the map
    if (this.x < -500 || this.x > MAP_WIDTH + 500 || this.y > MAP_HEIGHT + 100) {
      this.active = false;
      this.trail = []; // Clear trail on deactivation
      return { active: false, hit: false, hitWater: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
    }

    // Check terrain collision (ground and floating platforms)
    if (terrain.isPointInTerrain(this.x, this.y)) {
      // Check if we should bounce
      if (this.bouncesRemaining > 0) {
        // Get surface normal for reflection
        const normal = this.getSurfaceNormal(terrain, this.x);

        // Reflect velocity with energy loss
        const damping = 0.65; // Lose 35% energy on each bounce
        this.reflectVelocity(normal, damping);

        // Move projectile out of terrain
        const terrainY = MAP_HEIGHT - terrain.getHeightAt(this.x);
        this.y = terrainY - 2; // Place slightly above terrain

        // Decrement bounces
        this.bouncesRemaining--;

        // Spawn bounce particles
        this.spawnBounceParticles(this.x, this.y);

        // Check if velocity is too low to continue bouncing (prevent infinite tiny bounces)
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed < 30) {
          // Too slow, explode here
          this.active = false;
          this.trail = [];
          this.spawnImpactParticles(this.x, this.y);
          return { active: false, hit: true, hitWater: false, hitX: this.x, hitY: this.y, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
        }

        // Continue bouncing - projectile stays active
        return { active: true, hit: false, hitWater: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
      }

      // No bounces remaining - explode
      this.active = false;
      this.trail = []; // Clear trail on hit
      // Spawn impact dust burst
      this.spawnImpactParticles(this.x, this.y);
      return { active: false, hit: true, hitWater: false, hitX: this.x, hitY: this.y, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
    }

    // Check wall collision (sides of map) - bounce off walls
    if (this.bouncesRemaining > 0 && (this.x < 0 || this.x > MAP_WIDTH)) {
      // Bounce off vertical wall
      this.vx = -this.vx * 0.7; // Reverse and dampen
      this.x = this.x < 0 ? 2 : MAP_WIDTH - 2; // Move away from wall
      this.bouncesRemaining--;
      this.spawnBounceParticles(this.x, this.y);
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
        return { active: false, hit: true, hitWater: false, hitX: this.x, hitY: this.y, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
      }
    }

    return { active: true, hit: false, hitWater: false, hitX: 0, hitY: 0, shouldCluster: false, clusterX: 0, clusterY: 0, clusterVx: 0, clusterVy: 0 };
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

    // Draw projectile with weapon-specific pixel art
    if (this.active) {
      const angle = Math.atan2(this.vy, this.vx);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      // Draw weapon-specific projectile
      switch (this.weaponConfig.type) {
        case 'standard':
          this.renderStandardShell(ctx);
          break;
        case 'bazooka':
          this.renderBazookaRocket(ctx);
          break;
        case 'shotgun':
          this.renderClusterPellet(ctx);
          break;
        case 'sniper':
          this.renderSniperBullet(ctx);
          break;
        case 'napalm':
          this.renderNapalmCanister(ctx);
          break;
        case 'grenade':
          this.renderGrenade(ctx);
          break;
        default:
          this.renderStandardShell(ctx);
      }

      ctx.restore();
    }
  }

  // Pixel art: Standard shell - classic cannonball
  private renderStandardShell(ctx: CanvasRenderingContext2D): void {
    const pixelSize = 2;
    // Shell shape (pointing right): 6x4 pixels, no outline
    const sprite = [
      [0, 1, 1, 2, 0, 0],
      [1, 1, 2, 2, 2, 0],
      [1, 1, 2, 2, 2, 0],
      [0, 1, 1, 2, 0, 0],
    ];
    const colors: Record<number, string> = {
      0: '', // Transparent
      1: '#8B5A2B', // Brown
      2: '#CD853F', // Light brown/orange highlight
    };

    this.drawPixelSprite(ctx, sprite, colors, pixelSize, -6, -4);
    this.drawProjectileGlow(ctx, '#FF9944', 12);
  }

  // Pixel art: Bazooka rocket - missile with fins
  private renderBazookaRocket(ctx: CanvasRenderingContext2D): void {
    const pixelSize = 2;
    // Rocket shape (pointing right): 12x6 pixels, no outline
    const sprite = [
      [0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 0, 0],
      [4, 4, 1, 1, 1, 1, 2, 2, 3, 3, 3, 0],
      [4, 4, 1, 1, 1, 1, 2, 2, 3, 3, 3, 0],
      [0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0],
    ];
    const colors: Record<number, string> = {
      0: '', // Transparent
      1: '#5A5A5A', // Dark grey body
      2: '#7A7A7A', // Light grey body
      3: '#DD4444', // Red tip
      4: '#FF6600', // Orange exhaust
    };

    this.drawPixelSprite(ctx, sprite, colors, pixelSize, -12, -6);
    this.drawProjectileGlow(ctx, '#FF4400', 16);
  }

  // Pixel art: Cluster bomb pellet - small round pellet
  private renderClusterPellet(ctx: CanvasRenderingContext2D): void {
    const pixelSize = 2;
    // Small pellet shape: 4x4 pixels, no outline
    const sprite = [
      [0, 1, 1, 0],
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [0, 1, 1, 0],
    ];
    const colors: Record<number, string> = {
      0: '', // Transparent
      1: '#DAA520', // Gold
      2: '#FFD700', // Bright gold highlight
    };

    this.drawPixelSprite(ctx, sprite, colors, pixelSize, -4, -4);
    this.drawProjectileGlow(ctx, '#FFDD44', 8);
  }

  // Pixel art: Sniper bullet - slim elongated bullet
  private renderSniperBullet(ctx: CanvasRenderingContext2D): void {
    const pixelSize = 1.5;
    // Small bullet shape (pointing right): 6x2 pixels, no outline
    const sprite = [
      [1, 1, 2, 2, 3, 3],
      [1, 1, 2, 2, 3, 3],
    ];
    const colors: Record<number, string> = {
      0: '', // Transparent
      1: '#B87333', // Copper/brass
      2: '#CD7F32', // Light brass
      3: '#CC3333', // Red tip
    };

    this.drawPixelSprite(ctx, sprite, colors, pixelSize, -5, -1.5);
    this.drawProjectileGlow(ctx, '#FF6666', 6);
  }

  // Pixel art: Bouncing Bomb - classic round bomb with fuse
  private renderNapalmCanister(ctx: CanvasRenderingContext2D): void {
    const pixelSize = 2;
    // Classic round bomb shape: 10x10 pixels
    const sprite = [
      [0, 0, 0, 0, 5, 5, 0, 0, 0, 0],
      [0, 0, 0, 5, 4, 4, 5, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 2, 2, 1, 1, 1, 1, 0],
      [0, 1, 2, 2, 1, 1, 1, 1, 1, 0],
      [0, 1, 2, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    ];
    const colors: Record<number, string> = {
      0: '', // Transparent
      1: '#1a1a1a', // Black bomb body
      2: '#3a3a3a', // Highlight
      3: '#5A5A5A', // Lighter highlight
      4: '#8B4513', // Fuse (brown)
      5: '#FF6600', // Fuse spark (orange)
    };

    this.drawPixelSprite(ctx, sprite, colors, pixelSize, -10, -10);

    // Add flickering spark effect on the fuse
    const sparkFlicker = Math.sin(this.time * 30) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, ${150 + sparkFlicker * 100}, 0, ${0.8 + sparkFlicker * 0.2})`;
    ctx.beginPath();
    ctx.arc(-10 + 5 * 2, -10 + 0.5 * 2, 3 + sparkFlicker * 2, 0, Math.PI * 2);
    ctx.fill();

    this.drawProjectileGlow(ctx, '#FF6600', 16);
  }

  // Pixel art: Bouncing Grenade - military grenade shape
  private renderGrenade(ctx: CanvasRenderingContext2D): void {
    const pixelSize = 2;
    // Grenade shape: 8x10 pixels - oval body with top mechanism
    const sprite = [
      [0, 0, 0, 3, 3, 0, 0, 0],
      [0, 0, 3, 4, 4, 3, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 2, 2, 1, 1, 0],
      [0, 1, 2, 2, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ];
    const colors: Record<number, string> = {
      0: '', // Transparent
      1: '#3D5C3D', // Olive green body
      2: '#5A7A5A', // Light green highlight
      3: '#4A4A4A', // Grey mechanism top
      4: '#6A6A6A', // Light grey mechanism
    };

    this.drawPixelSprite(ctx, sprite, colors, pixelSize, -8, -10);

    // Add a subtle pulse glow
    const pulse = Math.sin(this.time * 10) * 0.3 + 0.7;
    this.drawProjectileGlow(ctx, '#66AA66', 12 * pulse);
  }

  // Helper: Draw a pixel sprite from a 2D array
  private drawPixelSprite(
    ctx: CanvasRenderingContext2D,
    sprite: number[][],
    colors: Record<number, string>,
    pixelSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        const colorIndex = sprite[y][x];
        if (colorIndex !== 0 && colors[colorIndex]) {
          ctx.fillStyle = colors[colorIndex];
          ctx.fillRect(
            offsetX + x * pixelSize,
            offsetY + y * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  // Helper: Draw a subtle glow behind the projectile
  private drawProjectileGlow(ctx: CanvasRenderingContext2D, color: string, size: number): void {
    const pulse = 0.7 + Math.sin(this.time * 15) * 0.3;
    const glowSize = size * pulse;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    gradient.addColorStop(0, `${color}66`);
    gradient.addColorStop(0.5, `${color}33`);
    gradient.addColorStop(1, `${color}00`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();
  }
}
