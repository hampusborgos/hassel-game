import { init, id, i, InstaQLEntity } from '@instantdb/core';

const APP_ID = 'bb738ef1-c34f-4ac9-838d-92f34bf61879';

// Define the schema
const schema = i.schema({
  entities: {
    players: i.entity({
      name: i.string(),
      token: i.string().unique().indexed(),
      avatarUrl: i.string().optional(),
      createdAt: i.number(),
    }),
    highScores: i.entity({
      score: i.number().indexed(),
      playerId: i.string().indexed(),
      playerName: i.string(),
      playerAvatarUrl: i.string().optional(),
      createdAt: i.number(),
    }),
  },
});

// Export types
export type Player = InstaQLEntity<typeof schema, 'players'>;
export type HighScore = InstaQLEntity<typeof schema, 'highScores'>;

// Initialize the database
export const db = init({ appId: APP_ID, schema });

// Separate untyped instance for $files queries (schema doesn't include $files)
const dbRaw = init({ appId: APP_ID });

// Player token management
const PLAYER_TOKEN_KEY = 'hasselgame_player_token';
const PLAYER_NAME_KEY = 'hasselgame_player_name';

export function getPlayerToken(): string {
  let token = localStorage.getItem(PLAYER_TOKEN_KEY);
  if (!token) {
    token = id();
    localStorage.setItem(PLAYER_TOKEN_KEY, token);
  }
  return token;
}

export function getLocalPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || 'Anonymous';
}

export function setLocalPlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

// Ensure player exists in database
export async function ensurePlayer(): Promise<Player | null> {
  const token = getPlayerToken();
  const name = getLocalPlayerName();

  return new Promise((resolve) => {
    const unsubscribe = db.subscribeQuery(
      {
        players: {
          $: {
            where: { token },
          },
        },
      },
      (resp) => {
        if (resp.error) {
          console.error('Error fetching player:', resp.error);
          resolve(null);
          unsubscribe();
          return;
        }

        if (resp.data) {
          const players = resp.data.players;
          if (players.length > 0) {
            resolve(players[0]);
            unsubscribe();
          } else {
            // Create player
            const playerId = id();
            db.transact(
              db.tx.players[playerId].update({
                name,
                token,
                createdAt: Date.now(),
              })
            ).then(() => {
              // Query again to get the created player
              db.subscribeQuery(
                {
                  players: {
                    $: {
                      where: { token },
                    },
                  },
                },
                (resp2) => {
                  if (resp2.data && resp2.data.players.length > 0) {
                    resolve(resp2.data.players[0]);
                  } else {
                    resolve(null);
                  }
                  unsubscribe();
                }
              );
            });
          }
        }
      }
    );
  });
}

// Update player name
export async function updatePlayerName(name: string): Promise<void> {
  const token = getPlayerToken();
  setLocalPlayerName(name);

  return new Promise((resolve) => {
    const unsubscribe = db.subscribeQuery(
      {
        players: {
          $: {
            where: { token },
          },
        },
      },
      async (resp) => {
        if (resp.data && resp.data.players.length > 0) {
          const player = resp.data.players[0];
          await db.transact(db.tx.players[player.id].update({ name }));

          // Also update all high scores with new name
          const scoresResp = await new Promise<HighScore[]>((resolveScores) => {
            const unsub = db.subscribeQuery(
              {
                highScores: {
                  $: {
                    where: { playerId: player.id },
                  },
                },
              },
              (sr) => {
                if (sr.data) {
                  resolveScores(sr.data.highScores);
                  unsub();
                }
              }
            );
          });

          // Update player name on all their high scores
          const txs = scoresResp.map((hs) =>
            db.tx.highScores[hs.id].update({ playerName: name })
          );
          if (txs.length > 0) {
            await db.transact(txs);
          }
        }
        resolve();
        unsubscribe();
      }
    );
  });
}

