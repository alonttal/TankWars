import { BASE_WIDTH, BASE_HEIGHT, MAP_WIDTH, MAP_HEIGHT, BACKGROUND_PARALLAX, MAX_POWER, WIND_STRENGTH_MAX, updateCanvasSize, SCALE_X, SCALE_Y, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS } from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Ant } from './Ant.ts';
import { Projectile } from './Projectile.ts';
import { Explosion } from './Explosion.ts';
import { AIDifficulty } from './AI.ts';
import { soundManager } from './Sound.ts';
import { WeaponType, WEAPON_ORDER } from './weapons/WeaponTypes.ts';
import { BurnArea } from './weapons/BurnArea.ts';
import { PowerUpManager } from './powerups/PowerUpManager.ts';
import { POWERUP_CONFIGS } from './powerups/PowerUpTypes.ts';
import { WeaponSelector } from './ui/WeaponSelector.ts';
import { BuffIndicator } from './ui/BuffIndicator.ts';
import { WeaponMenu } from './ui/WeaponMenu.ts';

// Import extracted modules
import { GameState, GameMode, MenuItem, PlayerStats } from './types/GameTypes.ts';
import { CameraSystem } from './systems/CameraSystem.ts';
import { EffectsSystem } from './systems/EffectsSystem.ts';
import { WeatherSystem } from './systems/WeatherSystem.ts';
import { InputManager } from './systems/InputManager.ts';
import { FireSystem } from './systems/FireSystem.ts';
import { TurnManager } from './systems/TurnManager.ts';
import { GameStateManager } from './systems/GameStateManager.ts';
import { AIManager } from './systems/AIManager.ts';
import { MenuRenderer } from './rendering/MenuRenderer.ts';
import { HUDRenderer } from './rendering/HUDRenderer.ts';
import { EffectsRenderer } from './rendering/EffectsRenderer.ts';
import { WeatherRenderer } from './rendering/WeatherRenderer.ts';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private ants: Ant[];
  private explosions: Explosion[];
  private currentPlayerIndex: number;
  private currentTeamIndex: number;
  private winningTeam: number | null;
  private wind: number;
  private state: GameState;
  private winner: Ant | null;
  private gameMode: GameMode;
  private aiManager: AIManager;

  // Menu
  private menuItems: MenuItem[];
  private selectedMenuItem: number;

  // Pause menu
  private pauseMenuItems: MenuItem[];
  private selectedPauseItem: number;

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


  // Turn timer
  private turnTimeRemaining: number;
  private maxTurnTime: number;

  // Statistics
  private playerStats: PlayerStats[];

  private lastTime: number;

  // Hit delay (camera stays on hit location before returning to shooter)
  private hitDelayTimer: number;
  private lastHitPosition: { x: number; y: number } | null;

  // Lightning strike cinematic state
  private lightningCinematicTimer: number;
  private lightningFocusPosition: { x: number; y: number } | null;

  // Weapon and Power-up systems
  private projectiles: Projectile[];
  private burnAreas: BurnArea[];
  private powerUpManager: PowerUpManager;
  private weaponSelector: WeaponSelector;
  private buffIndicator: BuffIndicator;
  private weaponMenu: WeaponMenu;

  // Extracted systems
  private camera: CameraSystem;
  private effects: EffectsSystem;
  private weather: WeatherSystem;
  private input: InputManager;
  private fireSystem: FireSystem;
  private turnManager: TurnManager;
  private gameStateManager: GameStateManager;
  private menuRenderer: MenuRenderer;
  private hudRenderer: HUDRenderer;
  private effectsRenderer: EffectsRenderer;
  private weatherRenderer: WeatherRenderer;

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
    this.winningTeam = null;
    this.wind = 0;
    this.state = 'MENU';
    this.winner = null;
    this.gameMode = 'single';
    this.isChargingPower = false;
    this.introPanPhase = 0;
    this.introPanTimer = 0;
    this.maxTurnTime = 30;
    this.turnTimeRemaining = this.maxTurnTime;
    this.playerStats = [];
    this.lastTime = 0;
    this.hitDelayTimer = 0;
    this.lastHitPosition = null;

    // Lightning strike cinematic state
    this.lightningCinematicTimer = 0;
    this.lightningFocusPosition = null;

    // Initialize extracted systems
    this.camera = new CameraSystem();
    this.effects = new EffectsSystem();
    this.weather = new WeatherSystem();
    this.input = this.createInputManager();
    this.menuRenderer = new MenuRenderer();
    this.hudRenderer = new HUDRenderer();
    this.effectsRenderer = new EffectsRenderer();
    this.weatherRenderer = new WeatherRenderer();

    // Initialize weapon and power-up systems
    this.projectiles = [];
    this.burnAreas = [];
    this.powerUpManager = new PowerUpManager();
    this.weaponSelector = new WeaponSelector();
    this.buffIndicator = new BuffIndicator();
    this.weaponMenu = new WeaponMenu({
      onWeaponSelected: (_weapon) => {
        const tank = this.ants[this.currentPlayerIndex];
        if (tank) this.weaponSelector.update(tank);
      }
    });

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

    // Initialize fire system
    this.fireSystem = new FireSystem(this.camera, this.effects, {
      updateWeaponSelector: (ant) => this.weaponSelector.update(ant),
      updateBuffIndicator: (ant) => this.buffIndicator.update(ant),
      setWeaponSelectorEnabled: (enabled) => this.weaponSelector.setEnabled(enabled),
      setFireButtonDisabled: (disabled) => { this.fireButton.disabled = disabled; },
      incrementShotsFired: (teamIndex) => { this.playerStats[teamIndex].shotsFired++; },
    });

    // Initialize turn manager
    this.turnManager = new TurnManager({
      getAnts: () => this.ants,
      getGameMode: () => this.gameMode,
      onTurnChanged: (antIndex) => { this.currentPlayerIndex = antIndex; },
      resetMovementKeys: () => this.input.resetMovementKeys(),
      updateAngleSlider: (angle) => {
        this.angleSlider.value = angle.toString();
        this.angleValue.textContent = angle.toString();
      },
      showTurnBanner: (text) => this.hudRenderer.showTurnBanner(text),
      focusOnAnt: (ant) => this.camera.focusOnAnt(ant),
      updateUI: () => this.updateUI(),
    });

    // Initialize game state manager
    this.gameStateManager = new GameStateManager({
      getState: () => this.state,
      setState: (state) => { this.state = state; },
      setSelectedMenuItem: (index) => { this.selectedMenuItem = index; },
      setSelectedPauseItem: (index) => { this.selectedPauseItem = index; },
      setSelectedSettingIndex: (index) => { this.selectedSettingIndex = index; },
      onQuitToMenu: () => {
        soundManager.stopMusic();
        this.weaponSelector.hide();
        this.buffIndicator.hide();
        this.menuRenderer.reset();
      },
    });

    // Initialize AI manager
    this.aiManager = new AIManager({
      getCurrentAnt: () => this.ants[this.currentPlayerIndex] || null,
      getAliveAntsForTeam: (teamIndex) => this.getAliveAntsForTeam(teamIndex),
      getTerrain: () => this.terrain,
      getWind: () => this.wind,
      getAllAnts: () => this.ants,
      setState: (state) => { this.state = state; },
      getState: () => this.state,
      setFireButtonDisabled: (disabled) => { this.fireButton.disabled = disabled; },
      updateAngleSlider: (angle) => {
        this.angleSlider.value = angle.toString();
        this.angleValue.textContent = angle.toString();
      },
      updatePowerSlider: (power) => {
        this.powerSlider.value = power.toString();
        this.powerValue.textContent = power.toString();
      },
      updateWeaponSelector: (ant) => this.weaponSelector.update(ant),
      focusOnAnt: (ant) => this.camera.focusOnAnt(ant),
      setProjectiles: (projectiles) => { this.projectiles = projectiles; },
      endTurn: () => this.endTurn(),
    }, this.fireSystem);

    // Menu setup
    this.selectedMenuItem = 0;
    this.menuItems = [
      { label: 'SINGLE PLAYER', action: () => this.startGame('single', 'medium') },
      { label: 'MULTIPLAYER', action: () => this.startGame('multi') },
    ];

    // Pause menu setup
    this.selectedPauseItem = 0;
    this.pauseMenuItems = [
      { label: 'RESUME', action: () => this.gameStateManager.resumeGame() },
      { label: 'SETTINGS', action: () => this.gameStateManager.openSettings() },
      { label: 'QUIT TO MENU', action: () => this.gameStateManager.quitToMenu() },
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

  private createInputManager(): InputManager {
    return new InputManager({
      // State queries
      getState: () => this.state,
      isAITurn: () => this.isAITurn(),
      getCurrentAnt: () => this.ants[this.currentPlayerIndex] || null,

      // Menu actions
      getMenuItems: () => this.menuItems,
      getSelectedMenuItem: () => this.selectedMenuItem,
      setSelectedMenuItem: (index: number) => { this.selectedMenuItem = index; },
      getPauseMenuItems: () => this.pauseMenuItems,
      getSelectedPauseItem: () => this.selectedPauseItem,
      setSelectedPauseItem: (index: number) => { this.selectedPauseItem = index; },
      getSettingsOptions: () => this.settingsOptions,
      getSelectedSettingIndex: () => this.selectedSettingIndex,
      setSelectedSettingIndex: (index: number) => { this.selectedSettingIndex = index; },

      // State transitions
      pauseGame: () => this.gameStateManager.pauseGame(),
      resumeGame: () => this.gameStateManager.resumeGame(),
      closeWeaponMenu: () => { this.input.closeWeaponMenu(); },
      openSettings: () => this.gameStateManager.openSettings(),
      goToMenu: () => { this.state = 'MENU'; },
      resetMenu: () => {
        this.selectedMenuItem = 0;
        this.menuRenderer.reset();
      },

      // Movement
      startWalking: (direction: number) => {
        const tank = this.ants[this.currentPlayerIndex];
        if (tank) tank.startWalking(direction);
      },
      stopWalking: () => {
        const tank = this.ants[this.currentPlayerIndex];
        if (tank) tank.stopWalking();
      },
      jump: () => {
        const tank = this.ants[this.currentPlayerIndex];
        if (tank) tank.jump();
      },

      // Aiming and firing
      updateAimFromMouse: (mouseX: number, mouseY: number) => this.updateAimFromMouse(mouseX, mouseY),
      startCharging: () => this.startCharging(),
      stopChargingAndFire: () => {
        this.isChargingPower = false;
        soundManager.stopCharging();
        this.fire();
      },
      fireInstant: () => this.fireInstant(),
      openWeaponMenu: (_x: number, _y: number) => {
        // Input manager tracks the state
      },
      handleWeaponMenuClick: (x: number, y: number) => this.handleWeaponMenuClick(x, y),
      selectWeaponByKey: (key: string) => this.selectWeaponByKey(key),

      // Volume
      adjustVolume: (delta: number) => this.adjustVolume(delta),

      // Debug
      debugKillCurrentAnt: () => {
        const ant = this.ants[this.currentPlayerIndex];
        if (ant && ant.isAlive) {
          ant.takeDamage(999);
          this.endTurn();
        }
      },
      debugSpawnPowerUp: () => {
        const x = 100 + Math.random() * (MAP_WIDTH - 200);
        const types: Array<'health' | 'damage_boost' | 'shield' | 'double_shot'> = ['health', 'damage_boost', 'shield', 'double_shot'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        this.powerUpManager.spawnPowerUp(x, this.terrain, randomType);
        console.log(`[Debug] Spawned power-up: ${randomType} at x=${Math.round(x)}`);
        this.state = 'POWERUP_FALLING';
        this.fireButton.disabled = true;
      },
      debugCycleWeather: () => {
        const weatherTypes: Array<'clear' | 'rain' | 'fog' | 'snow' | 'sandstorm'> = ['clear', 'rain', 'fog', 'snow', 'sandstorm'];
        const currentIndex = weatherTypes.indexOf(this.weather.currentWeather);
        const nextIndex = (currentIndex + 1) % weatherTypes.length;
        const nextWeather = weatherTypes[nextIndex];
        this.weather.forceWeather(nextWeather);
        console.log(`[Debug] Weather changed to: ${nextWeather}`);
      },

      // Music
      toggleMusic: () => {
        const enabled = soundManager.toggleMusic();
        this.musicButton.textContent = enabled ? '🎵 ON' : '🎵 OFF';
        this.musicButton.classList.toggle('off', !enabled);
      },

      // Terrain reference
      getTerrain: () => this.terrain,
    });
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

    // Delegate keyboard and mouse input to InputManager
    this.input.setupEventListeners(this.canvas);
  }

  private startCharging(): void {
    const tank = this.ants[this.currentPlayerIndex];
    const weaponConfig = tank.getSelectedWeaponConfig();

    // Shotgun fires instantly without charging
    if (!weaponConfig.requiresCharging) {
      this.fireInstant();
      return;
    }

    if (!this.isChargingPower) {
      this.isChargingPower = true;
      this.input.setCharging(true);
      this.powerSlider.value = '0';
      this.powerSlider.dispatchEvent(new Event('input'));
      soundManager.startCharging();
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

  private isAITurn(): boolean {
    return this.gameMode === 'single' && this.currentTeamIndex === 1 && this.aiManager.isActive();
  }

  private resizeCanvas(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width;
    this.canvas.height = height;

    updateCanvasSize(width, height);
  }

  private updateAimFromMouse(mouseX: number, mouseY: number): void {
    const tank = this.ants[this.currentPlayerIndex];
    if (!tank || !tank.isAlive) return;

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);

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

    // Update weather system
    this.weather.update(effectiveDelta, this.wind);

    // Update terrain weather overlays
    const activeWeather = this.weather.getTransitionProgress() >= 0.5
      ? this.weather.getTargetConfig().type
      : this.weather.getCurrentConfig().type;
    this.terrain.updateWeatherOverlays(effectiveDelta, activeWeather);

    // Update damaging lightning animations (only during LIGHTNING_STRIKE state)
    if (this.state === 'LIGHTNING_STRIKE') {
      this.weather.updateDamagingLightning(effectiveDelta);
    }

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
      const timerExpired = this.turnManager.updateTimer(deltaTime);
      this.turnTimeRemaining = this.turnManager.turnTimeRemaining;
      if (timerExpired) {
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
      this.aiManager.updateAIThinking(deltaTime, effectiveDelta);
    }

    // AI movement
    if (this.state === 'AI_MOVING') {
      this.aiManager.updateAIMovement(effectiveDelta);
    }

    // Firing state
    if (this.state === 'FIRING') {
      this.updateFiring(effectiveDelta);
    }

    // Power-up falling state
    if (this.state === 'POWERUP_FALLING') {
      this.updatePowerUpFalling(effectiveDelta);
    }

    // Lightning strike state
    if (this.state === 'LIGHTNING_STRIKE') {
      this.updateLightningStrike(effectiveDelta);
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
    const collected = this.powerUpManager.update(effectiveDelta, this.ants, this.terrain);
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

  private updateLightningStrike(deltaTime: number): void {
    this.lightningCinematicTimer -= deltaTime;

    // Keep camera focused on strike location
    if (this.lightningFocusPosition) {
      this.camera.focusOnProjectile(this.lightningFocusPosition.x, this.lightningFocusPosition.y);
    }

    // Check for lightning damage application
    const damageResult = this.weather.applyLightningDamage(this.ants, this.terrain);
    if (damageResult) {
      // Trigger effects for the strike
      this.camera.triggerScreenShake(18);
      this.effects.triggerScreenFlash('#FFFFFF', 0.6);

      // Show damage floating texts
      for (const hit of damageResult.hits) {
        const isCritical = hit.damage >= 30;
        this.effects.addFloatingText({
          x: hit.ant.x,
          y: hit.ant.y - 40,
          text: isCritical ? `ZAP! -${hit.damage}` : `-${hit.damage}`,
          color: isCritical ? '#FFD700' : '#FFFF00',
          life: isCritical ? 2.0 : 1.5,
          maxLife: isCritical ? 2.0 : 1.5,
          vy: isCritical ? -50 : -30,
          scale: isCritical ? 1.5 : 1.0,
          isCritical,
        });
      }
    }

    // Check if cinematic is complete
    if (this.lightningCinematicTimer <= 0 && !this.weather.hasActiveLightningEvent()) {
      this.endLightningCinematic();
    }
  }

  private endLightningCinematic(): void {
    this.lightningFocusPosition = null;

    // Check for deaths caused by lightning
    const team0Alive = this.getAliveAntsForTeam(0);
    const team1Alive = this.getAliveAntsForTeam(1);

    if (team0Alive.length === 0 || team1Alive.length === 0) {
      // Game over due to lightning kill
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

    // Lightning happened between turns - now proceed to next player
    this.finishTurnTransition();
  }

  private finishTurnTransition(): void {
    this.nextPlayer();

    const currentAnt = this.ants[this.currentPlayerIndex];
    this.weaponSelector.update(currentAnt);
    this.buffIndicator.update(currentAnt);
    this.weaponSelector.setEnabled(true);

    if (this.isAITurn()) {
      this.aiManager.startAITurn();
    } else {
      this.state = 'PLAYING';
      this.fireButton.disabled = false;
    }
  }

  private proceedToNextTurn(): void {
    // Base wind change
    this.wind += (Math.random() - 0.5) * 10;
    this.wind = Math.max(-WIND_STRENGTH_MAX, Math.min(WIND_STRENGTH_MAX, this.wind));

    // Weather modifies wind and may trigger effects
    const { modifiedWind, shouldFlash } = this.weather.onTurnStart(this.wind);
    this.wind = Math.max(-WIND_STRENGTH_MAX, Math.min(WIND_STRENGTH_MAX, modifiedWind));

    if (shouldFlash) {
      this.effects.triggerScreenFlash('#FFFFFF', 0.3);
    }

    this.updateWindDisplay();

    // Check for lightning strike between turns
    if (this.weather.trySpawnLightningStrike(this.terrain)) {
      // Lightning is spawning - enter lightning state and set up cinematic
      const focusRequest = this.weather.consumePendingCinematicFocus();
      if (focusRequest) {
        this.state = 'LIGHTNING_STRIKE';
        this.lightningCinematicTimer = focusRequest.duration;
        this.lightningFocusPosition = { x: focusRequest.x, y: focusRequest.y };
        this.fireButton.disabled = true;
        this.weaponSelector.setEnabled(false);
        this.camera.focusOnProjectile(focusRequest.x, focusRequest.y);
      }
      return;
    }

    // No lightning - proceed directly to next player
    this.finishTurnTransition();
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
    // Pass weather state to terrain for sun/cloud adjustments
    // Use target weather type when past 50% of transition
    const transitionProgress = this.weather.getTransitionProgress();
    const targetConfig = this.weather.getTargetConfig();
    const currentConfig = this.weather.getCurrentConfig();
    const weatherState = {
      type: transitionProgress >= 0.5 ? targetConfig.type : currentConfig.type,
      intensity: transitionProgress >= 0.5
        ? (transitionProgress - 0.5) * 2  // 0 to 1 as target appears
        : 1 - transitionProgress * 2,     // 1 to 0 as current fades
    };
    this.terrain.renderBackground(this.ctx, weatherState);
    // Render weather particles in background layer
    this.weatherRenderer.renderWeatherParticles(this.ctx, this.weather, this.wind);
    this.ctx.restore();

    // Gameplay layer
    this.ctx.save();
    this.camera.applyTransform(this.ctx, 1.0);

    this.terrain.render(this.ctx);
    this.terrain.renderOverlays(this.ctx);

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

    // Weather foreground particles (in front of terrain and ants for depth)
    this.weatherRenderer.renderWeatherForeground(this.ctx, this.weather, this.wind);

    // Screen flash
    this.effectsRenderer.renderScreenFlash(
      this.ctx,
      this.effects.screenFlashIntensity,
      this.effects.screenFlashColor
    );

    // Weather atmosphere overlay and visibility mask
    this.weatherRenderer.renderAtmosphereOverlay(this.ctx, this.weather);
    const currentAnt = this.ants[this.currentPlayerIndex];
    if (currentAnt) {
      this.weatherRenderer.renderVisibilityMask(this.ctx, this.weather, currentAnt.x, currentAnt.y);
    }

    this.ctx.restore();

    // UI layer (no camera movement)
    if ((this.state === 'PLAYING' || this.state === 'AI_THINKING') && !this.isAITurn()) {
      this.hudRenderer.renderTurnTimer(this.ctx, this.turnTimeRemaining, this.maxTurnTime);
    }

    // Weather indicator (always show during gameplay, but not on game over screen)
    if (this.state !== 'GAME_OVER') {
      this.weatherRenderer.renderWeatherIndicator(this.ctx, this.weather, BASE_WIDTH - 30, 30);
    }

    // Weapon menu (UI layer, no camera transform)
    if (this.input.weaponMenuOpen && this.state === 'PLAYING') {
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
    this.turnManager.reset();
    this.currentPlayerIndex = this.turnManager.currentPlayerIndex;
    this.currentTeamIndex = this.turnManager.currentTeamIndex;
    this.turnTimeRemaining = this.turnManager.turnTimeRemaining;
    this.winningTeam = null;
    this.winner = null;
    this.isChargingPower = false;

    // Clear effects
    this.effects.clear();

    // Reset hit delay state
    this.hitDelayTimer = 0;
    this.lastHitPosition = null;

    // Clear power-ups
    this.powerUpManager.clear();

    // Setup AI
    this.aiManager.reset();
    if (mode === 'single' && aiDifficulty) {
      this.aiManager.initialize(aiDifficulty);
    }

    // Generate terrain
    this.terrain.generate();

    // Initialize weather for terrain theme
    this.weather.setTerrainTheme(this.terrain.getThemeName());
    this.weather.clear();

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

    this.turnManager.initializeFirstTurn();
    this.currentPlayerIndex = this.turnManager.currentPlayerIndex;

    this.wind = (Math.random() - 0.5) * WIND_STRENGTH_MAX * 2;
    this.updateWindDisplay();

    const firstAnt = this.ants[0];
    firstAnt.resetMovementEnergy();
    this.input.resetMovementKeys();
    this.angleSlider.value = firstAnt.angle.toString();
    this.angleValue.textContent = firstAnt.angle.toString();

    this.updateUI();
    this.fireButton.disabled = true;

    this.weaponSelector.hide();
    this.buffIndicator.hide();
    this.input.closeWeaponMenu();

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
    this.input.closeWeaponMenu();
    soundManager.stopCharging();

    const tank = this.ants[this.currentPlayerIndex];
    if (!tank.isAlive) {
      this.nextPlayer();
      return;
    }

    const angle = parseInt(this.angleSlider.value);
    const power = (parseInt(this.powerSlider.value) / 100) * MAX_POWER;

    const result = this.fireSystem.fire({
      ant: tank,
      angle,
      power,
      wind: this.wind,
      includeDoubleShot: true
    });

    this.projectiles = result.projectiles;
    this.state = 'FIRING';
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

    const angle = parseInt(this.angleSlider.value);

    const result = this.fireSystem.fireInstant(tank, angle, this.wind);

    this.projectiles = result.projectiles;
    this.state = 'FIRING';
  }

  private handleWeaponMenuClick(x: number, y: number): void {
    const tank = this.ants[this.currentPlayerIndex];
    if (!tank) return;

    this.weaponMenu.handleClick(x, y, this.input.weaponMenuPosition, tank);
  }

  private renderWeaponMenu(ctx: CanvasRenderingContext2D): void {
    if (!this.input.weaponMenuOpen) return;

    const tank = this.ants[this.currentPlayerIndex];
    if (!tank) return;

    this.weaponMenu.render(
      ctx,
      this.input.weaponMenuPosition,
      { x: this.input.mouseX, y: this.input.mouseY },
      tank
    );
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
    this.turnManager.nextPlayer();
    this.currentTeamIndex = this.turnManager.currentTeamIndex;
    this.currentPlayerIndex = this.turnManager.currentPlayerIndex;
  }

  private getAliveAntsForTeam(teamIndex: number): Ant[] {
    return this.turnManager.getAliveAntsForTeam(teamIndex);
  }

  private getTurnBannerText(): string {
    return this.turnManager.getTurnBannerText();
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
