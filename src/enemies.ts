import Phaser from 'phaser';
import { ZOMBIE_BASE_SPEED, ROBOT_SPEED, BOSS_WAVES, MULTI_BOSS_WAVE, DEPTH } from './constants';
import { playBossAmbiance, playRobotTelegraph, playRobotRun } from './sfxr';

export class EnemyManager {
  private scene: Phaser.Scene;
  private zombies: Phaser.Physics.Arcade.Group;
  private robots: Phaser.Physics.Arcade.Group;
  private player: Phaser.Physics.Arcade.Sprite;

  constructor(
    scene: Phaser.Scene,
    zombies: Phaser.Physics.Arcade.Group,
    robots: Phaser.Physics.Arcade.Group,
    player: Phaser.Physics.Arcade.Sprite
  ) {
    this.scene = scene;
    this.zombies = zombies;
    this.robots = robots;
    this.player = player;
  }

  spawnZombieWave(waveNumber: number): void {
    const zombieCount = 8 + waveNumber * 4;

    for (let i = 0; i < zombieCount; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.spawnZombieFromEdge(waveNumber);
      });
    }

    this.spawnBossesForWave(waveNumber);
  }

  private spawnBossesForWave(waveNumber: number): void {
    const healthMultipliers: { [key: number]: number } = { 3: 1, 6: 2, 10: 5 };
    const speedMultipliers: { [key: number]: number } = { 3: 1, 6: 1.2, 10: 1.5 };

    if (BOSS_WAVES.includes(waveNumber)) {
      const healthMult = healthMultipliers[waveNumber] || 1;
      const speedMult = speedMultipliers[waveNumber] || 1;
      this.scene.time.delayedCall(500, () => {
        this.spawnBossZombie(healthMult, speedMult);
      });
    } else if (waveNumber >= MULTI_BOSS_WAVE) {
      const bossCount = Math.min(1 + Math.floor((waveNumber - MULTI_BOSS_WAVE) / 2), 5);
      const healthMult = 5 + (waveNumber - MULTI_BOSS_WAVE);
      const speedMult = 1.5 + (waveNumber - MULTI_BOSS_WAVE) * 0.1;

      for (let i = 0; i < bossCount; i++) {
        this.scene.time.delayedCall(500 + i * 300, () => {
          this.spawnBossZombie(healthMult, speedMult);
        });
      }
    }
  }

  private spawnBossZombie(healthMultiplier: number = 1, speedMultiplier: number = 1): void {
    const cam = this.scene.cameras.main;

    const x = Phaser.Math.Between(cam.scrollX + 100, cam.scrollX + cam.width - 100);
    const y = cam.scrollY + cam.height + 100;

    const baseHealth = 100;
    const health = baseHealth * healthMultiplier;

    const boss = this.zombies.create(x, y, 'boss-zombie') as Phaser.Physics.Arcade.Sprite;
    boss.setScale(2);
    boss.setDepth(y);
    boss.setData('health', health);
    boss.setData('maxHealth', health);
    boss.setData('points', 500 * healthMultiplier);
    boss.setData('isBoss', true);
    boss.setData('speedMultiplier', speedMultiplier);
    boss.setData('baseFrame', 'boss-zombie');

    const barWidth = 80;
    const barHeight = 8;
    const healthBarBg = this.scene.add.rectangle(x, y - 70, barWidth, barHeight, 0x880000);
    const healthBarFg = this.scene.add.rectangle(x, y - 70, barWidth, barHeight, 0x00ff00);
    healthBarBg.setDepth(y + 1);
    healthBarFg.setDepth(y + 2);
    boss.setData('healthBarBg', healthBarBg);
    boss.setData('healthBarFg', healthBarFg);
    boss.setData('healthBarWidth', barWidth);

    this.setBossVelocity(boss, speedMultiplier);
  }

  private setBossVelocity(boss: Phaser.Physics.Arcade.Sprite, speedMultiplier: number): void {
    const baseSpeed = ZOMBIE_BASE_SPEED + 30;
    const speed = baseSpeed * speedMultiplier;
    const dx = this.player.x - boss.x;
    const dy = this.player.y - boss.y;
    const angle = Math.atan2(dy, dx);
    const wobbleAngle = angle + Phaser.Math.FloatBetween(-0.3, 0.3);

    boss.setVelocity(
      Math.cos(wobbleAngle) * speed,
      Math.sin(wobbleAngle) * speed
    );

    boss.setData('speed', speed);
    boss.setData('waddleOffset', Phaser.Math.FloatBetween(0, Math.PI * 2));
  }

  spawnZombieFromEdge(waveNumber: number): void {
    const cam = this.scene.cameras.main;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;
    const margin = 50;

    switch (edge) {
      case 0:
        x = Phaser.Math.Between(cam.scrollX - margin, cam.scrollX + cam.width + margin);
        y = cam.scrollY - margin;
        break;
      case 1:
        x = cam.scrollX + cam.width + margin;
        y = Phaser.Math.Between(cam.scrollY - margin, cam.scrollY + cam.height + margin);
        break;
      case 2:
        x = Phaser.Math.Between(cam.scrollX - margin, cam.scrollX + cam.width + margin);
        y = cam.scrollY + cam.height + margin;
        break;
      case 3:
      default:
        x = cam.scrollX - margin;
        y = Phaser.Math.Between(cam.scrollY - margin, cam.scrollY + cam.height + margin);
        break;
    }

    const zombie = this.zombies.create(x, y, 'zombie') as Phaser.Physics.Arcade.Sprite;
    zombie.setDepth(y);
    zombie.setData('baseFrame', 'zombie');

    const redChance = Math.min(0.2 + waveNumber * 0.05, 0.5);
    const isRed = Math.random() < redChance;

    if (isRed) {
      zombie.setTint(0xff4444);
      zombie.setData('health', 6);
      zombie.setData('maxHealth', 6);
      zombie.setData('points', 50);
      zombie.setScale(1.2);
      zombie.setData('isRed', true);
    } else {
      zombie.setData('health', 1);
      zombie.setData('maxHealth', 1);
      zombie.setData('points', 10);
    }

    this.setZombieVelocity(zombie);
  }

  private setZombieVelocity(zombie: Phaser.Physics.Arcade.Sprite): void {
    const speed = ZOMBIE_BASE_SPEED + Phaser.Math.Between(20, 60);
    const dx = this.player.x - zombie.x;
    const dy = this.player.y - zombie.y;
    const angle = Math.atan2(dy, dx);
    const wobbleAngle = angle + Phaser.Math.FloatBetween(-0.5, 0.5);

    zombie.setVelocity(
      Math.cos(wobbleAngle) * speed,
      Math.sin(wobbleAngle) * speed
    );

    zombie.setData('speed', speed);
    zombie.setData('waddleOffset', Phaser.Math.FloatBetween(0, Math.PI * 2));
  }

  randomizeZombieMovement(): void {
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];

    for (const zombie of zombies) {
      if (!zombie.active) continue;
      if (zombie.getData('isBoss')) {
        const speedMult = zombie.getData('speedMultiplier') || 1;
        this.setBossVelocity(zombie, speedMult);
      } else {
        this.setZombieVelocity(zombie);
      }
    }
  }

  updateZombies(): boolean {
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const time = this.scene.time.now;

    for (const zombie of zombies) {
      if (!zombie.active) continue;

      const waddleOffset = zombie.getData('waddleOffset') || 0;
      const speed = zombie.getData('speed') || ZOMBIE_BASE_SPEED;
      const isBoss = zombie.getData('isBoss');
      const waddleSpeed = isBoss ? speed * 0.03 : speed * 0.1;
      const waddleAmount = isBoss ? 0.15 : 0.2;
      zombie.rotation = Math.sin(time * 0.01 * waddleSpeed + waddleOffset) * waddleAmount;

      // Only update depth when Y changes significantly
      const lastDepthY = zombie.getData('lastDepthY') || 0;
      if (Math.abs(zombie.y - lastDepthY) > 20) {
        zombie.setDepth(zombie.y);
        zombie.setData('lastDepthY', zombie.y);
      }

      if (isBoss) {
        const healthBarBg = zombie.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
        const healthBarFg = zombie.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
        if (healthBarBg && healthBarFg) {
          healthBarBg.setPosition(zombie.x, zombie.y - 70);
          healthBarFg.setPosition(zombie.x, zombie.y - 70);
          // Only update health bar depth when zombie depth changed
          if (Math.abs(zombie.y - lastDepthY) > 20) {
            healthBarBg.setDepth(zombie.y + 1);
            healthBarFg.setDepth(zombie.y + 2);
          }
        }
        if (Math.random() < 0.01) {
          playBossAmbiance();
        }
      }
    }

    return zombies.filter(z => z.active).length === 0;
  }

  // Robot methods
  spawnRobot(): void {
    const cam = this.scene.cameras.main;
    const margin = 60;

    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    switch (edge) {
      case 0:
        x = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        y = cam.scrollY - margin;
        break;
      case 1:
        x = cam.scrollX + cam.width + margin;
        y = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
      case 2:
        x = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        y = cam.scrollY + cam.height + margin;
        break;
      case 3:
      default:
        x = cam.scrollX - margin;
        y = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
    }

    const targetX = this.player.x;
    const targetY = this.player.y;
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);

    this.createRobotTelegraph(x, y, angle, () => {
      this.spawnRobotAtPosition(x, y, angle);
    });
  }

  private createRobotTelegraph(x: number, y: number, angle: number, onComplete: () => void): void {
    playRobotTelegraph();

    const lineLength = 1500;
    const endX = x + Math.cos(angle) * lineLength;
    const endY = y + Math.sin(angle) * lineLength;

    const line = this.scene.add.line(0, 0, x, y, endX, endY, 0xff4444, 0.6);
    line.setLineWidth(2);
    line.setDepth(DEPTH.BULLETS);
    line.setAlpha(0);

    this.scene.tweens.add({
      targets: line,
      alpha: 0.7,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: line,
          alpha: 0.3,
          duration: 200,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut'
        });
      }
    });

    this.scene.time.delayedCall(1000, () => {
      this.scene.tweens.add({
        targets: line,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => {
          line.destroy();
          onComplete();
        }
      });
    });
  }

  private spawnRobotAtPosition(x: number, y: number, angle: number): void {
    playRobotRun();

    const robot = this.robots.create(x, y, 'robot') as Phaser.Physics.Arcade.Sprite;
    robot.setDepth(y);
    robot.setData('health', 4);
    robot.setData('maxHealth', 4);
    robot.setData('points', 75);
    robot.setData('isRobot', true);
    robot.setData('baseFrame', 'robot');

    robot.setData('angle', angle);
    robot.rotation = angle + Math.PI / 2;

    robot.setVelocity(
      Math.cos(angle) * ROBOT_SPEED,
      Math.sin(angle) * ROBOT_SPEED
    );

    // Spawn flash using texture swap (Safari optimization)
    robot.setTexture('robot-hit');
    this.scene.time.delayedCall(100, () => {
      if (robot.active) robot.setTexture('robot');
    });
  }

  updateRobots(): void {
    const cam = this.scene.cameras.main;
    const margin = 200;

    const robots = this.robots.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const robot of robots) {
      if (!robot.active) continue;

      // Only update depth when Y changes significantly
      const lastDepthY = robot.getData('lastDepthY') || 0;
      if (Math.abs(robot.y - lastDepthY) > 20) {
        robot.setDepth(robot.y);
        robot.setData('lastDepthY', robot.y);
      }

      if (robot.x < cam.scrollX - margin ||
          robot.x > cam.scrollX + cam.width + margin ||
          robot.y < cam.scrollY - margin ||
          robot.y > cam.scrollY + cam.height + margin) {
        robot.destroy();
      }
    }
  }
}
