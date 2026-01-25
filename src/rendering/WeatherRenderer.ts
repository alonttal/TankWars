import { MAP_WIDTH, MAP_HEIGHT, BASE_WIDTH, BASE_HEIGHT } from '../constants.ts';
import { WeatherSystem } from '../systems/WeatherSystem.ts';

export class WeatherRenderer {
  // Animation time for procedural effects
  private animationTime: number = 0;

  // Render weather particles in BACKGROUND layer (behind terrain and ants)
  renderWeatherBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
    this.animationTime += 0.016; // ~60fps

    const activeWeather = weather.getTransitionProgress() >= 0.5
      ? weather.getTargetConfig().type
      : weather.getCurrentConfig().type;

    const alpha = weather.getTransitionProgress() >= 0.5
      ? (weather.getTransitionProgress() - 0.5) * 2
      : 1 - weather.getTransitionProgress() * 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0.1, alpha);

    switch (activeWeather) {
      case 'rain':
        this.renderRainBackground(ctx, weather, wind);
        break;
      case 'snow':
        this.renderSnowBackground(ctx, weather);
        break;
      case 'fog':
        this.renderFogBackground(ctx, weather);
        break;
      case 'sandstorm':
        this.renderSandBackground(ctx, weather, wind);
        break;
    }

    ctx.restore();
  }

  // Render weather particles in FOREGROUND layer (in front of terrain and ants)
  renderWeatherForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
    const activeWeather = weather.getTransitionProgress() >= 0.5
      ? weather.getTargetConfig().type
      : weather.getCurrentConfig().type;

    const alpha = weather.getTransitionProgress() >= 0.5
      ? (weather.getTransitionProgress() - 0.5) * 2
      : 1 - weather.getTransitionProgress() * 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0.1, alpha);

    switch (activeWeather) {
      case 'rain':
        this.renderRainForeground(ctx, weather, wind);
        break;
      case 'snow':
        this.renderSnowForeground(ctx, weather);
        break;
      case 'fog':
        this.renderFogForeground(ctx, weather);
        break;
      case 'sandstorm':
        this.renderSandForeground(ctx, weather, wind);
        break;
    }

    // Render lightning (always on top)
    this.renderLightning(ctx, weather);

    ctx.restore();
  }

  // ===== RAIN =====
  private renderRainBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
    const windAngle = Math.atan2(1, wind * 0.12);

    // Distant rain atmosphere - darker, moodier
    ctx.save();
    ctx.globalAlpha = 0.25;
    const rainGradient = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT);
    rainGradient.addColorStop(0, 'rgba(60, 70, 90, 0.1)');
    rainGradient.addColorStop(0.4, 'rgba(70, 80, 100, 0.3)');
    rainGradient.addColorStop(1, 'rgba(50, 60, 80, 0.4)');
    ctx.fillStyle = rainGradient;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();

    // Background rain (distant, smaller, fainter) - only 40% of drops
    const bgDrops = weather.rainDrops.filter((_, i) => i % 5 < 2);
    for (const drop of bgDrops) {
      const thickness = 0.5 + (drop.speed / 600) * 0.3;
      const length = drop.length * 0.5; // Shorter drops in background

      ctx.save();
      ctx.globalAlpha = drop.opacity * 0.3;
      ctx.strokeStyle = 'rgba(150, 170, 200, 0.5)';
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';

      const endX = drop.x + Math.cos(windAngle - Math.PI / 2) * length * 0.4;
      const endY = drop.y + length;

      ctx.beginPath();
      ctx.moveTo(drop.x * 0.95, drop.y); // Slight parallax offset
      ctx.lineTo(endX * 0.95, endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderRainForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
    const windAngle = Math.atan2(1, wind * 0.12);
    const windStrength = Math.abs(wind);

    // Foreground rain (closer, sharper) - 60% of drops
    const fgDrops = weather.rainDrops.filter((_, i) => i % 5 >= 2);
    for (const drop of fgDrops) {
      // Much thinner drops
      const thickness = 0.8 + (drop.speed / 600) * 0.4;
      const length = drop.length * 0.7; // Slightly shorter

      const endX = drop.x + Math.cos(windAngle - Math.PI / 2) * length * (0.3 + windStrength * 0.015);
      const endY = drop.y + length;

      // Subtle glow for nearby drops
      ctx.save();
      ctx.globalAlpha = drop.opacity * 0.15;
      ctx.strokeStyle = '#A0C0E0';
      ctx.lineWidth = thickness + 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();

      // Rain drop core - thin line
      ctx.save();
      ctx.globalAlpha = drop.opacity * 0.7;
      ctx.strokeStyle = 'rgba(180, 200, 230, 0.8)';
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }

    // Splash effects - smaller and subtler
    for (const drop of weather.rainDrops) {
      if (drop.y > MAP_HEIGHT - 60 && drop.y < MAP_HEIGHT) {
        const splashProgress = (drop.y - (MAP_HEIGHT - 60)) / 60;
        const splashSize = 1 + splashProgress * 4;
        const splashOpacity = (1 - splashProgress) * drop.opacity * 0.4;

        // Small splash ring
        ctx.save();
        ctx.globalAlpha = splashOpacity;
        ctx.strokeStyle = 'rgba(160, 180, 210, 0.6)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(drop.x, MAP_HEIGHT - 3, splashSize, splashSize * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Subtle wet ground effect
    ctx.save();
    ctx.globalAlpha = 0.1;
    const wetGround = ctx.createLinearGradient(0, MAP_HEIGHT - 20, 0, MAP_HEIGHT);
    wetGround.addColorStop(0, 'rgba(80, 100, 130, 0)');
    wetGround.addColorStop(1, 'rgba(80, 100, 130, 0.3)');
    ctx.fillStyle = wetGround;
    ctx.fillRect(0, MAP_HEIGHT - 20, MAP_WIDTH, 20);
    ctx.restore();
  }

  // ===== SNOW =====
  private renderSnowBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem): void {
    // Soft wintery atmosphere
    ctx.save();
    ctx.globalAlpha = 0.08;
    const snowAir = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT);
    snowAir.addColorStop(0, 'rgba(200, 210, 230, 0.2)');
    snowAir.addColorStop(1, 'rgba(180, 190, 210, 0.1)');
    ctx.fillStyle = snowAir;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();

    // Background snowflakes (distant, smaller, blurred) - 40% of flakes
    const bgFlakes = weather.snowflakes.filter((_, i) => i % 5 < 2);
    for (const flake of bgFlakes) {
      ctx.save();
      ctx.translate(flake.x * 0.97, flake.y); // Slight parallax
      ctx.globalAlpha = flake.opacity * 0.3;

      const size = flake.size * 0.4; // Much smaller in background

      // Simple dot for distant flakes
      ctx.fillStyle = 'rgba(220, 230, 245, 0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderSnowForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem): void {
    // Foreground snowflakes (closer, detailed) - 60% of flakes
    const fgFlakes = weather.snowflakes.filter((_, i) => i % 5 >= 2);
    for (const flake of fgFlakes) {
      ctx.save();
      ctx.translate(flake.x, flake.y);
      ctx.rotate(flake.rotation);
      ctx.globalAlpha = flake.opacity * 0.8;

      // Smaller flakes overall
      const size = flake.size * 0.6;

      // Subtle glow
      const sparkle = 0.6 + Math.sin(this.animationTime * 2 + flake.wobblePhase) * 0.4;
      ctx.fillStyle = `rgba(220, 235, 255, ${0.15 * sparkle})`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Simple 6-pointed star - thinner lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = Math.max(0.3, size * 0.1);
      ctx.lineCap = 'round';

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
        ctx.stroke();

        // Single small branch per arm
        const branchDist = size * 0.55;
        const branchLen = size * 0.25;
        const branchX = Math.cos(angle) * branchDist;
        const branchY = Math.sin(angle) * branchDist;

        ctx.beginPath();
        ctx.moveTo(branchX, branchY);
        ctx.lineTo(branchX + Math.cos(angle + 0.6) * branchLen, branchY + Math.sin(angle + 0.6) * branchLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(branchX, branchY);
        ctx.lineTo(branchX + Math.cos(angle - 0.6) * branchLen, branchY + Math.sin(angle - 0.6) * branchLen);
        ctx.stroke();
      }

      // Center dot
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Snow accumulation at ground - subtle
    ctx.save();
    ctx.globalAlpha = 0.15;
    const snowGround = ctx.createLinearGradient(0, MAP_HEIGHT - 30, 0, MAP_HEIGHT);
    snowGround.addColorStop(0, 'rgba(255, 255, 255, 0)');
    snowGround.addColorStop(0.6, 'rgba(240, 245, 255, 0.2)');
    snowGround.addColorStop(1, 'rgba(230, 240, 255, 0.35)');
    ctx.fillStyle = snowGround;
    ctx.fillRect(0, MAP_HEIGHT - 30, MAP_WIDTH, 30);
    ctx.restore();
  }

  // ===== FOG =====
  private renderFogBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem): void {
    // Sort by depth - render far layers in background
    const farLayers = weather.fogLayers.filter(l => l.depth < 0.5).sort((a, b) => a.depth - b.depth);

    for (const layer of farLayers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity * 0.7;

      // Animate position slowly
      const animX = layer.x + Math.sin(this.animationTime * 0.15 + layer.depth * 3) * (30 * (1 - layer.depth));
      const animY = layer.y + Math.cos(this.animationTime * 0.1 + layer.depth * 2) * (15 * (1 - layer.depth));

      // Softer, more diffuse fog clouds
      const gradient = ctx.createRadialGradient(
        animX, animY, 0,
        animX, animY, Math.max(layer.width, layer.height) * 0.6
      );

      const brightness = 180 + Math.floor(layer.depth * 40);
      gradient.addColorStop(0, `rgba(${brightness}, ${brightness + 10}, ${brightness + 20}, 0.4)`);
      gradient.addColorStop(0.4, `rgba(${brightness - 10}, ${brightness}, ${brightness + 10}, 0.2)`);
      gradient.addColorStop(1, 'rgba(160, 170, 185, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(animX, animY, layer.width * 0.6, layer.height * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Subtle overall haze
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = 'rgba(180, 190, 205, 0.3)';
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();
  }

  private renderFogForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem): void {
    // Near fog layers in foreground
    const nearLayers = weather.fogLayers.filter(l => l.depth >= 0.5).sort((a, b) => a.depth - b.depth);

    for (const layer of nearLayers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity * 0.5;

      // Faster animation for near layers
      const animX = layer.x + Math.sin(this.animationTime * 0.25 + layer.depth * 4) * (40 * layer.depth);
      const animY = layer.y + Math.cos(this.animationTime * 0.18 + layer.depth * 3) * (20 * layer.depth);

      const gradient = ctx.createRadialGradient(
        animX, animY, 0,
        animX, animY, Math.max(layer.width, layer.height) * 0.5
      );

      gradient.addColorStop(0, 'rgba(200, 210, 225, 0.35)');
      gradient.addColorStop(0.5, 'rgba(190, 200, 215, 0.15)');
      gradient.addColorStop(1, 'rgba(180, 190, 205, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(animX, animY, layer.width * 0.5, layer.height * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Ground fog - rolling wisps
    ctx.save();
    const groundFogGradient = ctx.createLinearGradient(0, MAP_HEIGHT * 0.6, 0, MAP_HEIGHT);
    groundFogGradient.addColorStop(0, 'rgba(180, 190, 205, 0)');
    groundFogGradient.addColorStop(0.4, 'rgba(175, 185, 200, 0.15)');
    groundFogGradient.addColorStop(0.7, 'rgba(170, 180, 195, 0.3)');
    groundFogGradient.addColorStop(1, 'rgba(165, 175, 190, 0.4)');
    ctx.fillStyle = groundFogGradient;
    ctx.fillRect(0, MAP_HEIGHT * 0.6, MAP_WIDTH, MAP_HEIGHT * 0.4);
    ctx.restore();

    // Wispy fog tendrils at ground
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = 'rgba(190, 200, 215, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, MAP_HEIGHT);
    for (let x = 0; x <= MAP_WIDTH; x += 30) {
      const y = MAP_HEIGHT - 40 + Math.sin(x * 0.008 + this.animationTime * 0.5) * 15
        + Math.sin(x * 0.015 - this.animationTime * 0.3) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(MAP_WIDTH, MAP_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Drifting fog patches in foreground
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 3; i++) {
      const patchX = (MAP_WIDTH * 0.25) * i + Math.sin(this.animationTime * 0.2 + i * 2) * 80;
      const patchY = MAP_HEIGHT * 0.4 + Math.cos(this.animationTime * 0.15 + i) * 40;

      const patchGradient = ctx.createRadialGradient(patchX, patchY, 0, patchX, patchY, 150);
      patchGradient.addColorStop(0, 'rgba(200, 210, 220, 0.3)');
      patchGradient.addColorStop(1, 'rgba(190, 200, 210, 0)');

      ctx.fillStyle = patchGradient;
      ctx.beginPath();
      ctx.ellipse(patchX, patchY, 180, 80, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ===== SANDSTORM =====
  private renderSandBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
    const windDir = wind > 0 ? 1 : -1;

    // Dusty atmosphere
    ctx.save();
    ctx.globalAlpha = 0.25;
    const dustSky = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT);
    dustSky.addColorStop(0, 'rgba(170, 130, 70, 0.15)');
    dustSky.addColorStop(0.5, 'rgba(190, 145, 85, 0.3)');
    dustSky.addColorStop(1, 'rgba(170, 125, 65, 0.4)');
    ctx.fillStyle = dustSky;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();

    // Background turbulence stripes
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const baseY = (MAP_HEIGHT / 5) * i;
      const waveOffset = Math.sin(this.animationTime * 1.5 + i * 0.8) * 30;
      const y = baseY + waveOffset;

      ctx.globalAlpha = 0.08 + Math.sin(this.animationTime * 0.8 + i) * 0.03;
      const stripeGradient = ctx.createLinearGradient(0, y - 25, 0, y + 25);
      stripeGradient.addColorStop(0, 'rgba(190, 145, 75, 0)');
      stripeGradient.addColorStop(0.5, 'rgba(200, 155, 85, 0.2)');
      stripeGradient.addColorStop(1, 'rgba(190, 145, 75, 0)');

      ctx.fillStyle = stripeGradient;
      ctx.fillRect(0, y - 25, MAP_WIDTH, 50);
    }
    ctx.restore();

    // Distant dust clouds
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 3; i++) {
      const cloudX = (MAP_WIDTH / 2.5) * i + Math.sin(this.animationTime * 0.4 + i) * 60 * windDir;
      const cloudY = MAP_HEIGHT * 0.35 + Math.cos(this.animationTime * 0.25 + i * 2) * 40;

      const dustCloud = ctx.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, 180);
      dustCloud.addColorStop(0, 'rgba(190, 150, 95, 0.4)');
      dustCloud.addColorStop(0.6, 'rgba(180, 140, 85, 0.2)');
      dustCloud.addColorStop(1, 'rgba(170, 130, 75, 0)');

      ctx.fillStyle = dustCloud;
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY, 220, 100, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Background sand particles (40%)
    const bgParticles = weather.sandParticles.filter((_, i) => i % 5 < 2);
    for (const particle of bgParticles) {
      ctx.save();
      ctx.globalAlpha = particle.opacity * 0.3;
      ctx.fillStyle = '#B89860';
      ctx.beginPath();
      ctx.arc(particle.x * 0.96, particle.y, particle.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderSandForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, _wind: number): void {

    // Foreground sand particles with trails (60%)
    const fgParticles = weather.sandParticles.filter((_, i) => i % 5 >= 2);
    for (const particle of fgParticles) {
      // Motion blur trail
      if (particle.trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';

        for (let i = 1; i < particle.trail.length; i++) {
          const trailAlpha = (i / particle.trail.length) * particle.opacity * 0.25;
          const trailSize = particle.size * (0.2 + (i / particle.trail.length) * 0.5);

          ctx.globalAlpha = trailAlpha;
          ctx.strokeStyle = `rgba(200, 160, 96, ${trailAlpha})`;
          ctx.lineWidth = trailSize;
          ctx.beginPath();
          ctx.moveTo(particle.trail[i - 1].x, particle.trail[i - 1].y);
          ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Particle with subtle glow
      ctx.save();
      ctx.globalAlpha = particle.opacity * 0.2;
      ctx.fillStyle = '#D8B070';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = particle.opacity * 0.8;
      ctx.fillStyle = '#C8A060';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Foreground turbulence overlay
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = MAP_HEIGHT * (0.2 + i * 0.3) + Math.sin(this.animationTime * 2.5 + i) * 25;
      ctx.globalAlpha = 0.06;
      const fgStripe = ctx.createLinearGradient(0, y - 20, 0, y + 20);
      fgStripe.addColorStop(0, 'rgba(210, 165, 100, 0)');
      fgStripe.addColorStop(0.5, 'rgba(220, 175, 110, 0.25)');
      fgStripe.addColorStop(1, 'rgba(210, 165, 100, 0)');
      ctx.fillStyle = fgStripe;
      ctx.fillRect(0, y - 20, MAP_WIDTH, 40);
    }
    ctx.restore();

    // Sand accumulation at ground
    ctx.save();
    ctx.globalAlpha = 0.2;
    const sandGround = ctx.createLinearGradient(0, MAP_HEIGHT - 50, 0, MAP_HEIGHT);
    sandGround.addColorStop(0, 'rgba(200, 160, 100, 0)');
    sandGround.addColorStop(0.5, 'rgba(210, 170, 110, 0.25)');
    sandGround.addColorStop(1, 'rgba(190, 150, 90, 0.4)');
    ctx.fillStyle = sandGround;
    ctx.fillRect(0, MAP_HEIGHT - 50, MAP_WIDTH, 50);
    ctx.restore();
  }

  // ===== LIGHTNING =====
  private renderLightning(ctx: CanvasRenderingContext2D, weather: WeatherSystem): void {
    for (const bolt of weather.lightning) {
      ctx.save();
      ctx.globalAlpha = bolt.opacity;

      // Outer glow
      ctx.strokeStyle = 'rgba(150, 180, 255, 0.3)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      for (const segment of bolt.segments) {
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
      }
      ctx.stroke();

      // Middle glow
      ctx.strokeStyle = 'rgba(200, 215, 255, 0.5)';
      ctx.lineWidth = 5;

      ctx.beginPath();
      for (const segment of bolt.segments) {
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
      }
      ctx.stroke();

      // Bright core
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;

      ctx.beginPath();
      for (const segment of bolt.segments) {
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  // ===== ATMOSPHERE & VISIBILITY =====
  renderAtmosphereOverlay(ctx: CanvasRenderingContext2D, weather: WeatherSystem): void {
    const alpha = weather.getInterpolatedAtmosphereAlpha();
    if (alpha <= 0) return;

    const targetConfig = weather.getTargetConfig();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = targetConfig.atmosphereColor;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();

    // Lightning flash
    if (weather.lightningFlash > 0) {
      ctx.save();
      ctx.globalAlpha = weather.lightningFlash * 0.35;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      ctx.globalAlpha = weather.lightningFlash * 0.1;
      ctx.fillStyle = '#A0C0FF';
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      ctx.restore();
    }
  }

  renderVisibilityMask(
    ctx: CanvasRenderingContext2D,
    weather: WeatherSystem,
    focusX: number,
    focusY: number
  ): void {
    const visibility = weather.getInterpolatedVisibility();
    if (visibility >= 1.0) return;

    const baseRadius = Math.max(BASE_WIDTH, BASE_HEIGHT) * 0.7;
    const visibleRadius = baseRadius * visibility;
    const fadeRadius = visibleRadius * 1.8;

    const gradient = ctx.createRadialGradient(
      focusX, focusY, visibleRadius * 0.5,
      focusX, focusY, fadeRadius
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.4, `rgba(0, 0, 0, ${0.12 * (1 - visibility)})`);
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${0.3 * (1 - visibility)})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${0.5 * (1 - visibility)})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    ctx.restore();
  }

  // ===== WEATHER INDICATOR =====
  renderWeatherIndicator(
    ctx: CanvasRenderingContext2D,
    weather: WeatherSystem,
    x: number,
    y: number
  ): void {
    const size = 24;
    const currentType = weather.currentWeather;

    ctx.save();
    ctx.translate(x, y);

    // Background
    const bgGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2 + 4);
    bgGradient.addColorStop(0, 'rgba(40, 40, 50, 0.7)');
    bgGradient.addColorStop(1, 'rgba(20, 20, 30, 0.8)');
    ctx.fillStyle = bgGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size / 2 + 4, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(this.animationTime * 2) * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    switch (currentType) {
      case 'clear':
        const sunPulse = 1 + Math.sin(this.animationTime * 3) * 0.1;
        ctx.fillStyle = '#FFE066';
        ctx.beginPath();
        ctx.arc(0, 0, 5 * sunPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + this.animationTime * 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * 7, Math.sin(angle) * 7);
          ctx.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
          ctx.stroke();
        }
        break;

      case 'rain':
        // Dark cloud
        ctx.fillStyle = '#707888';
        ctx.beginPath();
        ctx.arc(-3, -3, 5, 0, Math.PI * 2);
        ctx.arc(4, -2, 6, 0, Math.PI * 2);
        ctx.fill();
        // Rain drops
        ctx.strokeStyle = '#6090C0';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const dropY = 4 + ((this.animationTime * 25 + i * 8) % 7);
          ctx.globalAlpha = 1 - (dropY - 4) / 7;
          ctx.beginPath();
          ctx.moveTo(-5 + i * 5, dropY);
          ctx.lineTo(-5.5 + i * 5, dropY + 2.5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;

      case 'fog':
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.3 + i * 0.2;
          ctx.beginPath();
          const waveOffset = Math.sin(this.animationTime * 1.5 + i * 0.8) * 2;
          ctx.moveTo(-9 + waveOffset, -4 + i * 4);
          ctx.quadraticCurveTo(0, -5.5 + i * 4 + waveOffset * 0.5, 9 + waveOffset, -4 + i * 4);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;

      case 'snow':
        ctx.save();
        ctx.rotate(this.animationTime * 0.4);
        ctx.strokeStyle = '#E0E8F0';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * 7, Math.sin(angle) * 7);
          ctx.stroke();
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      case 'sandstorm':
        ctx.strokeStyle = '#D0A050';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const offset = Math.sin(this.animationTime * 3 + i) * 2;
          ctx.globalAlpha = 0.4 + i * 0.15;
          ctx.beginPath();
          ctx.moveTo(-10 + offset, -4 + i * 2.5);
          ctx.bezierCurveTo(-3, -6 + i * 2.5, 3, -2 + i * 2.5, 10 + offset, -4 + i * 2.5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
    }

    ctx.restore();
  }

  // Legacy method for backward compatibility
  renderWeatherParticles(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
    this.renderWeatherBackground(ctx, weather, wind);
  }
}
