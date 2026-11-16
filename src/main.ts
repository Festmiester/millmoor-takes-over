import "./style.css";
import type { Player, Catalog, Activity, World, GameEvent } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
let player: Player | null = null,
  catalog: Catalog = { ranks: [], activities: [], items: [] },
  world: World = {
    managers: [],
    counts: { total: 0, online: 0 },
    listings: [],
  },
  events: GameEvent[] = [];
let config = { google: false, testAccounts: false, environment: "test" },
  approach = localStorage.getItem("mto_approach") || "steady",
  tier = 1,
  menuOpen = false,
  busy = false,
  offset = 0,
  lastResult: { success: boolean; message: string; cashDelta: number } | null =
    null;
let page = location.hash.slice(1) || "office";
let openCategory: string | null = null;
let googleLinked = false;
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(n));
const groups = [
  {
    name: "Main",
    links: [
      ["office", "Club Office"],
      ["profile", "My Manager"],
      ["online", "Managers Online"],
      ["leaderboard", "Hall of Fame"],
      ["history", "Club News"],
      ["guide", "Game Guide"],
    ],
  },
  {
    name: "Campaign",
    links: [
      ["scouting", "Talent Scouts"],
      ["recruitment", "Recruitment"],
      ["squad", "My Squad"],
      ["training", "Training Centre"],
      ["rivals", "Rival Challenges"],
      ["campaign", "Road to Legend"],
      ["club", "Club Development"],
    ],
  },
  {
    name: "Resources",
    links: [
      ["shop", "Kit & Equipment"],
      ["market", "Transfer Market"],
      ["bank", "Club Bank"],
      ["travel", "Transit Hub"],
    ],
  },
];
const chapters = [
  "First Boots on the Ground",
  "A Name on the Street",
  "The Local Following",
  "Trial by Football",
  "Beyond the Touchline",
  "A Club with Ambition",
  "The Regional Stage",
  "New Colours, New Ground",
  "The County Contenders",
  "Building a Reputation",
  "The National Spotlight",
  "More than a Club",
  "A Continental Dream",
  "The Football Institution",
  "The Global Stage",
  "A Lasting Legacy",
  "The Beautiful Empire",
  "A Legend of the Game",
];
async function api<T = any>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      data === undefined
        ? {}
        : { "Content-Type": "application/json", "X-MTO-Request": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const b = (await r.json()) as any;
  if (!r.ok)
    throw Object.assign(new Error(b.error || "Request failed"), {
      status: r.status,
    });
  return b;
}
function seconds(key: string) {
  return player?.cooldowns[key]
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(player.cooldowns[key]) - Date.now() - offset) / 1000,
        ),
      )
    : 0;
}
const duration = (s: number) =>
  s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
