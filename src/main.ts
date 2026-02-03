import Phaser from 'phaser';
import { MainScene } from './MainScene';

// Detect if we're in portrait mode on mobile and need to use swapped dimensions
function getGameDimensions() {
  const isMobile = 'ontouchstart' in window && window.innerWidth <= 1024;
  const isPortrait = window.innerHeight > window.innerWidth;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Use reduced resolution on iOS for performance
  if (isIOS) {
    if (isPortrait) {
      // Portrait: game rotated 90deg, so swap width/height
      return { width: 600, height: 450 };
    }
    return { width: 600, height: 450 };
  }

  if (isMobile && isPortrait) {
    // In portrait mode, game will be rotated 90deg by CSS
    // So we use viewport height as game width, viewport width as game height
    return { width: window.innerHeight, height: window.innerWidth };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

const dimensions = getGameDimensions();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,  // Force WebGL - Safari Canvas is very slow
  width: dimensions.width,
  height: dimensions.height,
  backgroundColor: '#f0f0f0',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: false,           // Faster rendering
    pixelArt: false,
    roundPixels: true,          // Avoid sub-pixel rendering overhead
    powerPreference: 'high-performance'  // Request dedicated GPU
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

const game = new Phaser.Game(config);

// Log renderer type for debugging
game.events.once('ready', () => {
  console.log('Phaser renderer:', game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas');
});
