import { JSDOM } from "jsdom";
import { transform } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import assert from "node:assert/strict";
import worker from "../server/worker";
const DATABASE_URL = readFileSync(".env.integration", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)![1];
const env = {
  DATABASE_URL,
  ENVIRONMENT: "test",
  ALLOW_TEST_ACCOUNTS: "true",
  ASSETS: { fetch: async () => new Response("asset") },
} as any;
const origin = "https://takes-over.test";
const signup = await worker.fetch(
  new Request(origin + "/api/test-account", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-MTO-Request": "1",
    },
    body: JSON.stringify({
      name: "Visual Test Manager",
      club: "Touchline United",
    }),
  }),
  env,
);
assert.equal(signup.status, 200);
let cookie = signup.headers.get("set-cookie")!.split(";")[0];
const dom = new JSDOM(
  '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./game.css"></head><body><div id="app"></div></body></html>',
  { url: origin, runScripts: "outside-only", pretendToBeVisual: true },
);
(dom.window as any).fetch = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set("Cookie", cookie);
  if (options.method === "POST") headers.set("Origin", origin);
  return worker.fetch(new Request(origin + path, { ...options, headers }), env);
};
const source = readFileSync("src/main.ts", "utf8").replace(
  /import ["']\.\/style\.css["'];/,
  "",
);
// JSDOM has no native modal implementation; model only the open/close state.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
const js = await transform(source, {
  loader: "ts",
  format: "iife",
  target: "es2022",
});
dom.window.eval(js.code);
async function waitFor(fn: () => boolean) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 90000)
      throw Error("Client did not reach expected state");
    await new Promise((r) => setTimeout(r, 100));
  }
}
await waitFor(() => !!dom.window.document.querySelector(".activity-row"));
const d = dom.window.document;
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("PASS", name);
}
check("beginner office renders exactly two working activity buttons", () => {
  assert.equal(d.querySelectorAll('[data-action="activity"]').length, 2);
  assert.match(d.body.textContent!, /Deliver Flyers/);
  assert.match(d.body.textContent!, /Community Coaching/);
});
check(
  "header persists cash, rank and energy with no hidden progression leak",
  () => {
    assert.match(d.querySelector("header")!.textContent!, /Scum/);
    assert.match(d.querySelector("header")!.textContent!, /£250/);
    assert.doesNotMatch(d.body.textContent!, /\bXP\b|\bExperience\b|750,000/);
  },
);
check("higher office tiers show rank locks instead of enabled actions", () => {
  (d.querySelector('[data-tier="2"]') as HTMLElement).click();
  assert.equal(d.querySelectorAll('[data-action="activity"]').length, 0);
  assert.match(d.querySelector(".activity-row")!.textContent!, /Pee Wee/);
  (d.querySelector('[data-tier="1"]') as HTMLElement).click();
});
check("mobile menu has real category destinations", () => {
  (d.querySelector("[data-menu]") as HTMLElement).click();
  assert.ok(d.querySelector(".sidebar.is-open"));
  assert.ok(d.querySelector('a[href="#market"]'));
  (d.querySelector("[data-menu]") as HTMLElement).click();
});
mkdirSync("evidence", { recursive: true });
copyFileSync("src/style.css", "evidence/game.css");
copyFileSync("public/fonts.css", "evidence/fonts.css");
copyFileSync("public/crest.svg", "evidence/crest.svg");
let html = dom.serialize().replaceAll('src="/crest.svg"', 'src="./crest.svg"');
writeFileSync("evidence/office-desktop.html", html);
// All client requests below hit the real Worker handlers and verification database.
(
  d.querySelector('[data-action="activity"][data-id="flyers"]') as HTMLElement
).click();
await waitFor(() => !!d.querySelector(".result"));
check(
  "clicking an activity receives a saved server result and a live cooldown",
  () => {
    assert.match(d.querySelector(".result")!.textContent!, /Deliver Flyers/);
    assert.ok(
      (d.querySelector('[data-id="flyers"]') as HTMLButtonElement).disabled,
    );
    assert.ok(
      !(d.querySelector('[data-id="coaching"]') as HTMLButtonElement).disabled,
    );
  },
);
dom.window.location.hash = "bank";
await waitFor(() => !!d.querySelector("#bank"));
const before = Number(
  d.querySelector(".stat-grid strong")!.textContent!.replace(/[^0-9]/g, ""),
);
const amount = d.querySelector('input[name="amount"]') as HTMLInputElement;
amount.value = "50";
const submit = d.querySelector(
  '#bank button[value="deposit"]',
) as HTMLButtonElement;
d.querySelector("#bank")!.dispatchEvent(
  new dom.window.SubmitEvent("submit", {
    bubbles: true,
    cancelable: true,
    submitter: submit,
  }),
);
await waitFor(
  () => !!d.querySelector(".result")?.textContent?.includes("Deposited"),
);
check("bank form updates persisted cash through the real backend", () => {
  assert.equal(
    Number(
      d.querySelector(".stat-grid strong")!.textContent!.replace(/[^0-9]/g, ""),
    ),
    before - 50,
  );
});
for (const route of [
  "scouting",
  "recruitment",
  "squad",
  "training",
  "club",
  "shop",
  "travel",
  "campaign",
  "profile",
  "guide",
  "history",
  "market",
  "rivals",
  "leaderboard",
  "online",
]) {
  dom.window.location.hash = route;
  await waitFor(
    () =>
      d.querySelector(".breadcrumb")?.textContent?.includes(
        (
          {
            scouting: "Talent Scouts",
            recruitment: "Recruitment",
            squad: "My Squad",
            training: "Training Centre",
            club: "Club Development",
            shop: "Kit & Equipment",
            travel: "Transit Hub",
            campaign: "Road to Legend",
            profile: "My Manager",
            guide: "Game Guide",
            history: "Club News",
            market: "Transfer Market",
            rivals: "Rival Challenges",
            leaderboard: "Hall of Fame",
            online: "Managers Online",
          } as Record<string, string>
        )[route],
      ) === true,
  );
  check(`${route} route renders a functional destination`, () =>
    assert.ok(d.querySelector("main h1")),
  );
}
check("mobile categories open a compact destination menu", () => {
  d.querySelector<HTMLButtonElement>('[data-category="Campaign"]')!.click();
  assert.equal(d.querySelectorAll(".submenu-links a").length, 7);
  d.querySelector<HTMLButtonElement>("[data-category-back]")!.click();
  assert.equal(d.querySelector(".mobile-submenu"), null);
});
d.querySelector<HTMLButtonElement>("[data-character]")!.click();
for (const tab of [
  "items",
  "players",
  "skills",
  "bank",
  "perks",
  "character",
]) {
  d.querySelector<HTMLButtonElement>(`[data-character-tab="${tab}"]`)!.click();
  check(`manager ${tab} tab stays inside the open file`, () => {
    assert.equal(d.querySelector<HTMLDialogElement>("#character")!.open, true);
    assert.ok(
      d.querySelector(".character-panel")!.textContent!.trim().length > 0,
    );
    assert.equal(
      d
        .querySelector(`[data-character-tab="${tab}"]`)!
        .getAttribute("aria-pressed"),
      "true",
    );
  });
}
console.log(
  `${passed} client DOM checks passed against real backend. Native visual review is separate.`,
);
dom.window.close();
