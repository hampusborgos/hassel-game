import Phaser from 'phaser';

export interface VirtualJoystick {
  base: Phaser.GameObjects.Arc;
  thumb: Phaser.GameObjects.Arc;
  pointerId: number | null;
  vector: Phaser.Math.Vector2;
  baseX: number;
  baseY: number;
}

export type WeaponType = 'default' | 'double-barrel' | 'burst-shot' | 'railgun' | 'rubber';

export interface WeaponInfo {
  name: string;
  cost: number;
  description: string;
}

export interface GameState {
  score: number;
  coinCount: number;
  waveNumber: number;
  canShoot: boolean;
  isJumping: boolean;
  isStuck: boolean;
  isInvulnerable: boolean;
  hasShield: boolean;
  shieldDroppedBeforeWave3: boolean;
  currentWeapon: WeaponType;
  ownedWeapons: WeaponType[];
  aimAngle: number;
  robotBurstCount: number;
  robotBurstMax: number;
  robotCooldown: boolean;
}
