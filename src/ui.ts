import Phaser from 'phaser';
import { saveHighScore } from './persistence';
import { playGameOver } from './sfxr';
import { DEPTH } from './constants';
import {
  submitHighScore,
  subscribeToGlobalHighScores,
  getLocalPlayerName,
  updatePlayerName,
  uploadAvatar,
  getLocalAvatarUrl,
  subscribeToCurrentPlayer,
  subscribeToActivePlayers,
  publishPresence,
  HighScore,
  Player,
  ActivePlayer,
} from './database';

export function showGameOver(
  scene: Phaser.Scene,
  score: number,
  coinCount: number,
  isMobile: boolean,
  onShop: (onShopClose: () => void) => void,
  onRestart: () => void
): void {
  playGameOver();
  scene.physics.pause();

  // Save local high score
  const { scores: localScores, rank: localRank } = saveHighScore(score);

  // Submit to global leaderboard
  submitHighScore(score);

  const screenW = scene.scale.width;
  const screenH = scene.scale.height;
  const centerX = screenW / 2;

  // Scale UI based on screen size
  const isSmallScreen = screenH < 400;
  const scale = isSmallScreen ? 0.65 : Math.min(1, screenH / 600);

  const titleSize = Math.round(64 * scale);
  const scoreSize = Math.round(28 * scale);
  const textSize = Math.round(20 * scale);
  const listSize = Math.round(18 * scale);
  const buttonSize = Math.round(24 * scale);
  const lineHeight = Math.round(24 * scale);
  const padding = Math.round(10 * scale);

  // Track all UI elements for cleanup
  const uiElements: Phaser.GameObjects.GameObject[] = [];

  // Add semi-transparent black background to frame the content
  const bgPadding = 30 * scale;
  const bgWidth = Math.min(screenW * 0.85, 400);
  const bgHeight = screenH * 0.9;
  const background = scene.add.rectangle(
    centerX,
    screenH / 2,
    bgWidth + bgPadding * 2,
    bgHeight,
    0x000000,
    0.7
  ).setScrollFactor(0).setDepth(DEPTH.OVERLAY_BG);
  uiElements.push(background);

  // Calculate vertical layout from top
  const startY = Math.max(20, screenH * 0.06);
  let currentY = startY;

  // GAME OVER title
  const title = scene.add.text(centerX, currentY, 'GAME OVER', {
    fontSize: `${titleSize}px`,
    color: '#ff0000'
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(title);
  currentY += titleSize + padding;

  // Score display
  const scoreColor = localRank > 0 ? '#cc8800' : '#ffffff';
  const newHighText = localRank === 1 ? ' - NEW BEST!' : localRank > 0 ? ` - #${localRank}` : '';
  const scoreText = scene.add.text(centerX, currentY, `Score: ${score}${newHighText}`, {
    fontSize: `${scoreSize}px`,
    color: scoreColor
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(scoreText);
  currentY += scoreSize + padding * 0.5;

  // Coins display
  const coinsText = scene.add.text(centerX, currentY, `Coins: ${coinCount}`, {
    fontSize: `${textSize}px`,
    color: '#b45309'
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(coinsText);
  currentY += textSize + padding;

  // Player contact card
  const cardWidth = Math.min(280 * scale, screenW * 0.7);
  const cardHeight = 70 * scale;
  const cardBg = scene.add.rectangle(
    centerX,
    currentY + cardHeight / 2,
    cardWidth,
    cardHeight,
    0x333333,
    0.8
  ).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(cardBg);

  // Avatar placeholder
  const avatarSize = 50 * scale;
  const avatarX = centerX - cardWidth / 2 + 15 * scale + avatarSize / 2;
  const avatarY = currentY + cardHeight / 2;

  const avatarBg = scene.add.rectangle(avatarX, avatarY, avatarSize, avatarSize, 0x555555)
    .setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(avatarBg);

  let avatarImage: Phaser.GameObjects.Image | null = null;
  let currentAvatarUrl = getLocalAvatarUrl();

  // Load avatar if exists
  const loadAvatar = (url: string | null | undefined) => {
    if (avatarImage) {
      avatarImage.destroy();
      avatarImage = null;
    }
    if (url) {
      const textureKey = `avatar_${Date.now()}`;
      scene.load.image(textureKey, url);
      scene.load.once('complete', () => {
        if (scene.textures.exists(textureKey)) {
          avatarImage = scene.add.image(avatarX, avatarY, textureKey)
            .setDisplaySize(avatarSize - 4, avatarSize - 4)
            .setScrollFactor(0)
            .setDepth(DEPTH.OVERLAY_INTERACTIVE);
          uiElements.push(avatarImage);
        }
      });
      scene.load.start();
    }
  };

  loadAvatar(currentAvatarUrl);

  // Avatar upload button (camera icon text)
  const avatarBtn = scene.add.text(avatarX, avatarY, '📷', {
    fontSize: `${Math.round(20 * scale)}px`
  }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE).setInteractive();
  uiElements.push(avatarBtn);

  // Hidden file input for avatar upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      avatarBtn.setText('...');
      const url = await uploadAvatar(file);
      if (url) {
        currentAvatarUrl = url;
        loadAvatar(url);
      }
      avatarBtn.setText('📷');
    }
  });

  avatarBtn.on('pointerdown', () => {
    fileInput.click();
  });

  // Player name
  let currentName = getLocalPlayerName();
  const nameX = avatarX + avatarSize / 2 + 15 * scale;
  const nameText = scene.add.text(nameX, avatarY - 12 * scale, currentName, {
    fontSize: `${Math.round(18 * scale)}px`,
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(nameText);

  const editBtn = scene.add.text(nameX, avatarY + 12 * scale, '✏️ Edit name', {
    fontSize: `${Math.round(14 * scale)}px`,
    color: '#88aaff'
  }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI).setInteractive();
  uiElements.push(editBtn);

  // Handle name editing
  const handleEditName = () => {
    const newName = prompt('Enter your name:', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      currentName = newName.trim().slice(0, 20);
      nameText.setText(currentName);
      updatePlayerName(currentName);
    }
  };

  editBtn.on('pointerdown', handleEditName);

  // Subscribe to player updates for real-time avatar sync
  const unsubPlayer = subscribeToCurrentPlayer((player) => {
    if (player) {
      if (player.name !== currentName) {
        currentName = player.name;
        nameText.setText(currentName);
      }
      if (player.avatarUrl && player.avatarUrl !== currentAvatarUrl) {
        currentAvatarUrl = player.avatarUrl;
        loadAvatar(currentAvatarUrl);
      }
    }
  });

  currentY += cardHeight + padding * 1.5;

  // Global High Scores header
  const hsHeader = scene.add.text(centerX, currentY, 'HIGH SCORE', {
    fontSize: `${textSize}px`,
    color: '#cccccc'
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(hsHeader);
  currentY += textSize + padding * 0.5;

  // Placeholder for high scores
  const highScoreY = currentY;
  const highScoreTexts: Phaser.GameObjects.Text[] = [];

  // Subscribe to global high scores
  let unsubGlobal: (() => void) | null = null;

  const highScoreAvatars: Phaser.GameObjects.GameObject[] = [];

  const updateHighScoreDisplay = (scores: HighScore[], currentPlayerId: string | null) => {
    // Clear existing elements
    highScoreTexts.forEach(t => t.destroy());
    highScoreTexts.length = 0;
    highScoreAvatars.forEach(a => a.destroy());
    highScoreAvatars.length = 0;

    let y = highScoreY;
    const buttonSpace = 60 * scale;
    const availableSpace = screenH - y - buttonSpace - 40;
    const rowHeight = Math.round(28 * scale);
    const maxToShow = Math.min(5, Math.floor(availableSpace / rowHeight));
    const avatarSize = Math.round(22 * scale);
    const listLeft = centerX - 120 * scale;

    for (let i = 0; i < Math.min(scores.length, maxToShow); i++) {
      const hs = scores[i];
      const isOwnScore = hs.playerId === currentPlayerId;
      const color = isOwnScore ? '#cc8800' : '#ffffff';
      const displayName = hs.playerName || 'Anonymous';

      // Rank number
      const rankText = scene.add.text(listLeft, y + rowHeight / 2, `${i + 1}.`, {
        fontSize: `${listSize}px`,
        color: '#888888'
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
      highScoreTexts.push(rankText);
      uiElements.push(rankText);

      // Avatar background
      const avatarX = listLeft + 35 * scale;
      const avatarBg = scene.add.rectangle(avatarX, y + rowHeight / 2 - 7, avatarSize, avatarSize, 0x444444)
        .setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
      highScoreAvatars.push(avatarBg);
      uiElements.push(avatarBg);

      // Load avatar image if available
      if (hs.playerAvatarUrl) {
        const textureKey = `hs_avatar_${i}_${Date.now()}`;
        const hsAvatarY = y + rowHeight / 2;
        scene.load.image(textureKey, hs.playerAvatarUrl);
        scene.load.once('complete', () => {
          if (scene.textures.exists(textureKey)) {
            const avatarImg = scene.add.image(avatarX, hsAvatarY, textureKey)
              .setDisplaySize(avatarSize - 2, avatarSize - 2)
              .setScrollFactor(0)
              .setDepth(DEPTH.OVERLAY_INTERACTIVE);
            highScoreAvatars.push(avatarImg);
            uiElements.push(avatarImg);
          }
        });
        scene.load.start();
      }

      // Name and score
      const nameScoreText = scene.add.text(avatarX + avatarSize / 2 + 8 * scale, y + rowHeight / 2,
        `${displayName}: ${hs.score}`, {
        fontSize: `${listSize}px`,
        color
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
      highScoreTexts.push(nameScoreText);
      uiElements.push(nameScoreText);

      y += rowHeight;
    }

    if (scores.length === 0) {
      const noScores = scene.add.text(centerX, y, 'No scores yet!', {
        fontSize: `${listSize}px`,
        color: '#aaaaaa'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
      highScoreTexts.push(noScores);
      uiElements.push(noScores);
    }
  };

  // Start subscription
  unsubGlobal = subscribeToGlobalHighScores(updateHighScoreDisplay, 5);

  // Personal best is shown in gold in the global list, no separate section needed

  // Position buttons at bottom with margin
  const buttonY = screenH - 30 * scale;
  const buttonGap = Math.max(70, screenW * 0.12);

  const shopBtn = scene.add.text(centerX - buttonGap, buttonY, '[ SHOP ]', {
    fontSize: `${buttonSize}px`,
    color: '#333333',
    backgroundColor: '#88cc88',
    padding: { x: padding, y: padding * 0.6 }
  }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(shopBtn);

  // Hide/show game over UI functions for shop overlay
  const hideGameOverUI = () => {
    uiElements.forEach(el => {
      if ('setVisible' in el) {
        (el as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      }
    });
  };
  const showGameOverUI = () => {
    uiElements.forEach(el => {
      if ('setVisible' in el) {
        (el as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
      }
    });
  };

  shopBtn.on('pointerdown', () => {
    hideGameOverUI();
    onShop(showGameOverUI);
  });

  const restartText = isMobile ? '[ PLAY ]' : '[ PLAY ] (R)';
  const restartBtn = scene.add.text(centerX + buttonGap, buttonY, restartText, {
    fontSize: `${buttonSize}px`,
    color: '#333333',
    backgroundColor: '#cccccc',
    padding: { x: padding, y: padding * 0.6 }
  }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
  uiElements.push(restartBtn);

  const cleanup = () => {
    if (unsubGlobal) unsubGlobal();
    if (unsubPlayer) unsubPlayer();
    if (fileInput.parentNode) {
      fileInput.parentNode.removeChild(fileInput);
    }
  };

  restartBtn.on('pointerdown', () => {
    cleanup();
    onRestart();
  });

  if (!isMobile) {
    const keyHandler = () => {
      cleanup();
      onRestart();
    };
    scene.input.keyboard!.once('keydown-R', keyHandler);
  }
}

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
