import { BASE_WIDTH, BASE_HEIGHT, SCALE_X, SCALE_Y } from '../constants.ts';
import { WeaponType, WEAPON_CONFIGS } from '../weapons/WeaponTypes.ts';
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

const HEX_R = 30;
const HEX_W = Math.sqrt(3) * HEX_R; // ~52
const ROW_SPACING = 1.5 * HEX_R;     // 45
const SQRT3 = Math.sqrt(3);

// Hex cell positions in diamond pattern (2-3-1), relative to menu center
const HEX_CELLS: { dx: number; dy: number; weapon: WeaponType }[] = [
  // Row 0: 2 hexes
  { dx: -HEX_W / 2, dy: -ROW_SPACING, weapon: 'standard' },
  { dx:  HEX_W / 2, dy: -ROW_SPACING, weapon: 'bazooka' },
  // Row 1: 3 hexes
  { dx: -HEX_W,     dy: 0,            weapon: 'shotgun' },
  { dx:  0,          dy: 0,            weapon: 'sniper' },
  { dx:  HEX_W,      dy: 0,            weapon: 'napalm' },
  // Row 2: 1 hex
  { dx:  0,          dy: ROW_SPACING,  weapon: 'grenade' },
];

// Accent colors per weapon (from trail colors, brightened)
const WEAPON_COLORS: Record<WeaponType, string> = {
  standard: '#FF9632',
  bazooka:  '#8888AA',
  shotgun:  '#FFDC64',
  sniper:   '#FF4444',
  napalm:   '#FF6400',
  grenade:  '#64B464',
};

export class WeaponMenu {
  private callbacks: WeaponMenuCallbacks;

  constructor(callbacks: WeaponMenuCallbacks) {
    this.callbacks = callbacks;
  }

  private getMenuCenter(menuPosition: { x: number; y: number }): { x: number; y: number } {
    let cx = menuPosition.x / SCALE_X;
    let cy = menuPosition.y / SCALE_Y;
    const marginX = HEX_W + HEX_R;
    const marginY = ROW_SPACING + HEX_R + 5;
    cx = Math.max(marginX, Math.min(BASE_WIDTH - marginX, cx));
    cy = Math.max(marginY, Math.min(BASE_HEIGHT - marginY, cy));
    return { x: cx, y: cy };
  }

  private hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 3;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private isPointInHex(px: number, py: number, cx: number, cy: number, r: number): boolean {
    const dx = Math.abs(px - cx);
    const dy = Math.abs(py - cy);
    if (dx > SQRT3 / 2 * r || dy > r) return false;
    return SQRT3 * dy + dx <= SQRT3 * r;
  }

