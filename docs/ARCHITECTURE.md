# Tank Wars Architecture Guide

This document explains the codebase architecture following the January 2025 refactoring effort.

## Refactoring Summary

The refactoring reduced `Game.ts` from ~2,000 lines to ~1,400 lines by extracting responsibilities into focused modules. The main goals were:

1. **Single Responsibility** - Each class handles one concern
2. **Callback-based Communication** - Managers use interfaces to communicate with Game
3. **Strategy Pattern Infrastructure** - Extensible systems for death effects and weather
4. **Modular Constants** - Organized game configuration

## Folder Structure

```
src/
├── index.ts                 # Entry point - instantiates Game
├── Game.ts                  # Main game class - orchestrates systems
├── Ant.ts                   # Player unit - rendering, weapons, health
├── Terrain.ts               # Destructible bitmap terrain
├── Projectile.ts            # Projectile physics and collision
├── Explosion.ts             # Explosion effects and damage
├── AI.ts                    # AI logic and shot calculation
├── Sound.ts                 # Audio manager singleton
│
├── constants/               # Game configuration (split from constants.ts)
│   ├── index.ts             # Re-exports all constants
│   ├── canvas.ts            # BASE_WIDTH, MAP_WIDTH, SCALE_X, etc.
│   ├── physics.ts           # GRAVITY, MAX_POWER, WIND_STRENGTH_MAX
│   ├── movement.ts          # MOVEMENT_SPEED, JUMP_FORCE, MAX_SLOPE_ANGLE
│   ├── entities.ts          # TANK_WIDTH, BARREL_LENGTH, PROJECTILE_RADIUS
│   ├── teams.ts             # NUM_TEAMS, ANTS_PER_TEAM, TEAM_COLORS
│   └── terrain.ts           # TERRAIN_COLOR, SKY_COLOR, height bounds
│
├── systems/                 # Game systems extracted from Game.ts
│   ├── InputManager.ts      # Keyboard/mouse input handling
│   ├── FireSystem.ts        # Firing logic (player, AI, instant)
│   ├── TurnManager.ts       # Turn state and transitions
│   ├── GameStateManager.ts  # Game state machine (pause, resume, quit)
│   ├── AIManager.ts         # AI turn orchestration
│   ├── CameraSystem.ts      # Zoom, pan, screen shake
│   ├── EffectsSystem.ts     # Confetti, fireworks, hitstop
│   ├── WeatherSystem.ts     # Weather state and transitions
│   ├── AntDeathSystem.ts    # Death animations (uses strategy pattern)
│   └── death/               # Death effect infrastructure
│       ├── index.ts
│       ├── DeathEffectBase.ts    # DeathEffect interface
│       └── DeathRenderingUtils.ts # Shared rendering helpers
│
├── rendering/               # Rendering systems
│   ├── MenuRenderer.ts      # Menu, pause, settings screens
│   ├── HUDRenderer.ts       # Health bars, timer, wind indicator
│   ├── EffectsRenderer.ts   # Visual effects drawing
│   ├── WeatherRenderer.ts   # Weather effects (rain, snow, etc.)
│   └── weather/             # Weather renderer infrastructure
│       ├── index.ts
│       └── WeatherRendererBase.ts # WeatherTypeRenderer interface
│
├── ui/                      # UI components
│   ├── WeaponSelector.ts    # Bottom weapon bar
│   ├── BuffIndicator.ts     # Active buff display
│   └── WeaponMenu.ts        # Right-click weapon menu
│
├── weapons/                 # Weapon system
│   ├── WeaponTypes.ts       # Weapon configs and types
│   └── BurnArea.ts          # Napalm burn areas
│
├── powerups/                # Power-up system
│   ├── PowerUpTypes.ts      # Power-up configs
│   └── PowerUpManager.ts    # Spawning and collection
│
└── types/                   # Shared TypeScript types
    ├── GameTypes.ts         # GameState, GameMode, MenuItem, etc.
    └── AntParticleTypes.ts  # Death animation types
```

## Architecture Patterns

### Callback-based Managers

Extracted systems communicate with `Game.ts` through callback interfaces. This keeps dependencies explicit and avoids circular imports.

