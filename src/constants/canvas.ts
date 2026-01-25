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

// Camera home position offset (centers view on terrain area)
export const CAMERA_HOME_OFFSET_Y = -(MAP_HEIGHT - BASE_HEIGHT - 650); // 650 is TERRAIN_MAX_HEIGHT

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