  handleClick(
    clickX: number,
    clickY: number,
    menuPosition: { x: number; y: number },
    tank: WeaponMenuTankInfo
  ): boolean {
    const bx = clickX / SCALE_X;
    const by = clickY / SCALE_Y;
    const center = this.getMenuCenter(menuPosition);

    for (const cell of HEX_CELLS) {
      const hx = center.x + cell.dx;
      const hy = center.y + cell.dy;
      if (this.isPointInHex(bx, by, hx, hy, HEX_R)) {
        if (tank.hasAmmo(cell.weapon) && tank.selectWeapon(cell.weapon)) {
          this.callbacks.onWeaponSelected(cell.weapon);
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
    const center = this.getMenuCenter(menuPosition);
    const hoverX = hoverPosition.x / SCALE_X;
    const hoverY = hoverPosition.y / SCALE_Y;

    ctx.save();

    for (let i = 0; i < HEX_CELLS.length; i++) {
      const cell = HEX_CELLS[i];
      const config = WEAPON_CONFIGS[cell.weapon];
      const cx = center.x + cell.dx;
      const cy = center.y + cell.dy;
      const hasAmmo = tank.hasAmmo(cell.weapon);
      const isSelected = tank.selectedWeapon === cell.weapon;
      const isHovered = this.isPointInHex(hoverX, hoverY, cx, cy, HEX_R) && hasAmmo;
      const accent = WEAPON_COLORS[cell.weapon];

      // Hex fill
      this.hexPath(ctx, cx, cy, HEX_R - 1);
      if (isSelected) {
        ctx.fillStyle = 'rgba(60, 160, 60, 0.55)';
      } else if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      } else {
        ctx.fillStyle = 'rgba(10, 10, 20, 0.82)';
      }
      ctx.fill();

      // Hex border with glow for selected
      this.hexPath(ctx, cx, cy, HEX_R - 1);
      if (isSelected) {
        ctx.shadowColor = '#4ECB71';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#4ECB71';
        ctx.lineWidth = 2;
      } else if (!hasAmmo) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
      } else if (isHovered) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
      } else {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Weapon icon
      ctx.save();
      ctx.translate(cx, cy - 2);
      if (!hasAmmo) ctx.globalAlpha = 0.25;
      this.drawWeaponIcon(ctx, cell.weapon, accent, isSelected || isHovered);
      ctx.restore();

      // Key number (top)
      ctx.globalAlpha = hasAmmo ? 0.7 : 0.25;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.keyBinding, cx, cy - HEX_R + 10);

      // Ammo (bottom)
      const ammo = tank.getAmmo(cell.weapon);
      const ammoText = ammo === -1 ? '\u221E' : `${ammo}`;
      ctx.fillStyle = hasAmmo ? '#aaa' : '#444';
      ctx.font = '8px "Courier New"';
      ctx.fillText(ammoText, cx, cy + HEX_R - 8);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // --- Pixel art weapon icons (matching AntRenderer) ---

  /** Draw a single "pixel" block at logical grid position */
  private px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string): void {
    ctx.fillStyle = c;
    ctx.fillRect(x * 2, y * 2, 2, 2);
  }

  private drawWeaponIcon(ctx: CanvasRenderingContext2D, weapon: WeaponType, accent: string, glow: boolean): void {
    ctx.save();
    if (glow) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 4;
    }
    switch (weapon) {
      case 'standard': this.iconStandard(ctx); break;
      case 'bazooka':  this.iconBazooka(ctx); break;
      case 'shotgun':  this.iconShotgun(ctx); break;
      case 'sniper':   this.iconSniper(ctx, accent); break;
      case 'napalm':   this.iconNapalm(ctx); break;
      case 'grenade':  this.iconGrenade(ctx); break;
    }
    ctx.restore();
  }

  private iconStandard(ctx: CanvasRenderingContext2D): void {
    // Standard: 3-pixel tall barrel, 12 long (matches AntRenderer)
    const col = '#4A5D23', light = '#5C7A29', dark = '#2D3A16';
    for (let i = 0; i < 12; i++) {
      const x = i - 6;
      this.px(ctx, x, -1, light);
      this.px(ctx, x,  0, col);
      this.px(ctx, x,  1, dark);
    }
    // Muzzle opening
    this.px(ctx, 6, -1, '#1a1a1a');
    this.px(ctx, 6,  0, dark);
    this.px(ctx, 6,  1, '#1a1a1a');
  }

  private iconBazooka(ctx: CanvasRenderingContext2D): void {
    // Bazooka: 4-pixel tall tube, 12 long + scope + exhaust
    const col = '#4A3B28', light = '#5C4D3A', dark = '#2D2318';
    for (let i = 0; i < 12; i++) {
      const x = i - 6;
      this.px(ctx, x, -1, light);
      this.px(ctx, x,  0, col);
      this.px(ctx, x,  1, col);
      this.px(ctx, x,  2, dark);
    }
    // Wide muzzle (4 dark pixels)
    for (let dy = -1; dy <= 2; dy++) this.px(ctx, 6, dy, '#1a1a1a');
    // Scope at mid-barrel
    this.px(ctx, 0, -2, '#333');
    this.px(ctx, 0, -3, '#444');
    // Back exhaust
    this.px(ctx, -7, 0, '#333');
    this.px(ctx, -7, 1, '#333');
  }

  private iconShotgun(ctx: CanvasRenderingContext2D): void {
    // Shotgun: double barrel, 4-pixel tall, 8 long
    const col = '#5A5A5A', light = '#7A7A7A', dark = '#3A3A3A';
    for (let i = 0; i < 8; i++) {
      const x = i - 4;
      this.px(ctx, x, -1, light);
      this.px(ctx, x,  0, col);
      this.px(ctx, x,  1, light);
      this.px(ctx, x,  2, dark);
    }
    // Two muzzle openings
    this.px(ctx, 4, -1, '#1a1a1a');
    this.px(ctx, 4,  1, '#1a1a1a');
    // Stock
    this.px(ctx, -5, 0, dark);
    this.px(ctx, -6, 0, dark);
  }

