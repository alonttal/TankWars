import { Ant } from '../Ant.ts';
import { AntAI, AIDifficulty, AIMovementPlan } from '../AI.ts';
import { Terrain } from '../Terrain.ts';
import { FireSystem } from './FireSystem.ts';
import { Projectile } from '../Projectile.ts';

export interface AICallbacks {
  getCurrentAnt: () => Ant | null;
  getAliveAntsForTeam: (teamIndex: number) => Ant[];
  getTerrain: () => Terrain;
  getWind: () => number;
  getAllAnts: () => Ant[];

  // State management
  setState: (state: 'AI_THINKING' | 'AI_MOVING' | 'PLAYING' | 'FIRING') => void;
  getState: () => string;

  // UI updates
  setFireButtonDisabled: (disabled: boolean) => void;
  updateAngleSlider: (angle: number) => void;
  updatePowerSlider: (power: number) => void;
  updateWeaponSelector: (ant: Ant) => void;

  // Camera
  focusOnAnt: (ant: Ant) => void;

  // Firing
  setProjectiles: (projectiles: Projectile[]) => void;

  // Turn management
  endTurn: () => void;
}

export class AIManager {
  private ai: AntAI | null = null;
  private aiThinkingTimer: number = 0;
  private aiShot: { angle: number; power: number; target: Ant | null } | null = null;
  private aiMovementPlan: AIMovementPlan | null = null;
  private aiTarget: Ant | null = null;
  private callbacks: AICallbacks;
  private fireSystem: FireSystem;

  constructor(callbacks: AICallbacks, fireSystem: FireSystem) {
    this.callbacks = callbacks;
    this.fireSystem = fireSystem;
  }

  initialize(difficulty: AIDifficulty): void {
    this.ai = new AntAI(difficulty);
  }

  reset(): void {
    this.ai = null;
    this.aiShot = null;
    this.aiMovementPlan = null;
    this.aiTarget = null;
    this.aiThinkingTimer = 0;
  }

  isActive(): boolean {
    return this.ai !== null;
  }

  startAITurn(): void {
    if (!this.ai) return;

    const aiAnt = this.callbacks.getCurrentAnt();
    if (!aiAnt || !aiAnt.isAlive) return;

    const enemyTeamIndex = aiAnt.teamIndex === 0 ? 1 : 0;
    const enemyAnts = this.callbacks.getAliveAntsForTeam(enemyTeamIndex);
    if (enemyAnts.length === 0) return;

    const target = this.ai.selectTarget(aiAnt, enemyAnts);
    if (!target) return;

    this.aiTarget = target;
    this.callbacks.setFireButtonDisabled(true);

    // Check if AI should consider moving to a better position
    const shouldMove = this.ai.shouldConsiderMoving();
    console.log('[AI] shouldConsiderMoving:', shouldMove);
    if (shouldMove) {
      const movementPlan = this.ai.planMovement(
        aiAnt,
        target,
        this.callbacks.getTerrain(),
        this.callbacks.getWind()
      );
      console.log('[AI] movementPlan:', movementPlan);
      if (movementPlan) {
        // AI decided to move - start movement
        console.log('[AI] Starting movement to', movementPlan.targetX, 'from', aiAnt.x);
        this.aiMovementPlan = movementPlan;
        const direction = movementPlan.targetX > aiAnt.x ? 1 : -1;
        aiAnt.startWalking(direction);
        this.callbacks.setState('AI_MOVING');
        this.callbacks.focusOnAnt(aiAnt);
        return;
      }
    }

    // No movement - proceed directly to aiming and shooting
    this.prepareAIShot(aiAnt, target);
  }

  private prepareAIShot(aiAnt: Ant, target: Ant): void {
    if (!this.ai) return;

    this.ai.selectWeapon(aiAnt, target, this.callbacks.getTerrain());
    this.callbacks.updateWeaponSelector(aiAnt);

    const shot = this.ai.calculateShot(
      aiAnt,
      target,
      this.callbacks.getWind(),
      this.callbacks.getTerrain(),
      this.callbacks.getAllAnts()
    );
    this.aiShot = { ...shot, target };
    this.aiThinkingTimer = this.ai.getThinkingTime();

    aiAnt.angle = Math.round(shot.angle);

    this.callbacks.setState('AI_THINKING');
    this.callbacks.setFireButtonDisabled(true);

    this.callbacks.updateAngleSlider(Math.round(shot.angle));
    this.callbacks.updatePowerSlider(Math.round(shot.power));
  }

  updateAIThinking(deltaTime: number, effectiveDelta: number): void {
    const aiAnt = this.callbacks.getCurrentAnt();
    if (aiAnt && aiAnt.isAlive) {
      aiAnt.updateMovement(effectiveDelta, this.callbacks.getTerrain());
    }

    this.aiThinkingTimer -= deltaTime * 1000;
    if (this.aiThinkingTimer <= 0 && this.aiShot) {
      this.executeAIShot();
    }
  }

  updateAIMovement(deltaTime: number): void {
    const aiAnt = this.callbacks.getCurrentAnt();
    if (!aiAnt || !aiAnt.isAlive || !this.aiMovementPlan) {
      console.log('[AI Movement] Finishing early - no ant or plan');
      this.finishAIMovement();
      return;
    }

    // Update ant movement physics
    aiAnt.updateMovement(deltaTime, this.callbacks.getTerrain());

    // Check if we need to jump
    if (this.aiMovementPlan.requiresJump && this.aiMovementPlan.jumpAtX !== null) {
      const jumpDistance = Math.abs(aiAnt.x - this.aiMovementPlan.jumpAtX);
      if (jumpDistance < 10 && aiAnt.isGrounded) {
        console.log('[AI Movement] Jumping at', aiAnt.x);
        aiAnt.jump();
      }
    }

    // Check if we reached the target position or ran out of energy
    const distanceToTarget = Math.abs(aiAnt.x - this.aiMovementPlan.targetX);
    const reachedTarget = distanceToTarget < 15;
    const outOfEnergy = aiAnt.movementEnergy <= 0;

    if (reachedTarget || outOfEnergy) {
      console.log(
        '[AI Movement] Finished - reached:',
        reachedTarget,
        'outOfEnergy:',
        outOfEnergy,
        'finalX:',
        aiAnt.x
      );
      this.finishAIMovement();
    }

    // Follow AI with camera during movement
    this.callbacks.focusOnAnt(aiAnt);
  }

  private finishAIMovement(): void {
    const aiAnt = this.callbacks.getCurrentAnt();
    if (aiAnt) {
      aiAnt.stopWalking();
    }

    this.aiMovementPlan = null;

    // Now proceed to shooting
    if (aiAnt && aiAnt.isAlive && this.aiTarget) {
      this.prepareAIShot(aiAnt, this.aiTarget);
    } else {
      // Fallback - end turn if something went wrong
      this.callbacks.setState('PLAYING');
      this.callbacks.endTurn();
    }
  }

  private executeAIShot(): void {
    if (!this.aiShot) return;

    const tank = this.callbacks.getCurrentAnt();
    if (!tank) return;

    const angle = this.aiShot.angle;
    const powerPercent = this.aiShot.power;

    const result = this.fireSystem.fireAI(tank, angle, powerPercent, this.callbacks.getWind());

    this.callbacks.setProjectiles(result.projectiles);
    this.aiShot = null;
    this.aiTarget = null;
    this.callbacks.setState('FIRING');
  }
}
