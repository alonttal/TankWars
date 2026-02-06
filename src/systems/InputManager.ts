import { GameState, MenuItem } from '../types/GameTypes.ts';
import { soundManager } from '../Sound.ts';

export interface InputCallbacks {
  // State queries
  getState: () => GameState;
  isAITurn: () => boolean;
  getCurrentAnt: () => { isAlive: boolean; canMove: () => boolean; x: number; y: number } | null;

  // Menu actions
  getMenuItems: () => MenuItem[];
  getSelectedMenuItem: () => number;
  setSelectedMenuItem: (index: number) => void;
  getPauseMenuItems: () => MenuItem[];
  getSelectedPauseItem: () => number;
  setSelectedPauseItem: (index: number) => void;
  getSettingsOptions: () => string[];
  getSelectedSettingIndex: () => number;
  setSelectedSettingIndex: (index: number) => void;

  // Difficulty submenu
  getMenuState: () => 'main' | 'difficulty';
  getDifficultyItemCount: () => number;
  getSelectedDifficultyIndex: () => number;
  setSelectedDifficultyIndex: (index: number) => void;
  selectDifficulty: () => void;
  backToMainMenu: () => void;

  // State transitions
  pauseGame: () => void;
  resumeGame: () => void;
  closeWeaponMenu: () => void;
  openSettings: () => void;
  goToMenu: () => void;
  resetMenu: () => void;

  // Movement
  startWalking: (direction: number) => void;
  stopWalking: () => void;
  jump: () => void;

  // Aiming and firing
  updateAimFromMouse: (mouseX: number, mouseY: number) => void;
  startCharging: () => void;
  stopChargingAndFire: () => void;
  fireInstant: () => void;
  openWeaponMenu: (x: number, y: number) => void;
  handleWeaponMenuClick: (x: number, y: number) => void;
  selectWeaponByKey: (key: string) => void;

  // Volume
  adjustVolume: (delta: number) => void;

  // Debug
  debugKillCurrentAnt: () => void;
  debugSpawnPowerUp: () => void;
  debugCycleWeather: () => void;

  // Music
  toggleMusic: () => void;

  // Terrain reference for power-up spawning
  getTerrain: () => { generate: () => void } | null;
}

export class InputManager {
  private callbacks: InputCallbacks;

  // Mouse state
  mouseX: number = 0;
  mouseY: number = 0;
  isMouseDown: boolean = false;

  // Movement keys state
  movementKeys: { left: boolean; right: boolean } = { left: false, right: false };

  // Power charging state
  isChargingPower: boolean = false;

