# Noel åker skidor - Claude Development Guide

## Overview

A top-down ski shooter survival game built with **Phaser 3** and **TypeScript**. The player skis down an infinite slope, shooting zombies while collecting coins and performing ski jumps.

## Tech Stack

- **Framework:** Phaser 3 (game engine)
- **Language:** TypeScript
- **Build:** Vite (assumed based on structure)
- **Assets:** SVG sprites

## Project Structure

```
hasselgame/
├── src/
│   └── main.ts          # Main game code (single file)
├── public/
│   └── assets/
│       ├── player.svg       # Default/uphill player sprite
│       ├── player-down.svg  # Downhill player sprite
│       ├── player-left.svg  # Left-leaning player sprite
│       ├── player-right.svg # Right-leaning player sprite
│       ├── bullet.svg       # Projectile sprite
│       ├── zombie.svg       # Zombie sprite (teal colored)
│       ├── boss-zombie.svg  # Boss zombie sprite (bulky, purple)
│       ├── tree.svg         # Tree obstacle
│       ├── coin.svg         # Collectible coin
│       ├── shield.svg       # Shield pickup item
│       ├── bubble.svg       # Shield bubble around player
│       ├── jump.svg         # Ski jump ramp (trapezoid)
│       ├── hole.svg         # Ice hole trap
│       └── robot.svg        # Robot enemy
└── CLAUDE.md
```

## Game Architecture

### Main Scene (`MainScene`)

All game logic is in a single Phaser Scene class in `src/main.ts`.

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

1. Add sprite to `public/assets/`
2. Load in `preload()` with `this.load.svg()`
3. Create spawn logic similar to `spawnZombieFromEdge()`
4. Set data: `health`, `maxHealth`, `points`
5. Add to zombies group or create new group

### New Collectible

1. Create SVG sprite
2. Load in `preload()`
3. Create physics group in `create()`
4. Add overlap collision with player
5. If persistent, add localStorage save/load

### New Obstacle

1. Create SVG sprite
2. Load in `preload()`
3. Create group (static or dynamic)
4. Add spawn logic in `spawnTreesAroundPlayer()` or similar
5. Add collision handling

## Known Patterns

- SVG sprites loaded with explicit dimensions: `{ width: X, height: Y }`
- Depth based on Y position for proper layering: `sprite.setDepth(sprite.y)`
- UI elements use `.setScrollFactor(0).setDepth(100+)`
- Tweens used for animations (coins, explosions, jumps)
- Collision callbacks cast to `Phaser.Types.Physics.Arcade.ArcadePhysicsCallback`
