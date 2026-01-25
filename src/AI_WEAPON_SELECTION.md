# AI Weapon Selection Guide

This document explains how the AI selects weapons and how to update the logic when adding new weapons.

## Overview

The AI weapon selection happens in `AI.ts` in the `selectWeapon()` method. It scores each available weapon based on the tactical situation and selects one based on difficulty level.

## Weapon Selection Algorithm

### Step 1: Filter Available Weapons
Only weapons with remaining ammo are considered (`shooter.hasAmmo(weapon)`).

### Step 2: Calculate Situation Metrics
- `distance`: Horizontal distance to target
- `heightDiff`: Vertical difference (positive = shooter is lower)
- `targetHealth`: Current health of the target
- `hasLineOfSight`: Whether there's a clear straight line to target (for direct-fire weapons)

### Step 3: Score Each Weapon
Each weapon gets a score based on:

1. **Base Damage Potential**
   - Single projectile: `config.damage`
   - Multi-pellet: `config.damage * config.pelletCount * 0.4` (assume 40% hit rate)

2. **Distance Suitability**
   - Each weapon has optimal ranges where it gets bonus points
   - Outside optimal range, weapons get penalties

3. **Target Health**
   - Low health (<=30): Prefer standard/sniper to finish off, penalize heavy weapons
   - High health (>=80): Prefer heavy damage weapons

4. **Special Requirements**
   - Weapons requiring line of sight get heavy penalty (-200) if blocked
   - Ammo conservation: -10 if it's the last shot

5. **Weapon-Specific Bonuses**
   - Height advantage/disadvantage considerations
   - Burn damage potential for fire weapons

### Step 4: Select Based on Difficulty
- **Easy**: 40% best, 35% second-best, 25% random
- **Medium**: 65% best, 25% second-best, 10% random
- **Hard**: 90% best, 10% second-best

## Current Weapon Scoring

| Weapon | Optimal Range | Special Conditions | Notes |
|--------|--------------|-------------------|-------|
| Standard | Any | None | Neutral baseline, good for finishing low-health |
| Bazooka | 200-400px | None | Penalized at long range (slow projectile) |
| Shotgun | 150-350px | None | Spread makes it forgiving at medium range |
| Sniper | 250-400px+ | **Requires LOS + viability** | Must pass `checkSniperViability()`, penalized if target is higher |
| Napalm | 150-350px | High health targets, **bounces** | 2 bounces, creates fire, good when no LOS |
| Grenade | 100-400px | **Bounces 4x**, no LOS bonus | Best for hitting targets behind cover |

