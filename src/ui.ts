import Phaser from 'phaser';
import { DEPTH } from './constants';
import {
  publishPresence,
  subscribeToActivePlayers,
  ActivePlayer,
} from './database';
import { UI_FONT_KEY } from './bitmapFont';

export interface HUDElements {
  scoreText: Phaser.GameObjects.BitmapText;
  coinText: Phaser.GameObjects.BitmapText;
  waveText: Phaser.GameObjects.BitmapText;
  cleanupPresence: () => void;
}

export function createHUD(
  scene: Phaser.Scene,
  initialCoinCount: number
): HUDElements {
  const scoreText = scene.add.bitmapText(16, 16, UI_FONT_KEY, 'Score: 0', 24)
    .setTint(0x333333)
    .setScrollFactor(0)
    .setDepth(DEPTH.HUD);

  const coinText = scene.add.bitmapText(16, 46, UI_FONT_KEY, `Coins: ${initialCoinCount}`, 20)
    .setTint(0xb45309)
    .setScrollFactor(0)
    .setDepth(DEPTH.HUD);

  const waveText = scene.add.bitmapText(scene.scale.width - 16, 16, UI_FONT_KEY, 'Wave 1', 24)
    .setTint(0x333333)
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(DEPTH.HUD);

  // Active players presence display (below wave text, horizontal stack)
  const avatarSize = 28;
  const avatarGap = 4;
  const avatarY = 46;
  const avatarElements: Phaser.GameObjects.GameObject[] = [];
  const loadedTextures: string[] = [];

  // Publish own presence
  publishPresence();

  const updateActivePlayersDisplay = (players: ActivePlayer[]) => {
    // Clear existing avatar elements
    avatarElements.forEach(el => el.destroy());
    avatarElements.length = 0;

    // Calculate starting X position (right-aligned from wave text)
    const startX = scene.scale.width - 16;
    let currentX = startX;

    // Show avatars for players who have them (limit to 8 to avoid overflow)
    const playersWithAvatars = players
      .filter(p => p.presence.avatarUrl)
      .slice(0, 8);

    for (let i = 0; i < playersWithAvatars.length; i++) {
      const player = playersWithAvatars[i];
      const avatarUrl = player.presence.avatarUrl!;

      // Avatar background - highlight current user with a different color
      const bgColor = player.isCurrentUser ? 0x4488ff : 0x444444;
      const avatarBg = scene.add.rectangle(
        currentX - avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize,
        avatarSize,
        bgColor,
        0.8
      ).setScrollFactor(0).setDepth(DEPTH.HUD);
      avatarElements.push(avatarBg);

      // Load and display avatar image
      const textureKey = `presence_avatar_${player.oddjobId}_${Date.now()}`;
      loadedTextures.push(textureKey);

      const avatarX = currentX - avatarSize / 2;
      scene.load.image(textureKey, avatarUrl);
      scene.load.once('complete', () => {
        if (scene.textures.exists(textureKey)) {
          const avatarImg = scene.add.image(avatarX, avatarY + avatarSize / 2, textureKey)
            .setDisplaySize(avatarSize - 2, avatarSize - 2)
            .setScrollFactor(0)
            .setDepth(DEPTH.HUD + 1);
          avatarElements.push(avatarImg);
        }
      });
      scene.load.start();

      currentX -= avatarSize + avatarGap;
    }

    // If no players with avatars, show a subtle indicator
    if (playersWithAvatars.length === 0 && players.length > 0) {
      const countText = scene.add.bitmapText(
        startX,
        avatarY + avatarSize / 2,
        UI_FONT_KEY,
        `${players.length} online`,
        12
      ).setTint(0x666666).setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
      avatarElements.push(countText);
    }
  };

  // Subscribe to active players
  const unsubPresence = subscribeToActivePlayers(updateActivePlayersDisplay);

  const cleanupPresence = () => {
    unsubPresence();
    avatarElements.forEach(el => el.destroy());
    // Clean up loaded textures
    loadedTextures.forEach(key => {
      if (scene.textures.exists(key)) {
        scene.textures.remove(key);
      }
    });
  };

  return { scoreText, coinText, waveText, cleanupPresence };
}

export function updateScore(scoreText: Phaser.GameObjects.BitmapText, score: number): void {
  scoreText.setText(`Score: ${score}`);
}

export function updateWave(waveText: Phaser.GameObjects.BitmapText, waveNumber: number): void {
  waveText.setText(`Wave ${waveNumber}`);
}