  // Weapon menu state
  weaponMenuOpen: boolean = false;
  weaponMenuPosition: { x: number; y: number } = { x: 0, y: 0 };
  private weaponMenuClosedAt: number = 0;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
  }

  setupEventListeners(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e, canvas));
    canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e, canvas));
    canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    canvas.addEventListener('click', (e) => this.handleCanvasClick(e, canvas));

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  handleKeyDown(e: KeyboardEvent): void {
    const state = this.callbacks.getState();

    if (e.key === 'Escape') {
      // Close weapon menu if open
      if (this.weaponMenuOpen) {
        this.weaponMenuOpen = false;
        this.callbacks.closeWeaponMenu();
        return;
      }
      // Handle difficulty submenu back
      if (state === 'MENU' && this.callbacks.getMenuState() === 'difficulty') {
        this.callbacks.backToMainMenu();
        return;
      }
      if (state === 'SETTINGS') {
        this.callbacks.resumeGame();
      } else if (state === 'PAUSED') {
        this.callbacks.resumeGame();
      } else if (state === 'PLAYING' || state === 'AI_THINKING' || state === 'AI_MOVING' || state === 'POWERUP_FALLING' || state === 'LIGHTNING_STRIKE') {
        this.callbacks.pauseGame();
      }
      return;
    }

    if (state === 'MENU') {
      this.handleMenuInput(e);
      return;
    }

    if (state === 'PAUSED') {
      this.handlePauseMenuInput(e);
      return;
    }

    if (state === 'SETTINGS') {
      this.handleSettingsInput(e);
      return;
    }

    if (state === 'GAME_OVER') {
      if (e.key === 'Enter' || e.key === ' ') {
        this.callbacks.goToMenu();
        this.callbacks.resetMenu();
      }
      return;
    }

    if (state !== 'PLAYING') return;
    if (this.callbacks.isAITurn()) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.movementKeys.left = true;
        {
          const ant = this.callbacks.getCurrentAnt();
          if (ant && ant.canMove()) {
            this.callbacks.startWalking(-1);
          }
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.movementKeys.right = true;
        {
          const ant = this.callbacks.getCurrentAnt();
          if (ant && ant.canMove()) {
            this.callbacks.startWalking(1);
          }
        }
        break;
      case ' ':
        e.preventDefault();
        this.callbacks.jump();
        break;
      case 'm':
      case 'M':
        this.callbacks.toggleMusic();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
        this.callbacks.selectWeaponByKey(e.key);
        break;
      case 'k':
      case 'K':
        // Debug: Kill current ant to test death animations
        this.callbacks.debugKillCurrentAnt();
        break;
      case 'p':
      case 'P':
        // Debug: Force spawn a power-up for testing
        this.callbacks.debugSpawnPowerUp();
        break;
      case 'w':
      case 'W':
        // Debug: Cycle through weather types for testing
        this.callbacks.debugCycleWeather();
        break;
    }
  }

  handleKeyUp(e: KeyboardEvent): void {
    const state = this.callbacks.getState();
    if (state !== 'PLAYING' || this.callbacks.isAITurn()) return;

    switch (e.key) {
      case 'ArrowLeft':
        this.movementKeys.left = false;
        if (!this.movementKeys.right) {
          this.callbacks.stopWalking();
        } else {
          // Still holding right, walk right
          this.callbacks.startWalking(1);
        }
        break;
      case 'ArrowRight':
        this.movementKeys.right = false;
        if (!this.movementKeys.left) {
          this.callbacks.stopWalking();
        } else {
          // Still holding left, walk left
          this.callbacks.startWalking(-1);
        }
        break;
    }
  }

  handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;

    const state = this.callbacks.getState();
    if (state === 'PLAYING' && !this.callbacks.isAITurn()) {
      this.callbacks.updateAimFromMouse(this.mouseX, this.mouseY);
    }
  }

  handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const state = this.callbacks.getState();

    // Right-click: Open weapon menu
    if (e.button === 2) {
      if (state === 'PLAYING' && !this.callbacks.isAITurn()) {
        this.weaponMenuOpen = true;
        this.weaponMenuPosition = { x: clickX, y: clickY };
        this.callbacks.openWeaponMenu(clickX, clickY);
      }
      return;
    }

    // Left-click
    if (e.button !== 0) return;

    // If weapon menu is open, handle click on menu
    if (this.weaponMenuOpen) {
      this.callbacks.handleWeaponMenuClick(clickX, clickY);
      this.weaponMenuOpen = false;
      this.weaponMenuClosedAt = Date.now();
      return;
    }

    // Guard: don't fire immediately after closing weapon menu (prevents accidental instant-fire)
    if (Date.now() - this.weaponMenuClosedAt < 200) {
      return;
    }

    this.isMouseDown = true;

    if (state === 'PLAYING' && !this.callbacks.isAITurn()) {
      this.callbacks.startCharging();
    }
  }

  handleMouseUp(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isMouseDown = false;

    const state = this.callbacks.getState();
    if (this.isChargingPower && state === 'PLAYING' && !this.callbacks.isAITurn()) {
      this.isChargingPower = false;
      this.callbacks.stopChargingAndFire();
    }
  }

  handleMouseLeave(): void {
    const state = this.callbacks.getState();
    if (this.isMouseDown && this.isChargingPower && state === 'PLAYING' && !this.callbacks.isAITurn()) {
      this.isChargingPower = false;
      this.isMouseDown = false;
      this.callbacks.stopChargingAndFire();
    }
  }

  handleCanvasClick(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const state = this.callbacks.getState();

    if (state === 'MENU') {
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;

      if (this.callbacks.getMenuState() === 'difficulty') {
        // Difficulty submenu click handling
        const menuStartY = 180;
        const itemHeight = 55;
        const itemCount = this.callbacks.getDifficultyItemCount();
        for (let i = 0; i < itemCount; i++) {
          const itemY = menuStartY + i * itemHeight;
          if (y >= itemY - 16 && y <= itemY + 22) {
            this.callbacks.setSelectedDifficultyIndex(i);
            this.callbacks.selectDifficulty();
            return;
          }
        }
        return;
      }

      // Main menu click handling
      const menuStartY = 200;
      const itemHeight = 50;

      const menuItems = this.callbacks.getMenuItems();
      for (let i = 0; i < menuItems.length; i++) {
        const itemY = menuStartY + i * itemHeight;
        if (y >= itemY - 14 && y <= itemY + 22) {
          menuItems[i].action();
          return;
        }
      }
    } else if (state === 'GAME_OVER') {
      this.callbacks.goToMenu();
      this.callbacks.resetMenu();
    }
  }

  // Generic menu navigation handler
  private handleGenericMenuInput(
    e: KeyboardEvent,
    itemCount: number,
    getSelected: () => number,
    setSelected: (index: number) => void,
    onSelect?: () => void,
    onLeftRight?: (delta: number) => void
  ): void {
    const selected = getSelected();

    switch (e.key) {
      case 'ArrowUp':
        setSelected((selected - 1 + itemCount) % itemCount);
        soundManager.playMenuSelect();
        break;
      case 'ArrowDown':
        setSelected((selected + 1) % itemCount);
        soundManager.playMenuSelect();
        break;
      case 'ArrowLeft':
        if (onLeftRight) onLeftRight(-10);
        break;
      case 'ArrowRight':
        if (onLeftRight) onLeftRight(10);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onSelect) {
          soundManager.playMenuSelect();
          onSelect();
        }
        break;
    }
  }

  handleMenuInput(e: KeyboardEvent): void {
    if (this.callbacks.getMenuState() === 'difficulty') {
      this.handleDifficultyMenuInput(e);
      return;
    }
    const menuItems = this.callbacks.getMenuItems();
    this.handleGenericMenuInput(
      e,
      menuItems.length,
      () => this.callbacks.getSelectedMenuItem(),
      (index) => this.callbacks.setSelectedMenuItem(index),
      () => menuItems[this.callbacks.getSelectedMenuItem()].action()
    );
  }

  private handleDifficultyMenuInput(e: KeyboardEvent): void {
    const itemCount = this.callbacks.getDifficultyItemCount();
    this.handleGenericMenuInput(
      e,
      itemCount,
      () => this.callbacks.getSelectedDifficultyIndex(),
      (index) => this.callbacks.setSelectedDifficultyIndex(index),
      () => this.callbacks.selectDifficulty()
    );
  }

  handlePauseMenuInput(e: KeyboardEvent): void {
    const pauseMenuItems = this.callbacks.getPauseMenuItems();
    this.handleGenericMenuInput(
      e,
      pauseMenuItems.length,
      () => this.callbacks.getSelectedPauseItem(),
      (index) => this.callbacks.setSelectedPauseItem(index),
      () => pauseMenuItems[this.callbacks.getSelectedPauseItem()].action()
    );
  }

  handleSettingsInput(e: KeyboardEvent): void {
    const settingsOptions = this.callbacks.getSettingsOptions();
    this.handleGenericMenuInput(
      e,
      settingsOptions.length,
      () => this.callbacks.getSelectedSettingIndex(),
      (index) => this.callbacks.setSelectedSettingIndex(index),
      () => {
        if (settingsOptions[this.callbacks.getSelectedSettingIndex()] === 'Back') {
          this.callbacks.resumeGame();
        }
      },
      (delta) => this.callbacks.adjustVolume(delta)
    );
  }

  // Called by Game when charging starts
  setCharging(charging: boolean): void {
    this.isChargingPower = charging;
  }

  // Reset movement keys (called when turn changes)
  resetMovementKeys(): void {
    this.movementKeys = { left: false, right: false };
  }

  // Close weapon menu
  closeWeaponMenu(): void {
    this.weaponMenuOpen = false;
  }
}
