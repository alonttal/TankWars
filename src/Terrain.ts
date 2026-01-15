import { BASE_WIDTH, BASE_HEIGHT, TERRAIN_COLOR, SKY_COLOR } from './constants.ts';

export class Terrain {
  // Height map - stores the terrain height at each x position
  private heightMap: number[];

  constructor() {
    this.heightMap = new Array(BASE_WIDTH).fill(0);
  }

  generate(): void {
    // Generate terrain using midpoint displacement algorithm
    const minHeight = BASE_HEIGHT * 0.3;
    const maxHeight = BASE_HEIGHT * 0.7;

    // Start with random endpoints
    this.heightMap[0] = minHeight + Math.random() * (maxHeight - minHeight);
    this.heightMap[BASE_WIDTH - 1] = minHeight + Math.random() * (maxHeight - minHeight);

    // Midpoint displacement
    this.midpointDisplacement(0, BASE_WIDTH - 1, 150);

    // Smooth the terrain
    this.smooth(3);
  }

  private midpointDisplacement(left: number, right: number, displacement: number): void {
    if (right - left <= 1) return;

    const mid = Math.floor((left + right) / 2);
    const avgHeight = (this.heightMap[left] + this.heightMap[right]) / 2;
    this.heightMap[mid] = avgHeight + (Math.random() - 0.5) * displacement;

    // Clamp to valid range
    const minHeight = BASE_HEIGHT * 0.2;
    const maxHeight = BASE_HEIGHT * 0.8;
    this.heightMap[mid] = Math.max(minHeight, Math.min(maxHeight, this.heightMap[mid]));

    // Recurse
    const newDisplacement = displacement * 0.6;
    this.midpointDisplacement(left, mid, newDisplacement);
    this.midpointDisplacement(mid, right, newDisplacement);
  }

  private smooth(iterations: number): void {
    for (let i = 0; i < iterations; i++) {
      const newHeightMap = [...this.heightMap];
      for (let x = 1; x < BASE_WIDTH - 1; x++) {
        newHeightMap[x] = (this.heightMap[x - 1] + this.heightMap[x] + this.heightMap[x + 1]) / 3;
      }
      this.heightMap = newHeightMap;
    }
  }

  getHeightAt(x: number): number {
    const index = Math.floor(Math.max(0, Math.min(BASE_WIDTH - 1, x)));
    return this.heightMap[index];
  }

  // Create explosion crater
  createCrater(centerX: number, centerY: number, radius: number): void {
    for (let x = Math.max(0, centerX - radius); x < Math.min(BASE_WIDTH, centerX + radius); x++) {
      const dx = x - centerX;
      const craterDepth = Math.sqrt(radius * radius - dx * dx);

      // Only affect terrain if explosion is at or below terrain level
      const terrainY = BASE_HEIGHT - this.heightMap[Math.floor(x)];
      if (centerY >= terrainY - radius) {
        // Calculate how much to lower the terrain
        const newTerrainHeight = this.heightMap[Math.floor(x)] - craterDepth * 0.7;
        this.heightMap[Math.floor(x)] = Math.max(BASE_HEIGHT * 0.1, newTerrainHeight);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Draw sky
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Draw terrain
    ctx.fillStyle = TERRAIN_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);

    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x];
      ctx.lineTo(x, y);
    }

    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Add some texture/shading
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x] + 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  // Get a safe spawn position for a tank
  getSpawnPosition(index: number, totalTanks: number): { x: number; y: number } {
    // Distribute tanks evenly across the terrain
    const spacing = BASE_WIDTH / (totalTanks + 1);
    const x = spacing * (index + 1);
    const y = BASE_HEIGHT - this.getHeightAt(x);
    return { x, y };
  }
}
