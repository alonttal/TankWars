import { WeaponType } from '../weapons/WeaponTypes.ts';
import {
  ANT_PIXEL_SCALE,
  SmokeParticle,
  MuzzleParticle,
  SparkParticle,
  SmokeRing,
  ChargeParticle,
  FireParticle,
  DamageNumber,
} from '../types/AntParticleTypes.ts';

// Interface for the ant data needed by the renderer
export interface AntRenderData {
  x: number;
  y: number;
  angle: number;
  color: string;
  health: number;
  isAlive: boolean;
  facingRight: boolean;
  selectedWeapon: WeaponType;
  damageFlash: number;
  idleTime: number;
  isWalking: boolean;
  hitReactionTime: number;
  hitReactionX: number;
  hitReactionY: number;
  squashStretch: number;
  painTime: number;
  painIntensity: number;
  smokeParticles: SmokeParticle[];
  muzzleParticles: MuzzleParticle[];
  sparkParticles: SparkParticle[];
  smokeRings: SmokeRing[];
  chargeParticles: ChargeParticle[];
  fireParticles: FireParticle[];
  damageNumbers: DamageNumber[];
}

export class AntRenderer {
  // Helper to draw a single pixel block (2x2 screen pixels for ants)
  drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x * ANT_PIXEL_SCALE, y * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
  }

  // Helper to parse color from hex (#RRGGBB) or rgb(r, g, b) format
  parseColor(color: string): { r: number; g: number; b: number } {
    // Check if it's rgb format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
      };
    }
    // Otherwise parse as hex
    const num = parseInt(color.replace('#', ''), 16);
    return {
      r: (num >> 16) & 0xFF,
      g: (num >> 8) & 0xFF,
      b: num & 0xFF,
    };
  }

  // Helper to lighten a color (supports hex and rgb formats)
  lightenColor(color: string, amount: number): string {
    const { r, g, b } = this.parseColor(color);
    return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
  }

  // Helper to darken a color (supports hex and rgb formats)
  darkenColor(color: string, amount: number): string {
    const { r, g, b } = this.parseColor(color);
    return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
  }

  // Get weapon visual properties based on selected weapon
  getWeaponVisual(weapon: WeaponType): { color: string; light: string; dark: string; length: number } {
    switch (weapon) {
      case 'bazooka':
        return {
          color: '#4A3B28', // Dark brown
          light: '#5C4D3A',
          dark: '#2D2318',
          length: 14, // Longer barrel
        };
      case 'shotgun':
        return {
          color: '#5A5A5A', // Metal grey
          light: '#7A7A7A',
          dark: '#3A3A3A',
          length: 8, // Shorter barrel
        };
      case 'sniper':
        return {
          color: '#2A2A3A', // Dark blue-grey
          light: '#4A4A5A',
          dark: '#1A1A2A',
          length: 16, // Long barrel
        };
      default: // standard
        return {
          color: '#4A5D23', // Green
          light: '#5C7A29',
          dark: '#2D3A16',
          length: 12,
        };
    }
  }

  render(ctx: CanvasRenderingContext2D, ant: AntRenderData, isCurrentPlayer: boolean, chargingPower: number = 0): void {
    // Apply hit reaction offset
    ctx.save();
    if (ant.hitReactionTime > 0) {
      ctx.translate(ant.hitReactionX, ant.hitReactionY);
    }

    // Draw smoke rings (behind everything) - rendered directly, not pixelated
    for (const ring of ant.smokeRings) {
      ctx.fillStyle = `rgba(150, 150, 150, ${ring.alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw smoke particles (behind ant)
    for (const particle of ant.smokeParticles) {
      const alpha = (particle.life / 1.8) * 0.6;
      const gray = 60 + Math.random() * 50;
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // === PIXEL ART ANT RENDERING WITH SQUASH/STRETCH ===
    // Apply squash/stretch transform around the ant's base position
    if (ant.squashStretch !== 1.0) {
      ctx.save();
      // Transform origin at ant's feet
      ctx.translate(ant.x, ant.y);
      // Squash vertically, stretch horizontally to maintain volume
      const scaleX = 1.0 + (1.0 - ant.squashStretch) * 0.5;
      const scaleY = ant.squashStretch;
      ctx.scale(scaleX, scaleY);
      ctx.translate(-ant.x, -ant.y);
    }

    // Render directly to main canvas using pixel blocks
    this.renderAntBody(ctx, ant, isCurrentPlayer, chargingPower);

    if (ant.squashStretch !== 1.0) {
      ctx.restore();
    }

    // Draw spark particles
    for (const particle of ant.sparkParticles) {
      const alpha = particle.life / 0.6;
      const brightness = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 50}, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw fire particles (critical health) - rendered directly, not pixelated
    for (const particle of ant.fireParticles) {
      const lifeRatio = particle.life / particle.maxLife;
      ctx.fillStyle = `rgba(255, ${Math.floor(100 + lifeRatio * 100)}, 0, ${lifeRatio})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 200, ${lifeRatio * 0.8})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Draw floating damage numbers (outside main transform so they stay upright)
    this.renderDamageNumbers(ctx, ant.damageNumbers);
  }

  // Render floating damage numbers
  renderDamageNumbers(ctx: CanvasRenderingContext2D, damageNumbers: DamageNumber[]): void {
    for (const dmg of damageNumbers) {
      const alpha = Math.min(1, dmg.life / (dmg.maxLife * 0.3));
      const scale = dmg.scale;

      ctx.save();
      ctx.translate(dmg.x, dmg.y);
      ctx.scale(scale, scale);

      // Text styling
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline/shadow for readability
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.lineWidth = 3;
      ctx.strokeText(`-${dmg.value}`, 0, 0);

      // Fill color: red for critical, orange for normal
      if (dmg.isCritical) {
        ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(255, 150, 50, ${alpha})`;
      }
      ctx.fillText(`-${dmg.value}`, 0, 0);

      ctx.restore();
    }
  }

  // Render the ant body as pixel art (2x2 pixels for more detail)
  renderAntBody(ctx: CanvasRenderingContext2D, ant: AntRenderData, isCurrentPlayer: boolean, chargingPower: number = 0): void {
    const healthPercent = ant.health / 100;
    const direction = ant.facingRight ? 1 : -1;

    // Convert world position to pixel grid (2x2 scale)
    const baseX = Math.floor(ant.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(ant.y / ANT_PIXEL_SCALE);

    // Colors
    let bodyColor = '#2a2a2a';
    let bodyDark = '#1a1a1a';
    let bodyLight = '#3a3a3a';
    let helmetColor = ant.color;
    let helmetLight = this.lightenColor(ant.color, 50);
    let helmetDark = this.darkenColor(ant.color, 30);

    if (ant.damageFlash > 0) {
      bodyColor = '#fff';
      bodyDark = '#ddd';
      bodyLight = '#fff';
      helmetColor = '#fff';
      helmetLight = '#fff';
      helmetDark = '#ddd';
    } else if (healthPercent < 1) {
      const darken = Math.floor((1 - healthPercent) * 30);
      helmetColor = this.darkenColor(ant.color, darken);
      helmetLight = this.darkenColor(this.lightenColor(ant.color, 50), darken);
      helmetDark = this.darkenColor(ant.color, darken + 30);
    }

    // Animation offset
    const breatheOffset = Math.floor(Math.sin(ant.idleTime * 2) * 0.5);
    // Faster and more pronounced leg animation when walking
    const legSpeed = ant.isWalking ? 16 : 4;
    const legAmplitude = ant.isWalking ? 2 : 1;
    const legAnim = Math.floor(Math.sin(ant.idleTime * legSpeed) * legAmplitude);

    // Weapon angle
    const angleRad = (ant.angle * Math.PI) / 180;

    // === SHADOW ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect((baseX - 8) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 18 * ANT_PIXEL_SCALE, 2 * ANT_PIXEL_SCALE);

    // Shoulder position (where weapon attaches)
    const shoulderX = baseX + direction * 2;
    const shoulderY = baseY - 10 + breatheOffset;

    // === DRAW WEAPON (only for current player) ===
    if (isCurrentPlayer) {
      const weaponVisual = this.getWeaponVisual(ant.selectedWeapon);
      const weaponLen = weaponVisual.length;

      if (ant.selectedWeapon === 'shotgun') {
        // Shotgun: double barrel effect
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Two parallel barrels
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py + 1, weaponVisual.light);
          this.drawPixel(ctx, px, py + 2, weaponVisual.dark);
        }
        // Muzzle - two openings
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
        // Stock
        this.drawPixel(ctx, shoulderX - Math.round(Math.cos(angleRad) * 2), shoulderY + Math.round(Math.sin(angleRad) * 2), weaponVisual.dark);
        this.drawPixel(ctx, shoulderX - Math.round(Math.cos(angleRad) * 3), shoulderY + Math.round(Math.sin(angleRad) * 3), weaponVisual.dark);
      } else if (ant.selectedWeapon === 'bazooka') {
        // Heavy bazooka: thicker tube with scope
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Thicker tube (3 pixels)
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py + 1, weaponVisual.color);
          this.drawPixel(ctx, px, py + 2, weaponVisual.dark);
        }
        // Wider muzzle
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 2, '#1a1a1a');
        // Scope detail at mid-barrel
        const scopeX = shoulderX + Math.round(Math.cos(angleRad) * (weaponLen / 2));
        const scopeY = shoulderY - Math.round(Math.sin(angleRad) * (weaponLen / 2));
        this.drawPixel(ctx, scopeX, scopeY - 2, '#333');
        this.drawPixel(ctx, scopeX, scopeY - 3, '#444');
      } else if (ant.selectedWeapon === 'sniper') {
        // Sniper: long thin barrel with scope
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Thin barrel
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
        }
        // Muzzle
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY, '#1a1a1a');
        // Scope at 1/3 of barrel
        const scopeX = shoulderX + Math.round(Math.cos(angleRad) * (weaponLen / 3));
        const scopeY = shoulderY - Math.round(Math.sin(angleRad) * (weaponLen / 3));
        this.drawPixel(ctx, scopeX, scopeY - 2, '#222');
        this.drawPixel(ctx, scopeX, scopeY - 3, '#333');
        this.drawPixel(ctx, scopeX + 1, scopeY - 2, '#222');
        this.drawPixel(ctx, scopeX + 1, scopeY - 3, '#444');
        // Stock
        this.drawPixel(ctx, shoulderX - Math.round(Math.cos(angleRad) * 2), shoulderY + Math.round(Math.sin(angleRad) * 2), weaponVisual.dark);
      } else {
        // Standard: normal tube
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Main tube
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
          this.drawPixel(ctx, px, py + 1, weaponVisual.dark);
        }
        // Muzzle opening
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY, weaponVisual.dark);
        this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
      }
    }

    // === BACK LEGS (6 legs total for ant, showing 4) ===
    // Rear pair
    this.drawPixel(ctx, baseX - direction * 6, baseY - 2, bodyDark);
    this.drawPixel(ctx, baseX - direction * 7 - legAnim, baseY - 1, bodyDark);
    this.drawPixel(ctx, baseX - direction * 8 - legAnim, baseY, bodyDark);
    // Second rear
    this.drawPixel(ctx, baseX - direction * 4, baseY - 3, bodyDark);
    this.drawPixel(ctx, baseX - direction * 5 + legAnim, baseY - 2, bodyDark);
    this.drawPixel(ctx, baseX - direction * 6 + legAnim, baseY - 1, bodyDark);
    this.drawPixel(ctx, baseX - direction * 6 + legAnim, baseY, bodyDark);

    // === ABDOMEN (large oval back segment) ===
    // Top row
    this.drawPixel(ctx, baseX - direction * 4, baseY - 6 + breatheOffset, bodyLight);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 6 + breatheOffset, bodyLight);
    // Upper middle
    this.drawPixel(ctx, baseX - direction * 3, baseY - 5 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 4, baseY - 5 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 5 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 6, baseY - 5 + breatheOffset, bodyDark);
    // Lower middle
    this.drawPixel(ctx, baseX - direction * 3, baseY - 4 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 4, baseY - 4 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 4 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 6, baseY - 4 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - direction * 7, baseY - 4 + breatheOffset, bodyDark);
    // Bottom
    this.drawPixel(ctx, baseX - direction * 4, baseY - 3 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 3 + breatheOffset, bodyDark);

    // === PETIOLE (thin waist) ===
    this.drawPixel(ctx, baseX - direction * 1, baseY - 5 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - direction * 2, baseY - 5 + breatheOffset, bodyDark);

    // === THORAX (middle segment) ===
    this.drawPixel(ctx, baseX, baseY - 7 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 1, baseY - 7 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX, baseY - 6 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 1, baseY - 6 + breatheOffset, bodyLight);
    this.drawPixel(ctx, baseX + direction * 2, baseY - 7 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 2, baseY - 8 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 3, baseY - 9 + breatheOffset, bodyDark);

    // === FRONT/MIDDLE LEGS ===
    // Middle pair
    this.drawPixel(ctx, baseX, baseY - 5 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - legAnim, baseY - 4, bodyDark);
    this.drawPixel(ctx, baseX - legAnim, baseY - 3, bodyDark);
    this.drawPixel(ctx, baseX - legAnim - 1, baseY - 2, bodyDark);
    // Front pair
    this.drawPixel(ctx, baseX + direction * 2, baseY - 6, bodyDark);
    this.drawPixel(ctx, baseX + direction * 2 + legAnim, baseY - 5, bodyDark);
    this.drawPixel(ctx, baseX + direction * 2 + legAnim, baseY - 4, bodyDark);
    this.drawPixel(ctx, baseX + direction * 3 + legAnim, baseY - 3, bodyDark);

    // === NECK ===
    this.drawPixel(ctx, baseX + direction * 4, baseY - 10 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 5, baseY - 11 + breatheOffset, bodyDark);

    // === HEAD (round) ===
    // Top
    this.drawPixel(ctx, baseX + direction * 6, baseY - 15 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 15 + breatheOffset, bodyColor);
    // Upper
    this.drawPixel(ctx, baseX + direction * 5, baseY - 14 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 14 + breatheOffset, bodyLight);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 14 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 14 + breatheOffset, bodyDark);
    // Middle
    this.drawPixel(ctx, baseX + direction * 5, baseY - 13 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 13 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 13 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 13 + breatheOffset, bodyDark);
    // Lower
    this.drawPixel(ctx, baseX + direction * 6, baseY - 12 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 12 + breatheOffset, bodyDark);

    // === HELMET (team color, military style on top of head) ===
    // Helmet top
    this.drawPixel(ctx, baseX + direction * 5, baseY - 17 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 17 + breatheOffset, helmetLight);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 17 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 17 + breatheOffset, helmetColor);
    // Helmet middle
    this.drawPixel(ctx, baseX + direction * 4, baseY - 16 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 5, baseY - 16 + breatheOffset, helmetLight);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 16 + breatheOffset, helmetLight);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 16 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 16 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 9, baseY - 16 + breatheOffset, helmetDark);
    // Helmet brim
    this.drawPixel(ctx, baseX + direction * 4, baseY - 15 + breatheOffset, helmetDark);
    this.drawPixel(ctx, baseX + direction * 9, baseY - 15 + breatheOffset, helmetDark);
    this.drawPixel(ctx, baseX + direction * 10, baseY - 15 + breatheOffset, helmetDark);

    // === EYE (large cartoon eye) ===
    if (ant.painTime > 0 && ant.painIntensity > 0.5) {
      // X-shaped pain eye for high damage
      this.drawPixel(ctx, baseX + direction * 8, baseY - 14 + breatheOffset, '#ff3333');
      this.drawPixel(ctx, baseX + direction * 9, baseY - 13 + breatheOffset, '#ff3333');
      this.drawPixel(ctx, baseX + direction * 9, baseY - 15 + breatheOffset, '#ff3333');
      this.drawPixel(ctx, baseX + direction * 10, baseY - 14 + breatheOffset, '#ff3333');
    } else if (ant.painTime > 0) {
      // Squinted eye for lower damage - horizontal line
      this.drawPixel(ctx, baseX + direction * 8, baseY - 14 + breatheOffset, '#fff');
      this.drawPixel(ctx, baseX + direction * 9, baseY - 14 + breatheOffset, '#333');
      this.drawPixel(ctx, baseX + direction * 10, baseY - 14 + breatheOffset, '#fff');
    } else {
      // Normal eye
      // Eye white
      this.drawPixel(ctx, baseX + direction * 8, baseY - 14 + breatheOffset, '#fff');
      this.drawPixel(ctx, baseX + direction * 9, baseY - 14 + breatheOffset, '#fff');
      this.drawPixel(ctx, baseX + direction * 9, baseY - 13 + breatheOffset, '#fff');
      // Pupil
      this.drawPixel(ctx, baseX + direction * 9, baseY - 14 + breatheOffset, '#111');
    }

    // === ANTENNAE ===
    const antennaWave = Math.floor(Math.sin(ant.idleTime * 4) * 1);
    // Left antenna
    this.drawPixel(ctx, baseX + direction * 5 + antennaWave, baseY - 18 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 4 + antennaWave, baseY - 19 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 4 + antennaWave, baseY - 20 + breatheOffset, bodyColor);
    // Right antenna
    this.drawPixel(ctx, baseX + direction * 7 - antennaWave, baseY - 18 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 8 - antennaWave, baseY - 19 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 8 - antennaWave, baseY - 20 + breatheOffset, bodyColor);

    // === ARM holding weapon and TARGETING CURSOR (only for current player) ===
    if (isCurrentPlayer) {
      const weaponVisual = this.getWeaponVisual(ant.selectedWeapon);
      const armX = shoulderX + Math.round(Math.cos(angleRad) * 4);
      const armY = shoulderY - Math.round(Math.sin(angleRad) * 4) + 1;
      this.drawPixel(ctx, armX, armY, bodyDark);
      this.drawPixel(ctx, armX, armY + 1, bodyDark);

      // === TARGETING CURSOR ===
      this.renderTargetingCursor(ctx, shoulderX, shoulderY, angleRad, weaponVisual.length, ant.idleTime, chargingPower);
    }

    // === CURRENT PLAYER INDICATOR (arrow pointing down) ===
    if (isCurrentPlayer) {
      const bounce = Math.floor(Math.sin(ant.idleTime * 3) * 2);
      // Arrow shape
      this.drawPixel(ctx, baseX + direction * 6, baseY - 24 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 7, baseY - 24 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 5, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 6, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 7, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 8, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 6, baseY - 26 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 7, baseY - 26 + bounce, '#fff');
    }

    // === HEALTH BAR ===
    const healthBarY = baseY - 22 + breatheOffset;
    const healthPixels = Math.ceil(healthPercent * 12);
    const healthColor = healthPercent > 0.5 ? '#4ECB71' : healthPercent > 0.25 ? '#FFD93D' : '#FF6B6B';

    // Background
    for (let i = 0; i < 12; i++) {
      this.drawPixel(ctx, baseX + direction * i, healthBarY, '#333');
    }
    // Health fill
    for (let i = 0; i < healthPixels; i++) {
      this.drawPixel(ctx, baseX + direction * i, healthBarY, healthColor);
    }
  }

  // Render targeting cursor with aiming line, crosshair, and power indicator
  renderTargetingCursor(
    ctx: CanvasRenderingContext2D,
    shoulderX: number,
    shoulderY: number,
    angleRad: number,
    bazookaLen: number,
    idleTime: number,
    chargingPower: number = 0
  ): void {
    // Convert from pixel grid back to world coordinates
    // Note: angle already encodes direction (0=right, 90=up, 180=left)
    const muzzleWorldX = (shoulderX + Math.cos(angleRad) * bazookaLen) * ANT_PIXEL_SCALE;
    const muzzleWorldY = (shoulderY - Math.sin(angleRad) * bazookaLen) * ANT_PIXEL_SCALE;

    // Aiming line parameters
    const lineLength = 80; // Length of the aiming line
    const crosshairSize = 8;
    const dashLength = 6;
    const gapLength = 4;

    // Calculate end point of aiming line
    const endX = muzzleWorldX + Math.cos(angleRad) * lineLength;
    const endY = muzzleWorldY - Math.sin(angleRad) * lineLength;

    // Pulsing effect
    const pulse = 0.6 + Math.sin(idleTime * 4) * 0.2;

    ctx.save();

    // === POWER INDICATOR (grows along the line when charging) ===
    if (chargingPower > 0) {
      const powerRatio = chargingPower / 100;
      const powerLength = lineLength * powerRatio;
      const powerEndX = muzzleWorldX + Math.cos(angleRad) * powerLength;
      const powerEndY = muzzleWorldY - Math.sin(angleRad) * powerLength;

      // Power color: green -> yellow -> red as power increases
      let powerColor: string;
      if (powerRatio < 0.4) {
        powerColor = `rgba(78, 203, 113, ${0.8 + pulse * 0.2})`; // Green
      } else if (powerRatio < 0.7) {
        powerColor = `rgba(255, 217, 61, ${0.8 + pulse * 0.2})`; // Yellow
      } else {
        powerColor = `rgba(255, 107, 107, ${0.8 + pulse * 0.2})`; // Red
      }

      // Draw power fill line (thicker, solid)
      ctx.strokeStyle = powerColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(muzzleWorldX, muzzleWorldY);
      ctx.lineTo(powerEndX, powerEndY);
      ctx.stroke();

      // Glow effect for power line
      ctx.strokeStyle = powerColor.replace(/[\d.]+\)$/, '0.3)');
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(muzzleWorldX, muzzleWorldY);
      ctx.lineTo(powerEndX, powerEndY);
      ctx.stroke();

      // Power percentage text near the power line end
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      const textOffsetX = -Math.sin(angleRad) * 15;
      const textOffsetY = Math.cos(angleRad) * 15;
      ctx.fillText(`${Math.round(chargingPower)}%`, powerEndX + textOffsetX, powerEndY + textOffsetY);
    }

    // === DASHED AIMING LINE ===
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.setLineDash([dashLength, gapLength]);
    ctx.lineDashOffset = -idleTime * 20; // Animated dash

    ctx.beginPath();
    ctx.moveTo(muzzleWorldX, muzzleWorldY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

    // === CROSSHAIR at end of line ===
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.lineWidth = 2;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(endX - crosshairSize, endY);
    ctx.lineTo(endX + crosshairSize, endY);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(endX, endY - crosshairSize);
    ctx.lineTo(endX, endY + crosshairSize);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = `rgba(255, 100, 100, ${pulse})`;
    ctx.beginPath();
    ctx.arc(endX, endY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Outer circle
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(endX, endY, crosshairSize + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
