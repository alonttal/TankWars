import { GameState } from '../types/GameTypes.ts';

export interface GameStateCallbacks {
  getState: () => GameState;
  setState: (state: GameState) => void;
  setSelectedMenuItem: (index: number) => void;
  setSelectedPauseItem: (index: number) => void;
  setSelectedSettingIndex: (index: number) => void;
  onQuitToMenu: () => void; // Called when quitting - handles soundManager, weaponSelector, etc.
}

export class GameStateManager {
  private callbacks: GameStateCallbacks;
  private stateBeforePause: GameState = 'MENU';

  constructor(callbacks: GameStateCallbacks) {
    this.callbacks = callbacks;
  }

  pauseGame(): void {
    this.stateBeforePause = this.callbacks.getState();
    this.callbacks.setState('PAUSED');
    this.callbacks.setSelectedPauseItem(0);
  }

  resumeGame(): void {
    this.callbacks.setState(this.stateBeforePause);
  }

  quitToMenu(): void {
    this.callbacks.setState('MENU');
    this.callbacks.setSelectedMenuItem(0);
    this.callbacks.onQuitToMenu();
  }

  openSettings(): void {
    this.callbacks.setState('SETTINGS');
    this.callbacks.setSelectedSettingIndex(0);
  }

  // State validation helpers
  isPlayingState(state: GameState): boolean {
    return state === 'PLAYING' || state === 'AI_THINKING';
  }

  isMenuState(state: GameState): boolean {
    return state === 'MENU' || state === 'PAUSED' || state === 'SETTINGS';
  }

  canPause(state: GameState): boolean {
    return state === 'PLAYING' || state === 'AI_THINKING' || state === 'FIRING';
  }

  getStateBeforePause(): GameState {
    return this.stateBeforePause;
  }

  setStateBeforePause(state: GameState): void {
    this.stateBeforePause = state;
  }
}
