# Noel åker skidor - Claude Development Guide

## Overview

A top-down ski shooter survival game built with **Phaser 3** and **TypeScript**. The player skis down an infinite slope, shooting zombies while collecting coins and performing ski jumps.

## Tech Stack

- **Framework:** Phaser 3 (game engine)
- **Language:** TypeScript
- **Build:** Vite
- **Assets:** Texture atlas (PNG spritesheet generated from SVGs)

## Project Structure

```
hasselgame/
├── src/
│   ├── MainScene.ts     # Main game scene
│   ├── main.ts          # Entry point, Phaser config
│   ├── constants.ts     # Game constants
│   ├── controls.ts      # Mobile joystick controls
│   ├── enemies.ts       # EnemyManager class
│   ├── weapons.ts       # WeaponSystem class
│   ├── collectibles.ts  # CollectibleManager class
│   ├── world.ts         # WorldManager class (terrain)
│   ├── effects.ts       # Particle effects
│   ├── ui.ts            # HUD creation
│   ├── shop.ts          # Weapon shop logic
│   ├── persistence.ts   # localStorage helpers
│   ├── database.ts      # InstantDB integration
│   ├── sfxr.ts          # Sound effects (jsfxr)
│   ├── bitmapFont.ts    # Custom bitmap font
│   └── overlays/        # Game over & shop overlays
├── scripts/
│   └── generate-atlas.js # Builds texture atlas from SVGs
├── public/
│   └── assets/
│       ├── atlas.png        # Generated spritesheet (all sprites)
│       ├── atlas.json       # Phaser atlas frame data
│       ├── player.svg       # Source: Default/uphill player
│       ├── player-down.svg  # Source: Downhill player
│       ├── player-left.svg  # Source: Left-leaning player
│       ├── player-right.svg # Source: Right-leaning player
│       ├── player-stuck.svg # Source: Stuck in hole player
│       ├── bullet.svg       # Source: Projectile
│       ├── zombie.svg       # Source: Zombie (teal)
│       ├── boss-zombie.svg  # Source: Boss zombie (purple)
│       ├── tree.svg         # Source: Tree obstacle
│       ├── coin.svg         # Source: Collectible coin
│       ├── shield.svg       # Source: Shield pickup
│       ├── bubble.svg       # Source: Shield bubble
│       ├── jump.svg         # Source: Ski jump ramp
│       ├── hole.svg         # Source: Ice hole trap
│       └── robot.svg        # Source: Robot enemy
└── CLAUDE.md
```

## Game Architecture

### Main Scene (`MainScene`)

The game uses a single Phaser Scene (`MainScene` in `src/MainScene.ts`) with logic split across manager classes:
- `EnemyManager` - Zombie, boss, and robot spawning/AI
- `WeaponSystem` - Shooting mechanics and bullet management
- `CollectibleManager` - Coins, shields, and pickups
- `WorldManager` - Terrain generation (trees, jumps, holes)

### Key Constants

| Constant                  | Value    | Description                      |
| ------------------------- | -------- | -------------------------------- |
| `PLAYER_SPEED`            | 250      | Base movement speed              |
| `PLAYER_SPEED_DOWN_BONUS` | 150      | Extra speed when moving downhill |
| `BULLET_SPEED`            | 600      | Projectile velocity              |
| `SHOOT_COOLDOWN`          | 150ms    | Time between shots               |
| `ZOMBIE_BASE_SPEED`       | 40       | Minimum zombie speed             |
| `TREE_SPAWN_INTERVAL`     | 150      | Y-distance between spawn rows    |
| `ROBOT_SPEED`             | 400      | Robot movement speed             |
| `ROBOT_FIRST_WAVE`        | 5        | Wave when robots start appearing |
| `BOSS_WAVES`              | [3,6,10] | Single boss spawn waves          |
| `MULTI_BOSS_WAVE`         | 12       | Multiple bosses start here       |

### Player System

- **Movement:** WASD/Arrow keys (desktop), Dvorak ,AOE keys, or left joystick (mobile)
- **Aiming:** Mouse cursor (desktop) or right joystick (mobile)
- **Directional sprites:** Changes based on movement direction
  - Moving up: Default sprite with waggle animation
  - Moving left: Left-leaning sprite
  - Moving right: Right-leaning sprite
  - Moving down/still: Down-facing sprite
- **Jumping state:** Player is invulnerable while `isJumping === true`
- **Landing invulnerability:** 1 second of invulnerability after landing (player blinks)

### Zombie System

Two zombie types:

1. **Regular zombies:** 1 health, 10 points
2. **Red zombies:** 6 health, 50 points, 1.2x scale, 35% coin drop chance

Zombies spawn from screen edges in waves. Wave size: `8 + waveNumber * 4`