function actionButton(
  kind: string,
  id: string,
  label: string,
  disabled = false,
  cd = "",
) {
  return `<button class="action" data-action="${kind}" data-id="${esc(id)}" ${cd ? `data-cooldown="${cd}" data-label="${esc(label)}"` : ""} ${disabled || busy ? "disabled" : ""}>${cd && seconds(cd) ? duration(seconds(cd)) : label}</button>`;
}
function rankName(n: number) {
  return catalog.ranks.find((r) => r.id === n)?.name || "Next rank";
}
function lock(n: number) {
  return `<span class="lock">◇ ${esc(rankName(n))}</span>`;
}
function navigation() {
  return groups
    .map(
      (g) =>
        `<section class="nav-group"><h2>${g.name}</h2><div>${g.links.map(([id, label]) => `<a href="#${id}" class="${page === id ? "selected" : ""}" ${page === id ? 'aria-current="page"' : ""}>${label}${["scouting", "training"].includes(id) && player!.rank < 1 ? "<span>◇</span>" : ""}</a>`).join("")}</div></section>`,
    )
    .join("");
}
function mobileNavigation() {
  const active = groups.find((g) => g.links.some(([id]) => id === page))?.name;
  return `<nav class="mobile-categories" aria-label="Game categories">${groups.map((g) => `<button data-category="${g.name}" aria-expanded="${openCategory === g.name}" class="${(openCategory || active) === g.name ? "selected" : ""}">${g.name}</button>`).join("")}</nav>${
    openCategory
      ? `<section class="mobile-submenu panel" aria-label="${esc(openCategory)} menu"><div class="panel-title"><button data-category-back>← Back to game</button><h2>${esc(openCategory)}</h2></div><div class="submenu-links">${groups
          .find((g) => g.name === openCategory)!
          .links.map(
            ([id, label]) =>
              `<a href="#${id}" class="${id === page ? "selected" : ""}">${esc(label)}</a>`,
          )
          .join("")}</div></section>`
      : ""
  }`;
}
function notices() {
  const pending = sessionStorage.getItem("mto_pending");
  if (pending && !busy)
    return `<div class="result failure" role="status"><p>A saved move needs confirmation from the server.</p><button class="action" data-retry>Retry saved move</button></div>`;
  return lastResult
    ? `<div role="status" class="result ${lastResult.success ? "success" : "failure"}"><span class="result-icon">${lastResult.success ? "✓" : "!"}</span><div><strong>${lastResult.success ? "Good business" : "A setback"}</strong><p>${esc(lastResult.message)}</p></div><button class="dismiss" data-dismiss aria-label="Dismiss result">×</button></div>`
    : "";
}
function section(title: string, content: string, sub = "") {
  return `<section class="panel"><div class="panel-title"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ""}</div>${content}</section>`;
}
function banner(eyebrow: string, title: string, sub: string) {
  return `<div class="page-heading"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${sub}</p></div>`;
}
function header() {
  const p = player!;
  return `<header class="topbar"><a class="brand" href="#office"><img src="/crest.svg" alt="Millmoor Takes Over crest"><span>MILLMOOR<small>TAKES OVER</small></span></a><button class="manager-chip" data-character aria-label="Open character"><span class="avatar">${esc(p.name.slice(0, 2).toUpperCase())}</span><span><strong>${esc(p.club)}</strong><small>${esc(p.rankName)} · ${esc(p.region)}</small></span></button><div class="header-money"><small>ON HAND</small><strong data-cash>${money(p.cash)}</strong></div><div class="header-energy"><span><small>ENERGY</small><b data-energy>${p.energy} / 100</b></span><progress max="100" value="${p.energy}" aria-label="Energy"></progress><small class="energy-recovery" data-energy-next></small></div><button class="menu-button" data-menu aria-expanded="${menuOpen}">☰ <span>Menu</span></button></header>`;
}
function rail() {
  const p = player!;
  return `<aside class="right-rail">${section("THE MANAGER", `<div class="manager-summary"><div class="manager-avatar">${esc(p.name.slice(0, 2).toUpperCase())}</div><strong>${esc(p.name)}</strong><span>${esc(p.rankName)}</span><small>${esc(p.club)}</small></div><dl class="facts"><div><dt>Cash</dt><dd data-cash>${money(p.cash)}</dd></div><div><dt>In the bank</dt><dd data-bank>${money(p.bank)}</dd></div><div><dt>Club power</dt><dd>${p.power}</dd></div><div><dt>Squad</dt><dd>${p.squad.length} players</dd></div><div><dt>Home</dt><dd>${esc(p.region)}</dd></div></dl><button class="text-button full" data-character>Open character →</button>`)}${section("THE TOUCHLINE", `<div class="rail-note"><span class="live-dot"></span> <strong data-online>${world.counts.online}</strong> managers online<p>Make your name. Build your club. Take over.</p><a href="#online">See who is around →</a></div>`)}${section("NEXT STEPS", `<div class="rail-note"><p>${p.rank === 0 ? "Deliver flyers and run coaching sessions to establish your name." : "Build your contacts, strengthen your squad and keep the business moving."}</p><p>Reputation is earned in the game. Your next promotion arrives when you deserve it.</p><a href="#guide">Read the game guide →</a></div>`)}</aside>`;
}
function render() {
  if (!player) {
    renderLogin();
    return;
  }
  app.innerHTML =
    header() +
    mobileNavigation() +
    `<div class="world-strip"><span><i class="live-dot"></i> SOUTH YORKSHIRE</span><span class="test-label">INDEPENDENT TEST WORLD</span><span data-clock>${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} UK</span></div><div class="game-layout"><aside class="sidebar ${menuOpen ? "is-open" : ""}">${navigation()}<button class="logout" data-logout>Sign out</button><p class="sidebar-footer">YOUR CLUB. YOUR EMPIRE.<br>Est. in South Yorkshire</p></aside><main id="content" tabindex="-1"><div class="breadcrumb">Millmoor Takes Over <span>/</span> ${esc(groups.flatMap((g) => g.links).find(([id]) => id === page)?.[1] || "Club Office")}</div>${notices()}${content()}</main>${rail()}</div><dialog id="character" aria-label="Your character"></dialog><div class="toast" role="alert" hidden></div>`;
  if (config.google && !googleLinked) {
    document
      .querySelector("#content")
      ?.insertAdjacentHTML(
        "afterbegin",
        '<div class="account-notice"><span>Keep this club on every device.</span><a href="/auth/google">Connect Google →</a></div>',
      );
  }
  updateTimers();
}
function renderLogin() {
  app.innerHTML = `<main class="entry"><a class="entry-brand" href="#office"><img src="/crest.svg" alt="Millmoor Takes Over"></a><span class="eyebrow">AN INDEPENDENT FOOTBALL WORLD</span><h1>Small beginnings.<br><em>Big ambitions.</em></h1><p>Start on the local touchline. Build a football empire.<br>Every manager in this world is making their own way.</p><div class="entry-form panel"><div class="panel-title"><h2>OPEN YOUR CLUB</h2><span>Test world</span></div><div class="entry-body">${config.google ? '<a class="google-button" href="/auth/google">Continue with Google →</a>' : '<p class="muted">Google sign-in is being connected.</p>'}${config.testAccounts ? `<form id="signup"><label>Manager name<input name="name" minlength="2" maxlength="24" placeholder="Your manager name" required autocomplete="nickname"></label><label>Club name<input name="club" minlength="2" maxlength="32" placeholder="Your club name" required></label><button class="action full" type="submit">Enter the test world →</button><p class="small muted">Test access lasts seven days in this browser. Signing out ends access. Link Google when available to keep your club across devices.</p></form>` : "<p>Club registration opens when sign-in is configured.</p>"}<p id="login-error" role="alert"></p></div></div><footer>Persistent multiplayer · Original football content · No real-money purchases</footer></main>`;
  if (new URLSearchParams(location.search).get("signin") === "cancelled") {
    document.querySelector("#login-error")!.textContent =
      "Google sign-in was cancelled. Your club has not changed.";
    history.replaceState(null, "", location.pathname + location.hash);
  }
}
function content() {
  const p = player!;
  switch (page) {
    case "office":
      return (
        banner(
          "THE DAILY BUSINESS",
          "Club Office",
          "Work the neighbourhood. Build your reputation. Make the next move.",
        ) +
        `<div class="ground-banner"><div><span class="eyebrow">${esc(p.club)}</span><h2>Every empire starts<br>with a local following.</h2><span class="ground-caption">${esc(p.region)} · Grassroots to the world</span></div><div class="pitch-art" aria-hidden="true"><div class="centre-circle"></div><div class="goal goal-left"></div><div class="goal goal-right"></div></div></div>` +
        section(
          "YOUR APPROACH",
          `<div class="approach-row">${["safe", "steady", "bold"].map((a) => `<button data-approach="${a}" class="approach ${approach === a ? "active" : ""}" aria-pressed="${approach === a}"><strong>${a[0].toUpperCase() + a.slice(1)}</strong><small>${a === "safe" ? "Better odds · lower return" : a === "bold" ? "More risk · higher return" : "Balanced risk & return"}</small></button>`).join("")}</div>`,
        ) +
        section(
          "OFFICE ACTIVITIES",
          `<div class="tier-tabs" role="group" aria-label="Activity tier">${[1, 2, 3, 4, 5].map((n) => `<button data-tier="${n}" class="${tier === n ? "active" : ""}">Tier ${n}</button>`).join("")}</div>${activityRows(catalog.activities.filter((a) => a.category === "office" && a.tier === tier))}`,
          "Independent timers",
        ) +
        `<p class="footnote">Success improves your proficiency. Each activity has its own cooldown. Failed attempts still use energy and entry fees.</p>`
      );
    case "scouting":
    case "recruitment":
      return (
        banner(
          "FOOTBALL CONTACTS",
          page === "scouting" ? "Talent Scouts" : "Recruitment",
          "Find original football talent. Successful deals add permanent players to your squad.",
        ) +
        section(
          "AVAILABLE CONTACTS",
          activityRows(catalog.activities.filter((a) => a.category === page)),
        ) +
        section(
          "YOUR SQUAD",
          `<div class="simple-row"><span>${p.squad.length} signed players</span><a href="#squad">Manage your players →</a></div>`,
        )
      );
    case "bank":
      return (
        banner(
          "LOOK AFTER THE BUSINESS",
          "Club Bank",
          "Keep your savings separate from the cash you use on the touchline.",
        ) +
        `<div class="stat-grid"><div><small>CASH ON HAND</small><strong>${money(p.cash)}</strong></div><div><small>BANK SAVINGS</small><strong>${money(p.bank)}</strong></div></div>` +
        section(
          "MOVE MONEY",
          `<form id="bank" class="compact-form"><label>Amount (£)<input name="amount" inputmode="numeric" type="number" min="1" max="1000000000" step="1" required placeholder="0"></label><div class="button-row"><button class="action" name="kind" value="deposit">Deposit →</button><button class="secondary" name="kind" value="withdraw">← Withdraw</button></div></form><p class="footnote padded">No interest or fees in this test world. Every transaction is saved immediately.</p>`,
        )
      );
    case "shop":
      return (
        banner(
          "DRESS FOR THE JOB",
          "Kit & Equipment",
          "Original gear for your manager. Equip one item in each slot to build club power.",
        ) +
        section(
          "EQUIPMENT STORE",
          `<div class="item-grid">${catalog.items.map((i) => `<article class="shop-item"><div class="item-symbol" aria-hidden="true">${i.slot === "feet" ? "◒" : i.slot === "body" ? "♜" : i.slot === "hands" ? "▤" : "◷"}</div><div><small>${esc(i.slot.toUpperCase())} · +${i.power} POWER</small><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><strong>${money(i.price)}</strong></div>${p.rank < i.rankRequired ? lock(i.rankRequired) : p.inventory.some((x) => x.id === i.id) ? '<span class="owned">✓ Owned</span>' : actionButton("buyItem", i.id, "Buy", p.cash < i.price)}</article>`).join("")}</div>`,
        ) +
        inventory()
      );
    case "squad":
      return (
        banner(
          "THE PLAYERS BEHIND THE CLUB",
          "My Squad",
          "Scout, recruit and trade your way to a stronger club.",
        ) +
        section(
          "SIGNED PLAYERS",
          p.squad.length
            ? `<div class="squad-list">${p.squad.map((s) => `<article class="player-row"><span class="position">${esc(s.position)}</span><div><h3>${esc(s.name)}</h3><small>${esc(s.rarity)} · Power ${s.power} · Release ${money(s.value)}</small></div><div class="button-row">${actionButton("sellPlayer", s.id, "Release")}<button class="secondary" data-list="${s.id}">List</button></div></article>`).join("")}</div>`
            : '<p class="empty">No players signed yet. Talent Scouts opens at Pee Wee.</p>',
        ) +
        section(
          "THE TRANSFER MARKET",
          '<div class="simple-row"><p>Trade players with other managers.</p><a href="#market">Open the market →</a></div>',
        )
      );
    case "market":
      return (
        banner(
          "BUSINESS BETWEEN MANAGERS",
          "Transfer Market",
          "Player transfers between real accounts. Funds and ownership move together.",
        ) +
        section(
          "LIVE LISTINGS",
          world.listings.length
            ? world.listings
                .map(
                  (l) =>
                    `<article class="player-row"><span class="position">${esc(l.asset.position)}</span><div><h3>${esc(l.asset.name)}</h3><small>${esc(l.asset.rarity)} · Power ${l.asset.power} · ${esc(l.club)}</small></div><strong>${money(l.price)}</strong>${l.seller === p.id ? actionButton("cancelListing", l.id, "Withdraw") : actionButton("buyListing", l.id, "Sign", p.cash < l.price)}</article>`,
                )
                .join("")
            : '<p class="empty">The market is quiet. Sign a player and create the first listing from My Squad.</p>',
        )
      );
    case "training":
      return (
        banner(
          "PUT IN THE WORK",
          "Training Centre",
          "Improve football attributes independently of your rank.",
        ) +
        section(
          "MANAGER TRAINING",
          Object.entries(p.attributes)
            .map(
              ([stat, val]) =>
                `<div class="simple-row"><div><strong class="capitalize">${stat}</strong><p class="muted small">£20 · 10 energy · 60s shared training cooldown</p></div><span class="attribute">${val}</span>${p.rank < 1 ? lock(1) : actionButton("train", stat, "Train", !!seconds("training") || p.energy < 10 || p.cash < 20, "training")}</div>`,
            )
            .join(""),
        )
      );
    case "club":
      return (
        banner(
          "BUILD SOMETHING LASTING",
          "Club Development",
          "Invest in the training ground. Better facilities improve your odds and club power.",
        ) +
        section(
          "TRAINING GROUND",
          `<div class="development"><div class="stadium" aria-hidden="true">▥</div><div><span class="eyebrow">FACILITY LEVEL ${p.facility} / 10</span><h2>${p.facility === 0 ? "The local training pitch" : p.facility < 5 ? "A growing club ground" : "An established football centre"}</h2><p>+${p.facility * 5} power · +${Math.min(6, p.facility)} points to activity success</p><p>Next investment: ${money(500 * (p.facility + 1) ** 2)}</p>${p.rank < 2 ? lock(2) : actionButton("upgrade", "", "Upgrade ground", p.facility >= 10 || p.cash < 500 * (p.facility + 1) ** 2)}</div></div>`,
        )
      );
    case "travel":
      return (
        banner(
          "SOUTH YORKSHIRE & BEYOND",
          "Transit Hub",
          "Take your club across the region. Travel costs £50 with a two-minute transport cooldown.",
        ) +
        section(
          "REGIONAL CONNECTIONS",
          `<div class="region-grid">${["Rotherham", "Sheffield", "Doncaster", "Barnsley"].map((r, i) => `<article><small>0${i + 1} / SOUTH YORKSHIRE</small><h2>${r}</h2><p>${["Where it all starts. Steel, football and ambition.", "A city built on competition and character.", "New contacts. New football opportunities.", "A proud football town with a point to prove."][i]}</p>${r === p.region ? '<span class="owned">● Current region</span>' : p.rank < 1 ? lock(1) : actionButton("travel", r, "Travel · £50", !!seconds("travel") || p.cash < 50, "travel")}</article>`).join("")}</div>`,
        )
      );
    case "rivals":
      return (
        banner(
          "TEST YOUR CLUB",
          "Rival Challenges",
          "Challenge another manager to a friendly. The winner earns £75; the opponent loses no money.",
        ) + section("OTHER MANAGERS", managerRows(true))
      );
    case "leaderboard":
    case "online":
      return (
        banner(
          "A WORLD OF AMBITIOUS MANAGERS",
          page === "online" ? "Managers Online" : "Hall of Fame",
          page === "online"
            ? "Managers active within the last two minutes."
            : "Ranked by reputation earned through play. Your place is earned on the touchline.",
        ) +
        section(
          page === "online" ? "ON THE TOUCHLINE" : "WORLD RANKINGS",
          managerRows(false, page === "online"),
          `${world.counts.total} managers`,
        )
      );
    case "campaign":
      return (
        banner(
          "YOUR ORIGINAL FOOTBALL STORY",
          "Road to Legend",
          "Eighteen chapters. From your first local following to a lasting football legacy.",
        ) +
        section(
          "THE CAMPAIGN",
          chapters
            .map(
              (c, i) =>
                `<div class="chapter ${i === p.chapter ? "current" : ""}"><span class="chapter-number">${i < p.chapter ? "✓" : String(i + 1).padStart(2, "0")}</span><div><h3>${c}</h3><small>${(i + 1) * 10} successful moves · ${esc(rankName(Math.min(12, Math.floor(i / 2))))} · ${money(100 * (i + 1))} reward</small></div>${i < p.chapter ? '<span class="owned">Complete</span>' : i === p.chapter ? actionButton("chapter", "", "Claim", p.wins < (i + 1) * 10 || p.rank < Math.min(12, Math.floor(i / 2))) : '<span class="lock">◇</span>'}</div>`,
            )
            .join(""),
        )
      );
    case "history":
      return (
        banner(
          "WHAT HAPPENED AT YOUR CLUB",
          "Club News",
          "Your recent activities, transfers and progress. Saved by the game server.",
        ) +
        section(
          "ACTIVITY LOG",
          events.length
            ? events
                .map(
                  (e) =>
                    `<div class="event-row"><time>${new Date(e.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time><span>${esc(e.message)}</span>${e.cashDelta ? `<b class="${e.cashDelta > 0 ? "positive" : "negative"}">${e.cashDelta > 0 ? "+" : ""}${money(e.cashDelta)}</b>` : ""}</div>`,
                )
                .join("")
            : '<p class="empty">A new club, a clean slate. Your first move will appear here.</p>',
        )
      );
    case "profile":
      return (
        banner(
          "THE PERSON ON THE TOUCHLINE",
          "My Manager",
          "Your identity in the football world.",
        ) +
        section(
          "MANAGER DETAILS",
          `<form id="profile" class="compact-form"><label>Manager name<input name="name" value="${esc(p.name)}" minlength="2" maxlength="24" required></label><label>Club name<input name="club" value="${esc(p.club)}" minlength="2" maxlength="32" required></label><button class="action">Save details</button></form>`,
        ) +
        inventory() +
        section(
          "YOUR RECORD",
          `<dl class="facts"><div><dt>Rank</dt><dd>${esc(p.rankName)}</dd></div><div><dt>Successful moves</dt><dd>${p.wins}</dd></div><div><dt>Activity attempts</dt><dd>${p.actions}</dd></div><div><dt>Chapters completed</dt><dd>${p.chapter} / 18</dd></div></dl>${config.google ? '<a class="text-button full" href="/auth/google">Connect with Google →</a>' : ""}`,
        )
      );
    case "guide":
      return (
        banner(
          "LEARN THE ROPES",
          "Game Guide",
          "Your club grows through decisions, patience and a little good fortune.",
        ) +
        section(
          "GETTING STARTED",
          `<div class="guide"><h3>01 / Make a name</h3><p>Every manager starts as Scum with £250 and 100 energy. Deliver Flyers and Community Coaching are your two starter activities. Success brings cash, improves proficiency and builds your reputation.</p><h3>02 / Choose your approach</h3><p>Safe adds 10 points to your chance but pays 20% less. Bold removes 10 points but pays 30% more. Steady keeps the base odds. No approach guarantees success.</p><h3>03 / Keep things moving</h3><p>Each activity has its own persistent timer. Energy recovers by 2 each minute, including while you are away. You never need to keep the tab open.</p><h3>04 / Earn your rank</h3><p>Successful actions build hidden progress. Harder actions count for more. Your rank appears when you earn it; there is no progress counter or percentage. The early ranks open scouting, recruitment, training and rival challenges.</p><h3>05 / Own your assets</h3><p>Successful scouting and recruitment can sign original players. Keep them, release them to the game or list them for another manager. Equipment affects club power only while equipped. One item per slot.</p><h3>06 / The test world</h3><p>All balances are fictional. No deposits of real money, paid gold or cash prizes. Test accounts stay in this browser until connected to Google. This world is independent of the Millmoor Juniors app.</p></div>`,
        ) +
        section(
          "THE RANKS",
          `<div class="rank-list">${catalog.ranks.map((r) => `<div class="simple-row"><span>${String(r.id + 1).padStart(2, "0")} / ${esc(r.name)}</span>${r.id === p.rank ? '<span class="owned">Your rank</span>' : r.id < p.rank ? "✓" : "◇"}</div>`).join("")}</div>`,
        )
      );
    default:
      page = "office";
      return content();
  }
}
function activityRows(rows: Activity[]) {
  const p = player!;
  return (
    rows
      .map((a) => {
        const locked = p.rank < a.rankRequired;
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
        return `<article class="activity-row ${locked ? "locked" : ""}"><div class="activity-icon" aria-hidden="true">${a.asset ? "⌕" : a.id === "flyers" ? "▧" : a.id === "coaching" ? "⚑" : "▤"}</div><div class="activity-copy"><div class="activity-title"><h3>${esc(a.title)}</h3>${a.asset ? '<span class="chip">PLAYER ASSET</span>' : ""}</div><p>${esc(a.description)}</p><div class="activity-meta"><span>◷ ${duration(a.seconds)}</span><span>ϟ ${a.energy} energy</span><span>${a.cost ? money(a.cost) + " entry" : "No entry fee"}</span><span class="reward">${money(Math.floor(a.reward * (approach === "safe" ? 0.8 : approach === "bold" ? 1.3 : 1)))} on success</span></div><div class="ratings"><span>Success <b>${locked ? "—" : chance + "%"}</b><meter min="0" max="100" value="${locked ? 0 : chance}" aria-label="Success chance"></meter></span><span>Exposure <b>${a.tier < 3 ? "Low" : a.tier < 5 ? "Medium" : "High"}</b></span></div></div><div class="activity-action">${locked ? lock(a.rankRequired) : actionButton("activity", a.id, "Start", !!seconds(a.id) || p.cash < a.cost || p.energy < a.energy, a.id)}</div></article>`;
      })
      .join("") || '<p class="empty">No contacts in this tier.</p>'
  );
}
function inventory() {
  const p = player!;
  return section(
    "YOUR EQUIPMENT",
    p.inventory.length
      ? p.inventory
          .map(
            (i) =>
              `<div class="simple-row"><div><strong>${esc(i.title)}</strong><p class="small muted">${esc(i.slot)} · +${i.power} power</p></div>${actionButton("equip", i.id, i.equipped ? "Unequip" : "Equip")}</div>`,
          )
          .join("")
      : '<p class="empty">Nothing equipped yet. Your first pair of Touchline Boots is waiting in the shop.</p>',
  );
}
function managerRows(challenge = false, online = false) {
  const p = player!;
  const rows = world.managers.filter(
    (m) => (!online || m.online) && (!challenge || m.id !== p.id),
  );
  return rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Manager / Club</th><th>Rank</th><th>${challenge ? "Power" : "Region"}</th><th>${challenge ? "Challenge" : "Wealth"}</th></tr></thead><tbody>${rows.map((m, i) => `<tr class="${m.id === p.id ? "your-row" : ""}"><td>${i + 1}</td><td><span class="${m.online ? "live-dot" : "offline-dot"}"></span><strong>${esc(m.name)}</strong><small>${esc(m.club)}${m.id === p.id ? " · You" : ""}</small></td><td>${esc(m.rankName)}</td><td>${challenge ? m.power : esc(m.region)}</td><td>${challenge ? (p.rank < 2 ? lock(2) : m.rank < 2 ? '<span class="lock">Protected</span>' : actionButton("challenge", m.id, "Play friendly", !!seconds("challenge") || p.energy < 15, "challenge")) : money(m.wealth)}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="empty">No other managers here yet. Invite someone to the test world and build your rivalry.</p>';
}
function showCharacter(tab = "character") {
  const p = player!,
    d = document.querySelector<HTMLDialogElement>("#character")!;
  const tabs = [
    ["character", "Character"],
    ["items", "Items"],
    ["players", "Players"],
    ["skills", "Skills"],
    ["bank", "Bank"],
    ["wallet", "Wallet"],
    ["perks", "Perks"],
  ];
  let panel = `<div class="character-layout"><div class="character-portrait"><div class="portrait-head"></div><div class="portrait-body"></div><strong>${esc(p.name)}</strong><span>${esc(p.rankName)}</span></div><div class="character-facts"><h3>${esc(p.club)}</h3><dl class="facts"><div><dt>Cash</dt><dd>${money(p.cash)}</dd></div><div><dt>Savings</dt><dd>${money(p.bank)}</dd></div><div><dt>Power</dt><dd>${p.power}</dd></div>${Object.entries(
    p.attributes,
  )
    .map(([k, v]) => `<div><dt class="capitalize">${k}</dt><dd>${v}</dd></div>`)
    .join(
      "",
    )}</dl><p class="small muted">${googleLinked ? "Google connected · Your club follows your account." : "Browser test account · Keep this session to retain access."}</p>${config.google && !googleLinked ? '<a class="google-button" href="/auth/google">Connect this club to Google →</a>' : ""}</div></div>`;
  if (tab === "items")
    panel =
      inventory() +
      '<a class="text-button full" href="#shop" data-close>Visit Kit & Equipment →</a>';
  if (tab === "players")
    panel = section(
      "YOUR PLAYERS",
      p.squad.length
        ? p.squad
            .map(
              (a) =>
                `<div class="simple-row"><div><strong>${esc(a.name)}</strong><p class="small muted">${esc(a.position)} · ${esc(a.rarity)} · ${a.power} power</p></div><strong>${money(a.value)}</strong></div>`,
            )
            .join("")
        : '<p class="empty">Your scouted and recruited players will appear here.</p>',
    );
  if (tab === "skills")
    panel =
      section(
        "TRAINING ATTRIBUTES",
        Object.entries(p.attributes)
          .map(
            ([k, v]) =>
              `<div class="simple-row"><span class="capitalize">${esc(k)}</span><strong>${v}</strong></div>`,
          )
          .join(""),
      ) +
      section(
        "ACTIVITY PROFICIENCY",
        Object.entries(p.mastery)
          .map(
            ([id, v]) =>
              `<div class="simple-row"><span>${esc(catalog.activities.find((a) => a.id === id)?.title || id)}</span><strong>+${Number(v).toFixed(1)} chance points</strong></div>`,
          )
          .join("") ||
          '<p class="empty">Complete activities to build proficiency.</p>',
      );
  if (tab === "bank")
    panel = section(
      "CLUB BANK",
      `<div class="simple-row"><span>On hand</span><strong>${money(p.cash)}</strong></div><div class="simple-row"><span>In the bank</span><strong>${money(p.bank)}</strong></div><form id="bank" class="compact-form"><label>Amount (£)<input name="amount" type="number" min="1" max="1000000000" step="1" required></label><div class="button-row"><button class="action" value="deposit">Deposit</button><button class="action" value="withdraw">Withdraw</button></div></form>`,
    );
  if (tab === "wallet")
    panel = section(
      "RECENT TRANSACTIONS",
      events.length
        ? events
            .map(
              (e) =>
                `<div class="simple-row"><div><strong>${esc(e.message)}</strong><p class="small muted">${esc(new Date(e.createdAt).toLocaleString("en-GB"))}</p></div><strong>${e.cashDelta > 0 ? "+" : ""}${money(e.cashDelta)}</strong></div>`,
            )
            .join("")
        : '<p class="empty">No activity recorded yet.</p>',
    );
  if (tab === "perks")
    panel = section(
      "ACTIVE CLUB BENEFITS",
      `<div class="simple-row"><span>Facility level</span><strong>${p.facility}</strong></div><div class="simple-row"><span>Facility activity chance bonus</span><strong>+${Math.min(6, p.facility)} points</strong></div>${p.inventory
        .filter((i) => i.equipped)
        .map(
          (i) =>
            `<div class="simple-row"><span>${esc(i.title)}</span><strong>+${i.power} power</strong></div>`,
        )
        .join(
          "",
        )}<p class="empty">Equipment contributes while equipped. Activity proficiency is listed under Skills.</p>`,
    );
  d.innerHTML = `<div class="panel-title"><h2>MANAGER FILE</h2><button data-close aria-label="Close character">×</button></div><div class="character-tabs" aria-label="Manager file sections">${tabs.map(([id, label]) => `<button data-character-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join("")}</div><div class="character-panel">${panel}</div>`;
  if (!d.open) d.showModal();
}
function error(message: string) {
  const t = document.querySelector<HTMLElement>(".toast");
  if (t) {
    t.textContent = message;
    t.hidden = false;
    setTimeout(() => (t.hidden = true), 6500);
  } else {
    const el = document.querySelector("#login-error");
    if (el) el.textContent = message;
  }
}
async function refreshWorld() {
  world = await api<World>("/api/world");
}
async function refreshState() {
  const b = await api<{
    player: Player;
    serverTime: string;
    googleLinked: boolean;
  }>("/api/state");
  player = b.player;
  googleLinked = b.googleLinked;
  offset = Date.parse(b.serverTime) - Date.now();
}
async function refreshPage() {
  if (!player) return;
  try {
    await refreshState();
    if (["online", "leaderboard", "market", "rivals"].includes(page))
      await refreshWorld();
    if (page === "history") events = (await api("/api/events")).events;
    render();
  } catch (e) {
    error((e as Error).message);
  }
}
async function act(kind: string, id = "", extra: Record<string, unknown> = {}) {
  if (busy) return;
  if (sessionStorage.getItem("mto_pending")) {
    error("Retry your saved move before starting another.");
    return;
  }
  busy = true;
  const input = {
    ...extra,
    ...(id ? { id } : {}),
    ...(kind === "activity" ? { approach } : {}),
    ...(kind === "train" ? { stat: id } : {}),
    ...(kind === "travel" ? { region: id } : {}),
    ...(kind === "challenge" ? { target: id } : {}),
  };
  const payload = {
    kind,
    input,
    key: crypto.randomUUID(),
    account: player!.id,
  };
  sessionStorage.setItem("mto_pending", JSON.stringify(payload));
  await sendAction(payload);
}
async function sendAction(payload: unknown) {
  try {
    const r = await api("/api/action", payload);
    sessionStorage.removeItem("mto_pending");
    player = r.player;
    offset = Date.parse(r.serverTime) - Date.now();
    lastResult = r;
    if (["market", "rivals"].includes(page)) await refreshWorld();
    busy = false;
    render();
  } catch (e) {
    busy = false;
    const status = (e as { status?: number }).status;
    if (status && status < 500) sessionStorage.removeItem("mto_pending");
    render();
    error((e as Error).message + (status ? "" : " — action saved for retry."));
  }
}
app.addEventListener("click", async (e) => {
  const b = (e.target as Element).closest<HTMLElement>("button,a");
  if (!b) return;
  if (b.dataset.category) {
    openCategory =
      openCategory === b.dataset.category ? null : b.dataset.category;
    menuOpen = false;
    render();
    return;
  }
  if (b.hasAttribute("data-category-back")) {
    openCategory = null;
    render();
    return;
  }
  if (b.dataset.characterTab) {
    if (b.dataset.characterTab === "wallet")
      events = (await api("/api/events")).events;
    showCharacter(b.dataset.characterTab);
    return;
  }
  if (b.hasAttribute("data-retry")) {
    const pending = sessionStorage.getItem("mto_pending");
    if (pending) {
      const saved = JSON.parse(pending);
      if (saved.account === player!.id) {
        busy = true;
        await sendAction(saved);
      } else sessionStorage.removeItem("mto_pending");
    }
    return;
  }
  if (b.hasAttribute("data-menu")) {
    menuOpen = !menuOpen;
    render();
    return;
  }
  if (b.hasAttribute("data-character")) {
    showCharacter();
    return;
  }
  if (b.hasAttribute("data-close")) {
    document.querySelector<HTMLDialogElement>("#character")?.close();
    return;
  }
  if (b.hasAttribute("data-dismiss")) {
    lastResult = null;
    render();
    return;
  }
  if (b.dataset.approach) {
    approach = b.dataset.approach;
    localStorage.setItem("mto_approach", approach);
    render();
    return;
  }
  if (b.dataset.tier) {
    tier = Number(b.dataset.tier);
    render();
    return;
  }
  if (b.hasAttribute("data-logout")) {
    try {
      await api("/api/logout", {});
      sessionStorage.removeItem("mto_pending");
      player = null;
      render();
    } catch (err) {
      error((err as Error).message);
    }
    return;
  }
  if (b.dataset.list) {
    const d = document.querySelector<HTMLDialogElement>("#character")!;
    d.innerHTML = `<div class="panel-title"><h2>LIST A PLAYER</h2><button data-close aria-label="Close">×</button></div><form id="listing" class="compact-form" data-player="${b.dataset.list}"><label>Asking price (£)<input name="amount" type="number" step="1" min="1" max="1000000000" required></label><p class="small muted">The player leaves your available squad until the listing sells or you withdraw it.</p><button class="action">Create listing</button></form>`;
    d.showModal();
    return;
  }
  if (b.dataset.action) {
    if (b.dataset.action === "sellPlayer") {
      const asset = player!.squad.find((x) => x.id === b.dataset.id)!;
      const d = document.querySelector<HTMLDialogElement>("#character")!;
      d.innerHTML = `<div class="panel-title"><h2>RELEASE PLAYER</h2><button data-close aria-label="Close">×</button></div><div class="compact-form"><p>Release ${esc(asset.name)} for ${money(asset.value)}? The player leaves your squad permanently.</p><button class="action" data-confirm-release="${asset.id}">Release player</button></div>`;
      d.showModal();
      return;
    }
    await act(b.dataset.action, b.dataset.id);
    return;
  }
  if (b.dataset.confirmRelease) {
    document.querySelector<HTMLDialogElement>("#character")?.close();
    await act("sellPlayer", b.dataset.confirmRelease);
  }
});
app.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const fields = Object.fromEntries(new FormData(form));
  try {
    if (form.id === "signup") {
      const button = form.querySelector("button")!;
      button.disabled = true;
      try {
        await api("/api/test-account", fields);
        await loadGame();
      } finally {
        button.disabled = false;
      }
    } else if (form.id === "profile") {
      await api("/api/profile", fields);
      await refreshState();
      render();
    } else if (form.id === "bank") {
      await act(
        (e as SubmitEvent).submitter?.getAttribute("value") || "deposit",
        "",
        { amount: Number(fields.amount) },
      );
    } else if (form.id === "listing") {
      document.querySelector<HTMLDialogElement>("#character")?.close();
      await act("listPlayer", form.dataset.player, {
        amount: Number(fields.amount),
      });
    }
  } catch (err) {
    error((err as Error).message);
  }
});
window.addEventListener("hashchange", () => {
  openCategory = null;
  page = location.hash.slice(1) || "office";
  menuOpen = false;
  lastResult = null;
  void refreshPage();
});
function updateTimers() {
  if (!player) return;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() + offset - Date.parse(player.energyAt)) / 1000),
  );
  const energy = Math.min(100, player.energy + Math.floor(elapsed / 60) * 2);
  document
    .querySelectorAll("[data-energy-next]")
    .forEach(
      (el) =>
        (el.textContent =
          energy === 100 ? "Full energy" : `+2 in ${60 - (elapsed % 60)}s`),
    );
  const bar = document.querySelector<HTMLProgressElement>("progress");
  if (bar) bar.value = energy;
  document
    .querySelectorAll<HTMLButtonElement>("[data-cooldown]")
    .forEach((b) => {
      const key = b.dataset.cooldown!,
        s = seconds(key);
      b.textContent = s ? duration(s) : b.dataset.label!;
      const a = catalog.activities.find((x) => x.id === key);
      b.disabled =
        busy ||
        s > 0 ||
        (a
          ? energy < a.energy || player!.cash < a.cost
          : key === "training"
            ? energy < 10 || player!.cash < 20
            : key === "travel"
              ? player!.cash < 50
              : key === "challenge"
                ? energy < 15
                : false);
    });
  document
    .querySelectorAll("[data-cash]")
    .forEach((el) => (el.textContent = money(player!.cash)));
  document
    .querySelectorAll("[data-bank]")
    .forEach((el) => (el.textContent = money(player!.bank)));
  document
    .querySelectorAll("[data-energy]")
    .forEach((el) => (el.textContent = `${energy} / 100`));
}
setInterval(updateTimers, 1000);
setInterval(async () => {
  if (!player || document.visibilityState !== "visible" || busy) return;
  try {
    await refreshState();
    updateTimers();
    const energy = document.querySelector<HTMLProgressElement>("progress");
    if (energy) energy.value = player!.energy;
  } catch {}
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && player) void refreshPage();
});
async function loadGame() {
  await refreshState();
  await refreshWorld();
  render();
  const pending = sessionStorage.getItem("mto_pending");
  if (pending) {
    const saved = JSON.parse(pending);
    if (saved.account === player!.id) {
      busy = true;
      await sendAction(saved);
    } else sessionStorage.removeItem("mto_pending");
  }
}
async function init() {
  try {
    [config, catalog] = await Promise.all([
      api("/api/config"),
      api("/api/catalog"),
    ]);
    try {
      await loadGame();
    } catch (e) {
      if ((e as { status?: number }).status === 401) renderLogin();
      else throw e;
    }
  } catch (e) {
    renderLogin();
    error((e as Error).message);
  }
}
void init();
