import type { Player, World } from "./types";
export const empirePages = [
  "businesses",
  "trading",
  "alliance",
  "ventures",
  "mail",
];
type Business = {
  id: string;
  title: string;
  description: string;
  rankRequired: number;
  price: number;
  level: number;
  rate: number;
  upgradeCost: number | null;
  collectedAt: string | null;
  available: number;
};
type Alliance = {
  id: string;
  name: string;
  owner: string;
  members: number;
  joined: boolean;
};
type Message = {
  id: string;
  sender: string;
  recipient: string | null;
  allianceId: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
  senderName: string;
  recipientName: string | null;
};
type Venture = {
  id: string;
  host: string;
  partner: string | null;
  hostReady: boolean;
  partnerReady: boolean;
  status: string;
  success: boolean | null;
  expiresAt: string;
  hostClub: string;
  partnerClub: string | null;
};
export interface EmpireState {
  serverTime: string;
  business: { businesses: Business[]; tickSeconds: number; capTicks: number };
  trade: {
    capacity: number;
    goods: {
      id: string;
      title: string;
      buy: number;
      sell: number;
      owned: number;
    }[];
  };
  alliances: Alliance[];
  members: { id: string; name: string; club: string }[];
  messages: Message[];
  ventures: Venture[];
}
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (n: number) => "£" + Number(n).toLocaleString("en-GB");
const section = (title: string, body: string) =>
  `<section class="panel"><div class="panel-title"><h2>${title}</h2></div>${body}</section>`;
