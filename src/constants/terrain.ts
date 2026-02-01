// Terrain bitmap scale - each bitmap cell represents NxN screen pixels
// Higher = faster/less memory, Lower = more detail
export const TERRAIN_SCALE = 4; // 4x4 pixels per cell = 16x less memory

// Terrain generation bounds (relative to playable area bottom)
// These define where the terrain surface should be generated
export const TERRAIN_MIN_HEIGHT = 50;  // Minimum terrain height (deep valleys)
export const TERRAIN_MAX_HEIGHT = 650; // Maximum terrain height (tall mountains)

// Water level (world Y coordinate where water begins)
// Playable bottom is at y=950, lowest terrain valleys reach ~y=900
// Setting to 930 keeps water mostly hidden unless terrain is destroyed
export const WATER_LEVEL = 930;

// Terrain colors
export const TERRAIN_COLOR = '#8B4513';
export const SKY_COLOR = '#87CEEB';
