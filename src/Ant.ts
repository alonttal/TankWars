import {
  TANK_WIDTH,
  TANK_HEIGHT,
  MAP_HEIGHT,
  MAP_WIDTH,
  GRAVITY,
  MOVEMENT_SPEED,
  JUMP_FORCE,
  MAX_MOVEMENT_ENERGY,
  MOVEMENT_ENERGY_COST,
  JUMP_ENERGY_COST,
  MAX_SLOPE_ANGLE,
  KNOCKBACK_MIN_FORCE,
  KNOCKBACK_MAX_FORCE,
  FALL_DAMAGE_VELOCITY_THRESHOLD,
  FALL_DAMAGE_MULTIPLIER
} from './constants.ts';
import { Terrain } from './Terrain.ts';
import { WeaponType, getDefaultAmmo, WEAPON_CONFIGS } from './weapons/WeaponTypes.ts';
import { ActiveBuff, PowerUpType } from './powerups/PowerUpTypes.ts';
import {
  DeathType,
  SmokeParticle,
  MuzzleParticle,
  SparkParticle,
  SmokeRing,
  DestructionDebris,
  ChargeParticle,
  FireParticle,
  GhostParticle,
  GooParticle,
  DustParticle,
  ShockwaveRing,
  BodyPart,
  EtherealWisp,
  SplatMark,
  EmberParticle,
  LightningArc,
  DissolveParticle,
} from './types/AntParticleTypes.ts';
import { AntRenderer, AntRenderData } from './rendering/AntRenderer.ts';
import { AntDeathSystem, AntDeathData, DeathParticles } from './systems/AntDeathSystem.ts';

export class Ant {
  x: number;
  y: number;
  angle: number; // in degrees, 0 = right, 90 = up, 180 = left
  color: string;
  health: number;
  isAlive: boolean;
  playerIndex: number; // Unique ID across all ants (0-15 for 16 ants)
  teamIndex: number; // Which team (0 or 1)
  teamAntIndex: number; // Index within the team (0-7)
  facingRight: boolean;

  // Weapon system
  selectedWeapon: WeaponType;
  weaponAmmo: Map<WeaponType, number>;

  // Power-up buffs
  activeBuffs: ActiveBuff[];

  // Damage visuals
  private smokeParticles: SmokeParticle[];
  private smokeTimer: number;
  private damageFlash: number;

  // Muzzle flash
  private muzzleFlashTime: number;
  private muzzleParticles: MuzzleParticle[];

  // Barrel recoil
  private recoilOffset: number;

  // Spark particles (when hit)
  private sparkParticles: SparkParticle[];

  // Idle animation
  private idleTime: number;

  // Smoke rings from barrel
  private smokeRings: SmokeRing[];

  // Destruction debris
  private destructionDebris: DestructionDebris[];
  private destructionFlash: number;

  // Charge effect particles
  private chargeParticles: ChargeParticle[];
  private chargeTime: number;

  // Hit reaction (knockback visual)
  private hitReactionX: number;
  private hitReactionY: number;
  private hitReactionTime: number;

  // Critical damage fire particles
  private fireParticles: FireParticle[];
  private fireSpawnTimer: number;

  // Pulsing glow effect for current player
  private glowPulse: number;

  // Death animation state
  private deathAnimationStage: number;
  private deathAnimationTimer: number;
  private deathDelayTimer: number;
  private deathPopY: number;
  private deathPopVy: number;
  private deathType: DeathType;

  // Death effect particles
  private ghostParticle: GhostParticle | null;
  private gooParticles: GooParticle[];
  private dustParticles: DustParticle[];
  private shockwaveRings: ShockwaveRing[];
  private disintegrateProgress: number;
  private dissolveProgress: number;
  private dissolveParticles: DissolveParticle[];

  // Enhanced death effect particles
  private bodyParts: BodyPart[];
  private etherealWisps: EtherealWisp[];
  private splatMarks: SplatMark[];
  private emberParticles: EmberParticle[];
  private lightningArcs: LightningArc[];

  // Movement state
  movementEnergy: number;
  private velocityX: number;
  private velocityY: number;
  isGrounded: boolean;
  private isWalking: boolean;
  private walkDirection: number;
  movementBarAlpha: number;


