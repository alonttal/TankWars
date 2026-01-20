# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # TypeScript check + Vite production build
npm run preview  # Preview production build locally
```

No test framework is configured.

## Architecture Overview

This is a browser-based artillery game (similar to Worms/Scorched Earth) built with TypeScript, HTML5 Canvas, and Vite. Two teams of 8 ants take turns firing projectiles at each other on destructible terrain.

### Core Game Loop

**Entry:** `src/index.ts` → instantiates `Game` class → calls `game.start()`

**Game States:** `MENU` → `INTRO_PAN` → `PLAYING` ↔ `AI_THINKING` → `FIRING` → back to `PLAYING` or `GAME_OVER`

### Key Systems (in `src/`)

| File/Directory | Purpose |
|----------------|---------|
| `Game.ts` | Main game class - state machine, input handling, game loop (update/render), turn management |
| `Ant.ts` | Player unit - pixel art rendering, weapons, buffs, health, targeting cursor |
| `Terrain.ts` | Destructible bitmap terrain with procedural generation |
| `Projectile.ts` | Projectile physics (gravity, wind), collision detection, trail rendering |
| `AI.ts` | CPU opponent logic with difficulty levels |
| `constants.ts` | All game constants (dimensions, physics, team config) |

### Extracted Subsystems

| Directory | Purpose |
|-----------|---------|
| `systems/CameraSystem.ts` | Zoom, pan, screen shake, coordinate transforms |
| `systems/EffectsSystem.ts` | Confetti, fireworks, hitstop, screen flash |
| `rendering/MenuRenderer.ts` | Menu, pause, settings, game over screens |
| `rendering/HUDRenderer.ts` | Health bars, turn timer, wind indicator, turn banner |
| `rendering/EffectsRenderer.ts` | Visual effects drawing |
| `types/GameTypes.ts` | Shared TypeScript interfaces |

### Game Features

| Directory | Purpose |
|-----------|---------|
| `weapons/WeaponTypes.ts` | Weapon configuration (currently only standard shell) |
| `powerups/PowerUpTypes.ts` | Power-up types: health, damage boost, shield, double shot |
| `powerups/PowerUpManager.ts` | Power-up spawning and collection |
| `ui/WeaponSelector.ts`, `ui/BuffIndicator.ts` | In-game UI components |

### Coordinate Systems

- **Base coordinates:** 800×500 logical pixels (game logic)
- **Map coordinates:** 1600×900 (world space, larger than view)
- **Canvas coordinates:** Dynamic based on window size, scaled via `SCALE_X`/`SCALE_Y`
- **Terrain bitmap:** Uses `TERRAIN_SCALE` (4x4 pixels per cell) for performance

### Rendering Pipeline

1. Clear canvas, apply base scaling
2. Background layer with parallax (`BACKGROUND_PARALLAX = 0.3`)
3. Gameplay layer with full camera transform (terrain, ants, projectiles, explosions)
4. UI layer without camera transform (HUD, menus)

### Turn Flow

1. Player aims (mouse or keyboard) and charges power (hold click/space)
2. Fire creates `Projectile` → state becomes `FIRING`
3. Projectile updates until collision with terrain or ant
4. `Explosion` applies damage and destroys terrain
5. `endTurn()` checks win condition, spawns power-ups, switches to next team
6. If AI turn → `AI_THINKING` state → `executeAIShot()`
