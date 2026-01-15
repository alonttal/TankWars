import {
  TANK_WIDTH,
  TANK_HEIGHT,
  BARREL_LENGTH,
  BARREL_WIDTH,
  BASE_HEIGHT
} from './constants.ts';
import { Terrain } from './Terrain.ts';

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export class Tank {
  x: number;
  y: number;
  angle: number; // in degrees, 0 = right, 90 = up, 180 = left
  color: string;
  health: number;
  isAlive: boolean;
  playerIndex: number;
  facingRight: boolean;

  // Damage visuals
  private smokeParticles: SmokeParticle[];
  private smokeTimer: number;
  private damageFlash: number;

  constructor(x: number, y: number, color: string, playerIndex: number, facingRight: boolean) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.playerIndex = playerIndex;
    this.facingRight = facingRight;
    this.angle = facingRight ? 45 : 135; // Default angle pointing up and towards center
    this.health = 100;
    this.isAlive = true;
    this.smokeParticles = [];
    this.smokeTimer = 0;
    this.damageFlash = 0;
  }

  updatePosition(terrain: Terrain): void {
    // Update Y position to sit on terrain
    this.y = BASE_HEIGHT - terrain.getHeightAt(this.x);
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    this.damageFlash = 0.3; // Flash for 0.3 seconds
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
    }
  }

  update(deltaTime: number): void {
    // Update damage flash
    if (this.damageFlash > 0) {
      this.damageFlash -= deltaTime;
    }

    // Spawn smoke when damaged
    if (this.isAlive && this.health < 50) {
      this.smokeTimer -= deltaTime;
      if (this.smokeTimer <= 0) {
        // Spawn rate increases as health decreases
        const spawnRate = this.health < 25 ? 0.1 : 0.2;
        this.smokeTimer = spawnRate;

        this.smokeParticles.push({
          x: this.x + (Math.random() - 0.5) * TANK_WIDTH * 0.5,
          y: this.y - TANK_HEIGHT,
          vx: (Math.random() - 0.5) * 10,
          vy: -20 - Math.random() * 20,
          life: 0.8 + Math.random() * 0.5,
          size: 4 + Math.random() * 4,
        });
      }
    }

    // Update smoke particles
    for (const particle of this.smokeParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 5 * deltaTime; // Smoke rises
      particle.size += deltaTime * 6; // Expands
      particle.life -= deltaTime;
    }

    // Remove dead particles
    this.smokeParticles = this.smokeParticles.filter(p => p.life > 0);
  }

  getBarrelEnd(): { x: number; y: number } {
    const angleRad = (this.angle * Math.PI) / 180;
    return {
      x: this.x + Math.cos(angleRad) * BARREL_LENGTH,
      y: this.y - TANK_HEIGHT / 2 - Math.sin(angleRad) * BARREL_LENGTH,
    };
  }

  render(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean): void {
    if (!this.isAlive) {
      this.renderDestroyed(ctx);
      return;
    }

    // Draw smoke particles (behind tank)
    for (const particle of this.smokeParticles) {
      const alpha = (particle.life / 1.3) * 0.5;
      const gray = 80 + Math.random() * 40;
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const tankY = this.y - TANK_HEIGHT;

    // Damage flash effect
    let tankColor = this.color;
    if (this.damageFlash > 0) {
      tankColor = '#fff'; // Flash white when hit
    }

    // Draw tank body
    ctx.fillStyle = tankColor;
    ctx.fillRect(
      this.x - TANK_WIDTH / 2,
      tankY,
      TANK_WIDTH,
      TANK_HEIGHT
    );

    // Draw tank turret (dome on top)
    ctx.beginPath();
    ctx.arc(this.x, tankY, TANK_WIDTH / 4, Math.PI, 0);
    ctx.fill();

    // Draw barrel
    const angleRad = (this.angle * Math.PI) / 180;
    const barrelStartX = this.x;
    const barrelStartY = tankY;
    const barrelEndX = barrelStartX + Math.cos(angleRad) * BARREL_LENGTH;
    const barrelEndY = barrelStartY - Math.sin(angleRad) * BARREL_LENGTH;

    ctx.strokeStyle = tankColor;
    ctx.lineWidth = BARREL_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(barrelStartX, barrelStartY);
    ctx.lineTo(barrelEndX, barrelEndY);
    ctx.stroke();

    // Draw tracks
    ctx.fillStyle = '#333';
    ctx.fillRect(
      this.x - TANK_WIDTH / 2,
      this.y - 5,
      TANK_WIDTH,
      5
    );

    // Highlight current player
    if (isCurrentPlayer) {
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x - TANK_WIDTH / 2 - 3,
        tankY - 3,
        TANK_WIDTH + 6,
        TANK_HEIGHT + 8
      );

      // Draw player indicator arrow
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.moveTo(this.x, tankY - 20);
      ctx.lineTo(this.x - 8, tankY - 30);
      ctx.lineTo(this.x + 8, tankY - 30);
      ctx.closePath();
      ctx.fill();
    }

    // Draw health bar
    const healthBarWidth = TANK_WIDTH;
    const healthBarHeight = 5;
    const healthBarY = tankY - 15;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(
      this.x - healthBarWidth / 2,
      healthBarY,
      healthBarWidth,
      healthBarHeight
    );

    // Health
    const healthPercent = this.health / 100;
    ctx.fillStyle = healthPercent > 0.5 ? '#4ECB71' : healthPercent > 0.25 ? '#FFD93D' : '#FF6B6B';
    ctx.fillRect(
      this.x - healthBarWidth / 2,
      healthBarY,
      healthBarWidth * healthPercent,
      healthBarHeight
    );
  }

  private renderDestroyed(ctx: CanvasRenderingContext2D): void {
    // Draw destroyed tank (darker, with smoke)
    ctx.fillStyle = '#444';
    ctx.fillRect(
      this.x - TANK_WIDTH / 2,
      this.y - TANK_HEIGHT / 2,
      TANK_WIDTH,
      TANK_HEIGHT / 2
    );

    // Draw some debris/smoke
    ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
    ctx.beginPath();
    ctx.arc(this.x, this.y - TANK_HEIGHT, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}