  // Rendering and death systems
  private renderer: AntRenderer;
  private deathSystem: AntDeathSystem;

  constructor(x: number, y: number, color: string, playerIndex: number, facingRight: boolean, teamIndex: number = 0, teamAntIndex: number = 0) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.playerIndex = playerIndex;
    this.teamIndex = teamIndex;
    this.teamAntIndex = teamAntIndex;
    this.facingRight = facingRight;
    this.angle = facingRight ? 45 : 135;
    this.health = 100;
    this.isAlive = true;

    // Initialize weapon system
    this.selectedWeapon = 'standard';
    this.weaponAmmo = getDefaultAmmo();

    // Initialize buffs
    this.activeBuffs = [];

    this.smokeParticles = [];
    this.smokeTimer = 0;
    this.damageFlash = 0;
    this.muzzleFlashTime = 0;
    this.muzzleParticles = [];
    this.recoilOffset = 0;
    this.sparkParticles = [];
    this.idleTime = Math.random() * Math.PI * 2;
    this.smokeRings = [];
    this.destructionDebris = [];
    this.destructionFlash = 0;
    this.chargeParticles = [];
    this.chargeTime = 0;
    this.hitReactionX = 0;
    this.hitReactionY = 0;
    this.hitReactionTime = 0;
    this.fireParticles = [];
    this.fireSpawnTimer = 0;
    this.glowPulse = 0;
    this.deathAnimationStage = 0;
    this.deathAnimationTimer = 0;
    this.deathDelayTimer = 0;
    this.deathPopY = 0;
    this.deathPopVy = 0;
    this.deathType = 'explode';

    // Death effect particles
    this.ghostParticle = null;
    this.gooParticles = [];
    this.dustParticles = [];
    this.shockwaveRings = [];
    this.disintegrateProgress = 0;
    this.dissolveProgress = 0;
    this.dissolveParticles = [];

    // Enhanced death effect particles
    this.bodyParts = [];
    this.etherealWisps = [];
    this.splatMarks = [];
    this.emberParticles = [];
    this.lightningArcs = [];

    // Movement initialization
    this.movementEnergy = MAX_MOVEMENT_ENERGY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isWalking = false;
    this.walkDirection = 0;
    this.movementBarAlpha = 0;

