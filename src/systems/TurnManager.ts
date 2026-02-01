import { NUM_TEAMS } from '../constants.ts';
import { Ant } from '../Ant.ts';
import { GameMode } from '../types/GameTypes.ts';
import { soundManager } from '../Sound.ts';

export interface TurnCallbacks {
  getAnts: () => Ant[];
  getGameMode: () => GameMode;
  onTurnChanged: (antIndex: number) => void;
  resetMovementKeys: () => void;
  updateAngleSlider: (angle: number) => void;
  showTurnBanner: (text: string) => void;
  focusOnAnt: (ant: Ant) => void;
  updateUI: () => void;
}

export class TurnManager {
  currentTeamIndex: number = 0;
  currentPlayerIndex: number = 0;
  teamTurnCounts: number[] = [0, 0];
  turnTimeRemaining: number = 30;
  maxTurnTime: number = 30;

  private callbacks: TurnCallbacks;

  constructor(callbacks: TurnCallbacks) {
    this.callbacks = callbacks;
  }

  reset(): void {
    this.currentTeamIndex = 0;
    this.currentPlayerIndex = 0;
    this.teamTurnCounts = [0, 0];
    this.turnTimeRemaining = this.maxTurnTime;
  }

  initializeFirstTurn(): void {
    this.currentPlayerIndex = 0;
    this.teamTurnCounts[0] = 1;
    this.turnTimeRemaining = this.maxTurnTime;
  }

  getAliveAntsForTeam(teamIndex: number): Ant[] {
    return this.callbacks.getAnts().filter(ant => ant.teamIndex === teamIndex && ant.isAlive);
  }

  getNextAntForTeam(teamIndex: number): Ant | null {
    const aliveTeamAnts = this.getAliveAntsForTeam(teamIndex);
    if (aliveTeamAnts.length === 0) return null;

    const turnIndex = this.teamTurnCounts[teamIndex] % aliveTeamAnts.length;
    return aliveTeamAnts[turnIndex];
  }

  checkWinCondition(): { team0Alive: Ant[]; team1Alive: Ant[] } {
    return {
      team0Alive: this.getAliveAntsForTeam(0),
      team1Alive: this.getAliveAntsForTeam(1)
    };
  }

  getTurnBannerText(): string {
    const ants = this.callbacks.getAnts();
    const ant = ants[this.currentPlayerIndex];
    const gameMode = this.callbacks.getGameMode();

    if (gameMode === 'single') {
      if (ant.teamIndex === 0) {
        return `YOUR TURN - ANT ${ant.teamAntIndex + 1}`;
      } else {
        return `CPU TURN - ANT ${ant.teamAntIndex + 1}`;
      }
    } else {
      return `TEAM ${ant.teamIndex + 1} - ANT ${ant.teamAntIndex + 1}`;
    }
  }

  nextPlayer(): void {
    this.currentTeamIndex = (this.currentTeamIndex + 1) % NUM_TEAMS;

    const nextAnt = this.getNextAntForTeam(this.currentTeamIndex);
    if (!nextAnt) return;

    this.currentPlayerIndex = nextAnt.playerIndex;
    this.teamTurnCounts[this.currentTeamIndex]++;
    this.turnTimeRemaining = this.maxTurnTime;

    // Reset movement for new turn
    nextAnt.resetMovementEnergy();
    this.callbacks.resetMovementKeys();
    this.callbacks.updateAngleSlider(nextAnt.angle);

    const turnText = this.getTurnBannerText();
    this.callbacks.showTurnBanner(turnText);
    this.callbacks.focusOnAnt(nextAnt);
    this.callbacks.updateUI();

    soundManager.playTurnChange();
  }

  updateTimer(deltaTime: number): boolean {
    this.turnTimeRemaining -= deltaTime;
    if (this.turnTimeRemaining <= 0) {
      this.turnTimeRemaining = 0;
      return true; // Timer expired
    }
    return false;
  }

  getCurrentAnt(): Ant | null {
    const ants = this.callbacks.getAnts();
    return ants[this.currentPlayerIndex] || null;
  }
}
