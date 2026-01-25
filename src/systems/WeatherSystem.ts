import { MAP_WIDTH, MAP_HEIGHT, TERRAIN_SCALE } from '../constants.ts';
import {
  WeatherType,
  WeatherConfig,
  RainDrop,
  Snowflake,
  FogLayer,
  SandParticle,
  LightningBolt,
  DamagingLightningStrike,
  LightningTelegraph,
  CinematicFocusRequest,
  WEATHER_CONFIGS,
  TERRAIN_WEATHER_COMPATIBILITY,
} from '../types/WeatherTypes.ts';
import { Ant } from '../Ant.ts';
import { Terrain } from '../Terrain.ts';

export class WeatherSystem {
  // Current weather state
  currentWeather: WeatherType = 'clear';
  private targetWeather: WeatherType = 'clear';
  private transitionProgress: number = 1.0; // 0 = start of transition, 1 = complete
  private transitionDuration: number = 2.0;

  // Turn tracking
  private turnsSinceChange: number = 0;
  private readonly minTurnsBeforeChange: number = 3;
  private readonly changeChance: number = 0.25;

  // Compatible weathers for current terrain
  private compatibleWeathers: WeatherType[] = ['clear'];

  // Particle arrays
  rainDrops: RainDrop[] = [];
  snowflakes: Snowflake[] = [];
  fogLayers: FogLayer[] = [];
  sandParticles: SandParticle[] = [];
  lightning: LightningBolt[] = [];

  // Lightning flash
  lightningFlash: number = 0;
  private shouldTriggerFlash: boolean = false;

  // Damaging lightning system
  damagingStrikes: DamagingLightningStrike[] = [];
  lightningTelegraphs: LightningTelegraph[] = [];
  private strikeCooldown: number = 0; // Cooldown in turns
  private pendingCinematicFocus: CinematicFocusRequest | null = null;

  // Lightning hazard constants
  private readonly MIN_STRIKE_COOLDOWN = 3; // Minimum turns between strikes
  private readonly TELEGRAPH_DURATION = 1.5; // seconds
  private readonly STRIKE_DAMAGE = 35;
  private readonly STRIKE_MIN_DAMAGE = 10;
  private readonly STRIKE_RADIUS = 50;
  private readonly CRATER_RADIUS = 20;
  private readonly CINEMATIC_DURATION = 2.5;
  private readonly CINEMATIC_ZOOM = 0.6;
  private readonly CINEMATIC_SHAKE = 18;

  setTerrainTheme(themeName: string): void {
    this.compatibleWeathers = TERRAIN_WEATHER_COMPATIBILITY[themeName] || ['clear'];
    // Start with clear weather for new terrain
    this.currentWeather = 'clear';
    this.targetWeather = 'clear';
    this.transitionProgress = 1.0;
    this.turnsSinceChange = 0;
  }

  onTurnStart(baseWind: number): { modifiedWind: number; shouldFlash: boolean } {
    this.turnsSinceChange++;
    this.shouldTriggerFlash = false;

    // Check for weather change
    if (this.turnsSinceChange >= this.minTurnsBeforeChange) {
      if (Math.random() < this.changeChance) {
        this.changeWeather();
      }
    }

    // Apply weather wind modifier
    const config = this.getCurrentConfig();
    const modifiedWind = baseWind * config.windModifier;

    return {
      modifiedWind,
      shouldFlash: this.shouldTriggerFlash,
    };
  }

  private changeWeather(): void {
    // Pick a random compatible weather that's different from current
    const options = this.compatibleWeathers.filter(w => w !== this.currentWeather);
    if (options.length === 0) return;

    const newWeather = options[Math.floor(Math.random() * options.length)];
    this.targetWeather = newWeather;
    this.transitionProgress = 0;
    this.transitionDuration = WEATHER_CONFIGS[newWeather].transitionDuration;
    this.turnsSinceChange = 0;
    this.shouldTriggerFlash = true;

    // Initialize particles for new weather
    this.initializeParticles(newWeather);
  }

