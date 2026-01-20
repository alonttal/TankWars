import {
  TANK_WIDTH,
  TANK_HEIGHT,
  BARREL_LENGTH,
  MAP_HEIGHT
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

export class Tank {
  x: number;
  y: number;
  angle: number; // in degrees, 0 = right, 90 = up, 180 = left
  color: string;
  health: number;
  isAlive: boolean;
  playerIndex: number;
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
  private deathPopY: number;
  private deathPopVy: number;

  constructor(x: number, y: number, color: string, playerIndex: number, facingRight: boolean) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.playerIndex = playerIndex;
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
    this.deathPopY = 0;
    this.deathPopVy = 0;
  }

  updatePosition(terrain: Terrain): void {
    // Update Y position to sit on terrain
    this.y = MAP_HEIGHT - terrain.getHeightAt(this.x);
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
      this.destructionFlash = 1.0; // Stronger flash

      // Start multi-stage death animation
      this.deathAnimationStage = 1;
      this.deathAnimationTimer = 0.15; // Flash duration
      this.deathPopY = 0;
      this.deathPopVy = -120; // Initial upward pop velocity

      // Spawn MORE destruction debris (enhanced)
      const debrisColors = [this.color, '#444', '#333', '#666', '#555', '#222'];
      for (let i = 0; i < 25; i++) { // Increased from 15 to 25
        const angle = Math.random() * Math.PI - Math.PI / 2;
        const speed = 120 + Math.random() * 180; // Faster
        this.destructionDebris.push({
          x: this.x + (Math.random() - 0.5) * TANK_WIDTH,
          y: this.y - TANK_HEIGHT / 2,
          vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
          vy: -Math.abs(Math.sin(angle) * speed) - 80, // More upward
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 20, // Faster spin
          size: 3 + Math.random() * 10, // Varied sizes
          life: 2.0 + Math.random() * 1.5, // Longer lasting
          color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
        });
      }
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

    // Update death animation stages
    if (this.deathAnimationStage > 0) {
      this.deathAnimationTimer -= deltaTime;

      if (this.deathAnimationStage === 1) {
        // Stage 1: Flash
        if (this.deathAnimationTimer <= 0) {
          this.deathAnimationStage = 2;
          this.deathAnimationTimer = 0.5; // Pop up duration
        }
      } else if (this.deathAnimationStage === 2) {
        // Stage 2: Pop up
        this.deathPopY += this.deathPopVy * deltaTime;
        this.deathPopVy += 400 * deltaTime; // Gravity brings it back down

        if (this.deathAnimationTimer <= 0) {
          this.deathAnimationStage = 3;
          this.deathAnimationTimer = 0.3;

          // Spawn additional debris burst when landing
          const debrisColors = [this.color, '#444', '#333'];
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
        // Stage 3: Final settle
        if (this.deathAnimationTimer <= 0) {
          this.deathAnimationStage = 0; // Animation complete
        }
      }
    }
  }

  getBarrelEnd(): { x: number; y: number } {
    const angleRad = (this.angle * Math.PI) / 180;
    return {
      x: this.x + Math.cos(angleRad) * BARREL_LENGTH,
      y: this.y - TANK_HEIGHT / 2 - Math.sin(angleRad) * BARREL_LENGTH,
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

  render(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean, isCharging: boolean = false): void {
    if (!this.isAlive) {
      this.renderDestroyed(ctx);
      return;
    }

    // Apply hit reaction offset
    ctx.save();
    if (this.hitReactionTime > 0) {
      ctx.translate(this.hitReactionX, this.hitReactionY);
    }

    // Draw smoke rings (behind everything)
    for (const ring of this.smokeRings) {
      ctx.strokeStyle = `rgba(150, 150, 150, ${ring.alpha * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw smoke particles (behind tank)
    for (const particle of this.smokeParticles) {
      const alpha = (particle.life / 1.8) * 0.6;
      const gray = 60 + Math.random() * 50;
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Idle engine vibration (subtle rumble, no vertical movement)
    const vibrationX = (Math.sin(this.idleTime * 8) * 0.3 + Math.sin(this.idleTime * 10) * 0.2);
    const vibrationY = (Math.cos(this.idleTime * 9) * 0.2);
    const tankY = this.y - TANK_HEIGHT;

    // Calculate damage tinting
    const healthPercent = this.health / 100;
    const damageDarken = Math.floor((1 - healthPercent) * 40);

    // Get colors
    let tankColor = this.color;
    let highlightColor = this.lightenColor(this.color, 60);
    let shadowColor = this.darkenColor(this.color, 50);
    const outlineColor = this.darkenColor(this.color, 80);

    if (healthPercent < 1) {
      tankColor = this.darkenColor(this.color, damageDarken);
      highlightColor = this.darkenColor(this.lightenColor(this.color, 60), damageDarken);
      shadowColor = this.darkenColor(this.darkenColor(this.color, 50), damageDarken);
    }

    if (this.damageFlash > 0) {
      tankColor = '#fff';
      highlightColor = '#fff';
      shadowColor = '#ddd';
    }

    // === SHADOW ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x + 2, this.y + 3, TANK_WIDTH / 2 + 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // === CONTINUOUS TRACK (Chunky cartoon tank tread) ===
    const trackWidth = TANK_WIDTH + 14; // Match body width
    const trackHeight = 14;
    const trackY = this.y - trackHeight + 2;
    const trackRadius = trackHeight / 2; // Rounded ends

    // Track shadow
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.roundRect(
      this.x - trackWidth / 2 + 2,
      trackY + 2,
      trackWidth,
      trackHeight,
      trackRadius
    );
    ctx.fill();

    // Main track body (dark rubber)
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(
      this.x - trackWidth / 2,
      trackY,
      trackWidth,
      trackHeight,
      trackRadius
    );
    ctx.fill();

    // Track outline
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      this.x - trackWidth / 2,
      trackY,
      trackWidth,
      trackHeight,
      trackRadius
    );
    ctx.stroke();

    // Inner track area (where wheels would be - darker inset)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(
      this.x - trackWidth / 2 + 4,
      trackY + 3,
      trackWidth - 8,
      trackHeight - 6,
      trackRadius - 2
    );
    ctx.fill();

    // Animated tread segments
    const treadOffset = (this.idleTime * 0.5) % 1; // Slow animation
    const treadCount = 10;
    const treadSpacing = (trackWidth - 8) / treadCount;

    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < treadCount; i++) {
      const tx = this.x - trackWidth / 2 + 6 + (i + treadOffset) * treadSpacing;
      if (tx < this.x + trackWidth / 2 - 6) {
        ctx.beginPath();
        ctx.roundRect(tx, trackY + 1, 3, trackHeight - 2, 1);
        ctx.fill();
      }
    }

    // Track teeth/grips on bottom edge
    ctx.fillStyle = '#222';
    const teethCount = 12;
    const teethSpacing = (trackWidth - 16) / (teethCount - 1);
    for (let i = 0; i < teethCount; i++) {
      const tx = this.x - trackWidth / 2 + 8 + i * teethSpacing;
      ctx.beginPath();
      ctx.roundRect(tx - 2, trackY + trackHeight - 4, 4, 4, 1);
      ctx.fill();
    }

    // Highlight on top of track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(
      this.x - trackWidth / 2 + 6,
      trackY + 1,
      trackWidth - 12,
      3,
      2
    );
    ctx.fill();

    // Drive wheel hints at ends (small circles visible through track)
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(this.x - trackWidth / 2 + trackRadius, trackY + trackHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x + trackWidth / 2 - trackRadius, trackY + trackHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Drive wheel center dots
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(this.x - trackWidth / 2 + trackRadius, trackY + trackHeight / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x + trackWidth / 2 - trackRadius, trackY + trackHeight / 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // === TANK BODY (Wide, chunky cartoon shape with engine vibration) ===
    const bodyWidth = TANK_WIDTH + 14; // Wider body
    const bodyHeight = TANK_HEIGHT - 6; // Flatter body
    const bodyY = tankY + 6 + vibrationY;
    const bodyX = this.x + vibrationX;

    // Body shadow (stays still)
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.roundRect(
      this.x - bodyWidth / 2 + 4,
      tankY + 8,
      bodyWidth - 4,
      bodyHeight,
      6
    );
    ctx.fill();

    // Main body (with vibration)
    const bodyGradient = ctx.createLinearGradient(
      bodyX, bodyY,
      bodyX, bodyY + bodyHeight
    );
    bodyGradient.addColorStop(0, highlightColor);
    bodyGradient.addColorStop(0.4, tankColor);
    bodyGradient.addColorStop(1, shadowColor);

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.roundRect(
      bodyX - bodyWidth / 2 + 2,
      bodyY,
      bodyWidth - 4,
      bodyHeight,
      6
    );
    ctx.fill();

    // Body outline
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      bodyX - bodyWidth / 2 + 2,
      bodyY,
      bodyWidth - 4,
      bodyHeight,
      6
    );
    ctx.stroke();

    // Body shine (top highlight)
    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
    ctx.beginPath();
    ctx.roundRect(
      bodyX - bodyWidth / 3,
      bodyY + 2,
      bodyWidth / 1.5 - 4,
      3,
      2
    );
    ctx.fill();

    // Side panel detail (left)
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.roundRect(
      bodyX - bodyWidth / 2 + 5,
      bodyY + 3,
      8,
      bodyHeight - 6,
      2
    );
    ctx.fill();

    // Side panel detail (right)
    ctx.beginPath();
    ctx.roundRect(
      bodyX + bodyWidth / 2 - 13,
      bodyY + 3,
      8,
      bodyHeight - 6,
      2
    );
    ctx.fill();

    // === EXHAUST PUFFS (from back of tank) ===
    const exhaustX = this.facingRight ? this.x - bodyWidth / 2 : this.x + bodyWidth / 2;
    const exhaustY = bodyY + bodyHeight / 2;
    const puffPhase = this.idleTime * 3;

    // Small exhaust puffs
    ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
    const puff1Size = 3 + Math.sin(puffPhase) * 1;
    const puff1Offset = 4 + Math.sin(puffPhase) * 2;
    ctx.beginPath();
    ctx.arc(
      this.facingRight ? exhaustX - puff1Offset : exhaustX + puff1Offset,
      exhaustY - 1,
      puff1Size,
      0, Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = 'rgba(80, 80, 80, 0.3)';
    const puff2Size = 2 + Math.cos(puffPhase * 1.3) * 1;
    const puff2Offset = 8 + Math.cos(puffPhase) * 2;
    ctx.beginPath();
    ctx.arc(
      this.facingRight ? exhaustX - puff2Offset : exhaustX + puff2Offset,
      exhaustY - 3,
      puff2Size,
      0, Math.PI * 2
    );
    ctx.fill();

    // === TURRET (Wider dome to match body) ===
    const turretWidth = TANK_WIDTH * 0.7; // Wider turret
    const turretHeight = 12; // Slightly flatter
    const turretY = bodyY - turretHeight + 6;
    const turretX = bodyX; // Turret follows body vibration

    // Turret shadow (stays still)
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.ellipse(this.x + 1, turretY + turretHeight / 2 + 2, turretWidth / 2, turretHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main turret (dome shape)
    const turretGradient = ctx.createRadialGradient(
      turretX - 4, turretY + 2, 0,
      turretX, turretY + turretHeight / 2, turretWidth / 2
    );
    turretGradient.addColorStop(0, highlightColor);
    turretGradient.addColorStop(0.5, tankColor);
    turretGradient.addColorStop(1, shadowColor);

    ctx.fillStyle = turretGradient;
    ctx.beginPath();
    ctx.ellipse(turretX, turretY + turretHeight / 2, turretWidth / 2, turretHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Turret outline
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(turretX, turretY + turretHeight / 2, turretWidth / 2, turretHeight / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Turret shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(turretX - 4, turretY + 3, turretWidth / 3, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Hatch on turret
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.arc(turretX, turretY + turretHeight / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hatch highlight
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.arc(turretX - 1, turretY + turretHeight / 2 - 1, 2, 0, Math.PI * 2);
    ctx.fill();

    // === BARREL (Chunky and fun, follows turret vibration) ===
    const angleRad = (this.angle * Math.PI) / 180;
    const recoiledLength = BARREL_LENGTH - this.recoilOffset;
    const barrelStartX = turretX;
    const barrelStartY = turretY + turretHeight / 2;

    // Barrel thickness
    const barrelThickness = 8;

    ctx.save();
    ctx.translate(barrelStartX, barrelStartY);
    ctx.rotate(-angleRad);

    // Barrel shadow
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.roundRect(1, -barrelThickness / 2 + 1, recoiledLength, barrelThickness, 3);
    ctx.fill();

    // Main barrel
    const barrelGradient = ctx.createLinearGradient(0, -barrelThickness / 2, 0, barrelThickness / 2);
    barrelGradient.addColorStop(0, highlightColor);
    barrelGradient.addColorStop(0.3, tankColor);
    barrelGradient.addColorStop(1, shadowColor);

    ctx.fillStyle = barrelGradient;
    ctx.beginPath();
    ctx.roundRect(0, -barrelThickness / 2, recoiledLength, barrelThickness, 3);
    ctx.fill();

    // Barrel outline
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, -barrelThickness / 2, recoiledLength, barrelThickness, 3);
    ctx.stroke();

    // Muzzle brake (chunky end piece)
    const muzzleX = recoiledLength - 6;
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.roundRect(muzzleX, -barrelThickness / 2 - 2, 8, barrelThickness + 4, 2);
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Barrel highlight stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(4, -barrelThickness / 2 + 1, recoiledLength - 12, 2);

    ctx.restore();

    // Draw spark particles
    for (const particle of this.sparkParticles) {
      const alpha = particle.life / 0.6;
      const brightness = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 50}, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 0.02, particle.y - particle.vy * 0.02);
      ctx.stroke();
    }

    // Draw fire particles (critical health)
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

    // === CURRENT PLAYER INDICATOR ===
    if (isCurrentPlayer) {
      // Double chevron indicator (more stylized)
      const arrowBounce = Math.sin(this.idleTime * 3) * 3;
      const chevronY = turretY - 16 + arrowBounce;

      // Outer chevron
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - 8, chevronY - 6);
      ctx.lineTo(this.x, chevronY);
      ctx.lineTo(this.x + 8, chevronY - 6);
      ctx.stroke();

      // Inner chevron
      ctx.beginPath();
      ctx.moveTo(this.x - 6, chevronY - 12);
      ctx.lineTo(this.x, chevronY - 6);
      ctx.lineTo(this.x + 6, chevronY - 12);
      ctx.stroke();

      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    // === HEALTH BAR (Rounded, clean, wider) ===
    const healthBarWidth = bodyWidth - 4;
    const healthBarHeight = 6;
    const healthBarY = turretY - 14;

    // Background
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(this.x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight, 3);
    ctx.fill();

    // Health fill
    const healthColor = healthPercent > 0.5 ? '#4ECB71' : healthPercent > 0.25 ? '#FFD93D' : '#FF6B6B';
    ctx.fillStyle = healthColor;
    ctx.beginPath();
    ctx.roundRect(
      this.x - healthBarWidth / 2 + 1,
      healthBarY + 1,
      (healthBarWidth - 2) * healthPercent,
      healthBarHeight - 2,
      2
    );
    ctx.fill();

    // Health bar outline
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(this.x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight, 3);
    ctx.stroke();

    // Health bar shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(this.x - healthBarWidth / 2 + 2, healthBarY + 1, (healthBarWidth - 4) * healthPercent, 2);

    ctx.restore();
  }

  private renderDestroyed(ctx: CanvasRenderingContext2D): void {
    // Destruction flash (larger and brighter)
    if (this.destructionFlash > 0) {
      const flashGradient = ctx.createRadialGradient(
        this.x, this.y - TANK_HEIGHT / 2, 0,
        this.x, this.y - TANK_HEIGHT / 2, TANK_WIDTH * 3
      );
      flashGradient.addColorStop(0, `rgba(255, 255, 255, ${this.destructionFlash})`);
      flashGradient.addColorStop(0.2, `rgba(255, 255, 200, ${this.destructionFlash * 0.8})`);
      flashGradient.addColorStop(0.5, `rgba(255, 150, 50, ${this.destructionFlash * 0.4})`);
      flashGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y - TANK_HEIGHT / 2, TANK_WIDTH * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw destruction debris (chunky cartoon pieces)
    for (const debris of this.destructionDebris) {
      const alpha = Math.min(1, debris.life);
      ctx.save();
      ctx.translate(debris.x, debris.y);
      ctx.rotate(debris.rotation);
      ctx.globalAlpha = alpha;

      // Rounded debris pieces
      ctx.fillStyle = debris.color;
      ctx.beginPath();
      ctx.roundRect(-debris.size / 2, -debris.size / 2, debris.size, debris.size, debris.size / 4);
      ctx.fill();

      // Debris outline
      ctx.strokeStyle = this.darkenColor(debris.color, 40);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    // During death animation stages 1-2, show the tank popping up
    if (this.deathAnimationStage === 1 || this.deathAnimationStage === 2) {
      ctx.save();
      ctx.translate(this.x, this.y + this.deathPopY);

      // Add rotation wobble during pop
      if (this.deathAnimationStage === 2) {
        const wobble = Math.sin(this.idleTime * 15) * 0.15;
        ctx.rotate(wobble);
      }

      // Flash effect during stage 1
      const tankColor = this.deathAnimationStage === 1 ? '#fff' : this.darkenColor(this.color, 30);
      const shadowColor = this.deathAnimationStage === 1 ? '#ddd' : this.darkenColor(this.color, 60);

      // Simplified tank body (rounded)
      ctx.fillStyle = shadowColor;
      ctx.beginPath();
      ctx.roundRect(-TANK_WIDTH / 2 + 4, -TANK_HEIGHT + 4, TANK_WIDTH - 8, TANK_HEIGHT - 6, 6);
      ctx.fill();

      ctx.fillStyle = tankColor;
      ctx.beginPath();
      ctx.roundRect(-TANK_WIDTH / 2 + 2, -TANK_HEIGHT + 2, TANK_WIDTH - 4, TANK_HEIGHT - 6, 6);
      ctx.fill();

      // X eyes (defeated look)
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      // Left X
      ctx.beginPath();
      ctx.moveTo(-8, -TANK_HEIGHT / 2 - 2);
      ctx.lineTo(-4, -TANK_HEIGHT / 2 + 2);
      ctx.moveTo(-4, -TANK_HEIGHT / 2 - 2);
      ctx.lineTo(-8, -TANK_HEIGHT / 2 + 2);
      ctx.stroke();
      // Right X
      ctx.beginPath();
      ctx.moveTo(4, -TANK_HEIGHT / 2 - 2);
      ctx.lineTo(8, -TANK_HEIGHT / 2 + 2);
      ctx.moveTo(8, -TANK_HEIGHT / 2 - 2);
      ctx.lineTo(4, -TANK_HEIGHT / 2 + 2);
      ctx.stroke();

      ctx.restore();
    } else {
      // Draw destroyed tank wreckage (cute cartoon style)
      const wreckY = this.y - 8;

      // Wreck shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(this.x + 2, this.y + 2, TANK_WIDTH / 2 - 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flattened/crushed body
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.roundRect(this.x - TANK_WIDTH / 2 + 5, wreckY, TANK_WIDTH - 10, 8, 3);
      ctx.fill();

      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bent barrel sticking out
      ctx.fillStyle = '#555';
      ctx.save();
      ctx.translate(this.x + 5, wreckY + 2);
      ctx.rotate(0.3);
      ctx.beginPath();
      ctx.roundRect(0, -3, 12, 6, 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Smoke puffs
      const smokeOffset = Math.sin(this.idleTime * 2) * 2;
      ctx.fillStyle = 'rgba(80, 80, 80, 0.5)';
      ctx.beginPath();
      ctx.arc(this.x - 5, wreckY - 8 + smokeOffset, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x + 3, wreckY - 14 + smokeOffset * 0.7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x - 2, wreckY - 20 + smokeOffset * 0.5, 4, 0, Math.PI * 2);
      ctx.fill();

      // Small fire flickers
      if (Math.random() > 0.4) {
        const fireX = this.x + (Math.random() - 0.5) * 15;
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 50, 0.8)`;
        ctx.beginPath();
        ctx.arc(fireX, wreckY - 2, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
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
}
