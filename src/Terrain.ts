import { BASE_WIDTH, BASE_HEIGHT, MAP_WIDTH, MAP_HEIGHT, TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT, TERRAIN_SCALE, PLAYABLE_WIDTH, PLAYABLE_HEIGHT, PLAYABLE_OFFSET_X, PLAYABLE_OFFSET_Y } from './constants.ts';

interface TerrainTheme {
  name: string;
  deepRock: string;
  darkSoil: string;
  mainSoil: string;
  mainSoilDark: string;
  topSoil: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  rockColor: string;
  rockHighlight: string;
}

const TERRAIN_THEMES: TerrainTheme[] = [
  {
    name: 'Grassland',
    deepRock: '#4A3728',
    darkSoil: '#5C4033',
    mainSoil: '#8B5A2B',
    mainSoilDark: '#6B4423',
    topSoil: '#4A7023',
    skyTop: '#4A90D9',
    skyMid: '#87CEEB',
    skyBottom: '#B0E0FF',
    rockColor: '#696969',
    rockHighlight: '#8B8B8B',
  },
  {
    name: 'Desert',
    deepRock: '#8B7355',
    darkSoil: '#C4A35A',
    mainSoil: '#DEB887',
    mainSoilDark: '#D2A95A',
    topSoil: '#F4D59E',
    skyTop: '#5DA3D9',
    skyMid: '#A8D8FF',
    skyBottom: '#FFE4B5',
    rockColor: '#A0826D',
    rockHighlight: '#C4A882',
  },
  {
    name: 'Arctic',
    deepRock: '#4A5568',
    darkSoil: '#718096',
    mainSoil: '#A0AEC0',
    mainSoilDark: '#8899A6',
    topSoil: '#E8EEF4',
    skyTop: '#2B4B6F',
    skyMid: '#6B8EAE',
    skyBottom: '#C5D5E8',
    rockColor: '#5A6978',
    rockHighlight: '#8899A8',
  },
  {
    name: 'Volcanic',
    deepRock: '#1A1A1A',
    darkSoil: '#2D2D2D',
    mainSoil: '#3D3D3D',
    mainSoilDark: '#2A2A2A',
    topSoil: '#4A4A4A',
    skyTop: '#4A2020',
    skyMid: '#8B4513',
    skyBottom: '#CD853F',
    rockColor: '#2D2D2D',
    rockHighlight: '#5A5A5A',
  },
  {
    name: 'Autumn',
    deepRock: '#4A3728',
    darkSoil: '#6B4423',
    mainSoil: '#8B6914',
    mainSoilDark: '#6B5010',
    topSoil: '#B8860B',
    skyTop: '#4682B4',
    skyMid: '#87CEEB',
    skyBottom: '#FFE4C4',
    rockColor: '#696969',
    rockHighlight: '#8B8B8B',
  },
  {
    name: 'Martian',
    deepRock: '#5C2E00',
    darkSoil: '#8B3A00',
    mainSoil: '#CD5C00',
    mainSoilDark: '#A04800',
    topSoil: '#E07020',
    skyTop: '#2B1810',
    skyMid: '#4A2820',
    skyBottom: '#8B5A50',
    rockColor: '#6B3A2A',
    rockHighlight: '#9B5A4A',
  },
];

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

interface WindParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  length: number;
  wavePhase: number;
}

interface AmbientDust {
  x: number;
  y: number;
  size: number;
  opacity: number;
  floatSpeed: number;
  floatPhase: number;
  driftSpeed: number;
}

interface ScorchMark {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  rotation: number;
}

// Terrain generation constants
const CAVE_DENSITY = 0.45;
const CAVE_ITERATIONS = 4;
const OVERHANG_STRENGTH = 25;
const ARCH_COUNT_MIN = 2;
const ARCH_COUNT_MAX = 4;

export class Terrain {
  // Bitmap terrain - 2D grid where each cell is solid (255) or empty (0)
  // Each cell represents TERRAIN_SCALE x TERRAIN_SCALE screen pixels
  private terrainBitmap: Uint8Array;
  private readonly bitmapWidth = Math.ceil(MAP_WIDTH / TERRAIN_SCALE);
  private readonly bitmapHeight = Math.ceil(MAP_HEIGHT / TERRAIN_SCALE);

  // Background clouds
  private clouds: Cloud[];

  // Wind particles
  private windParticles: WindParticle[];
  private currentWind: number;

  // Ambient floating dust
  private ambientDust: AmbientDust[];

  // Sun position
  private sunX: number;
  private sunY: number;
  private sunPulse: number;

  // Scorch marks from explosions
  private scorchMarks: ScorchMark[];

  // Current terrain theme
  private theme: TerrainTheme;

  // Cached terrain rendering for performance
  private terrainCache: OffscreenCanvas | null;
  private terrainCacheCtx: OffscreenCanvasRenderingContext2D | null;
  private terrainDirty: boolean;

  // Perlin noise permutation table
  private perm: number[];

  // Cache of surface Y values for each bitmap X (avoids scanning from top each time)
  private surfaceYCache: Int16Array;

  // Pre-generated noise texture at 1/4 resolution
  private noiseTexture: Float32Array | null = null;
  private noiseTextureWidth: number = 0;
  private noiseTextureHeight: number = 0;

  // Color lookup table for depth bands (0-150 depth values)
  private colorLUT: Uint8Array | null = null;

  constructor() {
    this.terrainBitmap = new Uint8Array(this.bitmapWidth * this.bitmapHeight);
    this.surfaceYCache = new Int16Array(this.bitmapWidth);
    this.surfaceYCache.fill(-1);
    this.clouds = [];
    this.windParticles = [];
    this.ambientDust = [];
    this.currentWind = 0;
    this.sunX = MAP_WIDTH * 0.85;
    this.sunY = 150;
    this.sunPulse = 0;
    this.scorchMarks = [];
    this.theme = TERRAIN_THEMES[0];
    this.terrainCache = null;
    this.terrainCacheCtx = null;
    this.terrainDirty = true;
    this.perm = this.generatePermutationTable();
    this.generateClouds();
    this.generateAmbientDust();
  }