  private initializeParticles(weather: WeatherType): void {
    const config = WEATHER_CONFIGS[weather];

    switch (weather) {
      case 'rain':
        this.initializeRain(config.particleCount);
        break;
      case 'snow':
        this.initializeSnow(config.particleCount);
        break;
      case 'fog':
        this.initializeFog(config.particleCount);
        break;
      case 'sandstorm':
        this.initializeSand(config.particleCount);
        break;
    }
  }

  private initializeRain(count: number): void {
    this.rainDrops = [];
    for (let i = 0; i < count; i++) {
      this.rainDrops.push(this.createRainDrop());
    }
  }

  private createRainDrop(): RainDrop {
    return {
      x: Math.random() * MAP_WIDTH * 1.5 - MAP_WIDTH * 0.25,
      y: Math.random() * MAP_HEIGHT - MAP_HEIGHT,
      speed: 450 + Math.random() * 250,
      length: 6 + Math.random() * 10, // Smaller, thinner drops
      opacity: 0.25 + Math.random() * 0.35,
    };
  }

  private initializeSnow(count: number): void {
    this.snowflakes = [];
    for (let i = 0; i < count; i++) {
      this.snowflakes.push(this.createSnowflake());
    }
  }

  private createSnowflake(): Snowflake {
    return {
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT - MAP_HEIGHT,
      size: 4 + Math.random() * 6, // Larger, more visible flakes (4-10 pixels)
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 1.5,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.8 + Math.random() * 1.5,
      fallSpeed: 25 + Math.random() * 35,
      opacity: 0.6 + Math.random() * 0.4,
    };
  }

  private initializeFog(layerCount: number): void {
    this.fogLayers = [];
    for (let i = 0; i < layerCount; i++) {
      const depth = i / (layerCount - 1); // 0 to 1
      this.fogLayers.push({
        x: Math.random() * MAP_WIDTH,
        y: MAP_HEIGHT * 0.3 + Math.random() * MAP_HEIGHT * 0.5,
        width: 200 + Math.random() * 400,
        height: 100 + Math.random() * 150,
        opacity: 0.2 + Math.random() * 0.3,
        speed: 5 + depth * 20, // Far fog moves slower
        depth,
      });
    }
  }

  private initializeSand(count: number): void {
    this.sandParticles = [];
    for (let i = 0; i < count; i++) {
      this.sandParticles.push(this.createSandParticle());
    }
  }

  private createSandParticle(): SandParticle {
    return {
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      speed: 150 + Math.random() * 200,
      size: 1 + Math.random() * 3,
      opacity: 0.4 + Math.random() * 0.4,
      wavePhase: Math.random() * Math.PI * 2,
      trail: [],
    };
  }

  update(deltaTime: number, wind: number): void {
    // Update transition
    if (this.transitionProgress < 1.0) {
      this.transitionProgress += deltaTime / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.currentWeather = this.targetWeather;
      }
    }

    // Update lightning flash
    if (this.lightningFlash > 0) {
      this.lightningFlash -= deltaTime * 6; // Fade over ~0.17 seconds
      if (this.lightningFlash < 0) this.lightningFlash = 0;
    }

    // Update particles based on current/target weather
    const activeWeather = this.transitionProgress >= 0.5 ? this.targetWeather : this.currentWeather;

    switch (activeWeather) {
      case 'rain':
        this.updateRain(deltaTime, wind);
        break;
      case 'snow':
        this.updateSnow(deltaTime, wind);
        break;
      case 'fog':
        this.updateFog(deltaTime, wind);
        break;
      case 'sandstorm':
        this.updateSand(deltaTime, wind);
        break;
    }

