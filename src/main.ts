import Phaser from 'phaser';
import { MainScene } from './MainScene';

// Detect if we're in portrait mode on mobile and need to use swapped dimensions
function getGameDimensions() {
  const isMobile = 'ontouchstart' in window && window.innerWidth <= 1024;
  const isPortrait = window.innerHeight > window.innerWidth;

  if (isMobile && isPortrait) {
    // In portrait mode, game will be rotated 90deg by CSS
    // So we use viewport height as game width, viewport width as game height
    return { width: window.innerHeight, height: window.innerWidth };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

const dimensions = getGameDimensions();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: dimensions.width,
  height: dimensions.height,
  backgroundColor: '#f0f0f0',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [MainScene]
};

new Phaser.Game(config);
