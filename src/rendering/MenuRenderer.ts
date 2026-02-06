import { BASE_WIDTH, BASE_HEIGHT, TEAM_COLORS } from '../constants.ts';
import { MenuItem, PlayerStats, GameMode } from '../types/GameTypes.ts';
import { soundManager } from '../Sound.ts';
import { Ant } from '../Ant.ts';
import { AIDifficulty } from '../AI.ts';

// Starfield star
interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number; // drift speed multiplier (layer)
  twinkleOffset: number;
  twinkles: boolean;
}

// Battle scene projectile
interface SceneProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

// Battle scene explosion
interface SceneExplosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export class MenuRenderer {
  private menuTitlePulse: number = 0;
  private menuItemsSlideIn: number[] = [];
  private gameOverSlideIn: number = 0;

  // Starfield
  private stars: Star[] = [];

  // Battle scene
  private sceneTerrain: number[] = [];
  private sceneProjectile: SceneProjectile = { x: 0, y: 0, vx: 0, vy: 0, active: false };
  private sceneExplosions: SceneExplosion[] = [];
  private sceneFireTimer: number = 0;
  private sceneShooterIsRed: boolean = true; // alternates

  // Difficulty submenu
  private difficultySlideIn: number[] = [];

  constructor() {
    this.initStarfield();
    this.initBattleScene();
  }

  private initStarfield(): void {
    this.stars = [];
    const layerConfigs = [
      { count: 40, speedMin: 0.2, speedMax: 0.4, sizeMin: 0.5, sizeMax: 1.0 },  // far
      { count: 25, speedMin: 0.5, speedMax: 0.8, sizeMin: 1.0, sizeMax: 2.0 },  // mid
      { count: 10, speedMin: 1.0, speedMax: 1.5, sizeMin: 2.0, sizeMax: 3.0 },  // near
    ];
    for (const layer of layerConfigs) {
      for (let i = 0; i < layer.count; i++) {
        this.stars.push({
          x: Math.random() * BASE_WIDTH,
          y: Math.random() * BASE_HEIGHT,
          size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
          brightness: 0.3 + Math.random() * 0.7,
          speed: layer.speedMin + Math.random() * (layer.speedMax - layer.speedMin),
          twinkleOffset: Math.random() * Math.PI * 2,
          twinkles: Math.random() < 0.3,
        });
      }
    }
  }

