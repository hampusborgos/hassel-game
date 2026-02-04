import Phaser from 'phaser';
import { ATLAS_KEY } from './MainScene';

const CHUNK_SIZE = 200; // Size of each chunk in pixels

export class WorldManager {
  private scene: Phaser.Scene;
  private trees: Phaser.GameObjects.Group;
  private jumps: Phaser.Physics.Arcade.StaticGroup;
  private holes: Phaser.Physics.Arcade.StaticGroup;
  private spawnedChunks = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    trees: Phaser.GameObjects.Group,
    jumps: Phaser.Physics.Arcade.StaticGroup,
    holes: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.scene = scene;
    this.trees = trees;
    this.jumps = jumps;
    this.holes = holes;
  }

  private getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  private isChunkSpawned(chunkX: number, chunkY: number): boolean {
    return this.spawnedChunks.has(this.getChunkKey(chunkX, chunkY));
  }

  private markChunkSpawned(chunkX: number, chunkY: number): void {
    this.spawnedChunks.add(this.getChunkKey(chunkX, chunkY));
  }

  spawnInitialTrees(startX: number, startY: number): void {
    // Spawn chunks around the starting position
    const startChunkX = Math.floor(startX / CHUNK_SIZE);
    const startChunkY = Math.floor(startY / CHUNK_SIZE);

    // Spawn a 9x9 grid of chunks around the start
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const chunkX = startChunkX + dx;
        const chunkY = startChunkY + dy;
        this.spawnChunk(chunkX, chunkY, startX, startY, true);
      }
    }
  }

  private spawnChunk(chunkX: number, chunkY: number, playerX: number, playerY: number, isInitial: boolean = false): void {
    if (this.isChunkSpawned(chunkX, chunkY)) return;

    this.markChunkSpawned(chunkX, chunkY);

    const worldX = chunkX * CHUNK_SIZE;
    const worldY = chunkY * CHUNK_SIZE;

    // Spawn objects within this chunk
    for (let y = worldY; y < worldY + CHUNK_SIZE; y += 60) {
      for (let x = worldX; x < worldX + CHUNK_SIZE; x += 80) {
        const offsetX = Phaser.Math.Between(-25, 25);
        const offsetY = Phaser.Math.Between(-25, 25);
        const spawnX = x + offsetX;
        const spawnY = y + offsetY;

        // Don't spawn too close to player (especially at start)
        const distToPlayer = Phaser.Math.Distance.Between(spawnX, spawnY, playerX, playerY);
        if (isInitial && distToPlayer < 150) continue;
        if (!isInitial && distToPlayer < 100) continue;

        const rand = Math.random();
        if (rand < 0.012) {
          this.spawnJump(spawnX, spawnY);
        } else if (rand < 0.022) {
          this.spawnHole(spawnX, spawnY);
        } else if (rand < 0.146) {
          this.spawnTree(spawnX, spawnY);
        }
      }
    }
  }

  spawnTree(x: number, y: number): void {
    const tree = this.scene.add.image(x, y, ATLAS_KEY, 'tree');
    tree.setDepth(y);
    tree.setScale(Phaser.Math.FloatBetween(0.9, 1.1));
    this.trees.add(tree);
  }

  spawnJump(x: number, y: number): void {
    const jump = this.jumps.create(x, y, ATLAS_KEY, 'jump') as Phaser.Physics.Arcade.Sprite;
    jump.setDepth(y - 10);
    jump.refreshBody();
  }

  spawnHole(x: number, y: number): void {
    const hole = this.holes.create(x, y, ATLAS_KEY, 'hole') as Phaser.Physics.Arcade.Sprite;
    hole.setDepth(y - 15);
    hole.refreshBody();
  }

  spawnTreesAroundPlayer(player: Phaser.Physics.Arcade.Sprite): void {
    const cam = this.scene.cameras.main;
    const margin = CHUNK_SIZE; // One chunk margin around view

    // Calculate chunk range to check
    const minChunkX = Math.floor((cam.scrollX - margin) / CHUNK_SIZE);
    const maxChunkX = Math.floor((cam.scrollX + cam.width + margin) / CHUNK_SIZE);
    const minChunkY = Math.floor((cam.scrollY - margin) / CHUNK_SIZE);
    const maxChunkY = Math.floor((cam.scrollY + cam.height + margin) / CHUNK_SIZE);

    // Spawn any missing chunks in the visible area
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        if (!this.isChunkSpawned(chunkX, chunkY)) {
          this.spawnChunk(chunkX, chunkY, player.x, player.y);
        }
      }
    }

    // Clean up old chunk keys that are far from player (memory management)
    if (this.spawnedChunks.size > 500) {
      const playerChunkX = Math.floor(player.x / CHUNK_SIZE);
      const playerChunkY = Math.floor(player.y / CHUNK_SIZE);
      const maxDist = 20; // chunks

      const keysToDelete: string[] = [];
      this.spawnedChunks.forEach(key => {
        const [cx, cy] = key.split(',').map(Number);
        if (Math.abs(cx - playerChunkX) > maxDist || Math.abs(cy - playerChunkY) > maxDist) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.spawnedChunks.delete(key));
    }
  }

  cleanupDistantObjects(player: Phaser.Physics.Arcade.Sprite, zombies: Phaser.Physics.Arcade.Group, coins: Phaser.Physics.Arcade.Group, shields: Phaser.Physics.Arcade.Group): void {
    const cleanupDistance = 1200;

    // Remove trees that are too far from player
    this.trees.getChildren().forEach((tree) => {
      const t = tree as Phaser.GameObjects.Image;
      const dist = Phaser.Math.Distance.Between(t.x, t.y, player.x, player.y);
      if (dist > cleanupDistance) {
        t.destroy();
      }
    });

    // Remove zombies that are too far from player
    zombies.getChildren().forEach((zombie) => {
      const z = zombie as Phaser.Physics.Arcade.Sprite;
      if (z.active) {
        const dist = Phaser.Math.Distance.Between(z.x, z.y, player.x, player.y);
        if (dist > cleanupDistance) {
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
    coins.getChildren().forEach((coin) => {
      const c = coin as Phaser.Physics.Arcade.Sprite;
      if (c.active) {
        const dist = Phaser.Math.Distance.Between(c.x, c.y, player.x, player.y);
        if (dist > cleanupDistance) {
          const spinTween = c.getData('spinTween') as Phaser.Tweens.Tween;
          if (spinTween) spinTween.stop();
          c.destroy();
        }
      }
    });

    // Remove shields that are too far from player
    shields.getChildren().forEach((shield) => {
      const s = shield as Phaser.Physics.Arcade.Sprite;
      if (s.active) {
        const dist = Phaser.Math.Distance.Between(s.x, s.y, player.x, player.y);
        if (dist > cleanupDistance) {
          const floatTween = s.getData('floatTween') as Phaser.Tweens.Tween;
          const rotateTween = s.getData('rotateTween') as Phaser.Tweens.Tween;
          if (floatTween) floatTween.stop();
          if (rotateTween) rotateTween.stop();
          s.destroy();
        }
      }
    });

    // Remove jumps that are too far from player
    this.jumps.getChildren().forEach((jump) => {
      const j = jump as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(j.x, j.y, player.x, player.y);
      if (dist > cleanupDistance) {
        j.destroy();
      }
    });

    // Remove holes that are too far from player
    this.holes.getChildren().forEach((hole) => {
      const h = hole as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(h.x, h.y, player.x, player.y);
      if (dist > cleanupDistance) {
        h.destroy();
      }
    });
  }

  reset(): void {
    this.spawnedChunks.clear();
  }
}
