// Weapon types and configurations

export type WeaponType = 'standard';

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
};

// Get all weapon types in order
export const WEAPON_ORDER: WeaponType[] = ['standard'];

// Default ammo for each weapon type when game starts
export function getDefaultAmmo(): Map<WeaponType, number> {
  const ammo = new Map<WeaponType, number>();
  for (const type of WEAPON_ORDER) {
    ammo.set(type, WEAPON_CONFIGS[type].ammo);
  }
  return ammo;
}
