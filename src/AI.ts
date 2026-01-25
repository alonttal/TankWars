import { Ant } from './Ant.ts';
import { Terrain } from './Terrain.ts';
import {
  GRAVITY,
  MAX_POWER,
  MAP_HEIGHT,
  MOVEMENT_SPEED,
  MAX_SLOPE_ANGLE,
  MOVEMENT_ENERGY_COST,
  JUMP_ENERGY_COST
} from './constants.ts';
import { WeaponType, WEAPON_CONFIGS, WEAPON_ORDER } from './weapons/WeaponTypes.ts';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

// AI Movement constants
const AI_MIN_ENEMY_DISTANCE = 150; // Don't get closer than this (preparation for close-range weapons)
const AI_MOVE_CHANCE_EASY = 0.3; // 30% chance to consider moving
const AI_MOVE_CHANCE_MEDIUM = 0.6; // 60% chance
const AI_MOVE_CHANCE_HARD = 0.8; // 80% chance
const AI_POSITION_SAMPLE_DISTANCE = 80; // Sample positions every N pixels
const AI_MAX_CANDIDATE_POSITIONS = 5;
const AI_JUMP_DISTANCE = 50; // Max horizontal distance a jump can cover
const AI_MIN_SCORE_IMPROVEMENT = 0.08; // Only move if position is 8% better

// Movement plan for AI
export interface AIMovementPlan {
  targetX: number;
  requiresJump: boolean;
  jumpAtX: number | null; // X position where AI should jump
  energyCost: number;
  score: number;
}

// Position candidate for evaluation
interface PositionCandidate {
  x: number;
  y: number;
  score: number;
  reachable: boolean;
  requiresJump: boolean;
  jumpAtX: number | null;
  energyCost: number;
}

