import { WeaponType } from './types';
import { WEAPONS } from './constants';
import { saveOwnedWeapons, saveSelectedWeapon } from './persistence';

export function buyWeapon(
  weapon: WeaponType,
  coinCount: number,
  ownedWeapons: WeaponType[]
): { success: boolean; newCoinCount: number; newOwnedWeapons: WeaponType[] } {
  const cost = WEAPONS[weapon].cost;
  if (coinCount >= cost && !ownedWeapons.includes(weapon)) {
    const newOwnedWeapons = [...ownedWeapons, weapon];
    saveOwnedWeapons(newOwnedWeapons);
    return {
      success: true,
      newCoinCount: coinCount - cost,
      newOwnedWeapons
    };
  }
  return {
    success: false,
    newCoinCount: coinCount,
    newOwnedWeapons: ownedWeapons
  };
}

export function selectWeapon(weapon: WeaponType, ownedWeapons: WeaponType[]): boolean {
  if (ownedWeapons.includes(weapon)) {
    saveSelectedWeapon(weapon);
    return true;
  }
  return false;
}
