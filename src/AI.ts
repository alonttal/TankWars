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
  selectWeapon(shooter: Ant, _target: Ant): void {
    // Currently only standard weapon available
    shooter.selectWeapon('standard');
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

  calculateShot(
    shooter: Ant,
    target: Ant,
    wind: number
  ): { angle: number; power: number } {
    const barrelEnd = shooter.getBarrelEnd();
    const startX = barrelEnd.x;
    const startY = barrelEnd.y;

    // Target position (center of ant)
    const targetX = target.x;
    const targetY = target.y - 10;

    // Calculate horizontal distance
    const dx = targetX - startX;

    // Use iterative approach to find good angle/power
    let bestAngle = 45;
    let bestPower = 50;
    let bestDistance = Infinity;

    // Try different combinations
    for (let angle = 20; angle <= 80; angle += 2) {
      for (let powerPercent = 30; powerPercent <= 100; powerPercent += 5) {
        const power = (powerPercent / 100) * MAX_POWER;
        const result = this.simulateShot(startX, startY, angle, power, wind, targetX, targetY, dx > 0);

        if (result.distance < bestDistance) {
          bestDistance = result.distance;
          bestAngle = angle;
          bestPower = powerPercent;
        }
      }
    }

    // Apply inaccuracy based on difficulty
    const angleError = (Math.random() - 0.5) * 2 * this.inaccuracy * 30; // Up to ±inaccuracy*30 degrees
    const powerError = (Math.random() - 0.5) * 2 * this.inaccuracy * 20; // Up to ±inaccuracy*20%

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
    shootingRight: boolean
  ): { distance: number } {
    // Convert angle based on direction
    const actualAngle = shootingRight ? angleDeg : 180 - angleDeg;
    const angleRad = (actualAngle * Math.PI) / 180;

    let x = startX;
    let y = startY;
    let vx = Math.cos(angleRad) * power + wind * 0.5;
    let vy = -Math.sin(angleRad) * power;

    const dt = 0.016; // 60fps simulation
    let minDistance = Infinity;

    // Simulate for up to 10 seconds
    for (let t = 0; t < 10; t += dt) {
      vx += wind * dt * 0.5;
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;

      // Check distance to target
      const dist = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
      }

      // Stop if projectile goes below target or too far (increased for larger maps)
      if (y > targetY + 100 || Math.abs(x - startX) > 5000) {
        break;
      }
    }

    return { distance: minDistance };
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
      console.log('[AI planMovement] No energy:', shooter.movementEnergy);
      return null;
    }

    // Score current position
    const currentScore = this.scorePosition(shooter.x, shooter.y, target, terrain, wind);
    console.log('[AI planMovement] Current score:', currentScore);

    // Find candidate positions (up to 3)
    const candidates = this.findCandidatePositions(shooter, target, terrain, wind);
    console.log('[AI planMovement] Candidates found:', candidates.length, candidates);

    // Find best candidate that's significantly better than current
    let bestCandidate: PositionCandidate | null = null;
    for (const candidate of candidates) {
      if (!candidate.reachable) continue;

      // Check minimum enemy distance
      const distToEnemy = Math.abs(candidate.x - target.x);
      if (distToEnemy < AI_MIN_ENEMY_DISTANCE) {
        console.log('[AI planMovement] Candidate too close to enemy:', candidate.x, distToEnemy);
        continue;
      }

      // Check if significantly better (with minimum improvement threshold)
      const improvement = (candidate.score - currentScore) / Math.max(currentScore, 0.1);
      console.log('[AI planMovement] Candidate improvement:', candidate.x, 'score:', candidate.score, 'improvement:', improvement);
      if (improvement > AI_MIN_SCORE_IMPROVEMENT) {
        if (!bestCandidate || candidate.score > bestCandidate.score) {
          bestCandidate = candidate;
        }
      }
    }

    if (!bestCandidate) {
      console.log('[AI planMovement] No suitable candidate found');
      return null;
    }

    console.log('[AI planMovement] Best candidate:', bestCandidate);
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
    console.log('[AI findCandidates] energy:', shooter.movementEnergy, 'maxWalkTime:', maxWalkTime, 'maxWalkDistance:', maxWalkDistance);

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

    console.log('[AI findCandidates] sampleDistances:', sampleDistances, 'uniqueDistances:', uniqueDistances);

    // Evaluate each candidate
    for (const dist of uniqueDistances) {
      const candidateX = shooter.x + dist;
      const candidateY = MAP_HEIGHT - terrain.getHeightAt(candidateX);

      console.log('[AI findCandidates] Checking candidate at x:', candidateX, 'dist:', dist);

      // Check reachability
      const reachability = this.checkReachability(
        shooter.x,
        candidateX,
        terrain,
        shooter.movementEnergy
      );

      if (!reachability.reachable) {
        console.log('[AI findCandidates] Candidate at', candidateX, 'not reachable');
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
    _terrain: Terrain,
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
    const simResult = this.simulateBestShot(x, y, target, wind);

    // Better shot accuracy = higher score
    if (simResult.minDistance < 30) {
      score += 50; // Excellent shot possible
    } else if (simResult.minDistance < 60) {
      score += 30; // Good shot possible
    } else if (simResult.minDistance < 100) {
      score += 15; // Decent shot possible
    }

    return score;
  }

  // Simulate best possible shot from a position
  private simulateBestShot(
    fromX: number,
    fromY: number,
    target: Ant,
    wind: number
  ): { minDistance: number } {
    const dx = target.x - fromX;
    const shootingRight = dx > 0;

    let bestDistance = Infinity;

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
          shootingRight
        );

        if (result.distance < bestDistance) {
          bestDistance = result.distance;
        }
      }
    }

    return { minDistance: bestDistance };
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
          console.log('[AI reachability] Gap too wide at', currentX, '-> cannot reach', toX);
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
        console.log('[AI reachability] Slope too steep at', currentX, 'angle:', slopeAngle, '-> cannot reach', toX);
        return { reachable: false, requiresJump: false, jumpAtX: null, energyCost: 0 };
      }

      // Calculate energy cost for this step
      const stepTime = stepSize / MOVEMENT_SPEED;
      energyUsed += MOVEMENT_ENERGY_COST * stepTime;

      // Check if we have enough energy
      if (energyUsed > availableEnergy) {
        console.log('[AI reachability] Not enough energy at', currentX, 'used:', energyUsed, '-> cannot reach', toX);
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
