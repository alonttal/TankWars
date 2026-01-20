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
    this.renderAntBody(ctx, isCurrentPlayer);

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
  private renderAntBody(ctx: CanvasRenderingContext2D, isCurrentPlayer: boolean): void {
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
    const legAnim = Math.floor(Math.sin(this.idleTime * 4) * 1);

    // Bazooka angle
    const angleRad = (this.angle * Math.PI) / 180;
    const bazookaLen = 12; // pixels at 2x2 scale

    // === SHADOW ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect((baseX - 8) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 18 * ANT_PIXEL_SCALE, 2 * ANT_PIXEL_SCALE);

    // Shoulder position (where bazooka attaches)
    const shoulderX = baseX + direction * 2;
    const shoulderY = baseY - 10 + breatheOffset;

    // === DRAW BAZOOKA (only on current player's turn) ===
    if (isCurrentPlayer) {
      const bazookaColor = '#4A5D23';
      const bazookaLight = '#5C7A29';
      const bazookaDark = '#2D3A16';

      // Draw bazooka tube along angle (thicker tube)
      for (let i = 0; i < bazookaLen; i++) {
        const px = shoulderX + Math.round(Math.cos(angleRad) * i * direction);
        const py = shoulderY - Math.round(Math.sin(angleRad) * i);
        // Main tube
        this.drawPixel(ctx, px, py, bazookaColor);
        this.drawPixel(ctx, px, py - 1, bazookaLight);
        this.drawPixel(ctx, px, py + 1, bazookaDark);
      }
      // Muzzle opening
      const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * bazookaLen * direction);
      const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * bazookaLen);
      this.drawPixel(ctx, muzzleX, muzzleY, bazookaDark);
      this.drawPixel(ctx, muzzleX, muzzleY - 1, '#1a1a1a');
      this.drawPixel(ctx, muzzleX, muzzleY + 1, '#1a1a1a');
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

    // === ARM holding bazooka (only on current player's turn) ===
    if (isCurrentPlayer) {
      const armX = shoulderX + Math.round(Math.cos(angleRad) * 4 * direction);
      const armY = shoulderY - Math.round(Math.sin(angleRad) * 4) + 1;
      this.drawPixel(ctx, armX, armY, bodyDark);
      this.drawPixel(ctx, armX, armY + 1, bodyDark);

      // === TARGETING CURSOR ===
      this.renderTargetingCursor(ctx, shoulderX, shoulderY, angleRad, direction, bazookaLen);
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

  // Render targeting cursor with aiming line and crosshair
  private renderTargetingCursor(
    ctx: CanvasRenderingContext2D,
    shoulderX: number,
    shoulderY: number,
    angleRad: number,
    direction: number,
    bazookaLen: number
  ): void {
    // Convert from pixel grid back to world coordinates
    const muzzleWorldX = (shoulderX + Math.cos(angleRad) * bazookaLen * direction) * ANT_PIXEL_SCALE;
    const muzzleWorldY = (shoulderY - Math.sin(angleRad) * bazookaLen) * ANT_PIXEL_SCALE;

    // Aiming line parameters
    const lineLength = 80; // Length of the aiming line
    const crosshairSize = 8;
    const dashLength = 6;
    const gapLength = 4;

    // Calculate end point of aiming line
    const endX = muzzleWorldX + Math.cos(angleRad) * lineLength * direction;
    const endY = muzzleWorldY - Math.sin(angleRad) * lineLength;

    // Pulsing effect
    const pulse = 0.6 + Math.sin(this.idleTime * 4) * 0.2;

    ctx.save();

    // === DASHED AIMING LINE ===
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.7})`;
    ctx.lineWidth = 2;
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

    // Draw destruction debris as pixel blocks
    for (const debris of this.destructionDebris) {
      const alpha = Math.min(1, debris.life);
      const px = Math.floor(debris.x / ANT_PIXEL_SCALE);
      const py = Math.floor(debris.y / ANT_PIXEL_SCALE);
      ctx.globalAlpha = alpha;
      this.drawPixel(ctx, px, py, debris.color);
    }
    ctx.globalAlpha = 1;

    // Render dead ant as pixel art
    this.renderDeadAntBody(ctx);
  }

  // Render the dead ant body as pixel art (2x2 scale)
  private renderDeadAntBody(ctx: CanvasRenderingContext2D): void {
    const baseX = Math.floor(this.x / ANT_PIXEL_SCALE);
    const baseY = Math.floor(this.y / ANT_PIXEL_SCALE);

    const bodyColor = this.deathAnimationStage === 1 ? '#fff' : '#2a2a2a';
    const bodyDark = this.deathAnimationStage === 1 ? '#ddd' : '#1a1a1a';
    const bodyLight = this.deathAnimationStage === 1 ? '#fff' : '#3a3a3a';
    const helmetColor = this.deathAnimationStage === 1 ? '#fff' : this.darkenColor(this.color, 30);
    const helmetLight = this.deathAnimationStage === 1 ? '#fff' : this.color;

    // During death animation stages 1-2, show the ant tumbling
    if (this.deathAnimationStage === 1 || this.deathAnimationStage === 2) {
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
      // Fallen ant wreckage (lying flat)
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect((baseX - 8) * ANT_PIXEL_SCALE, (baseY + 1) * ANT_PIXEL_SCALE, 18 * ANT_PIXEL_SCALE, 2 * ANT_PIXEL_SCALE);

      // Abdomen (flat, lying on ground)
      this.drawPixel(ctx, baseX - 6, baseY, bodyColor);
      this.drawPixel(ctx, baseX - 5, baseY, bodyColor);
      this.drawPixel(ctx, baseX - 4, baseY, bodyColor);
      this.drawPixel(ctx, baseX - 3, baseY, bodyDark);
      this.drawPixel(ctx, baseX - 5, baseY - 1, bodyLight);
      // Petiole
      this.drawPixel(ctx, baseX - 2, baseY, bodyDark);
      // Thorax
      this.drawPixel(ctx, baseX, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 1, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 2, baseY, bodyDark);
      // Head (rolled)
      this.drawPixel(ctx, baseX + 4, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 5, baseY, bodyColor);
      this.drawPixel(ctx, baseX + 6, baseY, bodyDark);
      this.drawPixel(ctx, baseX + 5, baseY - 1, bodyLight);
      // Helmet (fallen off nearby)
      this.drawPixel(ctx, baseX + 8, baseY + 1, helmetColor);
      this.drawPixel(ctx, baseX + 9, baseY + 1, helmetLight);
      this.drawPixel(ctx, baseX + 10, baseY + 1, helmetColor);
      this.drawPixel(ctx, baseX + 9, baseY, helmetColor);
      // Legs sprawled
      this.drawPixel(ctx, baseX - 5, baseY + 1, bodyDark);
      this.drawPixel(ctx, baseX - 3, baseY + 1, bodyDark);
      this.drawPixel(ctx, baseX - 1, baseY + 1, bodyDark);
      this.drawPixel(ctx, baseX + 1, baseY + 1, bodyDark);
      // Broken bazooka
      this.drawPixel(ctx, baseX - 10, baseY + 1, '#2D3A16');
      this.drawPixel(ctx, baseX - 9, baseY + 1, '#4A5D23');
      this.drawPixel(ctx, baseX - 8, baseY + 1, '#4A5D23');

      // Smoke puff
      const smokeOffset = Math.floor(Math.sin(this.idleTime * 2) * 1);
      ctx.fillStyle = 'rgba(80, 80, 80, 0.3)';
      ctx.fillRect((baseX - 1) * ANT_PIXEL_SCALE, (baseY - 3 + smokeOffset) * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE * 2, ANT_PIXEL_SCALE * 2);
      ctx.fillStyle = 'rgba(60, 60, 60, 0.2)';
      ctx.fillRect((baseX) * ANT_PIXEL_SCALE, (baseY - 5 + smokeOffset) * ANT_PIXEL_SCALE, ANT_PIXEL_SCALE, ANT_PIXEL_SCALE);
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
