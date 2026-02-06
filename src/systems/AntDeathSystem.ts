import { TANK_WIDTH, TANK_HEIGHT, MAP_HEIGHT, WATER_LEVEL } from '../constants.ts';
import { Terrain } from '../Terrain.ts';
import { soundManager } from '../Sound.ts';
import {
  ANT_PIXEL_SCALE,
  DeathType,
  DestructionDebris,
  BodyPart,
  GhostParticle,
  GooParticle,
  DustParticle,
  ShockwaveRing,
  EtherealWisp,
  SplatMark,
  EmberParticle,
  LightningArc,
  DissolveParticle,
  DeathAnimationState,
} from '../types/AntParticleTypes.ts';
import { compactArray } from '../utils/compactArray.ts';
// Strategy pattern infrastructure is set up in ./death/
// These utilities can be used when extracting individual death effects:
// import { drawPixel, parseColor, lightenColor, darkenColor, getGroundYAt } from './death/DeathRenderingUtils.ts';

// Interface for the ant data needed by the death system
export interface AntDeathData {
  x: number;
  y: number;
  color: string;
  facingRight: boolean;
  idleTime: number;
}

// All particle arrays that the death system manages
export interface DeathParticles {
  destructionDebris: DestructionDebris[];
  bodyParts: BodyPart[];
  ghostParticle: GhostParticle | null;
  gooParticles: GooParticle[];
  dustParticles: DustParticle[];
  shockwaveRings: ShockwaveRing[];
  etherealWisps: EtherealWisp[];
  splatMarks: SplatMark[];
  emberParticles: EmberParticle[];
  lightningArcs: LightningArc[];
  dissolveParticles: DissolveParticle[];
}

export class AntDeathSystem {
  private terrain: Terrain | null = null;

  setTerrain(terrain: Terrain): void {
    this.terrain = terrain;
  }

  // Helper to get ground Y at a given X position
  private getGroundYAt(x: number, fallbackY: number): number {
    if (this.terrain) {
      const terrainHeight = this.terrain.getHeightAt(x);
      return MAP_HEIGHT - terrainHeight;
    }
    return fallbackY;
  }