const button = (kind: string, id: string, label: string, disabled = false) =>
  `<button class="action" data-action="${kind}" data-id="${esc(id)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
const rank = (n: number) =>
  ["Scum", "Pee Wee", "Thug", "Gangster", "Hitman", "Assassin"][n] ||
  "Higher rank";
const heading = (title: string, sub: string) =>
  `<div class="page-heading"><h1>${title}</h1><p>${sub}</p></div>`;
const note = (text: string) => `<p class="empire-rules">${text}</p>`;
const message = (m: Message, p: Player) =>
  `<article class="empire-row message-row"><div><strong>${esc(m.sender === p.id ? "You → " + (m.recipientName || "Alliance") : m.senderName)}</strong><small>${new Date(m.createdAt).toLocaleString("en-GB")}</small><p>${esc(m.body)}</p></div>${m.recipient === p.id && !m.readAt ? button("readMessage", m.id, "Mark read") : ""}</article>`;
export function renderEmpire(
  page: string,
  state: EmpireState | null,
  p: Player,
  world: World,
) {
  if (!state)
    return (
      heading("Club Empire", "") +
      section("YOUR EMPIRE", '<p class="empty">Loading your saved world…</p>')
    );
  const own = state.alliances.find((a) => a.joined);
  if (page === "businesses")
    return (
      heading(
        "Club Businesses",
        "Invest once. Build income while you are away.",
      ) +
      section(
        "BUSINESS EMPIRE",
        note(
          "Earnings every 10 minutes · 8-hour storage cap · No energy cost",
        ) +
          state.business.businesses
            .map(
              (b) =>
                `<article class="empire-row business-row"><div><h3>${esc(b.title)} ${b.level ? `<span class="chip">Level ${b.level}/5</span>` : ""}</h3><small>${money(b.rate)} / 10m · ${money(b.rate * 6)} / hour</small>${b.level ? `<strong class="stored" data-business-stored="${b.id}">${money(b.available)} stored</strong><small data-business-timer="${b.id}"></small>` : `<strong class="stored">Open ${money(b.price)} · ${rank(b.rankRequired)}</strong>`}<details><summary>Details</summary><p>${esc(b.description)}</p><p>Upgrades collect completed cycles at the old rate, then reset the clock including partial time. Business income does not increase rank.</p></details></div><div class="empire-actions">${b.level ? button("collectBusiness", b.id, "Collect", b.available < 1) + (b.level < 5 ? button("upgradeBusiness", b.id, "Upgrade " + money(b.upgradeCost!), p.cash < b.upgradeCost!) : '<span class="owned">Maximum level</span>') : p.rank < b.rankRequired ? `<span class="lock">◇ ${rank(b.rankRequired)}</span>` : button("buyBusiness", b.id, "Open " + money(b.price), p.cash < b.price)}</div></article>`,
            )
            .join(""),
      )
    );
  if (page === "trading")
    return (
      heading(
        "Merchandise Trading",
        "Find the margin. Move stock between football towns.",
      ) +
      section(
        "LOCAL MARKET · " + esc(p.region),
        note(
          `Buy/sell quotes change at 00:00 UTC. 3-pound dealer spread. Storage ${state.trade.goods.reduce((n, g) => n + g.owned, 0)} / ${state.trade.capacity}. Travel costs £50. Trading has a shared 15-second timer; no rank rewards.`,
        ) +
          `<p class="empire-rules" data-trade-timer></p>` +
          state.trade.goods
            .map(
              (g) =>
                `<article class="empire-row"><div><h3>${esc(g.title)}</h3><small>Buy ${money(g.buy)} · Sell ${money(g.sell)} · Owned ${g.owned}</small></div>${p.rank < 1 ? '<span class="lock">◇ Pee Wee</span>' : `<form class="trade-form" data-empire-kind="buyGoods"><input type="hidden" name="id" value="${g.id}"><label>Units<input name="quantity" type="number" min="1" max="20" value="1" required inputmode="numeric"></label><button class="action" name="tradeKind" value="buyGoods">Buy</button><button class="secondary" name="tradeKind" value="sellGoods" ${g.owned < 1 ? "disabled" : ""}>Sell</button></form>`}</article>`,
            )
            .join("") +
          '<div class="simple-row"><a href="#travel">Travel to another market →</a></div>',
      )
    );
  if (page === "alliance")
    return (
      heading("Alliances", "Build a shared football enterprise.") +
      (own
        ? section(
            esc(own.name),
            `<div class="simple-row"><span>${own.members} / 12 managers</span>${button("leaveAlliance", "", "Leave alliance")}</div>` +
              note(
                "Leaving cancels your waiting ventures. If the founder leaves, ownership passes to the longest-serving remaining member.",
              ) +
              state.members
                .map(
                  (m) =>
                    `<div class="simple-row"><strong>${esc(m.name)}</strong><span>${esc(m.club)} ${own.owner === m.id ? "· Founder/owner" : ""}</span></div>`,
                )
                .join(""),
          ) +
          section(
            "ALLIANCE ROOM",
            `<form class="compact-form" data-empire-kind="allianceMessage"><label>Message<input name="body" maxlength="1000" required placeholder="Message your alliance"></label><button class="action">Send to alliance</button></form>` +
              state.messages
                .filter((m) => m.allianceId)
                .map((m) => message(m, p))
                .join("") +
              '<div class="simple-row"><a href="#ventures">Joint ventures →</a></div>',
          )
        : section(
            "FIND YOUR ALLIANCE",
            p.rank < 1
              ? note("Alliances unlock at Pee Wee.")
              : `<form class="compact-form" data-empire-kind="createAlliance"><label>New alliance name<input name="name" minlength="2" maxlength="32" required></label><button class="action" ${p.cash < 250 ? "disabled" : ""}>Found alliance · £250</button></form>` +
                  state.alliances
                    .map(
                      (a) =>
                        `<div class="simple-row"><div><strong>${esc(a.name)}</strong><small>${a.members} / 12 managers</small></div>${button("joinAlliance", a.id, a.members >= 12 ? "Full" : "Join", a.members >= 12)}</div>`,
                    )
                    .join(""),
          ))
    );
  if (page === "mail")
    return (
      heading("Manager Mail", "Private messages between game accounts.") +
      section(
        "SEND A MESSAGE",
        world.managers.filter((m) => m.id !== p.id).length
          ? `<form class="compact-form" data-empire-kind="sendMessage"><label>Recipient<select name="target">${world.managers
              .filter((m) => m.id !== p.id)
              .map(
                (m) =>
                  `<option value="${m.id}">${esc(m.name)} · ${esc(m.club)}</option>`,
              )
              .join(
                "",
              )}</select></label><label>Message<input name="body" maxlength="1000" required></label><button class="action">Send message</button><small>Plain text · 100 messages per day · Never share passwords or personal details.</small></form>`
          : note("No other managers are available yet."),
      ) +
      section(
        "INBOX & SENT",
        state.messages
          .filter((m) => !m.allianceId)
          .map((m) => message(m, p))
          .join("") || '<p class="empty">No mail yet.</p>',
      )
    );
  if (page === "ventures")
    return (
      heading(
        "Joint Ventures",
        "Two managers. One tournament. Shared risk and reward.",
      ) +
      section(
        "ORGANISED TOURNAMENT",
        note(
          "Requires Thug and alliance membership. Each participant commits £80 and 10 energy when the host starts. Success pays £400 each before costs; failure pays £0. Success chance is 65–90%, improved by combined club power. Both receive a 30-minute venture cooldown. Waiting ventures expire after 24 hours.",
        ) +
          (!own
            ? '<div class="simple-row"><a href="#alliance">Join an alliance first →</a></div>'
            : p.rank < 2
              ? note("Earn Thug to organise a venture.")
              : button("createVenture", "", "Organise tournament")),
      ) +
      section(
        "ALLIANCE VENTURES",
        state.ventures
          .map((v) => {
            const participant = v.host === p.id || v.partner === p.id;
            const ready = v.host === p.id ? v.hostReady : v.partnerReady;
            return `<article class="empire-row"><div><h3>Joint tournament</h3><small>${esc(v.hostClub)} ${v.hostReady ? "✓ ready" : ""} + ${esc(v.partnerClub || "Waiting for partner")} ${v.partnerReady ? "✓ ready" : ""}</small><p>${v.status === "complete" ? (v.success ? "Tournament succeeded" : "Tournament fell short") : v.status === "cancelled" ? "Cancelled" : `Waiting · expires ${new Date(v.expiresAt).toLocaleString("en-GB")}`}</p></div><div class="empire-actions">${v.status !== "open" ? "" : !participant && !v.partner ? button("joinVenture", v.id, "Join") : participant ? button("readyVenture", v.id, ready ? "Withdraw readiness" : "Mark ready") + (v.host === p.id ? button("resolveVenture", v.id, "Start tournament", !v.hostReady || !v.partnerReady) : "") + button("cancelVenture", v.id, "Cancel") : ""}</div></article>`;
          })
          .join("") || '<p class="empty">No ventures yet.</p>',
      )
    );
  return "";
}
export function updateEmpireTimers(
  state: EmpireState | null,
  offset: number,
  busy: boolean,
  p: Player,
) {
  if (!state) return;
  for (const b of state.business.businesses.filter(
    (b) => b.level && b.collectedAt,
  )) {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() + offset - Date.parse(b.collectedAt!)) / 1000),
    );
    const ticks = Math.min(48, Math.floor(elapsed / 600));
    const remaining = 600 - (elapsed % 600);
    const stored = document.querySelector(`[data-business-stored="${b.id}"]`);
    if (stored) stored.textContent = money(ticks * b.rate) + " stored";
    const timer = document.querySelector(`[data-business-timer="${b.id}"]`);
    if (timer)
      timer.textContent =
        ticks === 48
          ? "Storage full — collect to restart"
          : `Next earnings ${Math.floor(remaining / 60)}m ${remaining % 60}s · cap ${money(48 * b.rate)}`;
    const btn = document.querySelector<HTMLButtonElement>(
      `[data-action="collectBusiness"][data-id="${b.id}"]`,
    );
    if (btn) {
      btn.disabled = busy || !ticks;
      btn.textContent = ticks
        ? "Collect " + money(ticks * b.rate)
        : `Ready ${Math.floor(remaining / 60)}m ${remaining % 60}s`;
    }
  }
  const tradeSeconds = Math.max(
    0,
    Math.ceil(
      (Date.parse(p.cooldowns.trade || "1970-01-01") - Date.now() - offset) /
        1000,
    ),
  );
  const label = document.querySelector("[data-trade-timer]");
  if (label)
    label.textContent = tradeSeconds
      ? `Market ready in ${tradeSeconds}s`
      : "Market ready";
  document
    .querySelectorAll<HTMLButtonElement>(".trade-form button")
    .forEach((b) => {
      b.disabled =
        busy ||
        tradeSeconds > 0 ||
        (b.value === "sellGoods" &&
          !state.trade.goods.find(
            (g) =>
              g.id ===
              (b.form!.elements.namedItem("id") as HTMLInputElement).value,
          )?.owned);
      if (b.value === "buyGoods")
        b.textContent = tradeSeconds ? `${tradeSeconds}s` : "Buy";
    });
}