// Upload avatar and update player
export async function uploadAvatar(file: File): Promise<string | null> {
  const token = getPlayerToken();

  try {
    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `avatar-${Date.now()}.${ext}`;
    const path = `avatars/${token}/${fileName}`;

    // Upload file to InstantDB storage
    await db.storage.uploadFile(path, file, {
      contentType: file.type || 'image/png',
    });

    // Small delay to let the file be indexed
    await new Promise(r => setTimeout(r, 500));

    // Query $files to get the download URL (must use untyped db instance)
    const avatarUrl = await new Promise<string | null>((resolve) => {
      let resolved = false;

      const unsub = dbRaw.subscribeQuery(
        { $files: { $: { where: { path } } } } as Parameters<typeof dbRaw.subscribeQuery>[0],
        (resp: { data?: { $files?: Array<{ path: string; url: string }> }; error?: unknown }) => {
          if (resolved) return;

          if (resp.error) {
            resolved = true;
            resolve(null);
            unsub();
            return;
          }
          if (resp.data?.$files && resp.data.$files.length > 0) {
            resolved = true;
            resolve(resp.data.$files[0].url);
            unsub();
          }
        }
      );

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsub();
          resolve(null);
        }
      }, 10000);
    });

    if (!avatarUrl) {
      console.error('Failed to get download URL from $files');
      return null;
    }

    // Update player record with avatar URL
    const player = await ensurePlayer();
    if (player) {
      await db.transact(db.tx.players[player.id].update({ avatarUrl }));

      // Update all existing high scores with new avatar
      const scoresResp = await new Promise<HighScore[]>((resolve) => {
        const unsub = db.subscribeQuery(
          {
            highScores: {
              $: { where: { playerId: player.id } },
            },
          },
          (resp) => {
            if (resp.data) {
              resolve(resp.data.highScores);
              unsub();
            }
          }
        );
      });

      if (scoresResp.length > 0) {
        const txs = scoresResp.map((hs) =>
          db.tx.highScores[hs.id].update({ playerAvatarUrl: avatarUrl })
        );
        await db.transact(txs);
      }

      // Store locally for quick access
      localStorage.setItem('hasselgame_avatar_url', avatarUrl);
    }

    return avatarUrl;
  } catch (error) {
    console.error('Avatar upload error:', error);
    return null;
  }
}

// Get local avatar URL
export function getLocalAvatarUrl(): string | null {
  return localStorage.getItem('hasselgame_avatar_url');
}

// Get current player info
export function subscribeToCurrentPlayer(
  callback: (player: Player | null) => void
): () => void {
  const token = getPlayerToken();

  return db.subscribeQuery(
    {
      players: {
        $: {
          where: { token },
        },
      },
    },
    (resp) => {
      if (resp.data && resp.data.players.length > 0) {
        callback(resp.data.players[0]);
      } else {
        callback(null);
      }
    }
  );
}

// Submit a high score
export async function submitHighScore(score: number): Promise<void> {
  const player = await ensurePlayer();
  if (!player) return;

  const scoreId = id();
  await db.transact(
    db.tx.highScores[scoreId].update({
      score,
      playerId: player.id,
      playerName: player.name,
      playerAvatarUrl: player.avatarUrl || '',
      createdAt: Date.now(),
    })
  );
}

// Get global top scores (best score per player)
export function subscribeToGlobalHighScores(
  callback: (scores: HighScore[], currentPlayerId: string | null) => void,
  limit: number = 5
): () => void {
  const token = getPlayerToken();
  let currentPlayerId: string | null = null;

  // First get current player ID
  const playerUnsub = db.subscribeQuery(
    {
      players: {
        $: {
          where: { token },
        },
      },
    },
    (playerResp) => {
      if (playerResp.data && playerResp.data.players.length > 0) {
        currentPlayerId = playerResp.data.players[0].id;
      }
    }
  );

  // Get all high scores and filter to best per player
  const scoresUnsub = db.subscribeQuery(
    {
      highScores: {
        $: {
          order: { score: 'desc' },
          limit: 100, // Get more to filter
        },
      },
    },
    (resp) => {
      if (resp.data) {
        // Filter to best score per player
        const bestByPlayer = new Map<string, HighScore>();
        for (const hs of resp.data.highScores) {
          if (!bestByPlayer.has(hs.playerId) || bestByPlayer.get(hs.playerId)!.score < hs.score) {
            bestByPlayer.set(hs.playerId, hs);
          }
        }
        // Sort by score and take top N
        const topScores = Array.from(bestByPlayer.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        callback(topScores, currentPlayerId);
      }
    }
  );

  return () => {
    playerUnsub();
    scoresUnsub();
  };
}

// Get player's personal best
export function subscribeToPersonalBest(
  callback: (score: HighScore | null) => void
): () => void {
  const token = getPlayerToken();

  // First get the player ID
  return db.subscribeQuery(
    {
      players: {
        $: {
          where: { token },
        },
      },
    },
    (resp) => {
      if (resp.data && resp.data.players.length > 0) {
        const playerId = resp.data.players[0].id;

        // Then get their best score
        db.subscribeQuery(
          {
            highScores: {
              $: {
                where: { playerId },
                order: { score: 'desc' },
                limit: 1,
              },
            },
          },
          (scoreResp) => {
            if (scoreResp.data) {
              callback(scoreResp.data.highScores[0] || null);
            }
          }
        );
      } else {
        callback(null);
      }
    }
  );
}

// Re-export id for convenience
export { id };
