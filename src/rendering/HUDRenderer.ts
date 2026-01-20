import { BASE_WIDTH, NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS, WIND_STRENGTH_MAX } from '../constants.ts';
import { GameMode, HUDHealthAnimation } from '../types/GameTypes.ts';
import { Ant } from '../Ant.ts';
import { CameraSystem } from '../systems/CameraSystem.ts';

export class HUDRenderer {
  hudHealthAnimations: HUDHealthAnimation[] = [];

  // Turn banner state
  private turnBannerAlpha: number = 0;
  private turnBannerText: string = '';
  private turnBannerTimer: number = 0;

  initHealthAnimations(antCount: number): void {
    this.hudHealthAnimations = [];
    for (let i = 0; i < antCount; i++) {
      this.hudHealthAnimations.push({ current: 100, target: 100 });
    }
  }

  updateTurnBanner(deltaTime: number): void {
    if (this.turnBannerTimer > 0) {
      this.turnBannerTimer -= deltaTime;
      if (this.turnBannerTimer <= 0.5) {
        this.turnBannerAlpha = this.turnBannerTimer / 0.5; // Fade out in last 0.5s
      }
      if (this.turnBannerTimer <= 0) {
        this.turnBannerAlpha = 0;
      }
    }
  }

  showTurnBanner(text: string): void {
    this.turnBannerText = text;
    this.turnBannerAlpha = 1;
    this.turnBannerTimer = 2.0;
  }

