import { WeaponType } from '../types';
import { WEAPONS } from '../constants';

export interface ShopConfig {
  coinCount: number;
  ownedWeapons: WeaponType[];
  currentWeapon: WeaponType;
  onWeaponSelect: (weapon: WeaponType) => void;
  onWeaponBuy: (weapon: WeaponType, cost: number) => boolean;
  onClose: () => void;
}

export class ShopOverlay {
  private container: HTMLElement;
  private panel: HTMLElement;
  private config: ShopConfig | null = null;

  // Track state for re-rendering
  private coinCount: number = 0;
  private ownedWeapons: WeaponType[] = [];
  private currentWeapon: WeaponType = 'default';

  constructor() {
    this.container = document.getElementById('shop-overlay')!;
    // Clear any existing content from previous instances
    this.container.innerHTML = '';
    this.panel = document.createElement('div');
    this.panel.className = 'shop-panel';
    this.container.appendChild(this.panel);
  }

  show(config: ShopConfig): void {
    this.config = config;
    this.coinCount = config.coinCount;
    this.ownedWeapons = [...config.ownedWeapons];
    this.currentWeapon = config.currentWeapon;

    this.render();
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.config = null;
  }

  private render(): void {
    this.panel.innerHTML = '';

    // Title
    const title = document.createElement('h1');
    title.className = 'shop-title';
    title.textContent = 'WEAPON SHOP';
    this.panel.appendChild(title);

    // Coins display
    const coinsDisplay = document.createElement('p');
    coinsDisplay.className = 'shop-coins';
    coinsDisplay.textContent = `Your coins: ${this.coinCount}`;
    this.panel.appendChild(coinsDisplay);

    // Weapons list
    const weaponsList = document.createElement('div');
    weaponsList.className = 'weapons-list';

    const weaponKeys: WeaponType[] = ['default', 'double-barrel', 'rubber', 'burst-shot', 'railgun'];

    weaponKeys.forEach((weaponKey) => {
      const weapon = WEAPONS[weaponKey];
      const owned = this.ownedWeapons.includes(weaponKey);
      const selected = this.currentWeapon === weaponKey;
      const canAfford = this.coinCount >= weapon.cost;

      const card = document.createElement('div');
      card.className = 'weapon-card';
      if (selected) {
        card.classList.add('selected');
      }

      // Weapon info
      const info = document.createElement('div');
      info.className = 'weapon-info';

      const name = document.createElement('h3');
      name.className = 'weapon-name';
      name.textContent = weapon.name;
      info.appendChild(name);

      const description = document.createElement('p');
      description.className = 'weapon-description';
      description.textContent = weapon.description;
      info.appendChild(description);

      card.appendChild(info);

      // Status and button
      const status = document.createElement('div');
      status.className = 'weapon-status';

      const statusText = document.createElement('p');
      statusText.className = 'weapon-status-text';

      if (owned) {
        if (selected) {
          statusText.textContent = 'EQUIPPED';
          statusText.classList.add('equipped');
        } else {
          statusText.textContent = 'OWNED';
          statusText.classList.add('owned');
        }
      } else {
        statusText.textContent = `${weapon.cost} coins`;
        statusText.classList.add(canAfford ? 'affordable' : 'expensive');
      }

      status.appendChild(statusText);

      // Action button
      if (owned && !selected) {
        const selectBtn = document.createElement('button');
        selectBtn.className = 'weapon-btn select';
        selectBtn.textContent = '[ SELECT ]';
        selectBtn.onclick = () => this.handleSelect(weaponKey);
        status.appendChild(selectBtn);
      } else if (!owned && canAfford) {
        const buyBtn = document.createElement('button');
        buyBtn.className = 'weapon-btn buy';
        buyBtn.textContent = '[ BUY ]';
        buyBtn.onclick = () => this.handleBuy(weaponKey, weapon.cost);
        status.appendChild(buyBtn);
      }

      card.appendChild(status);
      weaponsList.appendChild(card);
    });

    this.panel.appendChild(weaponsList);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '[ CLOSE ]';
    closeBtn.onclick = () => this.handleClose();
    this.panel.appendChild(closeBtn);
  }

  private handleSelect(weapon: WeaponType): void {
    if (!this.config) return;

    this.config.onWeaponSelect(weapon);
    this.currentWeapon = weapon;
    this.render();
  }

  private handleBuy(weapon: WeaponType, cost: number): void {
    if (!this.config) return;

    if (this.config.onWeaponBuy(weapon, cost)) {
      this.ownedWeapons.push(weapon);
      this.coinCount -= cost;
      this.render();
    }
  }

  private handleClose(): void {
    if (this.config) {
      this.hide();
      this.config.onClose();
    }
  }
}
