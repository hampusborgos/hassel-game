import { WeaponInfo, WeaponType } from './types';

// Player movement
export const PLAYER_SPEED = 250;
export const PLAYER_SPEED_DOWN_BONUS = 150;

// Shooting
export const BULLET_SPEED = 600;
export const SHOOT_COOLDOWN = 150;

// Enemies
export const ZOMBIE_BASE_SPEED = 40;
export const ROBOT_SPEED = 400;
export const ROBOT_FIRST_WAVE = 5;
export const BOSS_WAVES = [3, 6, 10];
export const MULTI_BOSS_WAVE = 12;

// World generation
export const TREE_SPAWN_INTERVAL = 150;

// Mobile controls
export const JOYSTICK_RADIUS = 50;
export const THUMB_RADIUS = 25;

// Persistence keys
export const HIGH_SCORES_KEY = 'hasselgame_highscores';
export const COINS_KEY = 'hasselgame_coins';
export const WEAPONS_KEY = 'hasselgame_weapons';
export const SELECTED_WEAPON_KEY = 'hasselgame_selected_weapon';

// Depth layers (higher = on top)
export const DEPTH = {
  // World objects
  BULLETS: 5,
  COLLECTIBLES: 5,
  TERRAIN: 10,         // Trees, jumps, holes (set to y-position)
  PLAYER: 10,
  SHIELD_BUBBLE: 15,

  // Effects
  EFFECTS: 100,        // Shield break, explosions particles
  EXPLOSION: 500,      // Explosion effects

  // In-game UI (HUD)
  HUD: 100,
  JOYSTICK_BASE: 100,
  JOYSTICK_THUMB: 101,

  // Special states
  PLAYER_JUMPING: 1000,

  // Overlay screens (game over, shop)
  OVERLAY_BG: 2000,
  OVERLAY_UI: 2001,
  OVERLAY_INTERACTIVE: 2002,
};

// Weapons configuration
export const WEAPONS: Record<WeaponType, WeaponInfo> = {
  'default': { name: 'Standard', cost: 0, description: 'Single shot' },
  'double-barrel': { name: 'Double-barrel', cost: 100, description: '2 shots at once' },
  'burst-shot': { name: 'Burst Shot', cost: 250, description: 'Kills spawn 6 projectiles' }
};
