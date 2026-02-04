import { Resvg } from '@resvg/resvg-js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../public/assets');
const outputDir = path.join(__dirname, '../public/assets');

// Sprite definitions with their target render sizes
const sprites = [
  { name: 'player', file: 'player.svg', width: 48, height: 48 },
  { name: 'player-down', file: 'player-down.svg', width: 48, height: 48 },
  { name: 'player-left', file: 'player-left.svg', width: 48, height: 48 },
  { name: 'player-right', file: 'player-right.svg', width: 48, height: 48 },
  { name: 'player-stuck', file: 'player-stuck.svg', width: 64, height: 64 },
  { name: 'bullet', file: 'bullet.svg', width: 8, height: 16 },
  { name: 'zombie', file: 'zombie.svg', width: 40, height: 40 },
  { name: 'boss-zombie', file: 'boss-zombie.svg', width: 64, height: 64 },
  { name: 'tree', file: 'tree.svg', width: 40, height: 60 },
  { name: 'coin', file: 'coin.svg', width: 24, height: 24 },
  { name: 'shield', file: 'shield.svg', width: 32, height: 32 },
  { name: 'bubble', file: 'bubble.svg', width: 64, height: 64 },
  { name: 'jump', file: 'jump.svg', width: 64, height: 32 },
  { name: 'hole', file: 'hole.svg', width: 48, height: 32 },
  { name: 'robot', file: 'robot.svg', width: 40, height: 48 },
];

// Simple bin packing - arrange sprites in rows
function packSprites(sprites, maxWidth = 512) {
  const padding = 2;
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let totalWidth = 0;

  const frames = {};

  for (const sprite of sprites) {
    // Check if we need to start a new row
    if (x + sprite.width > maxWidth && x > 0) {
      x = 0;
      y += rowHeight + padding;
      rowHeight = 0;
    }

    frames[sprite.name] = {
      x,
      y,
      width: sprite.width,
      height: sprite.height,
    };

    totalWidth = Math.max(totalWidth, x + sprite.width);
    rowHeight = Math.max(rowHeight, sprite.height);
    x += sprite.width + padding;
  }

  return {
    atlasWidth: totalWidth,
    atlasHeight: y + rowHeight,
    frames,
  };
}

// Convert SVG to PNG buffer using resvg
function svgToPng(svgContent, width, height) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

async function generateAtlas() {
  console.log('Generating texture atlas...');

  const { atlasWidth, atlasHeight, frames } = packSprites(sprites);
  console.log(`Atlas size: ${atlasWidth}x${atlasHeight}`);

  // Create canvas
  const canvas = createCanvas(atlasWidth, atlasHeight);
  const ctx = canvas.getContext('2d');

  // Clear with transparent background
  ctx.clearRect(0, 0, atlasWidth, atlasHeight);

  // Load and draw each sprite
  for (const sprite of sprites) {
    const svgPath = path.join(assetsDir, sprite.file);
    const svgContent = fs.readFileSync(svgPath, 'utf8');

    try {
      // Convert SVG to PNG using resvg
      const pngBuffer = svgToPng(svgContent, sprite.width, sprite.height);

      // Load PNG into canvas
      const img = await loadImage(pngBuffer);
      const frame = frames[sprite.name];

      // Draw at correct position (may need to handle aspect ratio)
      ctx.drawImage(img, frame.x, frame.y, sprite.width, sprite.height);
      console.log(`  Added ${sprite.name} at (${frame.x}, ${frame.y}) ${sprite.width}x${sprite.height}`);
    } catch (err) {
      console.error(`  Failed to load ${sprite.name}: ${err.message}`);
    }
  }

  // Save atlas image as PNG
  const pngBuffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'atlas.png'), pngBuffer);
  console.log('Saved atlas.png');

  // Generate Phaser-compatible JSON atlas
  const atlasJson = {
    frames: {},
    meta: {
      image: 'atlas.png',
      size: { w: atlasWidth, h: atlasHeight },
      scale: 1,
    },
  };

  for (const [name, frame] of Object.entries(frames)) {
    atlasJson.frames[name] = {
      frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.width, h: frame.height },
      sourceSize: { w: frame.width, h: frame.height },
    };
  }

  fs.writeFileSync(
    path.join(outputDir, 'atlas.json'),
    JSON.stringify(atlasJson, null, 2)
  );
  console.log('Saved atlas.json');

  console.log(`\nAtlas generated: ${atlasWidth}x${atlasHeight} pixels, ${sprites.length} sprites`);
}

generateAtlas().catch(console.error);
