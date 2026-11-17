export interface Asset {
  id: string;
  name: string;
  position: string;
  rarity: string;
  power: number;
  value: number;
  age?: number;
}
export interface Gear {
  id: string;
  title: string;
  slot: string;
  power: number;
  equipped: boolean;
}
export interface Player {
  id: string;
  name: string;
  club: string;
  rank: number;
  rankName: string;
  cash: number;
  bank: number;
  energy: number;
  energyMax?: number;
  energyRegen?: number;
  energyInterval?: number;
  energyAt: string;
  cooldowns: Record<string, string>;
  mastery: Record<string, number>;
  inventory: Gear[];
  squad: Asset[];
  ownedCount?: number;
  attributes: Record<string, number>;
  region: string;
  wins: number;
  actions: number;
  chapter: number;
  facility: number;
  power: number;
}
export interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  tier: number;
  rankRequired: number;
  cost: number;
  reward: number;
  energy: number;
  seconds: number;
  chance: number;
  asset: boolean;
}
export interface Item {
  id: string;
  title: string;
  slot: string;
  price: number;
  power: number;
  rankRequired: number;
  description: string;
}
export interface Catalog {
  ranks: { id: number; name: string }[];
  activities: Activity[];
  items: Item[];
  squadCapacity?: number;
  scouting?: Record<
    string,
    {
      local: number;
      promising: number;
      elite: number;
      legendary: number;
      minPower: number;
      maxPower: number;
      capacity: number;
    }
  >;
}
export interface Manager {
  id: string;
  name: string;
  club: string;
  rank: number;
  rankName: string;
  wealth: number;
  power: number;
  region: string;
  online: boolean;
}
export interface Listing {
  id: string;
  seller: string;
  asset: Asset;
  price: number;
  club: string;
}
export interface World {
  managers: Manager[];
  counts: { total: number; online: number };
  listings: Listing[];
}
export interface GameEvent {
  id: number;
  kind: string;
  message: string;
  cashDelta: number;
  createdAt: string;
}