export class AntAI {
  private difficulty: AIDifficulty;
  private inaccuracy: number;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
    // Inaccuracy affects how much random error is added
    switch (difficulty) {
      case 'easy':
        this.inaccuracy = 0.25; // 25% error range
        break;
      case 'medium':
        this.inaccuracy = 0.12; // 12% error range
        break;
      case 'hard':
        this.inaccuracy = 0.05; // 5% error range
        break;
    }
  }

  // Select weapon based on situation
  selectWeapon(shooter: Ant, target: Ant, terrain: Terrain): void {
    // Get available weapons (have ammo)
    const availableWeapons = WEAPON_ORDER.filter(w => shooter.hasAmmo(w));

    if (availableWeapons.length === 1) {
      shooter.selectWeapon(availableWeapons[0]);
      return;
    }

    // Calculate situation metrics
    const distance = Math.abs(target.x - shooter.x);
    const heightDiff = shooter.y - target.y; // positive = shooter is lower
    const targetHealth = target.health;

    // Check line of sight for sniper (straight shot weapons)
    const hasLineOfSight = this.checkLineOfSight(shooter, target, terrain);

    // Quick check if sniper shot is actually viable (simulate it)
    const sniperViable = hasLineOfSight ? this.checkSniperViability(shooter, target, terrain) : false;

    // Score each weapon for this situation
    const weaponScores: { weapon: WeaponType; score: number }[] = [];

    for (const weapon of availableWeapons) {
      const config = WEAPON_CONFIGS[weapon];
      let score = 0;

      // Base score from potential damage
      const potentialDamage = config.pelletCount > 1
        ? config.damage * config.pelletCount * 0.4 // Assume ~40% pellets hit
        : config.damage;
      score += potentialDamage;

      // Distance-based scoring
      if (weapon === 'sniper') {
        // Sniper REQUIRES clear line of sight AND viable shot
        if (!sniperViable) {
          score -= 200; // Heavy penalty - sniper can't hit target
        } else {
          // Sniper excels at long range with clear line of sight
          if (distance > 400) score += 40;
          else if (distance > 250) score += 20;
          else if (distance < 150) score -= 30; // Too close, overkill

          // Sniper works best when target is at same height or below
          // (can't arc up well due to low gravity)
          if (heightDiff > 100) {
            // Target is much higher - sniper can't reach (would need high arc)
            score -= 100;
          } else if (heightDiff > 50) {
            // Target is somewhat higher - difficult shot
            score -= 30;
          } else if (heightDiff < -50) {
            // Target is below - good for sniper (aim down)
            score += 20;
          } else {
            // Similar height - ideal for sniper
            score += 15;
          }
        }
      } else if (weapon === 'shotgun') {
        // Cluster bomb is best at medium range where spread covers target
        if (distance >= 150 && distance <= 350) score += 35;
        else if (distance < 150) score += 15; // Still ok close
        else score -= 15; // Spread too wide at long range
      } else if (weapon === 'bazooka') {
        // Heavy bazooka is slow, works best at medium range
        if (distance >= 200 && distance <= 400) score += 25;
        else if (distance > 400) score -= 20; // Hard to aim slow projectile far
      } else if (weapon === 'napalm') {
        // Fire bomb bounces and creates fire - good for area denial
        if (distance >= 150 && distance <= 350) score += 20;
        // Bonus if target has high health (burn adds up)
        if (targetHealth > 60) score += 15;
        // Bouncing helps reach targets behind cover
        if (!hasLineOfSight) score += 25; // Good alternative when no LOS
      } else if (weapon === 'grenade') {
        // Bouncing grenade - great for tricky shots and targets behind cover
        if (distance >= 100 && distance <= 400) score += 25;
        else if (distance < 100) score += 10; // Risky at close range (might bounce back)
        // Excellent when direct shot is blocked - can bounce around obstacles
        if (!hasLineOfSight) score += 40; // Best option when no direct LOS
        // Height advantage helps with bouncing trajectory
        if (heightDiff < -30) score += 15; // Target below - good for bouncing down
      }
      // Standard is neutral on distance

      // Health-based decisions
      if (targetHealth <= 30) {
        // Low health - use standard or sniper to finish off, save heavy weapons
        if (weapon === 'standard') score += 25;
        else if (weapon === 'sniper') score += 20;
        else if (weapon === 'bazooka' || weapon === 'napalm') score -= 30; // Don't waste
      } else if (targetHealth >= 80) {
        // High health - heavy weapons are worth using
        if (weapon === 'bazooka') score += 20;
        if (weapon === 'napalm') score += 15; // Burn will tick
      }

      // Ammo conservation - slight preference to save limited ammo
      if (config.ammo !== -1) {
        const ammoLeft = shooter.getAmmo(weapon);
        if (ammoLeft === 1) score -= 10; // Last shot, be more conservative
      }

      weaponScores.push({ weapon, score });
    }

    // Sort by score
    weaponScores.sort((a, b) => b.score - a.score);

    // Difficulty affects selection
    let selectedWeapon: WeaponType;
    switch (this.difficulty) {
      case 'easy':
        // Easy: 40% best, 35% second best, 25% random
        const easyRoll = Math.random();
        if (easyRoll < 0.4 && weaponScores.length > 0) {
          selectedWeapon = weaponScores[0].weapon;
        } else if (easyRoll < 0.75 && weaponScores.length > 1) {
          selectedWeapon = weaponScores[1].weapon;
        } else {
          selectedWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        }
        break;
      case 'medium':
        // Medium: 65% best, 25% second best, 10% random
        const medRoll = Math.random();
        if (medRoll < 0.65) {
          selectedWeapon = weaponScores[0].weapon;
        } else if (medRoll < 0.9 && weaponScores.length > 1) {
          selectedWeapon = weaponScores[1].weapon;
        } else {
          selectedWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        }
        break;
      case 'hard':
        // Hard: 90% best, 10% second best
        if (Math.random() < 0.9 || weaponScores.length === 1) {
          selectedWeapon = weaponScores[0].weapon;
        } else {
          selectedWeapon = weaponScores[1].weapon;
        }
        break;
    }

    shooter.selectWeapon(selectedWeapon);
  }

  // Select which enemy ant to target
  selectTarget(shooter: Ant, enemies: Ant[]): Ant | null {
    if (enemies.length === 0) return null;
    if (enemies.length === 1) return enemies[0];

    // Based on difficulty, select target
    switch (this.difficulty) {
      case 'easy':
        // Easy: pick random target
        return enemies[Math.floor(Math.random() * enemies.length)];

      case 'medium':
        // Medium: 50% chance to pick closest, 50% random
        if (Math.random() < 0.5) {
          return this.getClosestEnemy(shooter, enemies);
        }
        return enemies[Math.floor(Math.random() * enemies.length)];

      case 'hard':
        // Hard: Pick the lowest health enemy, or closest if tied
        const lowestHealth = Math.min(...enemies.map(e => e.health));
        const lowHealthEnemies = enemies.filter(e => e.health === lowestHealth);
        if (lowHealthEnemies.length === 1) {
          return lowHealthEnemies[0];
        }
        // If multiple with same low health, pick closest
        return this.getClosestEnemy(shooter, lowHealthEnemies);
    }
  }

  // Get the closest enemy to the shooter
  private getClosestEnemy(shooter: Ant, enemies: Ant[]): Ant {
    let closest = enemies[0];
    let closestDist = Math.abs(enemies[0].x - shooter.x);

    for (const enemy of enemies) {
      const dist = Math.abs(enemy.x - shooter.x);
      if (dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    return closest;
  }

  // Check if there's a clear line of sight from shooter to target (for sniper)
  private checkLineOfSight(shooter: Ant, target: Ant, terrain: Terrain): boolean {
    const barrelEnd = shooter.getBarrelEnd();
    const startX = barrelEnd.x;
    const startY = barrelEnd.y;
    const targetX = target.x;
    const targetY = target.y - 10; // Target center

    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / 10); // Check every 10 pixels

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = startX + dx * t;
      const checkY = startY + dy * t;

      // Get terrain height at this x position
      const terrainHeight = terrain.getHeightAt(checkX);
      const terrainY = MAP_HEIGHT - terrainHeight;

      // If the line goes below terrain, no line of sight
      if (checkY > terrainY) {
        return false;
      }
    }

    return true;
  }

  // Check if a sniper shot can actually reach the target
  private checkSniperViability(shooter: Ant, target: Ant, terrain: Terrain): boolean {
    const barrelEnd = shooter.getBarrelEnd();
    const startX = barrelEnd.x;
    const startY = barrelEnd.y;
    const targetX = target.x;
    const targetY = target.y - 10;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const shootingRight = dx > 0;

    // Calculate direct angle to target
    const directAngle = Math.atan2(-dy, Math.abs(dx)) * (180 / Math.PI);

    // Sniper config
    const sniperConfig = WEAPON_CONFIGS['sniper'];
    const power = MAX_POWER * sniperConfig.projectileSpeed;
    const gravityMult = sniperConfig.gravityMultiplier;
    const explosionRadius = sniperConfig.explosionRadius;

    // Try a few angles around direct angle
    for (let angleOffset = -10; angleOffset <= 10; angleOffset += 2) {
      const testAngle = directAngle + angleOffset;
      if (testAngle < 0 || testAngle > 80) continue;

      const result = this.simulateShot(
        startX, startY, testAngle, power, 0, // Ignore wind for quick check
        targetX, targetY, shootingRight, gravityMult,
        terrain, [], explosionRadius
      );

      // If we can get within explosion radius without hitting terrain, sniper is viable
      if (!result.hitsTerrain && result.distance < explosionRadius * 2) {
        return true;
      }
    }

    return false;
  }

  calculateShot(
    shooter: Ant,
    target: Ant,
    wind: number,
    terrain: Terrain,
    allAnts: Ant[]
  ): { angle: number; power: number } {
    const barrelEnd = shooter.getBarrelEnd();
    const startX = barrelEnd.x;
    const startY = barrelEnd.y;

    // Target position (center of ant)
    const targetX = target.x;
    const targetY = target.y - 10;

    // Calculate horizontal distance
    const dx = targetX - startX;
    const dy = targetY - startY;

    // Get weapon-specific physics
    const weaponConfig = WEAPON_CONFIGS[shooter.selectedWeapon];
    const gravityMult = weaponConfig.gravityMultiplier;
    const speedMult = weaponConfig.projectileSpeed;
    const explosionRadius = weaponConfig.explosionRadius;

    // Get friendly ants (same team, excluding self)
    const friendlyAnts = allAnts.filter(
      a => a.teamIndex === shooter.teamIndex && a !== shooter && a.health > 0
    );

    // Special handling for sniper (instant fire, nearly straight shot)
    if (shooter.selectedWeapon === 'sniper') {
      // Sniper has very low gravity (0.05) and high speed (2.5x), but still needs simulation
      // to account for slight drop and wind over distance

      // Calculate base direct angle as starting point
      const directAngle = Math.atan2(-dy, Math.abs(dx)) * (180 / Math.PI);

      // Simulate sniper shots around the direct angle to find best
      let bestSniperAngle = directAngle;
      let bestSniperDistance = Infinity;

      // Search in a narrow range around direct angle (sniper is nearly straight)
      const searchMin = Math.max(0, directAngle - 15);
      const searchMax = Math.min(80, directAngle + 15);

      for (let angle = searchMin; angle <= searchMax; angle += 1) {
        const power = MAX_POWER * speedMult; // Sniper always at full power
        const result = this.simulateShot(
          startX, startY, angle, power, wind,
          targetX, targetY, dx > 0, gravityMult,
          terrain, friendlyAnts, explosionRadius
        );

        // Only consider shots that don't hit terrain or friendlies
        if (!result.hitsTerrain && !result.hitsFriendly && result.distance < bestSniperDistance) {
          bestSniperDistance = result.distance;
          bestSniperAngle = angle;
        }
      }

      // Apply small inaccuracy based on difficulty
      const angleError = (Math.random() - 0.5) * 2 * this.inaccuracy * 10;

      // Convert angle based on direction
      const finalAngle = dx > 0
        ? Math.max(5, Math.min(85, bestSniperAngle + angleError))
        : Math.max(95, Math.min(175, 180 - bestSniperAngle + angleError));

      return {
        angle: finalAngle,
        power: 100, // Sniper always fires at full power (instant)
      };
    }

    // Use iterative approach to find good angle/power for other weapons
    let bestAngle = 45;
    let bestPower = 50;
    let bestScore = -Infinity;

    // Adjust search ranges based on weapon characteristics
    const minAngle = 20;
    const maxAngle = 80;

    // Bazooka has lower effective range due to slow speed
    const minPower = speedMult < 0.8 ? 50 : 30;
    const maxPower = 100;

    // Try different combinations
    for (let angle = minAngle; angle <= maxAngle; angle += 2) {
      for (let powerPercent = minPower; powerPercent <= maxPower; powerPercent += 5) {
        const power = (powerPercent / 100) * MAX_POWER * speedMult;
        const result = this.simulateShot(
          startX, startY, angle, power, wind,
          targetX, targetY, dx > 0, gravityMult,
          terrain, friendlyAnts, explosionRadius
        );

        // Score this shot (lower distance is better, but penalize blocked/friendly fire)
        let score = -result.distance;

        if (result.hitsTerrain) {
          score -= 500; // Heavy penalty for hitting terrain before target
        }
        if (result.hitsFriendly) {
          score -= 1000; // Very heavy penalty for friendly fire
        }

        if (score > bestScore) {
          bestScore = score;
          bestAngle = angle;
          bestPower = powerPercent;
        }
      }
    }

    // Apply inaccuracy based on difficulty
    const angleError = (Math.random() - 0.5) * 2 * this.inaccuracy * 30;
    const powerError = (Math.random() - 0.5) * 2 * this.inaccuracy * 20;

    // If shooting left, convert angle
    const finalAngle = dx > 0 ? bestAngle : 180 - bestAngle;

    return {
      angle: Math.max(5, Math.min(175, finalAngle + angleError)),
      power: Math.max(20, Math.min(100, bestPower + powerError)),
    };
  }

  private simulateShot(
    startX: number,
    startY: number,
    angleDeg: number,
    power: number,
    wind: number,
    targetX: number,
    targetY: number,
    shootingRight: boolean,
    gravityMultiplier: number,
    terrain: Terrain,
    friendlyAnts: Ant[],
    explosionRadius: number
  ): { distance: number; hitsTerrain: boolean; hitsFriendly: boolean } {
    // Convert angle based on direction
    const actualAngle = shootingRight ? angleDeg : 180 - angleDeg;
    const angleRad = (actualAngle * Math.PI) / 180;

    let x = startX;
    let y = startY;
    let vx = Math.cos(angleRad) * power + wind * 0.5;
    let vy = -Math.sin(angleRad) * power;

    const dt = 0.016; // 60fps simulation
    const effectiveGravity = GRAVITY * gravityMultiplier;
    let minDistance = Infinity;
    let hitsTerrain = false;
    let hitsFriendly = false;

    // Simulate for up to 10 seconds
    for (let t = 0; t < 10; t += dt) {
      vx += wind * dt * 0.5;
      vy += effectiveGravity * dt;
      x += vx * dt;
      y += vy * dt;

      // Check terrain collision
      const terrainHeight = terrain.getHeightAt(x);
      const terrainY = MAP_HEIGHT - terrainHeight;
      if (y >= terrainY) {
        // Hit terrain - check if we're close enough to target
        const distToTarget = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);
        if (distToTarget > explosionRadius * 1.5) {
          hitsTerrain = true; // Hit terrain too far from target
        }
        minDistance = Math.min(minDistance, distToTarget);
        break;
      }

      // Check friendly fire (would explosion hit a friendly?)
      for (const friendly of friendlyAnts) {
        const distToFriendly = Math.sqrt((x - friendly.x) ** 2 + (y - friendly.y) ** 2);
        if (distToFriendly < explosionRadius + 15) {
          hitsFriendly = true;
        }
      }

      // Check distance to target
      const dist = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
      }

      // Stop if too far out of bounds
      if (y > MAP_HEIGHT + 100 || Math.abs(x - startX) > 5000) {
        break;
      }
    }

    return { distance: minDistance, hitsTerrain, hitsFriendly };
  }

  // Add some "thinking" delay based on difficulty
  getThinkingTime(): number {
    switch (this.difficulty) {
      case 'easy':
        return 500 + Math.random() * 500;
      case 'medium':
        return 800 + Math.random() * 700;
      case 'hard':
        return 1000 + Math.random() * 1000;
    }
  }

  // ==================== MOVEMENT AI ====================

  // Decide if AI should consider moving this turn
  shouldConsiderMoving(): boolean {
    let moveChance: number;
    switch (this.difficulty) {
      case 'easy':
        moveChance = AI_MOVE_CHANCE_EASY;
        break;
      case 'medium':
        moveChance = AI_MOVE_CHANCE_MEDIUM;
        break;
      case 'hard':
        moveChance = AI_MOVE_CHANCE_HARD;
        break;
    }
    return Math.random() < moveChance;
  }

  // Plan movement to a better position (returns null if should stay)
  planMovement(
    shooter: Ant,
    target: Ant,
    terrain: Terrain,
    wind: number
  ): AIMovementPlan | null {
    // Don't move if no energy
    if (shooter.movementEnergy <= 0) {
      return null;
    }

    // Score current position
    const currentScore = this.scorePosition(shooter.x, shooter.y, target, terrain, wind);

    // Find candidate positions (up to 3)
    const candidates = this.findCandidatePositions(shooter, target, terrain, wind);

    // Find best candidate that's significantly better than current
    let bestCandidate: PositionCandidate | null = null;
    for (const candidate of candidates) {
      if (!candidate.reachable) continue;

      // Check minimum enemy distance
      const distToEnemy = Math.abs(candidate.x - target.x);
      if (distToEnemy < AI_MIN_ENEMY_DISTANCE) {
        continue;
      }

      // Check if significantly better (with minimum improvement threshold)
      const improvement = (candidate.score - currentScore) / Math.max(currentScore, 0.1);
      if (improvement > AI_MIN_SCORE_IMPROVEMENT) {
        if (!bestCandidate || candidate.score > bestCandidate.score) {
          bestCandidate = candidate;
        }
      }
    }

    if (!bestCandidate) {
      return null;
    }

    return {
      targetX: bestCandidate.x,
      requiresJump: bestCandidate.requiresJump,
      jumpAtX: bestCandidate.jumpAtX,
      energyCost: bestCandidate.energyCost,
      score: bestCandidate.score,
    };
  }

  // Find up to 3 promising candidate positions
  private findCandidatePositions(
    shooter: Ant,
    target: Ant,
    terrain: Terrain,
    wind: number
  ): PositionCandidate[] {
    const candidates: PositionCandidate[] = [];

    // Calculate max walking distance based on energy
    const maxWalkTime = shooter.movementEnergy / MOVEMENT_ENERGY_COST;
    const maxWalkDistance = maxWalkTime * MOVEMENT_SPEED;

    // Determine promising directions
    // 1. Towards higher ground
    // 2. Towards/away from target (depending on current distance)
    // 3. Towards better shooting angle

    const directionToTarget = target.x > shooter.x ? 1 : -1;
    const distToTarget = Math.abs(target.x - shooter.x);

    // Sample positions in promising directions
    const sampleDistances: number[] = [];

    // Sample towards target at different distances (if not too close)
    if (distToTarget > AI_MIN_ENEMY_DISTANCE + 100) {
      sampleDistances.push(directionToTarget * Math.min(maxWalkDistance * 0.5, distToTarget * 0.3));
      sampleDistances.push(directionToTarget * Math.min(maxWalkDistance * 0.3, distToTarget * 0.15));
    }

    // Sample away from target (retreat) at different distances
    sampleDistances.push(-directionToTarget * maxWalkDistance * 0.5);
    sampleDistances.push(-directionToTarget * maxWalkDistance * 0.25);

    // Sample to higher ground on either side
    const leftHeight = terrain.getHeightAt(shooter.x - AI_POSITION_SAMPLE_DISTANCE);
    const rightHeight = terrain.getHeightAt(shooter.x + AI_POSITION_SAMPLE_DISTANCE);
    const currentHeight = terrain.getHeightAt(shooter.x);

    if (leftHeight > currentHeight + 10) {
      sampleDistances.push(-AI_POSITION_SAMPLE_DISTANCE);
    }
    if (rightHeight > currentHeight + 10) {
      sampleDistances.push(AI_POSITION_SAMPLE_DISTANCE);
    }

    // Also sample at fixed distances in both directions
    sampleDistances.push(maxWalkDistance * 0.6);
    sampleDistances.push(-maxWalkDistance * 0.6);

    // Remove duplicates and limit to most promising
    const uniqueDistances = [...new Set(sampleDistances)]
      .filter(d => Math.abs(d) > 20) // Ignore tiny movements
      .slice(0, AI_MAX_CANDIDATE_POSITIONS);

    // Evaluate each candidate
    for (const dist of uniqueDistances) {
      const candidateX = shooter.x + dist;
      const candidateY = MAP_HEIGHT - terrain.getHeightAt(candidateX);

      // Check reachability
      const reachability = this.checkReachability(
        shooter.x,
        candidateX,
        terrain,
        shooter.movementEnergy
      );

      if (!reachability.reachable) {
        continue;
      }

      // Score this position
      const score = this.scorePosition(candidateX, candidateY, target, terrain, wind);

      candidates.push({
        x: candidateX,
        y: candidateY,
        score,
        reachable: reachability.reachable,
        requiresJump: reachability.requiresJump,
        jumpAtX: reachability.jumpAtX,
        energyCost: reachability.energyCost,
      });
    }

    // Sort by score (best first) and return top 3
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, AI_MAX_CANDIDATE_POSITIONS);
  }

  // Score a position for shooting quality
  private scorePosition(
    x: number,
    y: number,
    target: Ant,
    terrain: Terrain,
    wind: number
  ): number {
    let score = 0;

    // Distance factor (prefer medium range, not too close or far)
    const distToTarget = Math.abs(x - target.x);
    if (distToTarget < AI_MIN_ENEMY_DISTANCE) {
      score -= 100; // Heavy penalty for being too close
    } else if (distToTarget < 300) {
      score += 30; // Good range
    } else if (distToTarget < 500) {
      score += 20; // OK range
    } else {
      score += 10; // Far but acceptable
    }

    // Height advantage (higher is better for shooting)
    const heightDiff = (MAP_HEIGHT - y) - (MAP_HEIGHT - target.y);
    score += heightDiff * 0.1; // Small bonus for height advantage

    // Simulate a shot from this position and see how close it gets
    const simResult = this.simulateBestShot(x, y, target, wind, terrain);

    // Better shot accuracy = higher score
    if (simResult.minDistance < 30 && !simResult.blocked) {
      score += 50; // Excellent shot possible
    } else if (simResult.minDistance < 60 && !simResult.blocked) {
      score += 30; // Good shot possible
    } else if (simResult.minDistance < 100 && !simResult.blocked) {
      score += 15; // Decent shot possible
    } else if (simResult.blocked) {
      score -= 20; // Position has obstructed shots
    }

    return score;
  }

  // Simulate best possible shot from a position (quick version for movement planning)
  private simulateBestShot(
    fromX: number,
    fromY: number,
    target: Ant,
    wind: number,
    terrain: Terrain
  ): { minDistance: number; blocked: boolean } {
    const dx = target.x - fromX;
    const shootingRight = dx > 0;

    let bestDistance = Infinity;
    let allBlocked = true;

    // Quick simulation with fewer iterations for performance
    for (let angle = 25; angle <= 75; angle += 10) {
      for (let powerPercent = 40; powerPercent <= 90; powerPercent += 15) {
        const power = (powerPercent / 100) * MAX_POWER;
        const result = this.simulateShot(
          fromX,
          fromY - 20, // Approximate barrel position
          angle,
          power,
          wind,
          target.x,
          target.y - 10,
          shootingRight,
          1.0, // Standard gravity for quick check
          terrain,
          [], // No friendly fire check for position scoring
          35  // Standard explosion radius
        );

        if (!result.hitsTerrain && result.distance < bestDistance) {
          bestDistance = result.distance;
          allBlocked = false;
        }
      }
    }

    return { minDistance: bestDistance, blocked: allBlocked };
  }

  // Check if AI can reach a position by walking (and jumping if needed)
  private checkReachability(
    fromX: number,
    toX: number,
    terrain: Terrain,
    availableEnergy: number
  ): { reachable: boolean; requiresJump: boolean; jumpAtX: number | null; energyCost: number } {
    const direction = toX > fromX ? 1 : -1;
    const distance = Math.abs(toX - fromX);
    const stepSize = 5; // Check every 5 pixels

    let currentX = fromX;
    let energyUsed = 0;
    let requiresJump = false;
    let jumpAtX: number | null = null;

    while (Math.abs(currentX - fromX) < distance) {
      const nextX = currentX + direction * stepSize;
      const currentHeight = terrain.getHeightAt(currentX);
      const nextHeight = terrain.getHeightAt(nextX);
      const heightDiff = nextHeight - currentHeight;

      // Calculate slope angle
      const slopeAngle = Math.atan2(Math.abs(heightDiff), stepSize) * (180 / Math.PI);

      // Check for gaps (sudden drops)
      if (heightDiff < -30) {
        // There's a gap/cliff - can we jump it?
        const gapEnd = this.findGapEnd(nextX, direction, terrain);
        if (gapEnd && Math.abs(gapEnd - currentX) <= AI_JUMP_DISTANCE) {
          // Can jump this gap
          if (!requiresJump) {
            requiresJump = true;
            jumpAtX = currentX;
          }
          energyUsed += JUMP_ENERGY_COST;
          currentX = gapEnd;
          continue;
        } else {
          // Gap too wide
          return { reachable: false, requiresJump: false, jumpAtX: null, energyCost: 0 };
        }
      }

      // Check if slope is too steep (going uphill)
      if (heightDiff > 0 && slopeAngle > MAX_SLOPE_ANGLE) {
        // Too steep to climb - can we jump?
        if (!requiresJump && availableEnergy - energyUsed >= JUMP_ENERGY_COST) {
          requiresJump = true;
          jumpAtX = currentX;
          energyUsed += JUMP_ENERGY_COST;
          // Jump might help get over small obstacles
          currentX = nextX;
          continue;
        }
        return { reachable: false, requiresJump: false, jumpAtX: null, energyCost: 0 };
      }

      // Calculate energy cost for this step
      const stepTime = stepSize / MOVEMENT_SPEED;
      energyUsed += MOVEMENT_ENERGY_COST * stepTime;

      // Check if we have enough energy
      if (energyUsed > availableEnergy) {
        return { reachable: false, requiresJump: false, jumpAtX: null, energyCost: 0 };
      }

      currentX = nextX;
    }

    return {
      reachable: true,
      requiresJump,
      jumpAtX,
      energyCost: energyUsed,
    };
  }

  // Find where a gap ends (terrain rises back up)
  private findGapEnd(
    startX: number,
    direction: number,
    terrain: Terrain
  ): number | null {
    const startHeight = terrain.getHeightAt(startX - direction * 5);

    for (let dist = 10; dist <= AI_JUMP_DISTANCE; dist += 5) {
      const checkX = startX + direction * dist;
      const checkHeight = terrain.getHeightAt(checkX);

      // Found terrain at similar or higher level
      if (checkHeight >= startHeight - 20) {
        return checkX;
      }
    }

    return null; // Gap doesn't end within jump range
  }
}
