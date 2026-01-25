# Adding New Weapons to Tank Wars

This guide explains how to add a new weapon to the game, covering all the systems that need to be updated.

## Overview

Adding a weapon requires updates to these files:
1. `src/weapons/WeaponTypes.ts` - Weapon configuration
2. `src/Projectile.ts` - Projectile rendering and behavior
3. `src/rendering/AntRenderer.ts` - How ant holds/displays the weapon
4. `src/AI.ts` - AI weapon selection logic
5. `src/AI_WEAPON_SELECTION.md` - Documentation update

## Step 1: Define the Weapon Configuration

### File: `src/weapons/WeaponTypes.ts`

#### 1.1 Add the weapon type
```typescript
export type WeaponType = 'standard' | 'bazooka' | ... | 'yourWeapon';
```

#### 1.2 Add the weapon configuration
```typescript
yourWeapon: {
  type: 'yourWeapon',
  name: 'Display Name',           // Shown in weapon selector UI
  damage: 50,                     // Base damage on hit
  explosionRadius: 35,            // Explosion radius in pixels
  projectileSpeed: 1.0,           // Multiplier: <1 = slower, >1 = faster
  projectileSize: 1.0,            // Visual size multiplier
  ammo: 3,                        // Starting ammo (-1 = unlimited)
  maxBounces: 0,                  // Number of terrain bounces (0 = explode on contact)
  clusterCount: 0,                // For cluster weapons: number of sub-projectiles
  clusterDamage: 0,               // Damage per cluster projectile
  craterDepthMultiplier: 1.0,     // Terrain destruction depth
  burnDuration: 0,                // Fire effect duration in seconds
  burnDamagePerSecond: 0,         // Damage per second while burning
  trailColor: { r: 255, g: 150, b: 50 }, // Projectile trail RGB
  description: 'Short description', // Shown in UI tooltip
  keyBinding: '7',                // Keyboard shortcut (1-9)
  pelletCount: 1,                 // Projectiles per shot (>1 for shotgun-style)
  spreadAngle: 0,                 // Spread in degrees for multi-pellet
  gravityMultiplier: 1.0,         // Arc: <1 = flatter, >1 = steeper
  requiresCharging: true,         // false = instant fire (like sniper)
},
```

#### 1.3 Add to weapon order
```typescript
export const WEAPON_ORDER: WeaponType[] = [..., 'yourWeapon'];
```

### Configuration Reference

| Property | Effect |
|----------|--------|
| `projectileSpeed` | Higher = faster, more range. Lower = slower, needs more power |
| `gravityMultiplier` | 0.05 = nearly straight (sniper), 1.3 = heavy arc (grenade) |
| `maxBounces` | 0 = explode on terrain contact, >0 = bounce that many times |
| `requiresCharging` | false = fires instantly at full power (no hold to charge) |
| `pelletCount` | >1 creates shotgun/spread weapons |
| `burnDuration` | >0 creates fire areas that deal damage over time |

## Step 2: Add Projectile Rendering

### File: `src/Projectile.ts`

#### 2.1 Add render case in the switch statement
```typescript
switch (this.weaponConfig.type) {
  // ... existing cases ...
  case 'yourWeapon':
    this.renderYourWeapon(ctx);
    break;
  default:
    this.renderStandardShell(ctx);
}
```

#### 2.2 Add the render method
```typescript
private renderYourWeapon(ctx: CanvasRenderingContext2D): void {
  const pixelSize = 2;
  // Define sprite as 2D array (0 = transparent)
  const sprite = [
    [0, 1, 1, 0],
    [1, 2, 2, 1],
    [1, 2, 2, 1],
    [0, 1, 1, 0],
  ];
  const colors: Record<number, string> = {
    0: '',           // Transparent
    1: '#ColorA',    // Main color
    2: '#ColorB',    // Highlight
  };

  // Offset centers the sprite on the projectile position
  this.drawPixelSprite(ctx, sprite, colors, pixelSize, -4, -4);
  this.drawProjectileGlow(ctx, '#GlowColor', 10);
}
```

### Sprite Tips
- Sprites are drawn rotated to face movement direction
- Design pointing RIGHT (angle 0)
- Use `drawPixelSprite()` helper for pixel art
- Use `drawProjectileGlow()` for energy/glow effects
- Common pixel sizes: 1.5 (small), 2 (normal), 2.5 (large)

## Step 3: Add Ant Weapon Visual

### File: `src/rendering/AntRenderer.ts`

#### 3.1 Add weapon visual properties
```typescript
case 'yourWeapon':
  return {
    color: '#MainColor',   // Primary weapon color
    light: '#LightColor',  // Highlight color
    dark: '#DarkColor',    // Shadow color
    length: 12,            // Weapon length in pixels
  };
```

