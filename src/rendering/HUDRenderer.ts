import { BASE_WIDTH, BASE_HEIGHT, NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS, WIND_STRENGTH_MAX, MAX_MOVEMENT_ENERGY } from '../constants.ts';
import { GameMode, HUDHealthAnimation } from '../types/GameTypes.ts';
import { Ant } from '../Ant.ts';
import { CameraSystem } from '../systems/CameraSystem.ts';
import { POWERUP_CONFIGS } from '../powerups/PowerUpTypes.ts';

export class HUDRenderer {
  hudHealthAnimations: HUDHealthAnimation[] = [];

  // Turn banner state
  private turnBannerAlpha: number = 0;
  private turnBannerText: string = '';
  private turnBannerTimer: number = 0;
  private turnBannerSlideProgress: number = 0;

  // Animation flash state
  private windChangeFlash: number = 0;
  private weaponChangeFlash: number = 0;

  // Smooth wind animation
  private displayWind: number = 0;

  initHealthAnimations(antCount: number): void {
    this.hudHealthAnimations = [];
    for (let i = 0; i < antCount; i++) {
      this.hudHealthAnimations.push({ current: 100, target: 100 });
    }
  }

  update(deltaTime: number): void {
    this.updateTurnBanner(deltaTime);

    // Decay flash timers
    if (this.windChangeFlash > 0) {
      this.windChangeFlash = Math.max(0, this.windChangeFlash - deltaTime / 0.4);
    }
    if (this.weaponChangeFlash > 0) {
      this.weaponChangeFlash = Math.max(0, this.weaponChangeFlash - deltaTime / 0.2);
    }
  }

  updateTurnBanner(deltaTime: number): void {
    if (this.turnBannerTimer > 0) {
      this.turnBannerTimer -= deltaTime;

      // Slide-in over first 0.3s
      if (this.turnBannerSlideProgress < 1) {
        this.turnBannerSlideProgress = Math.min(1, this.turnBannerSlideProgress + deltaTime / 0.3);
      }

      if (this.turnBannerTimer <= 0.5) {
        this.turnBannerAlpha = this.turnBannerTimer / 0.5;
      }
      if (this.turnBannerTimer <= 0) {
        this.turnBannerAlpha = 0;
        this.turnBannerSlideProgress = 0;
      }
    }
  }

  showTurnBanner(text: string): void {
    this.turnBannerText = text;
    this.turnBannerAlpha = 1;
    this.turnBannerTimer = 2.0;
    this.turnBannerSlideProgress = 0;
  }

  onWindChanged(): void {
    this.windChangeFlash = 1;
  }

  onWeaponChanged(): void {
    this.weaponChangeFlash = 1;
  }

