import { WeaponType } from './types';
import { COINS_KEY, WEAPONS_KEY, SELECTED_WEAPON_KEY, HIGH_SCORES_KEY } from './constants';
import { updatePlayerCoins, migrateCoinsFromLocalStorage } from './database';

// Load coins from localStorage (fast, synchronous)
// Call initializeCoins() early to migrate and sync with database
export function loadCoins(): number {
  try {
    const stored = localStorage.getItem(COINS_KEY);
    if (stored) {
      return parseInt(stored, 10) || 0;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 0;
}

// Initialize coins: migrate from localStorage to database if needed
// Returns the authoritative coin count from the database
export async function initializeCoins(): Promise<number> {
  return migrateCoinsFromLocalStorage();
}

// Save coins to both localStorage (quick access) and database (persistent)
export function saveCoins(coinCount: number): void {
  try {
    localStorage.setItem(COINS_KEY, coinCount.toString());
  } catch {
    // Ignore localStorage errors
  }
  // Also save to database (async, fire-and-forget)
  updatePlayerCoins(coinCount).catch(() => {
    // Ignore database errors - localStorage is our fallback
  });
}

export function loadOwnedWeapons(): WeaponType[] {
  try {
    const stored = localStorage.getItem(WEAPONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore localStorage errors
  }
  return ['default'];
}

export function saveOwnedWeapons(weapons: WeaponType[]): void {
  try {
    localStorage.setItem(WEAPONS_KEY, JSON.stringify(weapons));
  } catch {
    // Ignore localStorage errors
  }
}

export function loadSelectedWeapon(ownedWeapons: WeaponType[]): WeaponType {
  try {
    const stored = localStorage.getItem(SELECTED_WEAPON_KEY);
    if (stored && ownedWeapons.includes(stored as WeaponType)) {
      return stored as WeaponType;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'default';
}

export function saveSelectedWeapon(weapon: WeaponType): void {
  try {
    localStorage.setItem(SELECTED_WEAPON_KEY, weapon);
  } catch {
    // Ignore localStorage errors
  }
}

export function getHighScores(): number[] {
  try {
    const stored = localStorage.getItem(HIGH_SCORES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore localStorage errors
  }
  return [];
}

export function saveHighScore(score: number): { scores: number[]; rank: number } {
  const scores = getHighScores();
  scores.push(score);
  scores.sort((a, b) => b - a);
  const topScores = scores.slice(0, 5);

  try {
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(topScores));
  } catch {
    // Ignore localStorage errors
  }

  const rank = topScores.indexOf(score) + 1;
  return { scores: topScores, rank: rank <= 5 ? rank : 0 };
}
