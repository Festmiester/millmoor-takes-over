export interface CampaignState {
  version: number;
  current: number | null;
  completed: number;
  legacyCompleted: number;
  chapters: {
    id: number;
    title: string;
    lesson: string;
    rankRequired: number;
    rankName: string;
    goals: {
      metric: string;
      label: string;
      route: string;
      progress: number;
      target: number;
      complete: boolean;
    }[];
    reward: {
      cash: number;
      item: {
        title: string;
        slot: string;
        power: number;
        duplicateCash: number;
      } | null;
      player: {
        name: string;
        rarity: string;
        power: number;
        position: string;
      } | null;
    };
    claimed: boolean;
    current: boolean;
    ready: boolean;
  }[];
  pendingPlayers: { chapter: number; asset: { name: string; power: number } }[];
}
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (n: number) => "£" + n.toLocaleString("en-GB");
const section = (title: string, body: string) =>
  `<section class="panel"><div class="panel-title"><h2>${esc(title)}</h2></div>${body}</section>`;
function rewards(c: CampaignState["chapters"][number]) {
  const r = c.reward;
  return `<div class="campaign-rewards"><strong>${money(r.cash)}</strong>${r.item ? `<span>${esc(r.item.title)} · +${r.item.power} ${esc(r.item.slot)} power</span>` : ""}${r.player ? `<span>${esc(r.player.rarity)} ${esc(r.player.position)} · ${esc(r.player.name)} · power ${r.player.power}</span>` : ""}</div>`;
}
export function nextCampaign(state: CampaignState | null) {
  if (!state) return "";
  const c = state.chapters.find((c) => c.current);
  if (!c)
    return section(
      "ROAD TO LEGEND",
      '<div class="simple-row"><strong>Guided campaign complete</strong><a href="#campaign">Your rewards →</a></div>',
    );
  const goal = c.goals.find((g) => !g.complete);
  return section(
    "YOUR NEXT LESSON",
    `<div class="next-chapter"><div><strong>${c.id}. ${esc(c.title)}</strong><span>${c.goals.filter((g) => g.complete).length}/${c.goals.length} objectives complete · ${esc(c.rankName)}</span>${goal ? `<small>${esc(goal.label)} · ${goal.progress}/${goal.target}</small>` : ""}</div><a href="#campaign">${c.ready ? "Claim reward →" : "Open guide →"}</a></div>`,
  );
}
export function renderCampaign(state: CampaignState | null) {
  if (!state) return '<p class="empty">Loading your guided campaign…</p>';
  const current = state.chapters.find((c) => c.current);
  const card = (c: CampaignState["chapters"][number]) =>
    `<p class="campaign-lesson">${esc(c.lesson)}</p><div class="simple-row"><span>Required rank</span><strong>${esc(c.rankName)}</strong></div>${c.goals.map((g) => `<div class="campaign-goal"><div><strong>${g.complete ? "✓ " : ""}${esc(g.label)}</strong><small>${g.progress} / ${g.target}</small><progress max="${g.target}" value="${g.progress}" aria-label="${esc(g.label)}"></progress></div><a class="secondary" ${g.route === "office" ? `data-campaign-tier="${g.metric.startsWith("office") ? g.metric.slice(-1) : 1}"` : ""} href="#${esc(g.route)}">Go →</a></div>`).join("")}${rewards(c)}${c.current ? `<div class="simple-row"><button class="action" data-action="chapter" data-id="${c.id}" ${c.ready ? "" : "disabled"}>${c.ready ? "Claim chapter rewards" : "Complete objectives & rank"}</button></div>` : ""}`;
  return (
    `<div class="page-heading"><h1>Road to Legend</h1><p>Learn every part of the game. Build a football empire.</p></div>` +
    section(
      "YOUR GUIDED CAREER",
      `<div class="simple-row"><strong>${state.completed} / 18 lessons claimed</strong>${state.legacyCompleted ? `<small>${state.legacyCompleted} legacy chapter rewards preserved</small>` : ""}</div><p class="campaign-lesson">Recorded actions and earned assets count. Rank unlocks still come from playing. Equipment is delivered unequipped; if already owned, its listed value is paid instead. Player rewards wait safely if your squad is full.</p>`,
    ) +
    (state.pendingPlayers.length
      ? section(
          "RESERVED PLAYER REWARDS",
          state.pendingPlayers
            .map(
              (p) =>
                `<div class="simple-row"><span>${esc(p.asset.name)} · power ${p.asset.power}</span><button class="action" data-action="claimCampaignPlayer" data-id="${p.chapter}">Collect player</button></div>`,
            )
            .join(""),
        )
      : "") +
    (current
      ? section(`CHAPTER ${current.id} · ${current.title}`, card(current))
      : section(
          "FOOTBALL LEGEND",
          '<p class="empty">You completed all 18 guided chapters. Your rewards remain part of your club.</p>',
        )) +
    section(
      "CAMPAIGN ROADMAP",
      state.chapters
        .filter((c) => !c.current)
        .map(
          (c) =>
            `<details class="board-topic"><summary>${c.claimed ? "✓ " : ""}${c.id}. ${esc(c.title)} <small>${c.claimed ? "Rewards claimed" : esc(c.rankName)}</small></summary>${card(c)}</details>`,
        )
        .join(""),
    )
  );
}
