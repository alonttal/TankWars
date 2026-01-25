import { MAP_HEIGHT, GRAVITY } from '../constants.ts';
import { PowerUpType, PowerUpConfig, POWERUP_CONFIGS } from './PowerUpTypes.ts';
import { Terrain } from '../Terrain.ts';
import { Ant } from '../Ant.ts';

// Power-up specific physics constants
const POWERUP_GRAVITY = GRAVITY * 0.4; // Slower gravity for dramatic effect

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export class PowerUp {
  x: number;
  y: number;
  targetY: number;
  type: PowerUpType;
  config: PowerUpConfig;
  active: boolean;
  collected: boolean;
  isFalling: boolean;
  velocityY: number;

  // Animation
  private bobOffset: number;
  private bobSpeed: number;
  private pulsePhase: number;
  private sparkleParticles: SparkleParticle[];
  private sparkleTimer: number;

  // Collection animation
  private collectAnimTime: number;

  constructor(x: number, terrain: Terrain, type: PowerUpType) {
    this.x = x;
    this.type = type;
    this.config = POWERUP_CONFIGS[type];
    this.active = true;
    this.collected = false;
    this.velocityY = 0; // Start with zero velocity, accelerate with gravity

    // Start above the visible area so it enters the screen, calculate ground position
    const terrainHeight = terrain.getHeightAt(x);
    this.y = -50; // Start above the visible area
    this.targetY = MAP_HEIGHT - terrainHeight - 15; // Land on terrain
    this.isFalling = true;

    this.bobOffset = Math.random() * Math.PI * 2;
    this.bobSpeed = 2 + Math.random() * 1;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.sparkleParticles = [];
    this.sparkleTimer = 0;

    this.collectAnimTime = 0;
  }

  // Check if a spawn position has valid ground
  static isValidSpawnPosition(x: number, terrain: Terrain): boolean {
    const terrainHeight = terrain.getHeightAt(x);
    return terrainHeight > 0;
  }

  // Update falling state - returns true when landed
  updateFalling(deltaTime: number): boolean {
    if (!this.isFalling) return false;

    // Apply gravity acceleration (no cap - keeps accelerating throughout fall)
    this.velocityY += POWERUP_GRAVITY * deltaTime;

    this.y += this.velocityY * deltaTime;

    // Check if landed
    if (this.y >= this.targetY) {
      this.y = this.targetY;
      this.isFalling = false;
      this.velocityY = 0;
      return true;
    }

    // Update sparkle particles while falling
    this.sparkleTimer -= deltaTime;
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.1;
      this.spawnSparkle();
    }

    for (const particle of this.sparkleParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.life -= deltaTime;
    }
    this.sparkleParticles = this.sparkleParticles.filter(p => p.life > 0);

    return false;
  }

  update(deltaTime: number, ants: Ant[]): Ant | null {
    if (!this.active) {
      // Update collection animation
      if (this.collected) {
        this.collectAnimTime += deltaTime;
        // Update sparkle particles
        for (const particle of this.sparkleParticles) {
          particle.x += particle.vx * deltaTime;
          particle.y += particle.vy * deltaTime;
          particle.vy += 100 * deltaTime; // Gravity
          particle.life -= deltaTime;
        }
        this.sparkleParticles = this.sparkleParticles.filter(p => p.life > 0);
      }
      return null;
    }

    // Don't allow collection while falling
    if (this.isFalling) return null;

    // Update animations
    this.bobOffset += deltaTime * this.bobSpeed;
    this.pulsePhase += deltaTime * 4;

    // Spawn sparkle particles
    this.sparkleTimer -= deltaTime;
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.15;
      this.spawnSparkle();
    }

    // Update sparkle particles
    for (const particle of this.sparkleParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.life -= deltaTime;
    }
    this.sparkleParticles = this.sparkleParticles.filter(p => p.life > 0);

    // Check collision with ants
    for (const ant of ants) {
      if (!ant.isAlive) continue;

      const dx = ant.x - this.x;
      const dy = (ant.y - 10) - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 35) { // Collection radius
        this.collect();
        return ant;
      }
    }

    return null;
  }

  private collect(): void {
    this.active = false;
    this.collected = true;
    this.collectAnimTime = 0;

    // Spawn collection burst particles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      this.sparkleParticles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.5 + Math.random() * 0.3,
        size: 3 + Math.random() * 3,
        color: this.config.color,
      });
    }
  }

  private spawnSparkle(): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 10;
    this.sparkleParticles.push({
      x: this.x + Math.cos(angle) * distance,
      y: this.y + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 20,
      life: 0.6 + Math.random() * 0.4,
      size: 2 + Math.random() * 2,
      color: this.config.color,
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Draw sparkle particles (always, even during collection)
    for (const particle of this.sparkleParticles) {
      const alpha = particle.life / 1.0;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.fillStyle = `${particle.color}88`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (!this.active) return;

    const bobY = this.isFalling ? this.y : this.y + Math.sin(this.bobOffset) * 5;
    const pulse = this.isFalling ? 1.0 : 0.9 + Math.sin(this.pulsePhase) * 0.1;

    // Pixel art health crate - 10x10 base at scale 2 (20x20 pixels)
    const scale = 2;
    const size = 10 * scale;
    const halfSize = size / 2;

    ctx.save();
    ctx.translate(this.x, bobY);
    ctx.scale(pulse, pulse);

    // Outer glow
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, halfSize * 2);
    glowGradient.addColorStop(0, 'rgba(78, 203, 113, 0.5)');
    glowGradient.addColorStop(0.5, 'rgba(78, 203, 113, 0.2)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw pixel art crate
    this.drawPixelArtCrate(ctx, -halfSize, -halfSize, scale);

    ctx.restore();

    // Shadow beneath (only when not falling or close to ground)
    if (!this.isFalling || this.y > this.targetY - 50) {
      const shadowAlpha = this.isFalling ? Math.max(0, 1 - (this.targetY - this.y) / 50) * 0.3 : 0.3;
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(this.x, this.targetY + 15, 12 * pulse, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPixelArtCrate(ctx: CanvasRenderingContext2D, startX: number, startY: number, scale: number): void {
    // Color palette
    const crateMain = '#8B5A2B';
    const crateLight = '#A67B5B';
    const crateDark = '#5D3A1A';
    const crossMain = '#4ECB71';
    const crossLight = '#6EEB91';
    const crossDark = '#2EA351';
    const metalBand = '#6B6B6B';
    const metalHighlight = '#8A8A8A';

    // Helper to draw a pixel
    const pixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(startX + x * scale, startY + y * scale, scale, scale);
    };

    // Draw crate body (10x10 grid)
    // Row 0 - top metal band
    pixel(0, 0, crateDark);
    pixel(1, 0, metalBand);
    pixel(2, 0, metalHighlight);
    pixel(3, 0, metalBand);
    pixel(4, 0, metalHighlight);
    pixel(5, 0, metalHighlight);
    pixel(6, 0, metalBand);
    pixel(7, 0, metalHighlight);
    pixel(8, 0, metalBand);
    pixel(9, 0, crateDark);

    // Row 1 - top of crate
    pixel(0, 1, crateDark);
    pixel(1, 1, crateLight);
    pixel(2, 1, crateMain);
    pixel(3, 1, crateMain);
    pixel(4, 1, crateMain);
    pixel(5, 1, crateMain);
    pixel(6, 1, crateMain);
    pixel(7, 1, crateMain);
    pixel(8, 1, crateLight);
    pixel(9, 1, crateDark);

    // Rows 2-7 - main body with cross
    // Row 2
    pixel(0, 2, crateDark);
    pixel(1, 2, crateMain);
    pixel(2, 2, crateMain);
    pixel(3, 2, crateMain);
    pixel(4, 2, crossLight);
    pixel(5, 2, crossMain);
    pixel(6, 2, crateMain);
    pixel(7, 2, crateMain);
    pixel(8, 2, crateMain);
    pixel(9, 2, crateDark);

    // Row 3
    pixel(0, 3, crateDark);
    pixel(1, 3, crateMain);
    pixel(2, 3, crateMain);
    pixel(3, 3, crateMain);
    pixel(4, 3, crossMain);
    pixel(5, 3, crossDark);
    pixel(6, 3, crateMain);
    pixel(7, 3, crateMain);
    pixel(8, 3, crateMain);
    pixel(9, 3, crateDark);

    // Row 4 - horizontal part of cross
    pixel(0, 4, crateDark);
    pixel(1, 4, crateMain);
    pixel(2, 4, crossLight);
    pixel(3, 4, crossMain);
    pixel(4, 4, crossMain);
    pixel(5, 4, crossMain);
    pixel(6, 4, crossMain);
    pixel(7, 4, crossDark);
    pixel(8, 4, crateMain);
    pixel(9, 4, crateDark);

    // Row 5 - horizontal part of cross
    pixel(0, 5, crateDark);
    pixel(1, 5, crateMain);
    pixel(2, 5, crossMain);
    pixel(3, 5, crossDark);
    pixel(4, 5, crossDark);
    pixel(5, 5, crossDark);
    pixel(6, 5, crossDark);
    pixel(7, 5, crossDark);
    pixel(8, 5, crateMain);
    pixel(9, 5, crateDark);

    // Row 6
    pixel(0, 6, crateDark);
    pixel(1, 6, crateMain);
    pixel(2, 6, crateMain);
    pixel(3, 6, crateMain);
    pixel(4, 6, crossMain);
    pixel(5, 6, crossDark);
    pixel(6, 6, crateMain);
    pixel(7, 6, crateMain);
    pixel(8, 6, crateMain);
    pixel(9, 6, crateDark);

    // Row 7
    pixel(0, 7, crateDark);
    pixel(1, 7, crateMain);
    pixel(2, 7, crateMain);
    pixel(3, 7, crateMain);
    pixel(4, 7, crossMain);
    pixel(5, 7, crossDark);
    pixel(6, 7, crateMain);
    pixel(7, 7, crateMain);
    pixel(8, 7, crateMain);
    pixel(9, 7, crateDark);

    // Row 8 - bottom of crate
    pixel(0, 8, crateDark);
    pixel(1, 8, crateLight);
    pixel(2, 8, crateMain);
    pixel(3, 8, crateMain);
    pixel(4, 8, crateMain);
    pixel(5, 8, crateMain);
    pixel(6, 8, crateMain);
    pixel(7, 8, crateMain);
    pixel(8, 8, crateDark);
    pixel(9, 8, crateDark);

    // Row 9 - bottom metal band
    pixel(0, 9, crateDark);
    pixel(1, 9, metalBand);
    pixel(2, 9, metalHighlight);
    pixel(3, 9, metalBand);
    pixel(4, 9, metalHighlight);
    pixel(5, 9, metalHighlight);
    pixel(6, 9, metalBand);
    pixel(7, 9, metalHighlight);
    pixel(8, 9, metalBand);
    pixel(9, 9, crateDark);
  }

  // Check if powerup and its particles are fully gone
  isComplete(): boolean {
    return !this.active && this.sparkleParticles.length === 0;
  }
}
