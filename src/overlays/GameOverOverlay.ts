import { saveHighScore } from '../persistence';
import { playGameOver } from '../sfxr';
import {
  submitHighScore,
  subscribeToGlobalHighScores,
  getLocalPlayerName,
  updatePlayerName,
  uploadAvatar,
  getLocalAvatarUrl,
  subscribeToCurrentPlayer,
  HighScore,
} from '../database';

export interface GameOverConfig {
  score: number;
  coinCount: number;
  isMobile: boolean;
  onShop: () => void;
  onRestart: () => void;
}

export class GameOverOverlay {
  private container: HTMLElement;
  private panel: HTMLElement;
  private unsubGlobal: (() => void) | null = null;
  private unsubPlayer: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private fileInput: HTMLInputElement | null = null;
  private config: GameOverConfig | null = null;

  // References to dynamic elements
  private avatarImage: HTMLImageElement | null = null;
  private nameElement: HTMLElement | null = null;
  private highScoresList: HTMLElement | null = null;
  private currentAvatarUrl: string | null = null;
  private currentName: string = '';

  constructor() {
    this.container = document.getElementById('game-over-overlay')!;
    this.panel = document.createElement('div');
    this.panel.className = 'game-over-panel';
    this.container.appendChild(this.panel);
  }

  show(config: GameOverConfig): void {
    this.config = config;
    this.cleanup();

    playGameOver();

    // Save local high score
    const { rank: localRank } = saveHighScore(config.score);

    // Submit to global leaderboard
    submitHighScore(config.score);

    // Build the UI
    this.buildUI(config, localRank);

    // Setup subscriptions
    this.setupSubscriptions();

    // Setup keyboard shortcut (desktop only)
    if (!config.isMobile) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'r' || e.key === 'R') {
          this.handleRestart();
        }
      };
      document.addEventListener('keydown', this.keyHandler);
    }

    // Show the overlay
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.cleanup();
  }

  private buildUI(config: GameOverConfig, localRank: number): void {
    this.panel.innerHTML = '';

    // Title
    const title = document.createElement('h1');
    title.className = 'game-over-title';
    title.textContent = 'GAME OVER';
    this.panel.appendChild(title);

    // Score
    const scoreText = document.createElement('p');
    scoreText.className = 'game-over-score';
    const newHighText = localRank === 1 ? ' - NEW BEST!' : localRank > 0 ? ` - #${localRank}` : '';
    scoreText.textContent = `Score: ${config.score}${newHighText}`;
    if (localRank > 0) {
      scoreText.classList.add('highlight');
    }
    this.panel.appendChild(scoreText);

    // Coins
    const coinsText = document.createElement('p');
    coinsText.className = 'game-over-coins';
    coinsText.textContent = `Coins: ${config.coinCount}`;
    this.panel.appendChild(coinsText);

    // Player card
    this.buildPlayerCard();

    // High scores section
    this.buildHighScoresSection();

    // Buttons
    this.buildButtons(config);
  }

  private buildPlayerCard(): void {
    this.currentName = getLocalPlayerName();
    this.currentAvatarUrl = getLocalAvatarUrl();

    const card = document.createElement('div');
    card.className = 'player-card';

    // Avatar container
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatar-container';

    const avatarBg = document.createElement('div');
    avatarBg.className = 'avatar-bg';

    this.avatarImage = document.createElement('img');
    this.avatarImage.className = 'avatar-image';
    if (this.currentAvatarUrl) {
      this.avatarImage.src = this.currentAvatarUrl;
    }
    this.avatarImage.style.display = this.currentAvatarUrl ? 'block' : 'none';
    avatarBg.appendChild(this.avatarImage);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'avatar-upload-btn';
    uploadBtn.textContent = '\uD83D\uDCF7';
    uploadBtn.onclick = () => this.handleAvatarUpload();

    avatarContainer.appendChild(avatarBg);
    avatarContainer.appendChild(uploadBtn);

    // Player info
    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';

    this.nameElement = document.createElement('p');
    this.nameElement.className = 'player-name';
    this.nameElement.textContent = this.currentName;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-name-btn';
    editBtn.textContent = '\u270F\uFE0F Edit name';
    editBtn.onclick = () => this.handleEditName();

    playerInfo.appendChild(this.nameElement);
    playerInfo.appendChild(editBtn);

    card.appendChild(avatarContainer);
    card.appendChild(playerInfo);
    this.panel.appendChild(card);

    // Hidden file input for avatar upload
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    this.fileInput.onchange = (e) => this.handleFileSelected(e);
    document.body.appendChild(this.fileInput);
  }

  private buildHighScoresSection(): void {
    const section = document.createElement('div');
    section.className = 'high-scores-section';

    const header = document.createElement('h2');
    header.className = 'high-scores-header';
    header.textContent = 'HIGH SCORE';
    section.appendChild(header);

    this.highScoresList = document.createElement('ul');
    this.highScoresList.className = 'high-scores-list';
    section.appendChild(this.highScoresList);

    this.panel.appendChild(section);
  }

  private buildButtons(config: GameOverConfig): void {
    const buttons = document.createElement('div');
    buttons.className = 'overlay-buttons';

    const shopBtn = document.createElement('button');
    shopBtn.className = 'overlay-btn shop';
    shopBtn.textContent = '[ SHOP ]';
    shopBtn.onclick = () => {
      this.hide();
      config.onShop();
    };

    const playBtn = document.createElement('button');
    playBtn.className = 'overlay-btn play';
    playBtn.textContent = config.isMobile ? '[ PLAY ]' : '[ PLAY ] (R)';
    playBtn.onclick = () => this.handleRestart();

    buttons.appendChild(shopBtn);
    buttons.appendChild(playBtn);
    this.panel.appendChild(buttons);
  }

  private setupSubscriptions(): void {
    // Subscribe to player updates for real-time avatar/name sync
    this.unsubPlayer = subscribeToCurrentPlayer((player) => {
      if (player) {
        if (player.name !== this.currentName) {
          this.currentName = player.name;
          if (this.nameElement) {
            this.nameElement.textContent = this.currentName;
          }
        }
        if (player.avatarUrl && player.avatarUrl !== this.currentAvatarUrl) {
          this.currentAvatarUrl = player.avatarUrl;
          if (this.avatarImage) {
            this.avatarImage.src = this.currentAvatarUrl;
            this.avatarImage.style.display = 'block';
          }
        }
      }
    });

    // Subscribe to global high scores
    this.unsubGlobal = subscribeToGlobalHighScores(
      (scores, currentPlayerId) => this.renderHighScores(scores, currentPlayerId),
      5
    );
  }

  private renderHighScores(scores: HighScore[], currentPlayerId: string | null): void {
    if (!this.highScoresList) return;

    this.highScoresList.innerHTML = '';

    if (scores.length === 0) {
      const noScores = document.createElement('li');
      noScores.className = 'no-scores';
      noScores.textContent = 'No scores yet!';
      this.highScoresList.appendChild(noScores);
      return;
    }

    scores.forEach((hs, index) => {
      const isOwnScore = hs.playerId === currentPlayerId;
      const displayName = hs.playerName || 'Anonymous';

      const item = document.createElement('li');
      item.className = 'high-score-item';
      if (isOwnScore) {
        item.classList.add('own-score');
      }

      // Rank
      const rank = document.createElement('span');
      rank.className = 'high-score-rank';
      rank.textContent = `${index + 1}.`;
      item.appendChild(rank);

      // Avatar
      const avatarContainer = document.createElement('div');
      avatarContainer.className = 'high-score-avatar';
      if (hs.playerAvatarUrl) {
        const avatarImg = document.createElement('img');
        avatarImg.src = hs.playerAvatarUrl;
        avatarImg.alt = '';
        avatarContainer.appendChild(avatarImg);
      }
      item.appendChild(avatarContainer);

      // Name and score
      const nameScore = document.createElement('span');
      nameScore.className = 'high-score-name-score';
      nameScore.textContent = `${displayName}: ${hs.score}`;
      item.appendChild(nameScore);

      this.highScoresList!.appendChild(item);
    });
  }

  private handleAvatarUpload(): void {
    this.fileInput?.click();
  }

  private async handleFileSelected(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const uploadBtn = this.panel.querySelector('.avatar-upload-btn');
    if (uploadBtn) {
      uploadBtn.textContent = '...';
    }

    const url = await uploadAvatar(file);
    if (url) {
      this.currentAvatarUrl = url;
      if (this.avatarImage) {
        this.avatarImage.src = url;
        this.avatarImage.style.display = 'block';
      }
    }

    if (uploadBtn) {
      uploadBtn.textContent = '\uD83D\uDCF7';
    }

    // Reset file input
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  private handleEditName(): void {
    const newName = prompt('Enter your name:', this.currentName);
    if (newName && newName.trim() && newName.trim() !== this.currentName) {
      this.currentName = newName.trim().slice(0, 20);
      if (this.nameElement) {
        this.nameElement.textContent = this.currentName;
      }
      updatePlayerName(this.currentName);
    }
  }

  private handleRestart(): void {
    if (this.config) {
      this.hide();
      this.config.onRestart();
    }
  }

  private cleanup(): void {
    if (this.unsubGlobal) {
      this.unsubGlobal();
      this.unsubGlobal = null;
    }
    if (this.unsubPlayer) {
      this.unsubPlayer();
      this.unsubPlayer = null;
    }
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.fileInput && this.fileInput.parentNode) {
      this.fileInput.parentNode.removeChild(this.fileInput);
      this.fileInput = null;
    }
  }
}