  private initBattleScene(): void {
    // Generate rolling hills terrain
    const numPoints = 80;
    this.sceneTerrain = [];
    const baseY = BASE_HEIGHT * 0.72;
    const hillAmplitude = 30;
    const freq1 = 0.05;
    const freq2 = 0.12;
    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const x = t * BASE_WIDTH;
      const h = Math.sin(x * freq1 + phase1) * hillAmplitude
              + Math.sin(x * freq2 + phase2) * hillAmplitude * 0.5;
      this.sceneTerrain.push(baseY + h);
    }
    this.sceneFireTimer = 2.0; // first fire after 2s
  }

  private getTerrainY(x: number): number {
    const numPoints = this.sceneTerrain.length;
    const t = (x / BASE_WIDTH) * (numPoints - 1);
    const i = Math.floor(t);
    const frac = t - i;
    const y0 = this.sceneTerrain[Math.max(0, Math.min(numPoints - 1, i))];
    const y1 = this.sceneTerrain[Math.max(0, Math.min(numPoints - 1, i + 1))];
    return y0 + (y1 - y0) * frac;
  }

  update(deltaTime: number, state: string, menuItemsLength: number): void {
    this.menuTitlePulse += deltaTime * 2;

    // Update menu item slide-in animations
    if (state === 'MENU') {
      if (this.menuItemsSlideIn.length !== menuItemsLength) {
        this.menuItemsSlideIn = Array(menuItemsLength).fill(0);
      }
      for (let i = 0; i < this.menuItemsSlideIn.length; i++) {
        const target = 1;
        const speed = 4;
        const delay = i * 0.1;
        if (this.menuTitlePulse > delay) {
          this.menuItemsSlideIn[i] += (target - this.menuItemsSlideIn[i]) * Math.min(1, deltaTime * speed);
        }
      }

      // Update starfield
      for (const star of this.stars) {
        star.y += star.speed * deltaTime * 15;
        if (star.y > BASE_HEIGHT) {
          star.y -= BASE_HEIGHT;
          star.x = Math.random() * BASE_WIDTH;
        }
      }

      // Update battle scene
      this.updateBattleScene(deltaTime);
    }

    // Update difficulty submenu slide-in
    if (this.difficultySlideIn.length > 0) {
      for (let i = 0; i < this.difficultySlideIn.length; i++) {
        const delay = i * 0.08;
        if (this.menuTitlePulse > delay) {
          this.difficultySlideIn[i] += (1 - this.difficultySlideIn[i]) * Math.min(1, deltaTime * 6);
        }
      }
    }

    // Update game over slide-in animation
    if (state === 'GAME_OVER') {
      this.gameOverSlideIn += (1 - this.gameOverSlideIn) * Math.min(1, deltaTime * 3);
    } else {
      this.gameOverSlideIn = 0;
    }
  }

  private updateBattleScene(deltaTime: number): void {
    const redX = 120;
    const greenX = 680;

    // Fire timer
    this.sceneFireTimer -= deltaTime;
    if (this.sceneFireTimer <= 0 && !this.sceneProjectile.active) {
      // Fire a projectile
      const fromX = this.sceneShooterIsRed ? redX : greenX;
      const toX = this.sceneShooterIsRed ? greenX : redX;
      const fromY = this.getTerrainY(fromX) - 8;
      const dx = toX - fromX;
      const speed = 180 + Math.random() * 40;
      const angle = -0.6 - Math.random() * 0.3; // upward arc
      this.sceneProjectile = {
        x: fromX,
        y: fromY,
        vx: Math.sign(dx) * speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        active: true,
      };
      this.sceneShooterIsRed = !this.sceneShooterIsRed;
      this.sceneFireTimer = 2.5 + Math.random() * 2.0;
    }

    // Update projectile
    if (this.sceneProjectile.active) {
      const gravity = 200;
      this.sceneProjectile.x += this.sceneProjectile.vx * deltaTime;
      this.sceneProjectile.y += this.sceneProjectile.vy * deltaTime;
      this.sceneProjectile.vy += gravity * deltaTime;

      // Check terrain collision
      const terrainY = this.getTerrainY(this.sceneProjectile.x);
      if (this.sceneProjectile.y >= terrainY || this.sceneProjectile.x < 0 || this.sceneProjectile.x > BASE_WIDTH) {
        // Spawn explosion
        this.sceneExplosions.push({
          x: this.sceneProjectile.x,
          y: Math.min(this.sceneProjectile.y, terrainY),
          radius: 0,
          maxRadius: 15 + Math.random() * 10,
          life: 0.6,
          maxLife: 0.6,
        });
        this.sceneProjectile.active = false;
      }
    }

    // Update explosions
    for (const exp of this.sceneExplosions) {
      exp.life -= deltaTime;
      const progress = 1 - exp.life / exp.maxLife;
      exp.radius = exp.maxRadius * (progress < 0.3 ? progress / 0.3 : 1);
    }
    this.sceneExplosions = this.sceneExplosions.filter(e => e.life > 0);
  }

  reset(): void {
    this.menuTitlePulse = 0;
    this.menuItemsSlideIn = [];
    this.gameOverSlideIn = 0;
    this.difficultySlideIn = [];
    this.sceneFireTimer = 2.0;
    this.sceneProjectile.active = false;
    this.sceneExplosions = [];
  }

  resetDifficultySlideIn(): void {
    this.difficultySlideIn = [0, 0, 0, 0]; // 3 difficulties + back
  }

  renderMenu(
    ctx: CanvasRenderingContext2D,
    menuItems: MenuItem[],
    selectedMenuItem: number
  ): void {
    // 1. Gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    bgGradient.addColorStop(0, '#0a0a1a');
    bgGradient.addColorStop(0.4, '#12122e');
    bgGradient.addColorStop(0.7, '#16213e');
    bgGradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // 2. Starfield
    this.renderStarfield(ctx);

    // 3. Battle scene (terrain, ants, projectile, explosions)
    this.renderBattleScene(ctx);

    // 4. Title + subtitle + divider
    this.renderTitle(ctx);

    // 5. Menu items with highlight bar and descriptions
    this.renderMenuItems(ctx, menuItems, selectedMenuItem);

    // 6. Instructions
    const instructAlpha = Math.min(1, this.menuTitlePulse / 2);
    ctx.globalAlpha = instructAlpha;
    ctx.fillStyle = '#555';
    ctx.font = '11px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('Arrow Keys to Select, Enter to Start', BASE_WIDTH / 2, 445);
    ctx.fillText('In-game: Mouse = Aim, Hold Click = Charge, Release = Fire', BASE_WIDTH / 2, 460);
    ctx.globalAlpha = 1;

    // 7. Version footer
    ctx.fillStyle = '#333';
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'right';
    ctx.fillText('v1.0', BASE_WIDTH - 10, BASE_HEIGHT - 8);
    ctx.textAlign = 'center';
  }

  renderDifficultyMenu(
    ctx: CanvasRenderingContext2D,
    difficulties: { label: string; difficulty: AIDifficulty; description: string }[],
    selectedIndex: number
  ): void {
    // 1. Gradient background (same as main menu)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    bgGradient.addColorStop(0, '#0a0a1a');
    bgGradient.addColorStop(0.4, '#12122e');
    bgGradient.addColorStop(0.7, '#16213e');
    bgGradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // 2. Starfield
    this.renderStarfield(ctx);

    // 3. Battle scene
    this.renderBattleScene(ctx);

    // 4. Title area
    ctx.save();
    ctx.textAlign = 'center';

    // Header
    ctx.fillStyle = '#6bcfff';
    ctx.font = 'bold 28px "Courier New"';
    ctx.fillText('SELECT DIFFICULTY', BASE_WIDTH / 2, 100);

    // Divider
    ctx.strokeStyle = 'rgba(107, 207, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BASE_WIDTH / 2 - 140, 115);
    ctx.lineTo(BASE_WIDTH / 2 + 140, 115);
    ctx.stroke();

    ctx.restore();

    // 5. Difficulty options
    const menuStartY = 180;
    const itemHeight = 55;

    for (let i = 0; i < difficulties.length; i++) {
      const slideProgress = this.difficultySlideIn[i] || 0;
      const slideOffset = (1 - this.easeOutCubic(slideProgress)) * 80;
      const alpha = slideProgress;
      const y = menuStartY + i * itemHeight;
      const isSelected = i === selectedIndex;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(slideOffset, 0);
      ctx.textAlign = 'center';

      // Highlight bar
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 107, 107, 0.12)';
        ctx.fillRect(BASE_WIDTH / 2 - 160, y - 16, 320, 38);

        // Left border accent
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(BASE_WIDTH / 2 - 160, y - 16, 3, 38);
      }

      // Selector arrow
      if (isSelected) {
        const selectorPulse = Math.sin(this.menuTitlePulse * 3) * 3;
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '20px "Courier New"';
        ctx.fillText('>', BASE_WIDTH / 2 - 140 + selectorPulse, y + 4);
      }

      // Label
      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.font = `${isSelected ? 'bold ' : ''}20px "Courier New"`;
      ctx.fillText(difficulties[i].label, BASE_WIDTH / 2, y + 4);

      // Description
      ctx.fillStyle = isSelected ? '#888' : '#555';
      ctx.font = '11px "Courier New"';
      ctx.fillText(difficulties[i].description, BASE_WIDTH / 2, y + 20);

      ctx.restore();
    }

    // Back option
    const backIndex = difficulties.length;
    const backY = menuStartY + backIndex * itemHeight;
    const backSlide = this.difficultySlideIn[backIndex] || 0;
    const backAlpha = backSlide;
    const backOffset = (1 - this.easeOutCubic(backSlide)) * 80;
    const backSelected = selectedIndex === backIndex;

    ctx.save();
    ctx.globalAlpha = backAlpha;
    ctx.translate(backOffset, 0);
    ctx.textAlign = 'center';

    if (backSelected) {
      ctx.fillStyle = 'rgba(255, 107, 107, 0.12)';
      ctx.fillRect(BASE_WIDTH / 2 - 160, backY - 16, 320, 38);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(BASE_WIDTH / 2 - 160, backY - 16, 3, 38);

      const selectorPulse = Math.sin(this.menuTitlePulse * 3) * 3;
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '20px "Courier New"';
      ctx.fillText('>', BASE_WIDTH / 2 - 140 + selectorPulse, backY + 4);
    }

    ctx.fillStyle = backSelected ? '#fff' : '#777';
    ctx.font = `${backSelected ? 'bold ' : ''}18px "Courier New"`;
    ctx.fillText('BACK', BASE_WIDTH / 2, backY + 4);

    ctx.restore();

    // Instructions
    const instructAlpha = Math.min(1, this.menuTitlePulse / 2);
    ctx.globalAlpha = instructAlpha;
    ctx.fillStyle = '#555';
    ctx.font = '11px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('Arrow Keys to Select, Enter to Confirm, ESC to Go Back', BASE_WIDTH / 2, 445);
    ctx.globalAlpha = 1;

    // Version footer
    ctx.fillStyle = '#333';
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'right';
    ctx.fillText('v1.0', BASE_WIDTH - 10, BASE_HEIGHT - 8);
    ctx.textAlign = 'center';
  }

  private renderStarfield(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      let alpha = star.brightness;
      if (star.twinkles) {
        alpha *= 0.5 + 0.5 * Math.sin(this.menuTitlePulse * 3 + star.twinkleOffset);
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderBattleScene(ctx: CanvasRenderingContext2D): void {
    const numPoints = this.sceneTerrain.length;

    // Draw terrain silhouette
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, BASE_HEIGHT);
    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * BASE_WIDTH;
      ctx.lineTo(x, this.sceneTerrain[i]);
    }
    ctx.lineTo(BASE_WIDTH, BASE_HEIGHT);
    ctx.closePath();

    // Gradient fill for terrain
    const terrainGradient = ctx.createLinearGradient(0, BASE_HEIGHT * 0.65, 0, BASE_HEIGHT);
    terrainGradient.addColorStop(0, '#1a3a1a');
    terrainGradient.addColorStop(0.5, '#0f2a0f');
    terrainGradient.addColorStop(1, '#0a1a0a');
    ctx.fillStyle = terrainGradient;
    ctx.fill();

    // Terrain top edge highlight
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * BASE_WIDTH;
      if (i === 0) ctx.moveTo(x, this.sceneTerrain[i]);
      else ctx.lineTo(x, this.sceneTerrain[i]);
    }
    ctx.stroke();
    ctx.restore();

    // Draw ant silhouettes
    const redX = 120;
    const greenX = 680;
    const redY = this.getTerrainY(redX);
    const greenY = this.getTerrainY(greenX);

    this.renderMenuAnt(ctx, redX, redY, TEAM_COLORS[0], true);
    this.renderMenuAnt(ctx, greenX, greenY, TEAM_COLORS[1], false);

    // Draw projectile
    if (this.sceneProjectile.active) {
      ctx.save();
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.sceneProjectile.x, this.sceneProjectile.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Draw explosions
    for (const exp of this.sceneExplosions) {
      const lifeRatio = exp.life / exp.maxLife;
      ctx.save();
      ctx.globalAlpha = lifeRatio;

      // Outer glow
      ctx.fillStyle = `rgba(255, 165, 0, ${lifeRatio * 0.4})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `rgba(255, 255, 200, ${lifeRatio * 0.8})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderMenuAnt(
    ctx: CanvasRenderingContext2D,
    x: number,
    terrainY: number,
    color: string,
    facingRight: boolean
  ): void {
    ctx.save();

    // Silhouette-style ant with 1.5px blocks — recognizable shape, fits the scene
    const S = 1.5; // pixel block size
    const d = facingRight ? 1 : -1;
    const bob = Math.sin(this.menuTitlePulse * 2 + (facingRight ? 0 : Math.PI)) * 1;

    // Position ant so feet sit ON the terrain (offset up by full ant height)
    const bx = Math.floor(x / S);
    const by = Math.floor((terrainY - 1 + bob) / S); // feet at terrain line

    const legAnim = Math.floor(Math.sin(this.menuTitlePulse * 4) * 1);
    const breathe = Math.floor(Math.sin(this.menuTitlePulse * 2) * 0.5);

    // Silhouette palette — dark body, team-colored helmet
    const body = '#1a2a1a';
    const bodyH = '#243424';
    const helm = this.darkenColor(color, 20);
    const helmH = color;

    const px = (gx: number, gy: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(gx * S, gy * S, S, S);
    };

    // === BACK LEGS ===
    px(bx - d * 3, by - 1, body);
    px(bx - d * 4 - legAnim, by, body);
    px(bx - d * 2, by - 2, body);
    px(bx - d * 3 + legAnim, by - 1, body);
    px(bx - d * 3 + legAnim, by, body);

    // === ABDOMEN ===
    px(bx - d * 2, by - 4 + breathe, bodyH);
    px(bx - d * 3, by - 4 + breathe, body);
    px(bx - d * 2, by - 3 + breathe, body);
    px(bx - d * 3, by - 3 + breathe, body);
    px(bx - d * 4, by - 3 + breathe, body);

    // === PETIOLE ===
    px(bx - d * 1, by - 3 + breathe, body);

    // === THORAX ===
    px(bx, by - 4 + breathe, body);
    px(bx + d * 1, by - 5 + breathe, bodyH);
    px(bx, by - 5 + breathe, body);
    px(bx + d * 1, by - 4 + breathe, body);
    px(bx + d * 2, by - 5 + breathe, body);

    // === FRONT/MIDDLE LEGS ===
    px(bx, by - 3, body);
    px(bx - legAnim, by - 2, body);
    px(bx - legAnim, by - 1, body);
    px(bx + d * 1, by - 3, body);
    px(bx + d * 1 + legAnim, by - 2, body);
    px(bx + d * 2 + legAnim, by - 1, body);

    // === NECK ===
    px(bx + d * 2, by - 6 + breathe, body);
    px(bx + d * 3, by - 7 + breathe, body);

    // === HEAD ===
    px(bx + d * 3, by - 9 + breathe, body);
    px(bx + d * 4, by - 9 + breathe, body);
    px(bx + d * 3, by - 8 + breathe, bodyH);
    px(bx + d * 4, by - 8 + breathe, body);
    px(bx + d * 5, by - 8 + breathe, body);
    px(bx + d * 4, by - 10 + breathe, body);

    // === HELMET ===
    px(bx + d * 3, by - 11 + breathe, helm);
    px(bx + d * 4, by - 11 + breathe, helmH);
    px(bx + d * 5, by - 11 + breathe, helm);
    px(bx + d * 3, by - 10 + breathe, helmH);
    px(bx + d * 4, by - 10 + breathe, helmH);
    px(bx + d * 5, by - 10 + breathe, helm);
    // Brim
    px(bx + d * 2, by - 10 + breathe, helm);
    px(bx + d * 6, by - 10 + breathe, helm);

    // === EYE ===
    px(bx + d * 5, by - 9 + breathe, '#556655');

    // === ANTENNAE ===
    const aw = Math.floor(Math.sin(this.menuTitlePulse * 4) * 1);
    px(bx + d * 3 + aw, by - 12 + breathe, body);
    px(bx + d * 2 + aw, by - 13 + breathe, body);
    px(bx + d * 5 - aw, by - 12 + breathe, body);
    px(bx + d * 6 - aw, by - 13 + breathe, body);

    ctx.restore();
  }

  private darkenColor(color: string, amount: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xFF) - amount);
    const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
    const b = Math.max(0, (num & 0xFF) - amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    const titleScale = 1 + Math.sin(this.menuTitlePulse) * 0.02;
    const titleGlow = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.3;

    ctx.save();
    ctx.translate(BASE_WIDTH / 2, 100);
    ctx.scale(titleScale, titleScale);
    ctx.textAlign = 'center';

    // Outer stroke for weight
    ctx.strokeStyle = '#330000';
    ctx.lineWidth = 4;
    ctx.font = 'bold 48px "Courier New"';
    ctx.strokeText('ANT WARS', 0, 0);

    // Glow
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 20 * titleGlow;

    // Gradient fill (red to orange)
    const titleGradient = ctx.createLinearGradient(-100, -20, 100, 20);
    titleGradient.addColorStop(0, '#ff4444');
    titleGradient.addColorStop(0.5, '#ff6b6b');
    titleGradient.addColorStop(1, '#ffaa44');
    ctx.fillStyle = titleGradient;
    ctx.fillText('ANT WARS', 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();

    // Subtitle (slightly larger)
    ctx.fillStyle = '#6bcfff';
    ctx.font = '16px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('ANT ARTILLERY BATTLE', BASE_WIDTH / 2, 130);

    // Divider line
    ctx.strokeStyle = 'rgba(107, 207, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BASE_WIDTH / 2 - 120, 142);
    ctx.lineTo(BASE_WIDTH / 2 + 120, 142);
    ctx.stroke();
  }

  private renderMenuItems(
    ctx: CanvasRenderingContext2D,
    menuItems: MenuItem[],
    selectedMenuItem: number
  ): void {
    const descriptions = [
      'Battle against the CPU',
      'Play with a friend',
    ];

    const menuStartY = 200;
    const itemHeight = 50;

    for (let i = 0; i < menuItems.length; i++) {
      const slideProgress = this.menuItemsSlideIn[i] || 0;
      const slideOffset = (1 - this.easeOutCubic(slideProgress)) * 100;
      const alpha = slideProgress;

      const y = menuStartY + i * itemHeight;
      const isSelected = i === selectedMenuItem;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(slideOffset, 0);
      ctx.textAlign = 'center';

      // Highlight bar behind selected item
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 107, 107, 0.12)';
        ctx.fillRect(BASE_WIDTH / 2 - 150, y - 14, 300, 36);

        // Left border accent
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(BASE_WIDTH / 2 - 150, y - 14, 3, 36);
      }

      // Selector arrow
      if (isSelected) {
        const selectorPulse = Math.sin(this.menuTitlePulse * 3) * 3;
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '20px "Courier New"';
        ctx.fillText('>', BASE_WIDTH / 2 - 130 + selectorPulse, y + 4);
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
      }

      // Label
      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.font = `${isSelected ? 'bold ' : ''}20px "Courier New"`;
      ctx.fillText(menuItems[i].label, BASE_WIDTH / 2, y + 4);
      ctx.shadowBlur = 0;

      // Description
      if (descriptions[i]) {
        ctx.fillStyle = isSelected ? '#888' : '#555';
        ctx.font = '11px "Courier New"';
        ctx.fillText(descriptions[i], BASE_WIDTH / 2, y + 19);
      }

      ctx.restore();
    }
  }

  renderPauseMenu(
    ctx: CanvasRenderingContext2D,
    pauseMenuItems: MenuItem[],
    selectedPauseItem: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.textAlign = 'center';

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px "Courier New"';
    ctx.fillText('PAUSED', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 80);

    const menuStartY = BASE_HEIGHT / 2 - 20;
    const itemHeight = 40;

    for (let i = 0; i < pauseMenuItems.length; i++) {
      const y = menuStartY + i * itemHeight;
      const isSelected = i === selectedPauseItem;

      if (isSelected) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('>', BASE_WIDTH / 2 - 100, y);
      }

      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.font = `${isSelected ? 'bold ' : ''}20px "Courier New"`;
      ctx.fillText(pauseMenuItems[i].label, BASE_WIDTH / 2, y);
    }

    ctx.fillStyle = '#666';
    ctx.font = '14px "Courier New"';
    ctx.fillText('Press ESC to Resume', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 100);
  }

  renderSettings(
    ctx: CanvasRenderingContext2D,
    settingsOptions: string[],
    selectedSettingIndex: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.textAlign = 'center';

    ctx.fillStyle = '#6bcfff';
    ctx.font = 'bold 32px "Courier New"';
    ctx.fillText('SETTINGS', BASE_WIDTH / 2, 80);

    const startY = 150;
    const itemHeight = 50;
    const barWidth = 200;

    for (let i = 0; i < settingsOptions.length; i++) {
      const y = startY + i * itemHeight;
      const isSelected = i === selectedSettingIndex;
      const option = settingsOptions[i];

      if (isSelected) {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('>', BASE_WIDTH / 2 - 180, y);
      }

      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.font = `${isSelected ? 'bold ' : ''}16px "Courier New"`;
      ctx.textAlign = 'left';
      ctx.fillText(option, BASE_WIDTH / 2 - 150, y);

      if (option !== 'Back') {
        let volume = 0;
        if (option === 'Master Volume') volume = soundManager.getMasterVolume();
        else if (option === 'Music Volume') volume = soundManager.getMusicVolume();
        else if (option === 'SFX Volume') volume = soundManager.getSfxVolume();

        const barX = BASE_WIDTH / 2 + 20;
        const barY = y - 10;
        const barHeight = 15;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = isSelected ? '#4ECB71' : '#666';
        ctx.fillRect(barX, barY, barWidth * (volume / 100), barHeight);

        ctx.strokeStyle = isSelected ? '#fff' : '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = isSelected ? '#fff' : '#aaa';
        ctx.textAlign = 'right';
        ctx.fillText(`${volume}%`, barX + barWidth + 50, y);
      }

      ctx.textAlign = 'center';
    }

    ctx.fillStyle = '#666';
    ctx.font = '12px "Courier New"';
    ctx.fillText('Up/Down to Select, Left/Right to Adjust, ESC to Go Back', BASE_WIDTH / 2, BASE_HEIGHT - 50);
  }

  renderGameOver(
    ctx: CanvasRenderingContext2D,
    winner: Ant | null,
    winningTeam: number | null,
    gameMode: GameMode,
    playerStats: PlayerStats[]
  ): void {
    const overlayAlpha = this.easeOutCubic(this.gameOverSlideIn) * 0.85;
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.textAlign = 'center';

    let titleY = 80;
    const titleSlide = this.easeOutElastic(Math.min(1, this.gameOverSlideIn * 1.5));
    const titleScale = 0.5 + titleSlide * 0.5;
    const titleGlow = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.5;

    ctx.save();
    ctx.translate(BASE_WIDTH / 2, titleY);
    ctx.scale(titleScale, titleScale);
    ctx.globalAlpha = this.gameOverSlideIn;

    if (winner) {
      const winnerLabel = gameMode === 'single'
        ? (winningTeam === 0 ? 'YOU WIN!' : 'CPU WINS!')
        : `TEAM ${(winningTeam ?? 0) + 1} WINS!`;

      ctx.shadowColor = winner.color;
      ctx.shadowBlur = 20 * titleGlow;
      ctx.fillStyle = winner.color;
      ctx.font = 'bold 36px "Courier New"';
      ctx.fillText(winnerLabel, 0, 0);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px "Courier New"';
      ctx.fillText('DRAW!', 0, 0);
    }
    ctx.restore();

    // Statistics
    const statsSlideDelay = 0.3;
    const statsProgress = Math.max(0, (this.gameOverSlideIn - statsSlideDelay) / (1 - statsSlideDelay));
    const statsSlide = this.easeOutCubic(statsProgress);

    ctx.save();
    ctx.globalAlpha = statsProgress;
    ctx.translate((1 - statsSlide) * -50, 0);

    ctx.fillStyle = '#6bcfff';
    ctx.font = 'bold 20px "Courier New"';
    ctx.fillText('MATCH STATISTICS', BASE_WIDTH / 2, titleY + 60);

    const statsY = titleY + 100;
    const colWidth = 180;
    const p1X = BASE_WIDTH / 2 - colWidth;
    const p2X = BASE_WIDTH / 2 + colWidth;

    ctx.font = 'bold 16px "Courier New"';
    ctx.fillStyle = TEAM_COLORS[0];
    ctx.fillText(gameMode === 'single' ? 'YOUR TEAM' : 'TEAM 1', p1X, statsY);
    ctx.fillStyle = TEAM_COLORS[1];
    ctx.fillText(gameMode === 'single' ? 'CPU TEAM' : 'TEAM 2', p2X, statsY);

    ctx.font = '14px "Courier New"';
    const stats: { label: string; key: keyof PlayerStats | 'accuracy' }[] = [
      { label: 'Shots Fired', key: 'shotsFired' },
      { label: 'Hits', key: 'hits' },
      { label: 'Damage Dealt', key: 'damageDealt' },
      { label: 'Accuracy', key: 'accuracy' },
    ];

    let rowY = statsY + 30;
    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const rowDelay = 0.4 + i * 0.1;
      const rowProgress = Math.max(0, (this.gameOverSlideIn - rowDelay) / (1 - rowDelay));
      const rowAlpha = this.easeOutCubic(rowProgress);
      const rowOffset = (1 - rowAlpha) * 30;

      ctx.save();
      ctx.globalAlpha = rowAlpha;
      ctx.translate(0, rowOffset);

      ctx.fillStyle = '#aaa';
      ctx.fillText(stat.label, BASE_WIDTH / 2, rowY);

      ctx.fillStyle = '#fff';
      if (stat.key === 'accuracy') {
        const acc1 = playerStats[0]?.shotsFired > 0
          ? Math.round((playerStats[0].hits / playerStats[0].shotsFired) * 100)
          : 0;
        const acc2 = playerStats[1]?.shotsFired > 0
          ? Math.round((playerStats[1].hits / playerStats[1].shotsFired) * 100)
          : 0;
        ctx.fillText(`${acc1}%`, p1X, rowY);
        ctx.fillText(`${acc2}%`, p2X, rowY);
      } else {
        ctx.fillText(String(playerStats[0]?.[stat.key] ?? 0), p1X, rowY);
        ctx.fillText(String(playerStats[1]?.[stat.key] ?? 0), p2X, rowY);
      }

      ctx.restore();
      rowY += 25;
    }

    ctx.restore();

    // Continue prompt
    const promptAlpha = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.3;
    ctx.globalAlpha = this.gameOverSlideIn * promptAlpha;
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Courier New"';
    ctx.fillText('Press Enter to Continue', BASE_WIDTH / 2, BASE_HEIGHT - 50);
    ctx.globalAlpha = 1;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}
