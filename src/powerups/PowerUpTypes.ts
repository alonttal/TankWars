// Power-up types and configurations

export type PowerUpType = 'health' | 'damage_boost' | 'shield' | 'double_shot';

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  description: string;
  duration: number | null; // null = instant, number = turns or until depleted
  value: number; // Amount restored, damage multiplier, shield amount, or shot count
  color: string;
  icon: string; // Emoji or symbol
}

export const POWERUP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  health: {
    type: 'health',
    name: 'Health Pack',
    description: 'Restore 25 HP',
    duration: null, // Instant
    value: 25,
    color: '#4ECB71',
    icon: '+',
  },
  damage_boost: {
    type: 'damage_boost',
    name: 'Damage Boost',
    description: '1.5x damage for 1 shot',
    duration: 1, // 1 shot
    value: 1.5,
    color: '#FF6B6B',
    icon: '!',
  },
  shield: {
    type: 'shield',
    name: 'Shield',
    description: 'Absorb 30 damage',
    duration: -1, // Until depleted
    value: 30,
    color: '#4D96FF',
    icon: 'O',
  },
  double_shot: {
    type: 'double_shot',
    name: 'Double Shot',
    description: 'Fire 2 projectiles for 1 turn',
    duration: 1, // 1 turn
    value: 2,
    color: '#FFD93D',
    icon: '2',
  },
};

// Active buff on a tank
export interface ActiveBuff {
  type: PowerUpType;
  remainingValue: number; // Shots remaining, shield HP, etc.
  duration: number | null; // Turns remaining or null for instant/until depleted
}

// All power-up types in order for spawning
export const POWERUP_ORDER: PowerUpType[] = ['health', 'damage_boost', 'shield', 'double_shot'];
