import { Ant } from '../Ant.ts';
import { POWERUP_CONFIGS } from '../powerups/PowerUpTypes.ts';

export class BuffIndicator {
  private container: HTMLElement;

  constructor() {
    this.container = this.createContainer();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'buff-indicator';
    container.className = 'buff-indicator';

    // Insert into game container
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  private getIconForBuff(icon: string): string {
    switch (icon) {
      case 'cross':
        return '+';
      case 'sword':
        return '⚔';
      case 'shield':
        return '🛡';
      case 'double_arrow':
        return '»';
      default:
        return '?';
    }
  }

  private getValueLabel(type: string, value: number): string {
    switch (type) {
      case 'damage_boost':
      case 'double_shot':
        return `${Math.ceil(value)} shots`;
      case 'shield':
        return `${Math.ceil(value)} HP`;
      default:
        return `${Math.ceil(value)}`;
    }
  }

  update(ant: Ant | null): void {
    // Clear existing buffs
    this.container.innerHTML = '';

    if (!ant) return;

    // Display all active buffs
    for (const buff of ant.activeBuffs) {
      const config = POWERUP_CONFIGS[buff.type];
      if (!config) continue;

      const buffElement = document.createElement('div');
      buffElement.className = 'buff-item';
      buffElement.style.borderColor = config.color;
      buffElement.style.backgroundColor = `${config.color}33`;

      // Icon based on buff type
      const iconSpan = document.createElement('span');
      iconSpan.className = 'buff-icon';
      iconSpan.textContent = this.getIconForBuff(config.icon);
      iconSpan.style.color = config.color;
      buffElement.appendChild(iconSpan);

      // Value/info with label
      const infoSpan = document.createElement('span');
      infoSpan.className = 'buff-info';
      infoSpan.textContent = this.getValueLabel(buff.type, buff.remainingValue);
      buffElement.appendChild(infoSpan);

      // Tooltip
      buffElement.title = `${config.name}: ${config.description}`;

      this.container.appendChild(buffElement);
    }
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
