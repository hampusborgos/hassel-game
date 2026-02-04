import Phaser from 'phaser';
import { WeaponType } from './types';
import { BULLET_SPEED, SHOOT_COOLDOWN, MACHINEGUN_COOLDOWN, RAILGUN_COOLDOWN, RAILGUN_DAMAGE, DEPTH } from './constants';
import { playShotFired, playRailgun } from './sfxr';

export interface RailgunHitCallback {
  (target: Phaser.Physics.Arcade.Sprite, damage: number): void;
}

export class WeaponSystem {
  private scene: Phaser.Scene;
  private bullets: Phaser.Physics.Arcade.Group;
  private player: Phaser.Physics.Arcade.Sprite;
  private canShoot = true;
  public currentWeapon: WeaponType = 'default';
  private zombies?: Phaser.Physics.Arcade.Group;
  private robots?: Phaser.Physics.Arcade.Group;
  private enders?: Phaser.Physics.Arcade.Group;
  private onRailgunHit?: RailgunHitCallback;

  constructor(
    scene: Phaser.Scene,
    bullets: Phaser.Physics.Arcade.Group,
    player: Phaser.Physics.Arcade.Sprite
  ) {
    this.scene = scene;
    this.bullets = bullets;
    this.player = player;
  }

  setEnemyGroups(zombies: Phaser.Physics.Arcade.Group, robots: Phaser.Physics.Arcade.Group, enders?: Phaser.Physics.Arcade.Group): void {
    this.zombies = zombies;
    this.robots = robots;
    this.enders = enders;
  }

  setRailgunHitCallback(callback: RailgunHitCallback): void {
    this.onRailgunHit = callback;
  }

  shoot(aimAngle: number): void {
    if (!this.canShoot) return;

    const offsetX = Math.cos(aimAngle) * 30;
    const offsetY = Math.sin(aimAngle) * 30;

    if (this.currentWeapon === 'railgun') {
      this.shootRailgun(aimAngle);
      playRailgun();
      this.canShoot = false;
      this.scene.time.delayedCall(RAILGUN_COOLDOWN, () => {
        this.canShoot = true;
      });
    } else {
      if (this.currentWeapon === 'double-barrel') {
        this.shootBullet(aimAngle - 0.1, offsetX, offsetY);
        this.shootBullet(aimAngle + 0.1, offsetX, offsetY);
      } else {
        this.shootBullet(aimAngle, offsetX, offsetY);
      }

      playShotFired();
      this.canShoot = false;
      const cooldown = this.currentWeapon === 'machinegun' ? MACHINEGUN_COOLDOWN : SHOOT_COOLDOWN;
      this.scene.time.delayedCall(cooldown, () => {
        this.canShoot = true;
      });
    }
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

      // Rubber gun bullets are dark green and bounce
      if (this.currentWeapon === 'rubber') {
        bullet.setTint(0x228B22); // Dark green (forest green)
        bullet.setData('isRubberBullet', true);
      } else {
        bullet.clearTint();
        bullet.setData('isRubberBullet', false);
      }

      bullet.setVelocity(
        Math.cos(angle) * BULLET_SPEED,
        Math.sin(angle) * BULLET_SPEED
      );
    }
  }

  private shootRailgun(angle: number): void {
    const startX = this.player.x;
    const startY = this.player.y;

    // Calculate ray endpoint (extend to 2000 pixels - well beyond screen)
    const rayLength = 2000;
    const endX = startX + Math.cos(angle) * rayLength;
    const endY = startY + Math.sin(angle) * rayLength;

    // Draw the railgun ray visual (Q2 style - bright core with glow)
    this.drawRailgunRay(startX, startY, endX, endY);

    // Check for hits along the ray
    this.checkRailgunHits(startX, startY, angle, rayLength);
  }

  private drawRailgunRay(startX: number, startY: number, endX: number, endY: number): void {
    // Create graphics for the ray
    const graphics = this.scene.add.graphics();
    graphics.setDepth(DEPTH.EFFECTS);

    // Outer glow (cyan/blue)
    graphics.lineStyle(8, 0x00ffff, 0.3);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.strokePath();

    // Middle layer (brighter cyan)
    graphics.lineStyle(4, 0x44ffff, 0.6);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.strokePath();

    // Core (white-hot center)
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.strokePath();

    // Fade out the ray
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        graphics.destroy();
      }
    });
  }

  private checkRailgunHits(startX: number, startY: number, angle: number, rayLength: number): void {
    if (!this.zombies || !this.robots || !this.onRailgunHit) return;

    const hitRadius = 25; // How close to the line counts as a hit

    // Check all zombies
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const zombie of zombies) {
      if (!zombie.active) continue;

      const dist = this.pointToLineDistance(zombie.x, zombie.y, startX, startY, angle, rayLength);
      if (dist < hitRadius) {
        this.onRailgunHit(zombie, RAILGUN_DAMAGE);
      }
    }

    // Check all robots
    const robots = this.robots.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const robot of robots) {
      if (!robot.active) continue;

      const dist = this.pointToLineDistance(robot.x, robot.y, startX, startY, angle, rayLength);
      if (dist < hitRadius) {
        this.onRailgunHit(robot, RAILGUN_DAMAGE);
      }
    }

    // Check all enders
    if (this.enders) {
      const enders = this.enders.getChildren() as Phaser.Physics.Arcade.Sprite[];
      for (const ender of enders) {
        if (!ender.active) continue;

        const dist = this.pointToLineDistance(ender.x, ender.y, startX, startY, angle, rayLength);
        if (dist < hitRadius) {
          this.onRailgunHit(ender, RAILGUN_DAMAGE);
        }
      }
    }
  }

  private pointToLineDistance(px: number, py: number, lineX: number, lineY: number, angle: number, length: number): number {
    // Vector from line start to point
    const dx = px - lineX;
    const dy = py - lineY;

    // Line direction vector
    const ldx = Math.cos(angle);
    const ldy = Math.sin(angle);

    // Project point onto line
    const t = dx * ldx + dy * ldy;

    // Check if projection is within the line segment
    if (t < 0 || t > length) {
      return Infinity; // Point is beyond the line segment
    }

    // Calculate perpendicular distance
    const projX = lineX + ldx * t;
    const projY = lineY + ldy * t;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
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
