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

  update(ant: Ant | null): void {
    // Clear existing buffs
    this.container.innerHTML = '';

    if (!ant) return;

    for (const buff of ant.activeBuffs) {
      const config = POWERUP_CONFIGS[buff.type];

      const buffElement = document.createElement('div');
      buffElement.className = 'buff-item';
      buffElement.style.borderColor = config.color;
      buffElement.style.backgroundColor = `${config.color}33`;

      // Icon
      const iconSpan = document.createElement('span');
      iconSpan.className = 'buff-icon';
      iconSpan.textContent = config.icon;
      iconSpan.style.color = config.color;
      buffElement.appendChild(iconSpan);

      // Value/info
      const infoSpan = document.createElement('span');
      infoSpan.className = 'buff-info';

      if (buff.type === 'shield') {
        infoSpan.textContent = `${Math.ceil(buff.remainingValue)}`;
      } else if (buff.type === 'damage_boost') {
        infoSpan.textContent = `${buff.remainingValue}x`;
      } else if (buff.type === 'double_shot') {
        infoSpan.textContent = `x2`;
      }

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