  renderTurnTimer(
    ctx: CanvasRenderingContext2D,
    turnTimeRemaining: number,
    maxTurnTime: number
  ): void {
    const barWidth = 200;
    const barHeight = 12;
    const barX = BASE_WIDTH / 2 - barWidth / 2;
    const barY = 15;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    const timeRatio = turnTimeRemaining / maxTurnTime;
    const fillWidth = barWidth * timeRatio;

    let color: string;
    if (timeRatio > 0.5) {
      color = '#4ECB71';
    } else if (timeRatio > 0.25) {
      color = '#FFD93D';
    } else {
      color = '#FF6B6B';
    }

    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(turnTimeRemaining)}s`, BASE_WIDTH / 2, barY + barHeight + 12);
  }

  renderAIThinking(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(BASE_WIDTH / 2 - 100, 20, 200, 40);

    ctx.fillStyle = '#fff';
    ctx.font = '16px "Courier New"';
    ctx.textAlign = 'center';

    const dots = '.'.repeat(Math.floor((Date.now() / 300) % 4));
    ctx.fillText(`CPU Thinking${dots}`, BASE_WIDTH / 2, 45);
  }

  renderWindArrow(ctx: CanvasRenderingContext2D, wind: number): void {
    const arrowX = BASE_WIDTH - 80;
    const arrowY = 50;
    const arrowLength = 40;
    const windStrength = Math.abs(wind) / WIND_STRENGTH_MAX;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(arrowX - 50, arrowY - 25, 100, 50);

    ctx.fillStyle = '#fff';
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('WIND', arrowX, arrowY - 12);

    ctx.font = 'bold 12px "Courier New"';
    ctx.fillText(Math.abs(Math.round(wind)).toString(), arrowX, arrowY + 20);

    if (Math.abs(wind) > 0.5) {
      const direction = wind > 0 ? 1 : -1;
      const scaledLength = arrowLength * windStrength;

      ctx.strokeStyle = windStrength > 0.6 ? '#FF6B6B' : windStrength > 0.3 ? '#FFD93D' : '#4ECB71';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(arrowX - scaledLength / 2 * direction, arrowY);
      ctx.lineTo(arrowX + scaledLength / 2 * direction, arrowY);
      ctx.stroke();

      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      const headX = arrowX + scaledLength / 2 * direction;
      ctx.moveTo(headX, arrowY);
      ctx.lineTo(headX - 8 * direction, arrowY - 6);
      ctx.lineTo(headX - 8 * direction, arrowY + 6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#666';
      ctx.font = '12px "Courier New"';
      ctx.fillText('CALM', arrowX, arrowY + 4);
    }
  }

  renderHUDHealthBars(
    ctx: CanvasRenderingContext2D,
    ants: Ant[],
    currentPlayerIndex: number,
    gameMode: GameMode,
    state: string
  ): void {
    const padding = 10;
    const teamPanelWidth = 180;
    const miniBarWidth = 36;
    const miniBarHeight = 8;
    const barsPerRow = 4;
    const barSpacing = 4;
    const rowSpacing = 12;

    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx++) {
      const isLeft = teamIdx === 0;
      const panelX = isLeft ? padding : BASE_WIDTH - padding - teamPanelWidth;
      const panelY = 40;

      const teamAnts = ants.filter(a => a.teamIndex === teamIdx);
      const aliveCount = teamAnts.filter(a => a.isAlive).length;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, teamPanelWidth, 75, 5);
      ctx.fill();

      const teamLabel = gameMode === 'single'
        ? (teamIdx === 0 ? 'YOUR TEAM' : 'CPU TEAM')
        : `TEAM ${teamIdx + 1}`;
      ctx.fillStyle = TEAM_COLORS[teamIdx];
      ctx.font = 'bold 11px "Courier New"';
      ctx.textAlign = isLeft ? 'left' : 'right';
      ctx.fillText(teamLabel, isLeft ? panelX + 5 : panelX + teamPanelWidth - 5, panelY + 14);

      ctx.fillStyle = '#aaa';
      ctx.font = '10px "Courier New"';
      ctx.textAlign = isLeft ? 'right' : 'left';
      ctx.fillText(`${aliveCount}/${ANTS_PER_TEAM}`, isLeft ? panelX + teamPanelWidth - 5 : panelX + 5, panelY + 14);

      for (let i = 0; i < teamAnts.length; i++) {
        const ant = teamAnts[i];
        const row = Math.floor(i / barsPerRow);
        const col = i % barsPerRow;

        const barX = panelX + 8 + col * (miniBarWidth + barSpacing);
        const barY = panelY + 24 + row * (miniBarHeight + rowSpacing);

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

        ctx.fillStyle = isDead ? '#222' : '#333';
        ctx.beginPath();
        ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
        ctx.fill();

        if (!isDead) {
          let healthColor: string;
          if (healthPercent > 0.5) {
            healthColor = '#4ECB71';
          } else if (healthPercent > 0.25) {
            healthColor = '#FFD93D';
          } else {
            healthColor = '#FF6B6B';
          }

          ctx.fillStyle = healthColor;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth * healthPercent, miniBarHeight, 2);
          ctx.fill();
        }

        if (isCurrent && (state === 'PLAYING' || state === 'AI_THINKING')) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(barX - 1, barY - 1, miniBarWidth + 2, miniBarHeight + 2, 2);
          ctx.stroke();
        } else if (isDead) {
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(barX, barY, miniBarWidth, miniBarHeight, 2);
          ctx.stroke();

          ctx.strokeStyle = '#666';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(barX + 2, barY + 2);
          ctx.lineTo(barX + miniBarWidth - 2, barY + miniBarHeight - 2);
          ctx.moveTo(barX + miniBarWidth - 2, barY + 2);
          ctx.lineTo(barX + 2, barY + miniBarHeight - 2);
          ctx.stroke();
        }

        ctx.fillStyle = isDead ? '#444' : (isCurrent ? '#FFD700' : '#888');
        ctx.font = isCurrent ? 'bold 8px "Courier New"' : '8px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}`, barX + miniBarWidth / 2, barY + miniBarHeight + 8);
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

    const bannerText = introPanPhase === 0 ? 'BATTLE OVERVIEW' : 'GET READY!';

    let alpha = 1;
    if (introPanPhase === 0 && introPanTimer < 0.5) {
      alpha = introPanTimer / 0.5;
    } else if (introPanPhase === 1 && introPanTimer > 2.5) {
      alpha = (3.0 - introPanTimer) / 0.5;
    }

    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 30, BASE_WIDTH, 50);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bannerText, BASE_WIDTH / 2, 55);

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
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.roundRect(firstAnt.x - 45, firstAnt.y - 75, 90, 28, 6);
          ctx.fill();

          ctx.strokeStyle = TEAM_COLORS[teamIdx];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(firstAnt.x - 45, firstAnt.y - 75, 90, 28, 6);
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px "Courier New"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(teamLabel, firstAnt.x, firstAnt.y - 61);

          ctx.fillStyle = TEAM_COLORS[teamIdx];
          ctx.beginPath();
          ctx.moveTo(firstAnt.x, firstAnt.y - 47);
          ctx.lineTo(firstAnt.x - 6, firstAnt.y - 53);
          ctx.lineTo(firstAnt.x + 6, firstAnt.y - 53);
          ctx.closePath();
          ctx.fill();
        }

        if (teamAnts.length > 1 && lastAnt) {
          ctx.strokeStyle = TEAM_COLORS[teamIdx];
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(firstAnt.x, firstAnt.y - 30);
          ctx.lineTo(lastAnt.x, lastAnt.y - 30);
          ctx.stroke();
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
    const bannerY = 90;

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
}
