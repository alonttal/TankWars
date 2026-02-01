import { MAP_WIDTH, MAP_HEIGHT, WATER_LEVEL } from '../constants.ts';
import { TERRAIN_SCALE } from '../constants/terrain.ts';

// Theme-aware water color configuration
interface WaterThemeConfig {
  surfaceColor: string;
  deepColor: string;
  highlightColor: string;
  particleColor: string;
  surfaceAlpha: number;
  label: string; // e.g. "Water", "Lava", "Acid"
}

const WATER_THEMES: Record<string, WaterThemeConfig> = {
  Grassland: {
    surfaceColor: '#4488CC',
    deepColor: '#1A3366',
    highlightColor: '#FFFFFF',
    particleColor: '#88BBEE',
    surfaceAlpha: 0.7,
    label: 'Water',
  },
  Desert: {
    surfaceColor: '#3DAA9A',
    deepColor: '#1A5550',
    highlightColor: '#FFFFFF',
    particleColor: '#66CCBB',
    surfaceAlpha: 0.65,
    label: 'Oasis',
  },
  Arctic: {
    surfaceColor: '#88CCDD',
    deepColor: '#2A5577',
    highlightColor: '#E8F4FF',
    particleColor: '#AADDEE',
    surfaceAlpha: 0.6,
    label: 'Icy Water',
  },
  Volcanic: {
    surfaceColor: '#DD5522',
    deepColor: '#881100',
    highlightColor: '#FFCC00',
    particleColor: '#FF8844',
    surfaceAlpha: 0.85,
    label: 'Lava',
  },
  Autumn: {
    surfaceColor: '#4499AA',
    deepColor: '#1A3355',
    highlightColor: '#FFFFFF',
    particleColor: '#77BBCC',
    surfaceAlpha: 0.7,
    label: 'Water',
  },
  Martian: {
    surfaceColor: '#88CC22',
    deepColor: '#2A5500',
    highlightColor: '#CCFF44',
    particleColor: '#AAEE55',
    surfaceAlpha: 0.75,
    label: 'Acid',
  },
};

// Splash droplet particle
interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// Rising bubble particle
interface BubbleParticle {
  x: number;
  y: number;
  vy: number;
  size: number;
  life: number;
  wobblePhase: number;
}

// Ripple line at water surface (pixel-art: expanding horizontal bar)
interface RippleRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

// Snap a value to the pixel grid
function snap(value: number): number {
  return Math.floor(value / TERRAIN_SCALE) * TERRAIN_SCALE;
}

export class WaterRenderer {
  private theme: WaterThemeConfig;
  private animTime: number = 0;
  private splashParticles: SplashParticle[] = [];
  private bubbleParticles: BubbleParticle[] = [];
  private rippleRings: RippleRing[] = [];

  constructor() {
    this.theme = WATER_THEMES['Grassland'];
  }

  setTheme(themeName: string): void {
    this.theme = WATER_THEMES[themeName] || WATER_THEMES['Grassland'];
  }

  update(deltaTime: number): void {
    this.animTime += deltaTime;

    // Update splash particles
    for (const p of this.splashParticles) {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy += 400 * deltaTime; // gravity
      p.life -= deltaTime;
    }
    this.splashParticles = this.splashParticles.filter(p => p.life > 0);

    // Update bubble particles
    for (const b of this.bubbleParticles) {
      b.y += b.vy * deltaTime;
      b.wobblePhase += deltaTime * 5;
      b.x += Math.sin(b.wobblePhase) * 10 * deltaTime;
      b.life -= deltaTime;
      b.size *= 0.998;
    }
    this.bubbleParticles = this.bubbleParticles.filter(b => b.life > 0 && b.y > WATER_LEVEL - 10);

    // Update ripple rings
    for (const r of this.rippleRings) {
      r.radius += 40 * deltaTime;
      r.alpha -= deltaTime * 0.8;
    }
    this.rippleRings = this.rippleRings.filter(r => r.alpha > 0 && r.radius < r.maxRadius);
  }

