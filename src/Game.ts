import { BASE_WIDTH, BASE_HEIGHT, MAP_WIDTH, MAP_HEIGHT, BACKGROUND_PARALLAX, MAX_POWER, WIND_STRENGTH_MAX, updateCanvasSize, SCALE_X, SCALE_Y, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS } from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Ant } from './Ant.ts';
import { Projectile } from './Projectile.ts';
import { Explosion } from './Explosion.ts';
import { AntAI, AIDifficulty, AIMovementPlan } from './AI.ts';
import { soundManager } from './Sound.ts';
import { WeaponType, WEAPON_CONFIGS, WEAPON_ORDER } from './weapons/WeaponTypes.ts';
import { BurnArea } from './weapons/BurnArea.ts';
import { PowerUpManager } from './powerups/PowerUpManager.ts';
import { POWERUP_CONFIGS } from './powerups/PowerUpTypes.ts';
import { WeaponSelector } from './ui/WeaponSelector.ts';
import { BuffIndicator } from './ui/BuffIndicator.ts';

// Import extracted modules
import { GameState, GameMode, MenuItem, PlayerStats } from './types/GameTypes.ts';
import { CameraSystem } from './systems/CameraSystem.ts';
import { EffectsSystem } from './systems/EffectsSystem.ts';
import { MenuRenderer } from './rendering/MenuRenderer.ts';
import { HUDRenderer } from './rendering/HUDRenderer.ts';
import { EffectsRenderer } from './rendering/EffectsRenderer.ts';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private ants: Ant[];
  private explosions: Explosion[];
  private currentPlayerIndex: number;
  private currentTeamIndex: number;
  private teamTurnCounts: number[];
  private winningTeam: number | null;
  private wind: number;
  private state: GameState;
  private winner: Ant | null;
  private gameMode: GameMode;
  private ai: AntAI | null;
  private aiThinkingTimer: number;
  private aiShot: { angle: number; power: number; target: Ant | null } | null;
  private aiMovementPlan: AIMovementPlan | null;
  private aiTarget: Ant | null;

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

  // Intro camera pan
  private introPanPhase: number;
  private introPanTimer: number;

  // Mouse controls
  private mouseX: number;
  private mouseY: number;
  private isMouseDown: boolean;

  // Weapon menu
  private weaponMenuOpen: boolean;
  private weaponMenuPosition: { x: number; y: number };

  // Movement input
  private movementKeys: { left: boolean; right: boolean };

  // Turn timer
  private turnTimeRemaining: number;
  private maxTurnTime: number;

  // Statistics
  private playerStats: PlayerStats[];

  private lastTime: number;

  // Hit delay (camera stays on hit location before returning to shooter)
  private hitDelayTimer: number;
  private lastHitPosition: { x: number; y: number } | null;

  // Weapon and Power-up systems
  private projectiles: Projectile[];
  private burnAreas: BurnArea[];
  private powerUpManager: PowerUpManager;
  private weaponSelector: WeaponSelector;
  private buffIndicator: BuffIndicator;

  // Extracted systems
  private camera: CameraSystem;
  private effects: EffectsSystem;
  private menuRenderer: MenuRenderer;
  private hudRenderer: HUDRenderer;
  private effectsRenderer: EffectsRenderer;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

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
    this.aiMovementPlan = null;
    this.aiTarget = null;
    this.isChargingPower = false;
    this.introPanPhase = 0;
    this.introPanTimer = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.isMouseDown = false;
    this.weaponMenuOpen = false;
    this.weaponMenuPosition = { x: 0, y: 0 };
    this.movementKeys = { left: false, right: false };
    this.maxTurnTime = 30;
    this.turnTimeRemaining = this.maxTurnTime;
    this.playerStats = [];
    this.lastTime = 0;
    this.hitDelayTimer = 0;
    this.lastHitPosition = null;

    // Initialize extracted systems
    this.camera = new CameraSystem();
    this.effects = new EffectsSystem();
    this.menuRenderer = new MenuRenderer();
    this.hudRenderer = new HUDRenderer();
    this.effectsRenderer = new EffectsRenderer();

    // Initialize weapon and power-up systems
    this.projectiles = [];
    this.burnAreas = [];
    this.powerUpManager = new PowerUpManager();
    this.weaponSelector = new WeaponSelector();
    this.buffIndicator = new BuffIndicator();

    this.weaponSelector.hide();
    this.buffIndicator.hide();

    this.weaponSelector.setOnWeaponSelect((weapon: WeaponType) => {
      if (this.state === 'PLAYING' && !this.isAITurn()) {
        const tank = this.ants[this.currentPlayerIndex];
        if (tank && tank.selectWeapon(weapon)) {
          this.weaponSelector.update(tank);
          soundManager.playMenuSelect();
        }
      }
    });

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

    this.currentPlayerSpan.style.display = 'none';
    this.windInfo.style.display = 'none';

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
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

    this.fireButton.addEventListener('click', () => this.fire());

    this.musicButton.addEventListener('click', () => {
      const enabled = soundManager.toggleMusic();
      this.musicButton.textContent = enabled ? '🎵 ON' : '🎵 OFF';
      this.musicButton.classList.toggle('off', !enabled);
    });

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    // Prevent context menu on right-click
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      // Close weapon menu if open
      if (this.weaponMenuOpen) {
        this.weaponMenuOpen = false;
        return;
      }
      if (this.state === 'SETTINGS') {
        this.state = 'PAUSED';
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      } else if (this.state === 'PLAYING' || this.state === 'AI_THINKING' || this.state === 'AI_MOVING' || this.state === 'POWERUP_FALLING') {
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
        this.menuRenderer.reset();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;
    if (this.isAITurn()) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.movementKeys.left = true;
        {
          const tank = this.ants[this.currentPlayerIndex];
          if (tank && tank.canMove()) {
            tank.startWalking(-1);
          }
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.movementKeys.right = true;
        {
          const tank = this.ants[this.currentPlayerIndex];
          if (tank && tank.canMove()) {
            tank.startWalking(1);
          }
        }
        break;
      case ' ':
        e.preventDefault();
        {
          const tank = this.ants[this.currentPlayerIndex];
          // Space is for jumping
          tank.jump();
        }
        break;
      case 'm':
      case 'M':
        const enabled = soundManager.toggleMusic();
        this.musicButton.textContent = enabled ? '🎵 ON' : '🎵 OFF';
        this.musicButton.classList.toggle('off', !enabled);
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
        this.selectWeaponByKey(e.key);
        break;
      case 'k':
      case 'K':
        // Debug: Kill current ant to test death animations
        {
          const ant = this.ants[this.currentPlayerIndex];
          if (ant && ant.isAlive) {
            ant.takeDamage(999);
            this.endTurn();
          }
        }
        break;
      case 'p':
      case 'P':
        // Debug: Force spawn a power-up for testing
        {
          const x = 100 + Math.random() * (MAP_WIDTH - 200);
          const types: Array<'health' | 'damage_boost' | 'shield' | 'double_shot'> = ['health', 'damage_boost', 'shield', 'double_shot'];
          const randomType = types[Math.floor(Math.random() * types.length)];
          this.powerUpManager.spawnPowerUp(x, this.terrain, randomType);
          console.log(`[Debug] Spawned power-up: ${randomType} at x=${Math.round(x)}`);
          // Transition to falling state so camera follows and animation plays
          this.state = 'POWERUP_FALLING';
          this.fireButton.disabled = true;
        }
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (this.state !== 'PLAYING' || this.isAITurn()) return;

    const tank = this.ants[this.currentPlayerIndex];

    switch (e.key) {
      case 'ArrowLeft':
        this.movementKeys.left = false;
        if (!this.movementKeys.right) {
          tank?.stopWalking();
        } else {
          // Still holding right, walk right
          tank?.startWalking(1);
        }
        break;
      case 'ArrowRight':
        this.movementKeys.right = false;
        if (!this.movementKeys.left) {
          tank?.stopWalking();
        } else {
          // Still holding left, walk left
          tank?.startWalking(-1);
        }
        break;
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;

    if (this.state === 'PLAYING' && !this.isAITurn()) {
      this.updateAimFromMouse();
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Right-click: Open weapon menu
    if (e.button === 2) {
      if (this.state === 'PLAYING' && !this.isAITurn()) {
        this.weaponMenuOpen = true;
        this.weaponMenuPosition = { x: clickX, y: clickY };
      }
      return;
    }

    // Left-click
    if (e.button !== 0) return;

    // If weapon menu is open, handle click on menu
    if (this.weaponMenuOpen) {
      this.handleWeaponMenuClick(clickX, clickY);
      this.weaponMenuOpen = false;
      return;
    }

    this.isMouseDown = true;

    if (this.state === 'PLAYING' && !this.isAITurn()) {
      const tank = this.ants[this.currentPlayerIndex];
      const weaponConfig = tank.getSelectedWeaponConfig();

      // Shotgun fires instantly without charging
      if (!weaponConfig.requiresCharging) {
        this.fireInstant();
        return;
      }

      if (!this.isChargingPower) {
        this.isChargingPower = true;
        this.powerSlider.value = '0';
        this.powerSlider.dispatchEvent(new Event('input'));
        soundManager.startCharging();
      }
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isMouseDown = false;

    if (this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
      this.isChargingPower = false;
      soundManager.stopCharging();
      this.fire();
    }
  }

  private handleMouseLeave(): void {
    if (this.isMouseDown && this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
      this.isChargingPower = false;
      this.isMouseDown = false;
      soundManager.stopCharging();
      this.fire();
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
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
      this.menuRenderer.reset();
    }
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
        soundManager.playMenuSelect();
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
    this.weaponSelector.hide();
    this.buffIndicator.hide();
    this.menuRenderer.reset();
  }

  private openSettings(): void {
    this.state = 'SETTINGS';
    this.selectedSettingIndex = 0;
  }

  private isAITurn(): boolean {
    return this.gameMode === 'single' && this.currentTeamIndex === 1;
  }

  private resizeCanvas(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width;
    this.canvas.height = height;

    updateCanvasSize(width, height);
  }

  private updateAimFromMouse(): void {
    const tank = this.ants[this.currentPlayerIndex];
    if (!tank || !tank.isAlive) return;

    const worldPos = this.camera.screenToWorld(this.mouseX, this.mouseY);

    const dx = worldPos.x - tank.x;
    const dy = worldPos.y - (tank.y - 15);

    let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    angle = Math.max(-45, Math.min(225, angle));

    this.angleSlider.value = angle.toString();
    this.angleSlider.dispatchEvent(new Event('input'));
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
    // Handle effects (hitstop, screen flash)
    const effectiveDelta = this.effects.update(deltaTime);

    // Update camera
    this.camera.updateScreenShake(deltaTime);
    const isIntroPanPhase1 = this.state === 'INTRO_PAN' && this.introPanPhase === 1;
    this.camera.update(deltaTime, isIntroPanPhase1);

    // Update terrain
    this.terrain.update(effectiveDelta, this.wind);

    // Update menu renderer animations
    this.menuRenderer.update(deltaTime, this.state, this.menuItems.length);

    // Update HUD turn banner
    this.hudRenderer.updateTurnBanner(deltaTime);

    // Update intro camera pan
    if (this.state === 'INTRO_PAN') {
      this.updateIntroPan(deltaTime);
    }

    // Update turn timer
    if (this.state === 'PLAYING' && !this.isAITurn()) {
      this.turnTimeRemaining -= deltaTime;
      if (this.turnTimeRemaining <= 0) {
        this.turnTimeRemaining = 0;
        this.powerSlider.value = Math.floor(20 + Math.random() * 60).toString();
        this.powerSlider.dispatchEvent(new Event('input'));
        this.fire();
      }

      // Update movement for current ant
      const currentAnt = this.ants[this.currentPlayerIndex];
      if (currentAnt && currentAnt.isAlive) {
        currentAnt.updateMovement(effectiveDelta, this.terrain);
      }
    }

    // Handle power charging
    if (this.isChargingPower && this.state === 'PLAYING' && !this.isAITurn()) {
      this.updatePowerCharging(deltaTime);
    }

    // Update tanks
    for (const tank of this.ants) {
      tank.update(effectiveDelta);
    }

    // AI thinking
    if (this.state === 'AI_THINKING') {
      // Continue applying physics so AI lands if still in the air from movement
      const aiAnt = this.ants[this.currentPlayerIndex];
      if (aiAnt && aiAnt.isAlive) {
        aiAnt.updateMovement(effectiveDelta, this.terrain);
      }

      this.aiThinkingTimer -= deltaTime * 1000;
      if (this.aiThinkingTimer <= 0 && this.aiShot) {
        this.executeAIShot();
      }
    }

    // AI movement
    if (this.state === 'AI_MOVING') {
      this.updateAIMovement(effectiveDelta);
    }

    // Firing state
    if (this.state === 'FIRING') {
      this.updateFiring(effectiveDelta);
    }

    // Power-up falling state
    if (this.state === 'POWERUP_FALLING') {
      this.updatePowerUpFalling(effectiveDelta);
    }

    // Update power-ups
    if (this.state === 'PLAYING' || this.state === 'FIRING' || this.state === 'POWERUP_FALLING') {
      this.updatePowerUps(effectiveDelta);
    }
  }

  private updateIntroPan(deltaTime: number): void {
    this.introPanTimer -= deltaTime;

    if (this.introPanPhase === 0) {
      if (this.introPanTimer <= 0) {
        this.introPanPhase = 1;
        this.introPanTimer = 3.0;
        const firstAnt = this.ants[0];
        this.camera.focusOnAnt(firstAnt, false);
      }
    } else if (this.introPanPhase === 1) {
      if (this.introPanTimer <= 0) {
        this.state = 'PLAYING';
        this.fireButton.disabled = false;
        const turnText = this.getTurnBannerText();
        this.hudRenderer.showTurnBanner(turnText);
      }
    }
  }

  private updatePowerCharging(deltaTime: number): void {
    const currentPower = parseInt(this.powerSlider.value);
    const powerSpeed = 100;
    const powerChange = powerSpeed * deltaTime;
    let newPower = currentPower + powerChange;

    // Auto-fire at 100% power
    if (newPower >= 100) {
      newPower = 100;
      this.powerSlider.value = '100';
      this.powerSlider.dispatchEvent(new Event('input'));
      this.isChargingPower = false;
      soundManager.stopCharging();
      this.fire();
      return;
    }

    this.powerSlider.value = Math.round(newPower).toString();
    this.powerSlider.dispatchEvent(new Event('input'));
    soundManager.updateChargingPitch(newPower);

    const tank = this.ants[this.currentPlayerIndex];
    if (tank) {
      tank.updateCharging(deltaTime, newPower);
    }
  }

  private updateFiring(effectiveDelta: number): void {
    // Update ALL ants - check for ground removal and apply physics
    // This handles both knockback from explosions AND ants whose ground was destroyed
    for (const ant of this.ants) {
      if (ant.isAlive) {
        ant.updateMovement(effectiveDelta, this.terrain);
      }
    }

    const newProjectiles: Projectile[] = [];
    let anyActiveProjectile = false;
    let cameraFollowProjectile: Projectile | null = null;

    for (const projectile of this.projectiles) {
      const result = projectile.update(effectiveDelta, this.terrain, this.ants, this.wind);

      if (projectile.active) {
        anyActiveProjectile = true;
        cameraFollowProjectile = projectile;
      }

      if (result.shouldCluster) {
        this.handleClusterSplit(projectile, result, newProjectiles);
      }

      if (!result.active && result.hit) {
        this.handleProjectileHit(projectile, result.hitX, result.hitY);
      }
    }

    this.projectiles.push(...newProjectiles);
    this.projectiles = this.projectiles.filter(p =>
      p.active || p.trail.length > 0 || p.trailParticles.length > 0 || p.impactParticles.length > 0
    );

    // Camera follows projectile
    if (cameraFollowProjectile) {
      this.camera.focusOnProjectile(cameraFollowProjectile.x, cameraFollowProjectile.y);
    } else if (!anyActiveProjectile) {
      // Delay camera return to shooter after a hit
      if (this.hitDelayTimer > 0) {
        this.hitDelayTimer -= effectiveDelta;
        // Keep camera focused on last hit position during delay
        if (this.lastHitPosition) {
          this.camera.focusOnProjectile(this.lastHitPosition.x, this.lastHitPosition.y);
        }
      } else {
        // Delay finished, move camera back to shooter
        this.lastHitPosition = null;
        const currentAnt = this.ants[this.currentPlayerIndex];
        if (currentAnt && currentAnt.isAlive) {
          const clamped = this.camera.clampOffset(
            BASE_WIDTH / 2 - currentAnt.x,
            BASE_HEIGHT / 2 - currentAnt.y,
            0.5 // Target zoom after resetZoom
          );
          this.camera.targetOffsetX = clamped.x;
          this.camera.targetOffsetY = clamped.y;
        }
        this.camera.resetZoom();
      }
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
    this.effects.updateFloatingTexts(effectiveDelta);

    // Update confetti and fireworks
    this.effects.updateConfetti(effectiveDelta);
    this.effects.updateFireworks(effectiveDelta);

    // Check if firing phase is complete (including hit delay)
    const hasActiveProjectiles = this.projectiles.some(p => p.active);
    if (!hasActiveProjectiles && this.explosions.length === 0 && this.burnAreas.length === 0 && this.hitDelayTimer <= 0) {
      this.endTurn();
    }
  }

  private handleClusterSplit(
    projectile: Projectile,
    result: { clusterX: number; clusterY: number; clusterVx: number; clusterVy: number },
    newProjectiles: Projectile[]
  ): void {
    const weaponConfig = projectile.weaponConfig;
    soundManager.playClusterSplit();

    for (let i = 0; i < weaponConfig.clusterCount; i++) {
      const spreadAngle = ((i / weaponConfig.clusterCount) * Math.PI * 2) - Math.PI / 2;
      const spreadSpeed = 50 + Math.random() * 30;

      const bombletConfig = { ...weaponConfig };
      bombletConfig.damage = weaponConfig.clusterDamage;
      bombletConfig.explosionRadius = 20;

      const bomblet = new Projectile(
        result.clusterX,
        result.clusterY,
        0,
        0,
        this.wind,
        projectile.owner,
        bombletConfig,
        true
      );

      bomblet.vx = result.clusterVx + Math.cos(spreadAngle) * spreadSpeed;
      bomblet.vy = result.clusterVy + Math.sin(spreadAngle) * spreadSpeed - 30;

      newProjectiles.push(bomblet);
    }
  }

  private handleProjectileHit(projectile: Projectile, hitX: number, hitY: number): void {
    const weaponConfig = projectile.weaponConfig;
    const healthBefore = this.ants.map(t => t.health);
    const shooterTeamIndex = projectile.owner.teamIndex;

    const damageMultiplier = projectile.owner.getDamageMultiplier();
    const finalDamage = Math.floor(weaponConfig.damage * damageMultiplier);

    // Track hit position for camera delay
    this.lastHitPosition = { x: hitX, y: hitY };
    this.hitDelayTimer = 2.0; // 2 second delay on hit location

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

    projectile.owner.consumeDamageBoost();

    // Spawn burn area if weapon has burn duration (napalm)
    if (weaponConfig.burnDuration > 0) {
      const burnArea = new BurnArea(
        hitX,
        hitY,
        weaponConfig.explosionRadius * 1.2,
        weaponConfig.burnDuration,
        weaponConfig.burnDamagePerSecond
      );
      this.burnAreas.push(burnArea);
    }

    this.effects.triggerHitstop(0.08);
    const shakeIntensity = 10 + (weaponConfig.explosionRadius / 35) * 8;
    this.camera.triggerScreenShake(shakeIntensity);
    this.effects.triggerScreenFlash('#FFA500', 0.5);

    // Track damage dealt
    let totalDamage = 0;
    let hitCount = 0;
    for (let i = 0; i < this.ants.length; i++) {
      const ant = this.ants[i];
      if (ant.teamIndex !== shooterTeamIndex) {
        const damage = healthBefore[i] - ant.health;
        if (damage > 0) {
          totalDamage += damage;
          hitCount++;

          const isCritical = damage >= 40;
          this.effects.addFloatingText({
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

  private updatePowerUps(effectiveDelta: number): void {
    const collected = this.powerUpManager.update(effectiveDelta, this.ants);
    if (collected) {
      soundManager.playPowerUpCollect();
      this.buffIndicator.update(collected.ant);

      const config = POWERUP_CONFIGS[collected.type];
      this.effects.addFloatingText({
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

  private updatePowerUpFalling(deltaTime: number): void {
    // Update the falling power-up
    const landed = this.powerUpManager.updateFalling(deltaTime);

    // Focus camera on the falling power-up
    const fallingPowerUp = this.powerUpManager.getFallingPowerUp();
    if (fallingPowerUp) {
      this.camera.focusOnPowerUp(fallingPowerUp.x, fallingPowerUp.y);
    }

    // When power-up lands, proceed to next turn
    if (landed) {
      this.proceedToNextTurn();
    }
  }

  private proceedToNextTurn(): void {
    this.wind += (Math.random() - 0.5) * 10;
    this.wind = Math.max(-WIND_STRENGTH_MAX, Math.min(WIND_STRENGTH_MAX, this.wind));
    this.updateWindDisplay();

    this.nextPlayer();

    const currentAnt = this.ants[this.currentPlayerIndex];
    this.weaponSelector.update(currentAnt);
    this.buffIndicator.update(currentAnt);
    this.weaponSelector.setEnabled(true);

    if (this.isAITurn()) {
      this.startAITurn();
    } else {
      this.state = 'PLAYING';
      this.fireButton.disabled = false;
    }
  }

  private render(): void {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.ctx.save();
    this.ctx.scale(SCALE_X, SCALE_Y);

    if (this.state === 'MENU') {
      this.menuRenderer.renderMenu(this.ctx, this.menuItems, this.selectedMenuItem);
      this.ctx.restore();
      return;
    }

    // Background layer (with parallax)
    this.ctx.save();
    this.camera.applyTransform(this.ctx, BACKGROUND_PARALLAX);
    this.terrain.renderBackground(this.ctx);
    this.ctx.restore();

    // Gameplay layer
    this.ctx.save();
    this.camera.applyTransform(this.ctx, 1.0);

    this.terrain.render(this.ctx);

    for (let i = 0; i < this.ants.length; i++) {
      const isCurrentAndPlaying = i === this.currentPlayerIndex &&
        (this.state === 'PLAYING' || this.state === 'AI_THINKING' || this.state === 'FIRING');
      const chargingPower = (isCurrentAndPlaying && this.isChargingPower)
        ? parseInt(this.powerSlider.value)
        : 0;
      this.ants[i].render(this.ctx, isCurrentAndPlaying, chargingPower);

      // Render movement energy bar for current player
      if (isCurrentAndPlaying && this.state === 'PLAYING' && !this.isAITurn()) {
        this.hudRenderer.renderMovementEnergy(this.ctx, this.ants[i], true);
      }
    }

    this.powerUpManager.render(this.ctx);

    for (const burnArea of this.burnAreas) {
      burnArea.render(this.ctx);
    }

    for (const projectile of this.projectiles) {
      projectile.render(this.ctx);
    }

    for (const explosion of this.explosions) {
      explosion.render(this.ctx);
    }

    // Screen flash
    this.effectsRenderer.renderScreenFlash(
      this.ctx,
      this.effects.screenFlashIntensity,
      this.effects.screenFlashColor
    );

    this.ctx.restore();

    // UI layer (no camera movement)
    if ((this.state === 'PLAYING' || this.state === 'AI_THINKING') && !this.isAITurn()) {
      this.hudRenderer.renderTurnTimer(this.ctx, this.turnTimeRemaining, this.maxTurnTime);
    }

    // Weapon menu (UI layer, no camera transform)
    if (this.weaponMenuOpen && this.state === 'PLAYING') {
      this.renderWeaponMenu(this.ctx);
    }

    if (this.state === 'GAME_OVER') {
      this.menuRenderer.renderGameOver(
        this.ctx,
        this.winner,
        this.winningTeam,
        this.gameMode,
        this.playerStats
      );
      this.effectsRenderer.renderConfetti(this.ctx, this.effects.confetti);
      this.effectsRenderer.renderFireworks(this.ctx, this.effects.fireworks);
      this.effects.updateConfetti(0.016);
      this.effects.updateFireworks(0.016, this.winner !== null);
    }

    if (this.state === 'PAUSED') {
      this.menuRenderer.renderPauseMenu(this.ctx, this.pauseMenuItems, this.selectedPauseItem);
    }

    if (this.state === 'SETTINGS') {
      this.menuRenderer.renderSettings(this.ctx, this.settingsOptions, this.selectedSettingIndex);
    }

    this.ctx.restore();
  }

  private startGame(mode: GameMode, aiDifficulty?: AIDifficulty): void {
    this.gameMode = mode;
    this.ants = [];
    this.projectiles = [];
    this.explosions = [];
    this.burnAreas = [];
    this.currentPlayerIndex = 0;
    this.currentTeamIndex = 0;
    this.teamTurnCounts = [0, 0];
    this.winningTeam = null;
    this.winner = null;
    this.isChargingPower = false;
    this.turnTimeRemaining = this.maxTurnTime;

    // Clear effects
    this.effects.clear();

    // Reset hit delay state
    this.hitDelayTimer = 0;
    this.lastHitPosition = null;

    // Clear power-ups
    this.powerUpManager.clear();

    // Setup AI
    if (mode === 'single' && aiDifficulty) {
      this.ai = new AntAI(aiDifficulty);
    } else {
      this.ai = null;
    }
    this.aiMovementPlan = null;
    this.aiTarget = null;

    // Generate terrain
    this.terrain.generate();

    // Create ants
    this.playerStats = [];
    let antId = 0;

    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
      const teamColor = TEAM_COLORS[teamIdx];
      const facingRight = teamIdx === 0;

      for (let antIdx = 0; antIdx < ANTS_PER_TEAM; antIdx++) {
        const pos = this.terrain.getTeamSpawnPosition(teamIdx, antIdx, ANTS_PER_TEAM);
        const ant = new Ant(pos.x, pos.y, teamColor, antId, facingRight, teamIdx, antIdx);
        ant.resetWeaponsAndBuffs();
        this.ants.push(ant);
        antId++;
      }

      this.playerStats.push({ shotsFired: 0, hits: 0, damageDealt: 0 });
    }

    // Initialize HUD health animations
    this.hudRenderer.initHealthAnimations(this.ants.length);

    this.currentPlayerIndex = 0;
    this.teamTurnCounts[0] = 1;

    this.wind = (Math.random() - 0.5) * WIND_STRENGTH_MAX * 2;
    this.updateWindDisplay();

    const firstAnt = this.ants[0];
    firstAnt.resetMovementEnergy();
    this.movementKeys = { left: false, right: false };
    this.angleSlider.value = firstAnt.angle.toString();
    this.angleValue.textContent = firstAnt.angle.toString();

    this.updateUI();
    this.fireButton.disabled = true;

    this.weaponSelector.hide();
    this.buffIndicator.hide();
    this.weaponMenuOpen = false;

    soundManager.startMusic();
    this.musicButton.textContent = soundManager.isMusicPlaying() ? '🎵 ON' : '🎵 OFF';
    this.musicButton.classList.toggle('off', !soundManager.isMusicPlaying());

    // Setup intro camera pan
    this.state = 'INTRO_PAN';
    this.introPanPhase = 0;
    this.introPanTimer = 2.5;

    this.setupOverviewCamera();
  }

  private setupOverviewCamera(): void {
    const minX = Math.min(...this.ants.map(a => a.x));
    const maxX = Math.max(...this.ants.map(a => a.x));
    const centerX = (minX + maxX) / 2;

    const spanX = maxX - minX + 200;
    const calculatedZoom = BASE_WIDTH / spanX;
    const overviewZoom = Math.min(0.5, Math.max(0.1, calculatedZoom));

    const visibleHeight = BASE_HEIGHT / overviewZoom;
    const avgAntY = this.ants.reduce((sum, a) => sum + a.y, 0) / this.ants.length;
    const targetCenterY = Math.min(avgAntY + visibleHeight * 0.15, MAP_HEIGHT - visibleHeight / 2 - 50);

    let offsetX = BASE_WIDTH / 2 - centerX;
    let offsetY = BASE_HEIGHT / 2 - targetCenterY;

    const effectiveVisibleWidth = BASE_WIDTH / overviewZoom;
    const effectiveVisibleHeight = BASE_HEIGHT / overviewZoom;

    const maxOffsetX = effectiveVisibleWidth / 2 - BASE_WIDTH / 2;
    const minOffsetX = BASE_WIDTH / 2 - MAP_WIDTH + effectiveVisibleWidth / 2;
    const maxOffsetY = effectiveVisibleHeight / 2 - BASE_HEIGHT / 2;
    const minOffsetY = BASE_HEIGHT / 2 - MAP_HEIGHT + effectiveVisibleHeight / 2;

    offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));
    offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

    this.camera.zoom = overviewZoom;
    this.camera.targetZoom = overviewZoom;
    this.camera.offsetX = offsetX;
    this.camera.offsetY = offsetY;
    this.camera.targetOffsetX = offsetX;
    this.camera.targetOffsetY = offsetY;
  }

  private fire(): void {
    if (this.state !== 'PLAYING') return;
    if (this.isAITurn()) return;

    this.isChargingPower = false;
    this.weaponMenuOpen = false;
    soundManager.stopCharging();

    const tank = this.ants[this.currentPlayerIndex];
    if (!tank.isAlive) {
      this.nextPlayer();
      return;
    }

    const angle = parseInt(this.angleSlider.value);
    const power = (parseInt(this.powerSlider.value) / 100) * MAX_POWER;
    const weaponConfig = tank.getSelectedWeaponConfig();

    this.projectiles = [];

    const barrelEnd = tank.getBarrelEnd();
    const hasDoubleShot = tank.hasDoubleShot();
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
          this.wind,
          tank,
          weaponConfig
        );
        this.projectiles.push(projectile);
      }
    } else {
      // Single projectile weapons (with optional double shot buff)
      const shotCount = hasDoubleShot ? 2 : 1;

      for (let i = 0; i < shotCount; i++) {
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

      if (hasDoubleShot) {
        tank.consumeDoubleShot();
      }
    }

    tank.useAmmo();

    this.weaponSelector.update(tank);
    this.buffIndicator.update(tank);

    tank.fire();

    const powerRatio = parseInt(this.powerSlider.value) / 100;
    this.camera.triggerScreenShake(4 + powerRatio * 8);
    this.effects.triggerScreenFlash('#FFF', 0.15 + powerRatio * 0.1);

    this.state = 'FIRING';
    this.fireButton.disabled = true;
    this.weaponSelector.setEnabled(false);
    soundManager.playShoot();

    this.playerStats[tank.teamIndex].shotsFired++;
  }

  private selectWeaponByKey(key: string): void {
    const index = parseInt(key) - 1;
    if (index >= 0 && index < WEAPON_ORDER.length) {
      const weapon = WEAPON_ORDER[index];
      const tank = this.ants[this.currentPlayerIndex];
      if (tank && tank.selectWeapon(weapon)) {
        this.weaponSelector.update(tank);
        soundManager.playMenuSelect();
      }
    }
  }

  private fireInstant(): void {
    if (this.state !== 'PLAYING') return;
    if (this.isAITurn()) return;

    const tank = this.ants[this.currentPlayerIndex];
    if (!tank.isAlive) {
      this.nextPlayer();
      return;
    }

    const weaponConfig = tank.getSelectedWeaponConfig();
    const angle = parseInt(this.angleSlider.value);
    const fixedPower = MAX_POWER * 0.7; // 70% of max power

    this.projectiles = [];

    const barrelEnd = tank.getBarrelEnd();
    const pelletCount = weaponConfig.pelletCount;
    const spreadAngle = weaponConfig.spreadAngle;

    // Create projectiles (single or multiple with spread)
    if (pelletCount > 1) {
      for (let i = 0; i < pelletCount; i++) {
        const spreadOffset = (i / (pelletCount - 1) - 0.5) * spreadAngle;
        const pelletAngle = angle + spreadOffset;

        const projectile = new Projectile(
          barrelEnd.x,
          barrelEnd.y,
          pelletAngle,
          fixedPower,
          this.wind,
          tank,
          weaponConfig
        );
        this.projectiles.push(projectile);
      }
    } else {
      // Single projectile
      const projectile = new Projectile(
        barrelEnd.x,
        barrelEnd.y,
        angle,
        fixedPower,
        this.wind,
        tank,
        weaponConfig
      );
      this.projectiles.push(projectile);
    }

    tank.useAmmo();
    this.weaponSelector.update(tank);
    this.buffIndicator.update(tank);

    tank.fire();

    this.camera.triggerScreenShake(8);
    this.effects.triggerScreenFlash('#FFF', 0.2);

    this.state = 'FIRING';
    this.fireButton.disabled = true;
    this.weaponSelector.setEnabled(false);
    soundManager.playShoot();

    this.playerStats[tank.teamIndex].shotsFired++;
  }

  private handleWeaponMenuClick(x: number, y: number): void {
    const itemHeight = 35;
    const menuWidth = 180;
    const menuPadding = 10;
    const menuHeight = WEAPON_ORDER.length * itemHeight + menuPadding * 2;

    // Convert click coordinates to base coordinates (same as rendering)
    const clickX = x / SCALE_X;
    const clickY = y / SCALE_Y;

    // Clamp menu position to base coordinates (same as rendering)
    let menuX = this.weaponMenuPosition.x / SCALE_X;
    let menuY = this.weaponMenuPosition.y / SCALE_Y;
    menuX = Math.min(menuX, BASE_WIDTH - menuWidth - 10);
    menuY = Math.min(menuY, BASE_HEIGHT - menuHeight - 10);

    // Check which item was clicked
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const itemY = menuY + menuPadding + i * itemHeight;
      if (
        clickX >= menuX &&
        clickX <= menuX + menuWidth &&
        clickY >= itemY &&
        clickY <= itemY + itemHeight
      ) {
        const weapon = WEAPON_ORDER[i];
        const tank = this.ants[this.currentPlayerIndex];
        if (tank && tank.hasAmmo(weapon) && tank.selectWeapon(weapon)) {
          this.weaponSelector.update(tank);
          soundManager.playMenuSelect();
        }
        return;
      }
    }
  }

  private renderWeaponMenu(ctx: CanvasRenderingContext2D): void {
    if (!this.weaponMenuOpen) return;

    const tank = this.ants[this.currentPlayerIndex];
    if (!tank) return;

    const itemHeight = 35;
    const menuWidth = 180;
    const menuPadding = 10;
    const menuHeight = WEAPON_ORDER.length * itemHeight + menuPadding * 2;

    // Clamp menu position to screen (in canvas coordinates)
    let menuX = this.weaponMenuPosition.x / SCALE_X;
    let menuY = this.weaponMenuPosition.y / SCALE_Y;
    menuX = Math.min(menuX, BASE_WIDTH - menuWidth - 10);
    menuY = Math.min(menuY, BASE_HEIGHT - menuHeight - 10);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(menuX, menuY, menuWidth, menuHeight);

    // Border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Courier New"';
    ctx.textAlign = 'left';

    // Calculate hover position (in base coordinates)
    const hoverX = this.mouseX / SCALE_X;
    const hoverY = this.mouseY / SCALE_Y;

    // Items
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const weapon = WEAPON_ORDER[i];
      const config = WEAPON_CONFIGS[weapon];
      const itemY = menuY + menuPadding + i * itemHeight;
      const hasAmmo = tank.hasAmmo(weapon);
      const isSelected = tank.selectedWeapon === weapon;

      // Hover detection
      const isHovered =
        hoverX >= menuX &&
        hoverX <= menuX + menuWidth &&
        hoverY >= itemY &&
        hoverY <= itemY + itemHeight;

      // Background highlight
      if (isHovered && hasAmmo) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(menuX + 2, itemY, menuWidth - 4, itemHeight);
      }

      // Selected indicator
      if (isSelected) {
        ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
        ctx.fillRect(menuX + 2, itemY, menuWidth - 4, itemHeight);
      }

      // Text color
      if (!hasAmmo) {
        ctx.fillStyle = '#666'; // Greyed out
      } else if (isHovered) {
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = '#ccc';
      }

      // Weapon name
      ctx.font = 'bold 12px "Courier New"';
      ctx.fillText(`[${config.keyBinding}] ${config.name}`, menuX + 10, itemY + 15);

      // Ammo count
      ctx.font = '10px "Courier New"';
      const ammo = tank.getAmmo(weapon);
      const ammoText = ammo === -1 ? 'INF' : `${ammo}`;
      ctx.fillText(`Ammo: ${ammoText}`, menuX + 10, itemY + 28);

      // Selected checkmark
      if (isSelected) {
        ctx.fillStyle = '#4ECB71';
        ctx.fillText('*', menuX + menuWidth - 20, itemY + 20);
      }
    }
  }

  private startAITurn(): void {
    if (!this.ai) return;

    const aiAnt = this.ants[this.currentPlayerIndex];
    if (!aiAnt.isAlive) return;

    const enemyTeamIndex = aiAnt.teamIndex === 0 ? 1 : 0;
    const enemyAnts = this.getAliveAntsForTeam(enemyTeamIndex);
    if (enemyAnts.length === 0) return;

    const target = this.ai.selectTarget(aiAnt, enemyAnts);
    if (!target) return;

    this.aiTarget = target;
    this.fireButton.disabled = true;

    // Check if AI should consider moving to a better position
    const shouldMove = this.ai.shouldConsiderMoving();
    console.log('[AI] shouldConsiderMoving:', shouldMove);
    if (shouldMove) {
      const movementPlan = this.ai.planMovement(aiAnt, target, this.terrain, this.wind);
      console.log('[AI] movementPlan:', movementPlan);
      if (movementPlan) {
        // AI decided to move - start movement
        console.log('[AI] Starting movement to', movementPlan.targetX, 'from', aiAnt.x);
        this.aiMovementPlan = movementPlan;
        const direction = movementPlan.targetX > aiAnt.x ? 1 : -1;
        aiAnt.startWalking(direction);
        this.state = 'AI_MOVING';
        this.camera.focusOnAnt(aiAnt);
        return;
      }
    }

    // No movement - proceed directly to aiming and shooting
    this.prepareAIShot(aiAnt, target);
  }

  private prepareAIShot(aiAnt: Ant, target: Ant): void {
    if (!this.ai) return;

    this.ai.selectWeapon(aiAnt, target);
    this.weaponSelector.update(aiAnt);

    const shot = this.ai.calculateShot(aiAnt, target, this.wind);
    this.aiShot = { ...shot, target };
    this.aiThinkingTimer = this.ai.getThinkingTime();

    aiAnt.angle = Math.round(shot.angle);

    this.state = 'AI_THINKING';
    this.fireButton.disabled = true;

    this.angleSlider.value = Math.round(shot.angle).toString();
    this.angleValue.textContent = Math.round(shot.angle).toString();
    this.powerSlider.value = Math.round(shot.power).toString();
    this.powerValue.textContent = Math.round(shot.power).toString();
  }

  private updateAIMovement(deltaTime: number): void {
    const aiAnt = this.ants[this.currentPlayerIndex];
    if (!aiAnt || !aiAnt.isAlive || !this.aiMovementPlan) {
      console.log('[AI Movement] Finishing early - no ant or plan');
      this.finishAIMovement();
      return;
    }

    // Update ant movement physics
    aiAnt.updateMovement(deltaTime, this.terrain);

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
      console.log('[AI Movement] Finished - reached:', reachedTarget, 'outOfEnergy:', outOfEnergy, 'finalX:', aiAnt.x);
      this.finishAIMovement();
    }

    // Follow AI with camera during movement
    this.camera.focusOnAnt(aiAnt);
  }

  private finishAIMovement(): void {
    const aiAnt = this.ants[this.currentPlayerIndex];
    if (aiAnt) {
      aiAnt.stopWalking();
    }

    this.aiMovementPlan = null;

    // Now proceed to shooting
    if (aiAnt && aiAnt.isAlive && this.aiTarget) {
      this.prepareAIShot(aiAnt, this.aiTarget);
    } else {
      // Fallback - end turn if something went wrong
      this.state = 'PLAYING';
      this.endTurn();
    }
  }

  private executeAIShot(): void {
    if (!this.aiShot) return;

    const tank = this.ants[this.currentPlayerIndex];
    const angle = this.aiShot.angle;
    const power = (this.aiShot.power / 100) * MAX_POWER;
    const weaponConfig = tank.getSelectedWeaponConfig();

    tank.angle = angle;

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

    tank.useAmmo();
    this.weaponSelector.update(tank);
    this.buffIndicator.update(tank);

    tank.fire();

    const powerRatio = this.aiShot.power / 100;
    this.camera.triggerScreenShake(4 + powerRatio * 8);
    this.effects.triggerScreenFlash('#FFF', 0.15 + powerRatio * 0.1);

    this.aiShot = null;
    this.aiTarget = null;
    this.state = 'FIRING';
    soundManager.playShoot();

    this.playerStats[tank.teamIndex].shotsFired++;
  }

  private endTurn(): void {
    if (this.state !== 'FIRING') return;

    const team0Alive = this.getAliveAntsForTeam(0);
    const team1Alive = this.getAliveAntsForTeam(1);

    if (team0Alive.length === 0 || team1Alive.length === 0) {
      if (team0Alive.length > 0) {
        this.winningTeam = 0;
        this.winner = team0Alive[0];
      } else if (team1Alive.length > 0) {
        this.winningTeam = 1;
        this.winner = team1Alive[0];
      } else {
        this.winningTeam = null;
        this.winner = null;
      }

      this.state = 'GAME_OVER';
      this.fireButton.disabled = true;

      this.weaponSelector.hide();
      this.buffIndicator.hide();

      if (this.winner) {
        this.effects.spawnConfetti();
        this.effects.spawnInitialFireworks();
      }

      const isVictory = this.gameMode === 'single' ? this.winningTeam === 0 : true;
      soundManager.playGameOver(isVictory);
      return;
    }

    // Try to spawn a power-up
    const spawnedPowerUp = this.powerUpManager.trySpawn(this.terrain, this.ants);
    if (spawnedPowerUp) {
      // Power-up spawned - transition to falling state
      this.state = 'POWERUP_FALLING';
      this.fireButton.disabled = true;
      return;
    }

    // No power-up spawned - proceed directly to next turn
    this.proceedToNextTurn();
  }

  private nextPlayer(): void {
    this.currentTeamIndex = (this.currentTeamIndex + 1) % NUM_TEAMS;

    const nextAnt = this.getNextAntForTeam(this.currentTeamIndex);
    if (!nextAnt) return;

    this.currentPlayerIndex = nextAnt.playerIndex;
    this.teamTurnCounts[this.currentTeamIndex]++;

    this.turnTimeRemaining = this.maxTurnTime;

    // Reset movement for new turn
    nextAnt.resetMovementEnergy();
    this.movementKeys = { left: false, right: false };

    this.angleSlider.value = nextAnt.angle.toString();
    this.angleValue.textContent = nextAnt.angle.toString();

    const turnText = this.getTurnBannerText();
    this.hudRenderer.showTurnBanner(turnText);

    this.camera.focusOnAnt(nextAnt);
    this.updateUI();
  }

  private getNextAntForTeam(teamIndex: number): Ant | null {
    const aliveTeamAnts = this.getAliveAntsForTeam(teamIndex);
    if (aliveTeamAnts.length === 0) return null;

    const turnIndex = this.teamTurnCounts[teamIndex] % aliveTeamAnts.length;
    return aliveTeamAnts[turnIndex];
  }

  private getAliveAntsForTeam(teamIndex: number): Ant[] {
    return this.ants.filter(ant => ant.teamIndex === teamIndex && ant.isAlive);
  }

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
}
