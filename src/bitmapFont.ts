import Phaser from 'phaser';

/**
 * Generates a bitmap font texture at runtime to avoid multiple canvas compositing on iOS.
 * This creates a single texture atlas with all characters, eliminating the need for
 * individual canvas textures that Phaser Text objects create.
 */
export function generateBitmapFont(scene: Phaser.Scene): void {
  const fontKey = 'ui-font';

  // Check if already generated (for scene restarts)
  if (scene.cache.bitmapFont.exists(fontKey)) {
    return;
  }

  const fontSize = 32;
  const fontFamily = 'Arial, Helvetica, sans-serif';
  const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

  // Create a temporary canvas to measure characters
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px ${fontFamily}`;

  // Measure each character and calculate texture size
  const charData: { char: string; width: number }[] = [];
  let totalWidth = 0;
  const padding = 2;
  const lineHeight = fontSize + padding * 2;

  for (const char of chars) {
    const metrics = ctx.measureText(char);
    const width = Math.ceil(metrics.width) + padding * 2;
    charData.push({ char, width });
    totalWidth += width;
  }

  // Create texture (single row for simplicity)
  const textureWidth = Math.min(totalWidth, 2048);
  const rows = Math.ceil(totalWidth / 2048);
  const textureHeight = rows * lineHeight;

  canvas.width = textureWidth;
  canvas.height = textureHeight;

  // Clear and set up context for drawing
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, textureWidth, textureHeight);
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';

  // Draw characters and build font data
  const fontData: Phaser.Types.GameObjects.BitmapText.BitmapFontData = {
    font: fontKey,
    size: fontSize,
    lineHeight: lineHeight,
    chars: {}
  };

  let x = 0;
  let y = 0;

  for (let i = 0; i < charData.length; i++) {
    const { char, width } = charData[i];

    // Wrap to next row if needed
    if (x + width > textureWidth) {
      x = 0;
      y += lineHeight;
    }

    // Draw character
    ctx.fillText(char, x + padding, y + padding);

    // Store character data with all required Phaser properties
    const charCode = char.charCodeAt(0);
    fontData.chars[charCode] = {
      x: x,
      y: y,
      width: width,
      height: lineHeight,
      centerX: width / 2,
      centerY: lineHeight / 2,
      xOffset: 0,
      yOffset: 0,
      xAdvance: width - padding,
      // UV texture coordinates (0-1 range)
      u0: x / textureWidth,
      v0: y / textureHeight,
      u1: (x + width) / textureWidth,
      v1: (y + lineHeight) / textureHeight,
      data: {},
      kerning: {}
    };

    x += width;
  }

  // Add the texture to Phaser
  scene.textures.addCanvas(fontKey, canvas);

  // Register the bitmap font
  scene.cache.bitmapFont.add(fontKey, {
    data: fontData,
    texture: fontKey,
    frame: null
  });
}

/**
 * Font key to use with scene.add.bitmapText()
 */
export const UI_FONT_KEY = 'ui-font';
