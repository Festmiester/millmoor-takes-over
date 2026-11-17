import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import worker from "../server/worker";
const url = (f: string) =>
  readFileSync(f, "utf8").match(/^DATABASE_URL=(.+)$/m)![1];
const DATABASE_URL = url(".env.integration");
assert.notEqual(
  new URL(DATABASE_URL).hostname,
  new URL(url(".dev.vars.test")).hostname,
);
const env = {
  DATABASE_URL,
  ENVIRONMENT: "test",
  ALLOW_TEST_ACCOUNTS: "true",
  ASSETS: { fetch: async () => new Response("asset") },
} as any;
const origin = "https://takes-over.test";
let cookie = "";
async function fetcher(path: string, options: RequestInit = {}) {
  const h = new Headers(options.headers);
  h.set("Cookie", cookie);
  if (options.method === "POST") {
    h.set("Origin", origin);
    h.set("Content-Type", "application/json");
    h.set("X-MTO-Request", "1");
  }
  return worker.fetch(
    new Request(origin + path, { ...options, headers: h }),
    env,
  );
}
const signup = await fetcher("/api/test-account", {
  method: "POST",
  body: JSON.stringify({
    name: "Campaign UI " + crypto.randomUUID().slice(0, 6),
    club: "Guided UI FC",
  }),
});
assert.equal(signup.status, 200);
cookie = signup.headers.get("set-cookie")!.split(";")[0];
const state = (await (await fetcher("/api/state")).json()) as any;
const sql = neon(DATABASE_URL);
await sql.transaction([
  sql`UPDATE mto_players SET chapter=6,xp=1500 WHERE id=${state.player.id}::uuid`,
  sql`INSERT INTO mto_events(player_id,kind,message) SELECT ${state.player.id}::uuid,'activity','Deliver Flyers completed' FROM generate_series(1,3)`,
  sql`INSERT INTO mto_events(player_id,kind,message) SELECT ${state.player.id}::uuid,'activity','Community Coaching completed' FROM generate_series(1,2)`,
]);
const dom = new JSDOM('<div id="app"></div>', {
  url: origin + "/#campaign",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
(dom.window as any).fetch = fetcher;
const source = readFileSync("src/main.ts", "utf8").replace(
  /import ["']\.\/(?:style|visual-refresh)\.css["'];/g,
  "",
);
const js = await build({
  stdin: { contents: source, loader: "ts", resolveDir: process.cwd() + "/src" },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
});
dom.window.eval(js.outputFiles![0].text);
const d = dom.window.document;
async function wait(fn: () => boolean) {
  const until = Date.now() + 90000;
  while (!fn()) {
    if (Date.now() > until) throw Error("Guided UI timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
}
await wait(() => !!d.querySelector('[data-action="chapter"]'));
assert.match(d.querySelector("header")!.textContent!, /Local Gaffer/);
assert.match(d.body.textContent!, /6 legacy chapter rewards preserved/);
const claim = d.querySelector<HTMLButtonElement>('[data-action="chapter"]')!;
assert.equal(claim.disabled, false);
assert.equal(claim.dataset.id, "1");
console.log(
  "PASS server tutorial state, football rank and preserved legacy progress render",
);
claim.click();
await wait(
  () =>
    d.querySelector('[data-action="chapter"]')?.getAttribute("data-id") === "2",
);
assert.ok((d.querySelector("#action-result") as HTMLDialogElement).open);
const saved = (await (await fetcher("/api/state")).json()) as any;
assert.equal(saved.player.cash, 350);
assert.equal(saved.player.campaignCompleted, 1);
assert.equal(saved.player.chapter, 6);
assert.ok(saved.player.inventory.some((i: any) => i.id === "boots"));
console.log(
  "PASS real chapter claim transitions lesson, grants gear once and preserves account history",
);
dom.window.location.hash = "trading";
await wait(() => d.querySelector("h1")?.textContent === "Merchandise Runs");
assert.match(d.body.textContent!, /Bootlegging guide & town prices/);
assert.match(d.body.textContent!, /Sheffield/);
assert.match(d.body.textContent!, /loaded trip net/);
console.log(
  "PASS merchandise run route planner exposes the bootlegging loop and town prices",
);
dom.window.close();
console.log("3 campaign client workflows passed on verification only.");
