// Ant pixel scale - smaller than terrain for more detail
export const ANT_PIXEL_SCALE = 2;

// Death animation types
export type DeathType = 'explode' | 'ghost' | 'splatter' | 'disintegrate' | 'vaporize' | 'drown';

export interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export interface MuzzleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export interface SmokeRing {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  angle: number;
}

export interface DestructionDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  life: number;
  color: string;
}

export interface ChargeParticle {
  x: number;
  y: number;
  angle: number;
  distance: number;
  speed: number;
  size: number;
  life: number;
}

export interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// Ghost particle for ghost death effect
export interface GhostParticle {
  x: number;
  y: number;
  vy: number;
  alpha: number;
  scale: number;
  wobble: number;
}

// Goo particle for splatter death effect
export interface GooParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
  stuck: boolean;
  stuckX: number;
  stuckY: number;
}

// Dust particle for disintegrate death effect
export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

// Shockwave ring for vaporize death effect
export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

// Flying body part for explode death
export interface BodyPart {
  type: 'head' | 'thorax' | 'abdomen' | 'leg' | 'helmet' | 'antenna';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  life: number;
  color: string;
}

// Ethereal wisp for ghost death
export interface EtherealWisp {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
  size: number;
  speed: number;
  angle: number;
}

// Splat mark for splatter death (stays on ground)
export interface SplatMark {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: string;
}

// Ember particle for disintegrate death
export interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  brightness: number;
}

// Lightning arc for vaporize death
export interface LightningArc {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  segments: { x: number; y: number }[];
  alpha: number;
  life: number;
  color: string;
  thickness: number;
}

// Dissolve particle for vaporize death
export interface DissolveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

// Floating damage number
export interface DamageNumber {
  x: number;
  y: number;
  vy: number;
  value: number;
  life: number;
  maxLife: number;
  scale: number;
  isCritical: boolean;
}

// Ant particle state - contains all particle arrays
export interface AntParticleState {
  smokeParticles: SmokeParticle[];
  muzzleParticles: MuzzleParticle[];
  sparkParticles: SparkParticle[];
  smokeRings: SmokeRing[];
  destructionDebris: DestructionDebris[];
  chargeParticles: ChargeParticle[];
  fireParticles: FireParticle[];
  ghostParticle: GhostParticle | null;
  gooParticles: GooParticle[];
  dustParticles: DustParticle[];
  shockwaveRings: ShockwaveRing[];
  bodyParts: BodyPart[];
  etherealWisps: EtherealWisp[];
  splatMarks: SplatMark[];
  emberParticles: EmberParticle[];
  lightningArcs: LightningArc[];
  dissolveParticles: DissolveParticle[];
  damageNumbers: DamageNumber[];
}

// Death animation state
export interface DeathAnimationState {
  deathAnimationStage: number;
  deathAnimationTimer: number;
  deathDelayTimer: number;
  deathPopY: number;
  deathPopVy: number;
  deathType: DeathType;
  disintegrateProgress: number;
  dissolveProgress: number;
  destructionFlash: number;
}
