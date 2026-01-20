import { Ant } from './Ant.ts';
import { GRAVITY, MAX_POWER } from './constants.ts';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

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
}
