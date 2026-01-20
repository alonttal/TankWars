import { BASE_WIDTH, BASE_HEIGHT, TEAM_COLORS } from '../constants.ts';
import { MenuItem, PlayerStats, GameMode } from '../types/GameTypes.ts';
import { soundManager } from '../Sound.ts';
import { Ant } from '../Ant.ts';

export class MenuRenderer {
  private menuTitlePulse: number = 0;
  private menuItemsSlideIn: number[] = [];
  private gameOverSlideIn: number = 0;

  update(deltaTime: number, state: string, menuItemsLength: number): void {
    // Update menu animations
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
    }

    // Update game over slide-in animation
    if (state === 'GAME_OVER') {
      this.gameOverSlideIn += (1 - this.gameOverSlideIn) * Math.min(1, deltaTime * 3);
    } else {
      this.gameOverSlideIn = 0;
    }
  }

  reset(): void {
    this.menuTitlePulse = 0;
    this.menuItemsSlideIn = [];
    this.gameOverSlideIn = 0;
  }

  renderMenu(
    ctx: CanvasRenderingContext2D,
    menuItems: MenuItem[],
    selectedMenuItem: number
  ): void {
    // Background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(0.5, '#16213e');
    bgGradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Animated background particles
    ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(this.menuTitlePulse + i * 0.5) * 0.5 + 0.5) * BASE_WIDTH;
      const y = ((this.menuTitlePulse * 0.1 + i * 0.1) % 1) * BASE_HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.sin(i) * 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title with glow and pulse effect
    const titleScale = 1 + Math.sin(this.menuTitlePulse) * 0.02;
    const titleGlow = 0.5 + Math.sin(this.menuTitlePulse * 2) * 0.3;

    ctx.save();
    ctx.translate(BASE_WIDTH / 2, 120);
    ctx.scale(titleScale, titleScale);

    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 20 * titleGlow;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 48px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('TANK WARS', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Subtitle
    ctx.fillStyle = '#6bcfff';
    ctx.font = '24px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('Artillery Game', BASE_WIDTH / 2, 160);

    // Menu items with slide-in animation
    const menuStartY = 260;
    const itemHeight = 40;

    for (let i = 0; i < menuItems.length; i++) {
      const slideProgress = this.menuItemsSlideIn[i] || 0;
      const slideOffset = (1 - this.easeOutCubic(slideProgress)) * 100;
      const alpha = slideProgress;

      const y = menuStartY + i * itemHeight;
      const isSelected = i === selectedMenuItem;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(slideOffset, 0);

      if (isSelected) {
        const selectorPulse = Math.sin(this.menuTitlePulse * 3) * 3;
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('>', BASE_WIDTH / 2 - 120 + selectorPulse, y);
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
      }

      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.font = `${isSelected ? 'bold ' : ''}18px "Courier New"`;
      ctx.fillText(menuItems[i].label, BASE_WIDTH / 2, y);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // Instructions
    const instructAlpha = Math.min(1, this.menuTitlePulse / 2);
    ctx.globalAlpha = instructAlpha;
    ctx.fillStyle = '#666';
    ctx.font = '12px "Courier New"';
    ctx.fillText('Arrow Keys to Select, Enter to Start', BASE_WIDTH / 2, 440);
    ctx.fillText('In-game: Mouse = Aim, Hold Left Click = Charge, Release = Fire', BASE_WIDTH / 2, 460);
    ctx.globalAlpha = 1;

    // Decorative tanks
    const tankBob = Math.sin(this.menuTitlePulse * 2) * 2;
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(150, 200 + tankBob, 40, 20);
    ctx.fillStyle = '#4ECB71';
    ctx.fillRect(610, 200 - tankBob, 40, 20);
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
