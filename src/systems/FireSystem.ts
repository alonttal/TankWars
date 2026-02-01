import { MAX_POWER } from '../constants.ts';
import { Ant } from '../Ant.ts';
import { Projectile } from '../Projectile.ts';
import { soundManager } from '../Sound.ts';
import { CameraSystem } from './CameraSystem.ts';
import { EffectsSystem } from './EffectsSystem.ts';

export interface FireCallbacks {
  updateWeaponSelector: (ant: Ant) => void;
  updateBuffIndicator: (ant: Ant) => void;
  setWeaponSelectorEnabled: (enabled: boolean) => void;
  setFireButtonDisabled: (disabled: boolean) => void;
  incrementShotsFired: (teamIndex: number) => void;
}

export interface FireParams {
  ant: Ant;
  angle: number;
  power: number;
  wind: number;
  includeDoubleShot?: boolean;
}

export interface FireResult {
  projectiles: Projectile[];
}

export class FireSystem {
  private camera: CameraSystem;
  private effects: EffectsSystem;
  private callbacks: FireCallbacks;

  constructor(camera: CameraSystem, effects: EffectsSystem, callbacks: FireCallbacks) {
    this.camera = camera;
    this.effects = effects;
    this.callbacks = callbacks;
  }

  fire(params: FireParams): FireResult {
    const { ant, angle, power, wind, includeDoubleShot = false } = params;
    const weaponConfig = ant.getSelectedWeaponConfig();
    const barrelEnd = ant.getBarrelEnd();

    const projectiles: Projectile[] = [];

    const pelletCount = weaponConfig.pelletCount;
    const spreadAngle = weaponConfig.spreadAngle;

    // Handle multi-pellet weapons (like cluster bomb)
    if (pelletCount > 1) {
      for (let i = 0; i < pelletCount; i++) {
        const spreadOffset = (i / (pelletCount - 1) - 0.5) * spreadAngle;
        const pelletAngle = angle + spreadOffset;

        const projectile = new Projectile(
          barrelEnd.x,
          barrelEnd.y,
          pelletAngle,
          power,
          wind,
          ant,
          weaponConfig
        );
        projectiles.push(projectile);
      }
    } else {
      // Single projectile weapons (with optional double shot buff)
      const hasDoubleShot = includeDoubleShot && ant.hasDoubleShot();
      const shotCount = hasDoubleShot ? 2 : 1;

      for (let i = 0; i < shotCount; i++) {
        const shotAngle = shotCount > 1 ? angle + (i === 0 ? -5 : 5) : angle;

        const projectile = new Projectile(
          barrelEnd.x,
          barrelEnd.y,
          shotAngle,
          power,
          wind,
          ant,
          weaponConfig
        );
        projectiles.push(projectile);
      }

      if (hasDoubleShot) {
        ant.consumeDoubleShot();
      }
    }

    // Update ant state
    ant.useAmmo();
    ant.fire();

    // Update UI
    this.callbacks.updateWeaponSelector(ant);
    this.callbacks.updateBuffIndicator(ant);
    this.callbacks.setWeaponSelectorEnabled(false);
    this.callbacks.setFireButtonDisabled(true);

    // Trigger effects
    const powerRatio = power / MAX_POWER;
    this.camera.triggerScreenShake(4 + powerRatio * 8);
    this.effects.triggerScreenFlash('#FFF', 0.15 + powerRatio * 0.1);

    // Play sound
    if (weaponConfig.type === 'sniper') {
      soundManager.playSniperShot();
    } else {
      soundManager.playShoot();
    }

    // Update stats
    this.callbacks.incrementShotsFired(ant.teamIndex);

    return { projectiles };
  }

  fireInstant(ant: Ant, angle: number, wind: number): FireResult {
    const fixedPower = MAX_POWER * 0.7; // 70% of max power

    const result = this.fire({
      ant,
      angle,
      power: fixedPower,
      wind,
      includeDoubleShot: false
    });

    // Override effects for instant fire (slightly different feel)
    this.camera.triggerScreenShake(8);
    this.effects.triggerScreenFlash('#FFF', 0.2);

    return result;
  }

  fireAI(ant: Ant, angle: number, powerPercent: number, wind: number): FireResult {
    ant.angle = angle;
    const power = (powerPercent / 100) * MAX_POWER;

    return this.fire({
      ant,
      angle,
      power,
      wind,
      includeDoubleShot: false
    });
  }
}
