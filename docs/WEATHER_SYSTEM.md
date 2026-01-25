# Weather System Documentation

This document explains how the weather system works in Tank Wars and how to add new weather effects.

## Overview

The weather system adds dynamic environmental conditions that affect both gameplay and visuals. Weather changes automatically during gameplay and each weather type modifies wind effects, visibility, and creates unique particle-based visual effects.

## Architecture

The weather system consists of three main components:

```
src/types/WeatherTypes.ts     - Type definitions and configurations
src/systems/WeatherSystem.ts  - Weather logic and particle management
src/rendering/WeatherRenderer.ts - Visual rendering of weather effects
```

### Layered Rendering for Depth

Weather effects are rendered in two passes to create depth:

1. **Background Layer** (`renderWeatherBackground`) - Called after sky/clouds, before terrain
   - Distant particles with parallax offset
   - Atmospheric gradients
   - Background clouds/haze

2. **Foreground Layer** (`renderWeatherForeground`) - Called after terrain/ants/projectiles
   - Close-up detailed particles
   - Lightning bolts
   - Ground effects (splashes, accumulation)

This creates a sense of depth where weather appears both behind and in front of game elements.

## Current Weather Types

| Weather   | Wind Modifier | Visibility | Description |
|-----------|--------------|------------|-------------|
| Clear     | 1.0x         | 100%       | Sunny day, full visibility |
| Rain      | 1.5x         | 70%        | Storm with rain drops, splashes, lightning |
| Fog       | 0.8x         | 40%        | Dense fog with light rays, rolling ground fog |
| Snow      | 0.7x         | 60%        | Snowfall with crystalline flakes, accumulation |
| Sandstorm | 2.5x         | 30%        | Intense dust storm with motion trails |

## Gameplay Effects

### Wind Modification
Each weather type applies a multiplier to the base wind value:
- **Rain (1.5x)**: Stronger winds make projectiles drift more
- **Fog (0.8x)**: Calmer winds for more predictable shots
- **Snow (0.7x)**: Light winds, easier aiming
- **Sandstorm (2.5x)**: Extreme winds, very unpredictable trajectories

### Visibility
Reduced visibility creates a fog-of-war effect centered on the current player:
- Distant targets become harder to see
- Adds strategic depth to positioning
- Creates tension during bad weather

## Visual Effects

### Background Integration
Weather affects the terrain's background rendering:
- **Sun**: Dimmed or hidden based on weather intensity
- **Clouds**: Change color (darker for rain, grey for snow)
- **Sky**: Darkened appropriately for each weather type

### Particle Effects
Each weather type has unique particles:

#### Rain
- Angled rain drops with glow effects
- Wind-responsive angle changes
- Splash rings at ground level
- Puddle reflections
- Occasional lightning bolts with screen flash

#### Snow
- 6-pointed crystalline snowflakes
- Rotating and wobbling motion
- Sparkle/shimmer effects
- Snow accumulation gradient at ground

#### Fog
- Multiple fog layers at different depths
- Parallax movement based on depth
- Light rays breaking through
- Rolling ground fog waves

#### Sandstorm
- Horizontal particles with motion blur trails
- Animated turbulence stripes
- Large dust clouds
- Sand accumulation at ground

## Adding a New Weather Type

### Step 1: Define the Weather Type

In `src/types/WeatherTypes.ts`:

```typescript
// Add to WeatherType union
export type WeatherType = 'clear' | 'rain' | 'fog' | 'snow' | 'sandstorm' | 'your_weather';

// Add particle interface if needed
export interface YourParticle {
  x: number;
  y: number;
  // ... other properties
}

// Add to TERRAIN_WEATHER_COMPATIBILITY
export const TERRAIN_WEATHER_COMPATIBILITY: Record<string, WeatherType[]> = {
  'Grassland': ['clear', 'rain', 'fog', 'snow', 'your_weather'],
  // ... other terrains
};

// Add configuration
export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  // ... existing configs
  your_weather: {
    type: 'your_weather',
    windModifier: 1.2,        // How much to multiply wind
    visibility: 0.8,          // 0-1, percentage of normal visibility
    atmosphereColor: '#...', // Color tint for atmosphere overlay
    atmosphereAlpha: 0.2,    // Opacity of atmosphere overlay
    particleCount: 200,      // Number of particles to spawn
    transitionDuration: 3.0, // Seconds to transition to this weather
  },
};
```

### Step 2: Add Particle Management

In `src/systems/WeatherSystem.ts`:

```typescript
// Add particle array
yourParticles: YourParticle[] = [];

// Add initialization method
private initializeYourWeather(count: number): void {
  this.yourParticles = [];
  for (let i = 0; i < count; i++) {
    this.yourParticles.push(this.createYourParticle());
  }
}

private createYourParticle(): YourParticle {
  return {
    x: Math.random() * MAP_WIDTH,
    y: Math.random() * MAP_HEIGHT,
    // ... initialize other properties
  };
}

// Add update method
private updateYourWeather(deltaTime: number, wind: number): void {
  for (const particle of this.yourParticles) {
    // Update particle position and state
    particle.x += /* movement logic */;
    particle.y += /* movement logic */;

    // Reset particle when off screen
    if (/* off screen condition */) {
      // Reset to starting position
    }
  }
}

// Update initializeParticles switch
private initializeParticles(weather: WeatherType): void {
  switch (weather) {
    // ... existing cases
    case 'your_weather':
      this.initializeYourWeather(config.particleCount);
      break;
  }
}

// Update the update method's switch
update(deltaTime: number, wind: number): void {
  // ... existing code
  switch (activeWeather) {
    // ... existing cases
    case 'your_weather':
      this.updateYourWeather(deltaTime, wind);
      break;
  }
}

// Update clear method
clear(): void {
  // ... existing code
  this.yourParticles = [];
}
```

