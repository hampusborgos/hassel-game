import Phaser from 'phaser';
import { playShieldBreak, playStompKill } from './sfxr';
import { DEPTH } from './constants';

export function createExplosion(scene: Phaser.Scene, x: number, y: number): void {
  const particleCount = 12;
  const colors = [0x5a8a9a, 0x7ac8d8, 0xff4444, 0xffff00, 0xff8800];

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const speed = Phaser.Math.Between(80, 150);
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];
    const size = Phaser.Math.Between(4, 10);

    const particle = scene.add.circle(x, y, size, color);
    particle.setDepth(DEPTH.EXPLOSION);

    scene.tweens.add({
      targets: particle,
      x: x + Math.cos(angle) * speed,
      y: y + Math.sin(angle) * speed,
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(300, 500),
      ease: 'Quad.easeOut',
      onComplete: () => {
        particle.destroy();
      }
    });
  }

  // Add a flash circle
  const flash = scene.add.circle(x, y, 30, 0xffffff, 0.8);
  flash.setDepth(DEPTH.EXPLOSION - 1);
  scene.tweens.add({
    targets: flash,
    scale: 2,
    alpha: 0,
    duration: 200,
    ease: 'Quad.easeOut',
    onComplete: () => {
      flash.destroy();
    }
  });
}

export function createZombieExplosion(scene: Phaser.Scene, x: number, y: number, isRed: boolean, hitAngle?: number): void {
  const particleCount = 8;
  // Blue colors for basic zombie, red colors for red zombie
  const colors = isRed
    ? [0xff4444, 0xff6666, 0xcc2222, 0xff8888]
    : [0x44aaff, 0x66ccff, 0x2288cc, 0x88ddff];

  // Directional boost from hit angle (particles fly in direction of bullet travel)
  const boostX = hitAngle !== undefined ? Math.cos(hitAngle) * 80 : 0;
  const boostY = hitAngle !== undefined ? Math.sin(hitAngle) * 40 : 0;

  for (let i = 0; i < particleCount; i++) {
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];
    const size = Phaser.Math.Between(3, 7);

    const particle = scene.add.circle(x, y, size, color);
    particle.setDepth(DEPTH.EXPLOSION);

    // Horizontal spread with directional boost from hit
    const finalX = x + Phaser.Math.Between(-30, 30) + boostX + Phaser.Math.FloatBetween(-10, 10);
    // Land at zombie's feet (slightly below center) with slight Y boost
    const finalY = y + Phaser.Math.Between(15, 25) + boostY * 0.5;
    // Peak height of the arc - higher on the side opposite to hit direction
    const peakY = y - Phaser.Math.Between(40, 80) + boostY;

    const duration = Phaser.Math.Between(300, 450);

    // Animate X linearly
    scene.tweens.add({
      targets: particle,
      x: finalX,
      duration: duration,
      ease: 'Linear'
    });

    // Animate Y with arc: up to peak, then down to feet
    scene.tweens.add({
      targets: particle,
      y: peakY,
      duration: duration * 0.35,
      ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: particle,
          y: finalY,
          duration: duration * 0.65,
          ease: 'Quad.easeIn'
        });
      }
    });

    // Fade out at the end
    scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 0.3,
      duration: duration,
      delay: duration * 0.7,
      ease: 'Linear',
      onComplete: () => {
        particle.destroy();
      }
    });
  }

  // Add a small flash circle with appropriate color
  const flashColor = isRed ? 0xff6666 : 0x66ccff;
  const flash = scene.add.circle(x, y, 15, flashColor, 0.6);
  flash.setDepth(DEPTH.EXPLOSION - 1);
  scene.tweens.add({
    targets: flash,
    scale: 1.5,
    alpha: 0,
    duration: 150,
    ease: 'Quad.easeOut',
    onComplete: () => {
      flash.destroy();
    }
  });
}

export function createShieldBreakEffect(scene: Phaser.Scene, playerX: number, playerY: number): void {
  playShieldBreak();

  // Create expanding ring effect
  const ring = scene.add.circle(playerX, playerY, 20, 0x66aaff, 0.8);
  ring.setDepth(DEPTH.EFFECTS);

  scene.tweens.add({
    targets: ring,
    scale: 3,
    alpha: 0,
    duration: 300,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy()
  });

  // Create shield fragment particles
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const fragment = scene.add.circle(
      playerX,
      playerY,
      5,
      0x4488ff,
      0.9
    );
    fragment.setDepth(DEPTH.EFFECTS);

    scene.tweens.add({
      targets: fragment,
      x: playerX + Math.cos(angle) * 60,
      y: playerY + Math.sin(angle) * 60,
      alpha: 0,
      scale: 0.3,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => fragment.destroy()
    });
  }
}

export function createHoleSmokeEffect(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
  smokeParticles: Phaser.GameObjects.Arc[]
): void {
  const offsetX = Phaser.Math.Between(-20, 20);
  const smoke = scene.add.circle(
    player.x + offsetX,
    player.y - 10,
    Phaser.Math.Between(4, 8),
    0xccddee,
    0.6
  );
  smoke.setDepth(player.depth + 1);
  smokeParticles.push(smoke);

  scene.tweens.add({
    targets: smoke,
    y: smoke.y - 30,
    alpha: 0,
    scale: 1.5,
    duration: 600,
    ease: 'Quad.easeOut',
    onComplete: () => {
      smoke.destroy();
      const idx = smokeParticles.indexOf(smoke);
      if (idx > -1) smokeParticles.splice(idx, 1);
    }
  });
}

export function createStompExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  isBoss: boolean = false
): void {
  playStompKill();
  createExplosion(scene, x, y);

  if (isBoss) {
    // Extra explosions for boss
    for (let i = 0; i < 6; i++) {
      scene.time.delayedCall(i * 40, () => {
        const offsetX = Phaser.Math.Between(-50, 50);
        const offsetY = Phaser.Math.Between(-50, 50);
        createExplosion(scene, x + offsetX, y + offsetY);
      });
    }
  }
}