  private iconSniper(ctx: CanvasRenderingContext2D, accent: string): void {
    // Sniper: thin 2-pixel barrel, 13 long + scope + stock
    const col = '#2A2A3A', light = '#4A4A5A', dark = '#1A1A2A';
    for (let i = 0; i < 13; i++) {
      const x = i - 6;
      this.px(ctx, x, -1, light);
      this.px(ctx, x,  0, col);
    }
    // Muzzle (thin)
    this.px(ctx, 7, 0, '#1a1a1a');
    // Scope at 1/3 barrel (2x2 pixels)
    this.px(ctx, -2, -2, '#222');
    this.px(ctx, -2, -3, '#333');
    this.px(ctx, -1, -2, '#222');
    this.px(ctx, -1, -3, '#444');
    // Crosshair dot
    this.px(ctx, -2, -2, accent);
    // Stock
    this.px(ctx, -7, 0, dark);
  }

  private iconNapalm(ctx: CanvasRenderingContext2D): void {
    // Napalm: wide 5-pixel tube, 9 long + flared muzzle + bomb inside
    const col = '#3A3A3A', light = '#5A5A5A', dark = '#1A1A1A';
    for (let i = 0; i < 9; i++) {
      const x = i - 4;
      this.px(ctx, x, -2, light);
      this.px(ctx, x, -1, col);
      this.px(ctx, x,  0, col);
      this.px(ctx, x,  1, col);
      this.px(ctx, x,  2, dark);
    }
    // Flared muzzle
    const mx = 5;
    this.px(ctx, mx, -3, light);
    for (let dy = -2; dy <= 2; dy++) this.px(ctx, mx, dy, '#1a1a1a');
    this.px(ctx, mx, 3, dark);
    // Bomb inside at ~60%
    this.px(ctx, 1, -1, '#1a1a1a');
    this.px(ctx, 1,  0, '#2a2a2a');
    this.px(ctx, 1,  1, '#1a1a1a');
    // Animated fuse spark
    const sparkOn = Math.sin(Date.now() / 50) > 0;
    this.px(ctx, 0, -3, sparkOn ? '#FF6600' : '#FFAA00');
    // Stock
    this.px(ctx, -5, 0, dark);
    this.px(ctx, -6, 0, dark);
  }

  private iconGrenade(ctx: CanvasRenderingContext2D): void {
    // Grenade: arm + hand holding grenade body
    const col = '#3D5C3D', light = '#5A7A5A', dark = '#2A3A2A';
    const skin = '#D4A574', skinDk = '#B8956A';
    // Arm (4 pixels long, 2 tall)
    for (let i = 0; i < 4; i++) {
      this.px(ctx, i - 5, 0, skin);
      this.px(ctx, i - 5, 1, skinDk);
    }
    // Hand
    this.px(ctx, -1, 0, skin);
    this.px(ctx, -1, 1, skinDk);
    // Grenade body (oval)
    this.px(ctx,  0, -2, light);
    this.px(ctx, -1, -1, light);
    this.px(ctx,  0, -1, col);
    this.px(ctx,  1, -1, dark);
    this.px(ctx, -1,  0, col);
    this.px(ctx,  0,  0, col);
    this.px(ctx,  1,  0, dark);
    this.px(ctx, -1,  1, col);
    this.px(ctx,  0,  1, col);
    this.px(ctx,  1,  1, dark);
    this.px(ctx,  0,  2, dark);
    // Fuse mechanism
    this.px(ctx, 0, -3, '#5A5A5A');
    this.px(ctx, 0, -4, '#4A4A4A');
    // Safety lever
    this.px(ctx, 1, -3, '#6A6A6A');
    this.px(ctx, 2, -4, '#5A5A5A');
    // Pin ring (animated)
    const pinOn = Math.sin(Date.now() / 67) > 0.5;
    this.px(ctx, -1, -4, pinOn ? '#DAA520' : '#B8860B');
  }
}
