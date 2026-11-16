import type { Activity, Asset, Player } from "./types";
export function quoteActivity(p: Player, a: Activity, approach: string) {
  const chance = Math.max(
    10,
    Math.min(
      95,
      a.chance +
        (p.mastery[a.id] || 0) +
        Math.min(6, p.facility) +
        (approach === "safe" ? 10 : approach === "bold" ? -10 : 0),
    ),
  );
  const gross = Math.floor(
    a.reward * (approach === "safe" ? 0.8 : approach === "bold" ? 1.3 : 1),
  );
  return {
    chance,
    gross,
    net: gross - a.cost,
    expected: Math.round((gross * chance) / 100 - a.cost),
  };
}
export const rarityClass = (rarity: string) =>
  ["Local", "Promising", "Elite", "Legendary"].includes(rarity)
    ? rarity.toLowerCase()
    : "local";
export function sortSquad(squad: Asset[], position: string, sort: string) {
  return squad
    .filter((p) => position === "all" || p.position === position)
    .slice()
    .sort((a, b) =>
      sort === "value"
        ? b.value - a.value
        : sort === "power"
          ? b.power - a.power
          : a.name.localeCompare(b.name),
    );
}
