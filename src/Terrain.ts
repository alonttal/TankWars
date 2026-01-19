import { BASE_WIDTH, BASE_HEIGHT, TERRAIN_COLOR, SKY_COLOR } from './constants.ts';

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

export class Terrain {
  // Height map - stores the terrain height at each x position
  private heightMap: number[];

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

  // Pre-rendered grass canvas
  private grassCanvas: OffscreenCanvas | null;
  private grassNeedsRedraw: boolean;

  // Scorch marks from explosions
  private scorchMarks: ScorchMark[];

  constructor() {
    this.heightMap = new Array(BASE_WIDTH).fill(0);
    this.clouds = [];
    this.windParticles = [];
    this.ambientDust = [];
    this.currentWind = 0;
    this.sunX = BASE_WIDTH * 0.85;
    this.sunY = 60;
    this.sunPulse = 0;
    this.grassCanvas = null;
    this.grassNeedsRedraw = true;
    this.scorchMarks = [];
    this.generateClouds();
    this.generateAmbientDust();
  }

  private generateAmbientDust(): void {
    this.ambientDust = [];
    for (let i = 0; i < 30; i++) {
      this.ambientDust.push({
        x: Math.random() * BASE_WIDTH,
        y: Math.random() * BASE_HEIGHT * 0.7,
        size: 1 + Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.3,
        floatSpeed: 0.5 + Math.random() * 1,
        floatPhase: Math.random() * Math.PI * 2,
        driftSpeed: 2 + Math.random() * 5,
      });
    }
  }

