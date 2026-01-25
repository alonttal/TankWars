import { ANT_PIXEL_SCALE, DeathAnimationState } from '../../types/AntParticleTypes.ts';
import { TANK_WIDTH, TANK_HEIGHT, MAP_HEIGHT } from '../../constants.ts';
import { Terrain } from '../../Terrain.ts';

// Re-define AntDeathData interface here (matches AntDeathSystem.ts)
export interface AntDeathData {
  x: number;
  y: number;
  color: string;
  facingRight: boolean;
  idleTime: number;
}

export function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * ANT_PIXEL_SCALE, y * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
}

export function parseColor(color: string): { r: number; g: number; b: number } {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  const num = parseInt(color.replace('#', ''), 16);
  return {
    r: (num >> 16) & 0xFF,
    g: (num >> 8) & 0xFF,
    b: num & 0xFF,
  };
}

export function lightenColor(color: string, amount: number): string {
  const { r, g, b } = parseColor(color);
  return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
}

export function darkenColor(color: string, amount: number): string {
  const { r, g, b } = parseColor(color);
  return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
}

export function getGroundYAt(terrain: Terrain | null, x: number, fallbackY: number): number {
  if (terrain) {
    const terrainHeight = terrain.getHeightAt(x);
    return MAP_HEIGHT - terrainHeight;
  }
  return fallbackY;
}

export function renderAntWithTint(ctx: CanvasRenderingContext2D, ant: AntDeathData, tintColor: string): void {
  const baseAntWidth = 12;
  const scale = TANK_WIDTH / (baseAntWidth * ANT_PIXEL_SCALE);

  ctx.save();
  ctx.translate(ant.x, ant.y - TANK_HEIGHT / 2);
  ctx.scale(scale, scale);

  if (!ant.facingRight) {
    ctx.scale(-1, 1);
  }

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = tintColor;
  ctx.fillRect(-6 * ANT_PIXEL_SCALE, -3 * ANT_PIXEL_SCALE, 12 * ANT_PIXEL_SCALE, 7 * ANT_PIXEL_SCALE);
  ctx.globalAlpha = 1.0;

  ctx.restore();
}

export function renderCollapsedBody(ctx: CanvasRenderingContext2D, ant: AntDeathData): void {
  const baseWidth = 14;
  const scale = TANK_WIDTH / (baseWidth * ANT_PIXEL_SCALE);

  ctx.save();
  ctx.translate(ant.x, ant.y);
  ctx.scale(scale, scale);

  if (!ant.facingRight) {
    ctx.scale(-1, 1);
  }

  // Flattened body
  ctx.fillStyle = darkenColor(ant.color, 60);
  for (let i = -4; i <= 4; i++) {
    drawPixel(ctx, i, 0, darkenColor(ant.color, 60));
  }
  for (let i = -2; i <= 2; i++) {
    drawPixel(ctx, i, -1, darkenColor(ant.color, 40));
  }

  ctx.restore();
}

export function renderDeadAntBody(
  ctx: CanvasRenderingContext2D,
  ant: AntDeathData,
  state: DeathAnimationState
): void {
  const baseAntWidth = 12;
  const scale = TANK_WIDTH / (baseAntWidth * ANT_PIXEL_SCALE);

  ctx.save();
  ctx.translate(ant.x, ant.y - TANK_HEIGHT / 2);
  ctx.scale(scale, scale);

  if (!ant.facingRight) {
    ctx.scale(-1, 1);
  }

  // Dead body tilted on its side with x marks for eyes
  ctx.rotate(Math.PI / 6);

  // Faded body color
  const fadeAmount = Math.min(80, state.deathAnimationTimer * 20);
  const bodyColor = darkenColor(ant.color, fadeAmount);

  // Body segments
  ctx.fillStyle = bodyColor;
  for (let i = -3; i <= 3; i++) {
    drawPixel(ctx, i, 0, bodyColor);
    if (i >= -1 && i <= 1) {
      drawPixel(ctx, i, -1, bodyColor);
    }
  }

  // Dead eyes (X marks)
  ctx.fillStyle = '#888';
  drawPixel(ctx, -2, -2, '#888');
  drawPixel(ctx, 0, -2, '#888');

  ctx.restore();
}
