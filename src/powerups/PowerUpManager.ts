import { MAP_WIDTH } from '../constants.ts';
import { PowerUp } from './PowerUp.ts';
import { PowerUpType, POWERUP_CONFIGS } from './PowerUpTypes.ts';
import { Terrain } from '../Terrain.ts';
import { Ant } from '../Ant.ts';

export class PowerUpManager {
  private powerUps: PowerUp[];
  private maxPowerUps: number;
  private fallingPowerUp: PowerUp | null;
  private turnCount: number;

  // Spawn chance progression
  private baseSpawnChance: number;
  private spawnChanceIncrement: number;
  private maxSpawnChance: number;

  constructor() {
    this.powerUps = [];
    this.maxPowerUps = 3; // Max power-ups on field at once
    this.fallingPowerUp = null;
    this.turnCount = 0;

    // Spawn chance starts at 5% and increases by 1% each turn, capped at 20%
    this.baseSpawnChance = 0.05;
    this.spawnChanceIncrement = 0.01;
    this.maxSpawnChance = 0.20;
  }

  private getSpawnChance(): number {
    const chance = this.baseSpawnChance + (this.turnCount * this.spawnChanceIncrement);
    return Math.min(chance, this.maxSpawnChance);
  }

  // Try to spawn a power-up (call between turns)
  // Returns the spawned PowerUp if successful, null otherwise
  trySpawn(terrain: Terrain, ants: Ant[]): PowerUp | null {
    // Increment turn counter for spawn chance progression
    this.turnCount++;

    // Don't spawn if at max
    if (this.powerUps.filter(p => p.active).length >= this.maxPowerUps) {
      return null;
    }

    // Random chance to spawn (increases over time, capped at 20%)
    const spawnChance = this.getSpawnChance();
    if (Math.random() > spawnChance) {
      return null;
    }

    // Find a safe spawn location (not too close to ants, with valid ground)
    const minDistanceFromAnts = 100;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const x = 50 + Math.random() * (MAP_WIDTH - 100);

      // Check if there's valid terrain at this position
      if (!PowerUp.isValidSpawnPosition(x, terrain)) {
        attempts++;
        continue;
      }

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
        // Always spawn health (only type available)
        const powerUp = new PowerUp(x, terrain, 'health');
        this.powerUps.push(powerUp);
        this.fallingPowerUp = powerUp;
        return powerUp;
      }

      attempts++;
    }

    return null;
  }

  // Update the falling power-up - returns true when it lands
  updateFalling(deltaTime: number): boolean {
    if (!this.fallingPowerUp) return false;

    const landed = this.fallingPowerUp.updateFalling(deltaTime);
    if (landed) {
      this.fallingPowerUp = null;
      return true;
    }

    return false;
  }

  // Get the currently falling power-up for camera tracking
  getFallingPowerUp(): PowerUp | null {
    return this.fallingPowerUp;
  }

  // Check if a power-up is currently falling
  isPowerUpFalling(): boolean {
    return this.fallingPowerUp !== null && this.fallingPowerUp.isFalling;
  }

  // Force spawn a specific power-up (for testing)
  spawnPowerUp(x: number, terrain: Terrain, type: PowerUpType): void {
    const powerUp = new PowerUp(x, terrain, type);
    this.powerUps.push(powerUp);
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

    // Only health type is available
    if (type === 'health') {
      ant.heal(config.value);
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
    this.fallingPowerUp = null;
    this.turnCount = 0;
  }

  // Get count of active power-ups
  getActivePowerUpCount(): number {
    return this.powerUps.filter(p => p.active).length;
  }
}
