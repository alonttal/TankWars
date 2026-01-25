// Power-up types and configurations

export type PowerUpType = 'health' | 'damage_boost' | 'shield' | 'double_shot';

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  description: string;
  duration: number | null; // null = instant, or number of shots for buffs
  value: number; // Amount restored/shots/HP absorbed
  color: string;
  icon: 'cross' | 'sword' | 'shield' | 'double_arrow';
  spawnWeight: number; // Relative spawn probability
}

export const POWERUP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  health: {
    type: 'health',
    name: 'Health Pack',
    description: 'Restore 50 HP',
    duration: null, // Instant
    value: 50,
    color: '#4ECB71',
    icon: 'cross',
    spawnWeight: 40, // Most common
  },
  damage_boost: {
    type: 'damage_boost',
    name: 'Damage Boost',
    description: '1.5x damage for 2 shots',
    duration: 2, // Number of shots
    value: 2, // 2 shots
    color: '#FF4444',
    icon: 'sword',
    spawnWeight: 25,
  },
  shield: {
    type: 'shield',
    name: 'Shield',
    description: 'Absorbs 30 damage',
    duration: null, // Lasts until depleted
    value: 30, // HP absorbed
    color: '#4488FF',
    icon: 'shield',
    spawnWeight: 20,
  },
  double_shot: {
    type: 'double_shot',
    name: 'Double Shot',
    description: 'Fire 2 projectiles for 2 shots',
    duration: 2, // Number of shots
    value: 2, // 2 shots
    color: '#FFD700',
    icon: 'double_arrow',
    spawnWeight: 15, // Rarest
  },
};

// Active buff on a tank
export interface ActiveBuff {
  type: PowerUpType;
  remainingValue: number; // Remaining shots or HP to absorb
  duration: number | null;
}

// All power-up types in order for spawning
export const POWERUP_ORDER: PowerUpType[] = ['health', 'damage_boost', 'shield', 'double_shot'];

// Calculate total spawn weight for probability calculation
export function getTotalSpawnWeight(): number {
  return POWERUP_ORDER.reduce((sum, type) => sum + POWERUP_CONFIGS[type].spawnWeight, 0);
}
