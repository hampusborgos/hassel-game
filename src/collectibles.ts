import Phaser from 'phaser';
import { playCoinPickup, playShieldPickup } from './sfxr';
import { saveCoins } from './persistence';
import { DEPTH } from './constants';

export class CollectibleManager {
  private scene: Phaser.Scene;
  private coins: Phaser.Physics.Arcade.Group;
  private shields: Phaser.Physics.Arcade.Group;
  private shieldBubble: Phaser.GameObjects.Sprite;
  public coinCount: number;
  public hasShield = false;
  public shieldDroppedBeforeWave3 = false;

  private coinText: Phaser.GameObjects.BitmapText;

  constructor(
    scene: Phaser.Scene,
    coins: Phaser.Physics.Arcade.Group,
    shields: Phaser.Physics.Arcade.Group,
    shieldBubble: Phaser.GameObjects.Sprite,
    initialCoinCount: number,
    coinText: Phaser.GameObjects.BitmapText
  ) {
    this.scene = scene;
    this.coins = coins;
    this.shields = shields;
    this.shieldBubble = shieldBubble;
    this.coinCount = initialCoinCount;
    this.coinText = coinText;
  }

  spawnCoin(x: number, y: number): void {
    const coin = this.coins.create(x, y, 'coin') as Phaser.Physics.Arcade.Sprite;
    coin.setDepth(DEPTH.COLLECTIBLES);

    this.scene.tweens.add({
      targets: coin,
      y: y - 20,
      duration: 200,
      ease: 'Quad.easeOut',
      yoyo: true
    });

    const spinTween = this.scene.tweens.add({
      targets: coin,
      scaleX: { from: 1, to: 0.3 },
      duration: 150,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    coin.setData('spinTween', spinTween);
  }

  collectCoin(): void {
    playCoinPickup();
    this.coinCount++;
    this.coinText.setText(`Coins: ${this.coinCount}`);
    saveCoins(this.coinCount);
  }

  stopCoinTweens(coin: Phaser.Physics.Arcade.Sprite): void {
    const spinTween = coin.getData('spinTween') as Phaser.Tweens.Tween;
    if (spinTween) spinTween.stop();
  }

  stopShieldTweens(shield: Phaser.Physics.Arcade.Sprite): void {
    const floatTween = shield.getData('floatTween') as Phaser.Tweens.Tween;
    const rotateTween = shield.getData('rotateTween') as Phaser.Tweens.Tween;
    if (floatTween) floatTween.stop();
    if (rotateTween) rotateTween.stop();
  }

  spawnShield(x: number, y: number): void {
    const shield = this.shields.create(x, y, 'shield') as Phaser.Physics.Arcade.Sprite;
    shield.setDepth(y);

    const floatTween = this.scene.tweens.add({
      targets: shield,
      y: y - 10,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const rotateTween = this.scene.tweens.add({
      targets: shield,
      angle: 10,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    shield.setData('floatTween', floatTween);
    shield.setData('rotateTween', rotateTween);
  }

  collectShield(): void {
    playShieldPickup();
    this.hasShield = true;
    this.shieldBubble.setVisible(true);

    this.shieldBubble.setAlpha(1);
    this.scene.tweens.add({
      targets: this.shieldBubble,
      alpha: 0.7,
      duration: 300,
      ease: 'Quad.easeOut'
    });
  }

  tryDropShield(x: number, y: number, waveNumber: number): void {
    if (this.hasShield) return;

    if (waveNumber < 3 && !this.shieldDroppedBeforeWave3) {
      if (Math.random() < 0.2) {
        this.shieldDroppedBeforeWave3 = true;
        this.spawnShield(x, y);
        return;
      }
      if (waveNumber === 2 && Math.random() < 0.5) {
        this.shieldDroppedBeforeWave3 = true;
        this.spawnShield(x, y);
        return;
      }
    }

    if (Math.random() < 0.02) {
      this.spawnShield(x, y);
    }
  }

  updateShieldBubble(playerX: number, playerY: number, playerDepth: number): void {
    if (this.hasShield) {
      this.shieldBubble.setPosition(playerX, playerY);
      this.shieldBubble.setDepth(playerDepth + 1);
    }
  }

  breakShield(): void {
    this.hasShield = false;
    this.shieldBubble.setVisible(false);
  }

  addCoins(amount: number): void {
    this.coinCount += amount;
    this.coinText.setText(`Coins: ${this.coinCount}`);
    saveCoins(this.coinCount);
  }

  spendCoins(amount: number): boolean {
    if (this.coinCount >= amount) {
      this.coinCount -= amount;
      this.coinText.setText(`Coins: ${this.coinCount}`);
      saveCoins(this.coinCount);
      return true;
    }
    return false;
  }

  reset(): void {
    this.hasShield = false;
    this.shieldDroppedBeforeWave3 = false;
    this.shieldBubble.setVisible(false);
  }
}
