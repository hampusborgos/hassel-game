import Phaser from 'phaser';
import { playShieldBreak, playStompKill, playGrenadeExplosion } from './sfxr';
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

export function createEnderChargeParticle(
  scene: Phaser.Scene,
  x: number,
  y: number
): Phaser.GameObjects.Arc {
  // Spawn particles around the ender zombie that spiral inward
  const angle = Math.random() * Math.PI * 2;
  const distance = Phaser.Math.Between(40, 80);
  const startX = x + Math.cos(angle) * distance;
  const startY = y + Math.sin(angle) * distance;

  const colors = [0x9933ff, 0xcc66ff, 0x7722dd, 0xaa44ff, 0x5500aa];
  const color = colors[Phaser.Math.Between(0, colors.length - 1)];
  const size = Phaser.Math.Between(3, 6);

  const particle = scene.add.circle(startX, startY, size, color, 0.8);
  particle.setDepth(DEPTH.EFFECTS);

  // Spiral inward toward the ender zombie
  scene.tweens.add({
    targets: particle,
    x: x,
    y: y,
    scale: 0.2,
    alpha: 0,
    duration: Phaser.Math.Between(400, 700),
    ease: 'Quad.easeIn',
    onComplete: () => {
      particle.destroy();
    }
  });

  return particle;
}

export function createEnderTeleportEffect(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): void {
  // Disappear effect at origin
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const particle = scene.add.circle(fromX, fromY, 5, 0x9933ff, 0.9);
    particle.setDepth(DEPTH.EFFECTS);

    scene.tweens.add({
      targets: particle,
      x: fromX + Math.cos(angle) * 60,
      y: fromY + Math.sin(angle) * 60,
      alpha: 0,
      scale: 0.3,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => particle.destroy()
    });
  }

  // Flash at origin
  const flashFrom = scene.add.circle(fromX, fromY, 25, 0xcc66ff, 0.8);
  flashFrom.setDepth(DEPTH.EFFECTS);
  scene.tweens.add({
    targets: flashFrom,
    scale: 2,
    alpha: 0,
    duration: 250,
    ease: 'Quad.easeOut',
    onComplete: () => flashFrom.destroy()
  });

  // Appear effect at destination
  scene.time.delayedCall(100, () => {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 60;
      const particle = scene.add.circle(
        toX + Math.cos(angle) * distance,
        toY + Math.sin(angle) * distance,
        5, 0x9933ff, 0.9
      );
      particle.setDepth(DEPTH.EFFECTS);

      scene.tweens.add({
        targets: particle,
        x: toX,
        y: toY,
        alpha: 0,
        scale: 0.3,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => particle.destroy()
      });
    }

    // Flash at destination
    const flashTo = scene.add.circle(toX, toY, 25, 0xcc66ff, 0.8);
    flashTo.setDepth(DEPTH.EFFECTS);
    scene.tweens.add({
      targets: flashTo,
      scale: 2,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => flashTo.destroy()
    });
  });
}

export function createGrenadeExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  blastRadius: number
): void {
  playGrenadeExplosion();

  // Big flash at center
  const flash = scene.add.circle(x, y, 40, 0xffaa00, 0.9);
  flash.setDepth(DEPTH.EXPLOSION);
  scene.tweens.add({
    targets: flash,
    scale: 3,
    alpha: 0,
    duration: 300,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy()
  });

  // Shockwave ring
  const ring = scene.add.circle(x, y, 10, 0xff6600, 0);
  ring.setDepth(DEPTH.EXPLOSION);
  ring.setStrokeStyle(3, 0xff8800, 0.8);
  scene.tweens.add({
    targets: ring,
    scale: blastRadius / 10,
    alpha: 0,
    duration: 400,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy()
  });

  // Fire particles
  const particleCount = 18;
  const colors = [0xff4400, 0xff8800, 0xffcc00, 0xff6600, 0xffaa00];
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const dist = Phaser.Math.Between(60, blastRadius);
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];
    const size = Phaser.Math.Between(4, 10);

    const particle = scene.add.circle(x, y, size, color);
    particle.setDepth(DEPTH.EXPLOSION);

    scene.tweens.add({
      targets: particle,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(300, 500),
      ease: 'Quad.easeOut',
      onComplete: () => particle.destroy()
    });
  }

  // Smoke puffs (darker, slower)
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(20, 50);
    const smoke = scene.add.circle(x, y, Phaser.Math.Between(8, 14), 0x444444, 0.5);
    smoke.setDepth(DEPTH.EXPLOSION);

    scene.tweens.add({
      targets: smoke,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - 30,
      alpha: 0,
      scale: 2,
      duration: Phaser.Math.Between(500, 800),
      ease: 'Quad.easeOut',
      onComplete: () => smoke.destroy()
    });
  }
}

export function createEnderExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  hitAngle?: number
): void {
  const particleCount = 10;
  const colors = [0x9933ff, 0xcc66ff, 0x7722dd, 0x4a2a7a, 0x5c3a8c];

  // Directional boost from hit angle
  const boostX = hitAngle !== undefined ? Math.cos(hitAngle) * 80 : 0;
  const boostY = hitAngle !== undefined ? Math.sin(hitAngle) * 40 : 0;

  for (let i = 0; i < particleCount; i++) {
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];
    const size = Phaser.Math.Between(4, 8);

    const particle = scene.add.circle(x, y, size, color);
    particle.setDepth(DEPTH.EXPLOSION);

    const finalX = x + Phaser.Math.Between(-40, 40) + boostX;
    const finalY = y + Phaser.Math.Between(15, 30) + boostY * 0.5;
    const peakY = y - Phaser.Math.Between(50, 90) + boostY;

    const duration = Phaser.Math.Between(350, 500);

    scene.tweens.add({
      targets: particle,
      x: finalX,
      duration: duration,
      ease: 'Linear'
    });

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

  // Purple flash
  const flash = scene.add.circle(x, y, 20, 0x9933ff, 0.7);
  flash.setDepth(DEPTH.EXPLOSION - 1);
  scene.tweens.add({
    targets: flash,
    scale: 1.8,
    alpha: 0,
    duration: 200,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy()
  });
}
