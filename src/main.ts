import Phaser from 'phaser';

interface VirtualJoystick {
  base: Phaser.GameObjects.Arc;
  thumb: Phaser.GameObjects.Arc;
  pointerId: number | null;
  vector: Phaser.Math.Vector2;
  baseX: number;
  baseY: number;
}

type WeaponType = 'default' | 'double-barrel' | 'burst-shot';

interface WeaponInfo {
  name: string;
  cost: number;
  description: string;
}

class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private dvorak!: { COMMA: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; O: Phaser.Input.Keyboard.Key; E: Phaser.Input.Keyboard.Key };
  private bullets!: Phaser.Physics.Arcade.Group;
  private zombies!: Phaser.Physics.Arcade.Group;
  private trees!: Phaser.GameObjects.Group;
  private jumps!: Phaser.Physics.Arcade.StaticGroup;
  private isJumping = false;
  private isInvulnerable = false;
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private coins!: Phaser.Physics.Arcade.Group;
  private canShoot = true;
  private score = 0;
  private coinCount = 0;
  private waveNumber = 1;
  private readonly PLAYER_SPEED = 250;
  private readonly PLAYER_SPEED_DOWN_BONUS = 150;
  private readonly BULLET_SPEED = 600;
  private readonly SHOOT_COOLDOWN = 150;
  private readonly ZOMBIE_BASE_SPEED = 40;

  // Robot enemy
  private robots!: Phaser.Physics.Arcade.Group;
  private readonly ROBOT_SPEED = 400;
  private readonly ROBOT_FIRST_WAVE = 5;
  private readonly BOSS_WAVES = [3, 6, 10]; // Single boss waves with multipliers
  private readonly MULTI_BOSS_WAVE = 12; // Multiple bosses start here
  private robotBurstCount = 0;
  private robotBurstMax = 0;
  private robotCooldown = false;

  // Mobile controls
  private isMobile = false;
  private leftJoystick!: VirtualJoystick;
  private rightJoystick!: VirtualJoystick;
  private readonly JOYSTICK_RADIUS = 50;
  private readonly THUMB_RADIUS = 25;
  private aimAngle = 0;

  // High scores and coins persistence
  private readonly HIGH_SCORES_KEY = 'hasselgame_highscores';
  private readonly COINS_KEY = 'hasselgame_coins';
  private readonly WEAPONS_KEY = 'hasselgame_weapons';
  private readonly SELECTED_WEAPON_KEY = 'hasselgame_selected_weapon';

  // Weapons system
  private currentWeapon: WeaponType = 'default';
  private ownedWeapons: WeaponType[] = ['default'];
  private readonly WEAPONS: Record<WeaponType, WeaponInfo> = {
    'default': { name: 'Standard', cost: 0, description: 'Single shot' },
    'double-barrel': { name: 'Double-barrel', cost: 100, description: '2 shots at once' },
    'burst-shot': { name: 'Burst Shot', cost: 250, description: 'Kills spawn 6 projectiles' }
  };

  // World scrolling
  private lastTreeSpawnY = 0;
  private lastTreeSpawnX = 0;
  private readonly TREE_SPAWN_INTERVAL = 150;

  // Wave display
  private waveText!: Phaser.GameObjects.Text;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.load.svg('player', 'assets/player.svg', { width: 48, height: 48 });
    this.load.svg('player-down', 'assets/player-down.svg', { width: 48, height: 48 });
    this.load.svg('player-left', 'assets/player-left.svg', { width: 48, height: 48 });
    this.load.svg('player-right', 'assets/player-right.svg', { width: 48, height: 48 });
    this.load.svg('bullet', 'assets/bullet.svg', { width: 8, height: 16 });
    this.load.svg('zombie', 'assets/zombie.svg', { width: 40, height: 40 });
    this.load.svg('boss-zombie', 'assets/boss-zombie.svg', { width: 64, height: 64 });
    this.load.svg('tree', 'assets/tree.svg', { width: 40, height: 60 });
    this.load.svg('coin', 'assets/coin.svg', { width: 24, height: 24 });
    this.load.svg('jump', 'assets/jump.svg', { width: 64, height: 32 });
    this.load.svg('robot', 'assets/robot.svg', { width: 40, height: 48 });
  }

  create() {
    // Detect mobile
    this.isMobile = this.sys.game.device.input.touch && window.innerWidth <= 1024;

    // Set up infinite world bounds
    this.physics.world.setBounds(-10000, -10000, 20000, 20000);

    // Create trees group (static, no physics)
    this.trees = this.add.group();

    // Create jumps group (static physics for collision)
    this.jumps = this.physics.add.staticGroup();

    // Spawn initial trees around starting area
    this.spawnInitialTrees();

    // Create player at center
    this.player = this.physics.add.sprite(400, 300, 'player');
    this.player.setDepth(10);

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(100, 100);

    // Create bullet group
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 30
    });

    // Create zombie group
    this.zombies = this.physics.add.group();
    this.spawnZombieWave();

    // Create coins group
    this.coins = this.physics.add.group();

    // Create robots group
    this.robots = this.physics.add.group();

    // Player-coin collision
    this.physics.add.overlap(
      this.player,
      this.coins,
      this.collectCoin as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Bullet-zombie collision
    this.physics.add.overlap(
      this.bullets,
      this.zombies,
      this.hitZombie as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Zombie-player collision (only when not jumping or invulnerable)
    this.physics.add.overlap(
      this.player,
      this.zombies,
      this.gameOver as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      () => !this.isJumping && !this.isInvulnerable,
      this
    );

    // Player-jump collision
    this.physics.add.overlap(
      this.player,
      this.jumps,
      this.hitJump as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Bullet-robot collision
    this.physics.add.overlap(
      this.bullets,
      this.robots,
      this.hitRobot as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Robot-player collision (only when not jumping or invulnerable)
    this.physics.add.overlap(
      this.player,
      this.robots,
      this.gameOver as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      () => !this.isJumping && !this.isInvulnerable,
      this
    );

    // Setup keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    // Dvorak layout: ,AOE are in same physical positions as WASD
    this.dvorak = {
      COMMA: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      O: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };

    // Score display (fixed to camera)
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '24px',
      color: '#333333'
    }).setScrollFactor(0).setDepth(100);

    // Load saved coins and display
    this.coinCount = this.loadCoins();
    this.coinText = this.add.text(16, 46, `Coins: ${this.coinCount}`, {
      fontSize: '20px',
      color: '#b45309'
    }).setScrollFactor(0).setDepth(100);

    // Load owned weapons and selected weapon
    this.ownedWeapons = this.loadOwnedWeapons();
    this.currentWeapon = this.loadSelectedWeapon();

    // Wave display (top right)
    this.waveText = this.add.text(784, 16, 'Wave 1', {
      fontSize: '24px',
      color: '#333333'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    if (this.isMobile) {
      this.createMobileControls();
    } else {
      // Desktop instructions
      this.add.text(400, 580, 'WASD/Arrows to move, Click to shoot', {
        fontSize: '14px',
        color: '#666666'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    }

    // Periodically update zombie directions
    this.time.addEvent({
      delay: 1200,
      callback: this.randomizeZombieMovement,
      callbackScope: this,
      loop: true
    });
  }

  private spawnInitialTrees() {
    // Spawn trees and jumps in a grid pattern around the starting area
    for (let y = -500; y < 1100; y += this.TREE_SPAWN_INTERVAL) {
      // Mark this row as spawned
      const rowKey = Math.floor(y / this.TREE_SPAWN_INTERVAL);
      this.markRowSpawned(rowKey);

      for (let x = -500; x < 1300; x += 80) {
        const offsetX = Phaser.Math.Between(-30, 30);
        const offsetY = Phaser.Math.Between(-30, 30);
        // Avoid spawning too close to player start position
        const dist = Phaser.Math.Distance.Between(x + offsetX, y + offsetY, 400, 300);
        if (dist > 150) {
          const rand = Math.random();
          if (rand < 0.05) {
            // 5% chance for a ski jump
            this.spawnJump(x + offsetX, y + offsetY);
          } else if (rand < 0.45) {
            // 40% chance for a tree
            this.spawnTree(x + offsetX, y + offsetY);
          }
        }
      }
    }

    // Set initial spawn position to match initial area
    this.lastTreeSpawnY = 1100;
  }

  private spawnTree(x: number, y: number) {
    const tree = this.add.image(x, y, 'tree');
    tree.setDepth(y); // Trees further down appear in front
    this.trees.add(tree);
  }

  private spawnJump(x: number, y: number) {
    const jump = this.jumps.create(x, y, 'jump') as Phaser.Physics.Arcade.Sprite;
    jump.setDepth(y - 10); // Jumps appear slightly behind things at same y
    jump.refreshBody();
  }

  private hitJump(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    jump: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    if (this.isJumping) return; // Already jumping

    const p = player as Phaser.Physics.Arcade.Sprite;
    const j = jump as Phaser.Physics.Arcade.Sprite;
    const playerVelY = p.body?.velocity.y || 0;

    // Check if player is moving upward (trying to go up the ramp from below)
    if (playerVelY < -10) {
      // Block upward movement - push player back down
      p.y = j.y + 40;
      p.body!.velocity.y = 0;
      return;
    }

    // Only trigger jump if moving downward
    if (playerVelY > 50) {
      this.triggerJump();
    }
  }

  private triggerJump() {
    if (this.isJumping) return;

    this.isJumping = true;
    const jumpDuration = 800;
    const jumpDistance = 150;

    // Store original position
    const startY = this.player.y;

    // Scale up and move player during jump
    this.tweens.add({
      targets: this.player,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: jumpDuration / 2,
      ease: 'Quad.easeOut',
      yoyo: true
    });

    // Increase depth while jumping so player appears above everything
    this.player.setDepth(1000);

    // Move player down during jump (in the air)
    this.tweens.add({
      targets: this.player,
      y: startY + jumpDistance,
      duration: jumpDuration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Check for zombies at landing position
        this.checkLandingOnZombies();

        this.isJumping = false;
        this.player.setDepth(10);
        this.player.setScale(1);

        // Start post-landing invulnerability
        this.startInvulnerability();
      }
    });
  }

  private startInvulnerability() {
    this.isInvulnerable = true;

    // Blinking effect to show invulnerability
    const blinkTween = this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 100,
      ease: 'Linear',
      yoyo: true,
      repeat: 4
    });

    // End invulnerability after 1 second
    this.time.delayedCall(1000, () => {
      this.isInvulnerable = false;
      this.player.setAlpha(1);
      blinkTween.stop();
    });
  }

  private checkLandingOnZombies() {
    const landingRadius = 40;

    // Check zombies
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const zombie of zombies) {
      if (!zombie.active) continue;

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        zombie.x, zombie.y
      );

      if (dist < landingRadius) {
        // Explode the zombie!
        this.explodeZombie(zombie);
      }
    }

    // Check robots
    const robots = this.robots.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const robot of robots) {
      if (!robot.active) continue;

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        robot.x, robot.y
      );

      if (dist < landingRadius) {
        // Explode the robot!
        this.explodeRobot(robot);
      }
    }
  }

  private explodeZombie(zombie: Phaser.Physics.Arcade.Sprite) {
    const x = zombie.x;
    const y = zombie.y;
    const points = zombie.getData('points') || 10;
    const maxHealth = zombie.getData('maxHealth') || 1;
    const isBoss = zombie.getData('isBoss');

    // Award bonus points for landing kill (10x points!)
    this.score += points * 10;
    this.scoreText.setText(`Score: ${this.score}`);

    // Boss stomped - drop lots of coins and big explosions
    if (isBoss) {
      const coinCount = Phaser.Math.Between(8, 15);
      for (let i = 0; i < coinCount; i++) {
        this.time.delayedCall(i * 80, () => {
          const offsetX = Phaser.Math.Between(-50, 50);
          const offsetY = Phaser.Math.Between(-50, 50);
          this.spawnCoin(x + offsetX, y + offsetY);
        });
      }
      for (let i = 0; i < 7; i++) {
        this.time.delayedCall(i * 40, () => {
          const offsetX = Phaser.Math.Between(-50, 50);
          const offsetY = Phaser.Math.Between(-50, 50);
          this.createExplosion(x + offsetX, y + offsetY);
        });
      }
      // Destroy health bar
      const healthBarBg = zombie.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
      const healthBarFg = zombie.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
      if (healthBarBg) healthBarBg.destroy();
      if (healthBarFg) healthBarFg.destroy();
    } else if (maxHealth > 1 && Math.random() < 0.5) {
      // Red zombies also drop coins when stomped (50% chance, higher than normal)
      this.spawnCoin(x, y);
    }

    // Destroy the zombie
    zombie.destroy();

    // Create particle explosion
    this.createExplosion(x, y);
  }

  private explodeRobot(robot: Phaser.Physics.Arcade.Sprite) {
    const x = robot.x;
    const y = robot.y;

    // Massive bonus for stomping a robot: 1000 points!
    this.score += 1000;
    this.scoreText.setText(`Score: ${this.score}`);

    // Robots drop 25 coins when stomped!
    this.coinCount += 25;
    this.coinText.setText(`Coins: ${this.coinCount}`);
    this.saveCoins();

    // Spawn visual coins flying out
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 50, () => {
        const offsetX = Phaser.Math.Between(-30, 30);
        const offsetY = Phaser.Math.Between(-30, 30);
        this.spawnCoin(x + offsetX, y + offsetY);
      });
    }

    // Destroy the robot
    robot.destroy();

    // Create bigger explosion for robot
    this.createExplosion(x, y);
    // Extra explosion particles for robot
    this.time.delayedCall(50, () => this.createExplosion(x + 10, y - 10));
    this.time.delayedCall(100, () => this.createExplosion(x - 10, y + 10));
  }

  private createExplosion(x: number, y: number) {
    const particleCount = 12;
    const colors = [0x5a8a9a, 0x7ac8d8, 0xff4444, 0xffff00, 0xff8800];

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = Phaser.Math.Between(80, 150);
      const color = colors[Phaser.Math.Between(0, colors.length - 1)];
      const size = Phaser.Math.Between(4, 10);

      const particle = this.add.circle(x, y, size, color);
      particle.setDepth(500);

      // Animate particle outward
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(300, 500),
        ease: 'Quad.easeOut',
        onComplete: () => {
          particle.destroy();
        }
      });
    }

    // Add a flash circle
    const flash = this.add.circle(x, y, 30, 0xffffff, 0.8);
    flash.setDepth(499);
    this.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        flash.destroy();
      }
    });
  }

  private spawnTreesAroundPlayer() {
    const cam = this.cameras.main;
    const margin = 300;
    const viewLeft = cam.scrollX - margin;
    const viewRight = cam.scrollX + cam.width + margin;
    const viewTop = cam.scrollY - margin;
    const viewBottom = cam.scrollY + cam.height + margin;

    // Spawn trees/jumps in rows as player moves DOWN
    while (this.lastTreeSpawnY < viewBottom) {
      this.lastTreeSpawnY += this.TREE_SPAWN_INTERVAL;
      this.spawnTreeRow(viewLeft, viewRight, this.lastTreeSpawnY);
    }

    // Spawn trees/jumps in rows as player moves UP
    const initialY = this.lastTreeSpawnY - ((this.lastTreeSpawnY - viewTop) % this.TREE_SPAWN_INTERVAL);
    for (let y = initialY; y > viewTop; y -= this.TREE_SPAWN_INTERVAL) {
      // Check if this row needs spawning (use a simple hash to ensure consistency)
      const rowKey = Math.floor(y / this.TREE_SPAWN_INTERVAL);
      if (!this.isRowSpawned(rowKey)) {
        this.spawnTreeRow(viewLeft, viewRight, y);
        this.markRowSpawned(rowKey);
      }
    }
  }

  private spawnedRows = new Set<number>();

  private isRowSpawned(rowKey: number): boolean {
    return this.spawnedRows.has(rowKey);
  }

  private markRowSpawned(rowKey: number) {
    this.spawnedRows.add(rowKey);
    // Clean up old entries to prevent memory issues
    if (this.spawnedRows.size > 200) {
      const keysToDelete: number[] = [];
      const minKey = Math.floor((this.player.y - 2000) / this.TREE_SPAWN_INTERVAL);
      this.spawnedRows.forEach(key => {
        if (key < minKey) keysToDelete.push(key);
      });
      keysToDelete.forEach(key => this.spawnedRows.delete(key));
    }
  }

  private spawnTreeRow(left: number, right: number, y: number) {
    for (let x = left; x < right; x += 80) {
      const rand = Math.random();
      const offsetX = Phaser.Math.Between(-30, 30);
      const offsetY = Phaser.Math.Between(-40, 40);
      const spawnX = x + offsetX;
      const spawnY = y + offsetY;

      // Avoid spawning too close to player
      const distToPlayer = Phaser.Math.Distance.Between(spawnX, spawnY, this.player.x, this.player.y);
      if (distToPlayer < 100) continue;

      if (rand < 0.03) {
        // 3% chance for a ski jump
        this.spawnJump(spawnX, spawnY);
      } else if (rand < 0.35) {
        // 32% chance for a tree
        this.spawnTree(spawnX, spawnY);
      }
    }
  }

  private cleanupDistantObjects() {
    const cam = this.cameras.main;
    const cleanupDistance = 1000;

    // Remove trees that are too far above the camera
    this.trees.getChildren().forEach((tree) => {
      const t = tree as Phaser.GameObjects.Image;
      if (t.y < cam.scrollY - cleanupDistance) {
        t.destroy();
      }
    });

    // Remove zombies that are too far from player
    this.zombies.getChildren().forEach((zombie) => {
      const z = zombie as Phaser.Physics.Arcade.Sprite;
      if (z.active) {
        const dist = Phaser.Math.Distance.Between(z.x, z.y, this.player.x, this.player.y);
        if (dist > cleanupDistance) {
          // Clean up boss health bar if applicable
          if (z.getData('isBoss')) {
            const healthBarBg = z.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
            const healthBarFg = z.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
            if (healthBarBg) healthBarBg.destroy();
            if (healthBarFg) healthBarFg.destroy();
          }
          z.destroy();
        }
      }
    });

    // Remove coins that are too far from player
    this.coins.getChildren().forEach((coin) => {
      const c = coin as Phaser.Physics.Arcade.Sprite;
      if (c.active) {
        const dist = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
        if (dist > cleanupDistance) {
          c.destroy();
        }
      }
    });

    // Remove jumps that are too far above the camera
    this.jumps.getChildren().forEach((jump) => {
      const j = jump as Phaser.Physics.Arcade.Sprite;
      if (j.y < cam.scrollY - cleanupDistance) {
        j.destroy();
      }
    });
  }

  private createMobileControls() {
    // Enable multi-touch
    this.input.addPointer(1);

    const leftX = 100;
    const rightX = 700;
    const joystickY = 500;

    // Left joystick (movement)
    const leftBase = this.add.circle(leftX, joystickY, this.JOYSTICK_RADIUS, 0x444444, 0.5);
    const leftThumb = this.add.circle(leftX, joystickY, this.THUMB_RADIUS, 0x888888, 0.8);
    leftBase.setDepth(100).setScrollFactor(0);
    leftThumb.setDepth(101).setScrollFactor(0);

    this.leftJoystick = {
      base: leftBase,
      thumb: leftThumb,
      pointerId: null,
      vector: new Phaser.Math.Vector2(0, 0),
      baseX: leftX,
      baseY: joystickY
    };

    // Right joystick (aim/shoot)
    const rightBase = this.add.circle(rightX, joystickY, this.JOYSTICK_RADIUS, 0x444444, 0.5);
    const rightThumb = this.add.circle(rightX, joystickY, this.THUMB_RADIUS, 0x888888, 0.8);
    rightBase.setDepth(100).setScrollFactor(0);
    rightThumb.setDepth(101).setScrollFactor(0);

    this.rightJoystick = {
      base: rightBase,
      thumb: rightThumb,
      pointerId: null,
      vector: new Phaser.Math.Vector2(0, 0),
      baseX: rightX,
      baseY: joystickY
    };

    // Fullscreen button (hide if running as standalone PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      const fsButton = this.add.text(400, 50, '[ Fullscreen ]', {
        fontSize: '20px',
        color: '#333333',
        backgroundColor: '#cccccc',
        padding: { x: 15, y: 10 }
      }).setOrigin(0.5).setInteractive().setDepth(100).setScrollFactor(0);

      fsButton.on('pointerdown', () => {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
        } else {
          this.scale.startFullscreen();
        }
      });
    }

    // Touch handlers
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const leftDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.leftJoystick.baseX, this.leftJoystick.baseY);
      const rightDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.rightJoystick.baseX, this.rightJoystick.baseY);

      if (leftDist < this.JOYSTICK_RADIUS * 2 && this.leftJoystick.pointerId === null) {
        this.leftJoystick.pointerId = pointer.id;
      } else if (rightDist < this.JOYSTICK_RADIUS * 2 && this.rightJoystick.pointerId === null) {
        this.rightJoystick.pointerId = pointer.id;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updateJoystick(this.leftJoystick, pointer);
      this.updateJoystick(this.rightJoystick, pointer);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.leftJoystick.pointerId === pointer.id) {
        this.resetJoystick(this.leftJoystick);
      }
      if (this.rightJoystick.pointerId === pointer.id) {
        this.resetJoystick(this.rightJoystick);
      }
    });
  }

  private updateJoystick(joystick: VirtualJoystick, pointer: Phaser.Input.Pointer) {
    if (joystick.pointerId !== pointer.id) return;

    const dx = pointer.x - joystick.baseX;
    const dy = pointer.y - joystick.baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = this.JOYSTICK_RADIUS;

    if (distance > 0) {
      const clampedDistance = Math.min(distance, maxDistance);
      const angle = Math.atan2(dy, dx);

      joystick.thumb.x = joystick.baseX + Math.cos(angle) * clampedDistance;
      joystick.thumb.y = joystick.baseY + Math.sin(angle) * clampedDistance;

      joystick.vector.x = (clampedDistance / maxDistance) * Math.cos(angle);
      joystick.vector.y = (clampedDistance / maxDistance) * Math.sin(angle);
    }
  }

  private resetJoystick(joystick: VirtualJoystick) {
    joystick.pointerId = null;
    joystick.thumb.x = joystick.baseX;
    joystick.thumb.y = joystick.baseY;
    joystick.vector.set(0, 0);
  }

  private spawnZombieWave() {
    const zombieCount = 8 + this.waveNumber * 4;

    for (let i = 0; i < zombieCount; i++) {
      this.time.delayedCall(i * 150, () => {
        this.spawnZombieFromEdge();
      });
    }

    // Spawn boss(es) on specific waves
    this.spawnBossesForWave();
  }

  private spawnBossesForWave() {
    // Wave 3: x1 health, Wave 6: x2 health, Wave 10: x5 health
    const healthMultipliers: { [key: number]: number } = { 3: 1, 6: 2, 10: 5 };
    const speedMultipliers: { [key: number]: number } = { 3: 1, 6: 1.2, 10: 1.5 };

    if (this.BOSS_WAVES.includes(this.waveNumber)) {
      const healthMult = healthMultipliers[this.waveNumber] || 1;
      const speedMult = speedMultipliers[this.waveNumber] || 1;
      this.time.delayedCall(500, () => {
        this.spawnBossZombie(healthMult, speedMult);
      });
    } else if (this.waveNumber >= this.MULTI_BOSS_WAVE) {
      // After wave 12, spawn multiple bosses
      const bossCount = Math.min(1 + Math.floor((this.waveNumber - this.MULTI_BOSS_WAVE) / 2), 5);
      const healthMult = 5 + (this.waveNumber - this.MULTI_BOSS_WAVE);
      const speedMult = 1.5 + (this.waveNumber - this.MULTI_BOSS_WAVE) * 0.1;

      for (let i = 0; i < bossCount; i++) {
        this.time.delayedCall(500 + i * 300, () => {
          this.spawnBossZombie(healthMult, speedMult);
        });
      }
    }
  }

  private spawnBossZombie(healthMultiplier: number = 1, speedMultiplier: number = 1) {
    const cam = this.cameras.main;

    // Spawn from bottom of screen
    const x = Phaser.Math.Between(cam.scrollX + 100, cam.scrollX + cam.width - 100);
    const y = cam.scrollY + cam.height + 100;

    const baseHealth = 50;
    const health = baseHealth * healthMultiplier;

    const boss = this.zombies.create(x, y, 'boss-zombie') as Phaser.Physics.Arcade.Sprite;
    boss.setScale(2); // Already a big sprite, scale up more
    boss.setDepth(y);
    boss.setData('health', health);
    boss.setData('maxHealth', health);
    boss.setData('points', 500 * healthMultiplier);
    boss.setData('isBoss', true);
    boss.setData('speedMultiplier', speedMultiplier);

    // Create health bar above boss
    const barWidth = 80;
    const barHeight = 8;
    const healthBarBg = this.add.rectangle(x, y - 70, barWidth, barHeight, 0x880000);
    const healthBarFg = this.add.rectangle(x, y - 70, barWidth, barHeight, 0x00ff00);
    healthBarBg.setDepth(y + 1);
    healthBarFg.setDepth(y + 2);
    boss.setData('healthBarBg', healthBarBg);
    boss.setData('healthBarFg', healthBarFg);
    boss.setData('healthBarWidth', barWidth);

    this.setBossVelocity(boss, speedMultiplier);
  }

  private setBossVelocity(boss: Phaser.Physics.Arcade.Sprite, speedMultiplier: number) {
    const baseSpeed = this.ZOMBIE_BASE_SPEED + 30;
    const speed = baseSpeed * speedMultiplier;
    const dx = this.player.x - boss.x;
    const dy = this.player.y - boss.y;
    const angle = Math.atan2(dy, dx);
    const wobbleAngle = angle + Phaser.Math.FloatBetween(-0.3, 0.3);

    boss.setVelocity(
      Math.cos(wobbleAngle) * speed,
      Math.sin(wobbleAngle) * speed
    );

    boss.setData('speed', speed);
    boss.setData('waddleOffset', Phaser.Math.FloatBetween(0, Math.PI * 2));
  }

  private spawnZombieFromEdge() {
    const cam = this.cameras.main;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;
    const margin = 50;

    switch (edge) {
      case 0: // Top
        x = Phaser.Math.Between(cam.scrollX - margin, cam.scrollX + cam.width + margin);
        y = cam.scrollY - margin;
        break;
      case 1: // Right
        x = cam.scrollX + cam.width + margin;
        y = Phaser.Math.Between(cam.scrollY - margin, cam.scrollY + cam.height + margin);
        break;
      case 2: // Bottom
        x = Phaser.Math.Between(cam.scrollX - margin, cam.scrollX + cam.width + margin);
        y = cam.scrollY + cam.height + margin;
        break;
      case 3: // Left
      default:
        x = cam.scrollX - margin;
        y = Phaser.Math.Between(cam.scrollY - margin, cam.scrollY + cam.height + margin);
        break;
    }

    const zombie = this.zombies.create(x, y, 'zombie') as Phaser.Physics.Arcade.Sprite;
    zombie.setDepth(y);

    // 20% chance for red zombie (increases with wave)
    const redChance = Math.min(0.2 + this.waveNumber * 0.05, 0.5);
    const isRed = Math.random() < redChance;

    if (isRed) {
      zombie.setTint(0xff4444);
      zombie.setData('health', 3);
      zombie.setData('maxHealth', 3);
      zombie.setData('points', 50);
      zombie.setScale(1.2);
    } else {
      zombie.setData('health', 1);
      zombie.setData('maxHealth', 1);
      zombie.setData('points', 10);
    }

    this.setZombieVelocity(zombie);
  }

  private setZombieVelocity(zombie: Phaser.Physics.Arcade.Sprite) {
    const speed = this.ZOMBIE_BASE_SPEED + Phaser.Math.Between(20, 60);
    const dx = this.player.x - zombie.x;
    const dy = this.player.y - zombie.y;
    const angle = Math.atan2(dy, dx);
    const wobbleAngle = angle + Phaser.Math.FloatBetween(-0.5, 0.5);

    zombie.setVelocity(
      Math.cos(wobbleAngle) * speed,
      Math.sin(wobbleAngle) * speed
    );

    zombie.setData('speed', speed);
    zombie.setData('waddleOffset', Phaser.Math.FloatBetween(0, Math.PI * 2));
  }

  private randomizeZombieMovement() {
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];

    for (const zombie of zombies) {
      if (!zombie.active) continue;
      if (zombie.getData('isBoss')) {
        const speedMult = zombie.getData('speedMultiplier') || 1;
        this.setBossVelocity(zombie, speedMult);
      } else {
        this.setZombieVelocity(zombie);
      }
    }
  }

  update() {
    let vx = 0;
    let vy = 0;
    let isShooting = false;

    if (this.isMobile) {
      // Mobile: use joysticks
      vx = this.leftJoystick.vector.x * this.PLAYER_SPEED;
      vy = this.leftJoystick.vector.y * this.PLAYER_SPEED;

      // Bonus speed when moving down
      if (vy > 0) {
        vy += this.PLAYER_SPEED_DOWN_BONUS * this.leftJoystick.vector.y;
      }

      // Right joystick for aiming and shooting
      if (this.rightJoystick.vector.length() > 0.1) {
        this.aimAngle = Math.atan2(this.rightJoystick.vector.y, this.rightJoystick.vector.x);
        isShooting = true;
      }
    } else {
      // Desktop: keyboard + mouse (supports WASD and Dvorak ,AOE)
      if (this.cursors.left.isDown || this.wasd.A.isDown || this.dvorak.A.isDown) {
        vx = -this.PLAYER_SPEED;
      } else if (this.cursors.right.isDown || this.wasd.D.isDown || this.dvorak.E.isDown) {
        vx = this.PLAYER_SPEED;
      }

      if (this.cursors.up.isDown || this.wasd.W.isDown || this.dvorak.COMMA.isDown) {
        vy = -this.PLAYER_SPEED;
      } else if (this.cursors.down.isDown || this.wasd.S.isDown || this.dvorak.O.isDown) {
        vy = this.PLAYER_SPEED + this.PLAYER_SPEED_DOWN_BONUS;
      }

      // Mouse for aiming (no rotation - just for shooting direction)
      const pointer = this.input.activePointer;
      this.aimAngle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        pointer.worldX,
        pointer.worldY
      );

      isShooting = pointer.isDown;
    }

    this.player.setVelocity(vx, vy);

    // Update player sprite based on movement direction
    this.updatePlayerSprite(vx, vy);

    // Shooting
    if (isShooting && this.canShoot) {
      this.shoot();
    }

    // Remove bullets that are too far from player
    this.bullets.getChildren().forEach((bullet) => {
      const b = bullet as Phaser.Physics.Arcade.Sprite;
      if (b.active) {
        const dist = Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y);
        if (dist > 600) {
          b.setActive(false);
          b.setVisible(false);
        }
      }
    });

    // Spawn trees as player moves
    this.spawnTreesAroundPlayer();

    // Cleanup distant objects periodically
    if (Math.random() < 0.02) {
      this.cleanupDistantObjects();
    }

    // Update zombies
    this.updateZombies();
  }

  private updatePlayerSprite(vx: number, vy: number) {
    // Don't change sprite during jump
    if (this.isJumping) return;

    // Reset rotation first
    this.player.rotation = 0;

    // Determine which sprite to use based on movement
    const movingLeft = vx < -50;
    const movingRight = vx > 50;
    const movingUp = vy < -50;
    const movingDown = vy > 50;

    if (movingUp) {
      // Going uphill - use default sprite with waggle
      this.player.setTexture('player');
      const waggle = Math.sin(this.time.now * 0.015) * 0.15;
      this.player.rotation = waggle;
    } else if (movingLeft && !movingDown) {
      this.player.setTexture('player-left');
    } else if (movingRight && !movingDown) {
      this.player.setTexture('player-right');
    } else if (movingDown || movingLeft || movingRight) {
      // Moving down (or diagonally down)
      if (movingLeft) {
        this.player.setTexture('player-left');
      } else if (movingRight) {
        this.player.setTexture('player-right');
      } else {
        this.player.setTexture('player-down');
      }
    } else {
      // Standing still - use down-facing sprite
      this.player.setTexture('player-down');
    }
  }

  private updateZombies() {
    const zombies = this.zombies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const time = this.time.now;

    for (const zombie of zombies) {
      if (!zombie.active) continue;

      const waddleOffset = zombie.getData('waddleOffset') || 0;
      const speed = zombie.getData('speed') || this.ZOMBIE_BASE_SPEED;
      const waddleSpeed = speed * 0.1;
      zombie.rotation = Math.sin(time * 0.01 * waddleSpeed + waddleOffset) * 0.2;

      // Update depth based on Y position
      zombie.setDepth(zombie.y);

      // Update boss health bar position
      if (zombie.getData('isBoss')) {
        const healthBarBg = zombie.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
        const healthBarFg = zombie.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
        if (healthBarBg && healthBarFg) {
          healthBarBg.setPosition(zombie.x, zombie.y - 70);
          healthBarFg.setPosition(zombie.x, zombie.y - 70);
          healthBarBg.setDepth(zombie.y + 1);
          healthBarFg.setDepth(zombie.y + 2);
        }
      }
    }

    if (zombies.filter(z => z.active).length === 0) {
      this.waveNumber++;
      this.waveText.setText(`Wave ${this.waveNumber}`);
      this.spawnZombieWave();

      // Start robot attacks after wave 3
      if (this.waveNumber >= this.ROBOT_FIRST_WAVE && !this.robotCooldown && this.robotBurstCount === 0) {
        this.startRobotBurst();
      }
    }

    // Update robots
    this.updateRobots();
  }

  private startRobotBurst() {
    // Start a burst of 3-4 robots
    this.robotBurstMax = Phaser.Math.Between(3, 4);
    this.robotBurstCount = 0;
    this.spawnRobotWithDelay();
  }

  private spawnRobotWithDelay() {
    if (this.robotBurstCount >= this.robotBurstMax) {
      // Burst complete, start cooldown
      this.robotCooldown = true;
      this.time.delayedCall(8000, () => {
        this.robotCooldown = false;
      });
      return;
    }

    // Spawn a robot after a short delay
    this.time.delayedCall(1500, () => {
      this.spawnRobot();
      this.robotBurstCount++;
      this.spawnRobotWithDelay();
    });
  }

  private spawnRobot() {
    const cam = this.cameras.main;
    const margin = 60;

    // Spawn from a random edge
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    switch (edge) {
      case 0: // Top
        x = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        y = cam.scrollY - margin;
        break;
      case 1: // Right
        x = cam.scrollX + cam.width + margin;
        y = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
      case 2: // Bottom
        x = Phaser.Math.Between(cam.scrollX + 50, cam.scrollX + cam.width - 50);
        y = cam.scrollY + cam.height + margin;
        break;
      case 3: // Left
      default:
        x = cam.scrollX - margin;
        y = Phaser.Math.Between(cam.scrollY + 50, cam.scrollY + cam.height - 50);
        break;
    }

    const robot = this.robots.create(x, y, 'robot') as Phaser.Physics.Arcade.Sprite;
    robot.setDepth(y);
    robot.setData('health', 2);
    robot.setData('points', 75);

    // Calculate direction to player at spawn time (fixed direction)
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    robot.setData('angle', angle);
    robot.rotation = angle + Math.PI / 2;

    // Set velocity in straight line towards where player WAS
    robot.setVelocity(
      Math.cos(angle) * this.ROBOT_SPEED,
      Math.sin(angle) * this.ROBOT_SPEED
    );

    // Add a warning flash effect
    robot.setTintFill(0xffffff);
    this.time.delayedCall(100, () => {
      if (robot.active) robot.clearTint();
    });
  }

  private updateRobots() {
    const cam = this.cameras.main;
    const margin = 200;

    const robots = this.robots.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const robot of robots) {
      if (!robot.active) continue;

      // Update depth
      robot.setDepth(robot.y);

      // Remove if too far off screen
      if (robot.x < cam.scrollX - margin ||
          robot.x > cam.scrollX + cam.width + margin ||
          robot.y < cam.scrollY - margin ||
          robot.y > cam.scrollY + cam.height + margin) {
        robot.destroy();
      }
    }
  }

  private hitRobot(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    robot: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    const r = robot as Phaser.Physics.Arcade.Sprite;

    b.setActive(false);
    b.setVisible(false);

    // Reduce health
    const health = r.getData('health') - 1;
    r.setData('health', health);

    if (health <= 0) {
      // Robot destroyed
      const points = r.getData('points') || 75;
      this.score += points;
      this.scoreText.setText(`Score: ${this.score}`);

      // Burst shot effect - spawn projectiles on kill (if not from a burst bullet)
      if (this.currentWeapon === 'burst-shot' && !b.getData('isBurstBullet')) {
        this.spawnBurstShots(r.x, r.y);
      }

      // Create explosion
      this.createExplosion(r.x, r.y);
      r.destroy();
    } else {
      // Flash to show hit
      r.setTintFill(0xffffff);
      this.time.delayedCall(50, () => {
        if (r.active) r.clearTint();
      });
    }
  }

  private shoot() {
    const offsetX = Math.cos(this.aimAngle) * 30;
    const offsetY = Math.sin(this.aimAngle) * 30;

    if (this.currentWeapon === 'double-barrel') {
      // Shoot 2 bullets with slight angle spread
      this.shootBullet(this.aimAngle - 0.1, offsetX, offsetY);
      this.shootBullet(this.aimAngle + 0.1, offsetX, offsetY);
    } else {
      // Default and burst-shot both fire single bullets
      // (burst-shot effect happens on kill)
      this.shootBullet(this.aimAngle, offsetX, offsetY);
    }

    this.canShoot = false;
    this.time.delayedCall(this.SHOOT_COOLDOWN, () => {
      this.canShoot = true;
    });
  }

  private shootBullet(angle: number, offsetX: number, offsetY: number) {
    const bullet = this.bullets.get(
      this.player.x + offsetX,
      this.player.y + offsetY
    ) as Phaser.Physics.Arcade.Sprite;

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.rotation = angle + Math.PI / 2;
      bullet.setDepth(5);
      bullet.setData('isBurstBullet', false);
      bullet.setVelocity(
        Math.cos(angle) * this.BULLET_SPEED,
        Math.sin(angle) * this.BULLET_SPEED
      );
    }
  }

  private spawnBurstShots(x: number, y: number) {
    // Spawn 6 bullets in all directions
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bullet = this.bullets.get(x, y) as Phaser.Physics.Arcade.Sprite;

      if (bullet) {
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.rotation = angle + Math.PI / 2;
        bullet.setDepth(5);
        bullet.setData('isBurstBullet', true);
        bullet.setTint(0xff8800); // Orange tint for burst bullets
        bullet.setVelocity(
          Math.cos(angle) * this.BULLET_SPEED * 0.7,
          Math.sin(angle) * this.BULLET_SPEED * 0.7
        );

        // Burst bullets travel shorter distance (destroy after 200ms)
        this.time.delayedCall(200, () => {
          if (bullet.active) {
            bullet.setActive(false);
            bullet.setVisible(false);
            bullet.clearTint();
          }
        });
      }
    }
  }

  private spawnCoin(x: number, y: number) {
    const coin = this.coins.create(x, y, 'coin') as Phaser.Physics.Arcade.Sprite;
    coin.setDepth(5);

    // Add a little bounce animation
    this.tweens.add({
      targets: coin,
      y: y - 20,
      duration: 200,
      ease: 'Quad.easeOut',
      yoyo: true
    });

    // Add spinning effect
    this.tweens.add({
      targets: coin,
      scaleX: { from: 1, to: 0.3 },
      duration: 150,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private collectCoin(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    coin: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const c = coin as Phaser.Physics.Arcade.Sprite;
    c.destroy();

    this.coinCount++;
    this.coinText.setText(`Coins: ${this.coinCount}`);
    this.saveCoins();
  }

  private loadCoins(): number {
    try {
      const stored = localStorage.getItem(this.COINS_KEY);
      if (stored) {
        return parseInt(stored, 10) || 0;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 0;
  }

  private saveCoins() {
    try {
      localStorage.setItem(this.COINS_KEY, this.coinCount.toString());
    } catch {
      // Ignore localStorage errors
    }
  }

  private loadOwnedWeapons(): WeaponType[] {
    try {
      const stored = localStorage.getItem(this.WEAPONS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
    return ['default'];
  }

  private saveOwnedWeapons() {
    try {
      localStorage.setItem(this.WEAPONS_KEY, JSON.stringify(this.ownedWeapons));
    } catch {
      // Ignore localStorage errors
    }
  }

  private loadSelectedWeapon(): WeaponType {
    try {
      const stored = localStorage.getItem(this.SELECTED_WEAPON_KEY);
      if (stored && this.ownedWeapons.includes(stored as WeaponType)) {
        return stored as WeaponType;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'default';
  }

  private saveSelectedWeapon() {
    try {
      localStorage.setItem(this.SELECTED_WEAPON_KEY, this.currentWeapon);
    } catch {
      // Ignore localStorage errors
    }
  }

  private buyWeapon(weapon: WeaponType): boolean {
    const cost = this.WEAPONS[weapon].cost;
    if (this.coinCount >= cost && !this.ownedWeapons.includes(weapon)) {
      this.coinCount -= cost;
      this.ownedWeapons.push(weapon);
      this.saveCoins();
      this.saveOwnedWeapons();
      return true;
    }
    return false;
  }

  private selectWeapon(weapon: WeaponType) {
    if (this.ownedWeapons.includes(weapon)) {
      this.currentWeapon = weapon;
      this.saveSelectedWeapon();
    }
  }

  private hitZombie(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    zombie: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    const z = zombie as Phaser.Physics.Arcade.Sprite;

    b.setActive(false);
    b.setVisible(false);

    // Reduce health
    const health = z.getData('health') - 1;
    z.setData('health', health);

    if (health <= 0) {
      // Zombie dies
      const points = z.getData('points') || 10;
      this.score += points;

      const isBoss = z.getData('isBoss');
      if (isBoss) {
        // Boss death - drop 5-10 coins and big explosion
        const coinCount = Phaser.Math.Between(5, 10);
        for (let i = 0; i < coinCount; i++) {
          this.time.delayedCall(i * 100, () => {
            const offsetX = Phaser.Math.Between(-50, 50);
            const offsetY = Phaser.Math.Between(-50, 50);
            this.spawnCoin(z.x + offsetX, z.y + offsetY);
          });
        }
        // Big explosion effect
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 50, () => {
            const offsetX = Phaser.Math.Between(-40, 40);
            const offsetY = Phaser.Math.Between(-40, 40);
            this.createExplosion(z.x + offsetX, z.y + offsetY);
          });
        }
      } else {
        // Red zombies (maxHealth > 1) have 35% chance to drop a coin
        const maxHealth = z.getData('maxHealth') || 1;
        if (maxHealth > 1 && Math.random() < 0.35) {
          this.spawnCoin(z.x, z.y);
        }
      }

      // Burst shot effect - spawn projectiles on kill (if not from a burst bullet)
      if (this.currentWeapon === 'burst-shot' && !b.getData('isBurstBullet')) {
        this.spawnBurstShots(z.x, z.y);
      }

      // Destroy health bar if boss
      if (isBoss) {
        const healthBarBg = z.getData('healthBarBg') as Phaser.GameObjects.Rectangle;
        const healthBarFg = z.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
        if (healthBarBg) healthBarBg.destroy();
        if (healthBarFg) healthBarFg.destroy();
      }

      z.destroy();
    } else {
      // Flash white to show hit
      z.setTintFill(0xffffff);
      this.time.delayedCall(50, () => {
        if (z.active) {
          const maxHealth = z.getData('maxHealth');
          const damageRatio = health / maxHealth;
          const isBoss = z.getData('isBoss');

          if (isBoss) {
            // Boss uses dedicated sprite, darken slightly based on damage
            const brightness = Math.floor(0x88 + (0x77 * damageRatio));
            z.setTint((brightness << 16) | (brightness << 8) | brightness);

            // Update health bar
            const healthBarFg = z.getData('healthBarFg') as Phaser.GameObjects.Rectangle;
            const barWidth = z.getData('healthBarWidth') as number;
            if (healthBarFg && barWidth) {
              healthBarFg.width = barWidth * damageRatio;
            }
          } else if (maxHealth > 1) {
            // Restore red tint for red zombies
            const red = Math.floor(0xff * damageRatio);
            const tint = (red << 16) | 0x4444;
            z.setTint(tint);
          } else {
            z.clearTint();
          }
        }
      });
    }

    this.scoreText.setText(`Score: ${this.score}`);
  }

  private getHighScores(): number[] {
    try {
      const stored = localStorage.getItem(this.HIGH_SCORES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
    return [];
  }

  private saveHighScore(score: number): { scores: number[]; rank: number } {
    const scores = this.getHighScores();
    scores.push(score);
    scores.sort((a, b) => b - a);
    const topScores = scores.slice(0, 5);

    try {
      localStorage.setItem(this.HIGH_SCORES_KEY, JSON.stringify(topScores));
    } catch {
      // Ignore localStorage errors
    }

    const rank = topScores.indexOf(score) + 1;
    return { scores: topScores, rank: rank <= 5 ? rank : 0 };
  }

  private gameOver() {
    this.physics.pause();
    this.player.setTint(0xff0000);

    // Save score and get rankings
    const { scores, rank } = this.saveHighScore(this.score);

    // Game over title (fixed to screen)
    this.add.text(400, 150, 'GAME OVER', {
      fontSize: '64px',
      color: '#ff0000'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Current score
    const scoreColor = rank > 0 ? '#cc8800' : '#333333';
    const newHighText = rank === 1 ? ' - NEW BEST!' : rank > 0 ? ` - #${rank}` : '';
    this.add.text(400, 220, `Score: ${this.score}${newHighText}`, {
      fontSize: '28px',
      color: scoreColor
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Coins collected
    this.add.text(400, 252, `Coins collected: ${this.coinCount}`, {
      fontSize: '20px',
      color: '#b45309'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // High scores title
    this.add.text(400, 290, 'TOP 5', {
      fontSize: '20px',
      color: '#666666'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Display top 5 scores
    scores.forEach((s, i) => {
      const isCurrentScore = s === this.score && i === rank - 1;
      const color = isCurrentScore ? '#cc8800' : '#333333';
      this.add.text(400, 320 + i * 28, `${i + 1}. ${s}`, {
        fontSize: '22px',
        color
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    });

    // Buttons
    const buttonY = 340 + Math.max(scores.length, 1) * 28 + 20;

    // Shop button
    const shopBtn = this.add.text(300, buttonY, '[ SHOP ]', {
      fontSize: '24px',
      color: '#333333',
      backgroundColor: '#88cc88',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(200);

    shopBtn.on('pointerdown', () => {
      this.showShop();
    });

    // Restart button
    const restartText = this.isMobile ? '[ PLAY ]' : '[ PLAY ] (R)';
    const restartBtn = this.add.text(500, buttonY, restartText, {
      fontSize: '24px',
      color: '#333333',
      backgroundColor: '#cccccc',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(200);

    restartBtn.on('pointerdown', () => {
      this.restartGame();
    });

    if (!this.isMobile) {
      this.input.keyboard!.once('keydown-R', () => {
        this.restartGame();
      });
    }
  }

  private showShop() {
    // Create shop overlay
    const overlay = this.add.rectangle(400, 300, 700, 500, 0x000000, 0.9);
    overlay.setScrollFactor(0).setDepth(300);

    const shopElements: Phaser.GameObjects.GameObject[] = [overlay];

    // Shop title
    const title = this.add.text(400, 80, 'WEAPON SHOP', {
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    shopElements.push(title);

    // Coins display
    const coinsDisplay = this.add.text(400, 120, `Your coins: ${this.coinCount}`, {
      fontSize: '20px',
      color: '#fbbf24'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    shopElements.push(coinsDisplay);

    // Weapon list
    const weapons: WeaponType[] = ['default', 'double-barrel', 'burst-shot'];
    let yPos = 180;

    weapons.forEach((weaponKey) => {
      const weapon = this.WEAPONS[weaponKey];
      const owned = this.ownedWeapons.includes(weaponKey);
      const selected = this.currentWeapon === weaponKey;
      const canAfford = this.coinCount >= weapon.cost;

      // Weapon container background
      const bgColor = selected ? 0x446644 : 0x333333;
      const bg = this.add.rectangle(400, yPos + 30, 600, 80, bgColor);
      bg.setScrollFactor(0).setDepth(301);
      shopElements.push(bg);

      // Weapon name
      const nameText = this.add.text(150, yPos + 10, weapon.name, {
        fontSize: '24px',
        color: '#ffffff'
      }).setScrollFactor(0).setDepth(302);
      shopElements.push(nameText);

      // Weapon description
      const descText = this.add.text(150, yPos + 40, weapon.description, {
        fontSize: '16px',
        color: '#aaaaaa'
      }).setScrollFactor(0).setDepth(302);
      shopElements.push(descText);

      // Cost / Status
      let statusText: string;
      let statusColor: string;

      if (owned) {
        statusText = selected ? 'EQUIPPED' : 'OWNED';
        statusColor = selected ? '#44ff44' : '#888888';
      } else {
        statusText = `${weapon.cost} coins`;
        statusColor = canAfford ? '#fbbf24' : '#ff4444';
      }

      const status = this.add.text(550, yPos + 15, statusText, {
        fontSize: '18px',
        color: statusColor
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);
      shopElements.push(status);

      // Action button
      if (owned && !selected) {
        const selectBtn = this.add.text(550, yPos + 45, '[ SELECT ]', {
          fontSize: '16px',
          color: '#333333',
          backgroundColor: '#88cc88',
          padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(302);
        shopElements.push(selectBtn);

        selectBtn.on('pointerdown', () => {
          this.selectWeapon(weaponKey);
          this.closeShop(shopElements);
          this.showShop(); // Refresh shop
        });
      } else if (!owned && canAfford) {
        const buyBtn = this.add.text(550, yPos + 45, '[ BUY ]', {
          fontSize: '16px',
          color: '#333333',
          backgroundColor: '#fbbf24',
          padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(302);
        shopElements.push(buyBtn);

        buyBtn.on('pointerdown', () => {
          if (this.buyWeapon(weaponKey)) {
            this.closeShop(shopElements);
            this.showShop(); // Refresh shop
          }
        });
      }

      yPos += 100;
    });

    // Close button
    const closeBtn = this.add.text(400, 520, '[ CLOSE ]', {
      fontSize: '24px',
      color: '#333333',
      backgroundColor: '#cccccc',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(302);
    shopElements.push(closeBtn);

    closeBtn.on('pointerdown', () => {
      this.closeShop(shopElements);
    });
  }

  private closeShop(elements: Phaser.GameObjects.GameObject[]) {
    elements.forEach(el => el.destroy());
  }

  private restartGame() {
    this.score = 0;
    this.waveNumber = 1;
    this.canShoot = true;
    this.isJumping = false;
    this.isInvulnerable = false;
    this.robotBurstCount = 0;
    this.robotCooldown = false;
    this.spawnedRows.clear();
    this.scene.restart();
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#f0f0f0',
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [MainScene]
};

new Phaser.Game(config);
