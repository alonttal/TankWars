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

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface MuzzleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface SmokeRing {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  angle: number;
}

interface DestructionDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  life: number;
  color: string;
}

interface ChargeParticle {
  x: number;
  y: number;
  angle: number;
  distance: number;
  speed: number;
  size: number;
  life: number;
}

interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// Ghost particle for ghost death effect
interface GhostParticle {
  x: number;
  y: number;
  vy: number;
  alpha: number;
  scale: number;
  wobble: number;
}

// Goo particle for splatter death effect
interface GooParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
  stuck: boolean;
  stuckX: number;
  stuckY: number;
}

// Dust particle for disintegrate death effect
interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

// Shockwave ring for vaporize death effect
interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

// Flying body part for explode death
interface BodyPart {
  type: 'head' | 'thorax' | 'abdomen' | 'leg' | 'helmet' | 'antenna';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  life: number;
  color: string;
}

// Ethereal wisp for ghost death
interface EtherealWisp {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
  size: number;
  speed: number;
  angle: number;
}

// Splat mark for splatter death (stays on ground)
interface SplatMark {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: string;
}

// Ember particle for disintegrate death
interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  brightness: number;
}

// Lightning arc for vaporize death
interface LightningArc {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  segments: { x: number; y: number }[];
  alpha: number;
  life: number;
  color: string;
  thickness: number;
}

// Death animation types
type DeathType = 'explode' | 'ghost' | 'splatter' | 'disintegrate' | 'vaporize';

