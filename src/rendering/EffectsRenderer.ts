import { MAP_WIDTH, MAP_HEIGHT } from '../constants.ts';
import { ConfettiParticle, Firework, FloatingText } from '../types/GameTypes.ts';

export class EffectsRenderer {
  renderConfetti(ctx: CanvasRenderingContext2D, confetti: ConfettiParticle[]): void {
    for (const particle of confetti) {
      const alpha = Math.min(1, particle.life);
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      ctx.restore();
    }
  }

  renderFireworks(ctx: CanvasRenderingContext2D, fireworks: Firework[]): void {
    for (const firework of fireworks) {
      if (!firework.exploded) {
        // Draw rising firework with trail
        ctx.fillStyle = firework.color;
        ctx.beginPath();
        ctx.arc(firework.x, firework.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.strokeStyle = firework.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(firework.x, firework.y);
        ctx.lineTo(firework.x, firework.y + 30);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // Draw sparks with trails
        for (const spark of firework.sparks) {
          const alpha = Math.min(1, spark.life);

          // Draw trail
          if (spark.trail.length > 1) {
            for (let i = 1; i < spark.trail.length; i++) {
              const trailAlpha = alpha * (i / spark.trail.length) * 0.5;
              ctx.strokeStyle = spark.color;
              ctx.globalAlpha = trailAlpha;
              ctx.lineWidth = spark.size * (i / spark.trail.length);
              const prev = spark.trail.get(i - 1)!;
              const curr = spark.trail.get(i)!;
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(curr.x, curr.y);
              ctx.stroke();
            }
          }

          // Draw spark head with glow
          ctx.globalAlpha = alpha * 0.3;
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size * 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = alpha;
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  renderFloatingTexts(ctx: CanvasRenderingContext2D, floatingTexts: FloatingText[]): void {
    for (const ft of floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = `${ft.isCritical ? 'bold ' : ''}${Math.round(14 * ft.scale)}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  renderScreenFlash(
    ctx: CanvasRenderingContext2D,
    intensity: number,
    color: string
  ): void {
    if (intensity > 0) {
      ctx.fillStyle = color;
      ctx.globalAlpha = intensity;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.globalAlpha = 1;
    }
  }
}