  /** Draw corner bracket accents on a panel */
  private drawCornerBrackets(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    color: string, len: number = 10, inset: number = 3
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'square';
    const coords = [
      [x + inset, y + inset + len, x + inset, y + inset, x + inset + len, y + inset],
      [x + w - inset - len, y + inset, x + w - inset, y + inset, x + w - inset, y + inset + len],
      [x + inset, y + h - inset - len, x + inset, y + h - inset, x + inset + len, y + h - inset],
      [x + w - inset - len, y + h - inset, x + w - inset, y + h - inset, x + w - inset, y + h - inset - len],
    ];
    for (const c of coords) {
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[2], c[3]);
      ctx.lineTo(c[4], c[5]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  renderTurnInfoPanel(
    ctx: CanvasRenderingContext2D,
    turnTimeRemaining: number,
    maxTurnTime: number,
    currentAnt: Ant | null,
    state: string
  ): void {
    const panelW = 220;
    const panelH = 44;
    const panelX = BASE_WIDTH / 2 - panelW / 2;
    const panelY = 4;

    ctx.save();

    const teamColor = currentAnt?.color || '#fff';

    // Gradient background for depth
    const bgGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
    bgGrad.addColorStop(0, 'rgba(35, 35, 50, 0.8)');
    bgGrad.addColorStop(1, 'rgba(12, 12, 18, 0.85)');
    ctx.shadowColor = teamColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Top highlight (metallic edge)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 10, panelY + 1.5);
    ctx.lineTo(panelX + panelW - 10, panelY + 1.5);
    ctx.stroke();

    // Team-color inner glow at top
    const innerGlow = ctx.createLinearGradient(0, panelY, 0, panelY + 14);
    innerGlow.addColorStop(0, teamColor + '28');
    innerGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.roundRect(panelX + 1, panelY + 1, panelW - 2, 14, 5);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Corner brackets
    this.drawCornerBrackets(ctx, panelX, panelY, panelW, panelH, teamColor + 'AA', 9, 2);

    if (state === 'AI_THINKING') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Courier New"';
      ctx.textAlign = 'center';
      const dots = '.'.repeat(Math.floor((Date.now() / 300) % 4));
      ctx.fillText(`CPU Thinking${dots}`, BASE_WIDTH / 2, panelY + 20);

      // Animated scanner bar
      const glowPhase = (Date.now() % 2000) / 2000;
      const scanGrad = ctx.createLinearGradient(panelX + 12, 0, panelX + panelW - 12, 0);
      scanGrad.addColorStop(Math.max(0, glowPhase - 0.15), 'transparent');
      scanGrad.addColorStop(glowPhase, 'rgba(136, 170, 255, 0.6)');
      scanGrad.addColorStop(Math.min(1, glowPhase + 0.15), 'transparent');
      ctx.fillStyle = scanGrad;
      ctx.beginPath();
      ctx.roundRect(panelX + 12, panelY + 30, panelW - 24, 4, 2);
      ctx.fill();
    } else if (currentAnt) {
      // Ant name with subtle text shadow
      ctx.shadowColor = teamColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(currentAnt.name, BASE_WIDTH / 2, panelY + 17);
      ctx.shadowBlur = 0;

      // Timer bar
      const timeRatio = turnTimeRemaining / maxTurnTime;
      let timerColor: string;
      if (timeRatio > 0.5) timerColor = '#4ECB71';
      else if (timeRatio > 0.25) timerColor = '#FFD93D';
      else timerColor = '#FF6B6B';

      const barX = panelX + 14;
      const barY = panelY + 25;
      const barW = panelW - 28;
      const barH = 12;

      // Bar background with inner shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.stroke();

      // Bar fill with gradient + pulse when <5s
      const fillW = Math.max(barW * timeRatio, 0);
      if (fillW > 0) {
        ctx.save();
        if (turnTimeRemaining < 5) {
          const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 150));
          ctx.globalAlpha = pulse;
          ctx.shadowColor = timerColor;
          ctx.shadowBlur = 8;
        }
        const barGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
        barGrad.addColorStop(0, timerColor);
        barGrad.addColorStop(0.4, timerColor);
        barGrad.addColorStop(1, timerColor + '88');
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, 3);
        ctx.fill();
        // Top highlight on fill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(barX + 2, barY + 1, Math.max(fillW - 4, 0), 2);
        ctx.restore();
      }

      // Seconds text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(turnTimeRemaining)}s`, barX + barW / 2, barY + barH - 2);
    }

    ctx.restore();
  }

  renderBottomStrip(
    ctx: CanvasRenderingContext2D,
    wind: number,
    currentAnt: Ant | null
  ): void {
    ctx.save();

    // Smooth wind lerp
    this.displayWind += (wind - this.displayWind) * 0.08;

    // --- Left: Juicy wind indicator ---
    const windCenterX = 55;
    const windCenterY = BASE_HEIGHT - 20;
    const windStrength = Math.abs(this.displayWind) / WIND_STRENGTH_MAX;

    // Wind panel background - pill shape
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(5, BASE_HEIGHT - 36, 100, 30, 15);
    ctx.fill();

    // Flash highlight on wind change
    if (this.windChangeFlash > 0) {
      const flashColor = windStrength > 0.6 ? '#FF6B6B' : windStrength > 0.3 ? '#FFD93D' : '#4ECB71';
      ctx.save();
      ctx.shadowColor = flashColor;
      ctx.shadowBlur = 12 * this.windChangeFlash;
      ctx.strokeStyle = flashColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = this.windChangeFlash * 0.8;
      ctx.beginPath();
      ctx.roundRect(5, BASE_HEIGHT - 36, 100, 30, 15);
      ctx.stroke();
      ctx.restore();
    }

    if (Math.abs(this.displayWind) > 0.5) {
      const direction = this.displayWind > 0 ? 1 : -1;
      const arrowColor = windStrength > 0.6 ? '#FF6B6B' : windStrength > 0.3 ? '#FFD93D' : '#4ECB71';

      // Animated wind streaks
      const time = Date.now() / 400;
      ctx.save();
      ctx.globalAlpha = 0.3 + windStrength * 0.4;
      for (let i = 0; i < 3; i++) {
        const streakPhase = ((time + i * 1.3) % 3) / 3; // 0-1 cycling
        const streakX = windCenterX - 30 * direction + streakPhase * 60 * direction;
        const streakLen = 8 + windStrength * 14;
        const streakAlpha = 1 - Math.abs(streakPhase - 0.5) * 2; // Fade at edges
        ctx.globalAlpha = streakAlpha * (0.2 + windStrength * 0.4);
        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(streakX, windCenterY - 3 + i * 3);
        ctx.lineTo(streakX + streakLen * direction, windCenterY - 3 + i * 3);
        ctx.stroke();
      }
      ctx.restore();

      // Main arrow
      const arrowLen = 14 + windStrength * 20;
      const arrowStartX = windCenterX - arrowLen / 2 * direction;
      const arrowEndX = windCenterX + arrowLen / 2 * direction;

      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(arrowStartX, windCenterY);
      ctx.lineTo(arrowEndX, windCenterY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = arrowColor;
      ctx.beginPath();
      ctx.moveTo(arrowEndX + 3 * direction, windCenterY);
      ctx.lineTo(arrowEndX - 5 * direction, windCenterY - 5);
      ctx.lineTo(arrowEndX - 5 * direction, windCenterY + 5);
      ctx.closePath();
      ctx.fill();

      // Strength number
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(Math.abs(Math.round(wind)).toString(), windCenterX, windCenterY - 10);
    } else {
      // Calm state - subtle dot
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(windCenterX, windCenterY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#666';
      ctx.font = '9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('CALM', windCenterX, windCenterY - 10);
    }

    // --- Center: Buff icons ---
    if (currentAnt && currentAnt.activeBuffs.length > 0) {
      const buffs = currentAnt.activeBuffs;
      const buffTotalWidth = buffs.length * 28 - 4;
      const startX = BASE_WIDTH / 2 - buffTotalWidth / 2;

      for (let i = 0; i < buffs.length; i++) {
        const buff = buffs[i];
        const config = POWERUP_CONFIGS[buff.type];
        if (!config) continue;

        const bx = startX + i * 28;
        const by = BASE_HEIGHT - 32;

        // Buff circle background
        ctx.fillStyle = `${config.color}44`;
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx + 10, by + 10, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Buff icon character
        ctx.fillStyle = config.color;
        ctx.font = 'bold 11px "Courier New"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let icon: string;
        switch (config.icon) {
          case 'cross': icon = '+'; break;
          case 'sword': icon = 'X'; break;
          case 'shield': icon = 'O'; break;
          case 'double_arrow': icon = '>>'; break;
          default: icon = '?';
        }
        ctx.fillText(icon, bx + 10, by + 11);
        ctx.textBaseline = 'alphabetic';

        // Remaining value below
        ctx.fillStyle = '#ccc';
        ctx.font = '7px "Courier New"';
        ctx.fillText(`${Math.ceil(buff.remainingValue)}`, bx + 10, by + 25);
      }
    }

    ctx.restore();
  }

  renderHUDHealthBars(
    ctx: CanvasRenderingContext2D,
    ants: Ant[],
    currentPlayerIndex: number,
    gameMode: GameMode,
    state: string
  ): void {
    const padding = 8;
    const teamPanelWidth = 165;
    const miniBarWidth = 32;
    const miniBarHeight = 7;
    const barsPerRow = 4;
    const barSpacing = 4;
    const rowSpacing = 12;

    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
      const isLeft = teamIdx === 0;
      const panelX = isLeft ? padding : BASE_WIDTH - padding - teamPanelWidth;
      const panelY = 5;
      const panelH = 68;
      const tc = TEAM_COLORS[teamIdx];

      const teamAnts = ants.filter(a => a.teamIndex === teamIdx);
      const aliveCount = teamAnts.filter(a => a.isAlive).length;

      ctx.save();

      // Gradient background for depth
      const bgGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
      bgGrad.addColorStop(0, 'rgba(35, 35, 50, 0.8)');
      bgGrad.addColorStop(1, 'rgba(12, 12, 18, 0.85)');
      ctx.shadowColor = tc;
      ctx.shadowBlur = 8;
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, teamPanelWidth, panelH, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Top highlight (metallic edge)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 10, panelY + 1.5);
      ctx.lineTo(panelX + teamPanelWidth - 10, panelY + 1.5);
      ctx.stroke();

      // Team-color inner glow at top
      const innerGlow = ctx.createLinearGradient(0, panelY, 0, panelY + 14);
      innerGlow.addColorStop(0, tc + '28');
      innerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.roundRect(panelX + 1, panelY + 1, teamPanelWidth - 2, 14, 5);
      ctx.fill();

      // Subtle border
      ctx.strokeStyle = tc;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, teamPanelWidth, panelH, 6);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Corner brackets
      this.drawCornerBrackets(ctx, panelX, panelY, teamPanelWidth, panelH, tc + 'AA', 9, 2);

      ctx.restore();

      // Team name header with glow
      ctx.save();
      ctx.shadowColor = tc;
      ctx.shadowBlur = 4;
      ctx.fillStyle = tc;
      ctx.font = 'bold 9px "Courier New"';
      ctx.textAlign = 'center';
      const teamName = gameMode === 'single'
        ? (teamIdx === 0 ? 'YOUR TEAM' : 'CPU TEAM')
        : `TEAM ${teamIdx + 1}`;
      ctx.fillText(teamName, panelX + teamPanelWidth / 2, panelY + 13);
      ctx.restore();

      // Alive count - subtle
      ctx.fillStyle = '#555';
      ctx.font = '7px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`${aliveCount}/${ANTS_PER_TEAM}`, panelX + teamPanelWidth / 2, panelY + 22);

      // Separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 12, panelY + 25);
      ctx.lineTo(panelX + teamPanelWidth - 12, panelY + 25);
      ctx.stroke();

      // Individual ant health bars
      for (let i = 0; i < teamAnts.length; i++) {
        const ant = teamAnts[i];
        const row = Math.floor(i / barsPerRow);
        const col = i % barsPerRow;

        const gridWidth = barsPerRow * miniBarWidth + (barsPerRow - 1) * barSpacing;
        const gridOffsetX = (teamPanelWidth - gridWidth) / 2;
        const barX = panelX + gridOffsetX + col * (miniBarWidth + barSpacing);
        const barY = panelY + 29 + row * (miniBarHeight + rowSpacing);

        const antIndex = ant.playerIndex;
        if (this.hudHealthAnimations[antIndex]) {
          const anim = this.hudHealthAnimations[antIndex];
          anim.target = ant.health;
          const diff = anim.target - anim.current;
          anim.current += diff * 0.1;
          if (Math.abs(diff) < 0.1) anim.current = anim.target;
        }

        const animatedHealth = this.hudHealthAnimations[antIndex]?.current ?? ant.health;
        const healthPercent = animatedHealth / 100;
        const isCurrent = ant.playerIndex === currentPlayerIndex;
        const isDead = !ant.isAlive;

        // Bar background with inner shadow
        ctx.fillStyle = isDead ? 'rgba(10, 10, 10, 0.6)' : 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
        ctx.fill();

        if (!isDead) {
          let healthColor: string;
          if (healthPercent > 0.5) healthColor = '#4ECB71';
          else if (healthPercent > 0.25) healthColor = '#FFD93D';
          else healthColor = '#FF6B6B';

          // Bar fill with gradient
          const hBarGrad = ctx.createLinearGradient(0, barY, 0, barY + miniBarHeight);
          hBarGrad.addColorStop(0, healthColor);
          hBarGrad.addColorStop(1, healthColor + '88');
          ctx.fillStyle = hBarGrad;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth * healthPercent, miniBarHeight, 2);
          ctx.fill();

          // Tiny top highlight on bar fill
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          const fillW = miniBarWidth * healthPercent;
          if (fillW > 3) {
            ctx.fillRect(barX + 1, barY, fillW - 2, 1);
          }

          // Subtle bar outline
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
          ctx.stroke();
        }

        if (isCurrent && (state === 'PLAYING' || state === 'AI_THINKING')) {
          const pulse = 0.7 + 0.3 * Math.abs(Math.sin(Date.now() / 400));
          ctx.save();
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 5 * pulse;
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(barX - 1, barY - 1, miniBarWidth + 2, miniBarHeight + 2, 2);
          ctx.stroke();
          ctx.restore();
        } else if (isDead) {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
          ctx.stroke();

          // X mark
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(barX + 2, barY + 2);
          ctx.lineTo(barX + miniBarWidth - 2, barY + miniBarHeight - 2);
          ctx.moveTo(barX + miniBarWidth - 2, barY + 2);
          ctx.lineTo(barX + 2, barY + miniBarHeight - 2);
          ctx.stroke();
        }

        // Short name label under bar
        const shortName = ant.name.split(' ').pop() || `${i + 1}`;
        ctx.fillStyle = isDead ? '#333' : (isCurrent ? '#FFD700' : '#666');
        ctx.font = isCurrent ? 'bold 7px "Courier New"' : '7px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(shortName, barX + miniBarWidth / 2, barY + miniBarHeight + 8);
      }
    }
  }

  renderIntroPanOverlay(
    ctx: CanvasRenderingContext2D,
    introPanPhase: number,
    introPanTimer: number,
    ants: Ant[],
    gameMode: GameMode,
    cameraSystem: CameraSystem
  ): void {
    ctx.save();

    let alpha = 1;
    if (introPanPhase === 0 && introPanTimer < 0.5) {
      alpha = introPanTimer / 0.5;
    } else if (introPanPhase === 1 && introPanTimer > 2.5) {
      alpha = (3.0 - introPanTimer) / 0.5;
    }

    ctx.globalAlpha = alpha;

    // --- Cinematic banner ---
    const bannerY = 15;
    const bannerH = 65;

    // Gradient background (fades at top/bottom edges)
    const bgGrad = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerH);
    bgGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bgGrad.addColorStop(0.15, 'rgba(0, 0, 0, 0.85)');
    bgGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.85)');
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, bannerY, BASE_WIDTH, bannerH);

    // Gold decorative lines
    const lineGrad = ctx.createLinearGradient(40, 0, BASE_WIDTH - 40, 0);
    lineGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
    lineGrad.addColorStop(0.15, 'rgba(255, 215, 0, 0.6)');
    lineGrad.addColorStop(0.85, 'rgba(255, 215, 0, 0.6)');
    lineGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, bannerY + 10);
    ctx.lineTo(BASE_WIDTH - 40, bannerY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, bannerY + bannerH - 10);
    ctx.lineTo(BASE_WIDTH - 40, bannerY + bannerH - 10);
    ctx.stroke();

    // Small diamond decorations on the lines
    ctx.fillStyle = '#FFD700';
    for (const dx of [-120, 120]) {
      for (const ly of [bannerY + 10, bannerY + bannerH - 10]) {
        const cx = BASE_WIDTH / 2 + dx;
        ctx.beginPath();
        ctx.moveTo(cx, ly - 3);
        ctx.lineTo(cx + 3, ly);
        ctx.lineTo(cx, ly + 3);
        ctx.lineTo(cx - 3, ly);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Main text with glow
    const textCenterY = bannerY + bannerH / 2;
    if (introPanPhase === 1) {
      // "GET READY!" - larger with animated pulse
      const pulse = 1 + 0.04 * Math.sin(Date.now() / 150);
      ctx.save();
      ctx.translate(BASE_WIDTH / 2, textCenterY);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 34px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GET READY!', 0, 0);
      ctx.shadowBlur = 0;
      // White inner highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText('GET READY!', 0, 0);
      ctx.restore();
    } else {
      // "BATTLE OVERVIEW"
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 26px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BATTLE OVERVIEW', BASE_WIDTH / 2, textCenterY);
      ctx.shadowBlur = 0;
    }

    // Team labels in world space (only during overview phase)
    if (introPanPhase === 0) {
      ctx.restore();
      ctx.save();

      cameraSystem.applyTransform(ctx, 1.0);

      for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
        const teamAnts = ants.filter(a => a.teamIndex === teamIdx);
        const firstAnt = teamAnts[0];
        const lastAnt = teamAnts[teamAnts.length - 1];
        const teamLabel = gameMode === 'single'
          ? (teamIdx === 0 ? 'YOUR TEAM' : 'CPU TEAM')
          : `TEAM ${teamIdx + 1}`;

        if (firstAnt) {
          // Badge with team-color glow
          ctx.save();
          ctx.shadowColor = TEAM_COLORS[teamIdx];
          ctx.shadowBlur = 12;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.beginPath();
          ctx.roundRect(firstAnt.x - 50, firstAnt.y - 78, 100, 30, 6);
          ctx.fill();

          ctx.strokeStyle = TEAM_COLORS[teamIdx];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(firstAnt.x - 50, firstAnt.y - 78, 100, 30, 6);
          ctx.stroke();
          ctx.restore();

          // Team color accent strip on top of badge
          ctx.fillStyle = TEAM_COLORS[teamIdx];
          ctx.fillRect(firstAnt.x - 44, firstAnt.y - 78, 88, 3);

          // Label text
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 13px "Courier New"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(teamLabel, firstAnt.x, firstAnt.y - 63);

          // Arrow pointing down
          ctx.fillStyle = TEAM_COLORS[teamIdx];
          ctx.beginPath();
          ctx.moveTo(firstAnt.x, firstAnt.y - 44);
          ctx.lineTo(firstAnt.x - 7, firstAnt.y - 51);
          ctx.lineTo(firstAnt.x + 7, firstAnt.y - 51);
          ctx.closePath();
          ctx.fill();
        }

        // Dashed connecting line between team ants
        if (teamAnts.length > 1 && lastAnt && firstAnt) {
          ctx.strokeStyle = TEAM_COLORS[teamIdx];
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.25;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(firstAnt.x, firstAnt.y - 30);
          ctx.lineTo(lastAnt.x, lastAnt.y - 30);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
    }

    ctx.restore();
  }

  renderTurnBanner(ctx: CanvasRenderingContext2D, currentAnt: Ant | null): void {
    if (this.turnBannerAlpha <= 0) return;

    ctx.save();

    const bannerWidth = 200;
    const bannerHeight = 40;
    const bannerX = BASE_WIDTH / 2 - bannerWidth / 2;

    // Slide-in from y:60 to y:90 with easing
    const eased = 1 - Math.pow(1 - this.turnBannerSlideProgress, 3);
    const bannerY = 60 + 30 * eased;

    ctx.globalAlpha = this.turnBannerAlpha;

    ctx.shadowColor = currentAnt?.color || '#fff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = currentAnt?.color || '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerWidth, bannerHeight, 8);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(this.turnBannerText, BASE_WIDTH / 2, bannerY + bannerHeight / 2 + 6);

    ctx.restore();
  }

  renderPowerMeter(
    ctx: CanvasRenderingContext2D,
    tank: Ant,
    power: number,
    isChargingPower: boolean
  ): void {
    if (!isChargingPower || !tank || !tank.isAlive) return;

    const meterRadius = 35;
    const meterX = tank.x;
    const meterY = tank.y - 60;

    ctx.save();

    const pulse = 0.7 + Math.sin(Date.now() / 100) * 0.3;
    ctx.shadowColor = power > 70 ? '#ff4444' : power > 40 ? '#ffaa00' : '#44ff44';
    ctx.shadowBlur = 15 * pulse;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(meterX, meterY, meterRadius, Math.PI, 0, false);
    ctx.stroke();

    let powerColor: string;
    if (power > 70) {
      powerColor = '#ff4444';
    } else if (power > 40) {
      powerColor = '#ffaa00';
    } else {
      powerColor = '#44ff44';
    }

    ctx.strokeStyle = powerColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    const powerAngle = Math.PI + (power / 100) * Math.PI;
    ctx.arc(meterX, meterY, meterRadius, Math.PI, powerAngle, false);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`${power}%`, meterX, meterY + 5);

    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Courier New"';
    ctx.fillText('POWER', meterX, meterY + 18);

    ctx.restore();
  }

  renderMovementEnergy(
    ctx: CanvasRenderingContext2D,
    tank: Ant,
    isCurrentPlayer: boolean
  ): void {
    if (!isCurrentPlayer || !tank || !tank.isAlive) return;
    if (tank.movementBarAlpha <= 0) return;

    const barWidth = 50;
    const barHeight = 6;
    const barX = tank.x - barWidth / 2;
    const barY = tank.y + 8;

    const energyRatio = tank.movementEnergy / MAX_MOVEMENT_ENERGY;
    const alpha = tank.movementBarAlpha;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    let energyColor: string;
    if (energyRatio > 0.5) {
      energyColor = '#4EA8DE';
    } else if (energyRatio > 0.25) {
      energyColor = '#FFD93D';
    } else {
      energyColor = '#FF6B6B';
    }

    ctx.fillStyle = energyColor;
    ctx.fillRect(barX, barY, barWidth * energyRatio, barHeight);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '8px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('MOVE', tank.x, barY + barHeight + 8);

    ctx.restore();
  }
}
