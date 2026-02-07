import Phaser from 'phaser';
import { WeaponType } from './types';
import { PLAYER_SPEED, PLAYER_SPEED_DOWN_BONUS, ROBOT_FIRST_WAVE, ENDER_FIRST_WAVE, GRENADE_BLAST_RADIUS, GRENADE_RANGE, DEPTH } from './constants';
import { initAudio, playHit, playJump, playLand, playStuckInHole, playWaveComplete } from './sfxr';
import { loadCoins, loadOwnedWeapons, loadSelectedWeapon, saveOwnedWeapons, initializeCoins } from './persistence';
import { createMobileControls, repositionMobileControls, MobileControls } from './controls';
import { createExplosion, createZombieExplosion, createShieldBreakEffect, createHoleSmokeEffect, createEnderExplosion, createGrenadeExplosion } from './effects';
import { WorldManager } from './world';
import { EnemyManager } from './enemies';
import { WeaponSystem } from './weapons';
import { CollectibleManager } from './collectibles';
import { selectWeapon } from './shop';
import { createHUD, updateScore, updateWave } from './ui';
import { GameOverOverlay, ShopOverlay } from './overlays';
import { generateBitmapFont, UI_FONT_KEY } from './bitmapFont';

// Module-level cache flag for bitmap font generation
let bitmapFontGenerated = false;

