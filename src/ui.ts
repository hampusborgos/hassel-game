import Phaser from 'phaser';
import { DEPTH } from './constants';
import {
  publishPresence,
  subscribeToActivePlayers,
  ActivePlayer,
} from './database';

export interface HUDElements {
  scoreText: Phaser.GameObjects.Text;
  coinText: Phaser.GameObjects.Text;
  waveText: Phaser.GameObjects.Text;
  cleanupPresence: () => void;
}

export function createHUD(
  scene: Phaser.Scene,
  initialCoinCount: number
): HUDElements {
  const scoreText = scene.add.text(16, 16, 'Score: 0', {
    fontSize: '24px',
    color: '#333333'
  }).setScrollFactor(0).setDepth(DEPTH.HUD);

  const coinText = scene.add.text(16, 46, `Coins: ${initialCoinCount}`, {
    fontSize: '20px',
    color: '#b45309'
  }).setScrollFactor(0).setDepth(DEPTH.HUD);

  const waveText = scene.add.text(scene.scale.width - 16, 16, 'Wave 1', {
    fontSize: '24px',
    color: '#333333'
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.HUD);

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
      const countText = scene.add.text(
        startX,
        avatarY + avatarSize / 2,
        `${players.length} online`,
        {
          fontSize: '12px',
          color: '#666666'
        }
      ).setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
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

export function updateScore(scoreText: Phaser.GameObjects.Text, score: number): void {
  scoreText.setText(`Score: ${score}`);
}

export function updateWave(waveText: Phaser.GameObjects.Text, waveNumber: number): void {
  waveText.setText(`Wave ${waveNumber}`);
}