    // Initialize subsystems
    this.renderer = new AntRenderer();
    this.deathSystem = new AntDeathSystem();
  }

  updatePosition(terrain: Terrain): void {
    this.deathSystem.setTerrain(terrain);
    const surfaceHeight = terrain.getHeightAt(this.x);
    this.y = MAP_HEIGHT - surfaceHeight;

    let checkY = Math.floor(this.y);
    while (terrain.isPointInTerrain(this.x, checkY) && checkY > 0) {
      checkY--;
    }
    if (checkY < this.y) {
      this.y = checkY;
    }
  }

  // Movement methods
  startWalking(direction: number): void {
    if (!this.isAlive || this.movementEnergy <= 0) return;
    this.walkDirection = direction;
    this.isWalking = true;
    if (direction > 0) this.facingRight = true;
    if (direction < 0) this.facingRight = false;
  }

  stopWalking(): void {
    this.walkDirection = 0;
    this.isWalking = false;
    this.velocityX = 0;
  }

  jump(): void {
    if (!this.isAlive || !this.isGrounded || this.movementEnergy < JUMP_ENERGY_COST) return;
    this.velocityY = -JUMP_FORCE;
    this.isGrounded = false;
    this.movementEnergy -= JUMP_ENERGY_COST;
  }

  canMove(): boolean {
    return this.isAlive && this.movementEnergy > 0;
  }

  resetMovementEnergy(): void {
    this.movementEnergy = MAX_MOVEMENT_ENERGY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isWalking = false;
    this.walkDirection = 0;
  }

  updateMovement(deltaTime: number, terrain: Terrain): void {
    this.deathSystem.setTerrain(terrain);

    if (!this.isAlive) return;

    const isMoving = this.isWalking || !this.isGrounded;
    if (isMoving) {
      this.movementBarAlpha = Math.min(1, this.movementBarAlpha + deltaTime * 5);
    } else {
      this.movementBarAlpha = Math.max(0, this.movementBarAlpha - deltaTime * 3);
    }

    if (this.isWalking && this.isGrounded && this.movementEnergy > 0) {
      const slopeAngle = this.getTerrainSlopeAngle(terrain);

      if (Math.abs(slopeAngle) <= MAX_SLOPE_ANGLE ||
          (this.walkDirection > 0 && slopeAngle < 0) ||
          (this.walkDirection < 0 && slopeAngle > 0)) {
        this.velocityX = this.walkDirection * MOVEMENT_SPEED;
        this.movementEnergy -= MOVEMENT_ENERGY_COST * deltaTime;
        if (this.movementEnergy < 0) this.movementEnergy = 0;
      } else {
        this.velocityX = 0;
      }
    } else if (!this.isGrounded && this.isWalking && this.movementEnergy > 0) {
      this.velocityX = this.walkDirection * MOVEMENT_SPEED * 0.7;
      this.movementEnergy -= MOVEMENT_ENERGY_COST * deltaTime * 0.5;
      if (this.movementEnergy < 0) this.movementEnergy = 0;
    } else if (this.isGrounded) {
      this.velocityX = 0;
    }

    if (!this.isGrounded) {
      this.velocityY += GRAVITY * deltaTime;
    }

    const newX = this.x + this.velocityX * deltaTime;
    const newY = this.y + this.velocityY * deltaTime;

    if (this.velocityX !== 0) {
      const checkHeights = [this.y - 5, this.y - 15, this.y - 25];
      let canMoveX = true;
      for (const checkY of checkHeights) {
        if (terrain.isPointInTerrain(newX, checkY)) {
          canMoveX = false;
          break;
        }
      }
      if (canMoveX && newX > 50 && newX < MAP_WIDTH - 50) {
        this.x = newX;
      } else {
        this.velocityX = 0;
      }
    }

    if (this.velocityY > 0) {
      const groundHeight = terrain.getHeightAt(this.x);
      const groundY = MAP_HEIGHT - groundHeight;
      if (newY >= groundY) {
        if (this.velocityY > FALL_DAMAGE_VELOCITY_THRESHOLD) {
          const fallDamage = Math.floor((this.velocityY - FALL_DAMAGE_VELOCITY_THRESHOLD) * FALL_DAMAGE_MULTIPLIER);
          if (fallDamage > 0) {
            this.takeFallDamage(fallDamage);
          }
        }
        this.y = groundY;
        this.velocityY = 0;
        this.isGrounded = true;
      } else {
        this.y = newY;
        this.isGrounded = false;
      }
    } else if (this.velocityY < 0) {
      if (terrain.isPointInTerrain(this.x, newY - 30)) {
        this.velocityY = 0;
      } else {
        this.y = newY;
      }
      this.isGrounded = false;
    } else if (this.isGrounded) {
      const groundHeight = terrain.getHeightAt(this.x);
      const groundY = MAP_HEIGHT - groundHeight;

      if (groundY > this.y + 5) {
        this.isGrounded = false;
      } else {
        this.y = groundY;
      }
    }
  }

  private getTerrainSlopeAngle(terrain: Terrain): number {
    const sampleDist = 10;
    const heightLeft = terrain.getHeightAt(this.x - sampleDist);
    const heightRight = terrain.getHeightAt(this.x + sampleDist);
    const heightDiff = heightRight - heightLeft;
    const slopeAngle = Math.atan2(heightDiff, sampleDist * 2) * (180 / Math.PI);
    return slopeAngle;
  }

  takeDamage(amount: number): void {
    const shieldBuff = this.activeBuffs.find(b => b.type === 'shield');
    if (shieldBuff) {
      const absorbed = Math.min(amount, shieldBuff.remainingValue);
      shieldBuff.remainingValue -= absorbed;
      amount -= absorbed;

      if (shieldBuff.remainingValue <= 0) {
        this.activeBuffs = this.activeBuffs.filter(b => b.type !== 'shield');
      }

      if (amount <= 0) {
        this.damageFlash = 0.1;
        return;
      }
    }

    this.health -= amount;
    this.damageFlash = 0.3;

    const knockbackStrength = Math.min(amount / 10, 4);
    this.hitReactionX = (Math.random() - 0.5) * knockbackStrength * 2;
    this.hitReactionY = -knockbackStrength;
    this.hitReactionTime = 0.2;

    const sparkCount = Math.min(12, Math.floor(amount / 5) + 4);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      this.sparkParticles.push({
        x: this.x + (Math.random() - 0.5) * TANK_WIDTH * 0.5,
        y: this.y - TANK_HEIGHT / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.3 + Math.random() * 0.3,
        size: 2 + Math.random() * 2,
      });
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;

      const deathTypes: DeathType[] = ['explode', 'ghost', 'splatter', 'disintegrate', 'vaporize'];
      this.deathType = deathTypes[Math.floor(Math.random() * deathTypes.length)];

      this.deathDelayTimer = 0.4;
      this.deathAnimationStage = 0;
      this.deathPopY = 0;
      this.deathPopVy = -120;
    }
  }

  applyKnockback(explosionX: number, explosionY: number, force: number): void {
    if (!this.isAlive) return;

    force = Math.max(KNOCKBACK_MIN_FORCE, Math.min(KNOCKBACK_MAX_FORCE, force));

    const dx = this.x - explosionX;
    const dy = (this.y - 10) - explosionY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    let dirX = dx / distance;
    let dirY = dy / distance;

    dirY = Math.min(dirY, -0.3);

    const newLen = Math.sqrt(dirX * dirX + dirY * dirY);
    dirX /= newLen;
    dirY /= newLen;

    this.velocityX = dirX * force;
    this.velocityY = dirY * force;
    this.isGrounded = false;
  }

  private takeFallDamage(amount: number): void {
    const shieldBuff = this.activeBuffs.find(b => b.type === 'shield');
    if (shieldBuff) {
      const absorbed = Math.min(amount, shieldBuff.remainingValue);
      shieldBuff.remainingValue -= absorbed;
      amount -= absorbed;

      if (shieldBuff.remainingValue <= 0) {
        this.activeBuffs = this.activeBuffs.filter(b => b.type !== 'shield');
      }

      if (amount <= 0) {
        this.damageFlash = 0.1;
        return;
      }
    }

    this.health -= amount;
    this.damageFlash = 0.2;

    const sparkCount = Math.min(6, Math.floor(amount / 8) + 2);
    for (let i = 0; i < sparkCount; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.5;
      const speed = 40 + Math.random() * 60;
      this.sparkParticles.push({
        x: this.x + (Math.random() - 0.5) * TANK_WIDTH * 0.5,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 1.5,
      });
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;

      const deathTypes: DeathType[] = ['explode', 'ghost', 'splatter', 'disintegrate', 'vaporize'];
      this.deathType = deathTypes[Math.floor(Math.random() * deathTypes.length)];

      this.deathDelayTimer = 0.4;
      this.deathAnimationStage = 0;
      this.deathPopY = 0;
      this.deathPopVy = -120;
    }
  }

  updateCharging(deltaTime: number, power: number): void {
    this.chargeTime += deltaTime;

    if (this.chargeTime > 0.05) {
      this.chargeTime = 0;

      const barrelEnd = this.getBarrelEnd();
      const particleCount = Math.ceil(power / 30);

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 20;
        this.chargeParticles.push({
          x: barrelEnd.x + Math.cos(angle) * distance,
          y: barrelEnd.y + Math.sin(angle) * distance,
          angle: angle,
          distance: distance,
          speed: 60 + power * 0.5,
          size: 2 + Math.random() * 2,
          life: 0.5,
        });
      }
    }
  }

  fire(): void {
    this.muzzleFlashTime = 0.15;
    this.recoilOffset = 8;

    const barrelEnd = this.getBarrelEnd();
    const angleRad = (this.angle * Math.PI) / 180;

    for (let i = 0; i < 12; i++) {
      const spreadAngle = angleRad + (Math.random() - 0.5) * 0.6;
      const speed = 100 + Math.random() * 150;
      const colors = ['#FFF', '#FFD700', '#FFA500', '#FF6600', '#FF4400'];
      this.muzzleParticles.push({
        x: barrelEnd.x,
        y: barrelEnd.y,
        vx: Math.cos(spreadAngle) * speed,
        vy: -Math.sin(spreadAngle) * speed,
        life: 0.1 + Math.random() * 0.15,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    this.smokeRings.push({
      x: barrelEnd.x,
      y: barrelEnd.y,
      radius: 5,
      alpha: 0.8,
      angle: angleRad,
    });
  }

  update(deltaTime: number): void {
    this.idleTime += deltaTime * 2;
    this.glowPulse += deltaTime * 4;

    if (this.damageFlash > 0) {
      this.damageFlash -= deltaTime;
    }

    if (this.hitReactionTime > 0) {
      this.hitReactionTime -= deltaTime;
      this.hitReactionX *= 0.85;
      this.hitReactionY *= 0.85;
      if (this.hitReactionTime <= 0) {
        this.hitReactionX = 0;
        this.hitReactionY = 0;
      }
    }

    if (this.isAlive && this.health < 25) {
      this.fireSpawnTimer -= deltaTime;
      if (this.fireSpawnTimer <= 0) {
        this.fireSpawnTimer = 0.05 + Math.random() * 0.05;
        this.fireParticles.push({
          x: this.x + (Math.random() - 0.5) * TANK_WIDTH * 0.6,
          y: this.y - TANK_HEIGHT - Math.random() * 5,
          vx: (Math.random() - 0.5) * 30,
          vy: -40 - Math.random() * 40,
          life: 0.3 + Math.random() * 0.4,
          maxLife: 0.7,
          size: 4 + Math.random() * 4,
        });
      }
    }

    for (const particle of this.fireParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 50 * deltaTime;
      particle.size *= 0.97;
      particle.life -= deltaTime;
    }
    this.fireParticles = this.fireParticles.filter(p => p.life > 0);

    for (const particle of this.chargeParticles) {
      particle.distance -= particle.speed * deltaTime;
      particle.angle += deltaTime * 3;
      particle.life -= deltaTime;
      const barrelEnd = this.getBarrelEnd();
      particle.x = barrelEnd.x + Math.cos(particle.angle) * particle.distance;
      particle.y = barrelEnd.y + Math.sin(particle.angle) * particle.distance;
    }
    this.chargeParticles = this.chargeParticles.filter(p => p.life > 0 && p.distance > 0);

    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= deltaTime;
    }

    if (this.recoilOffset > 0) {
      this.recoilOffset -= deltaTime * 60;
      if (this.recoilOffset < 0) this.recoilOffset = 0;
    }

    for (const particle of this.muzzleParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 200 * deltaTime;
      particle.size *= 0.92;
      particle.life -= deltaTime;
    }
    this.muzzleParticles = this.muzzleParticles.filter(p => p.life > 0);

    for (const particle of this.sparkParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 300 * deltaTime;
      particle.life -= deltaTime;
    }
    this.sparkParticles = this.sparkParticles.filter(p => p.life > 0);

    if (this.isAlive && this.health < 50) {
      this.smokeTimer -= deltaTime;
      if (this.smokeTimer <= 0) {
        const spawnRate = this.health < 25 ? 0.05 : 0.12;
        this.smokeTimer = spawnRate;

        const puffCount = this.health < 25 ? 2 : 1;
        for (let i = 0; i < puffCount; i++) {
          this.smokeParticles.push({
            x: this.x + (Math.random() - 0.5) * TANK_WIDTH * 0.6,
            y: this.y - TANK_HEIGHT - Math.random() * 5,
            vx: (Math.random() - 0.5) * 15,
            vy: -25 - Math.random() * 35,
            life: 1.0 + Math.random() * 0.8,
            size: 5 + Math.random() * 6,
          });
        }
      }
    }

    for (const particle of this.smokeParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 8 * deltaTime;
      particle.vx *= 0.98;
      particle.size += deltaTime * 10;
      particle.life -= deltaTime;
    }
    this.smokeParticles = this.smokeParticles.filter(p => p.life > 0);

    for (const ring of this.smokeRings) {
      ring.radius += deltaTime * 60;
      ring.alpha -= deltaTime * 2;
      ring.x += Math.cos(ring.angle) * 30 * deltaTime;
      ring.y -= Math.sin(ring.angle) * 30 * deltaTime;
    }
    this.smokeRings = this.smokeRings.filter(r => r.alpha > 0);

    if (this.destructionFlash > 0) {
      this.destructionFlash -= deltaTime * 2;
    }

    // Handle death delay before animation starts
    if (!this.isAlive && this.deathDelayTimer > 0) {
      this.deathDelayTimer -= deltaTime;
      if (this.deathDelayTimer <= 0) {
        this.deathAnimationStage = 1;
        this.deathAnimationTimer = 0.15;
        this.destructionFlash = 1.0;
        this.deathSystem.initializeDeathEffect(
          this.getDeathData(),
          this.deathType,
          this.getDeathParticles(),
          this.getDeathAnimationState()
        );
      }
    }

    // Update death animation stages
    if (this.deathAnimationStage > 0) {
      this.deathAnimationTimer -= deltaTime;
      this.deathSystem.updateDeathAnimation(
        deltaTime,
        this.getDeathData(),
        this.getDeathAnimationState(),
        this.getDeathParticles()
      );
      this.syncDeathAnimationState();
    }

    // Update death-type specific particles
    this.deathSystem.updateDeathParticles(
      deltaTime,
      this.getDeathData(),
      this.getDeathAnimationState(),
      this.getDeathParticles()
    );
    this.syncDeathParticles();
  }

  private getDeathData(): AntDeathData {
    return {
      x: this.x,
      y: this.y,
      color: this.color,
      facingRight: this.facingRight,
      idleTime: this.idleTime,
    };
  }

  private getDeathParticles(): DeathParticles {
    return {
      destructionDebris: this.destructionDebris,
      bodyParts: this.bodyParts,
      ghostParticle: this.ghostParticle,
      gooParticles: this.gooParticles,
      dustParticles: this.dustParticles,
      shockwaveRings: this.shockwaveRings,
      etherealWisps: this.etherealWisps,
      splatMarks: this.splatMarks,
      emberParticles: this.emberParticles,
      lightningArcs: this.lightningArcs,
      dissolveParticles: this.dissolveParticles,
    };
  }

  private syncDeathParticles(): void {
    // Particles are mutated in place, so no sync needed
  }

  private getDeathAnimationState() {
    return {
      deathAnimationStage: this.deathAnimationStage,
      deathAnimationTimer: this.deathAnimationTimer,
      deathDelayTimer: this.deathDelayTimer,
      deathPopY: this.deathPopY,
      deathPopVy: this.deathPopVy,
      deathType: this.deathType,
      disintegrateProgress: this.disintegrateProgress,
      dissolveProgress: this.dissolveProgress,
      destructionFlash: this.destructionFlash,
    };
  }

  private syncDeathAnimationState(): void {
    const state = this.getDeathAnimationState();
    // The death system mutates the state object directly, so sync it back
    this.deathAnimationStage = state.deathAnimationStage;
    this.deathAnimationTimer = state.deathAnimationTimer;
    this.deathPopY = state.deathPopY;
    this.deathPopVy = state.deathPopVy;
    this.disintegrateProgress = state.disintegrateProgress;
    this.dissolveProgress = state.dissolveProgress;
    this.destructionFlash = state.destructionFlash;
  }

  getBarrelEnd(): { x: number; y: number } {
    const angleRad = (this.angle * Math.PI) / 180;
    const direction = this.facingRight ? 1 : -1;

    const baseY = this.y;
    const thoraxX = this.x + direction * 8;
    const thoraxY = baseY - 22;

    const bazookaStartX = thoraxX - direction * 6;
    const bazookaStartY = thoraxY;

    const weaponVisual = this.renderer.getWeaponVisual(this.selectedWeapon);
    const barrelLength = weaponVisual.length * 2;

    return {
      x: bazookaStartX + Math.cos(angleRad) * barrelLength,
      y: bazookaStartY - Math.sin(angleRad) * barrelLength,
    };
  }

  // Weapon management
  selectWeapon(weapon: WeaponType): boolean {
    const ammo = this.weaponAmmo.get(weapon);
    if (ammo === -1 || (ammo !== undefined && ammo > 0)) {
      this.selectedWeapon = weapon;
      return true;
    }
    return false;
  }

  getSelectedWeaponConfig() {
    return WEAPON_CONFIGS[this.selectedWeapon];
  }

  useAmmo(): void {
    const ammo = this.weaponAmmo.get(this.selectedWeapon);
    if (ammo !== undefined && ammo > 0) {
      this.weaponAmmo.set(this.selectedWeapon, ammo - 1);

      if (this.weaponAmmo.get(this.selectedWeapon) === 0) {
        this.selectedWeapon = 'standard';
      }
    }
  }

  getAmmo(weapon: WeaponType): number {
    return this.weaponAmmo.get(weapon) ?? 0;
  }

  hasAmmo(weapon: WeaponType): boolean {
    const ammo = this.weaponAmmo.get(weapon);
    return ammo === -1 || (ammo !== undefined && ammo > 0);
  }

  // Buff management
  addBuff(buff: ActiveBuff): void {
    const existingIndex = this.activeBuffs.findIndex(b => b.type === buff.type);
    if (existingIndex >= 0) {
      if (buff.type === 'shield') {
        this.activeBuffs[existingIndex].remainingValue += buff.remainingValue;
      } else {
        this.activeBuffs[existingIndex] = buff;
      }
    } else {
      this.activeBuffs.push(buff);
    }
  }

  removeBuff(type: PowerUpType): void {
    this.activeBuffs = this.activeBuffs.filter(b => b.type !== type);
  }

  hasBuff(type: PowerUpType): boolean {
    return this.activeBuffs.some(b => b.type === type);
  }

  getBuff(type: PowerUpType): ActiveBuff | undefined {
    return this.activeBuffs.find(b => b.type === type);
  }

  getDamageMultiplier(): number {
    const damageBuff = this.activeBuffs.find(b => b.type === 'damage_boost');
    return damageBuff ? damageBuff.remainingValue : 1.0;
  }

  consumeDamageBoost(): void {
    const damageBuff = this.activeBuffs.find(b => b.type === 'damage_boost');
    if (damageBuff && damageBuff.duration !== null) {
      damageBuff.duration--;
      if (damageBuff.duration <= 0) {
        this.removeBuff('damage_boost');
      }
    }
  }

  hasDoubleShot(): boolean {
    return this.hasBuff('double_shot');
  }

  consumeDoubleShot(): void {
    const doubleShotBuff = this.activeBuffs.find(b => b.type === 'double_shot');
    if (doubleShotBuff && doubleShotBuff.duration !== null) {
      doubleShotBuff.duration--;
      if (doubleShotBuff.duration <= 0) {
        this.removeBuff('double_shot');
      }
    }
  }

  heal(amount: number): void {
    this.health = Math.min(100, this.health + amount);
  }

  resetWeaponsAndBuffs(): void {
    this.selectedWeapon = 'standard';
    this.weaponAmmo = getDefaultAmmo();
    this.activeBuffs = [];
  }

  render(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean, chargingPower: number = 0): void {
    if (!this.isAlive) {
      if (this.deathDelayTimer > 0) {
        return;
      }
      this.deathSystem.renderDestroyed(
        ctx,
        this.getDeathData(),
        this.getDeathAnimationState(),
        this.getDeathParticles()
      );
      return;
    }

    const renderData: AntRenderData = {
      x: this.x,
      y: this.y,
      angle: this.angle,
      color: this.color,
      health: this.health,
      isAlive: this.isAlive,
      facingRight: this.facingRight,
      selectedWeapon: this.selectedWeapon,
      damageFlash: this.damageFlash,
      idleTime: this.idleTime,
      isWalking: this.isWalking,
      hitReactionTime: this.hitReactionTime,
      hitReactionX: this.hitReactionX,
      hitReactionY: this.hitReactionY,
      smokeParticles: this.smokeParticles,
      muzzleParticles: this.muzzleParticles,
      sparkParticles: this.sparkParticles,
      smokeRings: this.smokeRings,
      chargeParticles: this.chargeParticles,
      fireParticles: this.fireParticles,
    };

    this.renderer.render(ctx, renderData, isCurrentPlayer, chargingPower);
  }
}