### Step 3: Add Visual Rendering

In `src/rendering/WeatherRenderer.ts`, add both background and foreground render methods:

```typescript
// Background render (distant particles, atmosphere)
private renderYourWeatherBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
  // Atmosphere gradient
  ctx.save();
  ctx.globalAlpha = 0.2;
  const gradient = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT);
  gradient.addColorStop(0, 'rgba(..., 0.1)');
  gradient.addColorStop(1, 'rgba(..., 0.3)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.restore();

  // Background particles (40% of particles, smaller, with parallax)
  const bgParticles = weather.yourParticles.filter((_, i) => i % 5 < 2);
  for (const particle of bgParticles) {
    ctx.save();
    ctx.globalAlpha = particle.opacity * 0.3;
    ctx.fillStyle = '#...';
    ctx.beginPath();
    ctx.arc(particle.x * 0.95, particle.y, particle.size * 0.5, 0, Math.PI * 2); // Parallax offset
    ctx.fill();
    ctx.restore();
  }
}

// Foreground render (detailed close particles, ground effects)
private renderYourWeatherForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void {
  // Foreground particles (60% of particles, full detail)
  const fgParticles = weather.yourParticles.filter((_, i) => i % 5 >= 2);
  for (const particle of fgParticles) {
    ctx.save();
    ctx.globalAlpha = particle.opacity;

    // Subtle glow
    ctx.fillStyle = 'rgba(..., 0.2)';
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Particle core
    ctx.fillStyle = '#...';
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Ground effects (accumulation, reflections)
  ctx.save();
  ctx.globalAlpha = 0.15;
  const groundGradient = ctx.createLinearGradient(0, MAP_HEIGHT - 30, 0, MAP_HEIGHT);
  groundGradient.addColorStop(0, 'rgba(..., 0)');
  groundGradient.addColorStop(1, 'rgba(..., 0.3)');
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, MAP_HEIGHT - 30, MAP_WIDTH, 30);
  ctx.restore();
}

// Update renderWeatherBackground switch
renderWeatherBackground(ctx, weather, wind): void {
  switch (activeWeather) {
    // ... existing cases
    case 'your_weather':
      this.renderYourWeatherBackground(ctx, weather, wind);
      break;
  }
}

// Update renderWeatherForeground switch
renderWeatherForeground(ctx, weather, wind): void {
  switch (activeWeather) {
    // ... existing cases
    case 'your_weather':
      this.renderYourWeatherForeground(ctx, weather, wind);
      break;
  }
}

// Add icon for weather indicator
renderWeatherIndicator(...): void {
  switch (currentType) {
    // ... existing cases
    case 'your_weather':
      // Draw icon
      ctx.strokeStyle = '#...';
      ctx.lineWidth = 2;
      // Draw distinctive icon shape
      break;
  }
}
```

### Step 4: Update Background Effects

In `src/Terrain.ts`, update `getWeatherModifiers()`:

```typescript
private getWeatherModifiers(weatherType: WeatherType, intensity: number): {
  // ... existing return type
} {
  switch (weatherType) {
    // ... existing cases
    case 'your_weather':
      skyDarken = 0.15 * intensity;
      sunOpacity = Math.max(0.3, 1 - intensity * 0.5);
      cloudColor = this.blendColor('#FFFFFF', '#YOUR_COLOR', intensity);
      cloudOpacityMod = /* appropriate value */;
      showClouds = true; // or false for weather that hides clouds
      break;
  }
}
```

## Weather Transition System

### How Transitions Work
1. Weather changes are checked at the start of each turn
2. Minimum 3 turns must pass before weather can change
3. After minimum turns, 25% chance to change each turn
4. Visual transition lasts 2-4 seconds (configurable per weather)
5. Screen flash effect on weather change

### Transition Progress
- `getTransitionProgress()` returns 0-1
- Before 50%: Old weather fading out
- After 50%: New weather fading in
- Both visuals and gameplay effects interpolate during transition

## Terrain Compatibility

Weather types are restricted based on terrain theme:
- **Grassland**: Clear, Rain, Fog, Snow
- **Desert**: Clear, Sandstorm
- **Arctic**: Clear, Fog, Snow
- **Volcanic**: Clear, Rain, Fog, Sandstorm
- **Autumn**: Clear, Rain, Fog, Snow
- **Martian**: Clear, Sandstorm

Configure compatibility in `TERRAIN_WEATHER_COMPATIBILITY` in `WeatherTypes.ts`.

## Debug Controls

Press **W** during gameplay to cycle through all weather types for testing.

## Performance Considerations

- Particle counts are tuned for balance between visual impact and performance
- Use `ctx.save()`/`ctx.restore()` to isolate state changes
- Gradients are created per-frame; consider caching if needed
- Trail arrays are size-limited to prevent memory growth
- Fog layers are sorted by depth once per frame

## Tips for Good Weather Effects

1. **Layering**: Use multiple layers (background, mid, foreground) for depth
2. **Animation**: Add subtle movement to everything (wobble, pulse, rotation)
3. **Glow effects**: Draw particles twice - once larger and transparent for glow
4. **Ground effects**: Add accumulation/reflection effects at ground level
5. **Atmosphere**: Use color overlays and gradients for mood
6. **Transitions**: Make sure effects fade in/out smoothly during weather changes
7. **Icons**: Create distinctive, animated HUD icons for each weather type
