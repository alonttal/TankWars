// Base game dimensions (view/window logic coordinates)
export const BASE_WIDTH = 800;
export const BASE_HEIGHT = 500;

// Map dimensions (larger than view to allow camera movement)
// Extra width/height provides "sky buffer" to allow centering on ants at edges
export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1100;

// Playable area - where terrain is generated and ants can spawn
// This is centered within the map, with sky buffer around it
export const PLAYABLE_WIDTH = 1600;  // Original terrain width
export const PLAYABLE_HEIGHT = 800;  // Original terrain height
export const PLAYABLE_OFFSET_X = (MAP_WIDTH - PLAYABLE_WIDTH) / 2;   // 400px buffer on each side
export const PLAYABLE_OFFSET_Y = (MAP_HEIGHT - PLAYABLE_HEIGHT) / 2; // 150px buffer top/bottom

// Terrain bitmap scale - each bitmap cell represents NxN screen pixels
// Higher = faster/less memory, Lower = more detail
export const TERRAIN_SCALE = 4; // 4x4 pixels per cell = 16x less memory

// Terrain generation bounds (relative to playable area bottom)
// These define where the terrain surface should be generated
export const TERRAIN_MIN_HEIGHT = 50;  // Minimum terrain height (deep valleys)
export const TERRAIN_MAX_HEIGHT = 650; // Maximum terrain height (tall mountains)

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

// Movement
export const MOVEMENT_SPEED = 50; // pixels per second
export const JUMP_FORCE = 180; // initial upward velocity
export const MAX_MOVEMENT_ENERGY = 100; // energy units per turn
export const MOVEMENT_ENERGY_COST = 25; // energy cost per second of walking
export const JUMP_ENERGY_COST = 20; // energy cost per jump
export const MAX_SLOPE_ANGLE = 50; // max climbable slope in degrees

// Ant properties (in base coordinates) - keeping TANK_ prefix for now until visual redesign
export const TANK_WIDTH = 40;
export const TANK_HEIGHT = 20;
export const BARREL_LENGTH = 25;
export const BARREL_WIDTH = 6;

// Projectile
export const PROJECTILE_RADIUS = 4;

// Explosion
export const EXPLOSION_RADIUS = 35;
export const EXPLOSION_DAMAGE_RADIUS = 40;

// Knockback physics
export const KNOCKBACK_DAMAGE_MULTIPLIER = 3.0;
export const KNOCKBACK_MIN_FORCE = 50;
export const KNOCKBACK_MAX_FORCE = 350;
export const KNOCKBACK_DAMAGE_THRESHOLD = 10;
export const FALL_DAMAGE_VELOCITY_THRESHOLD = 200;
export const FALL_DAMAGE_MULTIPLIER = 0.1;

// Terrain
export const TERRAIN_COLOR = '#8B4513';
export const SKY_COLOR = '#87CEEB';

// Team configuration
export const NUM_TEAMS = 2;
export const ANTS_PER_TEAM = 8;
export const TEAM_COLORS = ['#FF6B6B', '#4ECB71']; // Red team, Green team

// Player colors (legacy - still used for individual color references)
export const PLAYER_COLORS = [
  '#FF6B6B', // Red
  '#4ECB71', // Green
  '#FFD93D', // Yellow
  '#6BCB77', // Light green
  '#4D96FF', // Blue
  '#FF6FB5', // Pink
];
