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

// Create or get the DOM container for avatars (overlaid on canvas)
function getAvatarContainer(): HTMLElement {
  let container = document.getElementById('hud-avatar-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hud-avatar-container';
    container.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      pointer-events: none;
      z-index: 10;
    `;
    document.body.appendChild(container);
  }
  return container;
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

  // Active players presence display using DOM elements (for CORS compatibility)
  const avatarSize = 28;
  const avatarGap = 4;
  const avatarY = 46;
  const avatarContainer = getAvatarContainer();

  // Publish own presence
  publishPresence();

  const updateActivePlayersDisplay = (players: ActivePlayer[]) => {
    // Clear existing avatar elements
    avatarContainer.innerHTML = '';

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

      // Create avatar wrapper
      const wrapper = document.createElement('div');
      const bgColor = player.isCurrentUser ? '#4488ff' : '#444444';
      wrapper.style.cssText = `
        position: absolute;
        right: ${scene.scale.width - currentX + avatarSize / 2}px;
        top: ${avatarY}px;
        width: ${avatarSize}px;
        height: ${avatarSize}px;
        background: ${bgColor};
        border-radius: 2px;
        overflow: hidden;
        opacity: 0.9;
      `;

      // Create avatar image
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      img.onerror = () => {
        // Hide wrapper if image fails to load
        wrapper.style.display = 'none';
      };

      wrapper.appendChild(img);
      avatarContainer.appendChild(wrapper);

      currentX -= avatarSize + avatarGap;
    }

    // If no players with avatars, show count as Phaser text
    if (playersWithAvatars.length === 0 && players.length > 0) {
      const countDiv = document.createElement('div');
      countDiv.style.cssText = `
        position: absolute;
        right: 16px;
        top: ${avatarY + avatarSize / 2 - 6}px;
        color: #666;
        font-family: monospace;
        font-size: 12px;
      `;
      countDiv.textContent = `${players.length} online`;
      avatarContainer.appendChild(countDiv);
    }
  };

  // Subscribe to active players
  const unsubPresence = subscribeToActivePlayers(updateActivePlayersDisplay);

  const cleanupPresence = () => {
    unsubPresence();
    avatarContainer.innerHTML = '';
  };

  return { scoreText, coinText, waveText, cleanupPresence };
}

export function updateScore(scoreText: Phaser.GameObjects.BitmapText, score: number): void {
  scoreText.setText(`Score: ${score}`);
}

export function updateWave(waveText: Phaser.GameObjects.BitmapText, waveNumber: number): void {
  waveText.setText(`Wave ${waveNumber}`);
}