// Sprite definitions - each SVG is loaded and rendered to a texture at runtime
const SPRITE_DEFS = [
  { key: 'player', file: 'assets/player.svg', width: 48, height: 48 },
  { key: 'player-down', file: 'assets/player-down.svg', width: 48, height: 48 },
  { key: 'player-left', file: 'assets/player-left.svg', width: 48, height: 48 },
  { key: 'player-right', file: 'assets/player-right.svg', width: 48, height: 48 },
  { key: 'player-stuck', file: 'assets/player-stuck.svg', width: 64, height: 64 },
  { key: 'bullet', file: 'assets/bullet.svg', width: 8, height: 16 },
  { key: 'zombie', file: 'assets/zombie.svg', width: 40, height: 40 },
  { key: 'boss-zombie', file: 'assets/boss-zombie.svg', width: 64, height: 64 },
  { key: 'tree', file: 'assets/tree.svg', width: 40, height: 60 },
  { key: 'coin', file: 'assets/coin.svg', width: 24, height: 24 },
  { key: 'shield', file: 'assets/shield.svg', width: 32, height: 32 },
  { key: 'bubble', file: 'assets/bubble.svg', width: 64, height: 64 },
  { key: 'jump', file: 'assets/jump.svg', width: 64, height: 32 },
  { key: 'hole', file: 'assets/hole.svg', width: 48, height: 32 },
  { key: 'robot', file: 'assets/robot.svg', width: 40, height: 48 },
  { key: 'ender-zombie', file: 'assets/ender-zombie.svg', width: 48, height: 48 },
];

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private dvorak!: { COMMA: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; O: Phaser.Input.Keyboard.Key; E: Phaser.Input.Keyboard.Key };

  // Groups
  private bullets!: Phaser.Physics.Arcade.Group;
  private zombies!: Phaser.Physics.Arcade.Group;
  private robots!: Phaser.Physics.Arcade.Group;
  private enders!: Phaser.Physics.Arcade.Group;
  private trees!: Phaser.GameObjects.Group;
  private jumps!: Phaser.Physics.Arcade.StaticGroup;
  private holes!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.Group;
  private shields!: Phaser.Physics.Arcade.Group;

  // Managers
  private worldManager!: WorldManager;
  private enemyManager!: EnemyManager;
  private weaponSystem!: WeaponSystem;
  private collectibleManager!: CollectibleManager;

  // State
  private isJumping = false;
  private isStuck = false;
  private isInvulnerable = false;
  private isGameOver = false;
  private score = 0;
  private waveNumber = 1;
  private aimAngle = 0;
  private aimDistance = 0;
  private robotBurstCount = 0;
  private robotBurstMax = 0;
  private robotCooldown = false;
  private enderSpawnedThisWave = false;
  private ownedWeapons: WeaponType[] = ['default'];
  private currentWeapon: WeaponType = 'default';
  private currentPlayerTexture: string = 'player-down';

  // UI
  private scoreText!: Phaser.GameObjects.BitmapText;
  private coinText!: Phaser.GameObjects.BitmapText;
  private waveText!: Phaser.GameObjects.BitmapText;
  private shieldBubble!: Phaser.GameObjects.Sprite;
  private hintText!: Phaser.GameObjects.BitmapText | null;
  private cleanupPresence!: () => void;

  // Mobile
  private isMobile = false;
  private mobileControls!: MobileControls;

  // Overlays
  private gameOverOverlay!: GameOverOverlay;
  private shopOverlay!: ShopOverlay;

  constructor() {
    super('MainScene');
  }

  preload() {
    // Load each SVG individually - rendered to bitmap textures at runtime
    // This avoids iOS WebGL texture atlas issues
    for (const sprite of SPRITE_DEFS) {
      this.load.svg(sprite.key, sprite.file, { width: sprite.width, height: sprite.height });
    }

    // Log any load errors for debugging
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('Failed to load:', file.key, file.src);
    });

    this.load.on('complete', () => {
      console.log('SVGs loaded, generating hit variant textures...');
      this.generateHitVariants();
    });
  }

  private generateHitVariants() {
    // Generate white "hit flash" variants for enemies
    const hitVariants = ['zombie', 'boss-zombie', 'robot', 'ender-zombie'];

    for (const key of hitVariants) {
      const sourceTexture = this.textures.get(key);
      if (!sourceTexture) continue;

      const source = sourceTexture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const width = source.width;
      const height = source.height;

      // Create a canvas to manipulate pixels
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Draw the original image
      ctx.drawImage(source, 0, 0);

      // Get pixel data and convert to white (keeping alpha)
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) { // If pixel has alpha
          data[i] = 255;     // R = white
          data[i + 1] = 255; // G = white
          data[i + 2] = 255; // B = white
          // Keep original alpha
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Add the hit variant texture
      this.textures.addCanvas(key + '-hit', canvas);
    }

    console.log('Textures ready:', this.textures.getTextureKeys().filter(k => !k.startsWith('__')).join(', '));
  }

  create() {
    // Generate bitmap font for iOS performance (avoids multiple canvas compositing)
    generateBitmapFont(this);

    // Initialize audio on first interaction
    this.input.once('pointerdown', () => initAudio());
    this.input.keyboard?.once('keydown', () => initAudio());

    // Detect mobile
    this.isMobile = this.sys.game.device.input.touch && window.innerWidth <= 1024;

    // Set up infinite world bounds
    this.physics.world.setBounds(-10000, -10000, 20000, 20000);

    // Create groups prevents per-child preUpdate calls)
    this.trees = this.add.group();
    this.jumps = this.physics.add.staticGroup();
    this.holes = this.physics.add.staticGroup();
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30, runChildUpdate: false });
    this.zombies = this.physics.add.group({});
    this.coins = this.physics.add.group({});
    this.shields = this.physics.add.group({});
    this.robots = this.physics.add.group({});
    this.enders = this.physics.add.group({});

    // Create world manager and spawn initial terrain
    this.worldManager = new WorldManager(this, this.trees, this.jumps, this.holes);
    this.worldManager.spawnInitialTrees(this.scale.width / 2, this.scale.height / 2);

    // Create player
    this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height / 2, 'player');
    this.player.setDepth(DEPTH.PLAYER);
    this.player.body.setSize(36, 36); // 25% smaller hitbox (48 * 0.75)
    this.player.body.setOffset(6, 6); // Center the hitbox

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(100, 100);

    // Create managers
    this.enemyManager = new EnemyManager(this, this.zombies, this.robots, this.player, this.enders);
    this.weaponSystem = new WeaponSystem(this, this.bullets, this.player);
    this.weaponSystem.setEnemyGroups(this.zombies, this.robots, this.enders);
    this.weaponSystem.setRailgunHitCallback((target, damage) => this.handleRailgunHit(target, damage));
    this.weaponSystem.setGrenadeExplosionCallback((x, y, damage) => this.handleGrenadeExplosion(x, y, damage));

    // Load persistence data
    const initialCoinCount = loadCoins();
    this.ownedWeapons = loadOwnedWeapons();
    this.currentWeapon = loadSelectedWeapon(this.ownedWeapons);
    this.weaponSystem.setWeapon(this.currentWeapon);

    // Create HUD
    const hud = createHUD(this, initialCoinCount);
    this.scoreText = hud.scoreText;
    this.coinText = hud.coinText;
    this.waveText = hud.waveText;
    this.cleanupPresence = hud.cleanupPresence;

    // Create shield bubble (hidden initially)
    this.shieldBubble = this.add.sprite(0, 0, 'bubble');
    this.shieldBubble.setVisible(false);
    this.shieldBubble.setDepth(DEPTH.SHIELD_BUBBLE);
    this.shieldBubble.setAlpha(0.7);

    // Create collectible manager
    this.collectibleManager = new CollectibleManager(
      this, this.coins, this.shields, this.shieldBubble,
      initialCoinCount, this.coinText
    );

    // Initialize coins from database (migrate if needed, sync if different)
    initializeCoins().then((dbCoins) => {
      if (dbCoins !== initialCoinCount && this.collectibleManager) {
        // Database has different value (e.g., from migration or another device)
        this.collectibleManager.coinCount = dbCoins;
        this.coinText.setText(`Coins: ${dbCoins}`);
      }
    });

    // Spawn first wave
    this.enemyManager.spawnZombieWave(this.waveNumber);

    // Set up collisions
    this.setupCollisions();

    // Setup keyboard input
    this.setupKeyboard();

    if (this.isMobile) {
      this.mobileControls = createMobileControls(this);
      this.hintText = null;

      this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
        repositionMobileControls(this.mobileControls, gameSize.width, gameSize.height);
      });

      // Handle orientation changes (safe area insets change on rotation)
      window.addEventListener('orientationchange', () => {
        // Delay to allow browser to update safe area insets
        setTimeout(() => {
          repositionMobileControls(this.mobileControls, this.scale.width, this.scale.height);
        }, 100);
      });
    } else {
      this.hintText = this.add.bitmapText(this.scale.width / 2, this.scale.height - 20, UI_FONT_KEY, 'WASD/Arrows to move, Click to shoot', 14)
        .setTint(0x666666)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH.HUD);
    }

    // Initialize HTML overlays
    this.gameOverOverlay = new GameOverOverlay();
    this.shopOverlay = new ShopOverlay();

    // Periodically update zombie directions
    this.time.addEvent({
      delay: 1200,
      callback: () => this.enemyManager.randomizeZombieMovement(),
      callbackScope: this,
      loop: true
    });

    // Periodically cleanup distant objects
    this.time.addEvent({
      delay: 2000,
      callback: () => this.worldManager.cleanupDistantObjects(this.player, this.zombies, this.coins, this.shields),
      callbackScope: this,
      loop: true
    });
  }

  private setupCollisions() {
    // Player-shield collision
    this.physics.add.overlap(
      this.player, this.shields,
      (_player, shield) => {
        const s = shield as Phaser.Physics.Arcade.Sprite;
        this.collectibleManager.stopShieldTweens(s);
        s.destroy();
        this.collectibleManager.collectShield();
      },
      undefined, this
    );

    // Player-coin collision
    this.physics.add.overlap(
      this.player, this.coins,
      (_player, coin) => {
        const c = coin as Phaser.Physics.Arcade.Sprite;
        this.collectibleManager.stopCoinTweens(c);
        c.destroy();
        this.collectibleManager.collectCoin();
      },
      undefined, this
    );

    // Bullet-zombie collision
    this.physics.add.overlap(
      this.bullets, this.zombies,
      this.hitZombie as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this
    );

    // Zombie-player collision
    this.physics.add.overlap(
      this.player, this.zombies,
      this.handlePlayerHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      () => !this.isJumping && !this.isInvulnerable,
      this
    );

    // Player-jump collision
    this.physics.add.overlap(
      this.player, this.jumps,
      this.hitJump as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this
    );

    // Player-hole collision
    this.physics.add.overlap(
      this.player, this.holes,
      this.hitHole as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      () => !this.isStuck && !this.isJumping,
      this
    );

    // Bullet-robot collision
    this.physics.add.overlap(
      this.bullets, this.robots,
      this.hitRobot as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this
    );

    // Robot-player collision
    this.physics.add.overlap(
      this.player, this.robots,
      this.handlePlayerHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      () => !this.isJumping && !this.isInvulnerable,
      this
    );

    // Bullet-ender collision
    this.physics.add.overlap(
      this.bullets, this.enders,
      this.hitEnder as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this
    );

    // Ender-player collision
    this.physics.add.overlap(
      this.player, this.enders,
      this.handlePlayerHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      () => !this.isJumping && !this.isInvulnerable,
      this
    );
  }

  private setupKeyboard() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.dvorak = {
      COMMA: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      O: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };
  }

  private hitJump(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    jump: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    if (this.isJumping) return;

    const p = player as Phaser.Physics.Arcade.Sprite;
    const j = jump as Phaser.Physics.Arcade.Sprite;
    const playerVelY = p.body?.velocity.y || 0;

    if (playerVelY < -10) {
      p.y = j.y + 40;
      p.body!.velocity.y = 0;
      return;
    }

    if (playerVelY > 50) {
      this.triggerJump();
    }
  }

  private hitHole(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    hole: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    if (this.isStuck) return;

    const h = hole as Phaser.Physics.Arcade.Sprite;
    if (h.getData('onCooldown')) return;

    playStuckInHole();
    this.isStuck = true;
    const p = player as Phaser.Physics.Arcade.Sprite;

    p.x = h.x;
    p.y = h.y;
    p.setDepth(h.depth + 10);

    // Switch to stuck sprite (includes hole visual)
    p.setTexture('player-stuck');
    this.currentPlayerTexture = 'player-stuck';
    h.setVisible(false); // Hide the hole since it's part of the stuck sprite

    // Splash animation - slight bounce
    this.tweens.add({
      targets: p,
      scaleX: 1.1,
      scaleY: 0.9,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    const smokeParticles: Phaser.GameObjects.Arc[] = [];
    const smokeTimer = this.time.addEvent({
      delay: 150,
      repeat: 25,
      callback: () => createHoleSmokeEffect(this, p, smokeParticles)
    });

    // Wiggle animation while stuck
    const wiggleTween = this.tweens.add({
      targets: p,
      angle: { from: -5, to: 5 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.time.delayedCall(4000, () => {
      this.isStuck = false;
      p.setDepth(DEPTH.PLAYER);
      p.setTexture('player-down'); // Return to normal sprite
      this.currentPlayerTexture = 'player-down';
      p.angle = 0;
      wiggleTween.stop();
      smokeTimer.destroy();
      smokeParticles.forEach(s => s.destroy());

      // Show the hole again
      h.setVisible(true);
      h.setData('onCooldown', true);
      this.time.delayedCall(3000, () => {
        if (h.active) h.setData('onCooldown', false);
      });

      // Pop out animation
      this.tweens.add({
        targets: p,
        scaleY: 1.2,
        duration: 150,
        yoyo: true,
        ease: 'Quad.easeOut'
      });
    });
  }

  private triggerJump() {
    if (this.isJumping) return;

    playJump();
    this.isJumping = true;
    const jumpDuration = 800;
    const jumpDistance = 150;
    const startY = this.player.y;

    this.tweens.add({
      targets: this.player,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: jumpDuration / 2,
      ease: 'Quad.easeOut',
      yoyo: true
    });

    this.player.setDepth(DEPTH.PLAYER_JUMPING);

    this.tweens.add({
      targets: this.player,
      y: startY + jumpDistance,
      duration: jumpDuration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.checkLandingOnEnemies();
        playLand();
        this.isJumping = false;
        this.player.setDepth(DEPTH.PLAYER);
        this.player.setScale(1);
        this.startInvulnerability();
      }
    });
  }

  private startInvulnerability() {
    this.isInvulnerable = true;

    const blinkTween = this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 100,
      ease: 'Linear',
      yoyo: true,
      repeat: 4
    });

    this.time.delayedCall(1000, () => {
      this.isInvulnerable = false;
      this.player.setAlpha(1);
      blinkTween.stop();
    });
  }

  private checkLandingOnEnemies() {
    const landingRadius = 40;

    // Check zombies
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const zombie of zombies) {
      if (!zombie.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, zombie.x, zombie.y);
      if (dist < landingRadius) {
        this.explodeZombie(zombie);
      }
    }

    // Check robots
    const robots = this.robots.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const robot of robots) {
      if (!robot.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, robot.x, robot.y);
      if (dist < landingRadius) {
        this.explodeRobot(robot);
      }
    }

    // Check enders
    const enders = this.enders.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const ender of enders) {
      if (!ender.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, ender.x, ender.y);
      if (dist < landingRadius) {
        this.explodeEnder(ender);
      }
    }
  }

  private explodeZombie(zombie: Phaser.Physics.Arcade.Sprite) {
    const x = zombie.x;
    const y = zombie.y;
    const points = zombie.getData('points') || 10;
    const maxHealth = zombie.getData('maxHealth') || 1;
    const isBoss = zombie.getData('isBoss');
    const isRed = zombie.getData('isRed') || false;

    this.score += points * 10;
    updateScore(this.scoreText, this.score);

    if (isBoss) {
      const coinCount = Phaser.Math.Between(8, 15);
      for (let i = 0; i < coinCount; i++) {
        this.time.delayedCall(i * 80, () => {
          const offsetX = Phaser.Math.Between(-50, 50);
          const offsetY = Phaser.Math.Between(-50, 50);
          this.collectibleManager.spawnCoin(x + offsetX, y + offsetY);
        });
      }
      for (let i = 0; i < 7; i++) {
        this.time.delayedCall(i * 40, () => {
          const offsetX = Phaser.Math.Between(-50, 50);
          const offsetY = Phaser.Math.Between(-50, 50);
          createExplosion(this, x + offsetX, y + offsetY);
        });
      }
      const healthBarBg = zombie.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
      const healthBarFg = zombie.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
      if (healthBarBg) healthBarBg.destroy();
      if (healthBarFg) healthBarFg.destroy();
    } else if (maxHealth > 1 && Math.random() < 0.5) {
      this.collectibleManager.spawnCoin(x, y);
    }

    zombie.destroy();
    createExplosion(this, x, y);
    // Stomp comes from above - angle pointing down (PI/2)
    createZombieExplosion(this, x, y, isRed, Math.PI / 2);
  }

  private explodeRobot(robot: Phaser.Physics.Arcade.Sprite) {
    const x = robot.x;
    const y = robot.y;

    this.score += 1000;
    updateScore(this.scoreText, this.score);

    this.collectibleManager.addCoins(25);

    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 50, () => {
        const offsetX = Phaser.Math.Between(-30, 30);
        const offsetY = Phaser.Math.Between(-30, 30);
        this.collectibleManager.spawnCoin(x + offsetX, y + offsetY);
      });
    }

    robot.destroy();
    createExplosion(this, x, y);
    this.time.delayedCall(50, () => createExplosion(this, x + 10, y - 10));
    this.time.delayedCall(100, () => createExplosion(this, x - 10, y + 10));
  }

  private explodeEnder(ender: Phaser.Physics.Arcade.Sprite) {
    const x = ender.x;
    const y = ender.y;
    const points = ender.getData('points') || 100;

    this.score += points * 10; // Stomp bonus
    updateScore(this.scoreText, this.score);

    // Drop coins on stomp
    const coinCount = Phaser.Math.Between(3, 6);
    for (let i = 0; i < coinCount; i++) {
      this.time.delayedCall(i * 60, () => {
        const offsetX = Phaser.Math.Between(-30, 30);
        const offsetY = Phaser.Math.Between(-30, 30);
        this.collectibleManager.spawnCoin(x + offsetX, y + offsetY);
      });
    }

    this.enemyManager.cleanupEnderTimers(ender);
    ender.destroy();
    createExplosion(this, x, y);
    createEnderExplosion(this, x, y, Math.PI / 2); // Stomp comes from above
    this.time.delayedCall(60, () => createExplosion(this, x + 15, y - 10));
  }

  private hitEnder(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    ender: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    const e = ender as Phaser.Physics.Arcade.Sprite;

    // Skip if this rubber bullet just hit this target
    if (b.getData('lastHitTarget') === e) return;

    const isRubberBullet = b.getData('isRubberBullet');

    if (isRubberBullet) {
      this.bounceBullet(b, e);
    } else {
      b.setActive(false);
      b.setVisible(false);
    }
    playHit();

    const health = e.getData('health') - 1;
    e.setData('health', health);

    if (health <= 0) {
      const points = e.getData('points') || 100;
      this.score += points;
      updateScore(this.scoreText, this.score);

      // Chance to drop coin
      if (Math.random() < 0.4) {
        this.collectibleManager.spawnCoin(e.x, e.y);
      }

      if (this.weaponSystem.currentWeapon === 'burst-shot' && !b.getData('isBurstBullet')) {
        this.weaponSystem.spawnBurstShots(e.x, e.y);
      }

      this.collectibleManager.tryDropShield(e.x, e.y, this.waveNumber);

      // Get hit angle from bullet velocity
      const bVelX = b.body?.velocity.x || 0;
      const bVelY = b.body?.velocity.y || 0;
      const hitAngle = Math.atan2(bVelY, bVelX);
      createEnderExplosion(this, e.x, e.y, hitAngle);

      this.enemyManager.cleanupEnderTimers(e);
      e.destroy();
    } else {
      // Debounced hit flash
      const now = this.time.now;
      const flashUntil = e.getData('flashUntil') || 0;
      if (flashUntil < now) {
        e.setData('flashUntil', now + 50);
        e.setTexture('ender-zombie-hit');

        this.time.delayedCall(50, () => {
          if (e.active) {
            e.setTexture('ender-zombie');
            const maxHealth = e.getData('maxHealth');
            const damageRatio = health / maxHealth;
            // Purple tint fade as damaged
            const purple = Math.floor(0x99 * damageRatio);
            const tint = (purple << 16) | (0x33 << 8) | 0xff;
            e.setTint(tint);
          }
        });
      }
    }
  }

  private hitZombie(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    zombie: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    const z = zombie as Phaser.Physics.Arcade.Sprite;

    // Skip if this rubber bullet just hit this target
    if (b.getData('lastHitTarget') === z) return;

    const isRubberBullet = b.getData('isRubberBullet');

    if (isRubberBullet) {
      // Rubber bullets bounce off in a random direction
      this.bounceBullet(b, z);
    } else {
      b.setActive(false);
      b.setVisible(false);
    }
    playHit();

    const health = z.getData('health') - 1;
    z.setData('health', health);

    if (health <= 0) {
      const points = z.getData('points') || 10;
      this.score += points;

      const isBoss = z.getData('isBoss');
      if (isBoss) {
        const coinCount = Phaser.Math.Between(5, 10);
        for (let i = 0; i < coinCount; i++) {
          this.time.delayedCall(i * 100, () => {
            const offsetX = Phaser.Math.Between(-50, 50);
            const offsetY = Phaser.Math.Between(-50, 50);
            this.collectibleManager.spawnCoin(z.x + offsetX, z.y + offsetY);
          });
        }
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 50, () => {
            const offsetX = Phaser.Math.Between(-40, 40);
            const offsetY = Phaser.Math.Between(-40, 40);
            createExplosion(this, z.x + offsetX, z.y + offsetY);
          });
        }
      } else {
        const maxHealth = z.getData('maxHealth') || 1;
        if (maxHealth > 1 && Math.random() < 0.35) {
          this.collectibleManager.spawnCoin(z.x, z.y);
        }
      }

      if (this.weaponSystem.currentWeapon === 'burst-shot' && !b.getData('isBurstBullet')) {
        this.weaponSystem.spawnBurstShots(z.x, z.y);
      }

      if (isBoss) {
        const healthBarBg = z.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
        const healthBarFg = z.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
        if (healthBarBg) healthBarBg.destroy();
        if (healthBarFg) healthBarFg.destroy();
      }

      this.collectibleManager.tryDropShield(z.x, z.y, this.waveNumber);
      const isRed = z.getData('isRed') || false;
      // Get hit angle from bullet velocity
      const bVelX = b.body?.velocity.x || 0;
      const bVelY = b.body?.velocity.y || 0;
      const hitAngle = Math.atan2(bVelY, bVelX);
      createZombieExplosion(this, z.x, z.y, isRed, hitAngle);
      z.destroy();
    } else {
      // Debounced hit flash using frame swap (Safari optimization)
      const now = this.time.now;
      const flashUntil = z.getData('flashUntil') || 0;
      if (flashUntil < now) {
        z.setData('flashUntil', now + 50);
        const baseFrame = z.getData('baseFrame') || 'zombie';
        z.setTexture(baseFrame + '-hit');

        this.time.delayedCall(50, () => {
          if (z.active) {
            z.setTexture(baseFrame);
            const maxHealth = z.getData('maxHealth');
            const damageRatio = health / maxHealth;
            const isBoss = z.getData('isBoss');
            const isRed = z.getData('isRed');

            if (isBoss) {
              const brightness = Math.floor(0x88 + (0x77 * damageRatio));
              z.setTint((brightness << 16) | (brightness << 8) | brightness);
              const healthBarFg = z.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
              const barWidth = z.getData('healthBarWidth') as number;
              if (healthBarFg && barWidth) {
                healthBarFg.width = barWidth * damageRatio;
              }
            } else if (isRed) {
              // Red zombies: fade from red to darker as damaged
              const red = Math.floor(0xff * damageRatio);
              const tint = (red << 16) | 0x4444;
              z.setTint(tint);
            }
            // Regular zombies have no tint
          }
        });
      }
    }

    updateScore(this.scoreText, this.score);
  }

  private hitRobot(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    robot: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    const r = robot as Phaser.Physics.Arcade.Sprite;

    // Skip if this rubber bullet just hit this target
    if (b.getData('lastHitTarget') === r) return;

    const isRubberBullet = b.getData('isRubberBullet');

    if (isRubberBullet) {
      // Rubber bullets bounce off in a random direction
      this.bounceBullet(b, r);
    } else {
      b.setActive(false);
      b.setVisible(false);
    }
    playHit();

    const health = r.getData('health') - 1;
    r.setData('health', health);

    if (health <= 0) {
      const points = r.getData('points') || 75;
      this.score += points;
      updateScore(this.scoreText, this.score);

      if (this.weaponSystem.currentWeapon === 'burst-shot' && !b.getData('isBurstBullet')) {
        this.weaponSystem.spawnBurstShots(r.x, r.y);
      }

      createExplosion(this, r.x, r.y);
      r.destroy();
    } else {
      // Debounced hit flash using frame swap (Safari optimization)
      const now = this.time.now;
      const flashUntil = r.getData('flashUntil') || 0;
      if (flashUntil < now) {
        r.setData('flashUntil', now + 50);
        r.setTexture('robot-hit');

        this.time.delayedCall(50, () => {
          if (r.active) r.setTexture('robot');
        });
      }
    }
  }

  private bounceBullet(bullet: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite): void {
    // Calculate bounce direction - reflect off the target with some randomness
    const currentVelX = bullet.body?.velocity.x || 0;
    const currentVelY = bullet.body?.velocity.y || 0;
    const currentSpeed = Math.sqrt(currentVelX * currentVelX + currentVelY * currentVelY);

    // Get angle from bullet to target, then bounce in opposite direction with spread
    const angleToTarget = Math.atan2(target.y - bullet.y, target.x - bullet.x);
    const bounceAngle = angleToTarget + Math.PI + Phaser.Math.FloatBetween(-0.8, 0.8);

    // Move bullet slightly away from target to prevent immediate re-collision
    bullet.x = target.x - Math.cos(angleToTarget) * 30;
    bullet.y = target.y - Math.sin(angleToTarget) * 30;

    // Set new velocity in bounce direction
    bullet.setVelocity(
      Math.cos(bounceAngle) * currentSpeed,
      Math.sin(bounceAngle) * currentSpeed
    );
    bullet.rotation = bounceAngle + Math.PI / 2;

    // Brief invulnerability to prevent hitting same target twice
    const originalTarget = target;
    bullet.setData('lastHitTarget', originalTarget);
    this.time.delayedCall(100, () => {
      if (bullet.active) {
        bullet.setData('lastHitTarget', null);
      }
    });
  }

  private handleRailgunHit(target: Phaser.Physics.Arcade.Sprite, damage: number) {
    if (!target.active) return;

    playHit();

    const health = target.getData('health') - damage;
    target.setData('health', health);
    const isBoss = target.getData('isBoss');
    const isRobot = target.getData('isRobot');
    const isEnder = target.getData('isEnder');

    if (health <= 0) {
      const points = target.getData('points') || (isRobot ? 75 : isEnder ? 100 : 10);
      this.score += points;
      updateScore(this.scoreText, this.score);

      if (isBoss) {
        // Boss death - spawn coins and explosions
        const coinCount = Phaser.Math.Between(5, 10);
        for (let i = 0; i < coinCount; i++) {
          this.time.delayedCall(i * 100, () => {
            const offsetX = Phaser.Math.Between(-50, 50);
            const offsetY = Phaser.Math.Between(-50, 50);
            this.collectibleManager.spawnCoin(target.x + offsetX, target.y + offsetY);
          });
        }
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 50, () => {
            const offsetX = Phaser.Math.Between(-40, 40);
            const offsetY = Phaser.Math.Between(-40, 40);
            createExplosion(this, target.x + offsetX, target.y + offsetY);
          });
        }
        // Clean up boss health bar
        const healthBarBg = target.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
        const healthBarFg = target.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
        if (healthBarBg) healthBarBg.destroy();
        if (healthBarFg) healthBarFg.destroy();
      } else if (isEnder) {
        // Ender death
        if (Math.random() < 0.4) {
          this.collectibleManager.spawnCoin(target.x, target.y);
        }
        this.collectibleManager.tryDropShield(target.x, target.y, this.waveNumber);
        const hitAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        createEnderExplosion(this, target.x, target.y, hitAngle);
        this.enemyManager.cleanupEnderTimers(target);
      } else if (!isRobot) {
        // Regular zombie - chance to drop coin if red zombie
        const maxHealth = target.getData('maxHealth') || 1;
        if (maxHealth > 1 && Math.random() < 0.35) {
          this.collectibleManager.spawnCoin(target.x, target.y);
        }
        this.collectibleManager.tryDropShield(target.x, target.y, this.waveNumber);
        // Add colored explosion for non-boss zombies
        const isRed = target.getData('isRed') || false;
        // Hit angle from player to target
        const hitAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        createZombieExplosion(this, target.x, target.y, isRed, hitAngle);
      }

      createExplosion(this, target.x, target.y);
      target.destroy();
    } else {
      // Debounced hit flash using frame swap (Safari optimization)
      const now = this.time.now;
      const flashUntil = target.getData('flashUntil') || 0;
      if (flashUntil < now) {
        target.setData('flashUntil', now + 50);
        const baseFrame = target.getData('baseFrame') || (isRobot ? 'robot' : isEnder ? 'ender-zombie' : 'zombie');
        target.setTexture(baseFrame + '-hit');

        this.time.delayedCall(50, () => {
          if (target.active) {
            target.setTexture(baseFrame);
            const maxHealth = target.getData('maxHealth');
            const damageRatio = health / maxHealth;
            const isRed = target.getData('isRed');

            if (isBoss) {
              const brightness = Math.floor(0x88 + (0x77 * damageRatio));
              target.setTint((brightness << 16) | (brightness << 8) | brightness);
              const healthBarFg = target.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
              const barWidth = target.getData('healthBarWidth') as number;
              if (healthBarFg && barWidth) {
                healthBarFg.width = barWidth * damageRatio;
              }
            } else if (isEnder) {
              // Ender: purple fade as damaged
              const purple = Math.floor(0x99 * damageRatio);
              const tint = (purple << 16) | (0x33 << 8) | 0xff;
              target.setTint(tint);
            } else if (isRed) {
              // Red zombies: fade from red to darker as damaged
              const red = Math.floor(0xff * damageRatio);
              const tint = (red << 16) | 0x4444;
              target.setTint(tint);
            }
            // Regular zombies and robots have no tint
          }
        });
      }
    }
  }

  private handleGrenadeExplosion(x: number, y: number, damage: number) {
    const blastRadius = GRENADE_BLAST_RADIUS;
    createGrenadeExplosion(this, x, y, blastRadius);

    // Damage all zombies in radius
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const zombie of zombies) {
      if (!zombie.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, zombie.x, zombie.y);
      if (dist < blastRadius) {
        const health = zombie.getData('health') - damage;
        zombie.setData('health', health);
        if (health <= 0) {
          const points = zombie.getData('points') || 10;
          this.score += points;
          const isBoss = zombie.getData('isBoss');
          if (isBoss) {
            const coinCount = Phaser.Math.Between(5, 10);
            for (let i = 0; i < coinCount; i++) {
              this.time.delayedCall(i * 100, () => {
                const ox = Phaser.Math.Between(-50, 50);
                const oy = Phaser.Math.Between(-50, 50);
                this.collectibleManager.spawnCoin(zombie.x + ox, zombie.y + oy);
              });
            }
            const healthBarBg = zombie.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
            const healthBarFg = zombie.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
            if (healthBarBg) healthBarBg.destroy();
            if (healthBarFg) healthBarFg.destroy();
          } else {
            const maxHealth = zombie.getData('maxHealth') || 1;
            if (maxHealth > 1 && Math.random() < 0.35) {
              this.collectibleManager.spawnCoin(zombie.x, zombie.y);
            }
          }
          this.collectibleManager.tryDropShield(zombie.x, zombie.y, this.waveNumber);
          const isRed = zombie.getData('isRed') || false;
          createZombieExplosion(this, zombie.x, zombie.y, isRed);
          createExplosion(this, zombie.x, zombie.y);
          zombie.destroy();
        } else {
          // Pushback surviving enemies away from blast center
          this.applyGrenadePushback(zombie, x, y, dist, blastRadius);
        }
      }
    }

    // Damage all robots in radius
    const robots = this.robots.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const robot of robots) {
      if (!robot.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, robot.x, robot.y);
      if (dist < blastRadius) {
        const health = robot.getData('health') - damage;
        robot.setData('health', health);
        if (health <= 0) {
          const points = robot.getData('points') || 75;
          this.score += points;
          createExplosion(this, robot.x, robot.y);
          robot.destroy();
        } else {
          this.applyGrenadePushback(robot, x, y, dist, blastRadius);
        }
      }
    }

    // Damage all enders in radius
    const enders = this.enders.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const ender of enders) {
      if (!ender.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, ender.x, ender.y);
      if (dist < blastRadius) {
        const health = ender.getData('health') - damage;
        ender.setData('health', health);
        if (health <= 0) {
          const points = ender.getData('points') || 100;
          this.score += points;
          if (Math.random() < 0.4) {
            this.collectibleManager.spawnCoin(ender.x, ender.y);
          }
          this.collectibleManager.tryDropShield(ender.x, ender.y, this.waveNumber);
          createEnderExplosion(this, ender.x, ender.y);
          this.enemyManager.cleanupEnderTimers(ender);
          createExplosion(this, ender.x, ender.y);
          ender.destroy();
        } else {
          this.applyGrenadePushback(ender, x, y, dist, blastRadius);
        }
      }
    }

    updateScore(this.scoreText, this.score);
  }

  private applyGrenadePushback(
    enemy: Phaser.Physics.Arcade.Sprite,
    blastX: number, blastY: number,
    dist: number, blastRadius: number
  ) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (!body) return;
    const angle = Math.atan2(enemy.y - blastY, enemy.x - blastX);
    // Stronger pushback the closer to the center (300 at center, fading to 0 at edge)
    const strength = 300 * (1 - dist / blastRadius);
    body.setVelocity(
      body.velocity.x + Math.cos(angle) * strength,
      body.velocity.y + Math.sin(angle) * strength
    );
  }

  private handlePlayerHit() {
    if (this.collectibleManager.hasShield) {
      this.collectibleManager.breakShield();
      createShieldBreakEffect(this, this.player.x, this.player.y);

      this.isInvulnerable = true;
      this.tweens.add({
        targets: this.player,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 9,
        onComplete: () => {
          this.isInvulnerable = false;
          this.player.setAlpha(1);
        }
      });
    } else {
      this.gameOver();
    }
  }

  private gameOver() {
    this.isGameOver = true;
    this.player.setTint(0xff0000);
    if (this.hintText) {
      this.hintText.setVisible(false);
    }
    this.physics.pause();

    this.gameOverOverlay.show({
      score: this.score,
      coinCount: this.collectibleManager.coinCount,
      isMobile: this.isMobile,
      onShop: () => this.showShop(),
      onRestart: () => this.restartGame()
    });
  }

  private showShop() {
    this.shopOverlay.show({
      coinCount: this.collectibleManager.coinCount,
      ownedWeapons: this.ownedWeapons,
      currentWeapon: this.currentWeapon,
      onWeaponSelect: (weapon) => {
        selectWeapon(weapon, this.ownedWeapons);
        this.currentWeapon = weapon;
        this.weaponSystem.setWeapon(weapon);
      },
      onWeaponBuy: (weapon, cost) => {
        if (this.collectibleManager.spendCoins(cost)) {
          this.ownedWeapons.push(weapon);
          saveOwnedWeapons(this.ownedWeapons);
          return true;
        }
        return false;
      },
      onClose: () => {
        // Show game over overlay again when closing shop
        this.gameOverOverlay.show({
          score: this.score,
          coinCount: this.collectibleManager.coinCount,
          isMobile: this.isMobile,
          onShop: () => this.showShop(),
          onRestart: () => this.restartGame()
        });
      }
    });
  }

  private restartGame() {
    this.score = 0;
    this.waveNumber = 1;
    this.isJumping = false;
    this.isStuck = false;
    this.isInvulnerable = false;
    this.isGameOver = false;
    this.robotBurstCount = 0;
    this.robotCooldown = false;
    this.enderSpawnedThisWave = false;
    this.weaponSystem.setCanShoot(true);
    if (this.cleanupPresence) {
      this.cleanupPresence();
    }
    // Hide HTML overlays
    this.gameOverOverlay.hide();
    this.shopOverlay.hide();
    this.scene.restart();
  }

  update() {
    let vx = 0;
    let vy = 0;
    let isShooting = false;

    if (this.isMobile) {
      vx = this.mobileControls.leftJoystick.vector.x * PLAYER_SPEED;
      vy = this.mobileControls.leftJoystick.vector.y * PLAYER_SPEED;

      if (vy > 0) {
        vy += PLAYER_SPEED_DOWN_BONUS * this.mobileControls.leftJoystick.vector.y;
      }

      if (this.mobileControls.rightJoystick.vector.length() > 0.1) {
        this.aimAngle = Math.atan2(this.mobileControls.rightJoystick.vector.y, this.mobileControls.rightJoystick.vector.x);
        this.aimDistance = GRENADE_RANGE;
        isShooting = true;
      }
    } else {
      if (this.cursors.left.isDown || this.wasd.A.isDown || this.dvorak.A.isDown) {
        vx = -PLAYER_SPEED;
      } else if (this.cursors.right.isDown || this.wasd.D.isDown || this.dvorak.E.isDown) {
        vx = PLAYER_SPEED;
      }

      if (this.cursors.up.isDown || this.wasd.W.isDown || this.dvorak.COMMA.isDown) {
        vy = -PLAYER_SPEED;
      } else if (this.cursors.down.isDown || this.wasd.S.isDown || this.dvorak.O.isDown) {
        vy = PLAYER_SPEED + PLAYER_SPEED_DOWN_BONUS;
      }

      const pointer = this.input.activePointer;
      this.aimAngle = Phaser.Math.Angle.Between(
        this.player.x, this.player.y,
        pointer.worldX, pointer.worldY
      );
      this.aimDistance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        pointer.worldX, pointer.worldY
      );

      isShooting = pointer.isDown;
    }

    if (this.isStuck) {
      this.player.setVelocity(0, 0);
    } else {
      this.player.setVelocity(vx, vy);
    }

    this.updatePlayerSprite(vx, vy);
    this.collectibleManager.updateShieldBubble(this.player.x, this.player.y, this.player.depth);

    if (isShooting && this.weaponSystem.getCanShoot() && !this.isGameOver) {
      this.weaponSystem.shoot(this.aimAngle, this.aimDistance);
    }

    this.weaponSystem.cleanupBullets();
    this.worldManager.spawnTreesAroundPlayer(this.player);
    this.updateEnemies();
  }

  private updatePlayerSprite(vx: number, vy: number) {
    if (this.isJumping) return;

    const movingLeft = vx < -50;
    const movingRight = vx > 50;
    const movingUp = vy < -50;
    const movingDown = vy > 50;

    let newTexture = 'player-down';
    let newRotation = 0;

    if (movingUp) {
      newTexture = 'player';
      newRotation = Math.sin(this.time.now * 0.015) * 0.15;
    } else if (movingLeft && !movingDown) {
      newTexture = 'player-left';
    } else if (movingRight && !movingDown) {
      newTexture = 'player-right';
    } else if (movingLeft) {
      newTexture = 'player-left';
    } else if (movingRight) {
      newTexture = 'player-right';
    }

    // Only call setTexture when texture actually changes (Safari WebGL optimization)
    if (newTexture !== this.currentPlayerTexture) {
      this.player.setTexture(newTexture);
      this.currentPlayerTexture = newTexture;
    }

    this.player.rotation = newRotation;
  }

  private updateEnemies() {
    const waveComplete = this.enemyManager.updateZombies();

    if (waveComplete) {
      playWaveComplete();
      this.waveNumber++;
      updateWave(this.waveText, this.waveNumber);
      this.enemyManager.spawnZombieWave(this.waveNumber);
      this.enderSpawnedThisWave = false;

      if (this.waveNumber >= ROBOT_FIRST_WAVE && !this.robotCooldown && this.robotBurstCount === 0) {
        this.startRobotBurst();
      }
    }

    // Spawn ender zombies mid-wave starting at wave 7
    if (this.waveNumber >= ENDER_FIRST_WAVE && !this.enderSpawnedThisWave) {
      const activeEnders = this.enders.getChildren().filter(e => (e as Phaser.Physics.Arcade.Sprite).active).length;
      // Only spawn if no enders currently active
      if (activeEnders === 0) {
        this.enderSpawnedThisWave = true;

        // Calculate number of enders: 1 at wave 7, +0.7 per wave with randomness
        const wavesAfterFirst = this.waveNumber - ENDER_FIRST_WAVE;
        const baseCount = 1 + wavesAfterFirst * 0.7;
        const randomOffset = Phaser.Math.FloatBetween(-0.3, 0.3);
        const enderCount = Math.max(1, Math.round(baseCount + randomOffset));

        // Spawn enders with staggered delay
        for (let i = 0; i < enderCount; i++) {
          this.time.delayedCall(2000 + i * 800, () => {
            if (!this.isGameOver) {
              this.enemyManager.spawnEnderZombie();
            }
          });
        }
      }
    }

    this.enemyManager.updateRobots();
    this.enemyManager.updateEnders();
  }

  private startRobotBurst() {
    this.robotBurstMax = Phaser.Math.Between(3, 4);
    this.robotBurstCount = 0;
    this.spawnRobotWithDelay();
  }

  private spawnRobotWithDelay() {
    if (this.robotBurstCount >= this.robotBurstMax) {
      this.robotCooldown = true;
      this.time.delayedCall(8000, () => {
        this.robotCooldown = false;
      });
      return;
    }

    this.time.delayedCall(1500, () => {
      this.enemyManager.spawnRobot();
      this.robotBurstCount++;
      this.spawnRobotWithDelay();
    });
  }
}
