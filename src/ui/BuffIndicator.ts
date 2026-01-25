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

    // Currently only health power-up exists, which is instant and doesn't create buffs
    // This component is kept for potential future buff power-ups
    for (const buff of ant.activeBuffs) {
      const config = POWERUP_CONFIGS[buff.type];
      if (!config) continue;

      const buffElement = document.createElement('div');
      buffElement.className = 'buff-item';
      buffElement.style.borderColor = config.color;
      buffElement.style.backgroundColor = `${config.color}33`;

      // Icon - use a simple plus sign for health
      const iconSpan = document.createElement('span');
      iconSpan.className = 'buff-icon';
      iconSpan.textContent = '+';
      iconSpan.style.color = config.color;
      buffElement.appendChild(iconSpan);

      // Value/info
      const infoSpan = document.createElement('span');
      infoSpan.className = 'buff-info';
      infoSpan.textContent = `${Math.ceil(buff.remainingValue)}`;
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