    // Update lightning bolts
    this.updateLightning(deltaTime);
  }

  private updateRain(deltaTime: number, wind: number): void {
    // Spawn rain occasionally during rain (chance of lightning)
    if (Math.random() < 0.001) {
      this.spawnLightning();
    }

    for (const drop of this.rainDrops) {
      // Move drop down and sideways based on wind
      drop.y += drop.speed * deltaTime;
      drop.x += wind * 3 * deltaTime;

      // Reset drop when it goes off screen
      if (drop.y > MAP_HEIGHT || drop.x < -50 || drop.x > MAP_WIDTH + 50) {
        drop.x = Math.random() * MAP_WIDTH * 1.5 - MAP_WIDTH * 0.25;
        drop.y = -drop.length - Math.random() * 100;
      }
    }
  }

  private updateSnow(deltaTime: number, wind: number): void {
    for (const flake of this.snowflakes) {
      // Fall and wobble
      flake.y += flake.fallSpeed * deltaTime;
      flake.wobblePhase += flake.wobbleSpeed * deltaTime;
      flake.x += Math.sin(flake.wobblePhase) * 20 * deltaTime + wind * 0.5 * deltaTime;
      flake.rotation += flake.rotationSpeed * deltaTime;

      // Reset flake when it goes off screen
      if (flake.y > MAP_HEIGHT || flake.x < -20 || flake.x > MAP_WIDTH + 20) {
        flake.x = Math.random() * MAP_WIDTH;
        flake.y = -flake.size - Math.random() * 100;
        flake.wobblePhase = Math.random() * Math.PI * 2;
      }
    }
  }

  private updateFog(deltaTime: number, wind: number): void {
    for (const layer of this.fogLayers) {
      // Move based on depth (parallax effect)
      const speedMultiplier = 0.3 + layer.depth * 0.7;
      layer.x += (layer.speed + wind * 0.2) * speedMultiplier * deltaTime;

      // Wrap around
      if (layer.x > MAP_WIDTH + layer.width / 2) {
        layer.x = -layer.width / 2;
      } else if (layer.x < -layer.width / 2) {
        layer.x = MAP_WIDTH + layer.width / 2;
      }
    }
  }

  private updateSand(deltaTime: number, wind: number): void {
    const windDir = wind > 0 ? 1 : wind < 0 ? -1 : 1;

    for (const particle of this.sandParticles) {
      // Store previous position for trail
      if (particle.trail.length >= 5) {
        particle.trail.shift();
      }
      particle.trail.push({ x: particle.x, y: particle.y });

      // Move horizontally with wave motion
      particle.wavePhase += 3 * deltaTime;
      particle.x += particle.speed * windDir * deltaTime;
      particle.y += Math.sin(particle.wavePhase) * 30 * deltaTime;

      // Reset when off screen
      if (windDir > 0 && particle.x > MAP_WIDTH + 20) {
        particle.x = -20;
        particle.y = Math.random() * MAP_HEIGHT;
        particle.trail = [];
      } else if (windDir < 0 && particle.x < -20) {
        particle.x = MAP_WIDTH + 20;
        particle.y = Math.random() * MAP_HEIGHT;
        particle.trail = [];
      }

      // Keep within vertical bounds
      if (particle.y < 0) particle.y = MAP_HEIGHT;
      if (particle.y > MAP_HEIGHT) particle.y = 0;
    }
  }

  private spawnLightning(): void {
    // Generate main bolt with branches
    const startX = 100 + Math.random() * (MAP_WIDTH - 200);
    const startY = 0;
    const endY = 200 + Math.random() * 300;

    const bolt: LightningBolt = {
      segments: [],
      opacity: 1.0,
      life: 0.15,
      maxLife: 0.15,
    };

    // Generate main bolt segments with branching
    this.generateLightningSegments(bolt.segments, startX, startY, startX + (Math.random() - 0.5) * 100, endY, 0);

    this.lightning.push(bolt);
    this.lightningFlash = 0.8;
  }

  private generateLightningSegments(
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }>,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    depth: number
  ): void {
    const segmentCount = 8 + Math.floor(Math.random() * 5);
    let prevX = x1;
    let prevY = y1;

    for (let i = 0; i < segmentCount; i++) {
      const progress = (i + 1) / segmentCount;
      const targetX = x1 + (x2 - x1) * progress + (Math.random() - 0.5) * 40;
      const targetY = y1 + (y2 - y1) * progress;

      segments.push({ x1: prevX, y1: prevY, x2: targetX, y2: targetY });

      // Chance to spawn branch
      if (depth < 2 && Math.random() < 0.3) {
        const branchEndX = targetX + (Math.random() - 0.5) * 80;
        const branchEndY = targetY + 30 + Math.random() * 50;
        this.generateLightningSegments(segments, targetX, targetY, branchEndX, branchEndY, depth + 1);
      }

      prevX = targetX;
      prevY = targetY;
    }
  }

  private updateLightning(deltaTime: number): void {
    for (const bolt of this.lightning) {
      bolt.life -= deltaTime;
      bolt.opacity = bolt.life / bolt.maxLife;
    }

    this.lightning = this.lightning.filter(bolt => bolt.life > 0);
  }

  // Update damaging lightning animations (called from Game.ts during LIGHTNING_STRIKE state)
  updateDamagingLightning(deltaTime: number): void {
    // Update telegraphs
    for (const telegraph of this.lightningTelegraphs) {
      telegraph.life -= deltaTime;
      telegraph.pulsePhase += deltaTime * 8; // Pulsing animation

      // When telegraph expires, spawn the actual strike
      if (telegraph.life <= 0) {
        this.spawnStrikeAtTelegraph(telegraph);
      }
    }
    this.lightningTelegraphs = this.lightningTelegraphs.filter(t => t.life > 0);

    // Update damaging strikes
    for (const strike of this.damagingStrikes) {
      strike.life -= deltaTime;
      strike.opacity = Math.min(1, strike.life / strike.maxLife * 2);
    }
    this.damagingStrikes = this.damagingStrikes.filter(s => s.life > 0);
  }

  // Try to spawn a lightning strike at turn transition (called from Game.ts between turns)
  trySpawnLightningStrike(terrain: Terrain): boolean {
    // Update cooldown tracking
    this.strikeCooldown--;

    // Only spawn during rain weather
    const activeWeather = this.transitionProgress >= 0.5 ? this.targetWeather : this.currentWeather;
    if (activeWeather !== 'rain') {
      return false;
    }

    // Check cooldown (in turns)
    if (this.strikeCooldown > 0) {
      return false;
    }

    // 20% chance per turn during rain
    if (Math.random() > 0.20) {
      return false;
    }

    // Spawn the telegraph
    this.spawnDamagingLightningTelegraph(terrain);
    return true;
  }

  // Spawn a telegraph warning for an upcoming lightning strike
  private spawnDamagingLightningTelegraph(terrain: Terrain): void {
    const surfaceYCache = terrain.getSurfaceYCache();
    const bitmapWidth = terrain.getBitmapWidth();

    // Find a valid surface position
    const minBX = Math.floor(bitmapWidth * 0.1);
    const maxBX = Math.floor(bitmapWidth * 0.9);
    const bx = minBX + Math.floor(Math.random() * (maxBX - minBX));
    const surfaceBY = surfaceYCache[bx];

    if (surfaceBY < 0) return; // No surface at this position

    const x = bx * TERRAIN_SCALE;
    const y = surfaceBY * TERRAIN_SCALE;

    // Create telegraph
    this.lightningTelegraphs.push({
      x,
      y,
      life: this.TELEGRAPH_DURATION,
      maxLife: this.TELEGRAPH_DURATION,
      pulsePhase: 0,
    });

    // Set cooldown in turns
    this.strikeCooldown = this.MIN_STRIKE_COOLDOWN + Math.floor(Math.random() * 3);

    // Request cinematic focus
    this.pendingCinematicFocus = {
      x,
      y,
      duration: this.CINEMATIC_DURATION,
      zoomLevel: this.CINEMATIC_ZOOM,
      shakeIntensity: this.CINEMATIC_SHAKE,
    };
  }

  // Spawn actual lightning strike when telegraph expires
  private spawnStrikeAtTelegraph(telegraph: LightningTelegraph): void {
    const strike: DamagingLightningStrike = {
      x: telegraph.x,
      y: telegraph.y,
      segments: [],
      opacity: 1.0,
      life: 0.3, // Strike lasts 0.3 seconds
      maxLife: 0.3,
      damage: this.STRIKE_DAMAGE,
      radius: this.STRIKE_RADIUS,
      hasDealtDamage: false,
      createsCrater: true,
      craterRadius: this.CRATER_RADIUS,
    };

    // Generate lightning segments from sky to ground
    this.generateLightningSegments(
      strike.segments,
      telegraph.x + (Math.random() - 0.5) * 50,
      0,
      telegraph.x,
      telegraph.y,
      0
    );

    this.damagingStrikes.push(strike);
    this.lightningFlash = 1.0;
  }

  // Apply lightning damage to ants and create crater
  applyLightningDamage(ants: Ant[], terrain: Terrain): { hits: Array<{ ant: Ant; damage: number }>; strikeX: number; strikeY: number } | null {
    for (const strike of this.damagingStrikes) {
      if (strike.hasDealtDamage) continue;

      strike.hasDealtDamage = true;

      const hits: Array<{ ant: Ant; damage: number }> = [];

      // Check each ant for damage
      for (const ant of ants) {
        if (!ant.isAlive) continue;

        const dx = ant.x - strike.x;
        const dy = (ant.y - 15) - strike.y; // Ant center is ~15px above feet
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= strike.radius) {
          // Calculate damage falloff
          const falloff = 1 - (distance / strike.radius);
          const damage = Math.max(
            this.STRIKE_MIN_DAMAGE,
            Math.floor(strike.damage * falloff)
          );
          ant.takeDamage(damage);
          hits.push({ ant, damage });
        }
      }

      // Create crater
      if (strike.createsCrater) {
        terrain.createCrater(strike.x, strike.y, strike.craterRadius, 1.0);
      }

      return { hits, strikeX: strike.x, strikeY: strike.y };
    }

    return null;
  }

  // Check if there's a pending cinematic focus request
  consumePendingCinematicFocus(): CinematicFocusRequest | null {
    const focus = this.pendingCinematicFocus;
    this.pendingCinematicFocus = null;
    return focus;
  }

  // Check if lightning strike is active (for state management)
  hasActiveLightningEvent(): boolean {
    return this.lightningTelegraphs.length > 0 || this.damagingStrikes.length > 0;
  }

  getCurrentConfig(): WeatherConfig {
    return WEATHER_CONFIGS[this.currentWeather];
  }

  getTargetConfig(): WeatherConfig {
    return WEATHER_CONFIGS[this.targetWeather];
  }

  getTransitionProgress(): number {
    return this.transitionProgress;
  }

  getInterpolatedVisibility(): number {
    const current = WEATHER_CONFIGS[this.currentWeather].visibility;
    const target = WEATHER_CONFIGS[this.targetWeather].visibility;
    return current + (target - current) * this.transitionProgress;
  }

  getInterpolatedAtmosphereAlpha(): number {
    const current = WEATHER_CONFIGS[this.currentWeather].atmosphereAlpha;
    const target = WEATHER_CONFIGS[this.targetWeather].atmosphereAlpha;
    return current + (target - current) * this.transitionProgress;
  }

  clear(): void {
    this.currentWeather = 'clear';
    this.targetWeather = 'clear';
    this.transitionProgress = 1.0;
    this.turnsSinceChange = 0;
    this.rainDrops = [];
    this.snowflakes = [];
    this.fogLayers = [];
    this.sandParticles = [];
    this.lightning = [];
    this.lightningFlash = 0;
    this.damagingStrikes = [];
    this.lightningTelegraphs = [];
    this.strikeCooldown = 0;
    this.pendingCinematicFocus = null;
  }

  // Force set weather (for testing)
  forceWeather(weather: WeatherType): void {
    this.targetWeather = weather;
    this.transitionProgress = 0;
    this.transitionDuration = WEATHER_CONFIGS[weather].transitionDuration;
    this.initializeParticles(weather);
  }
}