// Ant pixel scale - smaller than terrain for more detail
const ANT_PIXEL_SCALE = 2;

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
  private deathAnimationStage: number; // 0 = not dying, 1 = flash, 2 = pop up, 3 = explode
  private deathAnimationTimer: number;
  private deathDelayTimer: number; // Delay before death animation starts (lets explosion clear)
  private deathPopY: number;
  private deathPopVy: number;
  private deathType: DeathType;

  // Death effect particles
  private ghostParticle: GhostParticle | null;
  private gooParticles: GooParticle[];
  private dustParticles: DustParticle[];
  private shockwaveRings: ShockwaveRing[];
  private disintegrateProgress: number; // 0 to 1, how much has disintegrated
  private dissolveProgress: number; // 0 to 1, for vaporize scan-line dissolve
  private dissolveParticles: { x: number; y: number; vx: number; vy: number; alpha: number; color: string }[];

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
  private walkDirection: number; // -1 = left, 0 = none, 1 = right
  movementBarAlpha: number; // For fading the movement bar

  // Terrain reference for death particles ground detection
  private terrain: Terrain | null;

  constructor(x: number, y: number, color: string, playerIndex: number, facingRight: boolean, teamIndex: number = 0, teamAntIndex: number = 0) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.playerIndex = playerIndex;
    this.teamIndex = teamIndex;
    this.teamAntIndex = teamAntIndex;
    this.facingRight = facingRight;
    this.angle = facingRight ? 45 : 135; // Default angle pointing up and towards center
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
    this.idleTime = Math.random() * Math.PI * 2; // Random start phase
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

    // Terrain reference (set when updatePosition/updateMovement is called)
    this.terrain = null;
  }

  updatePosition(terrain: Terrain): void {
    // Store terrain reference for death particles
    this.terrain = terrain;
    // Update Y position to sit on terrain surface
    // With bitmap terrain, getHeightAt returns height from bottom
    const surfaceHeight = terrain.getHeightAt(this.x);
    this.y = MAP_HEIGHT - surfaceHeight;

    // Handle edge case: if ant ends up inside terrain (thin platforms, caves)
    // scan upward to find the surface
    let checkY = Math.floor(this.y);
    while (terrain.isPointInTerrain(this.x, checkY) && checkY > 0) {
      checkY--;
    }
    // Position ant just above the terrain
    if (checkY < this.y) {
      this.y = checkY;
    }
  }

  // Movement methods
  startWalking(direction: number): void {
    if (!this.isAlive || this.movementEnergy <= 0) return;
    this.walkDirection = direction;
    this.isWalking = true;
    // Update facing direction
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
    // Store terrain reference for death particles
    this.terrain = terrain;

    if (!this.isAlive) return;

    // Update movement bar alpha (fade in when moving, fade out when stopped)
    const isMoving = this.isWalking || !this.isGrounded;
    if (isMoving) {
      this.movementBarAlpha = Math.min(1, this.movementBarAlpha + deltaTime * 5);
    } else {
      this.movementBarAlpha = Math.max(0, this.movementBarAlpha - deltaTime * 3);
    }

    // Apply walking velocity if grounded and has energy
    if (this.isWalking && this.isGrounded && this.movementEnergy > 0) {
      // Check slope at current position
      const slopeAngle = this.getTerrainSlopeAngle(terrain);

      // Can't climb if slope is too steep
      if (Math.abs(slopeAngle) <= MAX_SLOPE_ANGLE ||
          (this.walkDirection > 0 && slopeAngle < 0) || // Going downhill right
          (this.walkDirection < 0 && slopeAngle > 0)) { // Going downhill left
        this.velocityX = this.walkDirection * MOVEMENT_SPEED;
        this.movementEnergy -= MOVEMENT_ENERGY_COST * deltaTime;
        if (this.movementEnergy < 0) this.movementEnergy = 0;
      } else {
        this.velocityX = 0; // Can't climb, stop
      }
    } else if (!this.isGrounded && this.isWalking && this.movementEnergy > 0) {
      // Air control - allow movement in air when pressing arrow keys
      this.velocityX = this.walkDirection * MOVEMENT_SPEED * 0.7; // Slightly less control in air
      this.movementEnergy -= MOVEMENT_ENERGY_COST * deltaTime * 0.5; // Less energy cost in air
      if (this.movementEnergy < 0) this.movementEnergy = 0;
    } else if (this.isGrounded) {
      this.velocityX = 0;
    }

    // Apply gravity when in air
    if (!this.isGrounded) {
      this.velocityY += GRAVITY * deltaTime;
    }

    // Update position
    const newX = this.x + this.velocityX * deltaTime;
    const newY = this.y + this.velocityY * deltaTime;

    // Horizontal collision check
    if (this.velocityX !== 0) {
      // Check if new X position is valid (not inside terrain at head/body height)
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

    // Vertical collision check
    if (this.velocityY > 0) {
      // Falling - check for ground
      const groundHeight = terrain.getHeightAt(this.x);
      const groundY = MAP_HEIGHT - groundHeight;
      if (newY >= groundY) {
        // Check for fall damage before landing
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
      // Rising - check for ceiling
      if (terrain.isPointInTerrain(this.x, newY - 30)) {
        this.velocityY = 0; // Hit ceiling, stop rising
      } else {
        this.y = newY;
      }
      this.isGrounded = false;
    } else if (this.isGrounded) {
      // On ground - stick to terrain surface
      const groundHeight = terrain.getHeightAt(this.x);
      const groundY = MAP_HEIGHT - groundHeight;

      // Check if we've walked off an edge
      if (groundY > this.y + 5) {
        this.isGrounded = false;
      } else {
        this.y = groundY;
      }
    }
  }

  private getTerrainSlopeAngle(terrain: Terrain): number {
    // Sample terrain height at two points to calculate slope
    const sampleDist = 10;
    const heightLeft = terrain.getHeightAt(this.x - sampleDist);
    const heightRight = terrain.getHeightAt(this.x + sampleDist);
    const heightDiff = heightRight - heightLeft; // Positive = uphill to right
    const slopeAngle = Math.atan2(heightDiff, sampleDist * 2) * (180 / Math.PI);
    return slopeAngle;
  }

  takeDamage(amount: number): void {
    // Check for shield buff
    const shieldBuff = this.activeBuffs.find(b => b.type === 'shield');
    if (shieldBuff) {
      const absorbed = Math.min(amount, shieldBuff.remainingValue);
      shieldBuff.remainingValue -= absorbed;
      amount -= absorbed;

      // Remove shield if depleted
      if (shieldBuff.remainingValue <= 0) {
        this.activeBuffs = this.activeBuffs.filter(b => b.type !== 'shield');
      }

      // If shield absorbed all damage, still show minor reaction
      if (amount <= 0) {
        this.damageFlash = 0.1;
        return;
      }
    }

    this.health -= amount;
    this.damageFlash = 0.3; // Flash for 0.3 seconds

    // Hit reaction - knockback effect based on damage
    const knockbackStrength = Math.min(amount / 10, 4);
    this.hitReactionX = (Math.random() - 0.5) * knockbackStrength * 2;
    this.hitReactionY = -knockbackStrength;
    this.hitReactionTime = 0.2;

    // Spawn spark particles on hit
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

      // Randomly select death type
      const deathTypes: DeathType[] = ['explode', 'ghost', 'splatter', 'disintegrate', 'vaporize'];
      this.deathType = deathTypes[Math.floor(Math.random() * deathTypes.length)];

      // Start with a delay to let the explosion effect clear first
      this.deathDelayTimer = 0.4; // Wait before starting death animation
      this.deathAnimationStage = 0; // Not started yet
      this.deathPopY = 0;
      this.deathPopVy = -120; // Initial upward pop velocity
    }
  }

  // Apply knockback force from an explosion
  applyKnockback(explosionX: number, explosionY: number, force: number): void {
    if (!this.isAlive) return;

    // Clamp force to min/max
    force = Math.max(KNOCKBACK_MIN_FORCE, Math.min(KNOCKBACK_MAX_FORCE, force));

    // Calculate direction from explosion to ant (with upward bias)
    const dx = this.x - explosionX;
    const dy = (this.y - 10) - explosionY; // Ant center

    // Normalize and apply upward bias
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    let dirX = dx / distance;
    let dirY = dy / distance;

    // Add upward bias - knockback should always push up somewhat
    dirY = Math.min(dirY, -0.3); // Ensure at least 30% upward component

    // Re-normalize after bias
    const newLen = Math.sqrt(dirX * dirX + dirY * dirY);
    dirX /= newLen;
    dirY /= newLen;

    // Apply velocity impulse
    this.velocityX = dirX * force;
    this.velocityY = dirY * force;
    this.isGrounded = false;
  }

  // Take fall damage without triggering knockback (to avoid infinite loops)
  private takeFallDamage(amount: number): void {
    // Check for shield buff
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
    this.damageFlash = 0.2; // Shorter flash for fall damage

    // Spawn fewer spark particles for fall damage
    const sparkCount = Math.min(6, Math.floor(amount / 8) + 2);
    for (let i = 0; i < sparkCount; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.5; // Mostly upward
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

      // Randomly select death type
      const deathTypes: DeathType[] = ['explode', 'ghost', 'splatter', 'disintegrate', 'vaporize'];
      this.deathType = deathTypes[Math.floor(Math.random() * deathTypes.length)];

      this.deathDelayTimer = 0.4;
      this.deathAnimationStage = 0;
      this.deathPopY = 0;
      this.deathPopVy = -120;
    }
  }

  // Initialize particles and effects for the selected death type
  private initializeDeathEffect(): void {
    const centerX = this.x;
    const centerY = this.y - TANK_HEIGHT / 2;

    switch (this.deathType) {
      case 'explode':
        // === BODY PARTS FLYING OFF ===
        // Helmet flies off spinning
        this.bodyParts.push({
          type: 'helmet',
          x: centerX + 10,
          y: centerY - 10,
          vx: 80 + Math.random() * 60,
          vy: -200 - Math.random() * 100,
          rotation: 0,
          rotationSpeed: 15 + Math.random() * 10,
          scale: 1.2,
          life: 3.0,
          color: this.color,
        });
        // Head
        this.bodyParts.push({
          type: 'head',
          x: centerX + 5,
          y: centerY - 5,
          vx: 40 + Math.random() * 40,
          vy: -150 - Math.random() * 80,
          rotation: 0,
          rotationSpeed: -12 + Math.random() * 6,
          scale: 1.0,
          life: 2.5,
          color: '#2a2a2a',
        });
        // Thorax
        this.bodyParts.push({
          type: 'thorax',
          x: centerX,
          y: centerY,
          vx: -20 + Math.random() * 40,
          vy: -180 - Math.random() * 60,
          rotation: 0,
          rotationSpeed: 8 + Math.random() * 8,
          scale: 1.0,
          life: 2.5,
          color: '#2a2a2a',
        });
        // Abdomen
        this.bodyParts.push({
          type: 'abdomen',
          x: centerX - 10,
          y: centerY + 5,
          vx: -60 - Math.random() * 40,
          vy: -120 - Math.random() * 80,
          rotation: 0,
          rotationSpeed: -10 + Math.random() * 5,
          scale: 1.1,
          life: 2.5,
          color: '#2a2a2a',
        });
        // Legs (6 of them)
        for (let i = 0; i < 6; i++) {
          const legAngle = (i / 6) * Math.PI * 2;
          this.bodyParts.push({
            type: 'leg',
            x: centerX + Math.cos(legAngle) * 8,
            y: centerY + Math.sin(legAngle) * 5,
            vx: Math.cos(legAngle) * (100 + Math.random() * 80),
            vy: -100 - Math.random() * 100,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 25,
            scale: 0.8,
            life: 2.0 + Math.random() * 0.5,
            color: '#1a1a1a',
          });
        }
        // Antennae
        for (let i = 0; i < 2; i++) {
          this.bodyParts.push({
            type: 'antenna',
            x: centerX + (i === 0 ? -5 : 5),
            y: centerY - 15,
            vx: (i === 0 ? -1 : 1) * (60 + Math.random() * 40),
            vy: -180 - Math.random() * 60,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 20,
            scale: 0.6,
            life: 2.0,
            color: '#2a2a2a',
          });
        }
        // Add smoke/dust cloud
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 60;
          this.destructionDebris.push({
            x: centerX + (Math.random() - 0.5) * 20,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 30,
            rotation: 0,
            rotationSpeed: 0,
            size: 8 + Math.random() * 12,
            life: 1.5 + Math.random() * 1.0,
            color: 'rgba(80, 80, 80, 0.6)',
          });
        }
        break;

      case 'ghost':
        // === ANT-SHAPED GHOST RISING SLOWLY ===
        this.ghostParticle = {
          x: this.x,
          y: this.y - TANK_HEIGHT / 2, // Start at ant's position
          vy: -20, // Slow float upward
          alpha: 1.0,
          scale: 1.0,
          wobble: 0,
        };
        // Body crumples on ground - small debris
        for (let i = 0; i < 5; i++) {
          this.destructionDebris.push({
            x: centerX + (Math.random() - 0.5) * 20,
            y: this.y,
            vx: (Math.random() - 0.5) * 15,
            vy: -5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: 0,
            size: 3 + Math.random() * 3,
            life: 2.0,
            color: '#2a2a2a',
          });
        }
        break;

      case 'splatter':
        // === POP EFFECT + MASSIVE GOO SPRAY ===
        this.destructionFlash = 1.5; // Bright pop flash

        // Create splat marks that will stay on the ground (sizes in pixels, not world coords)
        for (let i = 0; i < 8; i++) {
          const dist = 30 + Math.random() * 60;
          const angle = Math.random() * Math.PI * 2;
          this.splatMarks.push({
            x: centerX + Math.cos(angle) * dist,
            y: this.y + 2,
            size: 2 + Math.random() * 3, // 2-5 pixels wide (was 8-23, way too large)
            alpha: 0, // Will fade in when goo lands
            color: ['#4A7023', '#3D5C1C', '#567D2E', this.color][Math.floor(Math.random() * 4)],
          });
        }

        // Goo particles - burst effect (sizes in pixels for pixelated rendering)
        const gooColors = ['#4A7023', '#3D5C1C', '#567D2E', '#2E4A14', '#5D8A2D', this.color];
        for (let i = 0; i < 80; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 150 + Math.random() * 250;
          const isLarge = Math.random() > 0.7;
          this.gooParticles.push({
            x: centerX + (Math.random() - 0.5) * 10,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 150,
            size: isLarge ? (2 + Math.random() * 2) : (1 + Math.random() * 1), // 1-4 pixels (was 3-25)
            life: 4.0 + Math.random() * 2.0,
            color: gooColors[Math.floor(Math.random() * gooColors.length)],
            stuck: false,
            stuckX: 0,
            stuckY: 0,
          });
        }
        // Helmet survives - flies off
        this.bodyParts.push({
          type: 'helmet',
          x: centerX,
          y: centerY - 10,
          vx: (Math.random() - 0.5) * 100,
          vy: -180 - Math.random() * 80,
          rotation: 0,
          rotationSpeed: 10 + Math.random() * 10,
          scale: 1.0,
          life: 3.5,
          color: this.color,
        });
        break;

      case 'disintegrate':
        // === CRUMBLING WITH EMBERS AND ASH ===
        this.disintegrateProgress = 0;

        // Create ember particles (glowing orange/red)
        for (let i = 0; i < 40; i++) {
          this.emberParticles.push({
            x: centerX + (Math.random() - 0.5) * TANK_WIDTH,
            y: centerY + (Math.random() - 0.5) * TANK_HEIGHT,
            vx: (Math.random() - 0.5) * 30 + 20, // Drift right (wind effect)
            vy: -30 - Math.random() * 50,
            size: 2 + Math.random() * 3,
            life: 2.0 + Math.random() * 1.5,
            maxLife: 3.5,
            brightness: 0.8 + Math.random() * 0.2,
          });
        }

        // Dust/ash particles - more of them, varied sizes
        const dustColors = ['#3a3a3a', '#4a4a4a', '#5a5a5a', '#2a2a2a'];
        for (let i = 0; i < 100; i++) {
          const startY = centerY + TANK_HEIGHT/2 - (i / 100) * TANK_HEIGHT * 1.5;
          this.dustParticles.push({
            x: centerX + (Math.random() - 0.5) * TANK_WIDTH * 1.2,
            y: startY,
            vx: 15 + Math.random() * 25, // Wind blowing right
            vy: -10 - Math.random() * 30,
            size: 2 + Math.random() * 5,
            alpha: 0,
            color: dustColors[Math.floor(Math.random() * dustColors.length)],
          });
        }
        break;

      case 'vaporize':
        // === SCAN-LINE DISSOLVE (like glitchy teleporter) ===
        this.destructionFlash = 1.0; // Brief flash
        this.dissolveProgress = 0;
        this.dissolveParticles = [];
        break;
    }
  }

  // Call this during power charging to update effects
  updateCharging(deltaTime: number, power: number): void {
    this.chargeTime += deltaTime;

    // Spawn charge particles that spiral inward to barrel tip
    if (this.chargeTime > 0.05) {
      this.chargeTime = 0;

      const barrelEnd = this.getBarrelEnd();
      const particleCount = Math.ceil(power / 30); // More particles at higher power

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

  // Call this when firing to trigger visual effects
  fire(): void {
    this.muzzleFlashTime = 0.15;
    this.recoilOffset = 8;

    // Spawn muzzle particles at barrel end
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

    // Spawn smoke ring at barrel end
    this.smokeRings.push({
      x: barrelEnd.x,
      y: barrelEnd.y,
      radius: 5,
      alpha: 0.8,
      angle: angleRad,
    });
  }

  update(deltaTime: number): void {
    // Update idle animation time
    this.idleTime += deltaTime * 2;

    // Update glow pulse
    this.glowPulse += deltaTime * 4;

    // Update damage flash
    if (this.damageFlash > 0) {
      this.damageFlash -= deltaTime;
    }

    // Update hit reaction (spring back to position)
    if (this.hitReactionTime > 0) {
      this.hitReactionTime -= deltaTime;
      // Decay the offset
      this.hitReactionX *= 0.85;
      this.hitReactionY *= 0.85;
      if (this.hitReactionTime <= 0) {
        this.hitReactionX = 0;
        this.hitReactionY = 0;
      }
    }

    // Spawn fire particles at critical health (<25%)
    if (this.isAlive && this.health < 25) {
      this.fireSpawnTimer -= deltaTime;
      if (this.fireSpawnTimer <= 0) {
        this.fireSpawnTimer = 0.05 + Math.random() * 0.05;
        // Spawn fire particle
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

    // Update fire particles
    for (const particle of this.fireParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 50 * deltaTime; // Fire rises
      particle.size *= 0.97;
      particle.life -= deltaTime;
    }
    this.fireParticles = this.fireParticles.filter(p => p.life > 0);

    // Update charge particles
    for (const particle of this.chargeParticles) {
      particle.distance -= particle.speed * deltaTime;
      particle.angle += deltaTime * 3;
      particle.life -= deltaTime;
      // Update position based on polar coordinates
      const barrelEnd = this.getBarrelEnd();
      particle.x = barrelEnd.x + Math.cos(particle.angle) * particle.distance;
      particle.y = barrelEnd.y + Math.sin(particle.angle) * particle.distance;
    }
    this.chargeParticles = this.chargeParticles.filter(p => p.life > 0 && p.distance > 0);

    // Update muzzle flash
    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= deltaTime;
    }

    // Update barrel recoil (spring back)
    if (this.recoilOffset > 0) {
      this.recoilOffset -= deltaTime * 60; // Recover over ~0.13 seconds
      if (this.recoilOffset < 0) this.recoilOffset = 0;
    }

    // Update muzzle particles
    for (const particle of this.muzzleParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 200 * deltaTime; // Gravity
      particle.size *= 0.92; // Shrink
      particle.life -= deltaTime;
    }
    this.muzzleParticles = this.muzzleParticles.filter(p => p.life > 0);

    // Update spark particles
    for (const particle of this.sparkParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 300 * deltaTime; // Strong gravity
      particle.life -= deltaTime;
    }
    this.sparkParticles = this.sparkParticles.filter(p => p.life > 0);

    // Spawn smoke when damaged (enhanced)
    if (this.isAlive && this.health < 50) {
      this.smokeTimer -= deltaTime;
      if (this.smokeTimer <= 0) {
        // Spawn rate and amount increases as health decreases
        const spawnRate = this.health < 25 ? 0.05 : 0.12;
        this.smokeTimer = spawnRate;

        // Spawn multiple smoke puffs for more dramatic effect
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

    // Update smoke particles
    for (const particle of this.smokeParticles) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy -= 8 * deltaTime; // Smoke rises faster
      particle.vx *= 0.98; // Air resistance
      particle.size += deltaTime * 10; // Expands more
      particle.life -= deltaTime;
    }

    // Remove dead particles
    this.smokeParticles = this.smokeParticles.filter(p => p.life > 0);

    // Update smoke rings
    for (const ring of this.smokeRings) {
      ring.radius += deltaTime * 60;
      ring.alpha -= deltaTime * 2;
      // Move ring in firing direction
      ring.x += Math.cos(ring.angle) * 30 * deltaTime;
      ring.y -= Math.sin(ring.angle) * 30 * deltaTime;
    }
    this.smokeRings = this.smokeRings.filter(r => r.alpha > 0);

    // Update destruction debris
    for (const debris of this.destructionDebris) {
      debris.x += debris.vx * deltaTime;
      debris.y += debris.vy * deltaTime;
      debris.vy += 200 * deltaTime; // Gravity
      debris.rotation += debris.rotationSpeed * deltaTime;
      debris.life -= deltaTime;
    }
    this.destructionDebris = this.destructionDebris.filter(d => d.life > 0);

    // Update destruction flash
    if (this.destructionFlash > 0) {
      this.destructionFlash -= deltaTime * 2;
    }

    // Handle death delay before animation starts
    if (!this.isAlive && this.deathDelayTimer > 0) {
      this.deathDelayTimer -= deltaTime;
      if (this.deathDelayTimer <= 0) {
        // Delay finished - now start the death animation
        this.deathAnimationStage = 1;
        this.deathAnimationTimer = 0.15; // Flash duration
        this.destructionFlash = 1.0; // Flash when animation starts
        this.initializeDeathEffect();
      }
    }

    // Update death animation stages based on death type
    if (this.deathAnimationStage > 0) {
      this.deathAnimationTimer -= deltaTime;
      this.updateDeathAnimation(deltaTime);
    }

    // Update death-type specific particles
    this.updateDeathParticles(deltaTime);
  }

  // Update death animation based on death type
  private updateDeathAnimation(deltaTime: number): void {
    switch (this.deathType) {
      case 'explode':
        this.updateExplodeDeath(deltaTime);
        break;
      case 'ghost':
        this.updateGhostDeath(deltaTime);
        break;
      case 'splatter':
        this.updateSplatterDeath(deltaTime);
        break;
      case 'disintegrate':
        this.updateDisintegrateDeath(deltaTime);
        break;
      case 'vaporize':
        this.updateVaporizeDeath(deltaTime);
        break;
    }
  }

  private updateExplodeDeath(deltaTime: number): void {
    if (this.deathAnimationStage === 1) {
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 2;
        this.deathAnimationTimer = 0.5;
      }
    } else if (this.deathAnimationStage === 2) {
      this.deathPopY += this.deathPopVy * deltaTime;
      this.deathPopVy += 400 * deltaTime;

      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 3;
        this.deathAnimationTimer = 0.3;

        // Spawn additional debris burst when landing
        const debrisColors = [this.color, '#1a1a1a', '#0a0a0a'];
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI - Math.PI / 2;
          const speed = 60 + Math.random() * 100;
          this.destructionDebris.push({
            x: this.x + (Math.random() - 0.5) * TANK_WIDTH,
            y: this.y - TANK_HEIGHT / 2,
            vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
            vy: -Math.abs(Math.sin(angle) * speed) - 30,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 15,
            size: 2 + Math.random() * 5,
            life: 1.0 + Math.random() * 0.5,
            color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
          });
        }
      }
    } else if (this.deathAnimationStage === 3) {
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 0;
      }
    }
  }

  private updateGhostDeath(deltaTime: number): void {
    if (this.deathAnimationStage === 1) {
      // Initial flash stage
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 2;
        this.deathAnimationTimer = 3.0; // Long slow rise
      }
    } else if (this.deathAnimationStage === 2) {
      // Ghost rises slowly and fades
      if (this.ghostParticle) {
        this.ghostParticle.y += this.ghostParticle.vy * deltaTime;
        this.ghostParticle.vy -= 5 * deltaTime; // Slowly accelerate upward
        this.ghostParticle.alpha -= deltaTime * 0.3; // Slow fade
        this.ghostParticle.wobble += deltaTime * 3; // Gentle wobble
      }

      if (this.deathAnimationTimer <= 0 || (this.ghostParticle && this.ghostParticle.alpha <= 0)) {
        this.deathAnimationStage = 3;
        this.deathAnimationTimer = 0.1;
      }
    } else if (this.deathAnimationStage === 3) {
      // Cleanup stage
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 0;
        // Clear all ghost-related particles
        this.ghostParticle = null;
        this.etherealWisps = [];
      }
    }
  }

  private updateSplatterDeath(_deltaTime: number): void {
    if (this.deathAnimationStage === 1) {
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 2;
        this.deathAnimationTimer = 0.8;
      }
    } else if (this.deathAnimationStage === 2) {
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 3;
        this.deathAnimationTimer = 2.0; // Goo stays longer
      }
    } else if (this.deathAnimationStage === 3) {
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 0;
      }
    }
  }

  private updateDisintegrateDeath(deltaTime: number): void {
    if (this.deathAnimationStage === 1) {
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 2;
        this.deathAnimationTimer = 1.5; // Slow disintegration
      }
    } else if (this.deathAnimationStage === 2) {
      // Progress the disintegration
      this.disintegrateProgress += deltaTime * 0.8;
      if (this.disintegrateProgress > 1) this.disintegrateProgress = 1;

      // Activate dust particles based on progress
      const activateCount = Math.floor(this.disintegrateProgress * this.dustParticles.length);
      for (let i = 0; i < activateCount; i++) {
        if (this.dustParticles[i].alpha < 1) {
          this.dustParticles[i].alpha = Math.min(1, this.dustParticles[i].alpha + deltaTime * 3);
        }
      }

      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 3;
        this.deathAnimationTimer = 1.0;
      }
    } else if (this.deathAnimationStage === 3) {
      // Fade out remaining dust
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 0;
      }
    }
  }

  private updateVaporizeDeath(deltaTime: number): void {
    if (this.deathAnimationStage === 1) {
      // Brief flash stage
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 2;
        this.deathAnimationTimer = 1.5; // Dissolve duration
      }
    } else if (this.deathAnimationStage === 2) {
      // Scan-line dissolve (bottom to top)
      const prevProgress = this.dissolveProgress;
      this.dissolveProgress += deltaTime * 0.7; // Speed of dissolve
      if (this.dissolveProgress > 1) this.dissolveProgress = 1;

      // Spawn glitchy particles at the dissolve line
      const antHeight = 20; // Approximate ant height in pixels
      const dissolveLineY = this.y - (this.dissolveProgress * antHeight * ANT_PIXEL_SCALE);

      // Spawn particles when progress changes significantly
      if (Math.floor(this.dissolveProgress * 20) > Math.floor(prevProgress * 20)) {
        const particleColors = ['#00FFFF', '#FFFFFF', '#88FFFF', this.color, '#AAFFFF'];
        for (let i = 0; i < 5; i++) {
          this.dissolveParticles.push({
            x: this.x + (Math.random() - 0.5) * 16,
            y: dissolveLineY + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 60,
            vy: -20 - Math.random() * 40,
            alpha: 1.0,
            color: particleColors[Math.floor(Math.random() * particleColors.length)],
          });
        }
      }

      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 3;
        this.deathAnimationTimer = 0.3;
      }
    } else if (this.deathAnimationStage === 3) {
      // Fade out remaining particles
      if (this.deathAnimationTimer <= 0) {
        this.deathAnimationStage = 0;
        this.dissolveParticles = [];
      }
    }

    // Update dissolve particles
    for (const p of this.dissolveParticles) {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vy -= 20 * deltaTime; // Float upward
      p.alpha -= deltaTime * 1.5;
    }
    this.dissolveParticles = this.dissolveParticles.filter(p => p.alpha > 0);
  }

  // Helper to get ground Y at a given X position
  private getGroundYAt(x: number): number {
    if (this.terrain) {
      const terrainHeight = this.terrain.getHeightAt(x);
      return MAP_HEIGHT - terrainHeight;
    }
    // Fallback to ant's Y position if no terrain reference
    return this.y;
  }

  // Update death-type specific particles
  private updateDeathParticles(deltaTime: number): void {
    // Update body parts (for explode death)
    for (const part of this.bodyParts) {
      part.x += part.vx * deltaTime;
      part.y += part.vy * deltaTime;
      part.vy += 350 * deltaTime; // Gravity
      part.vx *= 0.99; // Air resistance
      part.rotation += part.rotationSpeed * deltaTime;
      // Bounce on actual ground
      const groundY = this.getGroundYAt(part.x);
      if (part.y > groundY) {
        part.y = groundY;
        part.vy *= -0.4; // Bounce with energy loss
        part.vx *= 0.7;
        part.rotationSpeed *= 0.5;
      }
      part.life -= deltaTime;
    }
    this.bodyParts = this.bodyParts.filter(p => p.life > 0);

    // Update ethereal wisps (for ghost death)
    if (this.ghostParticle) {
      for (const wisp of this.etherealWisps) {
        // Orbit around ghost
        wisp.angle += wisp.speed * deltaTime;
        const orbitRadius = 25 + Math.sin(wisp.angle * 2) * 10;
        wisp.targetX = this.ghostParticle.x + Math.cos(wisp.angle) * orbitRadius;
        wisp.targetY = this.ghostParticle.y + Math.sin(wisp.angle * 0.5) * 15;
        // Smooth follow
        wisp.x += (wisp.targetX - wisp.x) * 5 * deltaTime;
        wisp.y += (wisp.targetY - wisp.y) * 5 * deltaTime;
        wisp.alpha = this.ghostParticle.alpha * 0.7;
      }
    }
    this.etherealWisps = this.etherealWisps.filter(w => w.alpha > 0.05);

    // Update goo particles (for splatter death)
    for (const goo of this.gooParticles) {
      if (!goo.stuck) {
        goo.x += goo.vx * deltaTime;
        goo.y += goo.vy * deltaTime;
        goo.vy += 500 * deltaTime; // Strong gravity
        goo.vx *= 0.98; // Air resistance

        // Check if goo hits actual ground
        const groundY = this.getGroundYAt(goo.x);
        if (goo.y > groundY) {
          goo.stuck = true;
          goo.stuckX = goo.x;
          goo.stuckY = groundY;
          // Activate a splat mark at ground level
          for (const splat of this.splatMarks) {
            if (splat.alpha === 0 && Math.abs(splat.x - goo.x) < 30) {
              splat.alpha = 0.8;
              splat.y = groundY; // Update splat Y to ground level
              break;
            }
          }
        }
      }
      goo.life -= deltaTime * 0.2;
    }
    this.gooParticles = this.gooParticles.filter(g => g.life > 0);

    // Fade splat marks slowly
    for (const splat of this.splatMarks) {
      if (splat.alpha > 0 && this.deathAnimationStage === 0) {
        splat.alpha -= deltaTime * 0.1;
      }
    }
    this.splatMarks = this.splatMarks.filter(s => s.alpha > 0);

    // Update ember particles (for disintegrate death)
    for (const ember of this.emberParticles) {
      ember.x += ember.vx * deltaTime;
      ember.y += ember.vy * deltaTime;
      ember.vy -= 30 * deltaTime; // Float up
      ember.vx += 10 * deltaTime; // Wind drift
      ember.life -= deltaTime;
      // Flicker brightness
      ember.brightness = 0.5 + Math.random() * 0.5;
    }
    this.emberParticles = this.emberParticles.filter(e => e.life > 0);

    // Update dust particles
    for (const dust of this.dustParticles) {
      if (dust.alpha > 0) {
        dust.x += dust.vx * deltaTime;
        dust.y += dust.vy * deltaTime;
        dust.vy -= 15 * deltaTime; // Float upward
        dust.vx += 8 * deltaTime; // Wind drift
        if (this.deathAnimationStage === 3) {
          dust.alpha -= deltaTime * 0.8;
        }
      }
    }
    this.dustParticles = this.dustParticles.filter(d => d.alpha > 0 || this.deathAnimationStage < 3);

    // Update lightning arcs (for vaporize death)
    for (const arc of this.lightningArcs) {
      arc.life -= deltaTime;
      arc.alpha = arc.life * 3; // Quick fade
      // Regenerate zigzag for flickering effect
      if (Math.random() > 0.5) {
        for (let i = 1; i < arc.segments.length - 1; i++) {
          const t = i / (arc.segments.length - 1);
          const baseX = arc.startX + (arc.endX - arc.startX) * t;
          const baseY = arc.startY + (arc.endY - arc.startY) * t;
          const angle = Math.atan2(arc.endY - arc.startY, arc.endX - arc.startX);
          const offset = (Math.random() - 0.5) * 25;
          arc.segments[i].x = baseX - Math.sin(angle) * offset;
          arc.segments[i].y = baseY + Math.cos(angle) * offset;
        }
      }
    }
    this.lightningArcs = this.lightningArcs.filter(a => a.life > 0);

    // Update shockwave rings
    for (const ring of this.shockwaveRings) {
      const expandSpeed = 250;
      ring.radius += expandSpeed * deltaTime;
      ring.alpha -= deltaTime * 2.0;
    }
    this.shockwaveRings = this.shockwaveRings.filter(r => r.alpha > 0 && r.radius < r.maxRadius);
  }

  getBarrelEnd(): { x: number; y: number } {
    const angleRad = (this.angle * Math.PI) / 180;
    const direction = this.facingRight ? 1 : -1;

    // Ant body positions (matching render method)
    const baseY = this.y;
    const thoraxX = this.x + direction * 8;
    const thoraxY = baseY - 22;

    // Bazooka on back shoulder (behind body)
    const bazookaStartX = thoraxX - direction * 6;
    const bazookaStartY = thoraxY;

    // Get weapon-specific barrel length (in world coords, scaled from pixel units)
    const weaponVisual = this.getWeaponVisual();
    const barrelLength = weaponVisual.length * 2; // Scale from pixel grid to world coords

    // End of weapon (muzzle)
    return {
      x: bazookaStartX + Math.cos(angleRad) * barrelLength,
      y: bazookaStartY - Math.sin(angleRad) * barrelLength,
    };
  }

  // Weapon management
  selectWeapon(weapon: WeaponType): boolean {
    const ammo = this.weaponAmmo.get(weapon);
    // Can select if unlimited ammo (-1) or has ammo remaining
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

      // Auto-switch to standard if out of ammo
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
    // Check if buff of same type already exists
    const existingIndex = this.activeBuffs.findIndex(b => b.type === buff.type);
    if (existingIndex >= 0) {
      // Stack or replace depending on type
      if (buff.type === 'shield') {
        // Stack shield HP
        this.activeBuffs[existingIndex].remainingValue += buff.remainingValue;
      } else {
        // Replace other buffs
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

  // Get damage multiplier from buffs
  getDamageMultiplier(): number {
    const damageBuff = this.activeBuffs.find(b => b.type === 'damage_boost');
    return damageBuff ? damageBuff.remainingValue : 1.0;
  }

  // Consume damage boost after firing
  consumeDamageBoost(): void {
    const damageBuff = this.activeBuffs.find(b => b.type === 'damage_boost');
    if (damageBuff && damageBuff.duration !== null) {
      damageBuff.duration--;
      if (damageBuff.duration <= 0) {
        this.removeBuff('damage_boost');
      }
    }
  }

  // Check if has double shot buff
  hasDoubleShot(): boolean {
    return this.hasBuff('double_shot');
  }

  // Consume double shot after use
  consumeDoubleShot(): void {
    const doubleShotBuff = this.activeBuffs.find(b => b.type === 'double_shot');
    if (doubleShotBuff && doubleShotBuff.duration !== null) {
      doubleShotBuff.duration--;
      if (doubleShotBuff.duration <= 0) {
        this.removeBuff('double_shot');
      }
    }
  }

  // Heal the tank
  heal(amount: number): void {
    this.health = Math.min(100, this.health + amount);
  }

  // Reset weapon and buffs for new game
  resetWeaponsAndBuffs(): void {
    this.selectedWeapon = 'standard';
    this.weaponAmmo = getDefaultAmmo();
    this.activeBuffs = [];
  }

  render(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean, chargingPower: number = 0): void {
    if (!this.isAlive) {
      // During delay period, don't render anything (hidden by explosion)
      if (this.deathDelayTimer > 0) {
        return;
      }
      this.renderDestroyed(ctx);
      return;
    }

    // Apply hit reaction offset
    ctx.save();
    if (this.hitReactionTime > 0) {
      ctx.translate(this.hitReactionX, this.hitReactionY);
    }

    // Draw smoke rings (behind everything) - rendered directly, not pixelated
    for (const ring of this.smokeRings) {
      ctx.fillStyle = `rgba(150, 150, 150, ${ring.alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw smoke particles (behind ant)
    for (const particle of this.smokeParticles) {
      const alpha = (particle.life / 1.8) * 0.6;
      const gray = 60 + Math.random() * 50;
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // === PIXEL ART ANT RENDERING ===
    // Render directly to main canvas using pixel blocks
    this.renderAntBody(ctx, isCurrentPlayer, chargingPower);

    // Draw spark particles
    for (const particle of this.sparkParticles) {
      const alpha = particle.life / 0.6;
      const brightness = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 50}, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw fire particles (critical health) - rendered directly, not pixelated
    for (const particle of this.fireParticles) {
      const lifeRatio = particle.life / particle.maxLife;
      ctx.fillStyle = `rgba(255, ${Math.floor(100 + lifeRatio * 100)}, 0, ${lifeRatio})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 200, ${lifeRatio * 0.8})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Helper to draw a single pixel block (2x2 screen pixels for ants)
  private drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x * ANT_PIXEL_SCALE, y * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
  }

  // Render the ant body as pixel art (2x2 pixels for more detail)
  private renderAntBody(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean, chargingPower: number = 0): void {
    const healthPercent = this.health / 100;
    const direction = this.facingRight ? 1 : -1;

    // Convert world position to pixel grid (2x2 scale)
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(this.y / ANT_PIXEL_SCALE);

    // Colors
    let bodyColor = '#2a2a2a';
    let bodyDark = '#1a1a1a';
    let bodyLight = '#3a3a3a';
    let helmetColor = this.color;
    let helmetLight = this.lightenColor(this.color, 50);
    let helmetDark = this.darkenColor(this.color, 30);

    if (this.damageFlash > 0) {
      bodyColor = '#fff';
      bodyDark = '#ddd';
      bodyLight = '#fff';
      helmetColor = '#fff';
      helmetLight = '#fff';
      helmetDark = '#ddd';
    } else if (healthPercent < 1) {
      const darken = Math.floor((1 - healthPercent) * 30);
      helmetColor = this.darkenColor(this.color, darken);
      helmetLight = this.darkenColor(this.lightenColor(this.color, 50), darken);
      helmetDark = this.darkenColor(this.color, darken + 30);
    }

    // Animation offset
    const breatheOffset = Math.floor(Math.sin(this.idleTime * 2) * 0.5);
    // Faster and more pronounced leg animation when walking
    const legSpeed = this.isWalking ? 16 : 4;
    const legAmplitude = this.isWalking ? 2 : 1;
    const legAnim = Math.floor(Math.sin(this.idleTime * legSpeed) * legAmplitude);

    // Weapon angle
    const angleRad = (this.angle * Math.PI) / 180;

    // === SHADOW ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect((baseX - 8) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 18 * ANT_PIXEL_SCALE, 2 * ANT_PIXEL_SCALE);

    // Shoulder position (where weapon attaches)
    const shoulderX = baseX + direction * 2;
    const shoulderY = baseY - 10 + breatheOffset;

    // === DRAW WEAPON (only for current player) ===
    if (isCurrentPlayer) {
      const weaponVisual = this.getWeaponVisual();
      const weaponLen = weaponVisual.length;

      if (this.selectedWeapon === 'shotgun') {
        // Shotgun: double barrel effect
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Two parallel barrels
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py + 1, weaponVisual.light);
          this.drawPixel(ctx, px, py + 2, weaponVisual.dark);
        }
        // Muzzle - two openings
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
        // Stock
        this.drawPixel(ctx, shoulderX - Math.round(Math.cos(angleRad) * 2), shoulderY + Math.round(Math.sin(angleRad) * 2), weaponVisual.dark);
        this.drawPixel(ctx, shoulderX - Math.round(Math.cos(angleRad) * 3), shoulderY + Math.round(Math.sin(angleRad) * 3), weaponVisual.dark);
      } else if (this.selectedWeapon === 'bazooka') {
        // Heavy bazooka: thicker tube with scope
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Thicker tube (3 pixels)
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py + 1, weaponVisual.color);
          this.drawPixel(ctx, px, py + 2, weaponVisual.dark);
        }
        // Wider muzzle
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 2, '#1a1a1a');
        // Scope detail at mid-barrel
        const scopeX = shoulderX + Math.round(Math.cos(angleRad) * (weaponLen / 2));
        const scopeY = shoulderY - Math.round(Math.sin(angleRad) * (weaponLen / 2));
        this.drawPixel(ctx, scopeX, scopeY - 2, '#333');
        this.drawPixel(ctx, scopeX, scopeY - 3, '#444');
      } else if (this.selectedWeapon === 'sniper') {
        // Sniper: long thin barrel with scope
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Thin barrel
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
        }
        // Muzzle
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY, '#1a1a1a');
        // Scope at 1/3 of barrel
        const scopeX = shoulderX + Math.round(Math.cos(angleRad) * (weaponLen / 3));
        const scopeY = shoulderY - Math.round(Math.sin(angleRad) * (weaponLen / 3));
        this.drawPixel(ctx, scopeX, scopeY - 2, '#222');
        this.drawPixel(ctx, scopeX, scopeY - 3, '#333');
        this.drawPixel(ctx, scopeX + 1, scopeY - 2, '#222');
        this.drawPixel(ctx, scopeX + 1, scopeY - 3, '#444');
        // Stock
        this.drawPixel(ctx, shoulderX - Math.round(Math.cos(angleRad) * 2), shoulderY + Math.round(Math.sin(angleRad) * 2), weaponVisual.dark);
      } else {
        // Standard: normal tube
        for (let i = 0; i < weaponLen; i++) {
          const px = shoulderX + Math.round(Math.cos(angleRad) * i);
          const py = shoulderY - Math.round(Math.sin(angleRad) * i);
          // Main tube
          this.drawPixel(ctx, px, py, weaponVisual.color);
          this.drawPixel(ctx, px, py - 1, weaponVisual.light);
          this.drawPixel(ctx, px, py + 1, weaponVisual.dark);
        }
        // Muzzle opening
        const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
        const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
        this.drawPixel(ctx, muzzleX, muzzleY, weaponVisual.dark);
        this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
        this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
      }
    }

    // === BACK LEGS (6 legs total for ant, showing 4) ===
    // Rear pair
    this.drawPixel(ctx, baseX - direction * 6, baseY - 2, bodyDark);
    this.drawPixel(ctx, baseX - direction * 7 - legAnim, baseY - 1, bodyDark);
    this.drawPixel(ctx, baseX - direction * 8 - legAnim, baseY, bodyDark);
    // Second rear
    this.drawPixel(ctx, baseX - direction * 4, baseY - 3, bodyDark);
    this.drawPixel(ctx, baseX - direction * 5 + legAnim, baseY - 2, bodyDark);
    this.drawPixel(ctx, baseX - direction * 6 + legAnim, baseY - 1, bodyDark);
    this.drawPixel(ctx, baseX - direction * 6 + legAnim, baseY, bodyDark);

    // === ABDOMEN (large oval back segment) ===
    // Top row
    this.drawPixel(ctx, baseX - direction * 4, baseY - 6 + breatheOffset, bodyLight);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 6 + breatheOffset, bodyLight);
    // Upper middle
    this.drawPixel(ctx, baseX - direction * 3, baseY - 5 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 4, baseY - 5 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 5 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 6, baseY - 5 + breatheOffset, bodyDark);
    // Lower middle
    this.drawPixel(ctx, baseX - direction * 3, baseY - 4 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 4, baseY - 4 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 4 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX - direction * 6, baseY - 4 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - direction * 7, baseY - 4 + breatheOffset, bodyDark);
    // Bottom
    this.drawPixel(ctx, baseX - direction * 4, baseY - 3 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - direction * 5, baseY - 3 + breatheOffset, bodyDark);

    // === PETIOLE (thin waist) ===
    this.drawPixel(ctx, baseX - direction * 1, baseY - 5 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - direction * 2, baseY - 5 + breatheOffset, bodyDark);

    // === THORAX (middle segment) ===
    this.drawPixel(ctx, baseX, baseY - 7 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 1, baseY - 7 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX, baseY - 6 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 1, baseY - 6 + breatheOffset, bodyLight);
    this.drawPixel(ctx, baseX + direction * 2, baseY - 7 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 2, baseY - 8 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 3, baseY - 9 + breatheOffset, bodyDark);

    // === FRONT/MIDDLE LEGS ===
    // Middle pair
    this.drawPixel(ctx, baseX, baseY - 5 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX - legAnim, baseY - 4, bodyDark);
    this.drawPixel(ctx, baseX - legAnim, baseY - 3, bodyDark);
    this.drawPixel(ctx, baseX - legAnim - 1, baseY - 2, bodyDark);
    // Front pair
    this.drawPixel(ctx, baseX + direction * 2, baseY - 6, bodyDark);
    this.drawPixel(ctx, baseX + direction * 2 + legAnim, baseY - 5, bodyDark);
    this.drawPixel(ctx, baseX + direction * 2 + legAnim, baseY - 4, bodyDark);
    this.drawPixel(ctx, baseX + direction * 3 + legAnim, baseY - 3, bodyDark);

    // === NECK ===
    this.drawPixel(ctx, baseX + direction * 4, baseY - 10 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 5, baseY - 11 + breatheOffset, bodyDark);

    // === HEAD (round) ===
    // Top
    this.drawPixel(ctx, baseX + direction * 6, baseY - 15 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 15 + breatheOffset, bodyColor);
    // Upper
    this.drawPixel(ctx, baseX + direction * 5, baseY - 14 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 14 + breatheOffset, bodyLight);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 14 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 14 + breatheOffset, bodyDark);
    // Middle
    this.drawPixel(ctx, baseX + direction * 5, baseY - 13 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 13 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 13 + breatheOffset, bodyColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 13 + breatheOffset, bodyDark);
    // Lower
    this.drawPixel(ctx, baseX + direction * 6, baseY - 12 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 12 + breatheOffset, bodyDark);

    // === HELMET (team color, military style on top of head) ===
    // Helmet top
    this.drawPixel(ctx, baseX + direction * 5, baseY - 17 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 17 + breatheOffset, helmetLight);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 17 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 17 + breatheOffset, helmetColor);
    // Helmet middle
    this.drawPixel(ctx, baseX + direction * 4, baseY - 16 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 5, baseY - 16 + breatheOffset, helmetLight);
    this.drawPixel(ctx, baseX + direction * 6, baseY - 16 + breatheOffset, helmetLight);
    this.drawPixel(ctx, baseX + direction * 7, baseY - 16 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 8, baseY - 16 + breatheOffset, helmetColor);
    this.drawPixel(ctx, baseX + direction * 9, baseY - 16 + breatheOffset, helmetDark);
    // Helmet brim
    this.drawPixel(ctx, baseX + direction * 4, baseY - 15 + breatheOffset, helmetDark);
    this.drawPixel(ctx, baseX + direction * 9, baseY - 15 + breatheOffset, helmetDark);
    this.drawPixel(ctx, baseX + direction * 10, baseY - 15 + breatheOffset, helmetDark);

    // === EYE (large cartoon eye) ===
    // Eye white
    this.drawPixel(ctx, baseX + direction * 8, baseY - 14 + breatheOffset, '#fff');
    this.drawPixel(ctx, baseX + direction * 9, baseY - 14 + breatheOffset, '#fff');
    this.drawPixel(ctx, baseX + direction * 9, baseY - 13 + breatheOffset, '#fff');
    // Pupil
    this.drawPixel(ctx, baseX + direction * 9, baseY - 14 + breatheOffset, '#111');

    // === ANTENNAE ===
    const antennaWave = Math.floor(Math.sin(this.idleTime * 4) * 1);
    // Left antenna
    this.drawPixel(ctx, baseX + direction * 5 + antennaWave, baseY - 18 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 4 + antennaWave, baseY - 19 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 4 + antennaWave, baseY - 20 + breatheOffset, bodyColor);
    // Right antenna
    this.drawPixel(ctx, baseX + direction * 7 - antennaWave, baseY - 18 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 8 - antennaWave, baseY - 19 + breatheOffset, bodyDark);
    this.drawPixel(ctx, baseX + direction * 8 - antennaWave, baseY - 20 + breatheOffset, bodyColor);

    // === ARM holding weapon and TARGETING CURSOR (only for current player) ===
    if (isCurrentPlayer) {
      const weaponVisual = this.getWeaponVisual();
      const armX = shoulderX + Math.round(Math.cos(angleRad) * 4);
      const armY = shoulderY - Math.round(Math.sin(angleRad) * 4) + 1;
      this.drawPixel(ctx, armX, armY, bodyDark);
      this.drawPixel(ctx, armX, armY + 1, bodyDark);

      // === TARGETING CURSOR ===
      this.renderTargetingCursor(ctx, shoulderX, shoulderY, angleRad, weaponVisual.length, chargingPower);
    }

    // === CURRENT PLAYER INDICATOR (arrow pointing down) ===
    if (isCurrentPlayer) {
      const bounce = Math.floor(Math.sin(this.idleTime * 3) * 2);
      // Arrow shape
      this.drawPixel(ctx, baseX + direction * 6, baseY - 24 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 7, baseY - 24 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 5, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 6, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 7, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 8, baseY - 25 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 6, baseY - 26 + bounce, '#fff');
      this.drawPixel(ctx, baseX + direction * 7, baseY - 26 + bounce, '#fff');
    }

    // === HEALTH BAR ===
    const healthBarY = baseY - 22 + breatheOffset;
    const healthPixels = Math.ceil(healthPercent * 12);
    const healthColor = healthPercent > 0.5 ? '#4ECB71' : healthPercent > 0.25 ? '#FFD93D' : '#FF6B6B';

    // Background
    for (let i = 0; i < 12; i++) {
      this.drawPixel(ctx, baseX + direction * i, healthBarY, '#333');
    }
    // Health fill
    for (let i = 0; i < healthPixels; i++) {
      this.drawPixel(ctx, baseX + direction * i, healthBarY, healthColor);
    }
  }

  // Render targeting cursor with aiming line, crosshair, and power indicator
  private renderTargetingCursor(
    ctx: CanvasRenderingContext2D,
    shoulderX: number,
    shoulderY: number,
    angleRad: number,
    bazookaLen: number,
    chargingPower: number = 0
  ): void {
    // Convert from pixel grid back to world coordinates
    // Note: angle already encodes direction (0=right, 90=up, 180=left)
    const muzzleWorldX = (shoulderX + Math.cos(angleRad) * bazookaLen) * ANT_PIXEL_SCALE;
    const muzzleWorldY = (shoulderY - Math.sin(angleRad) * bazookaLen) * ANT_PIXEL_SCALE;

    // Aiming line parameters
    const lineLength = 80; // Length of the aiming line
    const crosshairSize = 8;
    const dashLength = 6;
    const gapLength = 4;

    // Calculate end point of aiming line
    const endX = muzzleWorldX + Math.cos(angleRad) * lineLength;
    const endY = muzzleWorldY - Math.sin(angleRad) * lineLength;

    // Pulsing effect
    const pulse = 0.6 + Math.sin(this.idleTime * 4) * 0.2;

    ctx.save();

    // === POWER INDICATOR (grows along the line when charging) ===
    if (chargingPower > 0) {
      const powerRatio = chargingPower / 100;
      const powerLength = lineLength * powerRatio;
      const powerEndX = muzzleWorldX + Math.cos(angleRad) * powerLength;
      const powerEndY = muzzleWorldY - Math.sin(angleRad) * powerLength;

      // Power color: green -> yellow -> red as power increases
      let powerColor: string;
      if (powerRatio < 0.4) {
        powerColor = `rgba(78, 203, 113, ${0.8 + pulse * 0.2})`; // Green
      } else if (powerRatio < 0.7) {
        powerColor = `rgba(255, 217, 61, ${0.8 + pulse * 0.2})`; // Yellow
      } else {
        powerColor = `rgba(255, 107, 107, ${0.8 + pulse * 0.2})`; // Red
      }

      // Draw power fill line (thicker, solid)
      ctx.strokeStyle = powerColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(muzzleWorldX, muzzleWorldY);
      ctx.lineTo(powerEndX, powerEndY);
      ctx.stroke();

      // Glow effect for power line
      ctx.strokeStyle = powerColor.replace(/[\d.]+\)$/, '0.3)');
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(muzzleWorldX, muzzleWorldY);
      ctx.lineTo(powerEndX, powerEndY);
      ctx.stroke();

      // Power percentage text near the power line end
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      const textOffsetX = -Math.sin(angleRad) * 15;
      const textOffsetY = Math.cos(angleRad) * 15;
      ctx.fillText(`${Math.round(chargingPower)}%`, powerEndX + textOffsetX, powerEndY + textOffsetY);
    }

    // === DASHED AIMING LINE ===
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.setLineDash([dashLength, gapLength]);
    ctx.lineDashOffset = -this.idleTime * 20; // Animated dash

    ctx.beginPath();
    ctx.moveTo(muzzleWorldX, muzzleWorldY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

    // === CROSSHAIR at end of line ===
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.lineWidth = 2;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(endX - crosshairSize, endY);
    ctx.lineTo(endX + crosshairSize, endY);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(endX, endY - crosshairSize);
    ctx.lineTo(endX, endY + crosshairSize);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = `rgba(255, 100, 100, ${pulse})`;
    ctx.beginPath();
    ctx.arc(endX, endY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Outer circle
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(endX, endY, crosshairSize + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderDestroyed(ctx: CanvasRenderingContext2D): void {
    // Destruction flash (common to most death types)
    if (this.destructionFlash > 0) {
      const flashRadius = this.deathType === 'vaporize' ? 120 : (this.deathType === 'splatter' ? 80 : 60);
      const flashGradient = ctx.createRadialGradient(
        this.x, this.y - 20, 0,
        this.x, this.y - 20, flashRadius
      );
      const flashAlpha = Math.min(1, this.destructionFlash);
      if (this.deathType === 'vaporize') {
        // Electric blue/white flash for vaporize
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGradient.addColorStop(0.2, `rgba(200, 230, 255, ${flashAlpha * 0.9})`);
        flashGradient.addColorStop(0.5, `rgba(100, 180, 255, ${flashAlpha * 0.5})`);
        flashGradient.addColorStop(1, 'rgba(50, 100, 200, 0)');
      } else if (this.deathType === 'splatter') {
        // Green tint for splatter
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGradient.addColorStop(0.3, `rgba(200, 255, 150, ${flashAlpha * 0.7})`);
        flashGradient.addColorStop(0.6, `rgba(100, 200, 50, ${flashAlpha * 0.3})`);
        flashGradient.addColorStop(1, 'rgba(50, 100, 0, 0)');
      } else {
        // Standard orange/red flash
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
        flashGradient.addColorStop(0.2, `rgba(255, 255, 200, ${flashAlpha * 0.8})`);
        flashGradient.addColorStop(0.5, `rgba(255, 150, 50, ${flashAlpha * 0.4})`);
        flashGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      }
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 20, flashRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw destruction debris as smoke puffs (for explode)
    for (const debris of this.destructionDebris) {
      const alpha = Math.min(1, debris.life) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = debris.color;
      ctx.beginPath();
      ctx.arc(debris.x, debris.y, debris.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Render death-type specific effects
    switch (this.deathType) {
      case 'explode':
        this.renderExplodeDeath(ctx);
        break;
      case 'ghost':
        this.renderGhostDeath(ctx);
        break;
      case 'splatter':
        this.renderSplatterDeath(ctx);
        break;
      case 'disintegrate':
        this.renderDisintegrateDeath(ctx);
        break;
      case 'vaporize':
        this.renderVaporizeDeath(ctx);
        break;
    }
  }

  // Render explode death - flying pixelated body parts
  private renderExplodeDeath(ctx: CanvasRenderingContext2D): void {
    const ps = ANT_PIXEL_SCALE; // Pixel scale

    // Draw each body part as pixels
    for (const part of this.bodyParts) {
      ctx.save();
      ctx.translate(part.x, part.y);
      ctx.rotate(part.rotation);
      ctx.globalAlpha = Math.min(1, part.life / 0.5);

      const dark = this.darkenColor(part.color, 30);
      const light = this.lightenColor(part.color, 30);

      switch (part.type) {
        case 'helmet':
          // Pixelated helmet (5x3 pixels)
          ctx.fillStyle = part.color;
          ctx.fillRect(-2 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillStyle = light;
          ctx.fillRect(-1 * ps, -2 * ps, ps, ps);
          ctx.fillRect(0, -2 * ps, ps, ps);
          ctx.fillStyle = dark;
          ctx.fillRect(2 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-2 * ps, 0, ps, ps);
          ctx.fillRect(2 * ps, 0, ps, ps);
          break;
        case 'head':
          // Pixelated head (3x3 pixels with X eye)
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(0, -2 * ps, ps, ps);
          // X eye
          ctx.fillStyle = '#fff';
          ctx.fillRect(1 * ps, 0, ps, ps);
          break;
        case 'thorax':
          // Pixelated thorax (3x2 pixels)
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          break;
        case 'abdomen':
          // Pixelated abdomen (4x3 pixels)
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(-1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, -1 * ps, ps, ps);
          ctx.fillRect(-2 * ps, 0, ps, ps);
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(-1 * ps, -2 * ps, ps, ps);
          ctx.fillRect(0, -2 * ps, ps, ps);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-1 * ps, 1 * ps, ps, ps);
          ctx.fillRect(0, 1 * ps, ps, ps);
          break;
        case 'leg':
          // Pixelated leg (3 pixels diagonal)
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-1 * ps, 0, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillRect(1 * ps, 0, ps, ps);
          break;
        case 'antenna':
          // Pixelated antenna (3 pixels)
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(0, 0, ps, ps);
          ctx.fillRect(0, -1 * ps, ps, ps);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(1 * ps, -2 * ps, ps, ps);
          break;
      }
      ctx.restore();
    }

    // Render remaining body on ground after parts settle
    if (this.deathAnimationStage >= 3 || this.bodyParts.length === 0) {
      this.renderDeadAntBody(ctx);
    }
  }

  // Render ghost death effect - ghost looks like the ant but transparent white
  private renderGhostDeath(ctx: CanvasRenderingContext2D): void {
    // Render the collapsed body on the ground
    if (this.deathAnimationStage >= 2) {
      this.renderCollapsedBody(ctx);
    }

    // Render the ghost (ant-shaped, rising up and fading)
    if (this.ghostParticle && this.ghostParticle.alpha > 0.01) {
      ctx.save();

      const ghostAlpha = this.ghostParticle.alpha;
      const gx = this.ghostParticle.x;
      const gy = this.ghostParticle.y;
      const wobbleX = Math.sin(this.ghostParticle.wobble) * 2;

      // Convert to pixel grid
      const baseX = Math.floor(gx / ANT_PIXEL_SCALE) + Math.floor(wobbleX);
      const baseY = Math.floor(gy / ANT_PIXEL_SCALE);
      const direction = this.facingRight ? 1 : -1;

      // Ghost colors - transparent white/light blue
      const ghostLight = `rgba(255, 255, 255, ${ghostAlpha * 0.9})`;
      const ghostMid = `rgba(220, 240, 255, ${ghostAlpha * 0.7})`;
      const ghostDark = `rgba(200, 220, 255, ${ghostAlpha * 0.5})`;

      // Outer glow around the ghost
      ctx.globalAlpha = ghostAlpha * 0.3;
      const glowGradient = ctx.createRadialGradient(gx, gy - 10, 0, gx, gy - 10, 40);
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      glowGradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.2)');
      glowGradient.addColorStop(1, 'rgba(150, 200, 255, 0)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(gx, gy - 10, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;

      // === GLOWING HALO above head ===
      const haloY = baseY - 22;
      const haloX = baseX + direction * 6;

      // Halo outer glow
      ctx.fillStyle = `rgba(255, 255, 200, ${ghostAlpha * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(haloX * ANT_PIXEL_SCALE, haloY * ANT_PIXEL_SCALE, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Halo ring
      ctx.strokeStyle = `rgba(255, 255, 220, ${ghostAlpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(haloX * ANT_PIXEL_SCALE, haloY * ANT_PIXEL_SCALE, 12, 4, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Halo bright center line
      ctx.strokeStyle = `rgba(255, 255, 255, ${ghostAlpha * 0.9})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(haloX * ANT_PIXEL_SCALE, haloY * ANT_PIXEL_SCALE, 10, 3, 0, 0, Math.PI * 2);
      ctx.stroke();

      // === RENDER ANT SHAPE AS GHOST ===
      // Helper to draw ghost pixel
      const drawGhostPixel = (px: number, py: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(px * ANT_PIXEL_SCALE, py * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
      };

      // === BACK LEGS ===
      drawGhostPixel(baseX - direction * 6, baseY - 2, ghostDark);
      drawGhostPixel(baseX - direction * 7, baseY - 1, ghostDark);
      drawGhostPixel(baseX - direction * 8, baseY, ghostDark);
      drawGhostPixel(baseX - direction * 4, baseY - 3, ghostDark);
      drawGhostPixel(baseX - direction * 5, baseY - 2, ghostDark);
      drawGhostPixel(baseX - direction * 6, baseY - 1, ghostDark);

      // === ABDOMEN ===
      drawGhostPixel(baseX - direction * 4, baseY - 6, ghostLight);
      drawGhostPixel(baseX - direction * 5, baseY - 6, ghostLight);
      drawGhostPixel(baseX - direction * 3, baseY - 5, ghostMid);
      drawGhostPixel(baseX - direction * 4, baseY - 5, ghostMid);
      drawGhostPixel(baseX - direction * 5, baseY - 5, ghostMid);
      drawGhostPixel(baseX - direction * 6, baseY - 5, ghostDark);
      drawGhostPixel(baseX - direction * 3, baseY - 4, ghostMid);
      drawGhostPixel(baseX - direction * 4, baseY - 4, ghostMid);
      drawGhostPixel(baseX - direction * 5, baseY - 4, ghostMid);
      drawGhostPixel(baseX - direction * 6, baseY - 4, ghostDark);
      drawGhostPixel(baseX - direction * 7, baseY - 4, ghostDark);
      drawGhostPixel(baseX - direction * 4, baseY - 3, ghostDark);
      drawGhostPixel(baseX - direction * 5, baseY - 3, ghostDark);

      // === PETIOLE ===
      drawGhostPixel(baseX - direction * 1, baseY - 5, ghostDark);
      drawGhostPixel(baseX - direction * 2, baseY - 5, ghostDark);

      // === THORAX ===
      drawGhostPixel(baseX, baseY - 7, ghostMid);
      drawGhostPixel(baseX + direction * 1, baseY - 7, ghostMid);
      drawGhostPixel(baseX, baseY - 6, ghostMid);
      drawGhostPixel(baseX + direction * 1, baseY - 6, ghostLight);
      drawGhostPixel(baseX + direction * 2, baseY - 7, ghostMid);
      drawGhostPixel(baseX + direction * 2, baseY - 8, ghostMid);
      drawGhostPixel(baseX + direction * 3, baseY - 9, ghostDark);

      // === FRONT/MIDDLE LEGS ===
      drawGhostPixel(baseX, baseY - 5, ghostDark);
      drawGhostPixel(baseX, baseY - 4, ghostDark);
      drawGhostPixel(baseX, baseY - 3, ghostDark);
      drawGhostPixel(baseX - 1, baseY - 2, ghostDark);
      drawGhostPixel(baseX + direction * 2, baseY - 6, ghostDark);
      drawGhostPixel(baseX + direction * 2, baseY - 5, ghostDark);
      drawGhostPixel(baseX + direction * 2, baseY - 4, ghostDark);
      drawGhostPixel(baseX + direction * 3, baseY - 3, ghostDark);

      // === NECK ===
      drawGhostPixel(baseX + direction * 4, baseY - 10, ghostDark);
      drawGhostPixel(baseX + direction * 5, baseY - 11, ghostDark);

      // === HEAD ===
      drawGhostPixel(baseX + direction * 6, baseY - 15, ghostMid);
      drawGhostPixel(baseX + direction * 7, baseY - 15, ghostMid);
      drawGhostPixel(baseX + direction * 5, baseY - 14, ghostMid);
      drawGhostPixel(baseX + direction * 6, baseY - 14, ghostLight);
      drawGhostPixel(baseX + direction * 7, baseY - 14, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 14, ghostDark);
      drawGhostPixel(baseX + direction * 5, baseY - 13, ghostMid);
      drawGhostPixel(baseX + direction * 6, baseY - 13, ghostMid);
      drawGhostPixel(baseX + direction * 7, baseY - 13, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 13, ghostDark);
      drawGhostPixel(baseX + direction * 6, baseY - 12, ghostDark);
      drawGhostPixel(baseX + direction * 7, baseY - 12, ghostDark);

      // === HELMET (lighter, more ethereal) ===
      drawGhostPixel(baseX + direction * 5, baseY - 17, ghostMid);
      drawGhostPixel(baseX + direction * 6, baseY - 17, ghostLight);
      drawGhostPixel(baseX + direction * 7, baseY - 17, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 17, ghostMid);
      drawGhostPixel(baseX + direction * 4, baseY - 16, ghostMid);
      drawGhostPixel(baseX + direction * 5, baseY - 16, ghostLight);
      drawGhostPixel(baseX + direction * 6, baseY - 16, ghostLight);
      drawGhostPixel(baseX + direction * 7, baseY - 16, ghostMid);
      drawGhostPixel(baseX + direction * 8, baseY - 16, ghostMid);
      drawGhostPixel(baseX + direction * 9, baseY - 16, ghostDark);
      drawGhostPixel(baseX + direction * 4, baseY - 15, ghostDark);
      drawGhostPixel(baseX + direction * 9, baseY - 15, ghostDark);
      drawGhostPixel(baseX + direction * 10, baseY - 15, ghostDark);

      // === EYES (closed/peaceful - just a line) ===
      ctx.strokeStyle = `rgba(150, 180, 220, ${ghostAlpha * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((baseX + direction * 8) * ANT_PIXEL_SCALE, (baseY - 13.5) * ANT_PIXEL_SCALE);
      ctx.lineTo((baseX + direction * 10) * ANT_PIXEL_SCALE, (baseY - 13.5) * ANT_PIXEL_SCALE);
      ctx.stroke();

      // === ANTENNAE ===
      drawGhostPixel(baseX + direction * 5, baseY - 18, ghostDark);
      drawGhostPixel(baseX + direction * 4, baseY - 19, ghostDark);
      drawGhostPixel(baseX + direction * 4, baseY - 20, ghostMid);
      drawGhostPixel(baseX + direction * 7, baseY - 18, ghostDark);
      drawGhostPixel(baseX + direction * 8, baseY - 19, ghostDark);
      drawGhostPixel(baseX + direction * 8, baseY - 20, ghostMid);

      ctx.restore();
    }
  }

  // Render splatter death effect
  private renderSplatterDeath(ctx: CanvasRenderingContext2D): void {
    // Render splat marks on ground first (behind goo) - pixelated puddles
    for (const splat of this.splatMarks) {
      if (splat.alpha > 0) {
        ctx.globalAlpha = splat.alpha;
        const splatBaseX = Math.floor(splat.x / ANT_PIXEL_SCALE);
        const splatBaseY = Math.floor(splat.y / ANT_PIXEL_SCALE);
        const pixelCount = Math.floor(splat.size); // size is already in pixels

        // Main splat - scattered pixels (small puddle)
        for (let i = -pixelCount; i <= pixelCount; i++) {
          this.drawPixel(ctx, splatBaseX + i, splatBaseY, splat.color);
        }
        // Darker center
        if (pixelCount > 1) {
          this.drawPixel(ctx, splatBaseX, splatBaseY, this.darkenColor(splat.color, 20));
        }
      }
    }
    ctx.globalAlpha = 1;

    // Don't render ant body after initial flash - it's splattered!
    if (this.deathAnimationStage === 1) {
      // Expanding body during pop
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.translate(this.x, this.y - TANK_HEIGHT / 2);
      const popScale = 1 + (0.15 - this.deathAnimationTimer) * 3;
      ctx.scale(popScale, popScale);
      ctx.translate(-this.x, -(this.y - TANK_HEIGHT / 2));
      this.renderDeadAntBody(ctx);
      ctx.restore();
    }

    // Render flying goo particles - pixelated
    for (const goo of this.gooParticles) {
      const alpha = Math.min(1, goo.life / 2);
      const gooBaseX = Math.floor(goo.x / ANT_PIXEL_SCALE);
      const gooBaseY = Math.floor(goo.y / ANT_PIXEL_SCALE);
      const gooPixelSize = Math.max(1, Math.floor(goo.size)); // size is already in pixels

      if (goo.stuck) {
        // Stuck goo - small pixelated puddle (1-2 pixels wide)
        ctx.globalAlpha = alpha;
        const stuckBaseX = Math.floor(goo.stuckX / ANT_PIXEL_SCALE);
        const stuckBaseY = Math.floor(goo.stuckY / ANT_PIXEL_SCALE);
        this.drawPixel(ctx, stuckBaseX, stuckBaseY, goo.color);
        if (gooPixelSize > 1) {
          this.drawPixel(ctx, stuckBaseX + 1, stuckBaseY, goo.color);
        }
      } else {
        // Flying goo - pixelated blob (1-2 pixels)
        ctx.globalAlpha = alpha;
        this.drawPixel(ctx, gooBaseX, gooBaseY, goo.color);
        if (gooPixelSize > 1) {
          this.drawPixel(ctx, gooBaseX + 1, gooBaseY, goo.color);
          this.drawPixel(ctx, gooBaseX, gooBaseY + 1, this.darkenColor(goo.color, 15));
        }

        // Trail pixel based on velocity
        const speed = Math.sqrt(goo.vx * goo.vx + goo.vy * goo.vy);
        if (speed > 100) {
          const angle = Math.atan2(goo.vy, goo.vx);
          ctx.globalAlpha = alpha * 0.5;
          const tx = gooBaseX - Math.round(Math.cos(angle));
          const ty = gooBaseY - Math.round(Math.sin(angle));
          this.drawPixel(ctx, tx, ty, this.darkenColor(goo.color, 30));
        }
      }
    }
    ctx.globalAlpha = 1;

    // Render helmet body part flying - pixelated
    for (const part of this.bodyParts) {
      if (part.type === 'helmet') {
        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rotation);
        ctx.globalAlpha = Math.min(1, part.life / 0.5);
        // Small pixelated helmet (3x2 pixels)
        ctx.fillStyle = part.color;
        ctx.fillRect(-1 * ANT_PIXEL_SCALE, -1 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.fillRect(0, -1 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.fillRect(1 * ANT_PIXEL_SCALE, -1 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.fillStyle = this.lightenColor(part.color, 30);
        ctx.fillRect(0, -2 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
        ctx.restore();
      }
    }
  }

  // Render disintegrate death effect
  private renderDisintegrateDeath(ctx: CanvasRenderingContext2D): void {
    const groundY = this.getGroundYAt(this.x);
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(groundY / ANT_PIXEL_SCALE);

    // Render ember particles (behind body) - pixelated glowing embers
    for (const ember of this.emberParticles) {
      const lifeRatio = ember.life / ember.maxLife;
      const emberBaseX = Math.floor(ember.x / ANT_PIXEL_SCALE);
      const emberBaseY = Math.floor(ember.y / ANT_PIXEL_SCALE);

      // Glowing ember - outer glow pixels (dimmer)
      ctx.globalAlpha = lifeRatio * ember.brightness * 0.4;
      this.drawPixel(ctx, emberBaseX - 1, emberBaseY, '#FF6414');
      this.drawPixel(ctx, emberBaseX + 1, emberBaseY, '#FF6414');
      this.drawPixel(ctx, emberBaseX, emberBaseY - 1, '#FF6414');
      this.drawPixel(ctx, emberBaseX, emberBaseY + 1, '#FF6414');

      // Bright core pixel
      ctx.globalAlpha = lifeRatio * ember.brightness;
      this.drawPixel(ctx, emberBaseX, emberBaseY, '#FFEE88');
    }
    ctx.globalAlpha = 1;

    // Render partially disintegrated body based on progress
    if (this.disintegrateProgress < 1) {
      ctx.save();

      // Create a clipping region for the non-disintegrated part
      // Disintegrate from bottom-up
      const remainingHeight = TANK_HEIGHT * (1 - this.disintegrateProgress);
      const clipY = this.y - TANK_HEIGHT;

      ctx.beginPath();
      ctx.rect(this.x - TANK_WIDTH, clipY, TANK_WIDTH * 2, remainingHeight);
      ctx.clip();

      // Render body with edge glow effect - pixelated edge
      const edgeGlow = this.disintegrateProgress > 0.2;
      if (edgeGlow) {
        const edgePixelY = Math.floor((clipY + remainingHeight) / ANT_PIXEL_SCALE);
        ctx.globalAlpha = 0.6;
        // Orange glow pixels at edge
        for (let px = -4; px <= 4; px++) {
          this.drawPixel(ctx, baseX + px, edgePixelY, '#FF9632');
        }
      }

      // Render body with flickering effect
      const flicker = Math.random() > 0.05 ? 1 : 0.3;
      ctx.globalAlpha = flicker;
      this.renderDeadAntBody(ctx);

      ctx.restore();
    }

    // Render dust/ash particles - pixelated
    for (const dust of this.dustParticles) {
      if (dust.alpha > 0) {
        ctx.globalAlpha = dust.alpha * 0.8;
        const dustBaseX = Math.floor(dust.x / ANT_PIXEL_SCALE);
        const dustBaseY = Math.floor(dust.y / ANT_PIXEL_SCALE);
        this.drawPixel(ctx, dustBaseX, dustBaseY, dust.color);
      }
    }
    ctx.globalAlpha = 1;

    // Render ash pile after full disintegration - pixelated (small pile)
    if (this.disintegrateProgress >= 1) {
      const ashColor = '#282828';
      const ashLight = '#464646';
      // Small ash pile (5 pixels wide)
      for (let px = -2; px <= 2; px++) {
        this.drawPixel(ctx, baseX + px, baseY, ashColor);
      }
      // Lighter center
      this.drawPixel(ctx, baseX - 1, baseY, ashLight);
      this.drawPixel(ctx, baseX, baseY, ashLight);

      // Helmet remains (small)
      this.drawPixel(ctx, baseX + 2, baseY - 1, this.darkenColor(this.color, 30));
      this.drawPixel(ctx, baseX + 3, baseY, this.darkenColor(this.color, 40));

      // Small ember still glowing
      if (Math.random() > 0.7) {
        ctx.globalAlpha = 0.6;
        const emberOffsetX = Math.floor((Math.random() - 0.5) * 3);
        this.drawPixel(ctx, baseX + emberOffsetX, baseY - 1, '#FF9632');
        ctx.globalAlpha = 1;
      }
    }
  }

  // Render vaporize death effect - scan-line dissolve
  private renderVaporizeDeath(ctx: CanvasRenderingContext2D): void {
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(this.y / ANT_PIXEL_SCALE);
    const groundY = this.getGroundYAt(this.x);
    const groundBaseY = Math.floor(groundY / ANT_PIXEL_SCALE);

    // Render dissolve particles (glitchy pixels floating away)
    for (const p of this.dissolveParticles) {
      ctx.globalAlpha = p.alpha;
      const px = Math.floor(p.x / ANT_PIXEL_SCALE);
      const py = Math.floor(p.y / ANT_PIXEL_SCALE);
      this.drawPixel(ctx, px, py, p.color);
      // Add glitch offset pixels randomly
      if (Math.random() > 0.7) {
        ctx.globalAlpha = p.alpha * 0.5;
        this.drawPixel(ctx, px + (Math.random() > 0.5 ? 1 : -1), py, p.color);
      }
    }
    ctx.globalAlpha = 1;

    if (this.deathAnimationStage === 1) {
      // Brief cyan flash over the ant
      ctx.globalAlpha = 0.8;
      this.renderAntWithTint(ctx, '#00FFFF');
      ctx.globalAlpha = 1;
    } else if (this.deathAnimationStage === 2) {
      // Scan-line dissolve effect - render ant with clipping
      const antHeight = 20; // Approximate ant height in pixel units
      const dissolveLinePixelY = baseY - Math.floor(this.dissolveProgress * antHeight);

      ctx.save();
      // Clip to only show the part above the dissolve line (not yet dissolved)
      ctx.beginPath();
      ctx.rect(
        (baseX - 15) * ANT_PIXEL_SCALE,
        (baseY - antHeight - 5) * ANT_PIXEL_SCALE,
        30 * ANT_PIXEL_SCALE,
        (baseY - dissolveLinePixelY + 5) * ANT_PIXEL_SCALE
      );
      ctx.clip();

      // Render the ant body (will be clipped)
      this.renderDeadAntBody(ctx);
      ctx.restore();

      // Draw glitchy scan line at dissolve edge
      ctx.globalAlpha = 0.9;
      const glitchColors = ['#00FFFF', '#FFFFFF', '#88FFFF', this.color];
      for (let px = -6; px <= 6; px++) {
        // Glitchy horizontal line with some randomness
        if (Math.random() > 0.2) {
          const glitchOffset = Math.floor((Math.random() - 0.5) * 2);
          const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
          this.drawPixel(ctx, baseX + px + glitchOffset, dissolveLinePixelY, color);
        }
      }

      // Add some static/noise pixels near the dissolve line
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 8; i++) {
        const noiseX = baseX + Math.floor((Math.random() - 0.5) * 12);
        const noiseY = dissolveLinePixelY + Math.floor((Math.random() - 0.5) * 3);
        const noiseColor = Math.random() > 0.5 ? '#00FFFF' : '#FFFFFF';
        this.drawPixel(ctx, noiseX, noiseY, noiseColor);
      }
      ctx.globalAlpha = 1;
    } else if (this.deathAnimationStage >= 3 || this.deathAnimationStage === 0) {
      // Final state - just a few fading pixels on ground
      ctx.globalAlpha = 0.5;
      this.drawPixel(ctx, baseX - 1, groundBaseY, '#00AAAA');
      this.drawPixel(ctx, baseX, groundBaseY, '#008888');
      this.drawPixel(ctx, baseX + 1, groundBaseY, '#00AAAA');

      // Occasional glitch flicker
      if (Math.random() > 0.9) {
        ctx.globalAlpha = 0.4;
        this.drawPixel(ctx, baseX + Math.floor((Math.random() - 0.5) * 4), groundBaseY - 1, '#00FFFF');
      }
      ctx.globalAlpha = 1;
    }
  }

  // Helper to render ant with a color tint (for flash effects)
  private renderAntWithTint(ctx: CanvasRenderingContext2D, tintColor: string): void {
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(this.y / ANT_PIXEL_SCALE);

    // Simplified ant silhouette with tint color
    // Abdomen
    this.drawPixel(ctx, baseX - 3, baseY - 4, tintColor);
    this.drawPixel(ctx, baseX - 4, baseY - 4, tintColor);
    this.drawPixel(ctx, baseX - 3, baseY - 5, tintColor);
    this.drawPixel(ctx, baseX - 4, baseY - 5, tintColor);
    // Thorax
    this.drawPixel(ctx, baseX, baseY - 6, tintColor);
    this.drawPixel(ctx, baseX + 1, baseY - 6, tintColor);
    this.drawPixel(ctx, baseX + 1, baseY - 7, tintColor);
    // Head
    this.drawPixel(ctx, baseX + 4, baseY - 9, tintColor);
    this.drawPixel(ctx, baseX + 5, baseY - 9, tintColor);
    this.drawPixel(ctx, baseX + 4, baseY - 10, tintColor);
    this.drawPixel(ctx, baseX + 5, baseY - 10, tintColor);
    // Helmet
    this.drawPixel(ctx, baseX + 3, baseY - 11, tintColor);
    this.drawPixel(ctx, baseX + 4, baseY - 11, tintColor);
    this.drawPixel(ctx, baseX + 5, baseY - 11, tintColor);
  }

  // Render a simple collapsed body (for ghost death)
  private renderCollapsedBody(ctx: CanvasRenderingContext2D): void {
    const groundY = this.getGroundYAt(this.x);
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(groundY / ANT_PIXEL_SCALE);

    const bodyColor = '#2a2a2a';
    const bodyDark = '#1a1a1a';

    // Small collapsed body at ground level (5 pixels wide)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect((baseX - 2) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 5 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);

    this.drawPixel(ctx, baseX - 2, baseY, bodyDark);
    this.drawPixel(ctx, baseX - 1, baseY, bodyColor);
    this.drawPixel(ctx, baseX, baseY, bodyColor);
    this.drawPixel(ctx, baseX + 1, baseY, bodyDark);
    this.drawPixel(ctx, baseX + 2, baseY, bodyDark);
  }

  // Render the dead ant body as pixel art (2x2 scale)
  private renderDeadAntBody(ctx: CanvasRenderingContext2D): void {
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    // Use current Y for tumbling animation, ground Y for fallen state
    const isTumbling = this.deathAnimationStage === 1 || this.deathAnimationStage === 2;
    const yPos = isTumbling ? this.y : this.getGroundYAt(this.x);
    const baseY = Math.floor(yPos / ANT_PIXEL_SCALE);

    const bodyColor = this.deathAnimationStage === 1 ? '#fff' : '#2a2a2a';
    const bodyDark = this.deathAnimationStage === 1 ? '#ddd' : '#1a1a1a';
    const bodyLight = this.deathAnimationStage === 1 ? '#fff' : '#3a3a3a';
    const helmetColor = this.deathAnimationStage === 1 ? '#fff' : this.darkenColor(this.color, 30);
    const helmetLight = this.deathAnimationStage === 1 ? '#fff' : this.color;

    // During death animation stages 1-2, show the ant tumbling
    if (isTumbling) {
      const popOffset = Math.floor(this.deathPopY / ANT_PIXEL_SCALE);
      const wobble = Math.floor(Math.sin(this.idleTime * 15) * 2);
      const rotation = Math.floor(Math.sin(this.idleTime * 8) * 3);

      // Tumbling ant (more detailed at 2x2 scale)
      // Abdomen
      this.drawPixel(ctx, baseX - 4 + wobble, baseY - 4 + popOffset + rotation, bodyColor);
      this.drawPixel(ctx, baseX - 5 + wobble, baseY - 4 + popOffset + rotation, bodyColor);
      this.drawPixel(ctx, baseX - 6 + wobble, baseY - 4 + popOffset + rotation, bodyDark);
      this.drawPixel(ctx, baseX - 4 + wobble, baseY - 5 + popOffset + rotation, bodyLight);
      this.drawPixel(ctx, baseX - 5 + wobble, baseY - 5 + popOffset + rotation, bodyColor);
      // Petiole
      this.drawPixel(ctx, baseX - 2 + wobble, baseY - 5 + popOffset, bodyDark);
      // Thorax
      this.drawPixel(ctx, baseX + wobble, baseY - 6 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 1 + wobble, baseY - 6 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 1 + wobble, baseY - 7 + popOffset - rotation, bodyLight);
      // Head
      this.drawPixel(ctx, baseX + 4 + wobble, baseY - 9 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 5 + wobble, baseY - 9 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 4 + wobble, baseY - 10 + popOffset - rotation, bodyColor);
      this.drawPixel(ctx, baseX + 5 + wobble, baseY - 10 + popOffset - rotation, bodyDark);
      // Helmet
      this.drawPixel(ctx, baseX + 3 + wobble, baseY - 11 + popOffset - rotation, helmetColor);
      this.drawPixel(ctx, baseX + 4 + wobble, baseY - 11 + popOffset - rotation, helmetLight);
      this.drawPixel(ctx, baseX + 5 + wobble, baseY - 11 + popOffset - rotation, helmetColor);
      this.drawPixel(ctx, baseX + 6 + wobble, baseY - 11 + popOffset - rotation, helmetColor);
      // X eye
      this.drawPixel(ctx, baseX + 6 + wobble, baseY - 9 + popOffset - rotation, '#fff');
      // Flailing legs
      const legAnim = Math.floor(Math.sin(this.idleTime * 12) * 2);
      this.drawPixel(ctx, baseX - 6 + legAnim, baseY - 2 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX - 4 - legAnim, baseY - 2 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX - 2 + legAnim, baseY - 3 + popOffset, bodyDark);
      this.drawPixel(ctx, baseX + 2 - legAnim, baseY - 5 + popOffset, bodyDark);
    } else {
      // Fallen ant wreckage (lying flat, compact)
      // Small shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect((baseX - 3) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 7 * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);

      // Compact fallen body (7 pixels wide)
      // Abdomen
      this.drawPixel(ctx, baseX - 3, baseY, bodyColor);
      this.drawPixel(ctx, baseX - 2, baseY, bodyColor);
      // Thorax
      this.drawPixel(ctx, baseX - 1, baseY, bodyDark);
      this.drawPixel(ctx, baseX, baseY, bodyColor);
      // Head
      this.drawPixel(ctx, baseX + 1, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 2, baseY, bodyDark);
      // Helmet (fallen off)
      this.drawPixel(ctx, baseX + 3, baseY, helmetColor);
      this.drawPixel(ctx, baseX + 3, baseY - 1, helmetLight);
      // Legs
      this.drawPixel(ctx, baseX - 2, baseY + 1, bodyDark);
      this.drawPixel(ctx, baseX + 1, baseY + 1, bodyDark);

      // Small smoke puff
      const smokeOffset = Math.floor(Math.sin(this.idleTime * 2) * 1);
      ctx.fillStyle = 'rgba(80, 80, 80, 0.2)';
      ctx.fillRect((baseX) * ANT_PIXEL_SCALE, (baseY - 2 + smokeOffset) * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
    }
  }

  // Helper to parse color from hex (#RRGGBB) or rgb(r, g, b) format
  private parseColor(color: string): { r: number; g: number; b: number } {
    // Check if it's rgb format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
      };
    }
    // Otherwise parse as hex
    const num = parseInt(color.replace('#', ''), 16);
    return {
      r: (num >> 16) & 0xFF,
      g: (num >> 8) & 0xFF,
      b: num & 0xFF,
    };
  }

  // Helper to lighten a color (supports hex and rgb formats)
  private lightenColor(color: string, amount: number): string {
    const { r, g, b } = this.parseColor(color);
    return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
  }

  // Helper to darken a color (supports hex and rgb formats)
  private darkenColor(color: string, amount: number): string {
    const { r, g, b } = this.parseColor(color);
    return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
  }

  // Get weapon visual properties based on selected weapon
  private getWeaponVisual(): { color: string; light: string; dark: string; length: number } {
    switch (this.selectedWeapon) {
      case 'bazooka':
        return {
          color: '#4A3B28', // Dark brown
          light: '#5C4D3A',
          dark: '#2D2318',
          length: 14, // Longer barrel
        };
      case 'shotgun':
        return {
          color: '#5A5A5A', // Metal grey
          light: '#7A7A7A',
          dark: '#3A3A3A',
          length: 8, // Shorter barrel
        };
      case 'sniper':
        return {
          color: '#2A2A3A', // Dark blue-grey
          light: '#4A4A5A',
          dark: '#1A1A2A',
          length: 16, // Long barrel
        };
      default: // standard
        return {
          color: '#4A5D23', // Green
          light: '#5C7A29',
          dark: '#2D3A16',
          length: 12,
        };
    }
  }
}