Red zombie spawn chance: `min(0.2 + waveNumber * 0.05, 0.5)`

### Boss Zombie System

Huge purple zombies that appear on specific waves with scaling difficulty:

| Wave | Health   | Speed  | Points  |
| ---- | -------- | ------ | ------- |
| 3    | 100 (x1) | Normal | 500     |
| 6    | 200 (x2) | 1.2x   | 1000    |
| 10   | 500 (x5) | 1.5x   | 2500    |
| 12+  | Scaling  | 1.5x+  | Scaling |

- **Sprite:** Dedicated bulky boss-zombie.svg (64x64)
- **Scale:** 2x sprite size
- **Health bar:** Green/red bar displayed above boss, shrinks as damage taken
- **Death rewards:** 5-10 coins + massive explosion (5 particle bursts)
- **Wave 12+:** Multiple bosses spawn (1 + every 2 waves, max 5)
- **Post-12 scaling:** Health = 50 \* (5 + waves past 12), Speed continues to increase

### Robot System

Fast-moving enemy that appears after wave 5:

- **Health:** 4 hits to destroy
- **Points:** 75 (when shot)
- **Speed:** 400 (very fast)
- **Movement:** Straight line towards player's position at spawn time (does NOT track)
- **Spawn pattern:** Bursts of 3-4 robots, then 8 second cooldown
- **Stomp rewards:** 1000 points + 25 coins (very rewarding but risky)

Robot burst system:

1. After wave 5+, when a wave ends and no cooldown active, `startRobotBurst()` is called
2. Spawns 3-4 robots with 1.5s delay between each
3. After burst completes, 8 second cooldown before next burst can start

### Ski Jump System

- **Collision behavior:**
  - Moving UP into a jump: Player is blocked/pushed back
  - Moving DOWN over a jump: Triggers jump animation
- **Jump animation:** 800ms duration, player scales to 1.4x, moves 150px down
- **Landing kills:** Landing on zombies gives **10x points** and creates particle explosion
- **Red zombies:** 50% coin drop when stomped (vs 35% when shot)

### Hole System

- **Spawn rate:** 4x rarer than ski jumps (~0.75% density)
- **Effect:** Player gets stuck for 4 seconds, cannot move but can still shoot
- **Visual:** Player shrinks slightly and gets blue tint while stuck
- **Immunity:** Jumping over holes avoids them

### Coin System

- **Persistence:** Coins save to `localStorage` key `hasselgame_coins`
- **Collection:** Overlap collision with player
- **Animation:** Bounce + spinning effect when spawned

### Shield System

- **Effect:** Absorbs one hit, then 2 seconds invulnerability
- **Visual:** Blue bubble around player when shielded
- **Drop rate:** ~2% from zombie kills (average 1 per 5 waves)
- **Guaranteed drop:** One shield guaranteed before wave 3
- **Animation:** Floating + rotating pickup, shield break particles on hit

### Weapon Shop System

Accessible via "SHOP" button on game over screen.

**Weapons:**
| Weapon | Cost | Description |
|--------|------|-------------|
| Standard | Free | Single shot (default) |
| Double-barrel | 100 | Fires 2 bullets with slight spread |
| Explosive Shot | 250 | Kills spawn 6 projectiles in all directions |

**Persistence:**

- Owned weapons: `localStorage` key `hasselgame_weapons`
- Selected weapon: `localStorage` key `hasselgame_selected_weapon`

**Explosive Shot mechanics:**

- 10 red-tinted bullets spawn at kill location
- Bullets travel at 70% speed for 200ms then disappear
- Explosive bullets don't trigger additional explosions (prevents chain reactions)

### Scoring System

- **High scores:** Saved to `localStorage` key `hasselgame_highscores` (top 5)
- **Regular zombie kill:** 10 points
- **Red zombie kill:** 50 points
- **Robot kill:** 75 points
- **Zombie stomp:** 10x normal points (100 or 500)
- **Robot stomp:** 1000 points + 25 coins

### World Generation

Infinite scrolling world using dynamic spawning:

- Trees spawn at ~30% density as player moves down
- Ski jumps spawn at ~3% density
- Objects are cleaned up when >1000px from player/camera

### Mobile Support

- Detected via `device.input.touch && window.innerWidth <= 1024`
- Dual virtual joysticks (left: move, right: aim/shoot)
- Fullscreen button (hidden in standalone PWA mode)

## Physics Groups

| Group     | Type          | Purpose                       |
| --------- | ------------- | ----------------------------- |
| `bullets` | Arcade Group  | Player projectiles (max 30)   |
| `zombies` | Arcade Group  | Zombie enemies                |
| `robots`  | Arcade Group  | Robot enemies                 |
| `coins`   | Arcade Group  | Collectible items             |
| `trees`   | Display Group | Visual obstacles (no physics) |
| `jumps`   | Static Group  | Ski jump ramps                |