  // Render water body behind ants — stepped color bands instead of smooth gradient
  renderWaterBackground(ctx: CanvasRenderingContext2D): void {
    if (WATER_LEVEL >= MAP_HEIGHT) return;

    const waterTop = snap(WATER_LEVEL);
    const bandCount = Math.ceil((MAP_HEIGHT - waterTop) / TERRAIN_SCALE);
    if (bandCount <= 0) return;

    const surfaceRgb = this.hexToRgb(this.theme.surfaceColor);
    const deepRgb = this.hexToRgb(this.theme.deepColor);

    ctx.save();

    for (let i = 0; i < bandCount; i++) {
      const t = bandCount > 1 ? i / (bandCount - 1) : 0;
      const alpha = this.theme.surfaceAlpha * (0.6 + 0.4 * t);
      const r = Math.floor(surfaceRgb.r + (deepRgb.r - surfaceRgb.r) * t);
      const g = Math.floor(surfaceRgb.g + (deepRgb.g - surfaceRgb.g) * t);
      const b = Math.floor(surfaceRgb.b + (deepRgb.b - surfaceRgb.b) * t);

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(0, waterTop + i * TERRAIN_SCALE, MAP_WIDTH, TERRAIN_SCALE);
    }

    ctx.restore();
  }

  // Render water surface and effects in front of ants
  renderWaterSurface(ctx: CanvasRenderingContext2D): void {
    if (WATER_LEVEL >= MAP_HEIGHT) return;

    ctx.save();

    // Semi-transparent overlay on submerged area for depth
    ctx.fillStyle = this.hexToRgba(this.theme.surfaceColor, 0.15);
    ctx.fillRect(0, snap(WATER_LEVEL), MAP_WIDTH, MAP_HEIGHT - snap(WATER_LEVEL));

    // Animated wave surface — blocky columns
    this.renderWaveSurface(ctx);

    // Wave highlights — square glint blocks
    this.renderWaveHighlights(ctx);

    // Ripple lines
    this.renderRipples(ctx);

    // Square splash particles
    this.renderSplashParticles(ctx);

    // Square bubble particles
    this.renderBubbleParticles(ctx);

    ctx.restore();
  }

  private renderWaveSurface(ctx: CanvasRenderingContext2D): void {
    const waveAmplitude = 3;
    const waveFrequency = 0.02;
    const waveSpeed = 2;
    const cell = TERRAIN_SCALE;

    // Draw blocky wave columns — each column is one cell wide, snapped to grid
    ctx.fillStyle = this.hexToRgba(this.theme.surfaceColor, this.theme.surfaceAlpha * 0.4);
    for (let x = 0; x < MAP_WIDTH; x += cell) {
      const wave1 = Math.sin(x * waveFrequency + this.animTime * waveSpeed) * waveAmplitude;
      const wave2 = Math.sin(x * waveFrequency * 1.5 + this.animTime * waveSpeed * 0.7 + 1.3) * waveAmplitude * 0.5;
      const waveY = snap(WATER_LEVEL + wave1 + wave2);
      ctx.fillRect(x, waveY, cell, MAP_HEIGHT - waveY);
    }

    // Draw highlight pixel row on top of each wave column
    ctx.fillStyle = this.hexToRgba(this.theme.highlightColor, 0.5);
    for (let x = 0; x < MAP_WIDTH; x += cell) {
      const wave1 = Math.sin(x * waveFrequency + this.animTime * waveSpeed) * waveAmplitude;
      const wave2 = Math.sin(x * waveFrequency * 1.5 + this.animTime * waveSpeed * 0.7 + 1.3) * waveAmplitude * 0.5;
      const waveY = snap(WATER_LEVEL + wave1 + wave2);
      ctx.fillRect(x, waveY, cell, cell);
    }
  }

