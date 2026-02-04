import Phaser from 'phaser';
import { VirtualJoystick } from './types';
import { JOYSTICK_RADIUS, THUMB_RADIUS, DEPTH } from './constants';
import { UI_FONT_KEY } from './bitmapFont';

// Helper to get safe area insets from CSS custom properties
function getSafeAreaInsets(): { top: number; right: number; bottom: number; left: number } {
  const container = document.getElementById('game-container');
  if (!container) return { top: 0, right: 0, bottom: 0, left: 0 };

  const style = getComputedStyle(container);
  return {
    top: parseInt(style.getPropertyValue('--sai-top')) || 0,
    right: parseInt(style.getPropertyValue('--sai-right')) || 0,
    bottom: parseInt(style.getPropertyValue('--sai-bottom')) || 0,
    left: parseInt(style.getPropertyValue('--sai-left')) || 0
  };
}

export interface MobileControls {
  leftJoystick: VirtualJoystick;
  rightJoystick: VirtualJoystick;
  fullscreenButton?: {
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.BitmapText;
  };
}

export function createMobileControls(scene: Phaser.Scene): MobileControls {
  // Enable multi-touch
  scene.input.addPointer(1);

  const insets = getSafeAreaInsets();
  const leftX = 100 + insets.left;
  const rightX = scene.scale.width - 100 - insets.right;
  const joystickY = scene.scale.height - 100 - insets.bottom;

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

  let fullscreenButton: MobileControls['fullscreenButton'];

  if (!isStandalone) {
    // Create background rectangle for the button
    const buttonY = 50 + insets.top;
    const buttonBg = scene.add.rectangle(scene.scale.width / 2, buttonY, 160, 40, 0xcccccc)
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setScrollFactor(0)
      .setInteractive();

    const fsButton = scene.add.bitmapText(scene.scale.width / 2, buttonY, UI_FONT_KEY, '[ Fullscreen ]', 20)
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

    fullscreenButton = { bg: buttonBg, text: fsButton };
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

  return { leftJoystick, rightJoystick, fullscreenButton };
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

export function repositionMobileControls(
  controls: MobileControls,
  width: number,
  height: number
): void {
  const insets = getSafeAreaInsets();
  const leftX = 100 + insets.left;
  const rightX = width - 100 - insets.right;
  const joystickY = height - 100 - insets.bottom;

  controls.leftJoystick.baseX = leftX;
  controls.leftJoystick.baseY = joystickY;
  controls.leftJoystick.base.setPosition(leftX, joystickY);
  controls.leftJoystick.thumb.setPosition(leftX, joystickY);

  controls.rightJoystick.baseX = rightX;
  controls.rightJoystick.baseY = joystickY;
  controls.rightJoystick.base.setPosition(rightX, joystickY);
  controls.rightJoystick.thumb.setPosition(rightX, joystickY);

  // Reposition fullscreen button
  if (controls.fullscreenButton) {
    const buttonY = 50 + insets.top;
    controls.fullscreenButton.bg.setPosition(width / 2, buttonY);
    controls.fullscreenButton.text.setPosition(width / 2, buttonY);
  }
}

// Backwards compatibility alias
export function repositionJoysticks(
  leftJoystick: VirtualJoystick,
  rightJoystick: VirtualJoystick,
  width: number,
  height: number
): void {
  repositionMobileControls({ leftJoystick, rightJoystick }, width, height);
}
