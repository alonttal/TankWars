import { BASE_WIDTH, BASE_HEIGHT, NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS, WIND_STRENGTH_MAX, MAX_MOVEMENT_ENERGY } from '../constants.ts';
import { GameMode, HUDHealthAnimation } from '../types/GameTypes.ts';
import { Ant } from '../Ant.ts';
import { CameraSystem } from '../systems/CameraSystem.ts';
import { POWERUP_CONFIGS } from '../powerups/PowerUpTypes.ts';
import { WEAPON_CONFIGS } from '../weapons/WeaponTypes.ts';

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

  renderTurnInfoPanel(
    ctx: CanvasRenderingContext2D,
    turnTimeRemaining: number,
    maxTurnTime: number,
    currentAnt: Ant | null,
    state: string
  ): void {
    const panelW = 240;
    const panelH = 50;
    const panelX = BASE_WIDTH / 2 - panelW / 2;
    const panelY = 4;

    ctx.save();

    const teamColor = currentAnt?.color || '#fff';

    // Panel background with team-color glow
    ctx.shadowColor = teamColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Team color accent strip along top
    ctx.fillStyle = teamColor;
    ctx.fillRect(panelX + 6, panelY, panelW - 12, 3);

    // Border
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (state === 'AI_THINKING') {
      // AI thinking display
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Courier New"';
      ctx.textAlign = 'center';
      const dots = '.'.repeat(Math.floor((Date.now() / 300) % 4));
      ctx.fillText(`CPU Thinking${dots}`, BASE_WIDTH / 2, panelY + 22);

      // Animated glow bar
      const glowPhase = (Date.now() % 2000) / 2000;
      const gradient = ctx.createLinearGradient(panelX + 10, 0, panelX + panelW - 10, 0);
      gradient.addColorStop(Math.max(0, glowPhase - 0.2), 'transparent');
      gradient.addColorStop(glowPhase, 'rgba(136, 170, 255, 0.5)');
      gradient.addColorStop(Math.min(1, glowPhase + 0.2), 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(panelX + 10, panelY + 34, panelW - 20, 5, 2);
      ctx.fill();
    } else if (currentAnt) {
      // Ant name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(currentAnt.name, BASE_WIDTH / 2, panelY + 16);

      // Weapon name + ammo (with flash on change)
      const weaponConfig = WEAPON_CONFIGS[currentAnt.selectedWeapon];
      const ammo = currentAnt.getAmmo(currentAnt.selectedWeapon);
      const ammoStr = ammo === -1 ? '\u221E' : `${ammo}`;
      let weaponAlpha = 0.6;
      if (this.weaponChangeFlash > 0) {
        weaponAlpha = 0.6 + 0.4 * this.weaponChangeFlash;
      }
      ctx.save();
      ctx.globalAlpha = weaponAlpha;
      ctx.fillStyle = this.weaponChangeFlash > 0 ? '#FFD700' : '#aaa';
      ctx.font = '9px "Courier New"';
      ctx.fillText(`${weaponConfig.name} [${ammoStr}]`, BASE_WIDTH / 2, panelY + 27);
      ctx.restore();

      // Timer bar
      const timeRatio = turnTimeRemaining / maxTurnTime;
      let timerColor: string;
      if (timeRatio > 0.5) timerColor = '#4ECB71';
      else if (timeRatio > 0.25) timerColor = '#FFD93D';
      else timerColor = '#FF6B6B';

      const barX = panelX + 10;
      const barY = panelY + 33;
      const barW = panelW - 20;
      const barH = 10;

      // Bar background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();

      // Bar fill (pulse when <5s)
      let timerAlpha = 1;
      if (turnTimeRemaining < 5) {
        timerAlpha = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 150));
      }
      ctx.save();
      ctx.globalAlpha = timerAlpha;
      ctx.fillStyle = timerColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(barW * timeRatio, 0), barH, 3);
      ctx.fill();
      ctx.restore();

      // Seconds text on the bar
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
      const panelH = 80;

      const teamAnts = ants.filter(a => a.teamIndex === teamIdx);
      const aliveCount = teamAnts.filter(a => a.isAlive).length;
      const totalHealth = teamAnts.reduce((sum, a) => sum + (a.isAlive ? a.health : 0), 0);
      const maxHealth = teamAnts.length * 100;
      const healthRatio = totalHealth / maxHealth;

      ctx.save();

      // Panel background with team glow
      ctx.shadowColor = TEAM_COLORS[teamIdx];
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, teamPanelWidth, panelH, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Team color accent strip on inner edge
      ctx.fillStyle = TEAM_COLORS[teamIdx];
      if (isLeft) {
        ctx.fillRect(panelX, panelY + 6, 3, panelH - 12);
      } else {
        ctx.fillRect(panelX + teamPanelWidth - 3, panelY + 6, 3, panelH - 12);
      }

      // Border
      ctx.strokeStyle = TEAM_COLORS[teamIdx];
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, teamPanelWidth, panelH, 6);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();

      // Team name header
      const teamName = gameMode === 'single'
        ? (teamIdx === 0 ? 'YOUR TEAM' : 'CPU TEAM')
        : `TEAM ${teamIdx + 1}`;
      ctx.fillStyle = TEAM_COLORS[teamIdx];
      ctx.font = 'bold 9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(teamName, panelX + teamPanelWidth / 2, panelY + 12);

      // Alive count
      ctx.fillStyle = '#666';
      ctx.font = '7px "Courier New"';
      ctx.fillText(`${aliveCount}/${ANTS_PER_TEAM}`, panelX + teamPanelWidth / 2, panelY + 21);

      // Aggregate team health bar
      const aggBarX = panelX + 10;
      const aggBarY = panelY + 25;
      const aggBarW = teamPanelWidth - 20;
      const aggBarH = 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(aggBarX, aggBarY, aggBarW, aggBarH, 2);
      ctx.fill();

      let aggColor: string;
      if (healthRatio > 0.5) aggColor = '#4ECB71';
      else if (healthRatio > 0.25) aggColor = '#FFD93D';
      else aggColor = '#FF6B6B';

      ctx.fillStyle = aggColor;
      ctx.beginPath();
      ctx.roundRect(aggBarX, aggBarY, Math.max(aggBarW * healthRatio, 0), aggBarH, 2);
      ctx.fill();

      // Individual ant health bars
      for (let i = 0; i < teamAnts.length; i++) {
        const ant = teamAnts[i];
        const row = Math.floor(i / barsPerRow);
        const col = i % barsPerRow;

        const barX = panelX + 8 + col * (miniBarWidth + barSpacing);
        const barY = panelY + 34 + row * (miniBarHeight + rowSpacing);

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

        ctx.fillStyle = isDead ? '#1a1a1a' : '#333';
        ctx.beginPath();
        ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
        ctx.fill();

        if (!isDead) {
          let healthColor: string;
          if (healthPercent > 0.5) healthColor = '#4ECB71';
          else if (healthPercent > 0.25) healthColor = '#FFD93D';
          else healthColor = '#FF6B6B';

          ctx.fillStyle = healthColor;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth * healthPercent, miniBarHeight, 2);
          ctx.fill();
        }

        if (isCurrent && (state === 'PLAYING' || state === 'AI_THINKING')) {
          const pulse = 0.7 + 0.3 * Math.abs(Math.sin(Date.now() / 400));
          ctx.save();
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 4 * pulse;
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(barX - 1, barY - 1, miniBarWidth + 2, miniBarHeight + 2, 2);
          ctx.stroke();
          ctx.restore();
        } else if (isDead) {
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
          ctx.stroke();

          ctx.strokeStyle = '#555';
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
        ctx.fillStyle = isDead ? '#444' : (isCurrent ? '#FFD700' : '#777');
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
