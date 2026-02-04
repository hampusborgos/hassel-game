import Phaser from 'phaser';
import { MainScene } from './MainScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,  // Force WebGL - Safari Canvas is very slow
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#f0f0f0',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER
  },
  render: {
    antialias: false,           // Faster rendering
    pixelArt: false,
    roundPixels: true,          // Avoid sub-pixel rendering overhead
    powerPreference: 'high-performance',  // Request dedicated GPU
    premultipliedAlpha: false,  // PNG uses straight alpha, not premultiplied
    batchSize: 4096,            // Increase batch size for more sprites
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