  private generateClouds(): void {
    this.clouds = [];
    const cloudCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: Math.random() * BASE_WIDTH,
        y: 20 + Math.random() * 80,
        width: 40 + Math.random() * 80,
        height: 20 + Math.random() * 30,
        speed: 5 + Math.random() * 10,
        opacity: 0.3 + Math.random() * 0.4,
      });
    }
  }

  generate(): void {
    // Regenerate clouds and dust for new terrain
    this.generateClouds();
    this.generateAmbientDust();
    this.sunX = BASE_WIDTH * (0.7 + Math.random() * 0.2);
    this.sunY = 40 + Math.random() * 40;
    this.grassNeedsRedraw = true;
    this.scorchMarks = []; // Clear scorch marks for new terrain

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

  update(deltaTime: number, wind: number = 0): void {
    this.currentWind = wind;
    this.sunPulse += deltaTime * 2;

    // Update cloud positions
    for (const cloud of this.clouds) {
      cloud.x += (cloud.speed + wind * 0.3) * deltaTime;
      // Wrap around when cloud goes off screen
      if (cloud.x > BASE_WIDTH + cloud.width) {
        cloud.x = -cloud.width;
        cloud.y = 20 + Math.random() * 80;
      } else if (cloud.x < -cloud.width) {
        cloud.x = BASE_WIDTH + cloud.width;
        cloud.y = 20 + Math.random() * 80;
      }
    }

    // Spawn wind particles based on wind strength (enhanced)
    const windStrength = Math.abs(wind);
    const spawnChance = windStrength > 5 ? windStrength * 0.015 : 0;
    if (Math.random() < spawnChance) {
      const startX = wind > 0 ? -50 : BASE_WIDTH + 50;
      // Spawn multiple particles at once for stronger winds
      const count = Math.ceil(windStrength / 15);
      for (let i = 0; i < count; i++) {
        this.windParticles.push({
          x: startX + (Math.random() - 0.5) * 30,
          y: 30 + Math.random() * (BASE_HEIGHT * 0.6),
          size: 1 + Math.random() * 1.5,
          opacity: 0.4 + Math.random() * 0.4,
          speed: windStrength * 4 + Math.random() * 60,
          length: 15 + Math.random() * 25, // Length of the streak
          wavePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Update wind particles with wave motion
    const windDir = wind > 0 ? 1 : -1;
    for (const particle of this.windParticles) {
      particle.x += particle.speed * windDir * deltaTime;
      particle.wavePhase += deltaTime * 8;
      particle.y += Math.sin(particle.wavePhase) * 15 * deltaTime; // Wave motion
      particle.opacity -= deltaTime * 0.4;
      // Stretch length based on speed
      particle.length = Math.min(40, particle.length + deltaTime * 10);
    }
    this.windParticles = this.windParticles.filter(p =>
      p.opacity > 0 && p.x > -60 && p.x < BASE_WIDTH + 60
    );

    // Update ambient dust (gentle floating)
    for (const dust of this.ambientDust) {
      dust.floatPhase += deltaTime * dust.floatSpeed;
      dust.y += Math.sin(dust.floatPhase) * 0.3;
      dust.x += (dust.driftSpeed + wind * 0.1) * deltaTime;

      // Wrap around
      if (dust.x > BASE_WIDTH + 10) {
        dust.x = -10;
        dust.y = Math.random() * BASE_HEIGHT * 0.7;
      } else if (dust.x < -10) {
        dust.x = BASE_WIDTH + 10;
        dust.y = Math.random() * BASE_HEIGHT * 0.7;
      }
    }
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
    this.grassNeedsRedraw = true;

    // Add scorch mark at explosion location
    this.addScorchMark(centerX, centerY, radius * 1.5);
  }

  // Add a scorch mark at the specified location
  addScorchMark(x: number, y: number, radius: number): void {
    this.scorchMarks.push({
      x,
      y,
      radius: radius + Math.random() * 10,
      opacity: 0.6 + Math.random() * 0.2,
      rotation: Math.random() * Math.PI * 2,
    });

    // Limit total scorch marks to prevent performance issues
    if (this.scorchMarks.length > 20) {
      // Fade oldest marks
      this.scorchMarks[0].opacity -= 0.3;
      if (this.scorchMarks[0].opacity <= 0) {
        this.scorchMarks.shift();
      }
    }
  }

  private preRenderGrass(): void {
    this.grassCanvas = new OffscreenCanvas(BASE_WIDTH, BASE_HEIGHT);
    const ctx = this.grassCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    const grassColor = '#4A7023';
    const grassHighlight = '#6B8E23';

    // Draw individual grass blades
    for (let x = 0; x < BASE_WIDTH; x += 3) {
      const baseY = BASE_HEIGHT - this.heightMap[x];

      // Draw 2-3 grass blades per position
      const bladeCount = 2 + Math.floor(Math.random() * 2);
      for (let b = 0; b < bladeCount; b++) {
        const bladeX = x + (Math.random() - 0.5) * 4;
        const bladeHeight = 4 + Math.random() * 6;
        const bladeLean = (Math.random() - 0.5) * 4;
        const bladeColor = Math.random() > 0.3 ? grassColor : grassHighlight;

        ctx.strokeStyle = bladeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bladeX, baseY);
        ctx.quadraticCurveTo(
          bladeX + bladeLean * 0.5,
          baseY - bladeHeight * 0.6,
          bladeX + bladeLean,
          baseY - bladeHeight
        );
        ctx.stroke();
      }
    }

    this.grassNeedsRedraw = false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT * 0.6);
    skyGradient.addColorStop(0, '#4A90D9'); // Darker blue at top
    skyGradient.addColorStop(0.5, SKY_COLOR); // Light blue
    skyGradient.addColorStop(1, '#B0E0FF'); // Lighter at horizon
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Draw sun with lens flare
    this.renderSun(ctx);

    // Draw clouds (behind terrain)
    for (const cloud of this.clouds) {
      ctx.globalAlpha = cloud.opacity;

      // Draw cloud as multiple overlapping ellipses
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

    // Draw ambient dust particles (in sky)
    for (const dust of this.ambientDust) {
      ctx.globalAlpha = dust.opacity;
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw wind particles (enhanced streaks)
    for (const particle of this.windParticles) {
      const dir = this.currentWind > 0 ? 1 : -1;
      const streakLength = particle.length;

      // Create gradient for the streak
      const gradient = ctx.createLinearGradient(
        particle.x - streakLength * dir, particle.y,
        particle.x, particle.y
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${particle.opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${particle.opacity})`);

      // Draw streak with gradient
      ctx.beginPath();
      ctx.moveTo(particle.x - streakLength * dir, particle.y);
      ctx.lineTo(particle.x, particle.y);
      ctx.lineWidth = particle.size;
      ctx.strokeStyle = gradient;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Add a brighter head
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';

    // Draw terrain with multiple layers

    // Layer 1: Deep rock/stone (darkest, at bottom)
    ctx.fillStyle = '#4A3728';
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x];
      ctx.lineTo(x, y);
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Layer 2: Dark soil
    ctx.fillStyle = '#5C4033';
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x] + 8;
      ctx.lineTo(x, Math.min(BASE_HEIGHT, y));
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Layer 3: Main soil layer with gradient
    const soilGradient = ctx.createLinearGradient(0, BASE_HEIGHT * 0.3, 0, BASE_HEIGHT);
    soilGradient.addColorStop(0, '#8B5A2B');
    soilGradient.addColorStop(0.4, TERRAIN_COLOR);
    soilGradient.addColorStop(1, '#6B4423');
    ctx.fillStyle = soilGradient;
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x] + 20;
      ctx.lineTo(x, Math.min(BASE_HEIGHT, y));
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Layer 4: Top soil (lighter brown)
    ctx.fillStyle = '#9B7653';
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x] + 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Draw grass edge on top
    const grassColor = '#4A7023';
    ctx.fillStyle = grassColor;
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let x = 0; x < BASE_WIDTH; x++) {
      const y = BASE_HEIGHT - this.heightMap[x];
      ctx.lineTo(x, y);
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Draw pre-rendered grass blades
    if (this.grassNeedsRedraw) {
      this.preRenderGrass();
    }
    if (this.grassCanvas) {
      ctx.drawImage(this.grassCanvas, 0, 0);
    }

    // Draw scorch marks from explosions
    this.renderScorchMarks(ctx);

    // Draw scattered rocks
    this.drawRocks(ctx);

    // Add subtle texture noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let x = 0; x < BASE_WIDTH; x += 8) {
      for (let y = BASE_HEIGHT - 100; y < BASE_HEIGHT; y += 8) {
        const terrainY = BASE_HEIGHT - this.heightMap[Math.min(x, BASE_WIDTH - 1)];
        if (y > terrainY + 10) {
          if (Math.random() > 0.7) {
            ctx.beginPath();
            ctx.arc(x + Math.random() * 4, y + Math.random() * 4, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Add highlight on terrain edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT - this.heightMap[0] - 1);
    for (let x = 1; x < BASE_WIDTH; x++) {
      ctx.lineTo(x, BASE_HEIGHT - this.heightMap[x] - 1);
    }
    ctx.stroke();
  }

  private renderScorchMarks(ctx: CanvasRenderingContext2D): void {
    for (const scorch of this.scorchMarks) {
      ctx.save();
      ctx.translate(scorch.x, scorch.y);
      ctx.rotate(scorch.rotation);

      // Create gradient for scorch mark
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, scorch.radius);
      gradient.addColorStop(0, `rgba(20, 15, 10, ${scorch.opacity})`);
      gradient.addColorStop(0.3, `rgba(35, 25, 15, ${scorch.opacity * 0.8})`);
      gradient.addColorStop(0.6, `rgba(50, 35, 20, ${scorch.opacity * 0.5})`);
      gradient.addColorStop(1, 'rgba(60, 40, 25, 0)');

      // Draw elliptical scorch mark
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, scorch.radius, scorch.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Add some irregular edges/splatters
      ctx.fillStyle = `rgba(25, 20, 15, ${scorch.opacity * 0.5})`;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + scorch.rotation;
        const dist = scorch.radius * (0.7 + Math.random() * 0.4);
        const size = 3 + Math.random() * 5;
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle) * dist,
          Math.sin(angle) * dist * 0.6,
          size,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawRocks(ctx: CanvasRenderingContext2D): void {
    // Use a seeded pattern for consistent rock placement
    const rockPositions = [50, 150, 280, 400, 520, 650, 750];

    for (const baseX of rockPositions) {
      const x = baseX + (Math.sin(baseX) * 20);
      if (x < 0 || x >= BASE_WIDTH) continue;

      const terrainY = BASE_HEIGHT - this.heightMap[Math.floor(x)];
      const rockSize = 5 + Math.abs(Math.sin(baseX * 0.1)) * 8;

      // Rock shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x + 2, terrainY + 2, rockSize * 0.8, rockSize * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rock body with gradient
      const rockGradient = ctx.createRadialGradient(
        x - rockSize * 0.3, terrainY - rockSize * 0.3, 0,
        x, terrainY, rockSize
      );
      rockGradient.addColorStop(0, '#8B8B8B');
      rockGradient.addColorStop(0.5, '#696969');
      rockGradient.addColorStop(1, '#4A4A4A');
      ctx.fillStyle = rockGradient;

      // Draw irregular rock shape
      ctx.beginPath();
      ctx.moveTo(x - rockSize * 0.8, terrainY);
      ctx.quadraticCurveTo(x - rockSize * 0.9, terrainY - rockSize * 0.5, x - rockSize * 0.3, terrainY - rockSize * 0.9);
      ctx.quadraticCurveTo(x + rockSize * 0.2, terrainY - rockSize, x + rockSize * 0.7, terrainY - rockSize * 0.6);
      ctx.quadraticCurveTo(x + rockSize * 0.9, terrainY - rockSize * 0.2, x + rockSize * 0.6, terrainY);
      ctx.closePath();
      ctx.fill();

      // Rock highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(x - rockSize * 0.2, terrainY - rockSize * 0.5, rockSize * 0.2, rockSize * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderSun(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.9 + Math.sin(this.sunPulse) * 0.1;

    // Outer glow (large, soft)
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

    // Lens flare elements (subtle)
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

  // Get a safe spawn position for a tank
  getSpawnPosition(index: number, totalTanks: number): { x: number; y: number } {
    // Distribute tanks evenly across the terrain
    const spacing = BASE_WIDTH / (totalTanks + 1);
    const x = spacing * (index + 1);
    const y = BASE_HEIGHT - this.getHeightAt(x);
    return { x, y };
  }
}
