import { MAP_WIDTH } from '../constants.ts';
import { PowerUp } from './PowerUp.ts';
import { PowerUpType, POWERUP_ORDER, POWERUP_CONFIGS } from './PowerUpTypes.ts';
import { Terrain } from '../Terrain.ts';
import { Ant } from '../Ant.ts';

export class PowerUpManager {
  private powerUps: PowerUp[];
  private spawnChance: number; // Chance to spawn power-up each turn
  private maxPowerUps: number;

  constructor() {
    this.powerUps = [];
    this.spawnChance = 0.3; // 30% chance per turn
    this.maxPowerUps = 3; // Max power-ups on field at once
  }

  // Try to spawn a power-up (call between turns)
  trySpawn(terrain: Terrain, ants: Ant[]): void {
    // Don't spawn if at max
    if (this.powerUps.filter(p => p.active).length >= this.maxPowerUps) {
      return;
    }

    // Random chance to spawn
    if (Math.random() > this.spawnChance) {
      return;
    }

    // Find a safe spawn location (not too close to ants)
    const minDistanceFromAnts = 100;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const x = 50 + Math.random() * (MAP_WIDTH - 100);

      // Check distance from all ants
      let tooClose = false;
      for (const ant of ants) {
        if (!ant.isAlive) continue;
        const distance = Math.abs(ant.x - x);
        if (distance < minDistanceFromAnts) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        // Random power-up type
        const type = POWERUP_ORDER[Math.floor(Math.random() * POWERUP_ORDER.length)];
        this.powerUps.push(new PowerUp(x, terrain, type));
        return;
      }

      attempts++;
    }
  }

  // Force spawn a specific power-up (for testing)
  spawnPowerUp(x: number, terrain: Terrain, type: PowerUpType): void {
    this.powerUps.push(new PowerUp(x, terrain, type));
  }

  update(deltaTime: number, ants: Ant[]): { ant: Ant; type: PowerUpType } | null {
    let collectedInfo: { ant: Ant; type: PowerUpType } | null = null;

    for (const powerUp of this.powerUps) {
      const collectedBy = powerUp.update(deltaTime, ants);

      if (collectedBy) {
        // Apply the power-up effect
        this.applyPowerUp(collectedBy, powerUp.type);
        collectedInfo = { ant: collectedBy, type: powerUp.type };
      }
    }

    // Remove completed power-ups
    this.powerUps = this.powerUps.filter(p => !p.isComplete());

    return collectedInfo;
  }

  private applyPowerUp(ant: Ant, type: PowerUpType): void {
    const config = POWERUP_CONFIGS[type];

    switch (type) {
      case 'health':
        // Instant heal
        ant.heal(config.value);
        break;

      case 'damage_boost':
        // Add damage boost buff
        ant.addBuff({
          type: 'damage_boost',
          remainingValue: config.value, // 1.5x multiplier
          duration: config.duration, // 1 shot
        });
        break;

      case 'shield':
        // Add shield buff
        ant.addBuff({
          type: 'shield',
          remainingValue: config.value, // 30 HP shield
          duration: config.duration, // Until depleted
        });
        break;

      case 'double_shot':
        // Add double shot buff
        ant.addBuff({
          type: 'double_shot',
          remainingValue: config.value, // 2 shots
          duration: config.duration, // 1 turn
        });
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const powerUp of this.powerUps) {
      powerUp.render(ctx);
    }
  }

  // Clear all power-ups (for game restart)
  clear(): void {
    this.powerUps = [];
  }

  // Get count of active power-ups
  getActivePowerUpCount(): number {
    return this.powerUps.filter(p => p.active).length;
  }
}
