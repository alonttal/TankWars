import { BASE_WIDTH, BASE_HEIGHT, MAX_POWER, WIND_STRENGTH_MAX, PLAYER_COLORS, updateCanvasSize, SCALE_X, SCALE_Y, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.ts';
import { Terrain } from './Terrain.ts';
import { Tank } from './Tank.ts';
import { Projectile } from './Projectile.ts';
import { Explosion } from './Explosion.ts';
import { TankAI, AIDifficulty } from './AI.ts';
import { soundManager } from './Sound.ts';

type GameState = 'MENU' | 'PLAYING' | 'AI_THINKING' | 'FIRING' | 'GAME_OVER';
type GameMode = 'single' | 'multi';

interface MenuItem {
  label: string;
  action: () => void;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private tanks: Tank[];
  private projectile: Projectile | null;
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

  private lastTime: number;

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
    this.projectile = null;
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
    this.lastTime = 0;

    // Menu setup
    this.selectedMenuItem = 0;
    this.menuItems = [
      { label: '1 PLAYER (vs CPU)', action: () => this.startGame('single', 'medium') },
      { label: '2 PLAYERS', action: () => this.startGame('multi') },
      { label: '1P EASY', action: () => this.startGame('single', 'easy') },
      { label: '1P HARD', action: () => this.startGame('single', 'hard') },
    ];

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
      if (this.state === 'MENU') {
        this.handleMenuInput(e);
        return;
      }

      if (this.state === 'GAME_OVER') {
        if (e.key === 'Enter' || e.key === ' ') {
          this.state = 'MENU';
          this.selectedMenuItem = 0;
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
    // Update screen shake
    this.updateScreenShake(deltaTime);

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
    }

    if (this.state === 'AI_THINKING') {
      this.aiThinkingTimer -= deltaTime * 1000;

      if (this.aiThinkingTimer <= 0 && this.aiShot) {
        // AI fires
        this.executeAIShot();
      }
    }

    if (this.state === 'FIRING') {
      // Update projectile
      if (this.projectile) {
        const result = this.projectile.update(deltaTime, this.terrain, this.tanks, this.wind);

        if (!result.active) {
          if (result.hit) {
            // Create explosion
            const explosion = new Explosion(result.hitX, result.hitY);
            explosion.applyDamage(this.tanks, this.terrain, this.projectile.owner);
            this.explosions.push(explosion);
            soundManager.playExplosion();
            this.triggerScreenShake(12); // Shake intensity
          }
          this.projectile = null;
        }
      }

      // Update explosions
      for (const explosion of this.explosions) {
        explosion.update(deltaTime);
      }
      this.explosions = this.explosions.filter(e => e.active);

      // Check if firing phase is complete
      if (!this.projectile && this.explosions.length === 0) {
        this.endTurn();
      }
    }
  }

  private render(): void {
    // Clear canvas (use actual canvas size)
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Apply scaling for game rendering
    this.ctx.save();
    this.ctx.scale(SCALE_X, SCALE_Y);

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
      this.tanks[i].render(this.ctx, isCurrentAndPlaying);
    }

    // Render projectile
    if (this.projectile) {
      this.projectile.render(this.ctx);
    }

    // Render explosions
    for (const explosion of this.explosions) {
      explosion.render(this.ctx);
    }

    // Render AI thinking indicator
    if (this.state === 'AI_THINKING') {
      this.renderAIThinking();
    }

    // Render game over
    if (this.state === 'GAME_OVER') {
      this.renderGameOver();
    }

    this.ctx.restore();
  }

  private renderMenu(): void {
    // Background
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Title
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.font = 'bold 48px "Courier New"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('TANK WARS', BASE_WIDTH / 2, 120);

    this.ctx.fillStyle = '#6bcfff';
    this.ctx.font = '24px "Courier New"';
    this.ctx.fillText('Artillery Game', BASE_WIDTH / 2, 160);

    // Menu items
    const menuStartY = 260;
    const itemHeight = 40;

    for (let i = 0; i < this.menuItems.length; i++) {
      const y = menuStartY + i * itemHeight;
      const isSelected = i === this.selectedMenuItem;

      if (isSelected) {
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillText('>', BASE_WIDTH / 2 - 120, y);
      }

      this.ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      this.ctx.font = `${isSelected ? 'bold ' : ''}18px "Courier New"`;
      this.ctx.fillText(this.menuItems[i].label, BASE_WIDTH / 2, y);
    }

    // Instructions
    this.ctx.fillStyle = '#666';
    this.ctx.font = '12px "Courier New"';
    this.ctx.fillText('Arrow Keys to Select, Enter to Start', BASE_WIDTH / 2, 440);
    this.ctx.fillText('In-game: Left/Right = Aim, Hold Space = Charge Power, Release = Fire', BASE_WIDTH / 2, 460);

    // Draw decorative tanks
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.fillRect(150, 200, 40, 20);
    this.ctx.fillStyle = '#4ECB71';
    this.ctx.fillRect(610, 200, 40, 20);
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
    // Overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    this.ctx.textAlign = 'center';

    if (this.winner) {
      const winnerLabel = this.gameMode === 'single'
        ? (this.winner.playerIndex === 0 ? 'YOU WIN!' : 'CPU WINS!')
        : `PLAYER ${this.winner.playerIndex + 1} WINS!`;

      this.ctx.fillStyle = this.winner.color;
      this.ctx.font = 'bold 36px "Courier New"';
      this.ctx.fillText(winnerLabel, BASE_WIDTH / 2, BASE_HEIGHT / 2 - 20);
    } else {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 36px "Courier New"';
      this.ctx.fillText('DRAW!', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 20);
    }

    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '18px "Courier New"';
    this.ctx.fillText('Press Enter to Continue', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 40);
  }

  private startGame(mode: GameMode, aiDifficulty?: AIDifficulty): void {
    this.gameMode = mode;
    this.tanks = [];
    this.projectile = null;
    this.explosions = [];
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.isChargingPower = false;
    this.powerDirection = 1;

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
    for (let i = 0; i < numPlayers; i++) {
      const pos = this.terrain.getSpawnPosition(i, numPlayers);
      const facingRight = i < numPlayers / 2;
      const tank = new Tank(pos.x, pos.y, PLAYER_COLORS[i], i, facingRight);
      this.tanks.push(tank);
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

    const barrelEnd = tank.getBarrelEnd();
    this.projectile = new Projectile(
      barrelEnd.x,
      barrelEnd.y,
      angle,
      power,
      this.wind,
      tank
    );

    this.state = 'FIRING';
    this.fireButton.disabled = true;
    soundManager.playShoot();
  }

  private startAITurn(): void {
    if (!this.ai) return;

    const aiTank = this.tanks[1];
    const playerTank = this.tanks[0];

    if (!aiTank.isAlive || !playerTank.isAlive) return;

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

    tank.angle = angle;

    const barrelEnd = tank.getBarrelEnd();
    this.projectile = new Projectile(
      barrelEnd.x,
      barrelEnd.y,
      angle,
      power,
      this.wind,
      tank
    );

    this.aiShot = null;
    this.state = 'FIRING';
    soundManager.playShoot();
  }

  private endTurn(): void {
    // Check for game over
    const aliveTanks = this.tanks.filter(t => t.isAlive);

    if (aliveTanks.length <= 1) {
      this.winner = aliveTanks.length === 1 ? aliveTanks[0] : null;
      this.state = 'GAME_OVER';
      this.fireButton.disabled = true;

      // Play victory/defeat sound
      const isVictory = this.gameMode === 'single'
        ? this.winner?.playerIndex === 0
        : true; // In multiplayer, someone always wins
      soundManager.playGameOver(isVictory);
      return;
    }

    // Change wind slightly
    this.wind += (Math.random() - 0.5) * 10;
    this.wind = Math.max(-WIND_STRENGTH_MAX, Math.min(WIND_STRENGTH_MAX, this.wind));
    this.updateWindDisplay();

    // Next player
    this.nextPlayer();

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

    // Update angle slider to current tank's angle
    const tank = this.tanks[this.currentPlayerIndex];
    this.angleSlider.value = tank.angle.toString();
    this.angleValue.textContent = tank.angle.toString();

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

  private triggerScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
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
}