  // Helper to draw a single pixel block
  private drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x * ANT_PIXEL_SCALE, y * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
  }

  // Helper to parse color
  private parseColor(color: string): { r: number; g: number; b: number } {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
      };
    }
    const num = parseInt(color.replace('#', ''), 16);
    return {
      r: (num >> 16) & 0xFF,
      g: (num >> 8) & 0xFF,
      b: num & 0xFF,
    };
  }

  private lightenColor(color: string, amount: number): string {
    const { r, g, b } = this.parseColor(color);
    return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
  }

  private darkenColor(color: string, amount: number): string {
    const { r, g, b } = this.parseColor(color);
    return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
  }

  // Initialize particles and effects for the selected death type
  initializeDeathEffect(
    ant: AntDeathData,
    deathType: DeathType,
    particles: DeathParticles,
    state: DeathAnimationState
  ): void {
    const centerX = ant.x;
    const centerY = ant.y - TANK_HEIGHT / 2;

    switch (deathType) {
      case 'explode':
        this.initExplodeDeath(ant, centerX, centerY, particles);
        break;
      case 'ghost':
        soundManager.playAntDeath('ghost');
        this.initGhostDeath(ant, centerX, particles);
        break;
      case 'splatter':
        soundManager.playAntDeath('splatter');
        this.initSplatterDeath(ant, centerX, centerY, particles, state);
        break;
      case 'disintegrate':
        soundManager.playAntDeath('disintegrate');
        this.initDisintegrateDeath(ant, centerX, centerY, particles, state);
        break;
      case 'vaporize':
        soundManager.playAntDeath('vaporize');
        this.initVaporizeDeath(state);
        break;
      case 'drown':
        soundManager.playAntDeath('drown');
        this.initDrownDeath(ant, centerX, centerY, particles);
        break;
    }
  }

  private initExplodeDeath(ant: AntDeathData, centerX: number, centerY: number, particles: DeathParticles): void {
    // Helmet flies off spinning
    particles.bodyParts.push({
      type: 'helmet',
      x: centerX + 10,
      y: centerY - 10,
      vx: 80 + Math.random() * 60,
      vy: -200 - Math.random() * 100,
      rotation: 0,
      rotationSpeed: 15 + Math.random() * 10,
      scale: 1.2,
      life: 3.0,
      color: ant.color,
    });
    // Head
    particles.bodyParts.push({
      type: 'head',
      x: centerX + 5,
      y: centerY - 5,
      vx: 40 + Math.random() * 40,
      vy: -150 - Math.random() * 80,
      rotation: 0,
      rotationSpeed: -12 + Math.random() * 6,
      scale: 1.0,
      life: 2.5,
      color: '#2a2a2a',
    });
    // Thorax
    particles.bodyParts.push({
      type: 'thorax',
      x: centerX,
      y: centerY,
      vx: -20 + Math.random() * 40,
      vy: -180 - Math.random() * 60,
      rotation: 0,
      rotationSpeed: 8 + Math.random() * 8,
      scale: 1.0,
      life: 2.5,
      color: '#2a2a2a',
    });
    // Abdomen
    particles.bodyParts.push({
      type: 'abdomen',
      x: centerX - 10,
      y: centerY + 5,
      vx: -60 - Math.random() * 40,
      vy: -120 - Math.random() * 80,
      rotation: 0,
      rotationSpeed: -10 + Math.random() * 5,
      scale: 1.1,
      life: 2.5,
      color: '#2a2a2a',
    });
    // Legs (6 of them)
    for (let i = 0; i < 6; i++) {
      const legAngle = (i / 6) * Math.PI * 2;
      particles.bodyParts.push({
        type: 'leg',
        x: centerX + Math.cos(legAngle) * 8,
        y: centerY + Math.sin(legAngle) * 5,
        vx: Math.cos(legAngle) * (100 + Math.random() * 80),
        vy: -100 - Math.random() * 100,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 25,
        scale: 0.8,
        life: 2.0 + Math.random() * 0.5,
        color: '#1a1a1a',
      });
    }
    // Antennae
    for (let i = 0; i < 2; i++) {
      particles.bodyParts.push({
        type: 'antenna',
        x: centerX + (i === 0 ? -5 : 5),
        y: centerY - 15,
        vx: (i === 0 ? -1 : 1) * (60 + Math.random() * 40),
        vy: -180 - Math.random() * 60,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 20,
        scale: 0.6,
        life: 2.0,
        color: '#2a2a2a',
      });
    }
    // Add smoke/dust cloud
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      particles.destructionDebris.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        rotation: 0,
        rotationSpeed: 0,
        size: 8 + Math.random() * 12,
        life: 1.5 + Math.random() * 1.0,
        color: 'rgba(80, 80, 80, 0.6)',
      });
    }
  }

  private initGhostDeath(ant: AntDeathData, centerX: number, particles: DeathParticles): void {
    particles.ghostParticle = {
      x: ant.x,
      y: ant.y - TANK_HEIGHT / 2,
      vy: -20,
      alpha: 1.0,
      scale: 1.0,
      wobble: 0,
    };
    // Body crumples on ground
    for (let i = 0; i < 5; i++) {
      particles.destructionDebris.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: ant.y,
        vx: (Math.random() - 0.5) * 15,
        vy: -5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0,
        size: 3 + Math.random() * 3,
        life: 2.0,
        color: '#2a2a2a',
      });
    }
  }

  private initSplatterDeath(
    ant: AntDeathData,
    centerX: number,
    centerY: number,
    particles: DeathParticles,
    state: DeathAnimationState
  ): void {
    state.destructionFlash = 1.5;

    // Create splat marks
    for (let i = 0; i < 8; i++) {
      const dist = 30 + Math.random() * 60;
      const angle = Math.random() * Math.PI * 2;
      particles.splatMarks.push({
        x: centerX + Math.cos(angle) * dist,
        y: ant.y + 2,
        size: 2 + Math.random() * 3,
        alpha: 0,
        color: ['#4A7023', '#3D5C1C', '#567D2E', ant.color][Math.floor(Math.random() * 4)],
      });
    }

    // Goo particles
    const gooColors = ['#4A7023', '#3D5C1C', '#567D2E', '#2E4A14', '#5D8A2D', ant.color];
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 250;
      const isLarge = Math.random() > 0.7;
      particles.gooParticles.push({
        x: centerX + (Math.random() - 0.5) * 10,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        size: isLarge ? (2 + Math.random() * 2) : (1 + Math.random() * 1),
        life: 4.0 + Math.random() * 2.0,
        color: gooColors[Math.floor(Math.random() * gooColors.length)],
        stuck: false,
        stuckX: 0,
        stuckY: 0,
      });
    }
    // Helmet survives
    particles.bodyParts.push({
      type: 'helmet',
      x: centerX,
      y: centerY - 10,
      vx: (Math.random() - 0.5) * 100,
      vy: -180 - Math.random() * 80,
      rotation: 0,
      rotationSpeed: 10 + Math.random() * 10,
      scale: 1.0,
      life: 3.5,
      color: ant.color,
    });
  }

  private initDisintegrateDeath(
    _ant: AntDeathData,
    centerX: number,
    centerY: number,
    particles: DeathParticles,
    state: DeathAnimationState
  ): void {
    state.disintegrateProgress = 0;

    // Create ember particles
    for (let i = 0; i < 40; i++) {
      particles.emberParticles.push({
        x: centerX + (Math.random() - 0.5) * TANK_WIDTH,
        y: centerY + (Math.random() - 0.5) * TANK_HEIGHT,
        vx: (Math.random() - 0.5) * 30 + 20,
        vy: -30 - Math.random() * 50,
        size: 2 + Math.random() * 3,
        life: 2.0 + Math.random() * 1.5,
        maxLife: 3.5,
        brightness: 0.8 + Math.random() * 0.2,
      });
    }

    // Dust/ash particles
    const dustColors = ['#3a3a3a', '#4a4a4a', '#5a5a5a', '#2a2a2a'];
    for (let i = 0; i < 100; i++) {
      const startY = centerY + TANK_HEIGHT/2 - (i / 100) * TANK_HEIGHT * 1.5;
      particles.dustParticles.push({
        x: centerX + (Math.random() - 0.5) * TANK_WIDTH * 1.2,
        y: startY,
        vx: 15 + Math.random() * 25,
        vy: -10 - Math.random() * 30,
        size: 2 + Math.random() * 5,
        alpha: 0,
        color: dustColors[Math.floor(Math.random() * dustColors.length)],
      });
    }
  }

  private initVaporizeDeath(state: DeathAnimationState): void {
    state.destructionFlash = 1.0;
    state.dissolveProgress = 0;
  }

  private initDrownDeath(
    _ant: AntDeathData,
    centerX: number,
    centerY: number,
    particles: DeathParticles
  ): void {
    // Minimal setup - a few bubble-like dust particles
    const bubbleColors = ['#88BBDD', '#AADDEE', '#6699BB'];
    for (let i = 0; i < 8; i++) {
      particles.dustParticles.push({
        x: centerX + (Math.random() - 0.5) * 16,
        y: centerY + Math.random() * 10,
        vx: (Math.random() - 0.5) * 15,
        vy: -20 - Math.random() * 30,
        size: 2 + Math.random() * 3,
        alpha: 0.8,
        color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
      });
    }
  }

  // Update death animation based on death type
  updateDeathAnimation(
    deltaTime: number,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    switch (state.deathType) {
      case 'explode':
        this.updateExplodeDeath(deltaTime, ant, state, particles);
        break;
      case 'ghost':
        this.updateGhostDeath(deltaTime, state, particles);
        break;
      case 'splatter':
        this.updateSplatterDeath(state);
        break;
      case 'disintegrate':
        this.updateDisintegrateDeath(deltaTime, state, particles);
        break;
      case 'vaporize':
        this.updateVaporizeDeath(deltaTime, ant, state, particles);
        break;
      case 'drown':
        this.updateDrownDeath(deltaTime, ant, state, particles);
        break;
    }
  }

  private updateExplodeDeath(
    deltaTime: number,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    if (state.deathAnimationStage === 1) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 2;
        state.deathAnimationTimer = 0.5;
      }
    } else if (state.deathAnimationStage === 2) {
      state.deathPopY += state.deathPopVy * deltaTime;
      state.deathPopVy += 400 * deltaTime;

      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 3;
        state.deathAnimationTimer = 0.3;

        // Spawn additional debris burst
        const debrisColors = [ant.color, '#1a1a1a', '#0a0a0a'];
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI - Math.PI / 2;
          const speed = 60 + Math.random() * 100;
          particles.destructionDebris.push({
            x: ant.x + (Math.random() - 0.5) * TANK_WIDTH,
            y: ant.y - TANK_HEIGHT / 2,
            vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
            vy: -Math.abs(Math.sin(angle) * speed) - 30,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 15,
            size: 2 + Math.random() * 5,
            life: 1.0 + Math.random() * 0.5,
            color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
          });
        }
      }
    } else if (state.deathAnimationStage === 3) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 0;
      }
    }
  }

  private updateGhostDeath(deltaTime: number, state: DeathAnimationState, particles: DeathParticles): void {
    if (state.deathAnimationStage === 1) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 2;
        state.deathAnimationTimer = 3.0;
      }
    } else if (state.deathAnimationStage === 2) {
      if (particles.ghostParticle) {
        particles.ghostParticle.y += particles.ghostParticle.vy * deltaTime;
        particles.ghostParticle.vy -= 5 * deltaTime;
        particles.ghostParticle.alpha -= deltaTime * 0.3;
        particles.ghostParticle.wobble += deltaTime * 3;
      }

      if (state.deathAnimationTimer <= 0 || (particles.ghostParticle && particles.ghostParticle.alpha <= 0)) {
        state.deathAnimationStage = 3;
        state.deathAnimationTimer = 0.1;
      }
    } else if (state.deathAnimationStage === 3) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 0;
        particles.ghostParticle = null;
        particles.etherealWisps = [];
      }
    }
  }

  private updateSplatterDeath(state: DeathAnimationState): void {
    if (state.deathAnimationStage === 1) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 2;
        state.deathAnimationTimer = 0.8;
      }
    } else if (state.deathAnimationStage === 2) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 3;
        state.deathAnimationTimer = 2.0;
      }
    } else if (state.deathAnimationStage === 3) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 0;
      }
    }
  }

  private updateDisintegrateDeath(deltaTime: number, state: DeathAnimationState, particles: DeathParticles): void {
    if (state.deathAnimationStage === 1) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 2;
        state.deathAnimationTimer = 1.5;
      }
    } else if (state.deathAnimationStage === 2) {
      state.disintegrateProgress += deltaTime * 0.8;
      if (state.disintegrateProgress > 1) state.disintegrateProgress = 1;

      const activateCount = Math.floor(state.disintegrateProgress * particles.dustParticles.length);
      for (let i = 0; i < activateCount; i++) {
        if (particles.dustParticles[i].alpha < 1) {
          particles.dustParticles[i].alpha = Math.min(1, particles.dustParticles[i].alpha + deltaTime * 3);
        }
      }

      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 3;
        state.deathAnimationTimer = 1.0;
      }
    } else if (state.deathAnimationStage === 3) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 0;
      }
    }
  }

  private updateVaporizeDeath(
    deltaTime: number,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    if (state.deathAnimationStage === 1) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 2;
        state.deathAnimationTimer = 1.5;
      }
    } else if (state.deathAnimationStage === 2) {
      const prevProgress = state.dissolveProgress;
      state.dissolveProgress += deltaTime * 0.7;
      if (state.dissolveProgress > 1) state.dissolveProgress = 1;

      const antHeight = 20;
      const dissolveLineY = ant.y - (state.dissolveProgress * antHeight * ANT_PIXEL_SCALE);

      if (Math.floor(state.dissolveProgress * 20) > Math.floor(prevProgress * 20)) {
        const particleColors = ['#00FFFF', '#FFFFFF', '#88FFFF', ant.color, '#AAFFFF'];
        for (let i = 0; i < 5; i++) {
          particles.dissolveParticles.push({
            x: ant.x + (Math.random() - 0.5) * 16,
            y: dissolveLineY + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 60,
            vy: -20 - Math.random() * 40,
            alpha: 1.0,
            color: particleColors[Math.floor(Math.random() * particleColors.length)],
          });
        }
      }

      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 3;
        state.deathAnimationTimer = 0.3;
      }
    } else if (state.deathAnimationStage === 3) {
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 0;
        particles.dissolveParticles = [];
      }
    }

    // Update dissolve particles
    for (const p of particles.dissolveParticles) {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy -= 20 * deltaTime;
      p.alpha -= deltaTime * 1.5;
    }
    compactArray(particles.dissolveParticles, p => p.alpha > 0);
  }

  private updateDrownDeath(
    deltaTime: number,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    if (state.deathAnimationStage === 1) {
      // Brief flash stage
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 2;
        state.deathAnimationTimer = 2.0;
      }
    } else if (state.deathAnimationStage === 2) {
      // Sinking stage - ant sinks below water surface
      state.deathPopY += 30 * deltaTime; // Sink downward

      // Spawn occasional bubble dust particles
      if (Math.random() < deltaTime * 3) {
        const bubbleColors = ['#88BBDD', '#AADDEE', '#6699BB'];
        particles.dustParticles.push({
          x: ant.x + (Math.random() - 0.5) * 12,
          y: WATER_LEVEL - 5,
          vx: (Math.random() - 0.5) * 8,
          vy: -15 - Math.random() * 20,
          size: 2 + Math.random() * 2,
          alpha: 0.7,
          color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
        });
      }

      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 3;
        state.deathAnimationTimer = 1.0;
      }
    } else if (state.deathAnimationStage === 3) {
      // Fade out - just bubbles remain
      if (state.deathAnimationTimer <= 0) {
        state.deathAnimationStage = 0;
      }
    }
  }

  // Update death-type specific particles
  updateDeathParticles(deltaTime: number, ant: AntDeathData, state: DeathAnimationState, particles: DeathParticles): void {
    // Update body parts (for explode death)
    for (const part of particles.bodyParts) {
      part.x += part.vx * deltaTime;
      part.y += part.vy * deltaTime;
      part.vy += 350 * deltaTime;
      part.vx *= 0.99;
      part.rotation += part.rotationSpeed * deltaTime;
      const groundY = this.getGroundYAt(part.x, ant.y);
      if (part.y > groundY) {
        part.y = groundY;
        part.vy *= -0.4;
        part.vx *= 0.7;
        part.rotationSpeed *= 0.5;
      }
      part.life -= deltaTime;
    }
    compactArray(particles.bodyParts, p => p.life > 0);

    // Update ethereal wisps
    if (particles.ghostParticle) {
      for (const wisp of particles.etherealWisps) {
        wisp.angle += wisp.speed * deltaTime;
        const orbitRadius = 25 + Math.sin(wisp.angle * 2) * 10;
        wisp.targetX = particles.ghostParticle.x + Math.cos(wisp.angle) * orbitRadius;
        wisp.targetY = particles.ghostParticle.y + Math.sin(wisp.angle * 0.5) * 15;
        wisp.x += (wisp.targetX - wisp.x) * 5 * deltaTime;
        wisp.y += (wisp.targetY - wisp.y) * 5 * deltaTime;
        wisp.alpha = particles.ghostParticle.alpha * 0.7;
      }
    }
    compactArray(particles.etherealWisps, w => w.alpha > 0.05);

    // Update goo particles
    for (const goo of particles.gooParticles) {
      if (!goo.stuck) {
        goo.x += goo.vx * deltaTime;
        goo.y += goo.vy * deltaTime;
        goo.vy += 500 * deltaTime;
        goo.vx *= 0.98;

        const groundY = this.getGroundYAt(goo.x, ant.y);
        if (goo.y > groundY) {
          goo.stuck = true;
          goo.stuckX = goo.x;
          goo.stuckY = groundY;
          for (const splat of particles.splatMarks) {
            if (splat.alpha === 0 && Math.abs(splat.x - goo.x) < 30) {
              splat.alpha = 0.8;
              splat.y = groundY;
              break;
            }
          }
        }
      }
      goo.life -= deltaTime * 0.2;
    }
    compactArray(particles.gooParticles, g => g.life > 0);

    // Fade splat marks slowly
    for (const splat of particles.splatMarks) {
      if (splat.alpha > 0 && state.deathAnimationStage === 0) {
        splat.alpha -= deltaTime * 0.1;
      }
    }
    compactArray(particles.splatMarks, s => s.alpha > 0);

    // Update ember particles
    for (const ember of particles.emberParticles) {
      ember.x += ember.vx * deltaTime;
      ember.y += ember.vy * deltaTime;
      ember.vy -= 30 * deltaTime;
      ember.vx += 10 * deltaTime;
      ember.life -= deltaTime;
      ember.brightness = 0.5 + Math.random() * 0.5;
    }
    compactArray(particles.emberParticles, e => e.life > 0);

    // Update dust particles
    for (const dust of particles.dustParticles) {
      if (dust.alpha > 0) {
        dust.x += dust.vx * deltaTime;
        dust.y += dust.vy * deltaTime;
        dust.vy -= 15 * deltaTime;
        dust.vx += 8 * deltaTime;
        // Fade during wind-down (stage 3) and after animation completes (stage 0)
        if (state.deathAnimationStage === 3 || state.deathAnimationStage === 0) {
          dust.alpha -= deltaTime * 0.8;
        }
      }
    }
    compactArray(particles.dustParticles, d => d.alpha > 0);

    // Update lightning arcs
    for (const arc of particles.lightningArcs) {
      arc.life -= deltaTime;
      arc.alpha = arc.life * 3;
      if (Math.random() > 0.5) {
        for (let i = 1; i < arc.segments.length - 1; i++) {
          const t = i / (arc.segments.length - 1);
          const baseX = arc.startX + (arc.endX - arc.startX) * t;
          const baseY = arc.startY + (arc.endY - arc.startY) * t;
          const angle = Math.atan2(arc.endY - arc.startY, arc.endX - arc.startX);
          const offset = (Math.random() - 0.5) * 25;
          arc.segments[i].x = baseX - Math.sin(angle) * offset;
          arc.segments[i].y = baseY + Math.cos(angle) * offset;
        }
      }
    }
    compactArray(particles.lightningArcs, a => a.life > 0);

    // Update shockwave rings
    for (const ring of particles.shockwaveRings) {
      const expandSpeed = 250;
      ring.radius += expandSpeed * deltaTime;
      ring.alpha -= deltaTime * 2.0;
    }
    compactArray(particles.shockwaveRings, r => r.alpha > 0 && r.radius < r.maxRadius);

    // Update destruction debris
    for (const debris of particles.destructionDebris) {
      debris.x += debris.vx * deltaTime;
      debris.y += debris.vy * deltaTime;
      debris.vy += 200 * deltaTime;
      debris.rotation += debris.rotationSpeed * deltaTime;
      debris.life -= deltaTime;
    }
    compactArray(particles.destructionDebris, d => d.life > 0);
  }

  // Render destroyed ant
  renderDestroyed(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    // Destruction flash
    if (state.destructionFlash > 0) {
      const flashRadius = state.deathType === 'vaporize' ? 120 : (state.deathType === 'splatter' ? 80 : 60);
      const flashGradient = ctx.createRadialGradient(
        ant.x, ant.y - 20, 0,
        ant.x, ant.y - 20, flashRadius
      );
      const flashAlpha = Math.min(1, state.destructionFlash);
      if (state.deathType === 'vaporize') {
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGradient.addColorStop(0.2, `rgba(200, 230, 255, ${flashAlpha * 0.9})`);
        flashGradient.addColorStop(0.5, `rgba(100, 180, 255, ${flashAlpha * 0.5})`);
        flashGradient.addColorStop(1, 'rgba(50, 100, 200, 0)');
      } else if (state.deathType === 'splatter') {
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGradient.addColorStop(0.3, `rgba(200, 255, 150, ${flashAlpha * 0.7})`);
        flashGradient.addColorStop(0.6, `rgba(100, 200, 50, ${flashAlpha * 0.3})`);
        flashGradient.addColorStop(1, 'rgba(50, 100, 0, 0)');
      } else {
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGradient.addColorStop(0.2, `rgba(255, 255, 200, ${flashAlpha * 0.8})`);
        flashGradient.addColorStop(0.5, `rgba(255, 150, 50, ${flashAlpha * 0.4})`);
        flashGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      }
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(ant.x, ant.y - 20, flashRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw destruction debris as smoke puffs
    for (const debris of particles.destructionDebris) {
      const alpha = Math.min(1, debris.life) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = debris.color;
      ctx.beginPath();
      ctx.arc(debris.x, debris.y, debris.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Render death-type specific effects
    switch (state.deathType) {
      case 'explode':
        this.renderExplodeDeath(ctx, ant, state, particles);
        break;
      case 'ghost':
        this.renderGhostDeath(ctx, ant, state, particles);
        break;
      case 'splatter':
        this.renderSplatterDeath(ctx, ant, state, particles);
        break;
      case 'disintegrate':
        this.renderDisintegrateDeath(ctx, ant, state, particles);
        break;
      case 'vaporize':
        this.renderVaporizeDeath(ctx, ant, state, particles);
        break;
      case 'drown':
        this.renderDrownDeath(ctx, ant, state, particles);
        break;
    }
  }

  private renderExplodeDeath(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    const ps = ANT_PIXEL_SCALE;

    for (const part of particles.bodyParts) {
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.rotation);
      ctx.globalAlpha = Math.min(1, part.life / 0.5);

      const dark = this.darkenColor(part.color, 30);
      const light = this.lightenColor(part.color, 30);

      switch (part.type) {
        case 'helmet':
          ctx.fillStyle = part.color;
          ctx.fillRect(-2 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillStyle = light;
          ctx.fillRect(-1 * ps, -2 * ps, ps, ps);
          ctx.fillRect(0, -2 * ps, ps, ps);
          ctx.fillStyle = dark;
          ctx.fillRect(2 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-2 * ps, 0, ps, ps);
          ctx.fillRect(2 * ps, 0, ps, ps);
          break;
        case 'head':
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(0, -2 * ps, ps, ps);
          ctx.fillStyle = '#fff';
          ctx.fillRect(1 * ps, 0, ps, ps);
          break;
        case 'thorax':
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          break;
        case 'abdomen':
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-2 * ps, 0, ps, ps);
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(-1 * ps, -2 * ps, ps, ps);
          ctx.fillRect(0, -2 * ps, ps, ps);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-1 * ps, 1 * ps, ps, ps);
          ctx.fillRect(0, 1 * ps, ps, ps);
          break;
        case 'leg':
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          break;
        case 'antenna':
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(1 * ps, -2 * ps, ps, ps);
          break;
      }
      ctx.restore();
    }

    if (state.deathAnimationStage >= 3 || particles.bodyParts.length === 0) {
      this.renderDeadAntBody(ctx, ant, state);
    }
  }

  private renderGhostDeath(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    if (state.deathAnimationStage >= 2) {
      this.renderCollapsedBody(ctx, ant);
    }

    if (particles.ghostParticle && particles.ghostParticle.alpha > 0.01) {
      ctx.save();

      const ghostAlpha = particles.ghostParticle.alpha;
      const gx = particles.ghostParticle.x;
      const gy = particles.ghostParticle.y;
      const wobbleX = Math.sin(particles.ghostParticle.wobble) * 2;

      const baseX = Math.floor(gx / ANT_PIXEL_SCALE) + Math.floor(wobbleX);
      const baseY = Math.floor(gy / ANT_PIXEL_SCALE);
      const direction = ant.facingRight ? 1 : -1;

      const ghostLight = `rgba(255, 255, 255, ${ghostAlpha * 0.9})`;
      const ghostMid = `rgba(220, 240, 255, ${ghostAlpha * 0.7})`;
      const ghostDark = `rgba(200, 220, 255, ${ghostAlpha * 0.5})`;

      // Outer glow
      ctx.globalAlpha = ghostAlpha * 0.3;
      const glowGradient = ctx.createRadialGradient(gx, gy - 10, 0, gx, gy - 10, 40);
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      glowGradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.2)');
      glowGradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(gx, gy - 10, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;

      // Halo
      const haloY = baseY - 22;
      const haloX = baseX + direction * 6;

      ctx.fillStyle = `rgba(255, 255, 200, ${ghostAlpha * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(haloX * ANT_PIXEL_SCALE, haloY * ANT_PIXEL_SCALE, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 220, ${ghostAlpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(haloX * ANT_PIXEL_SCALE, haloY * ANT_PIXEL_SCALE, 12, 4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${ghostAlpha * 0.9})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(haloX * ANT_PIXEL_SCALE, haloY * ANT_PIXEL_SCALE, 10, 3, 0, 0, Math.PI * 2);
      ctx.stroke();

      const drawGhostPixel = (px: number, py: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(px * ANT_PIXEL_SCALE, py * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
      };

      // Ghost ant body (simplified for brevity - same structure as original)
      drawGhostPixel(baseX - direction * 6, baseY - 2, ghostDark);
      drawGhostPixel(baseX - direction * 7, baseY - 1, ghostDark);
      drawGhostPixel(baseX - direction * 8, baseY, ghostDark);
      drawGhostPixel(baseX - direction * 4, baseY - 3, ghostDark);
      drawGhostPixel(baseX - direction * 5, baseY - 2, ghostDark);
      drawGhostPixel(baseX - direction * 6, baseY - 1, ghostDark);

      drawGhostPixel(baseX - direction * 4, baseY - 6, ghostLight);
      drawGhostPixel(baseX - direction * 5, baseY - 6, ghostLight);
      drawGhostPixel(baseX - direction * 3, baseY - 5, ghostMid);
      drawGhostPixel(baseX - direction * 4, baseY - 5, ghostMid);
      drawGhostPixel(baseX - direction * 5, baseY - 5, ghostMid);
      drawGhostPixel(baseX - direction * 6, baseY - 5, ghostDark);
      drawGhostPixel(baseX - direction * 3, baseY - 4, ghostMid);
      drawGhostPixel(baseX - direction * 4, baseY - 4, ghostMid);
      drawGhostPixel(baseX - direction * 5, baseY - 4, ghostMid);
      drawGhostPixel(baseX - direction * 6, baseY - 4, ghostDark);
      drawGhostPixel(baseX - direction * 7, baseY - 4, ghostDark);
      drawGhostPixel(baseX - direction * 4, baseY - 3, ghostDark);
      drawGhostPixel(baseX - direction * 5, baseY - 3, ghostDark);

      drawGhostPixel(baseX - direction * 1, baseY - 5, ghostDark);
      drawGhostPixel(baseX - direction * 2, baseY - 5, ghostDark);

      drawGhostPixel(baseX, baseY - 7, ghostMid);
      drawGhostPixel(baseX + direction * 1, baseY - 7, ghostMid);
      drawGhostPixel(baseX, baseY - 6, ghostMid);
      drawGhostPixel(baseX + direction * 1, baseY - 6, ghostLight);
      drawGhostPixel(baseX + direction * 2, baseY - 7, ghostMid);
      drawGhostPixel(baseX + direction * 2, baseY - 8, ghostMid);
      drawGhostPixel(baseX + direction * 3, baseY - 9, ghostDark);

      drawGhostPixel(baseX, baseY - 5, ghostDark);
      drawGhostPixel(baseX, baseY - 4, ghostDark);
      drawGhostPixel(baseX, baseY - 3, ghostDark);
      drawGhostPixel(baseX - 1, baseY - 2, ghostDark);
      drawGhostPixel(baseX + direction * 2, baseY - 6, ghostDark);
      drawGhostPixel(baseX + direction * 2, baseY - 5, ghostDark);
      drawGhostPixel(baseX + direction * 2, baseY - 4, ghostDark);
      drawGhostPixel(baseX + direction * 3, baseY - 3, ghostDark);

      drawGhostPixel(baseX + direction * 4, baseY - 10, ghostDark);
      drawGhostPixel(baseX + direction * 5, baseY - 11, ghostDark);

      drawGhostPixel(baseX + direction * 6, baseY - 15, ghostMid);
      drawGhostPixel(baseX + direction * 7, baseY - 15, ghostMid);
      drawGhostPixel(baseX + direction * 5, baseY - 14, ghostMid);
      drawGhostPixel(baseX + direction * 6, baseY - 14, ghostLight);
      drawGhostPixel(baseX + direction * 7, baseY - 14, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 14, ghostDark);
      drawGhostPixel(baseX + direction * 5, baseY - 13, ghostMid);
      drawGhostPixel(baseX + direction * 6, baseY - 13, ghostMid);
      drawGhostPixel(baseX + direction * 7, baseY - 13, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 13, ghostDark);
      drawGhostPixel(baseX + direction * 6, baseY - 12, ghostDark);
      drawGhostPixel(baseX + direction * 7, baseY - 12, ghostDark);

      drawGhostPixel(baseX + direction * 5, baseY - 17, ghostMid);
      drawGhostPixel(baseX + direction * 6, baseY - 17, ghostLight);
      drawGhostPixel(baseX + direction * 7, baseY - 17, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 17, ghostMid);
      drawGhostPixel(baseX + direction * 4, baseY - 16, ghostMid);
      drawGhostPixel(baseX + direction * 5, baseY - 16, ghostLight);
      drawGhostPixel(baseX + direction * 6, baseY - 16, ghostLight);
      drawGhostPixel(baseX + direction * 7, baseY - 16, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 16, ghostMid);
      drawGhostPixel(baseX + direction * 9, baseY - 16, ghostDark);
      drawGhostPixel(baseX + direction * 4, baseY - 15, ghostDark);
      drawGhostPixel(baseX + direction * 9, baseY - 15, ghostDark);
      drawGhostPixel(baseX + direction * 10, baseY - 15, ghostDark);

      ctx.strokeStyle = `rgba(150, 180, 220, ${ghostAlpha * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((baseX + direction * 8) * ANT_PIXEL_SCALE, (baseY - 13.5) * ANT_PIXEL_SCALE);
      ctx.lineTo((baseX + direction * 10) * ANT_PIXEL_SCALE, (baseY - 13.5) * ANT_PIXEL_SCALE);
      ctx.stroke();

      drawGhostPixel(baseX + direction * 5, baseY - 18, ghostDark);
      drawGhostPixel(baseX + direction * 4, baseY - 19, ghostDark);
      drawGhostPixel(baseX + direction * 4, baseY - 20, ghostMid);
      drawGhostPixel(baseX + direction * 7, baseY - 18, ghostDark);
      drawGhostPixel(baseX + direction * 8, baseY - 19, ghostDark);
      drawGhostPixel(baseX + direction * 8, baseY - 20, ghostMid);

      ctx.restore();
    }
  }

  private renderSplatterDeath(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    // Render splat marks on ground
    for (const splat of particles.splatMarks) {
      if (splat.alpha > 0) {
        ctx.globalAlpha = splat.alpha;
        const splatBaseX = Math.floor(splat.x / ANT_PIXEL_SCALE);
        const splatBaseY = Math.floor(splat.y / ANT_PIXEL_SCALE);
        const pixelCount = Math.floor(splat.size);

        for (let i = -pixelCount; i <= pixelCount; i++) {
          this.drawPixel(ctx, splatBaseX + i, splatBaseY, splat.color);
        }
        if (pixelCount > 1) {
          this.drawPixel(ctx, splatBaseX, splatBaseY, this.darkenColor(splat.color, 20));
        }
      }
    }
    ctx.globalAlpha = 1;

    if (state.deathAnimationStage === 1) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.translate(ant.x, ant.y - TANK_HEIGHT / 2);
      const popScale = 1 + (0.15 - state.deathAnimationTimer) * 3;
      ctx.scale(popScale, popScale);
      ctx.translate(-ant.x, -(ant.y - TANK_HEIGHT / 2));
      this.renderDeadAntBody(ctx, ant, state);
      ctx.restore();
    }

    // Render flying goo particles
    for (const goo of particles.gooParticles) {
      const alpha = Math.min(1, goo.life / 2);
      const gooBaseX = Math.floor(goo.x / ANT_PIXEL_SCALE);
      const gooBaseY = Math.floor(goo.y / ANT_PIXEL_SCALE);
      const gooPixelSize = Math.max(1, Math.floor(goo.size));

      if (goo.stuck) {
        ctx.globalAlpha = alpha;
        const stuckBaseX = Math.floor(goo.stuckX / ANT_PIXEL_SCALE);
        const stuckBaseY = Math.floor(goo.stuckY / ANT_PIXEL_SCALE);
        this.drawPixel(ctx, stuckBaseX, stuckBaseY, goo.color);
        if (gooPixelSize > 1) {
          this.drawPixel(ctx, stuckBaseX + 1, stuckBaseY, goo.color);
        }
      } else {
        ctx.globalAlpha = alpha;
        this.drawPixel(ctx, gooBaseX, gooBaseY, goo.color);
        if (gooPixelSize > 1) {
          this.drawPixel(ctx, gooBaseX + 1, gooBaseY, goo.color);
          this.drawPixel(ctx, gooBaseX, gooBaseY + 1, this.darkenColor(goo.color, 15));
        }

        const speed = Math.sqrt(goo.vx * goo.vx + goo.vy * goo.vy);
        if (speed > 100) {
          const angle = Math.atan2(goo.vy, goo.vx);
          ctx.globalAlpha = alpha * 0.5;
          const tx = gooBaseX - Math.round(Math.cos(angle));
          const ty = gooBaseY - Math.round(Math.sin(angle));
          this.drawPixel(ctx, tx, ty, this.darkenColor(goo.color, 30));
        }
      }
    }
    ctx.globalAlpha = 1;

    // Render helmet
    for (const part of particles.bodyParts) {
      if (part.type === 'helmet') {
        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rotation);
        ctx.globalAlpha = Math.min(1, part.life / 0.5);
        ctx.fillStyle = part.color;
        ctx.fillRect(-1 * ANT_PIXEL_SCALE, -1 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.fillRect(0, -1 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.fillRect(1 * ANT_PIXEL_SCALE, -1 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.fillStyle = this.lightenColor(part.color, 30);
        ctx.fillRect(0, -2 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.restore();
      }
    }
  }

  private renderDisintegrateDeath(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    const groundY = this.getGroundYAt(ant.x, ant.y);
    const baseX = Math.floor(ant.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(groundY / ANT_PIXEL_SCALE);

    // Render ember particles
    for (const ember of particles.emberParticles) {
      const lifeRatio = ember.life / ember.maxLife;
      const emberBaseX = Math.floor(ember.x / ANT_PIXEL_SCALE);
      const emberBaseY = Math.floor(ember.y / ANT_PIXEL_SCALE);

      ctx.globalAlpha = lifeRatio * ember.brightness * 0.4;
      this.drawPixel(ctx, emberBaseX - 1, emberBaseY, '#FF6414');
      this.drawPixel(ctx, emberBaseX + 1, emberBaseY, '#FF6414');
      this.drawPixel(ctx, emberBaseX, emberBaseY - 1, '#FF6414');
      this.drawPixel(ctx, emberBaseX, emberBaseY + 1, '#FF6414');

      ctx.globalAlpha = lifeRatio * ember.brightness;
      this.drawPixel(ctx, emberBaseX, emberBaseY, '#FFEE88');
    }
    ctx.globalAlpha = 1;

    if (state.disintegrateProgress < 1) {
      ctx.save();

      const remainingHeight = TANK_HEIGHT * (1 - state.disintegrateProgress);
      const clipY = ant.y - TANK_HEIGHT;

      ctx.beginPath();
      ctx.rect(ant.x - TANK_WIDTH, clipY, TANK_WIDTH * 2, remainingHeight);
      ctx.clip();

      const edgeGlow = state.disintegrateProgress > 0.2;
      if (edgeGlow) {
        const edgePixelY = Math.floor((clipY + remainingHeight) / ANT_PIXEL_SCALE);
        ctx.globalAlpha = 0.6;
        for (let px = -4; px <= 4; px++) {
          this.drawPixel(ctx, baseX + px, edgePixelY, '#FF9632');
        }
      }

      const flicker = Math.random() > 0.05 ? 1 : 0.3;
      ctx.globalAlpha = flicker;
      this.renderDeadAntBody(ctx, ant, state);

      ctx.restore();
    }

    // Render dust particles
    for (const dust of particles.dustParticles) {
      if (dust.alpha > 0) {
        ctx.globalAlpha = dust.alpha * 0.8;
        const dustBaseX = Math.floor(dust.x / ANT_PIXEL_SCALE);
        const dustBaseY = Math.floor(dust.y / ANT_PIXEL_SCALE);
        this.drawPixel(ctx, dustBaseX, dustBaseY, dust.color);
      }
    }
    ctx.globalAlpha = 1;

    // Render ash pile after full disintegration
    if (state.disintegrateProgress >= 1) {
      const ashColor = '#282828';
      const ashLight = '#464646';
      for (let px = -2; px <= 2; px++) {
        this.drawPixel(ctx, baseX + px, baseY, ashColor);
      }
      this.drawPixel(ctx, baseX - 1, baseY, ashLight);
      this.drawPixel(ctx, baseX, baseY, ashLight);

      this.drawPixel(ctx, baseX + 2, baseY - 1, this.darkenColor(ant.color, 30));
      this.drawPixel(ctx, baseX + 3, baseY, this.darkenColor(ant.color, 40));

      if (Math.random() > 0.7) {
        ctx.globalAlpha = 0.6;
        const emberOffsetX = Math.floor((Math.random() - 0.5) * 3);
        this.drawPixel(ctx, baseX + emberOffsetX, baseY - 1, '#FF9632');
        ctx.globalAlpha = 1;
      }
    }
  }

  private renderVaporizeDeath(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    const baseX = Math.floor(ant.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(ant.y / ANT_PIXEL_SCALE);
    const groundY = this.getGroundYAt(ant.x, ant.y);
    const groundBaseY = Math.floor(groundY / ANT_PIXEL_SCALE);

    // Render dissolve particles
    for (const p of particles.dissolveParticles) {
      ctx.globalAlpha = p.alpha;
      const px = Math.floor(p.x / ANT_PIXEL_SCALE);
      const py = Math.floor(p.y / ANT_PIXEL_SCALE);
      this.drawPixel(ctx, px, py, p.color);
      if (Math.random() > 0.7) {
        ctx.globalAlpha = p.alpha * 0.5;
        this.drawPixel(ctx, px + (Math.random() > 0.5 ? 1 : -1), py, p.color);
      }
    }
    ctx.globalAlpha = 1;

    if (state.deathAnimationStage === 1) {
      ctx.globalAlpha = 0.8;
      this.renderAntWithTint(ctx, ant, '#00FFFF');
      ctx.globalAlpha = 1;
    } else if (state.deathAnimationStage === 2) {
      const antHeight = 20;
      const dissolveLinePixelY = baseY - Math.floor(state.dissolveProgress * antHeight);

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        (baseX - 15) * ANT_PIXEL_SCALE,
        (baseY - antHeight - 5) * ANT_PIXEL_SCALE,
        30 * ANT_PIXEL_SCALE,
        (baseY - dissolveLinePixelY + 5) * ANT_PIXEL_SCALE
      );
      ctx.clip();

      this.renderDeadAntBody(ctx, ant, state);
      ctx.restore();

      ctx.globalAlpha = 0.9;
      const glitchColors = ['#00FFFF', '#FFFFFF', '#88FFFF', ant.color];
      for (let px = -6; px <= 6; px++) {
        if (Math.random() > 0.2) {
          const glitchOffset = Math.floor((Math.random() - 0.5) * 2);
          const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
          this.drawPixel(ctx, baseX + px + glitchOffset, dissolveLinePixelY, color);
        }
      }

      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 8; i++) {
        const noiseX = baseX + Math.floor((Math.random() - 0.5) * 12);
        const noiseY = dissolveLinePixelY + Math.floor((Math.random() - 0.5) * 3);
        const noiseColor = Math.random() > 0.5 ? '#00FFFF' : '#FFFFFF';
        this.drawPixel(ctx, noiseX, noiseY, noiseColor);
      }
      ctx.globalAlpha = 1;
    } else if (state.deathAnimationStage >= 3 || state.deathAnimationStage === 0) {
      ctx.globalAlpha = 0.5;
      this.drawPixel(ctx, baseX - 1, groundBaseY, '#00AAAA');
      this.drawPixel(ctx, baseX, groundBaseY, '#008888');
      this.drawPixel(ctx, baseX + 1, groundBaseY, '#00AAAA');

      if (Math.random() > 0.9) {
        ctx.globalAlpha = 0.4;
        this.drawPixel(ctx, baseX + Math.floor((Math.random() - 0.5) * 4), groundBaseY - 1, '#00FFFF');
      }
      ctx.globalAlpha = 1;
    }
  }

  private renderDrownDeath(
    ctx: CanvasRenderingContext2D,
    ant: AntDeathData,
    state: DeathAnimationState,
    particles: DeathParticles
  ): void {
    // Render bubble dust particles
    for (const dust of particles.dustParticles) {
      if (dust.alpha > 0) {
        ctx.globalAlpha = dust.alpha * 0.8;
        ctx.strokeStyle = dust.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
        ctx.stroke();
        // Small highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${dust.alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(dust.x - dust.size * 0.3, dust.y - dust.size * 0.3, dust.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (state.deathAnimationStage === 2) {
      // Render ant body sinking below water with increasing transparency and blue tint
      const sinkAmount = state.deathPopY;
      const alpha = Math.max(0, 1 - sinkAmount / 60);

      if (alpha > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;

        // Clip to below water level to show only submerged part
        ctx.translate(0, sinkAmount);

        // Blue tint overlay
        this.renderDeadAntBody(ctx, ant, state);

        // Apply blue tint
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(68, 136, 204, ${0.3 + sinkAmount / 100})`;
        ctx.fillRect(ant.x - 30, ant.y - 40, 60, 50);
        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();
      }
    }
  }

  private renderAntWithTint(ctx: CanvasRenderingContext2D, ant: AntDeathData, tintColor: string): void {
    const baseX = Math.floor(ant.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(ant.y / ANT_PIXEL_SCALE);

    this.drawPixel(ctx, baseX - 3, baseY - 4, tintColor);
    this.drawPixel(ctx, baseX - 4, baseY - 4, tintColor);
    this.drawPixel(ctx, baseX - 3, baseY - 5, tintColor);
    this.drawPixel(ctx, baseX - 4, baseY - 5, tintColor);
    this.drawPixel(ctx, baseX, baseY - 6, tintColor);
    this.drawPixel(ctx, baseX + 1, baseY - 6, tintColor);
    this.drawPixel(ctx, baseX + 1, baseY - 7, tintColor);
    this.drawPixel(ctx, baseX + 4, baseY - 9, tintColor);
    this.drawPixel(ctx, baseX + 5, baseY - 9, tintColor);
    this.drawPixel(ctx, baseX + 4, baseY - 10, tintColor);
    this.drawPixel(ctx, baseX + 5, baseY - 10, tintColor);
    this.drawPixel(ctx, baseX + 3, baseY - 11, tintColor);
    this.drawPixel(ctx, baseX + 4, baseY - 11, tintColor);
    this.drawPixel(ctx, baseX + 5, baseY - 11, tintColor);
  }

  private renderCollapsedBody(ctx: CanvasRenderingContext2D, ant: AntDeathData): void {
    const groundY = this.getGroundYAt(ant.x, ant.y);
    const baseX = Math.floor(ant.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(groundY / ANT_PIXEL_SCALE);

    const bodyColor = '#2a2a2a';
    const bodyDark = '#1a1a1a';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect((baseX - 2) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 5 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);

    this.drawPixel(ctx, baseX - 2, baseY, bodyDark);
    this.drawPixel(ctx, baseX - 1, baseY, bodyColor);
    this.drawPixel(ctx, baseX, baseY, bodyColor);
    this.drawPixel(ctx, baseX + 1, baseY, bodyDark);
    this.drawPixel(ctx, baseX + 2, baseY, bodyDark);
  }

  private renderDeadAntBody(ctx: CanvasRenderingContext2D, ant: AntDeathData, state: DeathAnimationState): void {
    const baseX = Math.floor(ant.x / ANT_PIXEL_SCALE);
    const isTumbling = state.deathAnimationStage === 1 || state.deathAnimationStage === 2;
    const yPos = isTumbling ? ant.y : this.getGroundYAt(ant.x, ant.y);
    const baseY = Math.floor(yPos / ANT_PIXEL_SCALE);

    const bodyColor = state.deathAnimationStage === 1 ? '#fff' : '#2a2a2a';
    const bodyDark = state.deathAnimationStage === 1 ? '#ddd' : '#1a1a1a';
    const bodyLight = state.deathAnimationStage === 1 ? '#fff' : '#3a3a3a';
    const helmetColor = state.deathAnimationStage === 1 ? '#fff' : this.darkenColor(ant.color, 30);
    const helmetLight = state.deathAnimationStage === 1 ? '#fff' : ant.color;

    if (isTumbling) {
      const popOffset = Math.floor(state.deathPopY / ANT_PIXEL_SCALE);
      const wobble = Math.floor(Math.sin(ant.idleTime * 15) * 2);
      const rotation = Math.floor(Math.sin(ant.idleTime * 8) * 3);

      this.drawPixel(ctx, baseX - 4 + wobble, baseY - 4 + popOffset + rotation, bodyColor);
      this.drawPixel(ctx, baseX - 5 + wobble, baseY - 4 + popOffset + rotation, bodyColor);
      this.drawPixel(ctx, baseX - 6 + wobble, baseY - 4 + popOffset + rotation, bodyDark);
      this.drawPixel(ctx, baseX - 4 + wobble, baseY - 5 + popOffset + rotation, bodyLight);
      this.drawPixel(ctx, baseX - 5 + wobble, baseY - 5 + popOffset + rotation, bodyColor);
      this.drawPixel(ctx, baseX - 2 + wobble, baseY - 5 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX + wobble, baseY - 6 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 1 + wobble, baseY - 6 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 1 + wobble, baseY - 7 + popOffset - rotation, bodyLight);
      this.drawPixel(ctx, baseX + 4 + wobble, baseY - 9 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 5 + wobble, baseY - 9 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 4 + wobble, baseY - 10 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 5 + wobble, baseY - 10 + popOffset - rotation, bodyDark);
      this.drawPixel(ctx, baseX + 3 + wobble, baseY - 11 + popOffset - rotation, helmetColor);
      this.drawPixel(ctx, baseX + 4 + wobble, baseY - 11 + popOffset - rotation, helmetLight);
      this.drawPixel(ctx, baseX + 5 + wobble, baseY - 11 + popOffset - rotation, helmetColor);
      this.drawPixel(ctx, baseX + 6 + wobble, baseY - 11 + popOffset - rotation, helmetColor);
      this.drawPixel(ctx, baseX + 6 + wobble, baseY - 9 + popOffset - rotation, '#fff');
      const legAnim = Math.floor(Math.sin(ant.idleTime * 12) * 2);
      this.drawPixel(ctx, baseX - 6 + legAnim, baseY - 2 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX - 4 - legAnim, baseY - 2 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX - 2 + legAnim, baseY - 3 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX + 2 - legAnim, baseY - 5 + popOffset, bodyDark);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect((baseX - 3) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 7 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);

      this.drawPixel(ctx, baseX - 3, baseY, bodyColor);
      this.drawPixel(ctx, baseX - 2, baseY, bodyColor);
      this.drawPixel(ctx, baseX - 1, baseY, bodyDark);
      this.drawPixel(ctx, baseX, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 1, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 2, baseY, bodyDark);
      this.drawPixel(ctx, baseX + 3, baseY, helmetColor);
      this.drawPixel(ctx, baseX + 3, baseY - 1, helmetLight);
      this.drawPixel(ctx, baseX - 2, baseY + 1, bodyDark);
      this.drawPixel(ctx, baseX + 1, baseY + 1, bodyDark);

      const smokeOffset = Math.floor(Math.sin(ant.idleTime * 2) * 1);
      ctx.fillStyle = 'rgba(80, 80, 80, 0.2)';
      ctx.fillRect((baseX) * ANT_PIXEL_SCALE, (baseY - 2 + smokeOffset) * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
    }
  }
}