  private renderWaveHighlights(ctx: CanvasRenderingContext2D): void {
    const glintCount = 8;
    const cell = TERRAIN_SCALE;

    for (let i = 0; i < glintCount; i++) {
      const phase = this.animTime * 0.8 + i * (MAP_WIDTH / glintCount) * 0.01;
      const rawX = (i * (MAP_WIDTH / glintCount) + Math.sin(phase) * 40) % MAP_WIDTH;
      const x = snap(rawX);
      const waveY = snap(WATER_LEVEL + Math.sin(x * 0.02 + this.animTime * 2) * 3);
      const glintAlpha = (Math.sin(this.animTime * 3 + i * 1.7) * 0.5 + 0.5) * 0.4;

      if (glintAlpha > 0.1) {
        ctx.fillStyle = this.hexToRgba(this.theme.highlightColor, glintAlpha);
        // Square glint: a few cells wide, one cell tall
        const glintWidth = cell * (2 + Math.floor(Math.abs(Math.sin(this.animTime + i)) * 2));
        ctx.fillRect(x, waveY + cell, glintWidth, cell);
      }
    }
  }

  private renderRipples(ctx: CanvasRenderingContext2D): void {
    const cell = TERRAIN_SCALE;

    for (const r of this.rippleRings) {
      ctx.fillStyle = this.hexToRgba(this.theme.highlightColor, r.alpha * 0.6);
      const halfWidth = snap(r.radius);
      const cx = snap(r.x);
      const cy = snap(r.y);

      // Pixel-art ripple: a horizontal bar that expands, one cell tall
      ctx.fillRect(cx - halfWidth, cy, halfWidth * 2, cell);
    }
  }

  private renderSplashParticles(ctx: CanvasRenderingContext2D): void {
    const cell = TERRAIN_SCALE;

    for (const p of this.splashParticles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = this.hexToRgba(this.theme.particleColor, alpha);
      // Each splash particle is a square block
      ctx.fillRect(snap(p.x), snap(p.y), cell, cell);
    }
  }

  private renderBubbleParticles(ctx: CanvasRenderingContext2D): void {
    const cell = TERRAIN_SCALE;

    for (const b of this.bubbleParticles) {
      const alpha = Math.min(1, b.life * 2) * 0.6;
      const bx = snap(b.x);
      const by = snap(b.y);

      // Square bubble outline
      ctx.fillStyle = this.hexToRgba(this.theme.highlightColor, alpha);
      // Outer ring: draw 4 edges of a square
      ctx.fillRect(bx, by, cell * 2, cell);                     // top
      ctx.fillRect(bx, by + cell, cell, cell);                   // left
      ctx.fillRect(bx + cell, by + cell, cell, cell);            // right
      ctx.fillRect(bx, by + cell * 2, cell * 2, cell);           // bottom

      // Highlight pixel in top-left corner
      ctx.fillStyle = this.hexToRgba(this.theme.highlightColor, alpha * 0.8);
      ctx.fillRect(bx, by, cell, cell);
    }
  }

  // Spawn splash effect at water surface
  spawnSplash(x: number, _y: number, intensity: number = 1): void {
    const count = Math.floor(8 + intensity * 8);

    // Splash droplets
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8; // Upward arc
      const speed = 80 + Math.random() * 120 * intensity;
      this.splashParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: WATER_LEVEL,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: TERRAIN_SCALE,
      });
    }

    // Ripple line
    this.rippleRings.push({
      x,
      y: WATER_LEVEL,
      radius: 2,
      maxRadius: 30 + intensity * 30,
      alpha: 0.8,
    });

    // A few bubbles
    this.spawnBubbles(x, WATER_LEVEL + 10, Math.floor(3 + intensity * 4));
  }

  // Spawn bubble particles beneath the surface
  spawnBubbles(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.bubbleParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + Math.random() * 20,
        vy: -15 - Math.random() * 25,
        size: TERRAIN_SCALE,
        life: 1.0 + Math.random() * 1.5,
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  // Check if particles are still active (for keeping camera on splash)
  hasActiveParticles(): boolean {
    return this.splashParticles.length > 0 || this.rippleRings.length > 0;
  }

  // Helper: convert hex color to rgb components
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const num = parseInt(hex.replace('#', ''), 16);
    return {
      r: (num >> 16) & 0xFF,
      g: (num >> 8) & 0xFF,
      b: num & 0xFF,
    };
  }

  // Helper: convert hex color to rgba string
  private hexToRgba(hex: string, alpha: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
