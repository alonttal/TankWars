import { BASE_WIDTH, BASE_HEIGHT, MAP_WIDTH, MAP_HEIGHT, BACKGROUND_PARALLAX, MAX_POWER, WIND_STRENGTH_MAX, updateCanvasSize, SCALE_X, SCALE_Y, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS } from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Ant } from './Ant.ts';
import { Projectile } from './Projectile.ts';
import { Explosion } from './Explosion.ts';
import { AntAI, AIDifficulty } from './AI.ts';
import { soundManager } from './Sound.ts';
import { WeaponType } from './weapons/WeaponTypes.ts';
import { BurnArea } from './weapons/BurnArea.ts';
import { PowerUpManager } from './powerups/PowerUpManager.ts';
import { POWERUP_CONFIGS } from './powerups/PowerUpTypes.ts';
import { WeaponSelector } from './ui/WeaponSelector.ts';
import { BuffIndicator } from './ui/BuffIndicator.ts';

type GameState = 'MENU' | 'INTRO_PAN' | 'PLAYING' | 'AI_THINKING' | 'FIRING' | 'PAUSED' | 'SETTINGS' | 'GAME_OVER';
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
  private ants: Ant[];
  private explosions: Explosion[];
  private currentPlayerIndex: number; // Index into ants array for current ant
  private currentTeamIndex: number; // Which team's turn (0 or 1)
  private teamTurnCounts: number[]; // Track rotation within each team
  private winningTeam: number | null; // Team that won (-1 for draw)
  private wind: number;
  private state: GameState;
  private winner: Ant | null;
  private gameMode: GameMode;
  private ai: AntAI | null;
  private aiThinkingTimer: number;
  private aiShot: { angle: number; power: number; target: Ant | null } | null;

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

  // Intro camera pan
  private introPanPhase: number; // 0 = overview, 1 = pan to first player
  private introPanTimer: number;

  // Mouse controls
  private mouseX: number;
  private mouseY: number;
  private isMouseDown: boolean;

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
    this.ants = [];
    this.explosions = [];
    this.currentPlayerIndex = 0;
    this.currentTeamIndex = 0;
    this.teamTurnCounts = [0, 0];
    this.winningTeam = null;
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
    this.cameraZoom = 0.5;
    this.targetCameraZoom = 0.5;
    this.cameraOffsetX = 0;
    this.cameraOffsetY = 0;
    this.targetCameraOffsetX = 0;
    this.targetCameraOffsetY = 0;
    this.introPanPhase = 0;
    this.introPanTimer = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.isMouseDown = false;
    this.maxTurnTime = 30; // 30 seconds per turn
    this.turnTimeRemaining = this.maxTurnTime;
    this.playerStats = [];
    this.floatingTexts = [];
    this.confetti = [];
    this.fireworks = [];
    this.fireworkSpawnTimer = 0;
    this.lastTime = 0;
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

    // Hide UI elements - only timer kept
    this.weaponSelector.hide();
    this.buffIndicator.hide();

    // Setup weapon selector callback
    this.weaponSelector.setOnWeaponSelect((weapon: WeaponType) => {
      if (this.state === 'PLAYING' && !this.isAITurn()) {
        const tank = this.ants[this.currentPlayerIndex];
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

    // Hide non-timer UI elements
    this.currentPlayerSpan.style.display = 'none';
    this.windInfo.style.display = 'none';

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Slider updates
    this.angleSlider.addEventListener('input', () => {
      const angle = parseInt(this.angleSlider.value);
      this.angleValue.textContent = angle.toString();
      if (this.ants[this.currentPlayerIndex]) {
        this.ants[this.currentPlayerIndex].angle = angle;
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

    // Handle space release to fire (legacy keyboard support)
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
        e.preventDefault();
        this.isChargingPower = false;
        soundManager.stopCharging();
        this.fire();
      }
    });

    // Mouse controls for aiming and firing
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;

      // Update aim angle if playing and not AI turn
      if (this.state === 'PLAYING' && !this.isAITurn()) {
        this.updateAimFromMouse();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click

      this.isMouseDown = true;

      if (this.state === 'PLAYING' && !this.isAITurn()) {
        // Start charging power from zero
        if (!this.isChargingPower) {
          this.isChargingPower = true;
          this.powerDirection = 1;
          this.powerSlider.value = '0';
          this.powerSlider.dispatchEvent(new Event('input'));
          soundManager.startCharging();
        }
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return; // Only left click

      this.isMouseDown = false;

      if (this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
        this.isChargingPower = false;
        soundManager.stopCharging();
        this.fire();
      }
    });

    // Handle mouse leaving canvas while charging
    this.canvas.addEventListener('mouseleave', () => {
      if (this.isMouseDown && this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
        this.isChargingPower = false;
        this.isMouseDown = false;
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
    // In single player mode, team 1 is controlled by AI
    return this.gameMode === 'single' && this.currentTeamIndex === 1;
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
    // Slower interpolation during intro pan for cinematic effect
    const lerpSpeed = (this.state === 'INTRO_PAN' && this.introPanPhase === 1) ? 1.5 : 4;
    const cameraLerpFactor = Math.min(1, deltaTime * lerpSpeed);
    const zoomDiff = this.targetCameraZoom - this.cameraZoom;
    const xDiff = this.targetCameraOffsetX - this.cameraOffsetX;
    const yDiff = this.targetCameraOffsetY - this.cameraOffsetY;
    this.cameraZoom += zoomDiff * this.easeOutCubic(cameraLerpFactor);
    this.cameraOffsetX += xDiff * this.easeOutCubic(cameraLerpFactor);
    this.cameraOffsetY += yDiff * this.easeOutCubic(cameraLerpFactor);

    // Update terrain (clouds, wind particles)
    this.terrain.update(effectiveDelta, this.wind);

    // Update intro camera pan
    if (this.state === 'INTRO_PAN') {
      this.introPanTimer -= deltaTime;

      if (this.introPanPhase === 0) {
        // Phase 0: Showing overview
        if (this.introPanTimer <= 0) {
          // Transition to phase 1: pan to first player
          this.introPanPhase = 1;
          this.introPanTimer = 3.0; // Time for slow pan/zoom animation

          // Set target to first ant
          const firstAnt = this.ants[0];
          this.focusCameraOnAnt(firstAnt, false); // Smooth pan
        }
      } else if (this.introPanPhase === 1) {
        // Phase 1: Panning to first player
        if (this.introPanTimer <= 0) {
          // Intro pan complete, start the game
          this.state = 'PLAYING';
          this.fireButton.disabled = false;

          // UI elements hidden - only timer kept

          // Show initial turn banner
          const turnText = this.getTurnBannerText();
          this.showTurnBanner(turnText);
        }
      }
    }

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
      const tank = this.ants[this.currentPlayerIndex];
      if (tank) {
        tank.updateCharging(deltaTime, newPower);
      }
    }

    // Update tanks (smoke particles, damage flash)
    for (const tank of this.ants) {
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
        this.executeAIShot();
      }
    }

    if (this.state === 'FIRING') {
      // Update all projectiles
      const newProjectiles: Projectile[] = [];
      let anyActiveProjectile = false;
      let cameraFollowProjectile: Projectile | null = null;

      for (const projectile of this.projectiles) {
        const result = projectile.update(effectiveDelta, this.terrain, this.ants, this.wind);

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

      // Camera follows active projectile
      if (cameraFollowProjectile) {
        // Center projectile in view (clamped to map bounds)
        const clamped = this.clampCameraOffset(
          BASE_WIDTH / 2 - cameraFollowProjectile.x,
          BASE_HEIGHT / 2 - cameraFollowProjectile.y
        );
        this.targetCameraOffsetX = clamped.x;
        this.targetCameraOffsetY = clamped.y;
        this.targetCameraZoom = 0.55; // Slight zoom in when following projectile
      } else if (!anyActiveProjectile) {
        // Return camera to current player's tank
        const currentAnt = this.ants[this.currentPlayerIndex];
        if (currentAnt && currentAnt.isAlive) {
          const clamped = this.clampCameraOffset(
            BASE_WIDTH / 2 - currentAnt.x,
            BASE_HEIGHT / 2 - currentAnt.y
          );
          this.targetCameraOffsetX = clamped.x;
          this.targetCameraOffsetY = clamped.y;
        }
        this.targetCameraZoom = 0.5;
      }

      // Update burn areas
      for (const burnArea of this.burnAreas) {
        burnArea.update(effectiveDelta, this.ants, this.terrain);
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
      const collected = this.powerUpManager.update(effectiveDelta, this.ants);
      if (collected) {
        soundManager.playPowerUpCollect(); // Power-up collection sound
        this.buffIndicator.update(collected.ant);

        // Show floating text for power-up
        const config = POWERUP_CONFIGS[collected.type];
        this.floatingTexts.push({
          x: collected.ant.x,
          y: collected.ant.y - 50,
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
    const healthBefore = this.ants.map(t => t.health);
    const shooterTeamIndex = projectile.owner.teamIndex;

    // Get damage multiplier from shooter's buffs
    const damageMultiplier = projectile.owner.getDamageMultiplier();
    const finalDamage = Math.floor(weaponConfig.damage * damageMultiplier);

    // Create explosion with weapon-specific parameters
    const explosion = new Explosion(hitX, hitY, weaponConfig.explosionRadius, finalDamage);
    explosion.applyDamageWithConfig(
      this.ants,
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

    // Trigger hitstop for impact feel
    this.triggerHitstop(0.08);

    // Screen shake proportional to explosion size
    const shakeIntensity = 10 + (weaponConfig.explosionRadius / 35) * 8;
    this.triggerScreenShake(shakeIntensity);
    this.triggerScreenFlash('#FFA500', 0.5);

    // Track damage dealt and hits (only count damage to enemy team)
    let totalDamage = 0;
    let hitCount = 0;
    for (let i = 0; i < this.ants.length; i++) {
      const ant = this.ants[i];
      // Only count damage dealt to enemy team
      if (ant.teamIndex !== shooterTeamIndex) {
        const damage = healthBefore[i] - ant.health;
        if (damage > 0) {
          totalDamage += damage;
          hitCount++;

          // Spawn floating damage number
          const isCritical = damage >= 40;
          this.floatingTexts.push({
            x: ant.x,
            y: ant.y - 40,
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
      this.playerStats[shooterTeamIndex].hits++;
    }
    this.playerStats[shooterTeamIndex].damageDealt += totalDamage;
  }

  // Helper to apply camera transform with a parallax factor (0 = no movement, 1 = full movement)
  private applyCameraTransform(parallaxFactor: number): void {
    const offsetX = this.cameraOffsetX * parallaxFactor;
    const offsetY = this.cameraOffsetY * parallaxFactor;
    const zoom = 1 + (this.cameraZoom - 1) * parallaxFactor;

    this.ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-BASE_WIDTH / 2 + offsetX, -BASE_HEIGHT / 2 + offsetY);

    // Apply screen shake (reduced for background)
    if (this.shakeIntensity > 0) {
      this.ctx.translate(this.shakeOffsetX * parallaxFactor, this.shakeOffsetY * parallaxFactor);
    }
  }

  // Clamp camera offset to keep view within map bounds
  private clampCameraOffset(offsetX: number, offsetY: number): { x: number; y: number } {
    // With offset (ox, oy), view shows world region:
    // x: [-ox, BASE_WIDTH - ox]
    // y: [-oy, BASE_HEIGHT - oy]
    //
    // To keep within map bounds [0, MAP_WIDTH] x [0, MAP_HEIGHT]:
    // -ox >= 0  =>  ox <= 0
    // BASE_WIDTH - ox <= MAP_WIDTH  =>  ox >= BASE_WIDTH - MAP_WIDTH
    // -oy >= 0  =>  oy <= 0
    // BASE_HEIGHT - oy <= MAP_HEIGHT  =>  oy >= BASE_HEIGHT - MAP_HEIGHT

    const minOffsetX = BASE_WIDTH - MAP_WIDTH;   // -400
    const maxOffsetX = 0;
    const minOffsetY = BASE_HEIGHT - MAP_HEIGHT; // -700
    const maxOffsetY = 0;

    return {
      x: Math.max(minOffsetX, Math.min(maxOffsetX, offsetX)),
      y: Math.max(minOffsetY, Math.min(maxOffsetY, offsetY))
    };
  }

  // Convert screen coordinates to world coordinates
  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Account for canvas scaling
    const scaledX = screenX / SCALE_X;
    const scaledY = screenY / SCALE_Y;

    // Reverse camera transform:
    // Screen = ((world + offset - center) * zoom) + center
    // So: world = ((screen - center) / zoom) - offset + center
    const worldX = (scaledX - BASE_WIDTH / 2) / this.cameraZoom - this.cameraOffsetX + BASE_WIDTH / 2;
    const worldY = (scaledY - BASE_HEIGHT / 2) / this.cameraZoom - this.cameraOffsetY + BASE_HEIGHT / 2;

    return { x: worldX, y: worldY };
  }

  // Update aim angle based on mouse position
  private updateAimFromMouse(): void {
    const tank = this.ants[this.currentPlayerIndex];
    if (!tank || !tank.isAlive) return;

    // Convert mouse screen position to world coordinates
    const worldPos = this.screenToWorld(this.mouseX, this.mouseY);

    // Calculate angle from tank to mouse position
    const dx = worldPos.x - tank.x;
    const dy = worldPos.y - (tank.y - 15); // Offset for barrel position

    // Calculate angle in degrees (0 = right, 90 = up, 180 = left)
    let angle = Math.atan2(-dy, dx) * (180 / Math.PI);

    // Clamp angle to valid range (0-180, where 90 is straight up)
    angle = Math.max(0, Math.min(180, angle));

    // Update the angle slider
    this.angleSlider.value = angle.toString();
    this.angleSlider.dispatchEvent(new Event('input'));
  }

  // Focus camera on a specific tank (used at start of turns)
  // If immediate is true, snap camera instantly (used at game start)
  private focusCameraOnAnt(ant: Ant, immediate: boolean = false): void {
    // Calculate offset to center the ant in view
    // offset = screenCenter - worldPosition
    let offsetX = BASE_WIDTH / 2 - ant.x;
    let offsetY = BASE_HEIGHT / 2 - ant.y;

    // Clamp to map bounds
    const clamped = this.clampCameraOffset(offsetX, offsetY);
    this.targetCameraOffsetX = clamped.x;
    this.targetCameraOffsetY = clamped.y;
    this.targetCameraZoom = 0.5;

    // Snap immediately if requested (e.g., at game start)
    if (immediate) {
      this.cameraOffsetX = this.targetCameraOffsetX;
      this.cameraOffsetY = this.targetCameraOffsetY;
      this.cameraZoom = this.targetCameraZoom;
    }
  }

  private render(): void {
    // Clear canvas (use actual canvas size)
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Apply scaling for game rendering
    this.ctx.save();
    this.ctx.scale(SCALE_X, SCALE_Y);

    // Render menu without camera transforms
    if (this.state === 'MENU') {
      this.renderMenu();
      this.ctx.restore();
      return;
    }

    // ===== LAYER 1: BACKGROUND (with parallax - moves slower) =====
    this.ctx.save();
    this.applyCameraTransform(BACKGROUND_PARALLAX);
    this.terrain.renderBackground(this.ctx);
    this.ctx.restore();

    // ===== LAYER 2: GAMEPLAY (full camera movement) =====
    this.ctx.save();
    this.applyCameraTransform(1.0);

    // Render terrain (ground)
    this.terrain.render(this.ctx);


    // Render tanks
    for (let i = 0; i < this.ants.length; i++) {
      const isCurrentAndPlaying = i === this.currentPlayerIndex &&
        (this.state === 'PLAYING' || this.state === 'AI_THINKING');
      this.ants[i].render(this.ctx, isCurrentAndPlaying, this.isChargingPower);
    }

    // Power meter removed - only timer UI kept

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

    // Floating damage numbers removed - only timer UI kept

    // Render screen flash overlay (in world space)
    if (this.screenFlashIntensity > 0) {
      this.ctx.fillStyle = this.screenFlashColor;
      this.ctx.globalAlpha = this.screenFlashIntensity;
      this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      this.ctx.globalAlpha = 1;
    }

    // Close gameplay layer
    this.ctx.restore();

    // ===== LAYER 3: UI (no camera movement) =====

    // Intro pan overlay, wind arrow, HUD health bars, turn banner removed - only timer UI kept

    // Render turn timer (during human turns)
    if ((this.state === 'PLAYING' || this.state === 'AI_THINKING') && !this.isAITurn()) {
      this.renderTurnTimer();
    }

    // AI thinking indicator removed - only timer UI kept

    // Render game over (UI overlay)
    if (this.state === 'GAME_OVER') {
      this.renderGameOver();
      this.renderConfetti();
      this.renderFireworks();
      this.updateConfetti(0.016); // Continue animating confetti
      this.updateFireworks(0.016); // Continue animating fireworks
    }

    // Render pause menu (UI overlay)
    if (this.state === 'PAUSED') {
      this.renderPauseMenu();
    }

    // Render settings menu (UI overlay)
    if (this.state === 'SETTINGS') {
      this.renderSettings();
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
    this.ctx.fillText('In-game: Mouse = Aim, Hold Left Click = Charge, Release = Fire', BASE_WIDTH / 2, 460);
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
        ? (this.winningTeam === 0 ? 'YOU WIN!' : 'CPU WINS!')
        : `TEAM ${(this.winningTeam ?? 0) + 1} WINS!`;

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

    // Team labels
    this.ctx.font = 'bold 16px "Courier New"';
    this.ctx.fillStyle = TEAM_COLORS[0];
    this.ctx.fillText(this.gameMode === 'single' ? 'YOUR TEAM' : 'TEAM 1', p1X, statsY);
    this.ctx.fillStyle = TEAM_COLORS[1];
    this.ctx.fillText(this.gameMode === 'single' ? 'CPU TEAM' : 'TEAM 2', p2X, statsY);

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
    this.ants = [];
    this.projectiles = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.burnAreas = [];
    this.currentPlayerIndex = 0;
    this.currentTeamIndex = 0;
    this.teamTurnCounts = [0, 0];
    this.winningTeam = null;
    this.winner = null;
    this.isChargingPower = false;
    this.powerDirection = 1;
    this.turnTimeRemaining = this.maxTurnTime;

    // Clear power-ups
    this.powerUpManager.clear();

    // Setup AI for single player
    if (mode === 'single' && aiDifficulty) {
      this.ai = new AntAI(aiDifficulty);
    } else {
      this.ai = null;
    }

    // Generate new terrain
    this.terrain.generate();

    // Create ants for each team (8 per team, 16 total)
    this.playerStats = [];
    this.hudHealthAnimations = [];
    let antId = 0;

    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
      const teamColor = TEAM_COLORS[teamIdx];
      const facingRight = teamIdx === 0; // Team 0 faces right, Team 1 faces left

      for (let antIdx = 0; antIdx < ANTS_PER_TEAM; antIdx++) {
        const pos = this.terrain.getTeamSpawnPosition(teamIdx, antIdx, ANTS_PER_TEAM);
        const ant = new Ant(pos.x, pos.y, teamColor, antId, facingRight, teamIdx, antIdx);
        ant.resetWeaponsAndBuffs();
        this.ants.push(ant);
        this.hudHealthAnimations.push({ current: 100, target: 100 });
        antId++;
      }

      // Add one stats entry per team
      this.playerStats.push({ shotsFired: 0, hits: 0, damageDealt: 0 });
    }

    // Set first ant as current
    this.currentPlayerIndex = 0;
    // Account for the first turn in team turn counts (so next turn goes to ant 1, not ant 0 again)
    this.teamTurnCounts[0] = 1;

    // Set initial wind
    this.wind = (Math.random() - 0.5) * WIND_STRENGTH_MAX * 2;
    this.updateWindDisplay();

    // Set initial angle based on first player's facing direction
    const firstAnt = this.ants[0];
    this.angleSlider.value = firstAnt.angle.toString();
    this.angleValue.textContent = firstAnt.angle.toString();

    this.updateUI();
    this.fireButton.disabled = true; // Disable until intro pan completes

    // Hide UI elements during intro pan
    this.weaponSelector.hide();
    this.buffIndicator.hide();

    // Start background music
    soundManager.startMusic();
    this.musicButton.textContent = soundManager.isMusicPlaying() ? '🎵 ON' : '🎵 OFF';
    this.musicButton.classList.toggle('off', !soundManager.isMusicPlaying());

    // Start intro camera pan - show overview of all ants
    this.state = 'INTRO_PAN';
    this.introPanPhase = 0;
    this.introPanTimer = 2.5; // Show overview for 2.5 seconds

    // Calculate camera position to show all ants
    const minX = Math.min(...this.ants.map(a => a.x));
    const maxX = Math.max(...this.ants.map(a => a.x));

    // Calculate center point between all ants (horizontally)
    const centerX = (minX + maxX) / 2;

    // Calculate zoom to fit all ants horizontally
    // Zoom out as much as needed to show all 16 ants across MAP_WIDTH (4000px)
    const spanX = maxX - minX + 200;
    const calculatedZoom = BASE_WIDTH / spanX;
    // Use calculated zoom, with reasonable bounds
    const overviewZoom = Math.min(0.5, Math.max(0.1, calculatedZoom));

    // Calculate visible area at this zoom level (in world coordinates)
    const visibleHeight = BASE_HEIGHT / overviewZoom;

    // Focus on terrain area - position camera so ants are visible
    // Keep them in lower portion of view, but not too low to show bottom edge
    const avgAntY = this.ants.reduce((sum, a) => sum + a.y, 0) / this.ants.length;

    // Target Y position in world - show ants in lower third of visible area
    // but clamp to not go below terrain (MAP_HEIGHT is bottom of map)
    const targetCenterY = Math.min(avgAntY + visibleHeight * 0.15, MAP_HEIGHT - visibleHeight / 2 - 50);

    // Calculate offset (for the camera transform)
    let offsetX = BASE_WIDTH / 2 - centerX;
    let offsetY = BASE_HEIGHT / 2 - targetCenterY;

    // Clamp offsets to keep view within map bounds
    // When zoomed out, the visible area is larger, so we need stricter bounds
    const effectiveVisibleWidth = BASE_WIDTH / overviewZoom;
    const effectiveVisibleHeight = BASE_HEIGHT / overviewZoom;

    // Don't show past left edge (world x = 0)
    const maxOffsetX = effectiveVisibleWidth / 2 - BASE_WIDTH / 2;
    // Don't show past right edge (world x = MAP_WIDTH)
    const minOffsetX = BASE_WIDTH / 2 - MAP_WIDTH + effectiveVisibleWidth / 2;
    // Don't show past top edge (world y = 0)
    const maxOffsetY = effectiveVisibleHeight / 2 - BASE_HEIGHT / 2;
    // Don't show past bottom edge (world y = MAP_HEIGHT)
    const minOffsetY = BASE_HEIGHT / 2 - MAP_HEIGHT + effectiveVisibleHeight / 2;

    offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));
    offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

    // Start from zoomed out overview
    this.cameraZoom = overviewZoom;
    this.targetCameraZoom = overviewZoom;
    this.cameraOffsetX = offsetX;
    this.cameraOffsetY = offsetY;
    this.targetCameraOffsetX = offsetX;
    this.targetCameraOffsetY = offsetY;
  }

  private fire(): void {
    if (this.state !== 'PLAYING') return;
    if (this.isAITurn()) return; // Don't allow manual fire during AI turn

    this.isChargingPower = false;
    soundManager.stopCharging();

    const tank = this.ants[this.currentPlayerIndex];
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

    // Track shot fired (use teamIndex for stats)
    this.playerStats[tank.teamIndex].shotsFired++;
  }

  private startAITurn(): void {
    if (!this.ai) return;

    const aiAnt = this.ants[this.currentPlayerIndex];
    if (!aiAnt.isAlive) return;

    // Get alive ants from the enemy team (team 0 for AI which is team 1)
    const enemyTeamIndex = aiAnt.teamIndex === 0 ? 1 : 0;
    const enemyAnts = this.getAliveAntsForTeam(enemyTeamIndex);
    if (enemyAnts.length === 0) return;

    // Select a target - pick closest or random based on difficulty
    const target = this.ai.selectTarget(aiAnt, enemyAnts);
    if (!target) return;

    // AI selects weapon based on situation
    this.ai.selectWeapon(aiAnt, target);

    // Update weapon selector to show AI's weapon choice
    this.weaponSelector.update(aiAnt);

    // Calculate shot
    const shot = this.ai.calculateShot(aiAnt, target, this.wind);
    this.aiShot = { ...shot, target };
    this.aiThinkingTimer = this.ai.getThinkingTime();

    // Update tank barrel to show aiming
    aiAnt.angle = Math.round(shot.angle);

    this.state = 'AI_THINKING';
    this.fireButton.disabled = true;

    // Update UI to show AI's angle/power
    this.angleSlider.value = Math.round(shot.angle).toString();
    this.angleValue.textContent = Math.round(shot.angle).toString();
    this.powerSlider.value = Math.round(shot.power).toString();
    this.powerValue.textContent = Math.round(shot.power).toString();
  }

  private executeAIShot(): void {
    if (!this.aiShot) return;

    const tank = this.ants[this.currentPlayerIndex];
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

    // Track shot fired (use teamIndex for stats)
    this.playerStats[tank.teamIndex].shotsFired++;
  }

  private endTurn(): void {
    // Guard: only allow endTurn from FIRING state
    if (this.state !== 'FIRING') {
      return;
    }

    // Check for game over - a team loses when all its ants are eliminated
    const team0Alive = this.getAliveAntsForTeam(0);
    const team1Alive = this.getAliveAntsForTeam(1);

    if (team0Alive.length === 0 || team1Alive.length === 0) {
      // Determine winning team
      if (team0Alive.length > 0) {
        this.winningTeam = 0;
        this.winner = team0Alive[0]; // First alive ant represents winning team
      } else if (team1Alive.length > 0) {
        this.winningTeam = 1;
        this.winner = team1Alive[0];
      } else {
        // Draw - both teams eliminated
        this.winningTeam = null;
        this.winner = null;
      }

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
        ? this.winningTeam === 0
        : true; // In multiplayer, someone always wins
      soundManager.playGameOver(isVictory);
      return;
    }

    // Try to spawn a power-up between turns
    this.powerUpManager.trySpawn(this.terrain, this.ants);

    // Change wind slightly
    this.wind += (Math.random() - 0.5) * 10;
    this.wind = Math.max(-WIND_STRENGTH_MAX, Math.min(WIND_STRENGTH_MAX, this.wind));
    this.updateWindDisplay();

    // Next player
    this.nextPlayer();

    // Update UI for new player
    const currentAnt = this.ants[this.currentPlayerIndex];
    this.weaponSelector.update(currentAnt);
    this.buffIndicator.update(currentAnt);
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
    // Switch to the other team
    this.currentTeamIndex = (this.currentTeamIndex + 1) % NUM_TEAMS;

    // Find the next alive ant for this team
    const nextAnt = this.getNextAntForTeam(this.currentTeamIndex);

    if (!nextAnt) {
      // No alive ants on this team - this shouldn't happen if endTurn checks properly
      return;
    }

    this.currentPlayerIndex = nextAnt.playerIndex;

    // Increment turn count for this team (for round-robin cycling)
    this.teamTurnCounts[this.currentTeamIndex]++;

    // Reset turn timer
    this.turnTimeRemaining = this.maxTurnTime;

    // Update angle slider to current tank's angle
    this.angleSlider.value = nextAnt.angle.toString();
    this.angleValue.textContent = nextAnt.angle.toString();

    // Show turn banner
    const turnText = this.getTurnBannerText();
    this.showTurnBanner(turnText);

    // Focus camera on active player
    this.focusCameraOnAnt(nextAnt);

    this.updateUI();
  }

  // Get the next alive ant for a team (round-robin based on teamTurnCounts)
  private getNextAntForTeam(teamIndex: number): Ant | null {
    const aliveTeamAnts = this.getAliveAntsForTeam(teamIndex);
    if (aliveTeamAnts.length === 0) return null;

    // Round-robin: use teamTurnCounts to determine which ant goes next
    const turnIndex = this.teamTurnCounts[teamIndex] % aliveTeamAnts.length;
    return aliveTeamAnts[turnIndex];
  }

  // Get all alive ants for a team
  private getAliveAntsForTeam(teamIndex: number): Ant[] {
    return this.ants.filter(ant => ant.teamIndex === teamIndex && ant.isAlive);
  }

  // Get turn banner text based on current ant
  private getTurnBannerText(): string {
    const ant = this.ants[this.currentPlayerIndex];
    if (this.gameMode === 'single') {
      if (ant.teamIndex === 0) {
        return `YOUR TURN - ANT ${ant.teamAntIndex + 1}`;
      } else {
        return `CPU TURN - ANT ${ant.teamAntIndex + 1}`;
      }
    } else {
      return `TEAM ${ant.teamIndex + 1} - ANT ${ant.teamAntIndex + 1}`;
    }
  }

  private updateUI(): void {
    const tank = this.ants[this.currentPlayerIndex];
    let label: string;
    if (this.gameMode === 'single') {
      if (tank.teamIndex === 0) {
        label = `Your Team - Ant ${tank.teamAntIndex + 1}`;
      } else {
        label = `CPU Team - Ant ${tank.teamAntIndex + 1}`;
      }
    } else {
      label = `Team ${tank.teamIndex + 1} - Ant ${tank.teamAntIndex + 1}`;
    }

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

  private renderHUDHealthBars(): void {
    const ctx = this.ctx;
    const padding = 10;
    const teamPanelWidth = 180;
    const miniBarWidth = 36;
    const miniBarHeight = 8;
    const barsPerRow = 4;
    const barSpacing = 4;
    const rowSpacing = 12;

    // Draw team panels on left and right
    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
      const isLeft = teamIdx === 0;
      const panelX = isLeft ? padding : BASE_WIDTH - padding - teamPanelWidth;
      const panelY = 40;

      // Get team ants
      const teamAnts = this.ants.filter(a => a.teamIndex === teamIdx);
      const aliveCount = teamAnts.filter(a => a.isAlive).length;

      // Panel background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, teamPanelWidth, 75, 5);
      ctx.fill();

      // Team label
      const teamLabel = this.gameMode === 'single'
        ? (teamIdx === 0 ? 'YOUR TEAM' : 'CPU TEAM')
        : `TEAM ${teamIdx + 1}`;
      ctx.fillStyle = TEAM_COLORS[teamIdx];
      ctx.font = 'bold 11px "Courier New"';
      ctx.textAlign = isLeft ? 'left' : 'right';
      ctx.fillText(teamLabel, isLeft ? panelX + 5 : panelX + teamPanelWidth - 5, panelY + 14);

      // Alive count
      ctx.fillStyle = '#aaa';
      ctx.font = '10px "Courier New"';
      ctx.textAlign = isLeft ? 'right' : 'left';
      ctx.fillText(`${aliveCount}/${ANTS_PER_TEAM}`, isLeft ? panelX + teamPanelWidth - 5 : panelX + 5, panelY + 14);

      // Mini health bars in 2 rows of 4
      for (let i = 0; i < teamAnts.length; i++) {
        const ant = teamAnts[i];
        const row = Math.floor(i / barsPerRow);
        const col = i % barsPerRow;

        const barX = panelX + 8 + col * (miniBarWidth + barSpacing);
        const barY = panelY + 24 + row * (miniBarHeight + rowSpacing);

        // Update animated health value
        const antIndex = ant.playerIndex;
        if (this.hudHealthAnimations[antIndex]) {
          const anim = this.hudHealthAnimations[antIndex];
          anim.target = ant.health;
          const diff = anim.target - anim.current;
          anim.current += diff * 0.1;
          if (Math.abs(diff) < 0.1) anim.current = anim.target;
        }

        const animatedHealth = this.hudHealthAnimations[antIndex]?.current ?? ant.health;
        const healthPercent = animatedHealth / 100;
        const isCurrent = ant.playerIndex === this.currentPlayerIndex;
        const isDead = !ant.isAlive;

        // Health bar background
        ctx.fillStyle = isDead ? '#222' : '#333';
        ctx.beginPath();
        ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
        ctx.fill();

        if (!isDead) {
          // Health bar fill
          let healthColor: string;
          if (healthPercent > 0.5) {
            healthColor = '#4ECB71';
          } else if (healthPercent > 0.25) {
            healthColor = '#FFD93D';
          } else {
            healthColor = '#FF6B6B';
          }

          ctx.fillStyle = healthColor;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth * healthPercent, miniBarHeight, 2);
          ctx.fill();
        }

        // Highlight current ant with gold border
        if (isCurrent && (this.state === 'PLAYING' || this.state === 'AI_THINKING')) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(barX - 1, barY - 1, miniBarWidth + 2, miniBarHeight + 2, 2);
          ctx.stroke();
        } else if (isDead) {
          // Gray border for dead ants
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
          ctx.stroke();

          // X mark for dead ant
          ctx.strokeStyle = '#666';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(barX + 2, barY + 2);
          ctx.lineTo(barX + miniBarWidth - 2, barY + miniBarHeight - 2);
          ctx.moveTo(barX + miniBarWidth - 2, barY + 2);
          ctx.lineTo(barX + 2, barY + miniBarHeight - 2);
          ctx.stroke();
        }

        // Ant number below bar
        ctx.fillStyle = isDead ? '#444' : (isCurrent ? '#FFD700' : '#888');
        ctx.font = isCurrent ? 'bold 8px "Courier New"' : '8px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}`, barX + miniBarWidth / 2, barY + miniBarHeight + 8);
      }
    }
  }

  private renderIntroPanOverlay(): void {
    const ctx = this.ctx;
    ctx.save();

    // Title banner at top
    const bannerText = this.introPanPhase === 0 ? 'BATTLE OVERVIEW' : 'GET READY!';

    // Fade effect based on phase
    let alpha = 1;
    if (this.introPanPhase === 0 && this.introPanTimer < 0.5) {
      alpha = this.introPanTimer / 0.5; // Fade out at end of overview
    } else if (this.introPanPhase === 1 && this.introPanTimer > 2.5) {
      alpha = (3.0 - this.introPanTimer) / 0.5; // Fade in at start of pan
    }

    ctx.globalAlpha = alpha;

    // Background bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 30, BASE_WIDTH, 50);

    // Title text
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bannerText, BASE_WIDTH / 2, 55);

    // During overview phase, show team labels in world space (only show a few key ants)
    if (this.introPanPhase === 0) {
      ctx.restore();
      ctx.save();

      // Apply camera transform for world-space labels
      this.applyCameraTransform(1.0);

      // Show labels for first and last ant of each team
      for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
        const teamAnts = this.ants.filter(a => a.teamIndex === teamIdx);
        const firstAnt = teamAnts[0];
        const lastAnt = teamAnts[teamAnts.length - 1];
        const teamLabel = this.gameMode === 'single'
          ? (teamIdx === 0 ? 'YOUR TEAM' : 'CPU TEAM')
          : `TEAM ${teamIdx + 1}`;

        // Show label above first ant of each team
        if (firstAnt) {
          // Label background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.roundRect(firstAnt.x - 45, firstAnt.y - 75, 90, 28, 6);
          ctx.fill();

          // Label border in team color
          ctx.strokeStyle = TEAM_COLORS[teamIdx];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(firstAnt.x - 45, firstAnt.y - 75, 90, 28, 6);
          ctx.stroke();

          // Label text
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px "Courier New"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(teamLabel, firstAnt.x, firstAnt.y - 61);

          // Arrow pointing down to ant
          ctx.fillStyle = TEAM_COLORS[teamIdx];
          ctx.beginPath();
          ctx.moveTo(firstAnt.x, firstAnt.y - 47);
          ctx.lineTo(firstAnt.x - 6, firstAnt.y - 53);
          ctx.lineTo(firstAnt.x + 6, firstAnt.y - 53);
          ctx.closePath();
          ctx.fill();
        }

        // Draw line connecting team ants
        if (teamAnts.length > 1) {
          ctx.strokeStyle = TEAM_COLORS[teamIdx];
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(firstAnt.x, firstAnt.y - 30);
          ctx.lineTo(lastAnt.x, lastAnt.y - 30);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    ctx.restore();
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
    ctx.shadowColor = this.ants[this.currentPlayerIndex]?.color || '#fff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = this.ants[this.currentPlayerIndex]?.color || '#fff';
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
    const tank = this.ants[this.currentPlayerIndex];
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
