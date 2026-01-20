// Base game dimensions (view/window logic coordinates)
export const BASE_WIDTH = 800;
export const BASE_HEIGHT = 500;

// Map dimensions (larger than view to allow camera movement)
export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 1200; // Extra height for projectiles going up

// Terrain generation bounds (fixed values, not proportional to MAP_HEIGHT)
// These define where the terrain surface should be generated
export const TERRAIN_MIN_HEIGHT = 150; // Minimum terrain height from bottom
export const TERRAIN_MAX_HEIGHT = 400; // Maximum terrain height from bottom

// Camera home position offset (centers view on terrain area)
// This offsets the view downward to show the terrain instead of empty sky
export const CAMERA_HOME_OFFSET_Y = -(MAP_HEIGHT - BASE_HEIGHT - TERRAIN_MAX_HEIGHT);

// Parallax factor for background layer (0 = no movement, 1 = full movement like gameplay)
export const BACKGROUND_PARALLAX = 0.3;

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