```typescript
// Example: AIManager
export interface AICallbacks {
  getCurrentAnt: () => Ant | null;
  setState: (state: GameState) => void;
  focusOnAnt: (ant: Ant) => void;
  // ...
}

export class AIManager {
  constructor(callbacks: AICallbacks, fireSystem: FireSystem) {
    this.callbacks = callbacks;
  }
}

// In Game.ts
this.aiManager = new AIManager({
  getCurrentAnt: () => this.ants[this.currentPlayerIndex],
  setState: (state) => { this.state = state; },
  focusOnAnt: (ant) => this.camera.focusOnAnt(ant),
}, this.fireSystem);
```

### Strategy Pattern (Death Effects & Weather)

The death and weather systems use the Strategy pattern for extensibility. The infrastructure is in place - individual strategies can be extracted as needed.

```typescript
// DeathEffectBase.ts
export interface DeathEffect {
  initialize(ant: AntDeathData, particles: DeathParticles, state: DeathAnimationState): void;
  update(deltaTime: number, ant: AntDeathData, particles: DeathParticles, state: DeathAnimationState): void;
  render(ctx: CanvasRenderingContext2D, ant: AntDeathData, state: DeathAnimationState, particles: DeathParticles): void;
}

// WeatherRendererBase.ts
export interface WeatherTypeRenderer {
  renderBackground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void;
  renderForeground(ctx: CanvasRenderingContext2D, weather: WeatherSystem, wind: number): void;
}
```

### Generic Menu Input

Menu navigation is consolidated into a single generic handler:

```typescript
// In InputManager.ts
private handleGenericMenuInput(
  e: KeyboardEvent,
  itemCount: number,
  getSelected: () => number,
  setSelected: (index: number) => void,
  onSelect?: () => void,
  onLeftRight?: (delta: number) => void
): void { ... }

// Used by all menus
handleMenuInput(e) { this.handleGenericMenuInput(e, menuItems.length, ...); }
handlePauseMenuInput(e) { this.handleGenericMenuInput(e, pauseItems.length, ...); }
handleSettingsInput(e) { this.handleGenericMenuInput(e, settings.length, ..., volumeAdjust); }
```

## System Responsibilities

| System | Responsibility |
|--------|----------------|
| `InputManager` | Captures keyboard/mouse events, delegates to appropriate handlers |
| `FireSystem` | Creates projectiles for player shots, AI shots, and instant-fire weapons |
| `TurnManager` | Tracks current player/team, handles turn transitions and timer |
| `GameStateManager` | Manages state transitions (pause, resume, quit, settings) |
| `AIManager` | Orchestrates AI turns: movement planning, shot calculation, execution |
| `CameraSystem` | Camera position, zoom, screen shake, coordinate transforms |
| `EffectsSystem` | Manages visual effects (confetti, fireworks, hitstop) |
| `WeatherSystem` | Weather state, transitions, and theme selection |

## Adding New Features

### Adding a New System

1. Create `src/systems/NewSystem.ts`
2. Define a callback interface for communication with Game
3. Instantiate in Game constructor with callbacks
4. Call system methods from Game's update/render loop

### Adding a New Death Effect

1. Create `src/systems/death/NewDeathEffect.ts` implementing `DeathEffect`
2. Register in `AntDeathSystem.ts` effect map
3. Test with debug key 'K'

### Adding a New Weather Type

1. Create `src/rendering/weather/NewWeatherRenderer.ts` implementing `WeatherTypeRenderer`
2. Register in `WeatherRenderer.ts`
3. Test with debug key 'W'

### Adding Constants

Add to the appropriate file in `src/constants/`:
- Canvas/scaling: `canvas.ts`
- Physics values: `physics.ts`
- Movement parameters: `movement.ts`
- Entity dimensions: `entities.ts`
- Team configuration: `teams.ts`
- Terrain settings: `terrain.ts`

## Game Loop Flow

```
Game.start()
  └── requestAnimationFrame(gameLoop)
        └── update(deltaTime)
        │     ├── InputManager handles events
        │     ├── TurnManager.updateTimer()
        │     ├── AIManager.updateAIThinking/Movement()
        │     ├── Update projectiles, explosions, ants
        │     └── Check collisions, apply damage
        │
        └── render()
              ├── Background with parallax
              ├── Terrain
              ├── Ants, projectiles, effects
              ├── Weather overlay
              └── HUD (no camera transform)
```

## Debug Keys

- `K` - Kill current ant (test death animations)
- `P` - Spawn power-up
- `W` - Cycle weather types
- `M` - Toggle music
