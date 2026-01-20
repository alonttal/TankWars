// Weapon types and configurations

export type WeaponType = 'standard' | 'heavy' | 'bouncer' | 'cluster' | 'digger' | 'napalm';

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
  },
  heavy: {
    type: 'heavy',
    name: 'Heavy Cannon',
    damage: 75,
    explosionRadius: 50,
    projectileSpeed: 0.7, // Slower
    projectileSize: 1.5, // Larger
    ammo: 3,
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 1.5,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 200, g: 100, b: 50 },
    description: 'Massive damage, slower projectile',
    keyBinding: '2',
  },
  bouncer: {
    type: 'bouncer',
    name: 'Bouncer',
    damage: 40,
    explosionRadius: 30,
    projectileSpeed: 1.0,
    projectileSize: 0.8,
    ammo: 3,
    maxBounces: 3,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 0.5,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 100, g: 255, b: 100 },
    description: 'Bounces off terrain 3 times',
    keyBinding: '3',
  },
  cluster: {
    type: 'cluster',
    name: 'Cluster Bomb',
    damage: 25, // Initial impact
    explosionRadius: 20,
    projectileSpeed: 0.9,
    projectileSize: 1.3,
    ammo: 2,
    maxBounces: 0,
    clusterCount: 6,
    clusterDamage: 25,
    craterDepthMultiplier: 0.6,
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 255, g: 200, b: 100 },
    description: 'Splits into 6 bomblets at apex',
    keyBinding: '4',
  },
  digger: {
    type: 'digger',
    name: 'Digger',
    damage: 15,
    explosionRadius: 15,
    projectileSpeed: 1.2,
    projectileSize: 0.7,
    ammo: 3,
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 4.0, // Creates deep tunnels
    burnDuration: 0,
    burnDamagePerSecond: 0,
    trailColor: { r: 139, g: 90, b: 43 },
    description: 'Creates deep tunnels in terrain',
    keyBinding: '5',
  },
  napalm: {
    type: 'napalm',
    name: 'Napalm',
    damage: 30, // Initial impact
    explosionRadius: 40,
    projectileSpeed: 0.85,
    projectileSize: 1.2,
    ammo: 2,
    maxBounces: 0,
    clusterCount: 0,
    clusterDamage: 0,
    craterDepthMultiplier: 0.3,
    burnDuration: 4, // 4 seconds
    burnDamagePerSecond: 8, // 8 damage per second
    trailColor: { r: 255, g: 100, b: 0 },
    description: 'Burns area for 4 seconds',
    keyBinding: '6',
  },
};

// Get all weapon types in order
export const WEAPON_ORDER: WeaponType[] = ['standard', 'heavy', 'bouncer', 'cluster', 'digger', 'napalm'];

// Default ammo for each weapon type when game starts
export function getDefaultAmmo(): Map<WeaponType, number> {
  const ammo = new Map<WeaponType, number>();
  for (const type of WEAPON_ORDER) {
    ammo.set(type, WEAPON_CONFIGS[type].ammo);
  }
  return ammo;
}
