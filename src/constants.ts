// Base game dimensions (logic coordinates)
export const BASE_WIDTH = 800;
export const BASE_HEIGHT = 500;

// These will be updated dynamically
export let CANVAS_WIDTH = 800;
export let CANVAS_HEIGHT = 500;
export let SCALE_X = 1;
export let SCALE_Y = 1;

export function updateCanvasSize(width: number, height: number): void {
  CANVAS_WIDTH = width;
  CANVAS_HEIGHT = height;
  SCALE_X = width / BASE_WIDTH;
  SCALE_Y = height / BASE_HEIGHT;
}

// Physics (in base coordinates)
export const GRAVITY = 150; // pixels per second squared
export const MAX_POWER = 400; // max initial velocity
export const WIND_STRENGTH_MAX = 30; // max wind effect

// Tank properties (in base coordinates)
export const TANK_WIDTH = 40;
export const TANK_HEIGHT = 20;
export const BARREL_LENGTH = 25;
export const BARREL_WIDTH = 6;

// Projectile
export const PROJECTILE_RADIUS = 4;

// Explosion
export const EXPLOSION_RADIUS = 35;
export const EXPLOSION_DAMAGE_RADIUS = 40;

// Terrain
export const TERRAIN_COLOR = '#8B4513';
export const SKY_COLOR = '#87CEEB';

// Player colors
export const PLAYER_COLORS = [
  '#FF6B6B', // Red
  '#4ECB71', // Green
  '#FFD93D', // Yellow
  '#6BCB77', // Light green
  '#4D96FF', // Blue
  '#FF6FB5', // Pink
];
