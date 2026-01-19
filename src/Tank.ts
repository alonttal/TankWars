import {
  TANK_WIDTH,
  TANK_HEIGHT,
  BARREL_LENGTH,
  BARREL_WIDTH,
  BASE_HEIGHT
} from './constants.ts';
import { Terrain } from './Terrain.ts';

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
    this.y = BASE_HEIGHT - terrain.getHeightAt(this.x);
  }

  takeDamage(amount: number): void {
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

    // Draw charge particles (behind everything)
    for (const particle of this.chargeParticles) {
      const alpha = particle.life / 0.5;
      ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      // Add glow
      ctx.fillStyle = `rgba(255, 150, 50, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
      ctx.fill();
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

    // Idle bobbing animation
    const idleBob = Math.sin(this.idleTime) * 0.5;
    const tankY = this.y - TANK_HEIGHT + idleBob;

    // Power charge glow effect
    if (isCurrentPlayer && isCharging) {
      const chargeGlow = ctx.createRadialGradient(
        this.x, tankY + TANK_HEIGHT / 2, 0,
        this.x, tankY + TANK_HEIGHT / 2, TANK_WIDTH
      );
      const pulse = 0.5 + Math.sin(this.idleTime * 8) * 0.3;
      chargeGlow.addColorStop(0, `rgba(255, 200, 100, ${pulse * 0.6})`);
      chargeGlow.addColorStop(0.5, `rgba(255, 150, 50, ${pulse * 0.3})`);
      chargeGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = chargeGlow;
      ctx.beginPath();
      ctx.arc(this.x, tankY + TANK_HEIGHT / 2, TANK_WIDTH, 0, Math.PI * 2);
      ctx.fill();
    }

    // Calculate damage tinting (darken as health decreases)
    const healthPercent = this.health / 100;
    const damageDarken = Math.floor((1 - healthPercent) * 50); // Up to 50 darker

    // Damage flash effect
    let tankColor = this.color;
    let highlightColor = this.lightenColor(this.color, 40);
    let shadowColor = this.darkenColor(this.color, 40);

    // Apply damage darkening
    if (healthPercent < 1) {
      tankColor = this.darkenColor(this.color, damageDarken);
      highlightColor = this.darkenColor(this.lightenColor(this.color, 40), damageDarken);
      shadowColor = this.darkenColor(this.darkenColor(this.color, 40), damageDarken);
    }

    if (this.damageFlash > 0) {
      tankColor = '#fff';
      highlightColor = '#fff';
      shadowColor = '#ccc';
    }

    // Draw tank shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(this.x + 3, this.y + 2, TANK_WIDTH / 2 + 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw tracks (detailed with treads)
    const trackHeight = 8;
    const trackY = this.y - trackHeight + idleBob;

    // Track base (dark)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(this.x - TANK_WIDTH / 2 - 2, trackY, TANK_WIDTH + 4, trackHeight, 3);
    ctx.fill();

    // Track wheels
    ctx.fillStyle = '#333';
    const wheelCount = 5;
    const wheelSpacing = TANK_WIDTH / (wheelCount - 1);
    for (let i = 0; i < wheelCount; i++) {
      const wheelX = this.x - TANK_WIDTH / 2 + i * wheelSpacing;
      ctx.beginPath();
      ctx.arc(wheelX, trackY + trackHeight / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Track treads (animated)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    const treadOffset = (this.idleTime * 10) % 4;
    for (let i = -1; i < TANK_WIDTH / 4 + 1; i++) {
      const tx = this.x - TANK_WIDTH / 2 + i * 4 + treadOffset;
      if (tx > this.x - TANK_WIDTH / 2 - 2 && tx < this.x + TANK_WIDTH / 2 + 2) {
        ctx.beginPath();
        ctx.moveTo(tx, trackY);
        ctx.lineTo(tx, trackY + trackHeight);
        ctx.stroke();
      }
    }

    // Draw tank body (hull) with gradient shading
    const bodyGradient = ctx.createLinearGradient(
      this.x - TANK_WIDTH / 2, tankY,
      this.x - TANK_WIDTH / 2, tankY + TANK_HEIGHT
    );
    bodyGradient.addColorStop(0, highlightColor);
    bodyGradient.addColorStop(0.3, tankColor);
    bodyGradient.addColorStop(1, shadowColor);

    // Hull shape (angled front)
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    const hullLeft = this.x - TANK_WIDTH / 2;
    const hullRight = this.x + TANK_WIDTH / 2;
    ctx.moveTo(hullLeft + 5, tankY + TANK_HEIGHT);
    ctx.lineTo(hullLeft, tankY + TANK_HEIGHT - 5);
    ctx.lineTo(hullLeft, tankY + 5);
    ctx.lineTo(hullLeft + 8, tankY);
    ctx.lineTo(hullRight - 8, tankY);
    ctx.lineTo(hullRight, tankY + 5);
    ctx.lineTo(hullRight, tankY + TANK_HEIGHT - 5);
    ctx.lineTo(hullRight - 5, tankY + TANK_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Hull edge highlight
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hullLeft + 8, tankY);
    ctx.lineTo(hullRight - 8, tankY);
    ctx.stroke();

    // Hull detail lines (panels)
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x - 10, tankY + 4);
    ctx.lineTo(this.x - 10, tankY + TANK_HEIGHT - 4);
    ctx.moveTo(this.x + 10, tankY + 4);
    ctx.lineTo(this.x + 10, tankY + TANK_HEIGHT - 4);
    ctx.stroke();

    // Draw turret (rounded with detail)
    const turretWidth = TANK_WIDTH * 0.5;
    const turretHeight = 10;
    const turretY = tankY - turretHeight + 2;

    // Turret base
    const turretGradient = ctx.createLinearGradient(
      this.x, turretY,
      this.x, turretY + turretHeight
    );
    turretGradient.addColorStop(0, highlightColor);
    turretGradient.addColorStop(0.5, tankColor);
    turretGradient.addColorStop(1, shadowColor);

    ctx.fillStyle = turretGradient;
    ctx.beginPath();
    ctx.roundRect(this.x - turretWidth / 2, turretY, turretWidth, turretHeight, 4);
    ctx.fill();

    // Turret dome top
    ctx.beginPath();
    ctx.ellipse(this.x, turretY + 2, turretWidth / 3, 5, 0, Math.PI, 0);
    ctx.fill();

    // Turret hatch
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.arc(this.x, turretY + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.arc(this.x - 0.5, turretY + 2.5, 1, 0, Math.PI * 2);
    ctx.fill();

    // Draw barrel with recoil (metallic look)
    const angleRad = (this.angle * Math.PI) / 180;
    const recoiledLength = BARREL_LENGTH - this.recoilOffset;
    const barrelStartX = this.x;
    const barrelStartY = turretY + turretHeight / 2;
    const barrelEndX = barrelStartX + Math.cos(angleRad) * recoiledLength;
    const barrelEndY = barrelStartY - Math.sin(angleRad) * recoiledLength;

    // Barrel shadow
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = BARREL_WIDTH + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(barrelStartX + 1, barrelStartY + 1);
    ctx.lineTo(barrelEndX + 1, barrelEndY + 1);
    ctx.stroke();

    // Barrel main
    ctx.strokeStyle = tankColor;
    ctx.lineWidth = BARREL_WIDTH;
    ctx.beginPath();
    ctx.moveTo(barrelStartX, barrelStartY);
    ctx.lineTo(barrelEndX, barrelEndY);
    ctx.stroke();

    // Barrel highlight
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrelStartX, barrelStartY - 1);
    ctx.lineTo(barrelEndX, barrelEndY - 1);
    ctx.stroke();

    // Barrel tip ring
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 2;
    const tipX = barrelStartX + Math.cos(angleRad) * (recoiledLength - 3);
    const tipY = barrelStartY - Math.sin(angleRad) * (recoiledLength - 3);
    ctx.beginPath();
    ctx.arc(tipX, tipY, BARREL_WIDTH / 2 + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Draw muzzle flash
    if (this.muzzleFlashTime > 0) {
      const flashIntensity = this.muzzleFlashTime / 0.15;
      const flashX = this.x + Math.cos(angleRad) * BARREL_LENGTH;
      const flashY = tankY - Math.sin(angleRad) * BARREL_LENGTH;

      // Outer glow
      const gradient = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, 25 * flashIntensity);
      gradient.addColorStop(0, `rgba(255, 255, 200, ${flashIntensity})`);
      gradient.addColorStop(0.3, `rgba(255, 200, 50, ${flashIntensity * 0.8})`);
      gradient.addColorStop(0.6, `rgba(255, 100, 0, ${flashIntensity * 0.4})`);
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(flashX, flashY, 25 * flashIntensity, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity})`;
      ctx.beginPath();
      ctx.arc(flashX, flashY, 6 * flashIntensity, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw muzzle particles
    for (const particle of this.muzzleParticles) {
      const alpha = particle.life / 0.25;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw spark particles
    for (const particle of this.sparkParticles) {
      const alpha = particle.life / 0.6;
      // Sparks are bright yellow/white
      const brightness = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 50}, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Spark trail
      ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 0.02, particle.y - particle.vy * 0.02);
      ctx.stroke();
    }

    // Draw fire particles (for critical health)
    for (const particle of this.fireParticles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = lifeRatio;

      // Fire gradient colors
      const r = 255;
      const g = Math.floor(100 + lifeRatio * 100);
      const b = 0;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright core
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight current player with pulsing glow
    if (isCurrentPlayer) {
      const glowIntensity = 0.3 + Math.sin(this.glowPulse) * 0.2;

      // Pulsing glow around tank
      const glowGradient = ctx.createRadialGradient(
        this.x, tankY + TANK_HEIGHT / 2, TANK_WIDTH * 0.3,
        this.x, tankY + TANK_HEIGHT / 2, TANK_WIDTH * 1.2
      );
      glowGradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity})`);
      glowGradient.addColorStop(0.5, `rgba(255, 255, 200, ${glowIntensity * 0.5})`);
      glowGradient.addColorStop(1, 'rgba(255, 255, 150, 0)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(this.x, tankY + TANK_HEIGHT / 2, TANK_WIDTH * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Selection rectangle
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x - TANK_WIDTH / 2 - 3,
        tankY - 3,
        TANK_WIDTH + 6,
        TANK_HEIGHT + 8
      );

      // Draw player indicator arrow (animated bounce)
      const arrowBounce = Math.sin(this.idleTime * 2) * 3;
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.moveTo(this.x, tankY - 20 + arrowBounce);
      ctx.lineTo(this.x - 8, tankY - 30 + arrowBounce);
      ctx.lineTo(this.x + 8, tankY - 30 + arrowBounce);
      ctx.closePath();
      ctx.fill();
    }

    // Draw health bar
    const healthBarWidth = TANK_WIDTH;
    const healthBarHeight = 5;
    const healthBarY = tankY - 15;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(
      this.x - healthBarWidth / 2,
      healthBarY,
      healthBarWidth,
      healthBarHeight
    );

    // Health (reuse healthPercent calculated earlier)
    ctx.fillStyle = healthPercent > 0.5 ? '#4ECB71' : healthPercent > 0.25 ? '#FFD93D' : '#FF6B6B';
    ctx.fillRect(
      this.x - healthBarWidth / 2,
      healthBarY,
      healthBarWidth * healthPercent,
      healthBarHeight
    );

    // Restore context from hit reaction offset
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

    // Draw destruction debris
    for (const debris of this.destructionDebris) {
      const alpha = Math.min(1, debris.life);
      ctx.save();
      ctx.translate(debris.x, debris.y);
      ctx.rotate(debris.rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = debris.color;

      // Draw varied debris shapes
      if (debris.size > 6) {
        // Larger debris - irregular polygon
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const radius = debris.size * (0.5 + Math.random() * 0.5);
          if (i === 0) {
            ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          } else {
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Smaller debris - rectangle
        ctx.fillRect(-debris.size / 2, -debris.size / 2, debris.size, debris.size);
      }

      ctx.restore();
    }

    // During death animation stages 1-2, show the tank popping up
    if (this.deathAnimationStage === 1 || this.deathAnimationStage === 2) {
      ctx.save();
      ctx.translate(this.x, this.y + this.deathPopY);

      // Flash effect during stage 1
      if (this.deathAnimationStage === 1) {
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = this.darkenColor(this.color, 30);
      }

      // Tank body (simplified during death)
      ctx.fillRect(-TANK_WIDTH / 2, -TANK_HEIGHT, TANK_WIDTH, TANK_HEIGHT);

      // Add rotation wobble during pop
      if (this.deathAnimationStage === 2) {
        const wobble = Math.sin(this.idleTime * 15) * 0.1;
        ctx.rotate(wobble);
      }

      ctx.restore();
    } else {
      // Draw destroyed tank wreckage (smaller, darker)
      ctx.fillStyle = '#333';
      ctx.fillRect(
        this.x - TANK_WIDTH / 2,
        this.y - TANK_HEIGHT / 3,
        TANK_WIDTH,
        TANK_HEIGHT / 3
      );

      // Draw bent/broken barrel
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - TANK_HEIGHT / 3);
      ctx.lineTo(this.x + 10, this.y - TANK_HEIGHT / 3 - 5);
      ctx.lineTo(this.x + 15, this.y - TANK_HEIGHT / 3 + 3);
      ctx.stroke();

      // Continuous smoke from wreckage
      ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
      ctx.beginPath();
      ctx.arc(this.x, this.y - TANK_HEIGHT * 0.6, 12 + Math.sin(this.idleTime) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40, 40, 40, 0.3)';
      ctx.beginPath();
      ctx.arc(this.x + 5, this.y - TANK_HEIGHT * 0.9, 8 + Math.cos(this.idleTime) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Small fire flickers on wreckage
      if (Math.random() > 0.5) {
        const fireX = this.x + (Math.random() - 0.5) * TANK_WIDTH * 0.5;
        const fireY = this.y - TANK_HEIGHT * 0.4;
        ctx.fillStyle = 'rgba(255, 150, 50, 0.7)';
        ctx.beginPath();
        ctx.arc(fireX, fireY, 3 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Helper to lighten a hex color
  private lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Helper to darken a hex color
  private darkenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
    const b = Math.max(0, (num & 0x0000FF) - amount);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
