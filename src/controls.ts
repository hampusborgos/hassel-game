import Phaser from 'phaser';
import { VirtualJoystick } from './types';
import { JOYSTICK_RADIUS, THUMB_RADIUS, DEPTH } from './constants';
import { UI_FONT_KEY } from './bitmapFont';

export function createMobileControls(scene: Phaser.Scene): {
  leftJoystick: VirtualJoystick;
  rightJoystick: VirtualJoystick;
} {
  // Enable multi-touch
  scene.input.addPointer(1);

  const leftX = 100;
  const rightX = scene.scale.width - 100;
  const joystickY = scene.scale.height - 100;

  // Left joystick (movement)
  const leftBase = scene.add.circle(leftX, joystickY, JOYSTICK_RADIUS, 0x444444, 0.5);
  const leftThumb = scene.add.circle(leftX, joystickY, THUMB_RADIUS, 0x888888, 0.8);
  leftBase.setDepth(DEPTH.JOYSTICK_BASE).setScrollFactor(0);
  leftThumb.setDepth(DEPTH.JOYSTICK_THUMB).setScrollFactor(0);

  const leftJoystick: VirtualJoystick = {
    base: leftBase,
    thumb: leftThumb,
    pointerId: null,
    vector: new Phaser.Math.Vector2(0, 0),
    baseX: leftX,
    baseY: joystickY
  };

  // Right joystick (aim/shoot)
  const rightBase = scene.add.circle(rightX, joystickY, JOYSTICK_RADIUS, 0x444444, 0.5);
  const rightThumb = scene.add.circle(rightX, joystickY, THUMB_RADIUS, 0x888888, 0.8);
  rightBase.setDepth(DEPTH.JOYSTICK_BASE).setScrollFactor(0);
  rightThumb.setDepth(DEPTH.JOYSTICK_THUMB).setScrollFactor(0);

  const rightJoystick: VirtualJoystick = {
    base: rightBase,
    thumb: rightThumb,
    pointerId: null,
    vector: new Phaser.Math.Vector2(0, 0),
    baseX: rightX,
    baseY: joystickY
  };

  // Fullscreen button (hide if running as standalone PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (!isStandalone) {
    // Create background rectangle for the button
    const buttonBg = scene.add.rectangle(scene.scale.width / 2, 50, 160, 40, 0xcccccc)
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0)
      .setInteractive();

    const fsButton = scene.add.bitmapText(scene.scale.width / 2, 50, UI_FONT_KEY, '[ Fullscreen ]', 20)
      .setTint(0x333333)
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD + 1)
      .setScrollFactor(0);

    buttonBg.on('pointerdown', () => {
      if (scene.scale.isFullscreen) {
        scene.scale.stopFullscreen();
      } else {
        scene.scale.startFullscreen();
      }
    });
  }

  // Touch handlers
  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const leftDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, leftJoystick.baseX, leftJoystick.baseY);
    const rightDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, rightJoystick.baseX, rightJoystick.baseY);

    if (leftDist < JOYSTICK_RADIUS * 2 && leftJoystick.pointerId === null) {
      leftJoystick.pointerId = pointer.id;
    } else if (rightDist < JOYSTICK_RADIUS * 2 && rightJoystick.pointerId === null) {
      rightJoystick.pointerId = pointer.id;
    }
  });

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    updateJoystick(leftJoystick, pointer);
    updateJoystick(rightJoystick, pointer);
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (leftJoystick.pointerId === pointer.id) {
      resetJoystick(leftJoystick);
    }
    if (rightJoystick.pointerId === pointer.id) {
      resetJoystick(rightJoystick);
    }
  });

  return { leftJoystick, rightJoystick };
}

export function updateJoystick(joystick: VirtualJoystick, pointer: Phaser.Input.Pointer): void {
  if (joystick.pointerId !== pointer.id) return;

  const dx = pointer.x - joystick.baseX;
  const dy = pointer.y - joystick.baseY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = JOYSTICK_RADIUS;

  if (distance > 0) {
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);

    joystick.thumb.x = joystick.baseX + Math.cos(angle) * clampedDistance;
    joystick.thumb.y = joystick.baseY + Math.sin(angle) * clampedDistance;

    joystick.vector.x = (clampedDistance / maxDistance) * Math.cos(angle);
    joystick.vector.y = (clampedDistance / maxDistance) * Math.sin(angle);
  }
}

export function resetJoystick(joystick: VirtualJoystick): void {
  joystick.pointerId = null;
  joystick.thumb.x = joystick.baseX;
  joystick.thumb.y = joystick.baseY;
  joystick.vector.set(0, 0);
}