### Sniper Height Scoring
| Height Difference | Score Modifier |
|-------------------|----------------|
| Target >100px higher | -100 (can't arc up) |
| Target 50-100px higher | -30 (difficult) |
| Similar height (±50px) | +15 (ideal) |
| Target >50px lower | +20 (good angle) |

## Shot Calculation by Weapon Type

The `calculateShot()` method in `AI.ts` handles weapon-specific physics:

### Trajectory Simulation

The AI simulates projectile trajectories using `simulateShot()` which:
1. **Checks terrain collision** - Detects if projectile hits ground before target
2. **Checks friendly fire** - Detects if explosion would damage teammates
3. **Calculates closest approach** - How close the projectile gets to target

Shot scoring penalizes:
- **Terrain collision** (-500): Shot blocked by terrain before reaching target
- **Friendly fire** (-1000): Explosion would hit a teammate

### Instant-Fire Weapons (e.g., Sniper)
- `requiresCharging: false` in weapon config
- Power is always 100% (fixed)
- **Requires clear line of sight** (checked in weapon selection)
- **Viability check**: `checkSniperViability()` simulates actual shot before selecting
- **Height penalty**: Target much higher than shooter = sniper can't arc up
- Uses trajectory simulation (not just direct aim) to find best angle
- Searches angles around direct line to account for slight gravity (0.05) and wind

### Arc Weapons (Standard, Bazooka, etc.)
- Uses iterative simulation to find best angle/power
- `gravityMultiplier` affects arc height
- `projectileSpeed` affects range (slower = needs more power)
- Slow weapons (speed < 0.8) use higher minimum power
- **Can shoot over terrain obstacles** with high arc

### Spread Weapons (Shotgun/Cluster)
- Same as arc weapons for aiming
- Score calculation assumes partial hits
- Higher risk of friendly fire due to spread

### Bouncing Weapons (Grenade, Fire Bomb)
- `maxBounces > 0` in weapon config
- Projectile reflects off terrain with 65% energy retention per bounce
- Also bounces off map walls (left/right boundaries)
- Explodes when: bounces exhausted, speed < 30, or hits an ant
- **AI bonus when no LOS**: +25 for napalm, +40 for grenade (can bounce around obstacles)
- Good for targets behind cover or below shooter

## Adding a New Weapon

### 1. Define the Weapon Config
In `weapons/WeaponTypes.ts`, add to `WEAPON_CONFIGS`:

```typescript
newWeapon: {
  type: 'newWeapon',
  name: 'Display Name',
  damage: 50,
  explosionRadius: 35,
  projectileSpeed: 1.0,    // <1 = slower, needs more power
  projectileSize: 1.0,
  ammo: 3,                 // -1 = unlimited
  gravityMultiplier: 1.0,  // <1 = flatter arc, >1 = steeper arc
  requiresCharging: true,  // false = instant fire like sniper
  // ... other fields
}
```

### 2. Add Scoring Logic in `selectWeapon()`
Add a case in the weapon scoring loop:

```typescript
} else if (weapon === 'newWeapon') {
  // Distance scoring
  if (distance >= OPTIMAL_MIN && distance <= OPTIMAL_MAX) score += BONUS;
  else if (/* out of range */) score -= PENALTY;

  // Special conditions
  if (/* requires line of sight */) {
    if (!hasLineOfSight) score -= 200;
  }

  // Target health considerations
  if (targetHealth > THRESHOLD) score += BONUS;
}
```

### 3. Update `calculateShot()` if Needed
If the weapon has unique firing mechanics:

```typescript
// At the start of calculateShot()
if (shooter.selectedWeapon === 'newWeapon') {
  // Custom aiming logic
  return { angle: calculatedAngle, power: calculatedPower };
}
```

### 4. Add Line-of-Sight Check if Needed
If the weapon fires in a straight line (low gravity, high speed), it needs LOS:
- The existing `checkLineOfSight()` method handles this
- Just add the LOS penalty in the scoring section

## Weapon Characteristics Reference

| Characteristic | Effect on AI |
|---------------|-------------|
| `projectileSpeed < 1` | AI uses higher minimum power (50%+) |
| `gravityMultiplier < 0.5` | Weapon needs clear LOS, flatter trajectory |
| `requiresCharging: false` | AI uses direct aim, fixed 100% power |
| `pelletCount > 1` | Score assumes ~40% pellet hit rate |
| `burnDuration > 0` | Bonus against high-health targets |
| `maxBounces > 0` | **Bounces off terrain/walls**, bonus when no LOS to target |

## Collision Awareness

The AI is aware of terrain and friendly units when calculating shots:

### Terrain Collision
- `simulateShot()` checks if projectile hits terrain (`terrain.getHeightAt()`)
- If projectile lands too far from target (> 1.5x explosion radius), it's marked as blocked
- Blocked shots get -500 penalty, so AI prefers clear trajectories
- AI will try higher arcs to shoot over hills

### Friendly Fire Prevention
- AI identifies friendly ants: `allAnts.filter(a => a.teamIndex === shooter.teamIndex)`
- During trajectory simulation, checks if explosion would hit any friendly
- Friendly fire proximity check: `distance < explosionRadius + 15`
- Friendly fire shots get -1000 penalty (highest priority to avoid)

### Position Scoring (Movement AI)
- `scorePosition()` also considers terrain obstruction
- `simulateBestShot()` tests if shots from a position can reach target
- Positions with all shots blocked get -20 penalty
- AI prefers positions with clear firing lanes

## Testing New Weapons

1. Run the game: `npm run dev`
2. Play against AI on different difficulties
3. Observe AI weapon choices at various:
   - Distances (close, medium, far)
   - Terrain configurations (hills, valleys)
   - Target health levels
4. Verify the AI doesn't waste limited ammo on overkill situations
5. Check that weapons requiring LOS aren't selected when blocked
6. **Verify AI avoids shooting into terrain** - place target behind hill
7. **Verify AI avoids friendly fire** - position friendlies between shooter and target