  // Bitmap helper methods - convert world coordinates to bitmap coordinates
  private getPixel(x: number, y: number): number {
    const ix = Math.floor(x / TERRAIN_SCALE);
    const iy = Math.floor(y / TERRAIN_SCALE);
    if (ix < 0 || ix >= this.bitmapWidth || iy < 0 || iy >= this.bitmapHeight) {
      return 0;
    }
    return this.terrainBitmap[iy * this.bitmapWidth + ix];
  }

  private setPixel(x: number, y: number, value: number = 255): void {
    const ix = Math.floor(x / TERRAIN_SCALE);
    const iy = Math.floor(y / TERRAIN_SCALE);
    if (ix < 0 || ix >= this.bitmapWidth || iy < 0 || iy >= this.bitmapHeight) {
      return;
    }
    this.terrainBitmap[iy * this.bitmapWidth + ix] = value;
  }

  private clearPixel(x: number, y: number): void {
    this.setPixel(x, y, 0);
  }

  // Direct bitmap access methods (for generation - use bitmap coordinates)
  private getBitmapCell(bx: number, by: number): number {
    if (bx < 0 || bx >= this.bitmapWidth || by < 0 || by >= this.bitmapHeight) {
      return 0;
    }
    return this.terrainBitmap[by * this.bitmapWidth + bx];
  }

  private setBitmapCell(bx: number, by: number, value: number = 255): void {
    if (bx < 0 || bx >= this.bitmapWidth || by < 0 || by >= this.bitmapHeight) {
      return;
    }
    this.terrainBitmap[by * this.bitmapWidth + bx] = value;
  }

  private clearBitmapCell(bx: number, by: number): void {
    this.setBitmapCell(bx, by, 0);
  }

