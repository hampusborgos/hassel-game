import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

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
  { name: 'zombie-hit', file: 'zombie.svg', width: 40, height: 40, isHitVariant: true },
  { name: 'boss-zombie', file: 'boss-zombie.svg', width: 64, height: 64 },
  { name: 'boss-zombie-hit', file: 'boss-zombie.svg', width: 64, height: 64, isHitVariant: true },
  { name: 'tree', file: 'tree.svg', width: 40, height: 60 },
  { name: 'coin', file: 'coin.svg', width: 24, height: 24 },
  { name: 'shield', file: 'shield.svg', width: 32, height: 32 },
  { name: 'bubble', file: 'bubble.svg', width: 64, height: 64 },
  { name: 'jump', file: 'jump.svg', width: 64, height: 32 },
  { name: 'hole', file: 'hole.svg', width: 48, height: 32 },
  { name: 'robot', file: 'robot.svg', width: 40, height: 48 },
  { name: 'robot-hit', file: 'robot.svg', width: 40, height: 48, isHitVariant: true },
  { name: 'ender-zombie', file: 'ender-zombie.svg', width: 48, height: 48 },
  { name: 'ender-zombie-hit', file: 'ender-zombie.svg', width: 48, height: 48, isHitVariant: true },
  { name: 'snowmonster', file: 'snowmonster.svg', width: 64, height: 64 },
  { name: 'snowmonster-hit', file: 'snowmonster.svg', width: 64, height: 64, isHitVariant: true },
  { name: 'snowmonster-throw', file: 'snowmonster-throw.svg', width: 64, height: 64 },
  { name: 'snowmonster-throw-hit', file: 'snowmonster-throw.svg', width: 64, height: 64, isHitVariant: true },
  { name: 'snowball', file: 'snowball.svg', width: 16, height: 16 },
];

// Round up to next power of 2 (required for iOS WebGL compatibility)
function nextPowerOf2(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

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

  // Pad to power-of-2 dimensions for iOS WebGL compatibility
  const contentWidth = totalWidth;
  const contentHeight = y + rowHeight;
  const atlasWidth = nextPowerOf2(contentWidth);
  const atlasHeight = nextPowerOf2(contentHeight);

  return {
    atlasWidth,
    atlasHeight,
    contentWidth,
    contentHeight,
    frames,
  };
}

// Convert SVG to PNG data using resvg, scaled to exact target dimensions
function svgToPngData(svgContent, targetWidth, targetHeight) {
  // Get the SVG's natural size from its viewBox or width/height attributes
  const probe = new Resvg(svgContent);
  const originalWidth = probe.width;
  const originalHeight = probe.height;

  // Calculate scale to fit within target dimensions while preserving aspect ratio
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;
  const scale = Math.min(scaleX, scaleY);

  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'zoom',
      value: scale,
    },
  });

  const rendered = resvg.render();
  const renderedWidth = rendered.width;
  const renderedHeight = rendered.height;

  // If still larger than target, we need to crop/constrain
  const finalWidth = Math.min(renderedWidth, targetWidth);
  const finalHeight = Math.min(renderedHeight, targetHeight);

  return {
    data: rendered.pixels,
    width: renderedWidth,
    height: renderedHeight,
    finalWidth,
    finalHeight,
    // Offset to center the sprite within the frame
    offsetX: Math.floor((targetWidth - finalWidth) / 2),
    offsetY: Math.floor((targetHeight - finalHeight) / 2),
  };
}

// Convert all non-transparent pixels to white (for hit flash effect)
function makeWhiteVersion(data, width, height) {
  const white = Buffer.from(data);
  for (let i = 0; i < white.length; i += 4) {
    if (white[i + 3] > 0) { // If pixel has alpha (is visible)
      white[i] = 255;     // R = white
      white[i + 1] = 255; // G = white
      white[i + 2] = 255; // B = white
      // Keep original alpha unchanged
    }
  }
  return white;
}

async function generateAtlas() {
  console.log('Generating texture atlas...');

  const { atlasWidth, atlasHeight, contentWidth, contentHeight, frames } = packSprites(sprites);
  console.log(`Content size: ${contentWidth}x${contentHeight}`);
  console.log(`Atlas size (power-of-2 for iOS): ${atlasWidth}x${atlasHeight}`);

  // Create output PNG using pngjs (pure JS, better compatibility)
  const atlas = new PNG({
    width: atlasWidth,
    height: atlasHeight,
    colorType: 6, // RGBA
    inputColorType: 6,
    bitDepth: 8,
  });

  // Initialize with transparent pixels
  for (let i = 0; i < atlas.data.length; i += 4) {
    atlas.data[i] = 0;     // R
    atlas.data[i + 1] = 0; // G
    atlas.data[i + 2] = 0; // B
    atlas.data[i + 3] = 0; // A (transparent)
  }

  // Render and place each sprite
  for (const sprite of sprites) {
    const svgPath = path.join(assetsDir, sprite.file);
    const svgContent = fs.readFileSync(svgPath, 'utf8');

    try {
      const { data, width, height, finalWidth, finalHeight, offsetX, offsetY } = svgToPngData(svgContent, sprite.width, sprite.height);
      const frame = frames[sprite.name];

      // For hit variants, convert all pixels to white
      const pixelData = sprite.isHitVariant ? makeWhiteVersion(data, width, height) : data;

      // Copy pixels to atlas (resvg returns RGBA data), centered within frame
      // Only copy up to finalWidth/finalHeight to stay within frame bounds
      for (let srcY = 0; srcY < finalHeight; srcY++) {
        for (let srcX = 0; srcX < finalWidth; srcX++) {
          const srcIdx = (srcY * width + srcX) * 4;
          const dstX = frame.x + offsetX + srcX;
          const dstY = frame.y + offsetY + srcY;

          // Bounds check
          if (dstX >= 0 && dstX < atlasWidth && dstY >= 0 && dstY < atlasHeight) {
            const dstIdx = (dstY * atlasWidth + dstX) * 4;
            atlas.data[dstIdx] = pixelData[srcIdx];         // R
            atlas.data[dstIdx + 1] = pixelData[srcIdx + 1]; // G
            atlas.data[dstIdx + 2] = pixelData[srcIdx + 2]; // B
            atlas.data[dstIdx + 3] = pixelData[srcIdx + 3]; // A
          }
        }
      }

      console.log(`  Added ${sprite.name} at (${frame.x}, ${frame.y}) ${sprite.width}x${sprite.height}${sprite.isHitVariant ? ' (hit variant)' : ''}`);
    } catch (err) {
      console.error(`  Failed to load ${sprite.name}: ${err.message}`);
    }
  }

  // Save atlas image as PNG
  const outputPath = path.join(outputDir, 'atlas.png');
  const buffer = PNG.sync.write(atlas, { colorType: 6 });
  fs.writeFileSync(outputPath, buffer);
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

  console.log(`\nAtlas generated: ${atlasWidth}x${atlasHeight} pixels (power-of-2), ${sprites.length} sprites`);
}

generateAtlas().catch(console.error);
