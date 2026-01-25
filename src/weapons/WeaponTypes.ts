// Weapon types and configurations

export type WeaponType = 'standard' | 'bazooka' | 'shotgun' | 'sniper' | 'napalm' | 'grenade';

export interface WeaponConfig {
  type: WeaponType;
  name: string;
  damage: number;
  explosionRadius: number;
  projectileSpeed: number; // Multiplier (1.0 = normal)
  projectileSize: number; // Multiplier (1.0 = normal)
  ammo: number; // -1 = unlimited
  maxBounces: number; // For bouncer
  clusterCount: number; // For cluster bomb
  clusterDamage: number; // Damage per cluster bomblet
  craterDepthMultiplier: number; // For digger
  burnDuration: number; // For napalm (seconds)
  burnDamagePerSecond: number; // For napalm
  trailColor: { r: number; g: number; b: number };
  description: string;
  keyBinding: string; // 1-6
  pelletCount: number; // Number of pellets (1 for normal, 8 for shotgun)
  spreadAngle: number; // Spread angle in degrees (for shotgun)
  gravityMultiplier: number; // 0 = straight line, 1 = normal arc
  requiresCharging: boolean; // false for shotgun (instant fire)
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  standard: {
    type: 'standard',
    name: 'Standard Shell',
    damage: 50,
    explosionRadius: 35,
    projectileSpeed: 1.0,
    projectileSize: 1.0,
    ammo: -1, // Unlimited
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 1.0,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 255, g: 150, b: 50 },
    description: 'Reliable all-purpose shell',
    keyBinding: '1',
    pelletCount: 1,
    spreadAngle: 0,
    gravityMultiplier: 1.0,
    requiresCharging: true,
  },
  bazooka: {
    type: 'bazooka',
    name: 'Heavy Bazooka',
    damage: 80,
    explosionRadius: 50,
    projectileSpeed: 0.6,
    projectileSize: 1.5,
    ammo: 3,
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 1.3,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 100, g: 100, b: 100 }, // Grey trail
    description: 'Slow but devastating',
    keyBinding: '2',
    pelletCount: 1,
    spreadAngle: 0,
    gravityMultiplier: 1.2, // Heavier, more arc
    requiresCharging: true,
  },
  shotgun: {
    type: 'shotgun',
    name: 'Cluster Bomb',
    damage: 15, // Per pellet
    explosionRadius: 12,
    projectileSpeed: 1.0,
    projectileSize: 0.6,
    ammo: 2,
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 0.5,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 255, g: 220, b: 100 }, // Yellow trail
    description: '8 pellets with spread',
    keyBinding: '3',
    pelletCount: 8,
    spreadAngle: 15, // Degrees of spread
    gravityMultiplier: 1.0, // Normal gravity like standard shell
    requiresCharging: true, // Requires power charging like standard
  },
  sniper: {
    type: 'sniper',
    name: 'Sniper',
    damage: 70,
    explosionRadius: 15,
    projectileSpeed: 2.5, // Very fast
    projectileSize: 0.4, // Small bullet
    ammo: 2,
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 0.3,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 200, g: 50, b: 50 }, // Red trail
    description: 'Precise straight shot',
    keyBinding: '4',
    pelletCount: 1,
    spreadAngle: 0,
    gravityMultiplier: 0.05, // Nearly straight line
    requiresCharging: false, // Instant fire
  },
  napalm: {
    type: 'napalm',
    name: 'Fire Bomb',
    damage: 25,
    explosionRadius: 45,
    projectileSpeed: 0.85,
    projectileSize: 1.2,
    ammo: 3,
    maxBounces: 2, // Bounces twice before exploding
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 0.8,
    burnDuration: 6.0, // 6 seconds of fire
    burnDamagePerSecond: 8, // 8 damage per second
    trailColor: { r: 255, g: 100, b: 0 }, // Orange trail
    description: 'Bounces and creates fire',
    keyBinding: '5',
    pelletCount: 1,
    spreadAngle: 0,
    gravityMultiplier: 1.1, // Slightly heavier
    requiresCharging: true,
  },
  grenade: {
    type: 'grenade',
    name: 'Bouncing Grenade',
    damage: 40,
    explosionRadius: 40,
    projectileSpeed: 0.9,
    projectileSize: 1.0,
    ammo: 3,
    maxBounces: 4, // Bounces multiple times
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 1.0,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 100, g: 180, b: 100 }, // Green trail
    description: 'Bounces off terrain and walls',
    keyBinding: '6',
    pelletCount: 1,
    spreadAngle: 0,
    gravityMultiplier: 1.3, // Heavy, bounces low
    requiresCharging: true,
  },
};

// Get all weapon types in order
export const WEAPON_ORDER: WeaponType[] = ['standard', 'bazooka', 'shotgun', 'sniper', 'napalm', 'grenade'];

// Default ammo for each weapon type when game starts
export function getDefaultAmmo(): Map<WeaponType, number> {
  const ammo = new Map<WeaponType, number>();
  for (const type of WEAPON_ORDER) {
    ammo.set(type, WEAPON_CONFIGS[type].ammo);
  }
  return ammo;
}
