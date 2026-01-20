import { WeaponType, WEAPON_ORDER, WEAPON_CONFIGS } from '../weapons/WeaponTypes.ts';
import { Tank } from '../Tank.ts';

export class WeaponSelector {
  private container: HTMLElement;
  private buttons: Map<WeaponType, HTMLButtonElement>;
  private onWeaponSelect: ((weapon: WeaponType) => void) | null = null;

  constructor() {
    this.buttons = new Map();
    this.container = this.createContainer();
    this.createButtons();
    this.setupKeyboardShortcuts();
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'weapon-selector';
    container.className = 'weapon-selector';

    // Insert before the controls div
    const controls = document.getElementById('controls');
    if (controls && controls.parentElement) {
      controls.parentElement.insertBefore(container, controls);
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  private createButtons(): void {
    for (const weaponType of WEAPON_ORDER) {
      const config = WEAPON_CONFIGS[weaponType];

      const button = document.createElement('button');
      button.className = 'weapon-btn';
      button.dataset.weapon = weaponType;
      button.title = `${config.name} - ${config.description} [${config.keyBinding}]`;

      // Icon/name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'weapon-name';
      nameSpan.textContent = config.name.split(' ')[0]; // First word only
      button.appendChild(nameSpan);

      // Ammo indicator
      const ammoSpan = document.createElement('span');
      ammoSpan.className = 'weapon-ammo';
      ammoSpan.textContent = config.ammo === -1 ? '∞' : String(config.ammo);
      button.appendChild(ammoSpan);

      // Key binding indicator
      const keySpan = document.createElement('span');
      keySpan.className = 'weapon-key';
      keySpan.textContent = config.keyBinding;
      button.appendChild(keySpan);

      button.addEventListener('click', () => {
        if (this.onWeaponSelect) {
          this.onWeaponSelect(weaponType);
        }
      });

      this.buttons.set(weaponType, button);
      this.container.appendChild(button);
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Check if we're in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Map keys 1-6 to weapons
      const keyIndex = parseInt(e.key) - 1;
      if (keyIndex >= 0 && keyIndex < WEAPON_ORDER.length) {
        const weapon = WEAPON_ORDER[keyIndex];
        if (this.onWeaponSelect) {
          this.onWeaponSelect(weapon);
        }
      }
    });
  }

  setOnWeaponSelect(callback: (weapon: WeaponType) => void): void {
    this.onWeaponSelect = callback;
  }

  update(tank: Tank | null): void {
    for (const [weaponType, button] of this.buttons) {
      if (!tank) {
        button.disabled = true;
        button.classList.remove('selected');
        continue;
      }

      const ammo = tank.getAmmo(weaponType);
      const hasAmmo = tank.hasAmmo(weaponType);
      const isSelected = tank.selectedWeapon === weaponType;

      // Update ammo display
      const ammoSpan = button.querySelector('.weapon-ammo');
      if (ammoSpan) {
        ammoSpan.textContent = ammo === -1 ? '∞' : String(ammo);
      }

      // Update button state
      button.disabled = !hasAmmo;
      button.classList.toggle('selected', isSelected);
      button.classList.toggle('no-ammo', !hasAmmo);
    }
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  setEnabled(enabled: boolean): void {
    for (const button of this.buttons.values()) {
      if (enabled) {
        button.classList.remove('ui-disabled');
      } else {
        button.classList.add('ui-disabled');
      }
    }
  }
}