#### 3.2 Add weapon rendering (in `renderAntBody` method)
```typescript
} else if (ant.selectedWeapon === 'yourWeapon') {
  // Draw weapon based on angle
  const weaponLen = weaponVisual.length;

  // Example: Draw a barrel
  for (let i = 0; i < weaponLen; i++) {
    const px = shoulderX + Math.round(Math.cos(angleRad) * i);
    const py = shoulderY - Math.round(Math.sin(angleRad) * i);
    this.drawPixel(ctx, px, py, weaponVisual.color);
    this.drawPixel(ctx, px, py - 1, weaponVisual.light);
    this.drawPixel(ctx, px, py + 1, weaponVisual.dark);
  }

  // Add details (muzzle, scope, etc.)
  const muzzleX = shoulderX + Math.round(Math.cos(angleRad) * weaponLen);
  const muzzleY = shoulderY - Math.round(Math.sin(angleRad) * weaponLen);
  this.drawPixel(ctx, muzzleX, muzzleY, '#1a1a1a');
}
```

### Weapon Visual Styles

**Barrel weapons** (standard, bazooka, sniper):
- Draw tube from shoulder along angle
- Add muzzle at end
- Optional: scope, stock

**Thrown weapons** (grenade):
- Draw arm extending
- Draw held object at hand position
- No barrel/muzzle needed

**Launcher weapons** (napalm):
- Wide tube with flared muzzle
- Show projectile inside tube

## Step 4: Add AI Weapon Selection

### File: `src/AI.ts`

#### 4.1 Add scoring logic in `selectWeapon()` method
```typescript
} else if (weapon === 'yourWeapon') {
  // Distance scoring
  if (distance >= OPTIMAL_MIN && distance <= OPTIMAL_MAX) {
    score += 25;  // Bonus for optimal range
  } else if (distance < TOO_CLOSE) {
    score -= 20;  // Penalty for too close
  } else if (distance > TOO_FAR) {
    score -= 15;  // Penalty for too far
  }

  // Special conditions
  if (!hasLineOfSight) {
    // Bonus/penalty based on whether weapon can work without LOS
    score += 30;  // e.g., bouncing weapons get bonus
  }

  // Target health considerations
  if (targetHealth > 60) {
    score += 15;  // Heavy weapons preferred for healthy targets
  }
}
```

### AI Scoring Guidelines

| Weapon Type | Preferred Conditions |
|-------------|---------------------|
| High damage, slow | Medium range, high health targets |
| Fast, low gravity | Long range, clear LOS required |
| Bouncing | When no LOS, targets behind cover |
| Area/burn damage | High health targets, grouped enemies |
| Spread/multi-pellet | Medium range, hard-to-hit targets |

#### 4.2 Update `calculateShot()` if needed
For weapons with special firing mechanics (like sniper's instant fire):
```typescript
if (shooter.selectedWeapon === 'yourWeapon') {
  // Custom aiming logic
  return { angle: calculatedAngle, power: calculatedPower };
}
```

## Step 5: Update Documentation

### File: `src/AI_WEAPON_SELECTION.md`

Add your weapon to the scoring table and any special sections.

## Testing Checklist

1. **Weapon Selection**
   - [ ] Appears in weapon selector UI
   - [ ] Keyboard shortcut works
   - [ ] Ammo displays correctly
   - [ ] Depletes to standard when empty

2. **Ant Visual**
   - [ ] Weapon renders on ant correctly
   - [ ] Rotates with aim angle
   - [ ] Looks appropriate for weapon type

3. **Projectile**
   - [ ] Fires at correct angle/power
   - [ ] Trail color matches config
   - [ ] Projectile sprite looks good
   - [ ] Bouncing works (if applicable)

4. **Damage & Effects**
   - [ ] Deals correct damage
   - [ ] Explosion radius correct
   - [ ] Creates crater (if applicable)
   - [ ] Burn effect works (if applicable)

5. **AI Behavior**
   - [ ] AI selects weapon appropriately
   - [ ] AI avoids weapon when unsuitable
   - [ ] AI considers bouncing for cover shots

## Example: Complete Weapon Addition

See the `grenade` weapon implementation:
- Config: `src/weapons/WeaponTypes.ts` (grenade entry)
- Projectile: `src/Projectile.ts` (`renderGrenade` method)
- Ant visual: `src/rendering/AntRenderer.ts` (grenade case)
- AI: `src/AI.ts` (grenade scoring in `selectWeapon`)

## Special Weapon Behaviors

### Bouncing Projectiles
Set `maxBounces > 0`. The projectile will:
- Reflect off terrain with 65% energy retention
- Reflect off map walls with 70% energy retention
- Explode when bounces exhausted or speed < 30

### Instant-Fire Weapons
Set `requiresCharging: false`. The weapon:
- Fires immediately on click (no power charging)
- AI uses direct aim calculation
- Power is always 100%

### Cluster/Spread Weapons
Set `pelletCount > 1` and `spreadAngle > 0`:
- Multiple projectiles fire simultaneously
- Each does `damage` amount
- Spread increases with `spreadAngle`

### Burn/Fire Weapons
Set `burnDuration > 0` and `burnDamagePerSecond > 0`:
- Creates fire area on impact
- Fire persists for `burnDuration` seconds
- Deals `burnDamagePerSecond` to ants in area
