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
  private deathPopY: number;
  private deathPopVy: number;

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
    this.deathPopY = 0;
    this.deathPopVy = 0;
  }

  updatePosition(terrain: Terrain): void {
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

      // Spawn MORE destruction debris (enhanced) - black body with some helmet pieces
      const debrisColors = [this.color, '#1a1a1a', '#1a1a1a', '#1a1a1a', '#0a0a0a', '#2a2a2a'];
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

          // Spawn additional debris burst when landing - black with helmet color
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
        // Stage 3: Final settle
        if (this.deathAnimationTimer <= 0) {
          this.deathAnimationStage = 0; // Animation complete
        }
      }
    }
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

    // End of bazooka (muzzle)
    return {
      x: bazookaStartX + Math.cos(angleRad) * BARREL_LENGTH,
      y: bazookaStartY - Math.sin(angleRad) * BARREL_LENGTH,
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

  render(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean, _isCharging: boolean = false): void {
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

    // Calculate damage tinting
    const healthPercent = this.health / 100;

    // Ant body is black, helmet is team color
    let antColor = '#1a1a1a'; // Dark black for body
    let highlightColor = '#3a3a3a'; // Subtle highlight
    let shadowColor = '#0a0a0a'; // Very dark for legs/arms

    // Helmet keeps team color
    let helmetColor = this.color;
    let helmetHighlight = this.lightenColor(this.color, 40);

    if (healthPercent < 1) {
      const damageDarken = Math.floor((1 - healthPercent) * 20);
      helmetColor = this.darkenColor(this.color, damageDarken);
      helmetHighlight = this.darkenColor(this.lightenColor(this.color, 40), damageDarken);
    }

    if (this.damageFlash > 0) {
      antColor = '#fff';
      highlightColor = '#fff';
      shadowColor = '#ddd';
      helmetColor = '#fff';
      helmetHighlight = '#fff';
    }

    // Idle animation - subtle breathing movement
    const breathe = Math.sin(this.idleTime * 2) * 0.5;

    // Direction the ant faces
    const direction = this.facingRight ? 1 : -1;

    // Base position
    const baseY = this.y; // Ground level
    const bodyX = this.x;

    // === SHADOW ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x - direction * 2, baseY + 2, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // === BAZOOKA AND ARMS (drawn first, behind the ant body) ===
    const angleRad = (this.angle * Math.PI) / 180;
    const bazookaLength = BARREL_LENGTH - this.recoilOffset;

    // Position thorax early for arm calculations
    const thoraxX = bodyX + direction * 8;
    const thoraxY = baseY - 22 + breathe;

    // Bazooka on back shoulder (opposite side, behind body)
    const bazookaStartX = thoraxX - direction * 6;
    const bazookaStartY = thoraxY;

    // === BAZOOKA ===
    ctx.save();
    ctx.translate(bazookaStartX, bazookaStartY);
    ctx.rotate(-angleRad);

    // Main tube (olive/army green)
    ctx.fillStyle = '#4A5D23';
    ctx.beginPath();
    ctx.roundRect(-4, -5, bazookaLength + 4, 10, 3);
    ctx.fill();

    // Tube highlight
    ctx.fillStyle = '#5C7A29';
    ctx.beginPath();
    ctx.roundRect(-2, -4, bazookaLength, 4, 2);
    ctx.fill();

    // Back opening
    ctx.fillStyle = '#2D3A16';
    ctx.beginPath();
    ctx.arc(-2, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-2, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    // Front muzzle
    ctx.fillStyle = '#2D3A16';
    ctx.beginPath();
    ctx.arc(bazookaLength, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(bazookaLength, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Sight on top
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(6, -8, 6, 4, 1);
    ctx.fill();

    // Grip underneath
    ctx.fillStyle = '#3D2B1F';
    ctx.beginPath();
    ctx.roundRect(10, 4, 8, 5, 2);
    ctx.fill();

    ctx.restore();

    // === BACK ARM (behind body, supporting bazooka) ===
    ctx.fillStyle = shadowColor;
    const backGripX = bazookaStartX + Math.cos(angleRad) * 4;
    const backGripY = bazookaStartY - Math.sin(angleRad) * 4;

    ctx.beginPath();
    ctx.moveTo(thoraxX - direction * 4, thoraxY + 2);
    ctx.quadraticCurveTo(
      thoraxX - direction * 6, thoraxY,
      backGripX, backGripY + 4
    );
    ctx.lineTo(backGripX + 2, backGripY + 6);
    ctx.quadraticCurveTo(
      thoraxX - direction * 5, thoraxY + 2,
      thoraxX - direction * 3, thoraxY + 4
    );
    ctx.fill();

    // === ABDOMEN (lower body - horizontal oval, slightly tilted up at front) ===
    const abdomenX = bodyX - direction * 6;
    const abdomenY = baseY - 10 + breathe;

    ctx.fillStyle = antColor;
    ctx.beginPath();
    ctx.ellipse(abdomenX, abdomenY, 11, 7, direction * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Abdomen highlight
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.ellipse(abdomenX - 2, abdomenY - 3, 4, 2.5, direction * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // === CONNECTOR: Abdomen to Waist (petiole) ===
    const waistX = bodyX + direction * 4;
    const waistY = baseY - 15 + breathe;

    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(abdomenX + direction * 8, abdomenY - 2);
    ctx.quadraticCurveTo(
      waistX - direction * 2, waistY + 2,
      waistX, waistY
    );
    ctx.quadraticCurveTo(
      waistX - direction * 2, waistY - 2,
      abdomenX + direction * 8, abdomenY - 4
    );
    ctx.fill();

    // Waist node (petiole)
    ctx.beginPath();
    ctx.ellipse(waistX, waistY, 3, 4, direction * -0.4, 0, Math.PI * 2);
    ctx.fill();

    // === CONNECTOR: Waist to Thorax ===
    ctx.fillStyle = antColor;
    ctx.beginPath();
    ctx.moveTo(waistX + direction * 2, waistY - 2);
    ctx.quadraticCurveTo(
      thoraxX - direction * 4, thoraxY + 6,
      thoraxX - direction * 2, thoraxY + 5
    );
    ctx.lineTo(thoraxX - direction * 2, thoraxY + 3);
    ctx.quadraticCurveTo(
      thoraxX - direction * 5, thoraxY + 4,
      waistX + direction * 2, waistY
    );
    ctx.fill();

    // === THORAX (upper body - angled upward) ===
    // Note: thoraxX and thoraxY already declared earlier for bazooka positioning

    ctx.fillStyle = antColor;
    ctx.beginPath();
    ctx.ellipse(thoraxX, thoraxY, 6, 8, direction * -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Thorax highlight
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.ellipse(thoraxX - 1, thoraxY - 3, 2.5, 3, direction * -0.5, 0, Math.PI * 2);
    ctx.fill();

    // === CONNECTOR: Thorax to Neck ===
    const neckX = bodyX + direction * 13;
    const neckY = baseY - 30 + breathe;

    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(thoraxX + direction * 3, thoraxY - 5);
    ctx.quadraticCurveTo(
      neckX - direction * 2, neckY + 4,
      neckX, neckY + 2
    );
    ctx.lineTo(neckX, neckY);
    ctx.quadraticCurveTo(
      neckX - direction * 3, neckY + 2,
      thoraxX + direction * 2, thoraxY - 6
    );
    ctx.fill();

    // Neck node
    ctx.beginPath();
    ctx.ellipse(neckX, neckY, 2.5, 3, direction * -0.3, 0, Math.PI * 2);
    ctx.fill();

    // === CONNECTOR: Neck to Head ===
    const headX = bodyX + direction * 18;
    const headY = baseY - 36 + breathe;
    const headRadius = 8;

    ctx.fillStyle = antColor;
    ctx.beginPath();
    ctx.moveTo(neckX + direction * 1, neckY - 2);
    ctx.quadraticCurveTo(
      headX - direction * 6, headY + 6,
      headX - direction * 4, headY + 5
    );
    ctx.lineTo(headX - direction * 4, headY + 3);
    ctx.quadraticCurveTo(
      headX - direction * 7, headY + 4,
      neckX + direction * 1, neckY
    );
    ctx.fill();

    // === HEAD ===
    ctx.fillStyle = antColor;
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Head highlight
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.arc(headX - 2, headY - 3, headRadius / 3, 0, Math.PI * 2);
    ctx.fill();

    // === 4 LEGS (from abdomen, going down) ===
    ctx.fillStyle = shadowColor;
    const legShift = Math.sin(this.idleTime * 3) * 1;

    // Back legs (from back of abdomen)
    const backLegX = abdomenX - direction * 5;
    // Back left
    ctx.beginPath();
    ctx.moveTo(backLegX, abdomenY + 3);
    ctx.quadraticCurveTo(backLegX - 6, abdomenY + 8, backLegX - 8 - legShift, baseY);
    ctx.lineTo(backLegX - 5 - legShift, baseY);
    ctx.quadraticCurveTo(backLegX - 4, abdomenY + 6, backLegX + 2, abdomenY + 3);
    ctx.fill();
    // Back right
    ctx.beginPath();
    ctx.moveTo(backLegX, abdomenY + 3);
    ctx.quadraticCurveTo(backLegX + 6, abdomenY + 8, backLegX + 8 + legShift, baseY);
    ctx.lineTo(backLegX + 5 + legShift, baseY);
    ctx.quadraticCurveTo(backLegX + 4, abdomenY + 6, backLegX - 2, abdomenY + 3);
    ctx.fill();

    // Front legs (from front of abdomen, closer to thorax connection)
    const frontLegX = abdomenX + direction * 6;
    // Front left
    ctx.beginPath();
    ctx.moveTo(frontLegX, abdomenY + 2);
    ctx.quadraticCurveTo(frontLegX - 5, abdomenY + 8, frontLegX - 5 + legShift, baseY);
    ctx.lineTo(frontLegX - 2 + legShift, baseY);
    ctx.quadraticCurveTo(frontLegX - 3, abdomenY + 6, frontLegX + 2, abdomenY + 2);
    ctx.fill();
    // Front right
    ctx.beginPath();
    ctx.moveTo(frontLegX, abdomenY + 2);
    ctx.quadraticCurveTo(frontLegX + 5, abdomenY + 8, frontLegX + 5 - legShift, baseY);
    ctx.lineTo(frontLegX + 2 - legShift, baseY);
    ctx.quadraticCurveTo(frontLegX + 3, abdomenY + 6, frontLegX - 2, abdomenY + 2);
    ctx.fill();

    // === HELMET (team color) ===
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.ellipse(headX, headY - 5, headRadius + 2, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Helmet shine
    ctx.fillStyle = helmetHighlight;
    ctx.beginPath();
    ctx.ellipse(headX - 2, headY - 7, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // === BIG EYES (cartoon style) ===
    // Eye white
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(headX + direction * 4, headY - 1, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(headX + direction * 5, headY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(headX + direction * 5.5, headY - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // === ANTENNAE ===
    ctx.fillStyle = shadowColor;
    const antennaBaseX = headX - direction * 2;
    const antennaBaseY = headY - headRadius;

    // Left antenna
    ctx.beginPath();
    ctx.moveTo(antennaBaseX - 2, antennaBaseY);
    ctx.quadraticCurveTo(
      antennaBaseX - 6, antennaBaseY - 10,
      antennaBaseX - 4 + Math.sin(this.idleTime * 4) * 2, antennaBaseY - 14
    );
    ctx.lineTo(antennaBaseX - 2 + Math.sin(this.idleTime * 4) * 2, antennaBaseY - 13);
    ctx.quadraticCurveTo(
      antennaBaseX - 4, antennaBaseY - 8,
      antennaBaseX, antennaBaseY
    );
    ctx.fill();

    // Right antenna
    ctx.beginPath();
    ctx.moveTo(antennaBaseX + 2, antennaBaseY);
    ctx.quadraticCurveTo(
      antennaBaseX + 6, antennaBaseY - 10,
      antennaBaseX + 4 + Math.sin(this.idleTime * 4 + 1) * 2, antennaBaseY - 14
    );
    ctx.lineTo(antennaBaseX + 2 + Math.sin(this.idleTime * 4 + 1) * 2, antennaBaseY - 13);
    ctx.quadraticCurveTo(
      antennaBaseX + 4, antennaBaseY - 8,
      antennaBaseX, antennaBaseY
    );
    ctx.fill();

    // === FRONT ARM (drawn after body, in front, supporting the bazooka) ===
    ctx.fillStyle = shadowColor;
    const frontGripX = bazookaStartX + Math.cos(angleRad) * 14;
    const frontGripY = bazookaStartY - Math.sin(angleRad) * 14;

    ctx.beginPath();
    ctx.moveTo(thoraxX + direction * 4, thoraxY + 2);
    ctx.quadraticCurveTo(
      thoraxX + direction * 2, thoraxY - 2,
      frontGripX, frontGripY + 4
    );
    ctx.lineTo(frontGripX + 2, frontGripY + 6);
    ctx.quadraticCurveTo(
      thoraxX + direction * 3, thoraxY,
      thoraxX + direction * 5, thoraxY + 4
    );
    ctx.fill();

    // Draw spark particles
    for (const particle of this.sparkParticles) {
      const alpha = particle.life / 0.6;
      const brightness = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 50}, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
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
      const arrowBounce = Math.sin(this.idleTime * 3) * 3;
      const chevronY = headY - headRadius - 14 + arrowBounce;

      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.moveTo(headX - 6, chevronY - 8);
      ctx.lineTo(headX, chevronY);
      ctx.lineTo(headX + 6, chevronY - 8);
      ctx.lineTo(headX + 4, chevronY - 8);
      ctx.lineTo(headX, chevronY - 3);
      ctx.lineTo(headX - 4, chevronY - 8);
      ctx.closePath();
      ctx.fill();
    }

    // === HEALTH BAR ===
    const healthBarWidth = 32;
    const healthBarHeight = 5;
    const healthBarY = headY - headRadius - 12;

    // Background
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(headX - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight, 2);
    ctx.fill();

    // Health fill
    const healthColor = healthPercent > 0.5 ? '#4ECB71' : healthPercent > 0.25 ? '#FFD93D' : '#FF6B6B';
    ctx.fillStyle = healthColor;
    ctx.beginPath();
    ctx.roundRect(
      headX - healthBarWidth / 2 + 1,
      healthBarY + 1,
      (healthBarWidth - 2) * healthPercent,
      healthBarHeight - 2,
      1
    );
    ctx.fill();

    ctx.restore();
  }

  private renderDestroyed(ctx: CanvasRenderingContext2D): void {
    // Destruction flash
    if (this.destructionFlash > 0) {
      const flashGradient = ctx.createRadialGradient(
        this.x, this.y - 20, 0,
        this.x, this.y - 20, 60
      );
      flashGradient.addColorStop(0, `rgba(255, 255, 255, ${this.destructionFlash})`);
      flashGradient.addColorStop(0.2, `rgba(255, 255, 200, ${this.destructionFlash * 0.8})`);
      flashGradient.addColorStop(0.5, `rgba(255, 150, 50, ${this.destructionFlash * 0.4})`);
      flashGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 20, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw destruction debris (ant body parts)
    for (const debris of this.destructionDebris) {
      const alpha = Math.min(1, debris.life);
      ctx.save();
      ctx.translate(debris.x, debris.y);
      ctx.rotate(debris.rotation);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = debris.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, debris.size / 2, debris.size / 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // During death animation stages 1-2, show the ant tumbling
    if (this.deathAnimationStage === 1 || this.deathAnimationStage === 2) {
      ctx.save();
      ctx.translate(this.x, this.y + this.deathPopY);

      if (this.deathAnimationStage === 2) {
        const wobble = Math.sin(this.idleTime * 15) * 0.4;
        ctx.rotate(wobble + 0.3);
      }

      // Black body (flash white during stage 1)
      const bodyColor = this.deathAnimationStage === 1 ? '#fff' : '#1a1a1a';
      ctx.fillStyle = bodyColor;

      // Horizontal abdomen
      ctx.beginPath();
      ctx.ellipse(-8, -10, 10, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Thorax angled up
      ctx.beginPath();
      ctx.ellipse(4, -18, 6, 8, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(12, -26, 7, 0, Math.PI * 2);
      ctx.fill();

      // Helmet (team color)
      ctx.fillStyle = this.deathAnimationStage === 1 ? '#fff' : this.darkenColor(this.color, 30);
      ctx.beginPath();
      ctx.ellipse(12, -31, 9, 5, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // X eye
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('x', 14, -24);

      // Legs flailing (black)
      ctx.fillStyle = '#0a0a0a';
      for (let i = 0; i < 4; i++) {
        const legAngle = Math.sin(this.idleTime * 12 + i) * 0.5;
        ctx.save();
        ctx.translate(-8 + i * 3, -8);
        ctx.rotate(legAngle + 0.8);
        ctx.beginPath();
        ctx.ellipse(6, 0, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    } else {
      // Fallen ant wreckage
      const wreckY = this.y - 4;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 1, 20, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black body for dead ant
      ctx.fillStyle = '#1a1a1a';

      // Abdomen lying flat
      ctx.beginPath();
      ctx.ellipse(this.x - 10, wreckY, 10, 4, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Thorax
      ctx.beginPath();
      ctx.ellipse(this.x + 2, wreckY - 1, 6, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Head rolled over
      ctx.beginPath();
      ctx.arc(this.x + 14, wreckY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Helmet nearby (team color)
      ctx.fillStyle = this.darkenColor(this.color, 40);
      ctx.beginPath();
      ctx.ellipse(this.x + 22, wreckY + 2, 5, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Legs sprawled (black)
      ctx.fillStyle = '#0a0a0a';
      for (let i = 0; i < 4; i++) {
        const lx = this.x - 14 + i * 6;
        const angle = (i % 2 === 0) ? 0.3 : -0.3;
        ctx.beginPath();
        ctx.ellipse(lx, wreckY + 2 + (i % 2), 5, 1.5, angle, 0, Math.PI * 2);
        ctx.fill();
      }

      // Broken bazooka
      ctx.fillStyle = '#3D4A23';
      ctx.beginPath();
      ctx.roundRect(this.x - 22, wreckY + 4, 14, 5, 2);
      ctx.fill();

      // Smoke
      const smokeOffset = Math.sin(this.idleTime * 2) * 2;
      ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
      ctx.beginPath();
      ctx.arc(this.x, wreckY - 8 + smokeOffset, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x + 6, wreckY - 14 + smokeOffset * 0.7, 3, 0, Math.PI * 2);
      ctx.fill();
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
