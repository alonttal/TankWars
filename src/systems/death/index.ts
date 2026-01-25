// Death effect system infrastructure
// The strategy pattern is set up here - individual effects can be extracted
// from AntDeathSystem.ts into separate files as needed

export * from './DeathRenderingUtils.ts';
export type { DeathEffect, DeathEffectContext, DeathParticles } from './DeathEffectBase.ts';