## Collision Matrix

| A                | B       | Result                                |
| ---------------- | ------- | ------------------------------------- |
| bullets          | zombies | Damage zombie, destroy bullet         |
| bullets          | robots  | Damage robot, destroy bullet          |
| player           | zombies | Game over (unless jumping)            |
| player           | robots  | Game over (unless jumping)            |
| player           | coins   | Collect coin                          |
| player           | jumps   | Block if going up, jump if going down |
| player (landing) | zombies | Stomp kill (10x points)               |
| player (landing) | robots  | Stomp kill (1000 pts + 25 coins)      |

## Adding New Features

### New Enemy Type

1. Add SVG sprite to `public/assets/`
2. Add sprite definition to `scripts/generate-atlas.js` (name, file, width, height)
3. Run `npm run atlas` to regenerate the texture atlas
4. Create spawn logic in `enemies.ts` using `group.create(x, y, ATLAS_KEY, 'sprite-name')`
5. Set data: `health`, `maxHealth`, `points`
6. Add to zombies group or create new group

### New Collectible

1. Create SVG sprite in `public/assets/`
2. Add to `scripts/generate-atlas.js` and run `npm run atlas`
3. Create physics group in `MainScene.create()`
4. Spawn with `group.create(x, y, ATLAS_KEY, 'sprite-name')`
5. Add overlap collision with player
6. If persistent, add localStorage save/load in `persistence.ts`

### New Obstacle

1. Create SVG sprite in `public/assets/`
2. Add to `scripts/generate-atlas.js` and run `npm run atlas`
3. Create group (static or dynamic) in `MainScene.create()`
4. Add spawn logic in `WorldManager` using `ATLAS_KEY` and frame name
5. Add collision handling

## Known Patterns

- **Texture Atlas:** All sprites use `ATLAS_KEY` constant from `MainScene.ts`
- **Sprite creation:** `group.create(x, y, ATLAS_KEY, 'frame-name')` or `add.image(x, y, ATLAS_KEY, 'frame-name')`
- **Texture switching:** `sprite.setTexture(ATLAS_KEY, 'frame-name')`
- Depth based on Y position for proper layering: `sprite.setDepth(sprite.y)`
- UI elements use `.setScrollFactor(0).setDepth(100+)`
- Tweens used for animations (coins, explosions, jumps)
- Collision callbacks cast to `Phaser.Types.Physics.Arcade.ArcadePhysicsCallback`

## Texture Atlas System

All game sprites are packed into a single texture atlas for WebGL batching performance.

**Files:**
- `public/assets/atlas.png` - The spritesheet image (484×130 pixels)
- `public/assets/atlas.json` - Frame coordinates for Phaser
- `scripts/generate-atlas.js` - Build script using resvg-js

**Regenerating the atlas:**
```bash
npm run atlas
```

Run this after adding/modifying any SVG sprite. The script:
1. Reads sprite definitions (name, SVG file, target width/height)
2. Converts SVGs to PNG using resvg-js
3. Packs into a single spritesheet
4. Generates Phaser-compatible JSON

**Adding a new sprite to the atlas:**
```javascript
// In scripts/generate-atlas.js, add to the sprites array:
{ name: 'my-sprite', file: 'my-sprite.svg', width: 32, height: 32 },
```

## Performance Notes (Safari/WebGL)

### Texture Atlas (Critical for Safari)

Safari's WebGL compositor stalls when processing many individual draw calls. The texture atlas enables Phaser to batch all sprites into 1-3 draw calls instead of 150+.

**Never load individual textures for game sprites.** Always use the atlas:
```typescript
// BAD - creates separate textures, no batching
this.load.svg('zombie', 'assets/zombie.svg', { width: 40, height: 40 });

// GOOD - uses shared atlas texture, enables batching
this.load.atlas(ATLAS_KEY, 'assets/atlas.png', 'assets/atlas.json');
```

### Avoid Redundant setTexture() Calls

Never call `sprite.setTexture()` every frame. Track the current texture and only call it when changing:

```typescript
// BAD - causes frame drops in Safari
update() {
  if (movingUp) {
    this.player.setTexture(ATLAS_KEY, 'player-up');  // Called every frame!
  }
}

// GOOD - only updates when texture changes
private currentTexture = 'player-down';

update() {
  const newTexture = movingUp ? 'player-up' : 'player-down';
  if (newTexture !== this.currentTexture) {
    this.player.setTexture(ATLAS_KEY, newTexture);
    this.currentTexture = newTexture;
  }
}
```

This applies to any per-frame texture/sprite changes. Chrome handles redundant calls fine, but Safari's WebGL does not.
