import { MAP_HEIGHT } from '../constants.ts';
import { PowerUpType, PowerUpConfig, POWERUP_CONFIGS } from './PowerUpTypes.ts';
import { Terrain } from '../Terrain.ts';
import { Ant } from '../Ant.ts';

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
  type: PowerUpType;
  config: PowerUpConfig;
  active: boolean;
  collected: boolean;

  // Animation
  private bobOffset: number;
  private bobSpeed: number;
  private rotationAngle: number;
  private pulsePhase: number;
  private sparkleParticles: SparkleParticle[];
  private sparkleTimer: number;

  // Collection animation
  private collectAnimTime: number;

  constructor(x: number, terrain: Terrain, type: PowerUpType) {
    this.x = x;
    this.y = MAP_HEIGHT - terrain.getHeightAt(x) - 30; // Float above terrain
    this.type = type;
    this.config = POWERUP_CONFIGS[type];
    this.active = true;
    this.collected = false;

    this.bobOffset = Math.random() * Math.PI * 2;
    this.bobSpeed = 2 + Math.random() * 1;
    this.rotationAngle = 0;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.sparkleParticles = [];
    this.sparkleTimer = 0;

    this.collectAnimTime = 0;
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

    // Update animations
    this.bobOffset += deltaTime * this.bobSpeed;
    this.rotationAngle += deltaTime * 2;
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

    const bobY = this.y + Math.sin(this.bobOffset) * 5;
    const pulse = 0.8 + Math.sin(this.pulsePhase) * 0.2;
    const baseRadius = 15;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(
      this.x, bobY, 0,
      this.x, bobY, baseRadius * 2.5 * pulse
    );
    glowGradient.addColorStop(0, `${this.config.color}88`);
    glowGradient.addColorStop(0.5, `${this.config.color}44`);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(this.x, bobY, baseRadius * 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Main body - circular with ring
    ctx.fillStyle = this.config.color;
    ctx.beginPath();
    ctx.arc(this.x, bobY, baseRadius * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = '#FFF';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(this.x - 4, bobY - 4, baseRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Rotating ring
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(
      this.x, bobY,
      baseRadius * 1.3,
      baseRadius * 0.4,
      this.rotationAngle,
      0, Math.PI * 2
    );
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Icon/symbol
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${14 * pulse}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.config.icon, this.x, bobY);

    // Shadow beneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 25, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Check if powerup and its particles are fully gone
  isComplete(): boolean {
    return !this.active && this.sparkleParticles.length === 0;
  }
}
