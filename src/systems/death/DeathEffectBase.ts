import { DeathAnimationState } from '../../types/AntParticleTypes.ts';
import { Terrain } from '../../Terrain.ts';
import { AntDeathData } from './DeathRenderingUtils.ts';

// Re-export for convenience
export type { AntDeathData };

// All particle arrays that the death system manages
export interface DeathParticles {
  destructionDebris: any[];
  bodyParts: any[];
  ghostParticle: any | null;
  gooParticles: any[];
  dustParticles: any[];
  shockwaveRings: any[];
  etherealWisps: any[];
  splatMarks: any[];
  emberParticles: any[];
  lightningArcs: any[];
  dissolveParticles: any[];
}

export interface DeathEffectContext {
  terrain: Terrain | null;
  getGroundYAt: (x: number, fallbackY: number) => number;
}

export interface DeathEffect {
  initialize(ant: AntDeathData, particles: DeathParticles, state: DeathAnimationState): void;
  update(deltaTime: number, ant: AntDeathData, particles: DeathParticles, state: DeathAnimationState): void;
  updateParticles(deltaTime: number, ant: AntDeathData, particles: DeathParticles, state: DeathAnimationState): void;
  render(ctx: CanvasRenderingContext2D, ant: AntDeathData, state: DeathAnimationState, particles: DeathParticles): void;
}
