import { BASE_WIDTH, BASE_HEIGHT, SCALE_X, SCALE_Y } from '../constants.ts';
import { WeaponType, WEAPON_CONFIGS, WEAPON_ORDER } from '../weapons/WeaponTypes.ts';
import { soundManager } from '../Sound.ts';

export interface WeaponMenuTankInfo {
  hasAmmo: (weapon: WeaponType) => boolean;
  getAmmo: (weapon: WeaponType) => number;
  selectWeapon: (weapon: WeaponType) => boolean;
  selectedWeapon: WeaponType;
}

export interface WeaponMenuCallbacks {
  onWeaponSelected: (weapon: WeaponType) => void;
}

export class WeaponMenu {
  private static readonly ITEM_HEIGHT = 35;
  private static readonly MENU_WIDTH = 180;
  private static readonly MENU_PADDING = 10;

  private callbacks: WeaponMenuCallbacks;

  constructor(callbacks: WeaponMenuCallbacks) {
    this.callbacks = callbacks;
  }

  private getMenuHeight(): number {
    return WEAPON_ORDER.length * WeaponMenu.ITEM_HEIGHT + WeaponMenu.MENU_PADDING * 2;
  }

  private getClampedMenuPosition(menuPosition: { x: number; y: number }): { x: number; y: number } {
    const menuHeight = this.getMenuHeight();
    let menuX = menuPosition.x / SCALE_X;
    let menuY = menuPosition.y / SCALE_Y;
    menuX = Math.min(menuX, BASE_WIDTH - WeaponMenu.MENU_WIDTH - 10);
    menuY = Math.min(menuY, BASE_HEIGHT - menuHeight - 10);
    return { x: menuX, y: menuY };
  }

  handleClick(
    clickX: number,
    clickY: number,
    menuPosition: { x: number; y: number },
    tank: WeaponMenuTankInfo
  ): boolean {
    const baseClickX = clickX / SCALE_X;
    const baseClickY = clickY / SCALE_Y;

    const menuPos = this.getClampedMenuPosition(menuPosition);

    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const itemY = menuPos.y + WeaponMenu.MENU_PADDING + i * WeaponMenu.ITEM_HEIGHT;
      if (
        baseClickX >= menuPos.x &&
        baseClickX <= menuPos.x + WeaponMenu.MENU_WIDTH &&
        baseClickY >= itemY &&
        baseClickY <= itemY + WeaponMenu.ITEM_HEIGHT
      ) {
        const weapon = WEAPON_ORDER[i];
        if (tank.hasAmmo(weapon) && tank.selectWeapon(weapon)) {
          this.callbacks.onWeaponSelected(weapon);
          soundManager.playMenuSelect();
          return true;
        }
        return false;
      }
    }
    return false;
  }

  render(
    ctx: CanvasRenderingContext2D,
    menuPosition: { x: number; y: number },
    hoverPosition: { x: number; y: number },
    tank: WeaponMenuTankInfo
  ): void {
    const menuPos = this.getClampedMenuPosition(menuPosition);
    const menuHeight = this.getMenuHeight();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(menuPos.x, menuPos.y, WeaponMenu.MENU_WIDTH, menuHeight);

    // Border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(menuPos.x, menuPos.y, WeaponMenu.MENU_WIDTH, menuHeight);

    // Calculate hover position in base coordinates
    const hoverX = hoverPosition.x / SCALE_X;
    const hoverY = hoverPosition.y / SCALE_Y;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Courier New"';
    ctx.textAlign = 'left';

    // Items
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const weapon = WEAPON_ORDER[i];
      const config = WEAPON_CONFIGS[weapon];
      const itemY = menuPos.y + WeaponMenu.MENU_PADDING + i * WeaponMenu.ITEM_HEIGHT;
      const hasAmmo = tank.hasAmmo(weapon);
      const isSelected = tank.selectedWeapon === weapon;

      // Hover detection
      const isHovered =
        hoverX >= menuPos.x &&
        hoverX <= menuPos.x + WeaponMenu.MENU_WIDTH &&
        hoverY >= itemY &&
        hoverY <= itemY + WeaponMenu.ITEM_HEIGHT;

      // Background highlight
      if (isHovered && hasAmmo) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(menuPos.x + 2, itemY, WeaponMenu.MENU_WIDTH - 4, WeaponMenu.ITEM_HEIGHT);
      }

      // Selected indicator
      if (isSelected) {
        ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
        ctx.fillRect(menuPos.x + 2, itemY, WeaponMenu.MENU_WIDTH - 4, WeaponMenu.ITEM_HEIGHT);
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
      ctx.fillText(`[${config.keyBinding}] ${config.name}`, menuPos.x + 10, itemY + 15);

      // Ammo count
      ctx.font = '10px "Courier New"';
      const ammo = tank.getAmmo(weapon);
      const ammoText = ammo === -1 ? 'INF' : `${ammo}`;
      ctx.fillText(`Ammo: ${ammoText}`, menuPos.x + 10, itemY + 28);

      // Selected checkmark
      if (isSelected) {
        ctx.fillStyle = '#4ECB71';
        ctx.fillText('*', menuPos.x + WeaponMenu.MENU_WIDTH - 20, itemY + 20);
      }
    }
  }
}
