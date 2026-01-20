import { BASE_WIDTH, BASE_HEIGHT, MAX_POWER, WIND_STRENGTH_MAX, PLAYER_COLORS, updateCanvasSize, SCALE_X, SCALE_Y, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Tank } from './Tank.ts';
import { Projectile } from './Projectile.ts';
import { Explosion } from './Explosion.ts';
import { TankAI, AIDifficulty } from './AI.ts';
import { soundManager } from './Sound.ts';
import { WeaponType } from './weapons/WeaponTypes.ts';
import { BurnArea } from './weapons/BurnArea.ts';
import { PowerUpManager } from './powerups/PowerUpManager.ts';
import { POWERUP_CONFIGS } from './powerups/PowerUpTypes.ts';
import { WeaponSelector } from './ui/WeaponSelector.ts';
import { BuffIndicator } from './ui/BuffIndicator.ts';

type GameState = 'MENU' | 'PLAYING' | 'AI_THINKING' | 'FIRING' | 'PAUSED' | 'SETTINGS' | 'GAME_OVER';
type GameMode = 'single' | 'multi';

interface MenuItem {
  label: string;
  action: () => void;
}

interface PlayerStats {
  shotsFired: number;
  hits: number;
  damageDealt: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  scale: number;
  isCritical: boolean;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
}

interface Firework {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  exploded: boolean;
  color: string;
  sparks: FireworkSpark[];
}

interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private tanks: Tank[];
  private explosions: Explosion[];
  private currentPlayerIndex: number;
  private wind: number;
  private state: GameState;
  private winner: Tank | null;
  private gameMode: GameMode;
  private ai: TankAI | null;
  private aiThinkingTimer: number;
  private aiShot: { angle: number; power: number } | null;

  // Menu
  private menuItems: MenuItem[];
  private selectedMenuItem: number;

  // Pause menu
  private pauseMenuItems: MenuItem[];
  private selectedPauseItem: number;
  private stateBeforePause: GameState;

  // Settings menu
  private selectedSettingIndex: number;
  private settingsOptions: string[];

  // UI Elements
  private angleSlider: HTMLInputElement;
  private powerSlider: HTMLInputElement;
  private angleValue: HTMLSpanElement;
  private powerValue: HTMLSpanElement;
  private fireButton: HTMLButtonElement;
  private currentPlayerSpan: HTMLSpanElement;
  private windInfo: HTMLSpanElement;
  private musicButton: HTMLButtonElement;

  // Power charging
  private isChargingPower: boolean;
  private powerDirection: number; // 1 = increasing, -1 = decreasing

  // Screen shake
  private shakeIntensity: number;
  private shakeOffsetX: number;
  private shakeOffsetY: number;

  // Screen flash
  private screenFlashIntensity: number;
  private screenFlashColor: string;

  // Hitstop (time slowdown on impact)
  private hitstopTimer: number;

  // Camera effects
  private cameraZoom: number;
  private targetCameraZoom: number;
  private cameraOffsetX: number;
  private cameraOffsetY: number;
  private targetCameraOffsetX: number;
  private targetCameraOffsetY: number;

  // Turn timer
  private turnTimeRemaining: number;
  private maxTurnTime: number;

  // Statistics
  private playerStats: PlayerStats[];

  // Floating damage numbers
  private floatingTexts: FloatingText[];

  // Victory confetti
  private confetti: ConfettiParticle[];

  // Victory fireworks
  private fireworks: Firework[];
  private fireworkSpawnTimer: number;

  private lastTime: number;

  // Trajectory preview
  private trajectoryPoints: { x: number; y: number }[];

  // HUD health bar animations
  private hudHealthAnimations: { current: number; target: number }[];

  // Turn transition
  private turnBannerAlpha: number;
  private turnBannerText: string;
  private turnBannerTimer: number;

  // Menu transition
  private menuTitlePulse: number;
  private menuItemsSlideIn: number[];
  private gameOverSlideIn: number;

  // Weapon and Power-up systems
  private projectiles: Projectile[]; // Multiple projectiles for cluster/double shot
  private burnAreas: BurnArea[];
  private powerUpManager: PowerUpManager;
  private weaponSelector: WeaponSelector;
  private buffIndicator: BuffIndicator;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    // Set up responsive canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.terrain = new Terrain();
    this.tanks = [];
    this.explosions = [];
    this.currentPlayerIndex = 0;
    this.wind = 0;
    this.state = 'MENU';
    this.winner = null;
    this.gameMode = 'single';
    this.ai = null;
    this.aiThinkingTimer = 0;
    this.aiShot = null;
    this.isChargingPower = false;
    this.powerDirection = 1;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.screenFlashIntensity = 0;
    this.screenFlashColor = '#FFF';
    this.hitstopTimer = 0;
    this.cameraZoom = 1;
    this.targetCameraZoom = 1;
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.targetCameraOffsetX = 0;
    this.targetCameraOffsetY = 0;
    this.maxTurnTime = 30; // 30 seconds per turn
    this.turnTimeRemaining = this.maxTurnTime;
    this.playerStats = [];
    this.floatingTexts = [];
    this.confetti = [];
    this.fireworks = [];
    this.fireworkSpawnTimer = 0;
    this.lastTime = 0;
    this.trajectoryPoints = [];
    this.hudHealthAnimations = [];
    this.turnBannerAlpha = 0;
    this.turnBannerText = '';
    this.turnBannerTimer = 0;
    this.menuTitlePulse = 0;
    this.menuItemsSlideIn = [];
    this.gameOverSlideIn = 0;

    // Initialize weapon and power-up systems
    this.projectiles = [];
    this.burnAreas = [];
    this.powerUpManager = new PowerUpManager();
    this.weaponSelector = new WeaponSelector();
    this.buffIndicator = new BuffIndicator();

    // Setup weapon selector callback
    this.weaponSelector.setOnWeaponSelect((weapon: WeaponType) => {
      if (this.state === 'PLAYING' && !this.isAITurn()) {
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank && tank.selectWeapon(weapon)) {
          this.weaponSelector.update(tank);
          soundManager.playMenuSelect();
        }
      }
    });

    // Initially hide weapon selector and buff indicator
    this.weaponSelector.hide();
    this.buffIndicator.hide();

    // Menu setup
    this.selectedMenuItem = 0;
    this.menuItems = [
      { label: 'SINGLE PLAYER', action: () => this.startGame('single', 'medium') },
      { label: 'MULTIPLAYER', action: () => this.startGame('multi') },
    ];

    // Pause menu setup
    this.selectedPauseItem = 0;
    this.stateBeforePause = 'PLAYING';
    this.pauseMenuItems = [
      { label: 'RESUME', action: () => this.resumeGame() },
      { label: 'SETTINGS', action: () => this.openSettings() },
      { label: 'QUIT TO MENU', action: () => this.quitToMenu() },
    ];

    // Settings menu
    this.selectedSettingIndex = 0;
    this.settingsOptions = ['Master Volume', 'Music Volume', 'SFX Volume', 'Back'];

    // Get UI elements
    this.angleSlider = document.getElementById('angle-slider') as HTMLInputElement;
    this.powerSlider = document.getElementById('power-slider') as HTMLInputElement;
    this.angleValue = document.getElementById('angle-value') as HTMLSpanElement;
    this.powerValue = document.getElementById('power-value') as HTMLSpanElement;
    this.fireButton = document.getElementById('fire-btn') as HTMLButtonElement;
    this.currentPlayerSpan = document.getElementById('current-player') as HTMLSpanElement;
    this.windInfo = document.getElementById('wind-info') as HTMLSpanElement;
    this.musicButton = document.getElementById('music-btn') as HTMLButtonElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Slider updates
    this.angleSlider.addEventListener('input', () => {
      const angle = parseInt(this.angleSlider.value);
      this.angleValue.textContent = angle.toString();
      if (this.tanks[this.currentPlayerIndex]) {
        this.tanks[this.currentPlayerIndex].angle = angle;
      }
    });

    this.powerSlider.addEventListener('input', () => {
      this.powerValue.textContent = this.powerSlider.value;
    });

    // Fire button
    this.fireButton.addEventListener('click', () => this.fire());

    // Music toggle button
    this.musicButton.addEventListener('click', () => {
      const enabled = soundManager.toggleMusic();
      this.musicButton.textContent = enabled ? '🎵 ON' : '🎵 OFF';
      this.musicButton.classList.toggle('off', !enabled);
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      // ESC to toggle pause or go back
      if (e.key === 'Escape') {
        if (this.state === 'SETTINGS') {
          this.state = 'PAUSED';
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        } else if (this.state === 'PLAYING' || this.state === 'AI_THINKING') {
          this.pauseGame();
        }
        return;
      }

      if (this.state === 'MENU') {
        this.handleMenuInput(e);
        return;
      }

      if (this.state === 'PAUSED') {
        this.handlePauseMenuInput(e);
        return;
      }

      if (this.state === 'SETTINGS') {
        this.handleSettingsInput(e);
        return;
      }

      if (this.state === 'GAME_OVER') {
        if (e.key === 'Enter' || e.key === ' ') {
          this.state = 'MENU';
          this.selectedMenuItem = 0;
          // Reset menu animations
          this.menuTitlePulse = 0;
          this.menuItemsSlideIn = [];
        }
        return;
      }

      if (this.state !== 'PLAYING') return;

      // Don't allow input during AI turn
      if (this.isAITurn()) return;

      switch (e.key) {
        case 'ArrowLeft':
          this.angleSlider.value = Math.min(180, parseInt(this.angleSlider.value) + 1).toString();
          this.angleSlider.dispatchEvent(new Event('input'));
          break;
        case 'ArrowRight':
          this.angleSlider.value = Math.max(0, parseInt(this.angleSlider.value) - 1).toString();
          this.angleSlider.dispatchEvent(new Event('input'));
          break;
        case ' ':
          e.preventDefault();
          // Start charging power from zero
          if (!this.isChargingPower) {
            this.isChargingPower = true;
            this.powerDirection = 1;
            this.powerSlider.value = '0';
            this.powerSlider.dispatchEvent(new Event('input'));
            soundManager.startCharging();
          }
          break;
        case 'Enter':
          e.preventDefault();
          this.fire();
          break;
        case 'm':
        case 'M':
          // Toggle music
          const enabled = soundManager.toggleMusic();
          this.musicButton.textContent = enabled ? '🎵 ON' : '🎵 OFF';
          this.musicButton.classList.toggle('off', !enabled);
          break;
      }
    });

    // Handle space release to fire
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
        e.preventDefault();
        this.isChargingPower = false;
        soundManager.stopCharging();
        this.fire();
      }
    });

    // Canvas click for menu
    this.canvas.addEventListener('click', (e) => {
      if (this.state === 'MENU') {
        const rect = this.canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const menuStartY = 260;
        const itemHeight = 40;

        for (let i = 0; i < this.menuItems.length; i++) {
          const itemY = menuStartY + i * itemHeight;
          if (y >= itemY - 15 && y <= itemY + 15) {
            this.menuItems[i].action();
            return;
          }
        }
      } else if (this.state === 'GAME_OVER') {
        this.state = 'MENU';
        this.selectedMenuItem = 0;
        // Reset menu animations
        this.menuTitlePulse = 0;
        this.menuItemsSlideIn = [];
      }
    });
  }

  private handleMenuInput(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp':
        this.selectedMenuItem = (this.selectedMenuItem - 1 + this.menuItems.length) % this.menuItems.length;
        soundManager.playMenuSelect();
        break;
      case 'ArrowDown':
        this.selectedMenuItem = (this.selectedMenuItem + 1) % this.menuItems.length;
        soundManager.playMenuSelect();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        soundManager.playMenuSelect();
        this.menuItems[this.selectedMenuItem].action();
        break;
    }
  }

  private handlePauseMenuInput(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp':
        this.selectedPauseItem = (this.selectedPauseItem - 1 + this.pauseMenuItems.length) % this.pauseMenuItems.length;
        soundManager.playMenuSelect();
        break;
      case 'ArrowDown':
        this.selectedPauseItem = (this.selectedPauseItem + 1) % this.pauseMenuItems.length;
        soundManager.playMenuSelect();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        soundManager.playMenuSelect();
        this.pauseMenuItems[this.selectedPauseItem].action();
        break;
    }
  }

  private pauseGame(): void {
    this.stateBeforePause = this.state;
    this.state = 'PAUSED';
    this.selectedPauseItem = 0;
  }

  private resumeGame(): void {
    this.state = this.stateBeforePause;
  }

  private quitToMenu(): void {
    this.state = 'MENU';
    this.selectedMenuItem = 0;
    soundManager.stopMusic();
    // Hide UI elements
    this.weaponSelector.hide();
    this.buffIndicator.hide();
    // Reset menu animations
    this.menuTitlePulse = 0;
    this.menuItemsSlideIn = [];
  }

  private openSettings(): void {
    this.state = 'SETTINGS';
    this.selectedSettingIndex = 0;
  }

  private handleSettingsInput(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp':
        this.selectedSettingIndex = (this.selectedSettingIndex - 1 + this.settingsOptions.length) % this.settingsOptions.length;
        soundManager.playMenuSelect();
        break;
      case 'ArrowDown':
        this.selectedSettingIndex = (this.selectedSettingIndex + 1) % this.settingsOptions.length;
        soundManager.playMenuSelect();
        break;
      case 'ArrowLeft':
        this.adjustVolume(-10);
        break;
      case 'ArrowRight':
        this.adjustVolume(10);
        break;
      case 'Enter':
      case ' ':
        if (this.settingsOptions[this.selectedSettingIndex] === 'Back') {
          this.state = 'PAUSED';
        }
        break;
    }
  }

  private adjustVolume(delta: number): void {
    switch (this.settingsOptions[this.selectedSettingIndex]) {
      case 'Master Volume':
        soundManager.setMasterVolume(soundManager.getMasterVolume() + delta);
        break;
      case 'Music Volume':
        soundManager.setMusicVolume(soundManager.getMusicVolume() + delta);
        break;
      case 'SFX Volume':
        soundManager.setSfxVolume(soundManager.getSfxVolume() + delta);
        soundManager.playMenuSelect(); // Play sound for feedback
        break;
    }
  }

  private isAITurn(): boolean {
    return this.gameMode === 'single' && this.currentPlayerIndex === 1;
  }

  private resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width;
    this.canvas.height = height;

    updateCanvasSize(width, height);
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  private update(deltaTime: number): void {
    // Handle hitstop (time slowdown)
    let effectiveDelta = deltaTime;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= deltaTime;
      effectiveDelta = deltaTime * 0.1; // 10% speed during hitstop
      if (this.hitstopTimer <= 0) {
        this.hitstopTimer = 0;
      }
    }

    // Update screen shake
    this.updateScreenShake(deltaTime);

    // Update screen flash
    if (this.screenFlashIntensity > 0) {
      this.screenFlashIntensity -= deltaTime * 3; // Fade out over ~0.33 seconds
      if (this.screenFlashIntensity < 0) this.screenFlashIntensity = 0;
    }

    // Smooth camera zoom and offset with eased interpolation
    const cameraLerpFactor = Math.min(1, deltaTime * 4);
    const zoomDiff = this.targetCameraZoom - this.cameraZoom;
    const xDiff = this.targetCameraOffsetX - this.cameraOffsetX;
    const yDiff = this.targetCameraOffsetY - this.cameraOffsetY;
    this.cameraZoom += zoomDiff * this.easeOutCubic(cameraLerpFactor);
    this.cameraOffsetX += xDiff * this.easeOutCubic(cameraLerpFactor);
    this.cameraOffsetY += yDiff * this.easeOutCubic(cameraLerpFactor);

    // Update terrain (clouds, wind particles)
    this.terrain.update(effectiveDelta, this.wind);

    // Update turn timer (only during human player's turn)
    if (this.state === 'PLAYING' && !this.isAITurn()) {
      this.turnTimeRemaining -= deltaTime;
      if (this.turnTimeRemaining <= 0) {
        this.turnTimeRemaining = 0;
        // Auto-fire with random power
        this.powerSlider.value = Math.floor(20 + Math.random() * 60).toString();
        this.powerSlider.dispatchEvent(new Event('input'));
        this.fire();
      }
    }

    // Handle power charging when holding space
    if (this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
      const currentPower = parseInt(this.powerSlider.value);
      const powerSpeed = 100; // Power units per second
      const powerChange = powerSpeed * deltaTime * this.powerDirection;
      let newPower = currentPower + powerChange;

      // Bounce between 0 and 100
      if (newPower >= 100) {
        newPower = 100;
        this.powerDirection = -1;
      } else if (newPower <= 0) {
        newPower = 0;
        this.powerDirection = 1;
      }

      this.powerSlider.value = Math.round(newPower).toString();
      this.powerSlider.dispatchEvent(new Event('input'));
      soundManager.updateChargingPitch(newPower);

      // Update tank charging particles
      const tank = this.tanks[this.currentPlayerIndex];
      if (tank) {
        tank.updateCharging(deltaTime, newPower);
      }
    }

    // Update tanks (smoke particles, damage flash)
    for (const tank of this.tanks) {
      tank.update(effectiveDelta);
    }


    // Update turn banner fade
    if (this.turnBannerTimer > 0) {
      this.turnBannerTimer -= deltaTime;
      if (this.turnBannerTimer <= 0.5) {
        this.turnBannerAlpha = this.turnBannerTimer / 0.5; // Fade out in last 0.5s
      }
      if (this.turnBannerTimer <= 0) {
        this.turnBannerAlpha = 0;
      }
    }

    // Update menu animations
    this.menuTitlePulse += deltaTime * 2;

    // Update menu item slide-in animations
    if (this.state === 'MENU') {
      // Initialize slide-in values if needed
      if (this.menuItemsSlideIn.length !== this.menuItems.length) {
        this.menuItemsSlideIn = this.menuItems.map(() => 0);
      }
      // Animate each item sliding in with staggered timing
      for (let i = 0; i < this.menuItemsSlideIn.length; i++) {
        const target = 1;
        const speed = 4;
        const delay = i * 0.1; // Stagger delay
        if (this.menuTitlePulse > delay) {
          this.menuItemsSlideIn[i] += (target - this.menuItemsSlideIn[i]) * Math.min(1, deltaTime * speed);
        }
      }
    }

    // Update game over slide-in animation
    if (this.state === 'GAME_OVER') {
      this.gameOverSlideIn += (1 - this.gameOverSlideIn) * Math.min(1, deltaTime * 3);
    } else {
      this.gameOverSlideIn = 0;
    }

    if (this.state === 'AI_THINKING') {
      this.aiThinkingTimer -= deltaTime * 1000;

      if (this.aiThinkingTimer <= 0 && this.aiShot) {
        // AI fires
        this.executeAIShot();
      }
    }

    if (this.state === 'FIRING') {
      // Update all projectiles
      const newProjectiles: Projectile[] = [];
      let anyActiveProjectile = false;
      let cameraFollowProjectile: Projectile | null = null;

      for (const projectile of this.projectiles) {
        const result = projectile.update(effectiveDelta, this.terrain, this.tanks, this.wind);

        // Track if any projectile is still active for camera
        if (projectile.active) {
          anyActiveProjectile = true;
          cameraFollowProjectile = projectile;
        }

        // Handle cluster bomb splitting
        if (result.shouldCluster) {
          const weaponConfig = projectile.weaponConfig;
          soundManager.playClusterSplit(); // Cluster split sound

          // Spawn cluster bomblets
          for (let i = 0; i < weaponConfig.clusterCount; i++) {
            const spreadAngle = ((i / weaponConfig.clusterCount) * Math.PI * 2) - Math.PI / 2;
            const spreadSpeed = 50 + Math.random() * 30;

            // Create bomblet config (smaller explosion, cluster damage)
            const bombletConfig = { ...weaponConfig };
            bombletConfig.damage = weaponConfig.clusterDamage;
            bombletConfig.explosionRadius = 20;

            const bomblet = new Projectile(
              result.clusterX,
              result.clusterY,
              0, // Angle doesn't matter, we set velocity directly
              0,
              this.wind,
              projectile.owner,
              bombletConfig,
              true // isClusterBomblet
            );

            // Override velocity for spread pattern
            bomblet.vx = result.clusterVx + Math.cos(spreadAngle) * spreadSpeed;
            bomblet.vy = result.clusterVy + Math.sin(spreadAngle) * spreadSpeed - 30;

            newProjectiles.push(bomblet);
          }
        }

        if (!result.active && result.hit) {
          this.handleProjectileHit(projectile, result.hitX, result.hitY);
        }
      }

      // Add new cluster bomblets to active projectiles
      this.projectiles.push(...newProjectiles);

      // Remove inactive projectiles (but keep them around for trail rendering)
      this.projectiles = this.projectiles.filter(p =>
        p.active ||
        p.trail.length > 0 ||
        p.trailParticles.length > 0 ||
        p.impactParticles.length > 0
      );

      // Camera follows active projectile with slight lag
      if (cameraFollowProjectile) {
        this.targetCameraOffsetX = (BASE_WIDTH / 2 - cameraFollowProjectile.x) * 0.15;
        this.targetCameraOffsetY = (BASE_HEIGHT / 2 - cameraFollowProjectile.y) * 0.15;
        this.targetCameraZoom = 1.05;
      } else if (!anyActiveProjectile) {
        // Reset camera when no active projectiles
        this.targetCameraZoom = 1;
        this.targetCameraOffsetX = 0;
        this.targetCameraOffsetY = 0;
      }

      // Update burn areas
      for (const burnArea of this.burnAreas) {
        burnArea.update(effectiveDelta, this.tanks, this.terrain);
      }
      this.burnAreas = this.burnAreas.filter(b => !b.isComplete());

      // Update explosions
      for (const explosion of this.explosions) {
        explosion.update(effectiveDelta);
      }
      this.explosions = this.explosions.filter(e => e.active);

      // Update floating texts
      for (const ft of this.floatingTexts) {
        ft.y += ft.vy * effectiveDelta;
        ft.vy += 10 * effectiveDelta; // Slight deceleration
        ft.life -= effectiveDelta;
      }
      this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);

      // Update confetti and fireworks
      this.updateConfetti(effectiveDelta);
      this.updateFireworks(effectiveDelta);

      // Check if firing phase is complete (no active projectiles, no explosions, no burn areas)
      const hasActiveProjectiles = this.projectiles.some(p => p.active);
      if (!hasActiveProjectiles && this.explosions.length === 0 && this.burnAreas.length === 0) {
        this.endTurn();
      }
    }

    // Update power-ups (even when not firing)
    if (this.state === 'PLAYING' || this.state === 'FIRING') {
      const collected = this.powerUpManager.update(effectiveDelta, this.tanks);
      if (collected) {
        soundManager.playPowerUpCollect(); // Power-up collection sound
        this.buffIndicator.update(collected.tank);

        // Show floating text for power-up
        const config = POWERUP_CONFIGS[collected.type];
        this.floatingTexts.push({
          x: collected.tank.x,
          y: collected.tank.y - 50,
          text: `+${config.name}`,
          color: config.color,
          life: 1.5,
          maxLife: 1.5,
          vy: -40,
          scale: 1.2,
          isCritical: false,
        });
      }
    }
  }

  private handleProjectileHit(projectile: Projectile, hitX: number, hitY: number): void {
    const weaponConfig = projectile.weaponConfig;

    // Track health before explosion
    const healthBefore = this.tanks.map(t => t.health);
    const shooterIndex = projectile.owner.playerIndex;

    // Get damage multiplier from shooter's buffs
    const damageMultiplier = projectile.owner.getDamageMultiplier();
    const finalDamage = Math.floor(weaponConfig.damage * damageMultiplier);

    // Create explosion with weapon-specific parameters
    const explosion = new Explosion(hitX, hitY, weaponConfig.explosionRadius, finalDamage);
    explosion.applyDamageWithConfig(
      this.tanks,
      this.terrain,
      projectile.owner,
      weaponConfig.explosionRadius,
      finalDamage,
      weaponConfig.craterDepthMultiplier
    );
    this.explosions.push(explosion);
    soundManager.playExplosion();

    // Consume damage boost after hit
    projectile.owner.consumeDamageBoost();

    // Create burn area for napalm
    if (weaponConfig.type === 'napalm') {
      this.burnAreas.push(new BurnArea(
        hitX,
        hitY,
        weaponConfig.explosionRadius,
        weaponConfig.burnDuration,
        weaponConfig.burnDamagePerSecond
      ));
    }

    // Trigger hitstop for impact feel
    this.triggerHitstop(0.08);

    // Screen shake proportional to explosion size
    const shakeIntensity = 10 + (weaponConfig.explosionRadius / 35) * 8;
    this.triggerScreenShake(shakeIntensity);
    this.triggerScreenFlash('#FFA500', 0.5);

    // Track damage dealt and hits
    let totalDamage = 0;
    let hitCount = 0;
    for (let i = 0; i < this.tanks.length; i++) {
      if (i !== shooterIndex) {
        const damage = healthBefore[i] - this.tanks[i].health;
        if (damage > 0) {
          totalDamage += damage;
          hitCount++;

          // Spawn floating damage number
          const isCritical = damage >= 40;
          this.floatingTexts.push({
            x: this.tanks[i].x,
            y: this.tanks[i].y - 40,
            text: isCritical ? `CRITICAL! -${damage}` : `-${damage}`,
            color: isCritical ? '#FF0000' : '#FF6B6B',
            life: isCritical ? 2.0 : 1.5,
            maxLife: isCritical ? 2.0 : 1.5,
            vy: isCritical ? -50 : -30,
            scale: isCritical ? 1.5 : 1.0,
            isCritical,
          });
        }
      }
    }
    if (hitCount > 0) {
      this.playerStats[shooterIndex].hits++;
    }
    this.playerStats[shooterIndex].damageDealt += totalDamage;
  }

  private render(): void {
    // Clear canvas (use actual canvas size)
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Apply scaling for game rendering
    this.ctx.save();
    this.ctx.scale(SCALE_X, SCALE_Y);

    // Apply camera zoom and offset (centered)
    if (this.cameraZoom !== 1 || this.cameraOffsetX !== 0 || this.cameraOffsetY !== 0) {
      this.ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
      this.ctx.scale(this.cameraZoom, this.cameraZoom);
      this.ctx.translate(-BASE_WIDTH / 2 + this.cameraOffsetX, -BASE_HEIGHT / 2 + this.cameraOffsetY);
    }

    // Apply screen shake offset
    if (this.shakeIntensity > 0) {
      this.ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    if (this.state === 'MENU') {
      this.renderMenu();
      this.ctx.restore();
      return;
    }

    // Render terrain
    this.terrain.render(this.ctx);


    // Render tanks
    for (let i = 0; i < this.tanks.length; i++) {
      const isCurrentAndPlaying = i === this.currentPlayerIndex &&
        (this.state === 'PLAYING' || this.state === 'AI_THINKING');
      this.tanks[i].render(this.ctx, isCurrentAndPlaying, this.isChargingPower);
    }

    // Render power meter above tank when charging
    if (this.isChargingPower) {
      this.renderPowerMeter();
    }

    // Render power-ups
    this.powerUpManager.render(this.ctx);

    // Render burn areas (behind projectiles)
    for (const burnArea of this.burnAreas) {
      burnArea.render(this.ctx);
    }

    // Render all projectiles
    for (const projectile of this.projectiles) {
      projectile.render(this.ctx);
    }

    // Render explosions
    for (const explosion of this.explosions) {
      explosion.render(this.ctx);
    }

    // Render floating damage numbers with effects
    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.5));
      const lifeRatio = ft.life / ft.maxLife;

      // Scale animation - pop in then shrink
      let currentScale = ft.scale;
      if (lifeRatio > 0.8) {
        currentScale *= 1.0 + (1.0 - (lifeRatio - 0.8) / 0.2) * 0.3; // Pop effect
      }

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(ft.x, ft.y);
      this.ctx.scale(currentScale, currentScale);

      // Critical hit shake effect
      if (ft.isCritical && lifeRatio > 0.5) {
        const shake = (Math.random() - 0.5) * 4;
        this.ctx.translate(shake, shake);
      }

      this.ctx.fillStyle = ft.color;
      this.ctx.font = 'bold 18px "Courier New"';
      this.ctx.textAlign = 'center';

      // Outline for better visibility
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(ft.text, 0, 0);
      this.ctx.fillText(ft.text, 0, 0);

      this.ctx.restore();
    }

    // Render wind indicator arrow (top right)
    if (this.state === 'PLAYING' || this.state === 'AI_THINKING' || this.state === 'FIRING') {
      this.renderWindArrow();
    }

    // Render HUD health bars
    if (this.state === 'PLAYING' || this.state === 'AI_THINKING' || this.state === 'FIRING') {
      this.renderHUDHealthBars();
    }

    // Render turn banner
    if (this.turnBannerAlpha > 0) {
      this.renderTurnBanner();
    }

    // Render turn timer (during human turns)
    if ((this.state === 'PLAYING' || this.state === 'AI_THINKING') && !this.isAITurn()) {
      this.renderTurnTimer();
    }

    // Render AI thinking indicator
    if (this.state === 'AI_THINKING') {
      this.renderAIThinking();
    }

    // Render game over
    if (this.state === 'GAME_OVER') {
      this.renderGameOver();
      this.renderConfetti();
      this.renderFireworks();
      this.updateConfetti(0.016); // Continue animating confetti
      this.updateFireworks(0.016); // Continue animating fireworks
    }

    // Render pause menu
    if (this.state === 'PAUSED') {
      this.renderPauseMenu();
    }

    // Render settings menu
    if (this.state === 'SETTINGS') {
      this.renderSettings();
    }

    // Render screen flash overlay
    if (this.screenFlashIntensity > 0) {
      this.ctx.fillStyle = this.screenFlashColor;
      this.ctx.globalAlpha = this.screenFlashIntensity;
      this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
      this.ctx.globalAlpha = 1;
    }

    this.ctx.restore();
  }

  private renderMenu(): void {
    // Background with gradient
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(0.5, '#16213e');
    bgGradient.addColorStop(1, '#0f0f1a');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Animated background particles
    this.ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(this.menuTitlePulse + i * 0.5) * 0.5 + 0.5) * BASE_WIDTH;
      const y = ((this.menuTitlePulse * 0.1 + i * 0.1) % 1) * BASE_HEIGHT;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2 + Math.sin(i) * 1, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Title with glow and pulse effect
    const titleScale = 1 + Math.sin(this.menuTitlePulse) * 0.02;
    const titleGlow = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.3;

    this.ctx.save();
    this.ctx.translate(BASE_WIDTH / 2, 120);
    this.ctx.scale(titleScale, titleScale);

    // Title glow
    this.ctx.shadowColor = '#ff6b6b';
    this.ctx.shadowBlur = 20 * titleGlow;
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.font = 'bold 48px "Courier New"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('TANK WARS', 0, 0);
    this.ctx.shadowBlur = 0;
    this.ctx.restore();

    // Subtitle
    this.ctx.fillStyle = '#6bcfff';
    this.ctx.font = '24px "Courier New"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Artillery Game', BASE_WIDTH / 2, 160);

    // Menu items with slide-in animation
    const menuStartY = 260;
    const itemHeight = 40;

    for (let i = 0; i < this.menuItems.length; i++) {
      const slideProgress = this.menuItemsSlideIn[i] || 0;
      const slideOffset = (1 - this.easeOutCubic(slideProgress)) * 100;
      const alpha = slideProgress;

      const y = menuStartY + i * itemHeight;
      const isSelected = i === this.selectedMenuItem;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(slideOffset, 0);

      if (isSelected) {
        // Animated selection indicator
        const selectorPulse = Math.sin(this.menuTitlePulse * 3) * 3;
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillText('>', BASE_WIDTH / 2 - 120 + selectorPulse, y);

        // Selection glow
        this.ctx.shadowColor = '#fff';
        this.ctx.shadowBlur = 10;
      }

      this.ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      this.ctx.font = `${isSelected ? 'bold ' : ''}18px "Courier New"`;
      this.ctx.fillText(this.menuItems[i].label, BASE_WIDTH / 2, y);
      this.ctx.shadowBlur = 0;

      this.ctx.restore();
    }

    // Instructions with fade in
    const instructAlpha = Math.min(1, this.menuTitlePulse / 2);
    this.ctx.globalAlpha = instructAlpha;
    this.ctx.fillStyle = '#666';
    this.ctx.font = '12px "Courier New"';
    this.ctx.fillText('Arrow Keys to Select, Enter to Start', BASE_WIDTH / 2, 440);
    this.ctx.fillText('In-game: Left/Right = Aim, Hold Space = Charge Power, Release = Fire', BASE_WIDTH / 2, 460);
    this.ctx.globalAlpha = 1;

    // Draw decorative tanks with slight animation
    const tankBob = Math.sin(this.menuTitlePulse * 2) * 2;
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.fillRect(150, 200 + tankBob, 40, 20);
    this.ctx.fillStyle = '#4ECB71';
    this.ctx.fillRect(610, 200 - tankBob, 40, 20);
  }

  private renderTurnTimer(): void {
    const barWidth = 200;
    const barHeight = 12;
    const barX = BASE_WIDTH / 2 - barWidth / 2;
    const barY = 15;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    // Timer bar
    const timeRatio = this.turnTimeRemaining / this.maxTurnTime;
    const fillWidth = barWidth * timeRatio;

    // Color based on time remaining
    let color: string;
    if (timeRatio > 0.5) {
      color = '#4ECB71'; // Green
    } else if (timeRatio > 0.25) {
      color = '#FFD93D'; // Yellow
    } else {
      color = '#FF6B6B'; // Red
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Border
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Time text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px "Courier New"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.ceil(this.turnTimeRemaining)}s`, BASE_WIDTH / 2, barY + barHeight + 12);
  }

  private renderAIThinking(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(BASE_WIDTH / 2 - 100, 20, 200, 40);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px "Courier New"';
    this.ctx.textAlign = 'center';

    const dots = '.'.repeat(Math.floor((Date.now() / 300) % 4));
    this.ctx.fillText(`CPU Thinking${dots}`, BASE_WIDTH / 2, 45);
  }

  private renderGameOver(): void {
    // Overlay with fade in
    const overlayAlpha = this.easeOutCubic(this.gameOverSlideIn) * 0.85;
    this.ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
    this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    this.ctx.textAlign = 'center';

    // Winner announcement with scale/glow animation
    let titleY = 80;
    const titleSlide = this.easeOutElastic(Math.min(1, this.gameOverSlideIn * 1.5));
    const titleScale = 0.5 + titleSlide * 0.5;
    const titleGlow = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.5;

    this.ctx.save();
    this.ctx.translate(BASE_WIDTH / 2, titleY);
    this.ctx.scale(titleScale, titleScale);
    this.ctx.globalAlpha = this.gameOverSlideIn;

    if (this.winner) {
      const winnerLabel = this.gameMode === 'single'
        ? (this.winner.playerIndex === 0 ? 'YOU WIN!' : 'CPU WINS!')
        : `PLAYER ${this.winner.playerIndex + 1} WINS!`;

      // Glow effect
      this.ctx.shadowColor = this.winner.color;
      this.ctx.shadowBlur = 20 * titleGlow;
      this.ctx.fillStyle = this.winner.color;
      this.ctx.font = 'bold 36px "Courier New"';
      this.ctx.fillText(winnerLabel, 0, 0);
      this.ctx.shadowBlur = 0;
    } else {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 36px "Courier New"';
      this.ctx.fillText('DRAW!', 0, 0);
    }
    this.ctx.restore();

    // Statistics header with slide in
    const statsSlideDelay = 0.3;
    const statsProgress = Math.max(0, (this.gameOverSlideIn - statsSlideDelay) / (1 - statsSlideDelay));
    const statsSlide = this.easeOutCubic(statsProgress);

    this.ctx.save();
    this.ctx.globalAlpha = statsProgress;
    this.ctx.translate((1 - statsSlide) * -50, 0);

    this.ctx.fillStyle = '#6bcfff';
    this.ctx.font = 'bold 20px "Courier New"';
    this.ctx.fillText('MATCH STATISTICS', BASE_WIDTH / 2, titleY + 60);

    // Stats table
    const statsY = titleY + 100;
    const colWidth = 180;
    const p1X = BASE_WIDTH / 2 - colWidth;
    const p2X = BASE_WIDTH / 2 + colWidth;

    // Player labels
    this.ctx.font = 'bold 16px "Courier New"';
    this.ctx.fillStyle = this.tanks[0]?.color || '#FF6B6B';
    this.ctx.fillText(this.gameMode === 'single' ? 'YOU' : 'PLAYER 1', p1X, statsY);
    this.ctx.fillStyle = this.tanks[1]?.color || '#4ECB71';
    this.ctx.fillText(this.gameMode === 'single' ? 'CPU' : 'PLAYER 2', p2X, statsY);

    // Stats rows with staggered slide in
    this.ctx.font = '14px "Courier New"';
    const stats = [
      { label: 'Shots Fired', key: 'shotsFired' as keyof PlayerStats },
      { label: 'Hits', key: 'hits' as keyof PlayerStats },
      { label: 'Damage Dealt', key: 'damageDealt' as keyof PlayerStats },
      { label: 'Accuracy', key: 'accuracy' as const },
    ];

    let rowY = statsY + 30;
    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const rowDelay = 0.4 + i * 0.1;
      const rowProgress = Math.max(0, (this.gameOverSlideIn - rowDelay) / (1 - rowDelay));
      const rowAlpha = this.easeOutCubic(rowProgress);
      const rowOffset = (1 - rowAlpha) * 30;

      this.ctx.save();
      this.ctx.globalAlpha = rowAlpha;
      this.ctx.translate(0, rowOffset);

      // Label
      this.ctx.fillStyle = '#aaa';
      this.ctx.fillText(stat.label, BASE_WIDTH / 2, rowY);

      // Values
      this.ctx.fillStyle = '#fff';
      if (stat.key === 'accuracy') {
        const acc1 = this.playerStats[0]?.shotsFired > 0
          ? Math.round((this.playerStats[0].hits / this.playerStats[0].shotsFired) * 100)
          : 0;
        const acc2 = this.playerStats[1]?.shotsFired > 0
          ? Math.round((this.playerStats[1].hits / this.playerStats[1].shotsFired) * 100)
          : 0;
        this.ctx.fillText(`${acc1}%`, p1X, rowY);
        this.ctx.fillText(`${acc2}%`, p2X, rowY);
      } else {
        this.ctx.fillText(String(this.playerStats[0]?.[stat.key] ?? 0), p1X, rowY);
        this.ctx.fillText(String(this.playerStats[1]?.[stat.key] ?? 0), p2X, rowY);
      }

      this.ctx.restore();
      rowY += 25;
    }

    this.ctx.restore();

    // Continue prompt with pulsing
    const promptAlpha = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.3;
    this.ctx.globalAlpha = this.gameOverSlideIn * promptAlpha;
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px "Courier New"';
    this.ctx.fillText('Press Enter to Continue', BASE_WIDTH / 2, BASE_HEIGHT - 50);
    this.ctx.globalAlpha = 1;
  }

  private renderPauseMenu(): void {
    // Overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    this.ctx.textAlign = 'center';

    // Title
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 36px "Courier New"';
    this.ctx.fillText('PAUSED', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 80);

    // Menu items
    const menuStartY = BASE_HEIGHT / 2 - 20;
    const itemHeight = 40;

    for (let i = 0; i < this.pauseMenuItems.length; i++) {
      const y = menuStartY + i * itemHeight;
      const isSelected = i === this.selectedPauseItem;

      if (isSelected) {
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillText('>', BASE_WIDTH / 2 - 100, y);
      }

      this.ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      this.ctx.font = `${isSelected ? 'bold ' : ''}20px "Courier New"`;
      this.ctx.fillText(this.pauseMenuItems[i].label, BASE_WIDTH / 2, y);
    }

    // Instructions
    this.ctx.fillStyle = '#666';
    this.ctx.font = '14px "Courier New"';
    this.ctx.fillText('Press ESC to Resume', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 100);
  }

  private renderSettings(): void {
    // Overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    this.ctx.textAlign = 'center';

    // Title
    this.ctx.fillStyle = '#6bcfff';
    this.ctx.font = 'bold 32px "Courier New"';
    this.ctx.fillText('SETTINGS', BASE_WIDTH / 2, 80);

    // Settings items
    const startY = 150;
    const itemHeight = 50;
    const barWidth = 200;

    for (let i = 0; i < this.settingsOptions.length; i++) {
      const y = startY + i * itemHeight;
      const isSelected = i === this.selectedSettingIndex;
      const option = this.settingsOptions[i];

      // Selection indicator
      if (isSelected) {
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillText('>', BASE_WIDTH / 2 - 180, y);
      }

      // Option label
      this.ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      this.ctx.font = `${isSelected ? 'bold ' : ''}16px "Courier New"`;
      this.ctx.textAlign = 'left';
      this.ctx.fillText(option, BASE_WIDTH / 2 - 150, y);

      // Volume bar (if not "Back")
      if (option !== 'Back') {
        let volume = 0;
        if (option === 'Master Volume') volume = soundManager.getMasterVolume();
        else if (option === 'Music Volume') volume = soundManager.getMusicVolume();
        else if (option === 'SFX Volume') volume = soundManager.getSfxVolume();

        const barX = BASE_WIDTH / 2 + 20;
        const barY = y - 10;
        const barHeight = 15;

        // Bar background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Bar fill
        this.ctx.fillStyle = isSelected ? '#4ECB71' : '#666';
        this.ctx.fillRect(barX, barY, barWidth * (volume / 100), barHeight);

        // Bar border
        this.ctx.strokeStyle = isSelected ? '#fff' : '#666';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Volume value
        this.ctx.fillStyle = isSelected ? '#fff' : '#aaa';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${volume}%`, barX + barWidth + 50, y);
      }

      this.ctx.textAlign = 'center';
    }

    // Instructions
    this.ctx.fillStyle = '#666';
    this.ctx.font = '12px "Courier New"';
    this.ctx.fillText('Up/Down to Select, Left/Right to Adjust, ESC to Go Back', BASE_WIDTH / 2, BASE_HEIGHT - 50);
  }

  private startGame(mode: GameMode, aiDifficulty?: AIDifficulty): void {
    this.gameMode = mode;
    this.tanks = [];
    this.projectiles = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.burnAreas = [];
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.isChargingPower = false;
    this.powerDirection = 1;
    this.turnTimeRemaining = this.maxTurnTime;

    // Clear power-ups
    this.powerUpManager.clear();

    // Setup AI for single player
    if (mode === 'single' && aiDifficulty) {
      this.ai = new TankAI(aiDifficulty);
    } else {
      this.ai = null;
    }

    // Generate new terrain
    this.terrain.generate();

    // Create tanks (always 2 for now)
    const numPlayers = 2;
    this.playerStats = [];
    this.hudHealthAnimations = [];
    for (let i = 0; i < numPlayers; i++) {
      const pos = this.terrain.getSpawnPosition(i, numPlayers);
      const facingRight = i < numPlayers / 2;
      const tank = new Tank(pos.x, pos.y, PLAYER_COLORS[i], i, facingRight);
      tank.resetWeaponsAndBuffs(); // Ensure weapons/buffs are reset
      this.tanks.push(tank);
      this.playerStats.push({ shotsFired: 0, hits: 0, damageDealt: 0 });
      this.hudHealthAnimations.push({ current: 100, target: 100 });
    }

    // Set initial wind
    this.wind = (Math.random() - 0.5) * WIND_STRENGTH_MAX * 2;
    this.updateWindDisplay();

    // Set initial angle based on first player's facing direction
    const firstTank = this.tanks[0];
    this.angleSlider.value = firstTank.angle.toString();
    this.angleValue.textContent = firstTank.angle.toString();

    this.updateUI();
    this.state = 'PLAYING';
    this.fireButton.disabled = false;

    // Show UI elements
    this.weaponSelector.show();
    this.buffIndicator.show();
    this.weaponSelector.update(firstTank);
    this.buffIndicator.update(firstTank);
    this.weaponSelector.setEnabled(true);

    // Show initial turn banner
    const turnText = this.gameMode === 'single' ? 'YOUR TURN' : 'PLAYER 1 TURN';
    this.showTurnBanner(turnText);

    // Start background music
    soundManager.startMusic();
    this.musicButton.textContent = soundManager.isMusicPlaying() ? '🎵 ON' : '🎵 OFF';
    this.musicButton.classList.toggle('off', !soundManager.isMusicPlaying());
  }

  private fire(): void {
    if (this.state !== 'PLAYING') return;
    if (this.isAITurn()) return; // Don't allow manual fire during AI turn

    this.isChargingPower = false;
    soundManager.stopCharging();

    const tank = this.tanks[this.currentPlayerIndex];
    if (!tank.isAlive) {
      this.nextPlayer();
      return;
    }

    const angle = parseInt(this.angleSlider.value);
    const power = (parseInt(this.powerSlider.value) / 100) * MAX_POWER;
    const weaponConfig = tank.getSelectedWeaponConfig();

    // Clear existing projectiles
    this.projectiles = [];

    const barrelEnd = tank.getBarrelEnd();

    // Check for double shot buff
    const shotCount = tank.hasDoubleShot() ? 2 : 1;

    for (let i = 0; i < shotCount; i++) {
      // Slight angle variation for double shot
      const shotAngle = shotCount > 1 ? angle + (i === 0 ? -5 : 5) : angle;

      const projectile = new Projectile(
        barrelEnd.x,
        barrelEnd.y,
        shotAngle,
        power,
        this.wind,
        tank,
        weaponConfig
      );
      this.projectiles.push(projectile);
    }

    // Use ammo and consume buffs
    tank.useAmmo();
    if (shotCount > 1) {
      tank.consumeDoubleShot();
    }

    // Update weapon selector to show new ammo counts
    this.weaponSelector.update(tank);
    this.buffIndicator.update(tank);

    // Trigger muzzle flash and recoil
    tank.fire();

    // Screen shake proportional to power (more juice!)
    const powerRatio = parseInt(this.powerSlider.value) / 100;
    this.triggerScreenShake(4 + powerRatio * 8); // 4-12 intensity based on power
    this.triggerScreenFlash('#FFF', 0.15 + powerRatio * 0.1); // Brief white flash

    this.state = 'FIRING';
    this.fireButton.disabled = true;
    this.weaponSelector.setEnabled(false);
    soundManager.playShoot();

    // Track shot fired
    this.playerStats[this.currentPlayerIndex].shotsFired++;
  }

  private startAITurn(): void {
    if (!this.ai) return;

    const aiTank = this.tanks[1];
    const playerTank = this.tanks[0];

    if (!aiTank.isAlive || !playerTank.isAlive) return;

    // AI selects weapon based on situation
    this.ai.selectWeapon(aiTank, playerTank);

    // Update weapon selector to show AI's weapon choice
    this.weaponSelector.update(aiTank);

    // Calculate shot
    this.aiShot = this.ai.calculateShot(aiTank, playerTank, this.wind);
    this.aiThinkingTimer = this.ai.getThinkingTime();

    // Update tank barrel to show aiming
    aiTank.angle = Math.round(this.aiShot.angle);

    this.state = 'AI_THINKING';
    this.fireButton.disabled = true;

    // Update UI to show AI's angle/power
    this.angleSlider.value = Math.round(this.aiShot.angle).toString();
    this.angleValue.textContent = Math.round(this.aiShot.angle).toString();
    this.powerSlider.value = Math.round(this.aiShot.power).toString();
    this.powerValue.textContent = Math.round(this.aiShot.power).toString();
  }

  private executeAIShot(): void {
    if (!this.aiShot) return;

    const tank = this.tanks[this.currentPlayerIndex];
    const angle = this.aiShot.angle;
    const power = (this.aiShot.power / 100) * MAX_POWER;
    const weaponConfig = tank.getSelectedWeaponConfig();

    tank.angle = angle;

    // Clear existing projectiles
    this.projectiles = [];

    const barrelEnd = tank.getBarrelEnd();
    const projectile = new Projectile(
      barrelEnd.x,
      barrelEnd.y,
      angle,
      power,
      this.wind,
      tank,
      weaponConfig
    );
    this.projectiles.push(projectile);

    // Use ammo
    tank.useAmmo();

    // Update UI
    this.weaponSelector.update(tank);
    this.buffIndicator.update(tank);

    // Trigger muzzle flash and recoil
    tank.fire();

    // Screen shake proportional to power (more juice!)
    const powerRatio = this.aiShot.power / 100;
    this.triggerScreenShake(4 + powerRatio * 8);
    this.triggerScreenFlash('#FFF', 0.15 + powerRatio * 0.1);

    this.aiShot = null;
    this.state = 'FIRING';
    soundManager.playShoot();

    // Track shot fired
    this.playerStats[this.currentPlayerIndex].shotsFired++;
  }

  private endTurn(): void {
    // Check for game over
    const aliveTanks = this.tanks.filter(t => t.isAlive);

    if (aliveTanks.length <= 1) {
      this.winner = aliveTanks.length === 1 ? aliveTanks[0] : null;
      this.state = 'GAME_OVER';
      this.fireButton.disabled = true;

      // Hide weapon selector and buff indicator
      this.weaponSelector.hide();
      this.buffIndicator.hide();

      // Spawn victory confetti and fireworks
      if (this.winner) {
        this.spawnConfetti();
        this.spawnInitialFireworks();
      }

      // Play victory/defeat sound
      const isVictory = this.gameMode === 'single'
        ? this.winner?.playerIndex === 0
        : true; // In multiplayer, someone always wins
      soundManager.playGameOver(isVictory);
      return;
    }

    // Try to spawn a power-up between turns
    this.powerUpManager.trySpawn(this.terrain, this.tanks);

    // Change wind slightly
    this.wind += (Math.random() - 0.5) * 10;
    this.wind = Math.max(-WIND_STRENGTH_MAX, Math.min(WIND_STRENGTH_MAX, this.wind));
    this.updateWindDisplay();

    // Next player
    this.nextPlayer();

    // Update UI for new player
    const currentTank = this.tanks[this.currentPlayerIndex];
    this.weaponSelector.update(currentTank);
    this.buffIndicator.update(currentTank);
    this.weaponSelector.setEnabled(true);

    // Check if it's AI's turn
    if (this.isAITurn()) {
      this.startAITurn();
    } else {
      this.state = 'PLAYING';
      this.fireButton.disabled = false;
    }
  }

  private nextPlayer(): void {
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
    } while (!this.tanks[this.currentPlayerIndex].isAlive);

    // Reset turn timer
    this.turnTimeRemaining = this.maxTurnTime;

    // Update angle slider to current tank's angle
    const tank = this.tanks[this.currentPlayerIndex];
    this.angleSlider.value = tank.angle.toString();
    this.angleValue.textContent = tank.angle.toString();

    // Show turn banner
    let turnText: string;
    if (this.gameMode === 'single') {
      turnText = this.currentPlayerIndex === 0 ? 'YOUR TURN' : 'CPU TURN';
    } else {
      turnText = `PLAYER ${this.currentPlayerIndex + 1} TURN`;
    }
    this.showTurnBanner(turnText);

    this.updateUI();
  }

  private updateUI(): void {
    const tank = this.tanks[this.currentPlayerIndex];
    const label = this.gameMode === 'single'
      ? (this.currentPlayerIndex === 0 ? 'Your Turn' : 'CPU Turn')
      : `Player ${this.currentPlayerIndex + 1}`;

    this.currentPlayerSpan.textContent = label;
    this.currentPlayerSpan.style.color = tank.color;
  }

  private updateWindDisplay(): void {
    const windDirection = this.wind > 0 ? '→' : this.wind < 0 ? '←' : '';
    const windStrength = Math.abs(Math.round(this.wind));
    this.windInfo.textContent = `Wind: ${windDirection} ${windStrength}`;
  }

  private renderWindArrow(): void {
    const arrowX = BASE_WIDTH - 80;
    const arrowY = 50;
    const arrowLength = 40;
    const windStrength = Math.abs(this.wind) / WIND_STRENGTH_MAX;

    // Background box
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(arrowX - 50, arrowY - 25, 100, 50);

    // Label
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px "Courier New"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('WIND', arrowX, arrowY - 12);

    // Wind strength number
    this.ctx.font = 'bold 12px "Courier New"';
    this.ctx.fillText(Math.abs(Math.round(this.wind)).toString(), arrowX, arrowY + 20);

    // Arrow
    if (Math.abs(this.wind) > 0.5) {
      const direction = this.wind > 0 ? 1 : -1;
      const scaledLength = arrowLength * windStrength;

      // Arrow body
      this.ctx.strokeStyle = windStrength > 0.6 ? '#FF6B6B' : windStrength > 0.3 ? '#FFD93D' : '#4ECB71';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(arrowX - scaledLength / 2 * direction, arrowY);
      this.ctx.lineTo(arrowX + scaledLength / 2 * direction, arrowY);
      this.ctx.stroke();

      // Arrow head
      this.ctx.fillStyle = this.ctx.strokeStyle;
      this.ctx.beginPath();
      const headX = arrowX + scaledLength / 2 * direction;
      this.ctx.moveTo(headX, arrowY);
      this.ctx.lineTo(headX - 8 * direction, arrowY - 6);
      this.ctx.lineTo(headX - 8 * direction, arrowY + 6);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // No wind indicator
      this.ctx.fillStyle = '#666';
      this.ctx.font = '12px "Courier New"';
      this.ctx.fillText('CALM', arrowX, arrowY + 4);
    }
  }

  private triggerScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  private triggerScreenFlash(color: string, intensity: number): void {
    this.screenFlashColor = color;
    this.screenFlashIntensity = Math.max(this.screenFlashIntensity, intensity);
  }

  private triggerHitstop(duration: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  private spawnConfetti(): void {
    const colors = ['#FF6B6B', '#4ECB71', '#FFD93D', '#4D96FF', '#FF6FB5', '#FFF'];
    for (let i = 0; i < 100; i++) {
      this.confetti.push({
        x: Math.random() * BASE_WIDTH,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 100,
        vy: 50 + Math.random() * 100,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        life: 3 + Math.random() * 2,
      });
    }
  }

  private updateConfetti(deltaTime: number): void {
    for (const particle of this.confetti) {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 80 * deltaTime; // Gravity
      particle.vx *= 0.99; // Air resistance
      particle.rotation += particle.rotationSpeed * deltaTime;
      particle.life -= deltaTime;
    }
    this.confetti = this.confetti.filter(p => p.life > 0 && p.y < BASE_HEIGHT + 50);
  }

  private renderConfetti(): void {
    for (const particle of this.confetti) {
      const alpha = Math.min(1, particle.life);
      this.ctx.save();
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate(particle.rotation);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = particle.color;
      this.ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      this.ctx.restore();
    }
  }

  private spawnInitialFireworks(): void {
    // Spawn several fireworks immediately
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.state === 'GAME_OVER') {
          this.spawnFirework();
        }
      }, i * 300);
    }
    // Start continuous firework spawning
    this.fireworkSpawnTimer = 0.5;
  }

  private spawnFirework(): void {
    const colors = ['#FF6B6B', '#4ECB71', '#FFD93D', '#4D96FF', '#FF6FB5', '#FFF', '#FF9500'];
    this.fireworks.push({
      x: 50 + Math.random() * (BASE_WIDTH - 100),
      y: BASE_HEIGHT,
      vy: -200 - Math.random() * 100,
      targetY: 80 + Math.random() * 150,
      exploded: false,
      color: colors[Math.floor(Math.random() * colors.length)],
      sparks: [],
    });
  }

  private updateFireworks(deltaTime: number): void {
    // Spawn new fireworks periodically during game over
    if (this.state === 'GAME_OVER' && this.winner) {
      this.fireworkSpawnTimer -= deltaTime;
      if (this.fireworkSpawnTimer <= 0) {
        this.fireworkSpawnTimer = 0.8 + Math.random() * 0.5;
        this.spawnFirework();
      }
    }

    for (const firework of this.fireworks) {
      if (!firework.exploded) {
        // Move firework upward
        firework.y += firework.vy * deltaTime;
        firework.vy += 100 * deltaTime; // Gravity slows it down

        // Explode when reaching target
        if (firework.y <= firework.targetY || firework.vy >= 0) {
          firework.exploded = true;

          // Create explosion sparks
          const sparkCount = 40 + Math.floor(Math.random() * 20);
          for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2;
            const speed = 80 + Math.random() * 100;
            const colorVariation = Math.random() > 0.3 ? firework.color : '#FFF';
            firework.sparks.push({
              x: firework.x,
              y: firework.y,
              vx: Math.cos(angle) * speed * (0.5 + Math.random() * 0.5),
              vy: Math.sin(angle) * speed * (0.5 + Math.random() * 0.5),
              life: 1.0 + Math.random() * 0.5,
              color: colorVariation,
              size: 2 + Math.random() * 2,
              trail: [],
            });
          }
        }
      } else {
        // Update sparks
        for (const spark of firework.sparks) {
          // Store trail
          spark.trail.push({ x: spark.x, y: spark.y });
          if (spark.trail.length > 5) {
            spark.trail.shift();
          }

          spark.x += spark.vx * deltaTime;
          spark.y += spark.vy * deltaTime;
          spark.vy += 80 * deltaTime; // Gravity
          spark.vx *= 0.98; // Air resistance
          spark.life -= deltaTime;
          spark.size *= 0.995;
        }
        firework.sparks = firework.sparks.filter(s => s.life > 0);
      }
    }

    // Remove completed fireworks
    this.fireworks = this.fireworks.filter(f => !f.exploded || f.sparks.length > 0);
  }

  private renderFireworks(): void {
    for (const firework of this.fireworks) {
      if (!firework.exploded) {
        // Draw rising firework with trail
        this.ctx.fillStyle = firework.color;
        this.ctx.beginPath();
        this.ctx.arc(firework.x, firework.y, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Trail
        this.ctx.strokeStyle = firework.color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(firework.x, firework.y);
        this.ctx.lineTo(firework.x, firework.y + 30);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
      } else {
        // Draw sparks with trails
        for (const spark of firework.sparks) {
          const alpha = Math.min(1, spark.life);

          // Draw trail
          if (spark.trail.length > 1) {
            for (let i = 1; i < spark.trail.length; i++) {
              const trailAlpha = alpha * (i / spark.trail.length) * 0.5;
              this.ctx.strokeStyle = spark.color;
              this.ctx.globalAlpha = trailAlpha;
              this.ctx.lineWidth = spark.size * (i / spark.trail.length);
              this.ctx.beginPath();
              this.ctx.moveTo(spark.trail[i - 1].x, spark.trail[i - 1].y);
              this.ctx.lineTo(spark.trail[i].x, spark.trail[i].y);
              this.ctx.stroke();
            }
          }

          // Draw spark head with glow
          this.ctx.globalAlpha = alpha * 0.3;
          this.ctx.fillStyle = spark.color;
          this.ctx.beginPath();
          this.ctx.arc(spark.x, spark.y, spark.size * 2, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.globalAlpha = alpha;
          this.ctx.fillStyle = spark.color;
          this.ctx.beginPath();
          this.ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private updateScreenShake(deltaTime: number): void {
    if (this.shakeIntensity > 0) {
      // Random offset based on intensity
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;

      // Decay the shake intensity
      this.shakeIntensity -= deltaTime * 40; // Decay over ~0.3 seconds
      if (this.shakeIntensity < 0) {
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }
  }

  private calculateTrajectory(): void {
    this.trajectoryPoints = [];

    // Only show trajectory during human player turn (not AI)
    if (this.state !== 'PLAYING' || this.isAITurn()) {
      return;
    }

    const tank = this.tanks[this.currentPlayerIndex];
    if (!tank || !tank.isAlive) return;

    const angle = parseInt(this.angleSlider.value);
    const power = (parseInt(this.powerSlider.value) / 100) * MAX_POWER;
    const barrelEnd = tank.getBarrelEnd();

    // Simulate projectile physics to generate trajectory points
    const angleRad = (angle * Math.PI) / 180;
    let x = barrelEnd.x;
    let y = barrelEnd.y;
    let vx = Math.cos(angleRad) * power + this.wind * 0.5;
    let vy = -Math.sin(angleRad) * power;

    const dt = 0.016; // Simulate at 60 FPS
    const maxPoints = 80; // Limit trajectory length
    const gravity = 500; // Same as GRAVITY constant

    for (let i = 0; i < maxPoints; i++) {
      this.trajectoryPoints.push({ x, y });

      // Apply physics (same as Projectile.ts)
      vx += this.wind * dt * 0.5;
      vy += gravity * dt;
      x += vx * dt;
      y += vy * dt;

      // Stop if we hit terrain or go out of bounds
      const terrainHeight = this.terrain.getHeightAt(x);
      const terrainY = BASE_HEIGHT - terrainHeight;
      if (y >= terrainY || x < -50 || x > BASE_WIDTH + 50 || y > BASE_HEIGHT + 50) {
        this.trajectoryPoints.push({ x, y: Math.min(y, terrainY) });
        break;
      }
    }
  }

  private renderTrajectory(): void {
    if (this.trajectoryPoints.length < 2) return;

    const ctx = this.ctx;
    ctx.save();

    // Draw dashed trajectory line with fading opacity
    const totalPoints = this.trajectoryPoints.length;
    const dashLength = 8;
    const gapLength = 6;
    let dashOn = true;
    let dashProgress = 0;

    for (let i = 1; i < totalPoints; i++) {
      const prev = this.trajectoryPoints[i - 1];
      const curr = this.trajectoryPoints[i];

      // Calculate opacity (fades along trajectory)
      const alpha = 0.8 * (1 - i / totalPoints);

      // Calculate segment properties
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / segmentLength;
      const uy = dy / segmentLength;

      let remaining = segmentLength;
      let startX = prev.x;
      let startY = prev.y;

      while (remaining > 0) {
        const currentLength = dashOn ? dashLength : gapLength;
        const drawLength = Math.min(remaining, currentLength - dashProgress);

        if (dashOn) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX + ux * drawLength, startY + uy * drawLength);
          ctx.stroke();
        }

        startX += ux * drawLength;
        startY += uy * drawLength;
        dashProgress += drawLength;
        remaining -= drawLength;

        if (dashProgress >= (dashOn ? dashLength : gapLength)) {
          dashProgress = 0;
          dashOn = !dashOn;
        }
      }
    }

    // Draw dots at regular intervals
    for (let i = 0; i < totalPoints; i += 5) {
      const point = this.trajectoryPoints[i];
      const alpha = 0.6 * (1 - i / totalPoints);
      const size = 3 * (1 - i / totalPoints * 0.5);

      ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw predicted landing point
    if (totalPoints > 0) {
      const landing = this.trajectoryPoints[totalPoints - 1];
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(landing.x, landing.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair at landing point
      ctx.beginPath();
      ctx.moveTo(landing.x - 15, landing.y);
      ctx.lineTo(landing.x + 15, landing.y);
      ctx.moveTo(landing.x, landing.y - 15);
      ctx.lineTo(landing.x, landing.y + 15);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderHUDHealthBars(): void {
    const ctx = this.ctx;
    const barWidth = 150;
    const barHeight = 18;
    const padding = 15;

    for (let i = 0; i < this.tanks.length; i++) {
      const tank = this.tanks[i];
      const isLeft = i === 0;
      const barX = isLeft ? padding : BASE_WIDTH - padding - barWidth;
      const barY = 50;

      // Update animated health value
      if (this.hudHealthAnimations[i]) {
        const anim = this.hudHealthAnimations[i];
        anim.target = tank.health;
        const diff = anim.target - anim.current;
        anim.current += diff * 0.1; // Smooth interpolation
        if (Math.abs(diff) < 0.1) anim.current = anim.target;
      }

      const animatedHealth = this.hudHealthAnimations[i]?.current ?? tank.health;
      const healthPercent = animatedHealth / 100;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(barX - 5, barY - 25, barWidth + 10, barHeight + 35, 5);
      ctx.fill();

      // Player label
      const playerLabel = this.gameMode === 'single'
        ? (i === 0 ? 'YOU' : 'CPU')
        : `PLAYER ${i + 1}`;
      ctx.fillStyle = tank.color;
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = isLeft ? 'left' : 'right';
      ctx.fillText(playerLabel, isLeft ? barX : barX + barWidth, barY - 8);

      // Color indicator dot
      ctx.fillStyle = tank.color;
      ctx.beginPath();
      ctx.arc(isLeft ? barX + barWidth - 8 : barX + 8, barY - 12, 5, 0, Math.PI * 2);
      ctx.fill();

      // Health bar background
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 3);
      ctx.fill();

      // Health bar fill with gradient (green > yellow > red)
      let healthColor: string;
      if (healthPercent > 0.5) {
        healthColor = '#4ECB71';
      } else if (healthPercent > 0.25) {
        healthColor = '#FFD93D';
      } else {
        healthColor = '#FF6B6B';
      }

      const gradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
      gradient.addColorStop(0, this.lightenColor(healthColor, 30));
      gradient.addColorStop(0.5, healthColor);
      gradient.addColorStop(1, this.darkenColor(healthColor, 30));

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth * healthPercent, barHeight, 3);
      ctx.fill();

      // Health bar border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 3);
      ctx.stroke();

      // Numeric health value
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(animatedHealth)}`, barX + barWidth / 2, barY + barHeight / 2 + 4);
    }
  }

  private renderTurnBanner(): void {
    if (this.turnBannerAlpha <= 0) return;

    const ctx = this.ctx;
    ctx.save();

    // Banner background
    const bannerWidth = 200;
    const bannerHeight = 40;
    const bannerX = BASE_WIDTH / 2 - bannerWidth / 2;
    const bannerY = 90;

    ctx.globalAlpha = this.turnBannerAlpha;

    // Background with glow
    ctx.shadowColor = this.tanks[this.currentPlayerIndex]?.color || '#fff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = this.tanks[this.currentPlayerIndex]?.color || '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(this.turnBannerText, BASE_WIDTH / 2, bannerY + bannerHeight / 2 + 6);

    ctx.restore();
  }

  private renderPowerMeter(): void {
    if (!this.isChargingPower || this.state !== 'PLAYING') return;

    const ctx = this.ctx;
    const tank = this.tanks[this.currentPlayerIndex];
    if (!tank || !tank.isAlive) return;

    const power = parseInt(this.powerSlider.value);
    const meterRadius = 35;
    const meterX = tank.x;
    const meterY = tank.y - 60;

    ctx.save();

    // Outer glow (pulsing)
    const pulse = 0.7 + Math.sin(Date.now() / 100) * 0.3;
    ctx.shadowColor = power > 70 ? '#ff4444' : power > 40 ? '#ffaa00' : '#44ff44';
    ctx.shadowBlur = 15 * pulse;

    // Background arc
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(meterX, meterY, meterRadius, Math.PI, 0, false);
    ctx.stroke();

    // Power arc with color gradient
    let powerColor: string;
    if (power > 70) {
      powerColor = '#ff4444';
    } else if (power > 40) {
      powerColor = '#ffaa00';
    } else {
      powerColor = '#44ff44';
    }

    ctx.strokeStyle = powerColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    const powerAngle = Math.PI + (power / 100) * Math.PI;
    ctx.arc(meterX, meterY, meterRadius, Math.PI, powerAngle, false);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Percentage text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`${power}%`, meterX, meterY + 5);

    // "POWER" label
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Courier New"';
    ctx.fillText('POWER', meterX, meterY + 18);

    ctx.restore();
  }

  // Helper to lighten a hex color
  private lightenColor(color: string, amount: number): string {
    // Handle hex colors
    if (color.startsWith('#')) {
      const num = parseInt(color.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
      const b = Math.min(255, (num & 0x0000FF) + amount);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return color;
  }

  // Helper to darken a hex color
  private darkenColor(color: string, amount: number): string {
    if (color.startsWith('#')) {
      const num = parseInt(color.replace('#', ''), 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
      const b = Math.max(0, (num & 0x0000FF) - amount);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return color;
  }

  private showTurnBanner(text: string): void {
    this.turnBannerText = text;
    this.turnBannerAlpha = 1;
    this.turnBannerTimer = 2.0; // Display for 2 seconds
  }

  // Easing function for smooth animations
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}
