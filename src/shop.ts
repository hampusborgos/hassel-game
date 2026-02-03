import Phaser from 'phaser';
import { WeaponType } from './types';
import { WEAPONS, DEPTH } from './constants';
import { saveOwnedWeapons, saveSelectedWeapon } from './persistence';

export class Shop {
  private scene: Phaser.Scene;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private coinCount: number;
  private ownedWeapons: WeaponType[];
  private currentWeapon: WeaponType;
  private onWeaponSelect: (weapon: WeaponType) => void;
  private onWeaponBuy: (weapon: WeaponType, cost: number) => boolean;

  constructor(
    scene: Phaser.Scene,
    coinCount: number,
    ownedWeapons: WeaponType[],
    currentWeapon: WeaponType,
    onWeaponSelect: (weapon: WeaponType) => void,
    onWeaponBuy: (weapon: WeaponType, cost: number) => boolean
  ) {
    this.scene = scene;
    this.coinCount = coinCount;
    this.ownedWeapons = ownedWeapons;
    this.currentWeapon = currentWeapon;
    this.onWeaponSelect = onWeaponSelect;
    this.onWeaponBuy = onWeaponBuy;
  }

  show(): void {
    const centerX = this.scene.scale.width / 2;
    const centerY = this.scene.scale.height / 2;

    const overlay = this.scene.add.rectangle(centerX, centerY, 700, 500, 0x000000, 0.9);
    overlay.setScrollFactor(0).setDepth(DEPTH.OVERLAY_BG);
    this.elements.push(overlay);

    const title = this.scene.add.text(centerX, centerY - 220, 'WEAPON SHOP', {
      fontSize: '36px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
    this.elements.push(title);

    const coinsDisplay = this.scene.add.text(centerX, centerY - 180, `Your coins: ${this.coinCount}`, {
      fontSize: '20px',
      color: '#fbbf24'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
    this.elements.push(coinsDisplay);

    const weapons: WeaponType[] = ['default', 'double-barrel', 'burst-shot'];
    let yPos = centerY - 120;

    weapons.forEach((weaponKey) => {
      const weapon = WEAPONS[weaponKey];
      const owned = this.ownedWeapons.includes(weaponKey);
      const selected = this.currentWeapon === weaponKey;
      const canAfford = this.coinCount >= weapon.cost;

      const bgColor = selected ? 0x446644 : 0x333333;
      const bg = this.scene.add.rectangle(centerX, yPos + 30, 600, 80, bgColor);
      bg.setScrollFactor(0).setDepth(DEPTH.OVERLAY_UI);
      this.elements.push(bg);

      const nameText = this.scene.add.text(centerX - 250, yPos + 10, weapon.name, {
        fontSize: '24px',
        color: '#ffffff'
      }).setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE);
      this.elements.push(nameText);

      const descText = this.scene.add.text(centerX - 250, yPos + 40, weapon.description, {
        fontSize: '16px',
        color: '#aaaaaa'
      }).setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE);
      this.elements.push(descText);

      let statusText: string;
      let statusColor: string;

      if (owned) {
        statusText = selected ? 'EQUIPPED' : 'OWNED';
        statusColor = selected ? '#44ff44' : '#888888';
      } else {
        statusText = `${weapon.cost} coins`;
        statusColor = canAfford ? '#fbbf24' : '#ff4444';
      }

      const status = this.scene.add.text(centerX + 150, yPos + 15, statusText, {
        fontSize: '18px',
        color: statusColor
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE);
      this.elements.push(status);

      if (owned && !selected) {
        const selectBtn = this.scene.add.text(centerX + 150, yPos + 45, '[ SELECT ]', {
          fontSize: '16px',
          color: '#333333',
          backgroundColor: '#88cc88',
          padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE);
        this.elements.push(selectBtn);

        selectBtn.on('pointerdown', () => {
          this.onWeaponSelect(weaponKey);
          this.currentWeapon = weaponKey;
          this.close();
          this.show();
        });
      } else if (!owned && canAfford) {
        const buyBtn = this.scene.add.text(centerX + 150, yPos + 45, '[ BUY ]', {
          fontSize: '16px',
          color: '#333333',
          backgroundColor: '#fbbf24',
          padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE);
        this.elements.push(buyBtn);

        buyBtn.on('pointerdown', () => {
          if (this.onWeaponBuy(weaponKey, weapon.cost)) {
            this.ownedWeapons.push(weaponKey);
            this.coinCount -= weapon.cost;
            this.close();
            this.show();
          }
        });
      }

      yPos += 100;
    });

    const closeBtn = this.scene.add.text(centerX, centerY + 220, '[ CLOSE ]', {
      fontSize: '24px',
      color: '#333333',
      backgroundColor: '#cccccc',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(DEPTH.OVERLAY_INTERACTIVE);
    this.elements.push(closeBtn);

    closeBtn.on('pointerdown', () => {
      this.close();
    });
  }

  close(): void {
    this.elements.forEach(el => el.destroy());
    this.elements = [];
  }
}

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
