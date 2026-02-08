import Phaser from 'phaser';
import { ZOMBIE_BASE_SPEED, ROBOT_SPEED, BOSS_WAVES, MULTI_BOSS_WAVE, DEPTH, ENDER_SPEED, ENDER_CHARGE_TIME_MIN, ENDER_CHARGE_TIME_MAX, ENDER_HEALTH, SNOWMONSTER_HEALTH, SNOWMONSTER_SPEED, SNOWMONSTER_FIRST_WAVE, SNOWMONSTER_THROW_COOLDOWN, SNOWBALL_FLIGHT_TIME, SNOWBALL_DAMAGE_RADIUS, SNOWMONSTER_POINTS } from './constants';
import { playBossAmbiance, playRobotTelegraph, playRobotRun, playEnderTeleport, playEnderCharge, playSnowballThrow } from './sfxr';
import { createEnderChargeParticle, createEnderTeleportEffect, createSnowballSplash } from './effects';

export class EnemyManager {
  private scene: Phaser.Scene;
  private zombies: Phaser.Physics.Arcade.Group;
  private robots: Phaser.Physics.Arcade.Group;
  private enders: Phaser.Physics.Arcade.Group;
  private player: Phaser.Physics.Arcade.Sprite;
  private snowballDamageCallback: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    zombies: Phaser.Physics.Arcade.Group,
    robots: Phaser.Physics.Arcade.Group,
    player: Phaser.Physics.Arcade.Sprite,
    enders?: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.zombies = zombies;
    this.robots = robots;
    this.player = player;
    this.enders = enders || scene.physics.add.group({});
  }

  setSnowballDamageCallback(callback: () => void): void {
    this.snowballDamageCallback = callback;
  }

  setEndersGroup(enders: Phaser.Physics.Arcade.Group): void {
    this.enders = enders;
  }

  getEndersGroup(): Phaser.Physics.Arcade.Group {
    return this.enders;
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

    // Snowmonster: 1 on wave 10, then scaling after wave 10
    if (waveNumber >= SNOWMONSTER_FIRST_WAVE) {
      const snowmonsterCount = waveNumber === SNOWMONSTER_FIRST_WAVE
        ? 1
        : Math.min(1 + Math.floor((waveNumber - SNOWMONSTER_FIRST_WAVE) / 2), 4);
      const healthMult = 1 + (waveNumber - SNOWMONSTER_FIRST_WAVE) * 0.3;
      const speedMult = 1 + (waveNumber - SNOWMONSTER_FIRST_WAVE) * 0.05;

      for (let i = 0; i < snowmonsterCount; i++) {
        this.scene.time.delayedCall(800 + i * 400, () => {
          this.spawnSnowmonster(healthMult, speedMult);
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

  // Ender zombie methods
  spawnEnderZombie(): void {
    const cam = this.scene.cameras.main;
    const margin = 60;

    // Spawn from random edge
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    switch (edge) {
      case 0: // top
        x = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        y = cam.scrollY - margin;
        break;
      case 1: // right
        x = cam.scrollX + cam.width + margin;
        y = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
      case 2: // bottom
        x = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        y = cam.scrollY + cam.height + margin;
        break;
      case 3: // left
      default:
        x = cam.scrollX - margin;
        y = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
    }

    const ender = this.enders.create(x, y, 'ender-zombie') as Phaser.Physics.Arcade.Sprite;
    ender.setDepth(y);
    ender.setData('health', ENDER_HEALTH);
    ender.setData('maxHealth', ENDER_HEALTH);
    ender.setData('points', 100);
    ender.setData('isEnder', true);
    ender.setData('baseFrame', 'ender-zombie');
    ender.setData('state', 'charging'); // States: charging, teleporting, attacking, returning
    ender.setData('spawnEdge', edge);
    ender.setVelocity(0, 0);

    // Start the charging sequence
    this.startEnderCharge(ender);
  }

  private startEnderCharge(ender: Phaser.Physics.Arcade.Sprite): void {
    ender.setData('state', 'charging');
    ender.setVelocity(0, 0);

    playEnderCharge();

    const chargeTime = Phaser.Math.Between(ENDER_CHARGE_TIME_MIN, ENDER_CHARGE_TIME_MAX);
    const particleInterval = 80;
    let elapsed = 0;

    // Spawn charging particles
    const chargeTimer = this.scene.time.addEvent({
      delay: particleInterval,
      repeat: Math.floor(chargeTime / particleInterval),
      callback: () => {
        if (!ender.active) {
          chargeTimer.destroy();
          return;
        }
        createEnderChargeParticle(this.scene, ender.x, ender.y);
        elapsed += particleInterval;

        // Pulsing scale effect as charge builds
        const progress = elapsed / chargeTime;
        const pulseScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1 * progress;
        ender.setScale(pulseScale);
      }
    });

    ender.setData('chargeTimer', chargeTimer);

    // After charging, teleport behind player
    this.scene.time.delayedCall(chargeTime, () => {
      if (!ender.active) return;
      chargeTimer.destroy();
      ender.setScale(1);
      this.teleportEnder(ender);
    });
  }

  private teleportEnder(ender: Phaser.Physics.Arcade.Sprite): void {
    if (!ender.active) return;

    ender.setData('state', 'teleporting');
    playEnderTeleport();

    const fromX = ender.x;
    const fromY = ender.y;

    // Calculate position behind the player (opposite side of screen from player's facing)
    const cam = this.scene.cameras.main;
    const playerVelX = this.player.body?.velocity.x || 0;
    const playerVelY = this.player.body?.velocity.y || 0;

    // Determine "behind" based on player movement, or random if stationary
    let behindAngle: number;
    if (Math.abs(playerVelX) > 10 || Math.abs(playerVelY) > 10) {
      // Behind is opposite of movement direction
      behindAngle = Math.atan2(-playerVelY, -playerVelX);
    } else {
      // Random angle if player is stationary
      behindAngle = Math.random() * Math.PI * 2;
    }

    // Position at edge of screen in that direction
    const edgeDistance = Math.max(cam.width, cam.height) * 0.6;
    let toX = this.player.x + Math.cos(behindAngle) * edgeDistance;
    let toY = this.player.y + Math.sin(behindAngle) * edgeDistance;

    // Clamp to just outside visible screen
    const margin = 80;
    toX = Phaser.Math.Clamp(toX, cam.scrollX - margin, cam.scrollX + cam.width + margin);
    toY = Phaser.Math.Clamp(toY, cam.scrollY - margin, cam.scrollY + cam.height + margin);

    // Create teleport effects
    createEnderTeleportEffect(this.scene, fromX, fromY, toX, toY);

    // Hide briefly during teleport
    ender.setAlpha(0);

    this.scene.time.delayedCall(150, () => {
      if (!ender.active) return;
      ender.setPosition(toX, toY);
      ender.setAlpha(1);
      ender.setDepth(toY);
      this.startEnderAttack(ender);
    });
  }

  private startEnderAttack(ender: Phaser.Physics.Arcade.Sprite): void {
    if (!ender.active) return;

    ender.setData('state', 'attacking');

    // Store target position at start of attack (doesn't track)
    const targetX = this.player.x;
    const targetY = this.player.y;
    ender.setData('targetX', targetX);
    ender.setData('targetY', targetY);

    const angle = Phaser.Math.Angle.Between(ender.x, ender.y, targetX, targetY);
    ender.setData('attackAngle', angle);
    ender.rotation = angle + Math.PI / 2;

    ender.setVelocity(
      Math.cos(angle) * ENDER_SPEED,
      Math.sin(angle) * ENDER_SPEED
    );
  }

  updateEnders(): void {
    const cam = this.scene.cameras.main;
    const margin = 300;

    const enders = this.enders.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const ender of enders) {
      if (!ender.active) continue;

      const state = ender.getData('state');

      // Only update depth when Y changes significantly
      const lastDepthY = ender.getData('lastDepthY') || 0;
      if (Math.abs(ender.y - lastDepthY) > 20) {
        ender.setDepth(ender.y);
        ender.setData('lastDepthY', ender.y);
      }

      // If attacking and went past the target, start returning/recharging
      if (state === 'attacking') {
        const targetX = ender.getData('targetX');
        const targetY = ender.getData('targetY');
        const attackAngle = ender.getData('attackAngle');

        // Check if we've passed the target point
        const dx = targetX - ender.x;
        const dy = targetY - ender.y;
        const dotProduct = dx * Math.cos(attackAngle) + dy * Math.sin(attackAngle);

        // If dot product is negative, we've passed the target
        // Or if we're way off screen, go back to edge
        if (dotProduct < -50 ||
            ender.x < cam.scrollX - margin ||
            ender.x > cam.scrollX + cam.width + margin ||
            ender.y < cam.scrollY - margin ||
            ender.y > cam.scrollY + cam.height + margin) {
          this.returnEnderToEdge(ender);
        }
      }

      // If returning and reached edge, start charging again
      if (state === 'returning') {
        if (ender.x < cam.scrollX - 40 ||
            ender.x > cam.scrollX + cam.width + 40 ||
            ender.y < cam.scrollY - 40 ||
            ender.y > cam.scrollY + cam.height + 40) {
          this.startEnderCharge(ender);
        }
      }
    }
  }

  private returnEnderToEdge(ender: Phaser.Physics.Arcade.Sprite): void {
    if (!ender.active) return;

    ender.setData('state', 'returning');

    const cam = this.scene.cameras.main;

    // Pick a random edge to return to
    const edge = Phaser.Math.Between(0, 3);
    let targetX: number, targetY: number;

    switch (edge) {
      case 0: // top
        targetX = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        targetY = cam.scrollY - 60;
        break;
      case 1: // right
        targetX = cam.scrollX + cam.width + 60;
        targetY = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
      case 2: // bottom
        targetX = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        targetY = cam.scrollY + cam.height + 60;
        break;
      case 3: // left
      default:
        targetX = cam.scrollX - 60;
        targetY = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
    }

    const angle = Phaser.Math.Angle.Between(ender.x, ender.y, targetX, targetY);
    ender.rotation = angle + Math.PI / 2;

    ender.setVelocity(
      Math.cos(angle) * ENDER_SPEED * 0.7,
      Math.sin(angle) * ENDER_SPEED * 0.7
    );
  }

  cleanupEnderTimers(ender: Phaser.Physics.Arcade.Sprite): void {
    const chargeTimer = ender.getData('chargeTimer') as Phaser.Time.TimerEvent;
    if (chargeTimer) {
      chargeTimer.destroy();
    }
  }

  // Snowmonster methods
  private spawnSnowmonster(healthMultiplier: number = 1, speedMultiplier: number = 1): void {
    const cam = this.scene.cameras.main;

    const x = Phaser.Math.Between(cam.scrollX + 100, cam.scrollX + cam.width - 100);
    const y = cam.scrollY + cam.height + 100;

    const health = Math.round(SNOWMONSTER_HEALTH * healthMultiplier);

    const boss = this.zombies.create(x, y, 'snowmonster') as Phaser.Physics.Arcade.Sprite;
    boss.setScale(2);
    boss.setDepth(y);
    boss.setData('health', health);
    boss.setData('maxHealth', health);
    boss.setData('points', SNOWMONSTER_POINTS);
    boss.setData('isBoss', true);
    boss.setData('isSnowmonster', true);
    boss.setData('speedMultiplier', speedMultiplier);
    boss.setData('baseFrame', 'snowmonster');
    boss.setData('nextThrowTime', this.scene.time.now + 2000); // Initial delay before first throw

    // Health bar
    const barWidth = 80;
    const barHeight = 8;
    const healthBarBg = this.scene.add.rectangle(x, y - 70, barWidth, barHeight, 0x880000);
    const healthBarFg = this.scene.add.rectangle(x, y - 70, barWidth, barHeight, 0x88ddff);
    healthBarBg.setDepth(y + 1);
    healthBarFg.setDepth(y + 2);
    boss.setData('healthBarBg', healthBarBg);
    boss.setData('healthBarFg', healthBarFg);
    boss.setData('healthBarWidth', barWidth);

    this.setSnowmonsterVelocity(boss, speedMultiplier);
  }

  private setSnowmonsterVelocity(boss: Phaser.Physics.Arcade.Sprite, speedMultiplier: number): void {
    const speed = SNOWMONSTER_SPEED * speedMultiplier;
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

  updateSnowmonsters(time: number): void {
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];

    for (const zombie of zombies) {
      if (!zombie.active || !zombie.getData('isSnowmonster')) continue;

      const nextThrowTime = zombie.getData('nextThrowTime') || 0;
      if (time >= nextThrowTime) {
        // Predict player position slightly based on velocity
        const playerVelX = this.player.body?.velocity.x || 0;
        const playerVelY = this.player.body?.velocity.y || 0;
        const leadTime = 0.3; // seconds of prediction
        const targetX = this.player.x + playerVelX * leadTime;
        const targetY = this.player.y + playerVelY * leadTime;

        // Switch to throw sprite
        zombie.setTexture('snowmonster-throw');
        zombie.setData('baseFrame', 'snowmonster-throw');

        this.throwSnowball(zombie.x, zombie.y, targetX, targetY);
        zombie.setData('nextThrowTime', time + SNOWMONSTER_THROW_COOLDOWN);

        // Swap back to normal sprite after throw animation
        this.scene.time.delayedCall(500, () => {
          if (zombie.active) {
            zombie.setTexture('snowmonster');
            zombie.setData('baseFrame', 'snowmonster');
          }
        });

        // Retarget towards player after throwing
        const speedMult = zombie.getData('speedMultiplier') || 1;
        this.setSnowmonsterVelocity(zombie, speedMult);
      }
    }
  }

  private throwSnowball(fromX: number, fromY: number, targetX: number, targetY: number): void {
    playSnowballThrow();

    // Create shadow at target position
    const shadow = this.scene.add.ellipse(targetX, targetY, 20, 10, 0x000000, 0.15);
    shadow.setDepth(DEPTH.BULLETS);

    // Grow shadow to indicate incoming
    this.scene.tweens.add({
      targets: shadow,
      scaleX: 2,
      scaleY: 2,
      alpha: 0.4,
      duration: SNOWBALL_FLIGHT_TIME,
      ease: 'Quad.easeIn'
    });

    // Create snowball sprite at boss position
    const snowball = this.scene.add.sprite(fromX, fromY - 40, 'snowball');
    snowball.setDepth(DEPTH.EXPLOSION);
    snowball.setScale(0.5);

    // Calculate arc
    const flightTime = SNOWBALL_FLIGHT_TIME;
    const arcHeight = -120; // Peak height offset

    // Tween X/Y linearly to target
    this.scene.tweens.add({
      targets: snowball,
      x: targetX,
      duration: flightTime,
      ease: 'Linear'
    });

    // Tween Y with custom arc via onUpdate
    const startY = fromY - 40;
    this.scene.tweens.add({
      targets: snowball,
      y: targetY,
      duration: flightTime,
      ease: 'Linear',
      onUpdate: (tween) => {
        const progress = tween.progress;
        // Parabolic arc: peaks at midpoint
        const arcOffset = arcHeight * 4 * progress * (1 - progress);
        const linearY = startY + (targetY - startY) * progress;
        snowball.y = linearY + arcOffset;

        // Scale: grows during rise, shrinks during fall
        const scale = 0.5 + 0.5 * Math.sin(progress * Math.PI);
        snowball.setScale(scale);

        // Rotation for visual flair
        snowball.rotation += 0.1;
      },
      onComplete: () => {
        // Snowball landed - check damage
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, targetX, targetY
        );

        if (dist < SNOWBALL_DAMAGE_RADIUS && this.snowballDamageCallback) {
          this.snowballDamageCallback();
        }

        // Splash effect
        createSnowballSplash(this.scene, targetX, targetY);

        // Cleanup
        snowball.destroy();
        shadow.destroy();
      }
    });
  }

  cleanupSnowmonsterTimers(snowmonster: Phaser.Physics.Arcade.Sprite): void {
    // Snowmonsters don't have persistent timers, but this keeps a consistent API
    // for future extensibility
    snowmonster.setData('nextThrowTime', Infinity);
  }
}
