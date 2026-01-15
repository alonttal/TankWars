import {
  GRAVITY,
  PROJECTILE_RADIUS,
  BASE_WIDTH,
  BASE_HEIGHT,
} from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Tank } from './Tank.ts';

export interface ProjectileState {
  active: boolean;
  hit: boolean;
  hitX: number;
  hitY: number;
}

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: { x: number; y: number }[];
  owner: Tank;

  constructor(startX: number, startY: number, angle: number, power: number, wind: number, owner: Tank) {
    this.x = startX;
    this.y = startY;
    this.owner = owner;

    // Convert angle to radians and calculate initial velocity
    const angleRad = (angle * Math.PI) / 180;
    this.vx = Math.cos(angleRad) * power + wind * 0.5;
    this.vy = -Math.sin(angleRad) * power; // Negative because Y increases downward

    this.active = true;
    this.trail = [];
  }

  update(deltaTime: number, terrain: Terrain, tanks: Tank[], wind: number): ProjectileState {
    if (!this.active) {
      return { active: false, hit: false, hitX: 0, hitY: 0 };
    }

    // Store trail point
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 50) {
      this.trail.shift();
    }

    // Apply physics
    this.vx += wind * deltaTime * 0.5; // Wind affects horizontal velocity
    this.vy += GRAVITY * deltaTime; // Gravity

    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Check if out of bounds
    if (this.x < -50 || this.x > BASE_WIDTH + 50 || this.y > BASE_HEIGHT + 50) {
      this.active = false;
      return { active: false, hit: false, hitX: 0, hitY: 0 };
    }

    // Check terrain collision
    const terrainY = BASE_HEIGHT - terrain.getHeightAt(this.x);
    if (this.y >= terrainY) {
      this.active = false;
      return { active: false, hit: true, hitX: this.x, hitY: this.y };
    }

    // Check tank collision
    for (const tank of tanks) {
      if (!tank.isAlive || tank === this.owner) continue;

      const dx = this.x - tank.x;
      const dy = this.y - (tank.y - 10); // Approximate tank center
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 25) { // Hit radius
        this.active = false;
        return { active: false, hit: true, hitX: this.x, hitY: this.y };
      }
    }

    return { active: true, hit: false, hitX: 0, hitY: 0 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active && this.trail.length === 0) return;

    // Draw trail
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);

      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }

    // Draw projectile
    if (this.active) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(this.x, this.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect
      ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, PROJECTILE_RADIUS * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
