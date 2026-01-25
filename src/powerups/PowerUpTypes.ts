// Power-up types and configurations

export type PowerUpType = 'health';

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  description: string;
  duration: number | null; // null = instant
  value: number; // Amount restored
  color: string;
}

export const POWERUP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  health: {
    type: 'health',
    name: 'Health Pack',
    description: 'Restore 50 HP',
    duration: null, // Instant
    value: 50,
    color: '#4ECB71',
  },
};

// Active buff on a tank
export interface ActiveBuff {
  type: PowerUpType;
  remainingValue: number;
  duration: number | null;
}

// All power-up types in order for spawning
export const POWERUP_ORDER: PowerUpType[] = ['health'];