  // Perlin noise implementation
  private generatePermutationTable(): number[] {
    const perm: number[] = [];
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
    }
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    // Duplicate for overflow
    for (let i = 0; i < 256; i++) {
      perm[256 + i] = perm[i];
    }
    return perm;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private perlin2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);

    return this.lerp(x1, x2, v);
  }

  // Multi-octave Perlin noise
  private octavePerlin(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.perlin2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }

  private generateAmbientDust(): void {
    this.ambientDust = [];
    for (let i = 0; i < 30; i++) {
      this.ambientDust.push({
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT * 0.5,
        size: 1 + Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.3,
        floatSpeed: 0.5 + Math.random() * 1,
        floatPhase: Math.random() * Math.PI * 2,
        driftSpeed: 2 + Math.random() * 5,
      });
    }
  }

  // Pre-generate noise texture at 1/4 resolution for rendering
  private generateNoiseTexture(): void {
    // Generate at 1/4 resolution (400x225 for 1600x900)
    this.noiseTextureWidth = Math.ceil(MAP_WIDTH / 4);
    this.noiseTextureHeight = Math.ceil(MAP_HEIGHT / 4);
    this.noiseTexture = new Float32Array(this.noiseTextureWidth * this.noiseTextureHeight);

    for (let y = 0; y < this.noiseTextureHeight; y++) {
      for (let x = 0; x < this.noiseTextureWidth; x++) {
        // Sample at world coordinates (multiply by 4 to match original scale)
        const worldX = x * 4;
        const worldY = y * 4;
        const noiseVal = this.octavePerlin(worldX * 0.05, worldY * 0.05, 2, 0.5);
        this.noiseTexture[y * this.noiseTextureWidth + x] = noiseVal * 15;
      }
    }
  }

  // Sample from pre-generated noise texture with bilinear interpolation
  private sampleNoiseTexture(x: number, y: number): number {
    if (!this.noiseTexture) return 0;

    // Convert to noise texture coordinates
    const nx = x / 4;
    const ny = y / 4;

    // Clamp to texture bounds
    const x0 = Math.max(0, Math.min(this.noiseTextureWidth - 1, Math.floor(nx)));
    const y0 = Math.max(0, Math.min(this.noiseTextureHeight - 1, Math.floor(ny)));
    const x1 = Math.min(this.noiseTextureWidth - 1, x0 + 1);
    const y1 = Math.min(this.noiseTextureHeight - 1, y0 + 1);

    // Bilinear interpolation weights
    const fx = nx - x0;
    const fy = ny - y0;

    // Sample four corners
    const v00 = this.noiseTexture[y0 * this.noiseTextureWidth + x0];
    const v10 = this.noiseTexture[y0 * this.noiseTextureWidth + x1];
    const v01 = this.noiseTexture[y1 * this.noiseTextureWidth + x0];
    const v11 = this.noiseTexture[y1 * this.noiseTextureWidth + x1];

    // Bilinear interpolation
    const v0 = v00 + (v10 - v00) * fx;
    const v1 = v01 + (v11 - v01) * fx;
    return v0 + (v1 - v0) * fy;
  }

  // Pre-generate color lookup table for depth bands (0-150 depth values)
  private generateColorLUT(): void {
    // Parse theme colors
    const deepRock = this.parseColor(this.theme.deepRock);
    const darkSoil = this.parseColor(this.theme.darkSoil);
    const mainSoil = this.parseColor(this.theme.mainSoil);
    const topSoil = this.parseColor(this.theme.topSoil);

    // LUT stores RGB for depths 0-150 (3 bytes per entry = 453 bytes)
    const maxDepth = 151;
    this.colorLUT = new Uint8Array(maxDepth * 3);

    for (let dist = 0; dist < maxDepth; dist++) {
      let r: number, g: number, b: number;

      if (dist < 4) {
        r = topSoil.r;
        g = topSoil.g;
        b = topSoil.b;
      } else if (dist < 20) {
        const t = (dist - 4) / 16;
        r = topSoil.r + (mainSoil.r - topSoil.r) * t;
        g = topSoil.g + (mainSoil.g - topSoil.g) * t;
        b = topSoil.b + (mainSoil.b - topSoil.b) * t;
      } else if (dist < 60) {
        const t = (dist - 20) / 40;
        r = mainSoil.r + (darkSoil.r - mainSoil.r) * t;
        g = mainSoil.g + (darkSoil.g - mainSoil.g) * t;
        b = mainSoil.b + (darkSoil.b - mainSoil.b) * t;
      } else if (dist < 120) {
        const t = (dist - 60) / 60;
        r = darkSoil.r + (deepRock.r - darkSoil.r) * t;
        g = darkSoil.g + (deepRock.g - darkSoil.g) * t;
        b = darkSoil.b + (deepRock.b - darkSoil.b) * t;
      } else {
        r = deepRock.r;
        g = deepRock.g;
        b = deepRock.b;
      }

      this.colorLUT[dist * 3] = Math.floor(r);
      this.colorLUT[dist * 3 + 1] = Math.floor(g);
      this.colorLUT[dist * 3 + 2] = Math.floor(b);
    }
  }

  private generateClouds(): void {
    this.clouds = [];
    const cloudCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: Math.random() * MAP_WIDTH,
        y: 80 + Math.random() * 200,
        width: 60 + Math.random() * 100,
        height: 30 + Math.random() * 40,
        speed: 5 + Math.random() * 10,
        opacity: 0.3 + Math.random() * 0.4,
      });
    }
  }

  generate(): void {
    // Pick a random terrain theme
    this.theme = TERRAIN_THEMES[Math.floor(Math.random() * TERRAIN_THEMES.length)];

    // Regenerate noise permutation for variety
    this.perm = this.generatePermutationTable();

    // Regenerate clouds and dust for new terrain
    this.generateClouds();
    this.generateAmbientDust();
    this.sunX = MAP_WIDTH * (0.6 + Math.random() * 0.3);
    this.sunY = 120 + Math.random() * 80;
    this.scorchMarks = [];

    // Clear the bitmap
    this.terrainBitmap.fill(0);

    // Generate terrain in stages
    this.generateBaseTerrain();
    this.generateCaves();
    this.generateOverhangs();
    this.generateArches();
    this.generateSurfaceHoles();

    // Build surface Y cache after all terrain modifications are done
    this.rebuildSurfaceYCache();

    // Pre-generate noise texture for rendering
    this.generateNoiseTexture();

    // Pre-generate color lookup table
    this.generateColorLUT();

    // Initialize terrain cache
    this.terrainCache = new OffscreenCanvas(MAP_WIDTH, MAP_HEIGHT);
    this.terrainCacheCtx = this.terrainCache.getContext('2d');
    this.terrainDirty = true;
  }

  // Stage 1: Generate base terrain with multi-octave Perlin noise
  // Terrain is only generated within the playable area (centered in map with sky buffer)
  private generateBaseTerrain(): void {
    // Pre-generate some random mountain/valley positions for dramatic features
    const featureCount = 4 + Math.floor(Math.random() * 4);
    const features: { x: number; strength: number; width: number; isMountain: boolean }[] = [];

    for (let i = 0; i < featureCount; i++) {
      features.push({
        x: 0.1 + Math.random() * 0.8, // Normalized position within playable area (0-1)
        strength: 0.5 + Math.random() * 0.5,
        width: 0.05 + Math.random() * 0.15,
        isMountain: Math.random() > 0.4 // 60% mountains, 40% valleys
      });
    }

    // Calculate bitmap bounds for playable area
    const playableStartBX = Math.floor(PLAYABLE_OFFSET_X / TERRAIN_SCALE);
    const playableEndBX = Math.floor((PLAYABLE_OFFSET_X + PLAYABLE_WIDTH) / TERRAIN_SCALE);
    const playableBottomY = PLAYABLE_OFFSET_Y + PLAYABLE_HEIGHT;

    for (let bx = playableStartBX; bx < playableEndBX; bx++) {
      const worldX = bx * TERRAIN_SCALE;
      // Normalize X relative to playable area (0-1)
      const normalizedX = (worldX - PLAYABLE_OFFSET_X) / PLAYABLE_WIDTH;

      // Base rolling terrain
      const baseNoise = this.octavePerlin(worldX * 0.004, 0.5, 3, 0.5);
      const detailNoise = this.octavePerlin(worldX * 0.015, 1.5, 2, 0.5);

      // Start with base height
      let heightFactor = 0.4 + baseNoise * 0.25 + detailNoise * 0.1;

      // Apply dramatic features (mountains and valleys)
      for (const feature of features) {
        const dist = Math.abs(normalizedX - feature.x);
        if (dist < feature.width) {
          // Smooth gaussian-like falloff
          const t = 1 - (dist / feature.width);
          const influence = t * t * (3 - 2 * t) * feature.strength;

          if (feature.isMountain) {
            heightFactor += influence * 0.5; // Push up for mountains
          } else {
            heightFactor -= influence * 0.4; // Push down for valleys
          }
        }
      }

      // Add some ridged noise for jagged peaks
      const ridgeNoise = Math.abs(this.octavePerlin(worldX * 0.008, 3.2, 2, 0.5));
      heightFactor += ridgeNoise * 0.15;

      // Edge tapering within playable area
      const edgeFade = Math.min(normalizedX * 4, (1 - normalizedX) * 4, 1);
      heightFactor *= (0.3 + edgeFade * 0.7);

      // Clamp and map to height range
      heightFactor = Math.max(0, Math.min(1, heightFactor));
      const terrainHeight = TERRAIN_MIN_HEIGHT + heightFactor * (TERRAIN_MAX_HEIGHT - TERRAIN_MIN_HEIGHT);

      // Fill cells from bottom up to the terrain surface
      // Surface is relative to the bottom of the playable area
      const surfaceY = playableBottomY - terrainHeight;
      const surfaceBy = Math.floor(surfaceY / TERRAIN_SCALE);
      for (let by = surfaceBy; by < this.bitmapHeight; by++) {
        this.setBitmapCell(bx, by);
      }
    }
  }

  // Carve holes/gaps in the terrain surface (within playable area)
  private generateSurfaceHoles(): void {
    const holeCount = 2 + Math.floor(Math.random() * 3);

    // Calculate bitmap bounds for playable area
    const playableStartBX = Math.floor(PLAYABLE_OFFSET_X / TERRAIN_SCALE);
    const playableEndBX = Math.floor((PLAYABLE_OFFSET_X + PLAYABLE_WIDTH) / TERRAIN_SCALE);

    for (let i = 0; i < holeCount; i++) {
      const centerBX = playableStartBX + 30 + Math.floor(Math.random() * (playableEndBX - playableStartBX - 60));
      const surfaceBY = this.findSurfaceBY(centerBX);
      if (surfaceBY < 0) continue;

      // Hole size
      const width = 5 + Math.floor(Math.random() * 10);
      const depth = 8 + Math.floor(Math.random() * 15);

      // Carve vertical hole (with thickness check)
      for (let dby = 0; dby < depth; dby++) {
        // Taper width as we go deeper
        const taperWidth = Math.floor(width * (1 - dby / depth * 0.5));
        for (let dbx = -taperWidth; dbx <= taperWidth; dbx++) {
          const nbx = centerBX + dbx;
          const nby = surfaceBY + dby;

          // Add noise to edges
          const edgeNoise = this.octavePerlin(nbx * 0.2, nby * 0.2, 2, 0.5) * 2;
          if (Math.abs(dbx) < taperWidth - edgeNoise && this.canCarve(nbx, nby)) {
            this.clearBitmapCell(nbx, nby);
          }
        }
      }
    }
  }

  // Stage 2: Carve caves using cellular automata
  private generateCaves(): void {
    const size = this.bitmapWidth * this.bitmapHeight;

    // Use two Uint8Array buffers and swap between them (0 = solid, 1 = cave)
    let caveBuffer = new Uint8Array(size);
    let swapBuffer = new Uint8Array(size);

    // First pass: seed caves using 2D noise (all in bitmap coordinates)
    for (let by = 0; by < this.bitmapHeight; by++) {
      const rowOffset = by * this.bitmapWidth;
      for (let bx = 0; bx < this.bitmapWidth; bx++) {
        const idx = rowOffset + bx;
        // Only create cave seeds in existing terrain
        if (this.terrainBitmap[idx] > 0) {
          const worldX = bx * TERRAIN_SCALE;
          const worldY = by * TERRAIN_SCALE;
          const noise = this.octavePerlin(worldX * 0.01, worldY * 0.01, 3, 0.5);

          // Higher threshold near surface, lower deeper down
          const surfaceBY = this.findSurfaceBY(bx);
          const depth = by - surfaceBY;
          const depthFactor = Math.min(1, depth / 50); // Caves more likely deeper

          // Cave threshold varies with depth
          const threshold = CAVE_DENSITY - depthFactor * 0.2;
          caveBuffer[idx] = noise < threshold - 0.5 ? 1 : 0;
        } else {
          caveBuffer[idx] = 0;
        }
      }
    }

    // Cellular automata iterations to smooth caves
    for (let iter = 0; iter < CAVE_ITERATIONS; iter++) {
      for (let by = 0; by < this.bitmapHeight; by++) {
        const rowOffset = by * this.bitmapWidth;
        for (let bx = 0; bx < this.bitmapWidth; bx++) {
          const idx = rowOffset + bx;
          if (this.terrainBitmap[idx] === 0) {
            swapBuffer[idx] = 0;
            continue;
          }

          // Count solid neighbors in 5x5 area
          let solidNeighbors = 0;
          for (let dy = -2; dy <= 2; dy++) {
            const ny = by + dy;
            if (ny < 0 || ny >= this.bitmapHeight) continue;
            const neighborRowOffset = ny * this.bitmapWidth;
            for (let dx = -2; dx <= 2; dx++) {
              const nx = bx + dx;
              if (nx >= 0 && nx < this.bitmapWidth) {
                if (caveBuffer[neighborRowOffset + nx] === 0) {
                  solidNeighbors++;
                }
              }
            }
          }

          // If too few solid neighbors, this becomes a cave
          swapBuffer[idx] = solidNeighbors < 15 ? 1 : 0;
        }
      }
      // Swap buffers
      const temp = caveBuffer;
      caveBuffer = swapBuffer;
      swapBuffer = temp;
    }

    // Apply caves to terrain - carve them out (with thickness check)
    for (let by = 0; by < this.bitmapHeight; by++) {
      const rowOffset = by * this.bitmapWidth;
      for (let bx = 0; bx < this.bitmapWidth; bx++) {
        if (caveBuffer[rowOffset + bx] === 1) {
          // Don't carve too close to surface
          const surfaceBY = this.findSurfaceBY(bx);
          if (by > surfaceBY + 8 && this.canCarve(bx, by)) {
            this.clearBitmapCell(bx, by);
          }
        }
      }
    }
  }

  // Helper to find surface BY (bitmap Y) at a given bitmap X - direct scan (used during generation)
  private findSurfaceBY(bx: number): number {
    if (bx < 0 || bx >= this.bitmapWidth) return -1;
    for (let by = 0; by < this.bitmapHeight; by++) {
      if (this.terrainBitmap[by * this.bitmapWidth + bx] > 0) {
        return by;
      }
    }
    return -1;
  }

  // Rebuild the entire surface Y cache (call after terrain generation or major changes)
  private rebuildSurfaceYCache(): void {
    for (let bx = 0; bx < this.bitmapWidth; bx++) {
      this.surfaceYCache[bx] = -1;
      for (let by = 0; by < this.bitmapHeight; by++) {
        if (this.terrainBitmap[by * this.bitmapWidth + bx] > 0) {
          this.surfaceYCache[bx] = by;
          break;
        }
      }
    }
  }

  // Update surface Y cache for a range of bitmap X coordinates (call after crater)
  private updateSurfaceYCacheRange(startBX: number, endBX: number): void {
    const minBX = Math.max(0, startBX);
    const maxBX = Math.min(this.bitmapWidth - 1, endBX);
    for (let bx = minBX; bx <= maxBX; bx++) {
      this.surfaceYCache[bx] = -1;
      for (let by = 0; by < this.bitmapHeight; by++) {
        if (this.terrainBitmap[by * this.bitmapWidth + bx] > 0) {
          this.surfaceYCache[bx] = by;
          break;
        }
      }
    }
  }

  // Stage 3: Generate overhangs by horizontal displacement
  private generateOverhangs(): void {
    // Use a single-row buffer instead of copying the entire bitmap
    const rowBuffer = new Uint8Array(this.bitmapWidth);

    for (let by = 0; by < this.bitmapHeight; by++) {
      const rowOffset = by * this.bitmapWidth;

      // Copy current row to buffer
      rowBuffer.set(this.terrainBitmap.subarray(rowOffset, rowOffset + this.bitmapWidth));

      // Displacement varies with y using sine wave and noise (in bitmap cells)
      const worldY = by * TERRAIN_SCALE;
      const waveDisplacement = Math.sin(worldY * 0.03) * (OVERHANG_STRENGTH / TERRAIN_SCALE);
      const noiseDisplacement = this.octavePerlin(worldY * 0.01, 3.7, 2, 0.5) * (OVERHANG_STRENGTH / TERRAIN_SCALE);
      const totalDisplacement = Math.round(waveDisplacement + noiseDisplacement);

      for (let bx = 0; bx < this.bitmapWidth; bx++) {
        const srcBX = bx - totalDisplacement;
        if (srcBX >= 0 && srcBX < this.bitmapWidth) {
          this.terrainBitmap[rowOffset + bx] = rowBuffer[srcBX];
        } else {
          this.terrainBitmap[rowOffset + bx] = 0;
        }
      }
    }
  }

  // Stage 4: Generate arches by carving elliptical holes
  private generateArches(): void {
    const archCount = ARCH_COUNT_MIN + Math.floor(Math.random() * (ARCH_COUNT_MAX - ARCH_COUNT_MIN + 1));

    for (let i = 0; i < archCount; i++) {
      // Find a good location for an arch (on surface) - within playable area
      const worldX = PLAYABLE_OFFSET_X + 200 + Math.random() * (PLAYABLE_WIDTH - 400);
      const bx = Math.floor(worldX / TERRAIN_SCALE);
      const surfaceBY = this.findSurfaceBY(bx);

      if (surfaceBY < 0) continue;

      // Arch dimensions in bitmap cells
      const archWidthCells = Math.floor((20 + Math.random() * 30) / TERRAIN_SCALE);
      const archHeightCells = Math.floor((10 + Math.random() * 15) / TERRAIN_SCALE);
      const centerBY = surfaceBY + Math.floor(archHeightCells * 0.3);

      // Carve elliptical hole in bitmap coords (with thickness check)
      for (let dby = -archHeightCells; dby <= archHeightCells; dby++) {
        for (let dbx = -archWidthCells; dbx <= archWidthCells; dbx++) {
          const nbx = bx + dbx;
          const nby = centerBY + dby;

          // Ellipse equation
          const ellipseValue = (dbx * dbx) / (archWidthCells * archWidthCells) +
            (dby * dby) / (archHeightCells * archHeightCells);

          if (ellipseValue < 1 && this.canCarve(nbx, nby)) {
            this.clearBitmapCell(nbx, nby);
          }
        }
      }
    }
  }

  // Check if carving at this position would leave terrain too thin
  // Returns true if it's safe to carve (enough thickness remains)
  private canCarve(bx: number, by: number, minThickness: number = 4): boolean {
    if (this.getBitmapCell(bx, by) === 0) return false; // Already empty

    // Check horizontal thickness
    let leftSolid = 0;
    let rightSolid = 0;
    for (let dx = 1; dx <= minThickness + 1; dx++) {
      if (this.getBitmapCell(bx - dx, by) > 0) leftSolid++;
      else break;
    }
    for (let dx = 1; dx <= minThickness + 1; dx++) {
      if (this.getBitmapCell(bx + dx, by) > 0) rightSolid++;
      else break;
    }

    // Check vertical thickness
    let upSolid = 0;
    let downSolid = 0;
    for (let dy = 1; dy <= minThickness + 1; dy++) {
      if (this.getBitmapCell(bx, by - dy) > 0) upSolid++;
      else break;
    }
    for (let dy = 1; dy <= minThickness + 1; dy++) {
      if (this.getBitmapCell(bx, by + dy) > 0) downSolid++;
      else break;
    }

    // Only allow carving if there's enough solid terrain on at least one axis
    const horizontalOk = leftSolid >= minThickness || rightSolid >= minThickness;
    const verticalOk = upSolid >= minThickness || downSolid >= minThickness;

    return horizontalOk || verticalOk;
  }

  // Helper to find surface Y at a given X (returns world coordinates) - uses cache
  private findSurfaceY(x: number): number {
    const bx = Math.floor(Math.max(0, Math.min(this.bitmapWidth - 1, x / TERRAIN_SCALE)));
    const surfaceBY = this.surfaceYCache[bx];
    return surfaceBY >= 0 ? surfaceBY * TERRAIN_SCALE : -1;
  }

  getHeightAt(x: number): number {
    const bx = Math.floor(Math.max(0, Math.min(this.bitmapWidth - 1, x / TERRAIN_SCALE)));
    const surfaceBY = this.surfaceYCache[bx];
    return surfaceBY >= 0 ? MAP_HEIGHT - surfaceBY * TERRAIN_SCALE : 0;
  }

  // Check if a world position collides with terrain - inlined for hot path performance
  isPointInTerrain(x: number, y: number): boolean {
    const ix = Math.floor(x / TERRAIN_SCALE);
    const iy = Math.floor(y / TERRAIN_SCALE);
    if (ix < 0 || ix >= this.bitmapWidth || iy < 0 || iy >= this.bitmapHeight) {
      return false;
    }
    return this.terrainBitmap[iy * this.bitmapWidth + ix] > 0;
  }

  update(deltaTime: number, wind: number = 0): void {
    this.currentWind = wind;
    this.sunPulse += deltaTime * 2;

    // Update cloud positions
    for (const cloud of this.clouds) {
      cloud.x += (cloud.speed + wind * 0.3) * deltaTime;
      // Wrap around when cloud goes off screen
      if (cloud.x > MAP_WIDTH + cloud.width) {
        cloud.x = -cloud.width;
        cloud.y = 80 + Math.random() * 200;
      } else if (cloud.x < -cloud.width) {
        cloud.x = MAP_WIDTH + cloud.width;
        cloud.y = 80 + Math.random() * 200;
      }
    }

    // Spawn wind particles based on wind strength
    const windStrength = Math.abs(wind);
    const spawnChance = windStrength > 5 ? windStrength * 0.015 : 0;
    if (Math.random() < spawnChance) {
      const startX = wind > 0 ? -50 : BASE_WIDTH + 50;
      const count = Math.ceil(windStrength / 15);
      for (let i = 0; i < count; i++) {
        this.windParticles.push({
          x: startX + (Math.random() - 0.5) * 30,
          y: 30 + Math.random() * (BASE_HEIGHT * 0.6),
          size: 1 + Math.random() * 1.5,
          opacity: 0.4 + Math.random() * 0.4,
          speed: windStrength * 4 + Math.random() * 60,
          length: 15 + Math.random() * 25,
          wavePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Update wind particles with wave motion
    const windDir = wind > 0 ? 1 : -1;
    for (const particle of this.windParticles) {
      particle.x += particle.speed * windDir * deltaTime;
      particle.wavePhase += deltaTime * 8;
      particle.y += Math.sin(particle.wavePhase) * 15 * deltaTime;
      particle.opacity -= deltaTime * 0.4;
      particle.length = Math.min(40, particle.length + deltaTime * 10);
    }
    this.windParticles = this.windParticles.filter(p =>
      p.opacity > 0 && p.x > -60 && p.x < BASE_WIDTH + 60
    );

    // Update ambient dust
    for (const dust of this.ambientDust) {
      dust.floatPhase += deltaTime * dust.floatSpeed;
      dust.y += Math.sin(dust.floatPhase) * 0.3;
      dust.x += (dust.driftSpeed + wind * 0.1) * deltaTime;

      if (dust.x > MAP_WIDTH + 10) {
        dust.x = -10;
        dust.y = Math.random() * MAP_HEIGHT * 0.5;
      } else if (dust.x < -10) {
        dust.x = MAP_WIDTH + 10;
        dust.y = Math.random() * MAP_HEIGHT * 0.5;
      }
    }
  }

  // Create explosion crater - carve circular hole through bitmap
  createCrater(centerX: number, centerY: number, radius: number, depthMultiplier: number = 1.0): void {
    const isDigger = depthMultiplier > 2.0;
    const effectiveRadius = isDigger ? radius * 0.6 : radius;
    const searchRadius = Math.ceil(effectiveRadius + 10); // Extra margin for noise

    // Carve circular hole through terrain - use squared distance to avoid sqrt
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const distSq = dx * dx + dy * dy;

        // Quick rejection using squared distance
        if (distSq > (effectiveRadius + 8) * (effectiveRadius + 8)) continue;

        // Add simple hash-based noise for natural edge (avoids perlin call per pixel)
        const px = Math.floor(centerX + dx);
        const py = Math.floor(centerY + dy);
        const edgeNoise = ((px * 374761393 + py * 668265263) & 0xFFFF) / 0xFFFF * 8 - 4;
        const adjustedRadiusSq = (effectiveRadius + edgeNoise) * (effectiveRadius + edgeNoise);

        if (distSq <= adjustedRadiusSq) {
          this.clearPixel(px, py);
        }
      }
    }

    // For digger weapons, also carve deeper
    if (isDigger) {
      const diggerDepth = radius * depthMultiplier * 0.5;
      for (let d = 0; d < diggerDepth; d++) {
        const depthY = centerY + d;
        const depthRadius = effectiveRadius * (1 - d / diggerDepth * 0.5);
        for (let dx = -depthRadius; dx <= depthRadius; dx++) {
          // Already using linear distance for 1D case
          if (Math.abs(dx) <= depthRadius) {
            this.clearPixel(Math.floor(centerX + dx), Math.floor(depthY));
          }
        }
      }
    }

    // Update surface Y cache for affected columns
    const startBX = Math.floor((centerX - searchRadius) / TERRAIN_SCALE);
    const endBX = Math.ceil((centerX + searchRadius) / TERRAIN_SCALE);
    this.updateSurfaceYCacheRange(startBX, endBX);

    // Add scorch mark
    const scorchRadius = isDigger ? radius * 0.8 : radius * 1.5;
    this.addScorchMark(centerX, centerY, scorchRadius);

    // Mark terrain cache as dirty
    this.terrainDirty = true;
  }

  addScorchMark(x: number, y: number, radius: number): void {
    this.scorchMarks.push({
      x,
      y,
      radius: radius + Math.random() * 10,
      opacity: 0.6 + Math.random() * 0.2,
      rotation: Math.random() * Math.PI * 2,
    });

    if (this.scorchMarks.length > 20) {
      this.scorchMarks[0].opacity -= 0.3;
      if (this.scorchMarks[0].opacity <= 0) {
        this.scorchMarks.shift();
      }
    }
  }

  // Render background layer (sky, sun, clouds)
  renderBackground(ctx: CanvasRenderingContext2D): void {
    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT * 0.6);
    skyGradient.addColorStop(0, this.theme.skyTop);
    skyGradient.addColorStop(0.5, this.theme.skyMid);
    skyGradient.addColorStop(1, this.theme.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Draw sun with lens flare
    this.renderSun(ctx);

    // Draw clouds
    for (const cloud of this.clouds) {
      ctx.globalAlpha = cloud.opacity;

      const puffs = [
        { xOff: 0, yOff: 0, wScale: 1, hScale: 1 },
        { xOff: -0.3, yOff: 0.1, wScale: 0.6, hScale: 0.8 },
        { xOff: 0.3, yOff: 0.1, wScale: 0.7, hScale: 0.9 },
        { xOff: -0.15, yOff: -0.2, wScale: 0.5, hScale: 0.6 },
        { xOff: 0.2, yOff: -0.15, wScale: 0.55, hScale: 0.7 },
      ];

      ctx.fillStyle = '#FFF';
      for (const puff of puffs) {
        const px = cloud.x + cloud.width * puff.xOff;
        const py = cloud.y + cloud.height * puff.yOff;
        const pw = cloud.width * puff.wScale;
        const ph = cloud.height * puff.hScale;

        ctx.beginPath();
        ctx.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Draw ambient dust particles
    for (const dust of this.ambientDust) {
      ctx.globalAlpha = dust.opacity;
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw wind particles
    for (const particle of this.windParticles) {
      const dir = this.currentWind > 0 ? 1 : -1;
      const streakLength = particle.length;

      const gradient = ctx.createLinearGradient(
        particle.x - streakLength * dir, particle.y,
        particle.x, particle.y
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${particle.opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${particle.opacity})`);

      ctx.beginPath();
      ctx.moveTo(particle.x - streakLength * dir, particle.y);
      ctx.lineTo(particle.x, particle.y);
      ctx.lineWidth = particle.size;
      ctx.strokeStyle = gradient;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  // Render terrain using ImageData for performance
  render(ctx: CanvasRenderingContext2D): void {
    if (this.terrainDirty && this.terrainCacheCtx) {
      this.renderTerrainToCache();
      this.terrainDirty = false;
    }

    if (this.terrainCache) {
      ctx.drawImage(this.terrainCache, 0, 0);
    }
  }

  // Render terrain to the offscreen cache with smooth colors
  private renderTerrainToCache(): void {
    const ctx = this.terrainCacheCtx;
    if (!ctx) return;

    // Create ImageData for full-resolution rendering
    const imageData = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
    const data = imageData.data;

    // Use pre-generated color LUT
    const colorLUT = this.colorLUT;
    if (!colorLUT) return;

    // Pre-compute surface Y lookup for each world X (use cached bitmap surface values)
    const surfaceYLookup = new Int16Array(MAP_WIDTH);
    for (let x = 0; x < MAP_WIDTH; x++) {
      const bx = Math.floor(x / TERRAIN_SCALE);
      const surfaceBY = this.surfaceYCache[bx];
      surfaceYLookup[x] = surfaceBY >= 0 ? surfaceBY * TERRAIN_SCALE : MAP_HEIGHT;
    }

    // Render at full resolution using LUT and pre-generated noise
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const bx = Math.floor(x / TERRAIN_SCALE);
        const by = Math.floor(y / TERRAIN_SCALE);
        const bitmapIdx = by * this.bitmapWidth + bx;

        if (this.terrainBitmap[bitmapIdx] > 0) {
          // Calculate distance from surface
          const surfaceY = surfaceYLookup[x];
          const dist = Math.max(0, Math.min(150, y - surfaceY));

          // Get color from LUT (3 bytes per entry: R, G, B)
          const lutIdx = dist * 3;
          const r = colorLUT[lutIdx];
          const g = colorLUT[lutIdx + 1];
          const b = colorLUT[lutIdx + 2];

          // Sample noise from pre-generated texture
          const noise = this.sampleNoiseTexture(x, y);

          const pixelIdx = (y * MAP_WIDTH + x) * 4;
          data[pixelIdx] = Math.max(0, Math.min(255, r + noise));
          data[pixelIdx + 1] = Math.max(0, Math.min(255, g + noise));
          data[pixelIdx + 2] = Math.max(0, Math.min(255, b + noise));
          data[pixelIdx + 3] = 255;
        }
      }
    }

    // Put the image data
    ctx.putImageData(imageData, 0, 0);

    // Draw edge highlights using canvas drawing (findSurfaceY now uses cache)
    this.renderTerrainEdges(ctx);

    // Draw scattered rocks
    this.drawRocks(ctx);
  }

  // Render smooth edge highlights
  private renderTerrainEdges(ctx: OffscreenCanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;

    // Trace the top surface
    ctx.beginPath();
    let started = false;

    for (let x = 0; x < MAP_WIDTH; x++) {
      const surfaceY = this.findSurfaceY(x);
      if (surfaceY >= 0) {
        if (!started) {
          ctx.moveTo(x, surfaceY);
          started = true;
        } else {
          ctx.lineTo(x, surfaceY);
        }
      } else if (started) {
        ctx.stroke();
        ctx.beginPath();
        started = false;
      }
    }
    if (started) ctx.stroke();
  }

  private parseColor(color: string): { r: number; g: number; b: number } {
    const num = parseInt(color.replace('#', ''), 16);
    return {
      r: (num >> 16) & 0xFF,
      g: (num >> 8) & 0xFF,
      b: num & 0xFF,
    };
  }

  private drawRocks(ctx: OffscreenCanvasRenderingContext2D): void {
    const rockPositions = [50, 150, 280, 400, 520, 650, 750, 900, 1050, 1150];

    for (const baseX of rockPositions) {
      const x = baseX + (Math.sin(baseX) * 20);
      if (x < 0 || x >= MAP_WIDTH) continue;

      const surfaceY = this.findSurfaceY(x);
      if (surfaceY < 0) continue;

      const rockSize = 5 + Math.abs(Math.sin(baseX * 0.1)) * 8;

      // Rock shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x + 2, surfaceY + 2, rockSize * 0.8, rockSize * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rock body with gradient
      const rockGradient = ctx.createRadialGradient(
        x - rockSize * 0.3, surfaceY - rockSize * 0.3, 0,
        x, surfaceY, rockSize
      );
      rockGradient.addColorStop(0, this.theme.rockHighlight);
      rockGradient.addColorStop(0.5, this.theme.rockColor);
      rockGradient.addColorStop(1, this.theme.deepRock);
      ctx.fillStyle = rockGradient;

      // Draw irregular rock shape
      ctx.beginPath();
      ctx.moveTo(x - rockSize * 0.8, surfaceY);
      ctx.quadraticCurveTo(x - rockSize * 0.9, surfaceY - rockSize * 0.5, x - rockSize * 0.3, surfaceY - rockSize * 0.9);
      ctx.quadraticCurveTo(x + rockSize * 0.2, surfaceY - rockSize, x + rockSize * 0.7, surfaceY - rockSize * 0.6);
      ctx.quadraticCurveTo(x + rockSize * 0.9, surfaceY - rockSize * 0.2, x + rockSize * 0.6, surfaceY);
      ctx.closePath();
      ctx.fill();

      // Rock highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(x - rockSize * 0.2, surfaceY - rockSize * 0.5, rockSize * 0.2, rockSize * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderSun(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.9 + Math.sin(this.sunPulse) * 0.1;

    // Outer glow
    const outerGlow = ctx.createRadialGradient(
      this.sunX, this.sunY, 0,
      this.sunX, this.sunY, 120 * pulse
    );
    outerGlow.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    outerGlow.addColorStop(0.3, 'rgba(255, 230, 150, 0.15)');
    outerGlow.addColorStop(0.6, 'rgba(255, 200, 100, 0.05)');
    outerGlow.addColorStop(1, 'rgba(255, 180, 50, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(this.sunX, this.sunY, 120 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Middle glow
    const midGlow = ctx.createRadialGradient(
      this.sunX, this.sunY, 0,
      this.sunX, this.sunY, 50 * pulse
    );
    midGlow.addColorStop(0, 'rgba(255, 255, 230, 0.8)');
    midGlow.addColorStop(0.5, 'rgba(255, 240, 180, 0.4)');
    midGlow.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = midGlow;
    ctx.beginPath();
    ctx.arc(this.sunX, this.sunY, 50 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Sun core
    const coreGradient = ctx.createRadialGradient(
      this.sunX, this.sunY, 0,
      this.sunX, this.sunY, 20
    );
    coreGradient.addColorStop(0, '#FFFEF0');
    coreGradient.addColorStop(0.7, '#FFF8DC');
    coreGradient.addColorStop(1, '#FFE4B5');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(this.sunX, this.sunY, 20, 0, Math.PI * 2);
    ctx.fill();

    // Lens flare elements
    const flareColors = [
      { dist: 0.3, size: 8, color: 'rgba(255, 200, 100, 0.3)' },
      { dist: 0.5, size: 5, color: 'rgba(200, 255, 200, 0.2)' },
      { dist: 0.7, size: 12, color: 'rgba(150, 200, 255, 0.15)' },
      { dist: 0.9, size: 6, color: 'rgba(255, 150, 200, 0.2)' },
    ];

    const centerX = BASE_WIDTH / 2;
    const centerY = BASE_HEIGHT / 2;
    const dx = centerX - this.sunX;
    const dy = centerY - this.sunY;

    for (const flare of flareColors) {
      const fx = this.sunX + dx * flare.dist;
      const fy = this.sunY + dy * flare.dist;
      ctx.fillStyle = flare.color;
      ctx.beginPath();
      ctx.arc(fx, fy, flare.size * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Get a safe spawn position for an ant (on solid ground, not inside caves)
  getSpawnPosition(index: number, totalAnts: number): { x: number; y: number } {
    // Spawn within the playable area
    const spacing = PLAYABLE_WIDTH / (totalAnts + 1);
    const x = PLAYABLE_OFFSET_X + spacing * (index + 1);

    // Find a valid surface position
    let y = this.findSurfaceY(x);
    if (y < 0) {
      // No terrain at this x, search nearby
      for (let offset = 1; offset < 100; offset++) {
        y = this.findSurfaceY(x + offset);
        if (y >= 0) break;
        y = this.findSurfaceY(x - offset);
        if (y >= 0) break;
      }
    }

    // y is the surface Y in screen coords, we need the Y position where ant stands
    const playableBottom = PLAYABLE_OFFSET_Y + PLAYABLE_HEIGHT;
    return { x, y: y >= 0 ? y : playableBottom - TERRAIN_MIN_HEIGHT };
  }

  // Get spawn position for an ant within a team zone
  getTeamSpawnPosition(teamIndex: number, antIndexInTeam: number, antsPerTeam: number): { x: number; y: number } {
    const edgePadding = 100;
    const centerGap = 150;
    const playableBottom = PLAYABLE_OFFSET_Y + PLAYABLE_HEIGHT;

    // Calculate zones within the playable area
    const usableWidth = (PLAYABLE_WIDTH - 2 * edgePadding - centerGap) / 2;

    const zoneStartX = teamIndex === 0
      ? PLAYABLE_OFFSET_X + edgePadding
      : PLAYABLE_OFFSET_X + PLAYABLE_WIDTH - edgePadding - usableWidth;

    // Find interesting spawn points with varied heights in this team's zone
    const candidates: { x: number; y: number; height: number }[] = [];
    const sampleStep = Math.floor(usableWidth / 30); // Sample ~30 points

    for (let sx = zoneStartX; sx < zoneStartX + usableWidth; sx += sampleStep) {
      const surfaceY = this.findSurfaceY(sx);
      if (surfaceY >= 0 && surfaceY < playableBottom - 50) {
        // Check it's not inside a hole (has solid ground below)
        const hasGround = this.getPixel(sx, surfaceY + 10) > 0;
        if (hasGround) {
          candidates.push({ x: sx, y: surfaceY, height: playableBottom - surfaceY });
        }
      }
    }

    if (candidates.length === 0) {
      // Fallback to old method
      const spacing = usableWidth / (antsPerTeam + 1);
      const x = zoneStartX + spacing * (antIndexInTeam + 1);
      const y = this.findSurfaceY(x);
      return { x, y: y >= 0 ? y : playableBottom - TERRAIN_MIN_HEIGHT };
    }

    // Sort by height to get variety, then pick spread-out positions
    candidates.sort((a, b) => b.height - a.height);

    // Distribute ants across height range - pick from different height bands
    const bandSize = Math.ceil(candidates.length / antsPerTeam);
    const bandIndex = Math.min(antIndexInTeam, Math.floor(candidates.length / bandSize) - 1);
    const bandStart = bandIndex * bandSize;
    const bandEnd = Math.min(bandStart + bandSize, candidates.length);

    // Pick a random position within this height band
    const pickIndex = bandStart + Math.floor(Math.random() * (bandEnd - bandStart));
    const chosen = candidates[Math.min(pickIndex, candidates.length - 1)];

    return { x: chosen.x, y: chosen.y };
  }
}
