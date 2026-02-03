import Phaser from 'phaser';
import { WeaponType } from './types';
import { BULLET_SPEED, SHOOT_COOLDOWN, DEPTH } from './constants';
import { playShotFired } from './sfxr';

export class WeaponSystem {
  private scene: Phaser.Scene;
  private bullets: Phaser.Physics.Arcade.Group;
  private player: Phaser.Physics.Arcade.Sprite;
  private canShoot = true;
  public currentWeapon: WeaponType = 'default';

  constructor(
    scene: Phaser.Scene,
    bullets: Phaser.Physics.Arcade.Group,
    player: Phaser.Physics.Arcade.Sprite
  ) {
    this.scene = scene;
    this.bullets = bullets;
    this.player = player;
  }

  shoot(aimAngle: number): void {
    if (!this.canShoot) return;

    const offsetX = Math.cos(aimAngle) * 30;
    const offsetY = Math.sin(aimAngle) * 30;

    if (this.currentWeapon === 'double-barrel') {
      this.shootBullet(aimAngle - 0.1, offsetX, offsetY);
      this.shootBullet(aimAngle + 0.1, offsetX, offsetY);
    } else {
      this.shootBullet(aimAngle, offsetX, offsetY);
    }

    playShotFired();
    this.canShoot = false;
    this.scene.time.delayedCall(SHOOT_COOLDOWN, () => {
      this.canShoot = true;
    });
  }

  private shootBullet(angle: number, offsetX: number, offsetY: number): void {
    const bullet = this.bullets.get(
      this.player.x + offsetX,
      this.player.y + offsetY
    ) as Phaser.Physics.Arcade.Sprite;

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.rotation = angle + Math.PI / 2;
      bullet.setDepth(DEPTH.BULLETS);
      bullet.setData('isBurstBullet', false);
      bullet.setVelocity(
        Math.cos(angle) * BULLET_SPEED,
        Math.sin(angle) * BULLET_SPEED
      );
    }
  }

  spawnBurstShots(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const bullet = this.bullets.get(x, y) as Phaser.Physics.Arcade.Sprite;

      if (bullet) {
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.rotation = angle + Math.PI / 2;
        bullet.setDepth(DEPTH.BULLETS);
        bullet.setData('isBurstBullet', true);
        bullet.setTint(0xff0000);
        bullet.setVelocity(
          Math.cos(angle) * BULLET_SPEED * 0.7,
          Math.sin(angle) * BULLET_SPEED * 0.7
        );

        this.scene.time.delayedCall(200, () => {
          if (bullet.active) {
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.clearTint();
          }
        });
      }
    }
  }

  cleanupBullets(): void {
    this.bullets.getChildren().forEach((bullet) => {
      const b = bullet as Phaser.Physics.Arcade.Sprite;
      if (b.active) {
        const dist = Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y);
        if (dist > 600) {
          b.setActive(false);
          b.setVisible(false);
        }
      }
    });
  }

  setWeapon(weapon: WeaponType): void {
    this.currentWeapon = weapon;
  }

  getCanShoot(): boolean {
    return this.canShoot;
  }

  setCanShoot(value: boolean): void {
    this.canShoot = value;
  }
}
