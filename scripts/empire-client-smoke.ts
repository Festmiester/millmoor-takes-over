import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
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
async function request(path: string, body?: unknown, cookie = "") {
  return worker.fetch(
    new Request(origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(body === undefined
          ? {}
          : {
              Origin: origin,
              "Content-Type": "application/json",
              "X-MTO-Request": "1",
            }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}
const cookies: string[] = [];
const ids: string[] = [];
for (const n of [1, 2]) {
  const r = await request("/api/test-account", {
    name: "Empire UI " + crypto.randomUUID().slice(0, 6),
    club: "UI Verification " + n,
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  cookies.push(cookie);
  const s = (await (
    await request("/api/state", undefined, cookie)
  ).json()) as any;
  ids.push(s.player.id);
}
const sql = neon(DATABASE_URL);
await sql`UPDATE mto_players SET xp=2000,cash=10000 WHERE id IN (${ids[0]}::uuid,${ids[1]}::uuid)`;
const dom = new JSDOM('<div id="app"></div>', {
  url: origin + "/#businesses",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
(dom.window as any).fetch = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set("Cookie", cookies[0]);
  if (options.method === "POST") headers.set("Origin", origin);
  return worker.fetch(new Request(origin + path, { ...options, headers }), env);
};
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
  const end = Date.now() + 90000;
  while (!fn()) {
    if (Date.now() > end)
      throw Error(
        "Empire UI did not reach expected state: " +
          d.body.textContent?.slice(-500),
      );
    await new Promise((r) => setTimeout(r, 100));
  }
}
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("PASS", name);
}
function click(selector: string) {
  const el = d.querySelector<HTMLButtonElement>(selector);
  assert.ok(el, selector);
  el.click();
}
function submit(form: HTMLFormElement, submitter?: HTMLButtonElement) {
  form.dispatchEvent(
    new dom.window.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter: submitter || form.querySelector("button")!,
    }),
  );
}
function dismiss() {
  click("[data-dismiss]");
}
await wait(() => !!d.querySelector('[data-action="buyBusiness"]'));
click('[data-action="buyBusiness"][data-id="programmes"]');
await wait(() => !!d.querySelector('[data-action="collectBusiness"]'));
check("business purchase from UI persists and shows modal result", () => {
  assert.ok((d.querySelector("#action-result") as HTMLDialogElement).open);
  assert.match(d.querySelector(".business-row")!.textContent!, /Level 1/);
});
dismiss();
dom.window.location.hash = "trading";
await wait(() => !!d.querySelector(".trade-form"));
const trade = d.querySelector<HTMLFormElement>(".trade-form")!;
(trade.elements.namedItem("quantity") as HTMLInputElement).value = "2";
submit(trade, trade.querySelector<HTMLButtonElement>('[value="buyGoods"]')!);
await wait(() => !!d.querySelector("#action-result .result"));
check(
  "trade form submits integer quantity and updates authoritative inventory",
  () => {
    assert.match(d.querySelector(".empire-row")!.textContent!, /Owned 2/);
    assert.match(
      d.querySelector("[data-trade-timer]")!.textContent!,
      /ready in/i,
    );
  },
);
dismiss();
dom.window.location.hash = "alliance";
await wait(() => !!d.querySelector('[data-empire-kind="createAlliance"]'));
const create = d.querySelector<HTMLFormElement>(
  '[data-empire-kind="createAlliance"]',
)!;
(create.elements.namedItem("name") as HTMLInputElement).value =
  "UI " + crypto.randomUUID().slice(0, 8);
submit(create);
await wait(() => !!d.querySelector('[data-action="leaveAlliance"]'));
check("alliance creation form transitions to saved membership and room", () =>
  assert.ok(d.querySelector('[data-empire-kind="allianceMessage"]')),
);
dismiss();
const world = (await (
  await request("/api/empire", undefined, cookies[0])
).json()) as any;
const aid = world.alliances.find((a: any) => a.joined).id;
async function other(kind: string, input: Record<string, unknown>) {
  const r = await request(
    "/api/action",
    { key: crypto.randomUUID(), kind, input },
    cookies[1],
  );
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
await other("joinAlliance", { id: aid });
const room = d.querySelector<HTMLFormElement>(
  '[data-empire-kind="allianceMessage"]',
)!;
(room.elements.namedItem("body") as HTMLInputElement).value = "UI room message";
submit(room);
await wait(() => !!d.querySelector(".message-row"));
check("alliance room form sends a saved message visible to the partner", () =>
  assert.match(
    d.querySelector(".message-row")!.textContent!,
    /UI room message/,
  ),
);
dismiss();
const partner = (await (
  await request("/api/empire", undefined, cookies[1])
).json()) as any;
assert.ok(partner.messages.some((m: any) => m.body === "UI room message"));
dom.window.location.hash = "ventures";
await wait(() => !!d.querySelector('[data-action="createVenture"]'));
click('[data-action="createVenture"]');
await wait(() => !!d.querySelector('[data-action="readyVenture"]'));
dismiss();
const ready = d.querySelector<HTMLButtonElement>(
  '[data-action="readyVenture"]',
)!;
const vid = ready.dataset.id!;
await other("joinVenture", { id: vid });
await other("readyVenture", { id: vid });
click('[data-action="readyVenture"]');
await wait(
  () => !!d.querySelector('[data-action="resolveVenture"]:not(:disabled)'),
);
dismiss();
click('[data-action="resolveVenture"]');
await wait(() => !d.querySelector('[data-action="resolveVenture"]'));
check(
  "two-manager venture completes through UI with real server costs and cooldowns",
  () => {
    assert.ok((d.querySelector("#action-result") as HTMLDialogElement).open);
    assert.match(
      d.querySelector("#content")!.textContent!,
      /Tournament (succeeded|fell short)/,
    );
  },
);
const final = (await (
  await request("/api/state", undefined, cookies[1])
).json()) as any;
assert.ok(final.player.energy >= 180 && final.player.energy <= 200);
assert.ok(final.player.cooldowns.venture);
dismiss();
const crew = [1, 2, 3].map((n) => ({
  id: crypto.randomUUID(),
  name: "UI Crew " + n,
  position: "MID",
  power: 20,
  value: 200,
  rarity: "Promising",
}));
await sql`UPDATE mto_players SET squad=${JSON.stringify(crew)}::jsonb,cooldowns=cooldowns-'venture',energy=200,energy_at=now() WHERE id=${ids[0]}::uuid`;
dom.window.location.hash = "office";
await wait(() => !!d.querySelector(".activity-row"));
dom.window.location.hash = "ventures";
await wait(() => !!d.querySelector("[data-solo-start]"));
const solo = d.querySelector<HTMLFormElement>(
  '[data-empire-kind="soloVenture"]',
)!;
for (let i = 1; i <= 3; i++)
  (
    solo.elements.namedItem("player" + i) as unknown as { value: string }
  ).value = crew[i - 1].id;
await wait(
  () => !d.querySelector<HTMLButtonElement>("[data-solo-start]")!.disabled,
);
submit(solo);
await wait(
  () =>
    !!d
      .querySelector("#action-result .result")
      ?.textContent?.includes("Squad venture"),
);
check(
  "three-player solo form saves a shared cooldown and recovering crew",
  () => {
    assert.match(
      d.querySelector("[data-venture-clock]")!.textContent!,
      /Ready in/,
    );
    assert.equal(
      d.querySelectorAll('select[name="player1"] option[disabled]').length,
      3,
    );
  },
);
dismiss();
dom.window.location.hash = "board";
await wait(
  () => !!d.querySelector('input[name="title"][value="Touchline chat"]'),
);
const chat = d
  .querySelector<HTMLFormElement>(
    'input[name="title"][value="Touchline chat"]',
  )!
  .closest("form")!;
const body = "UI board " + crypto.randomUUID().slice(0, 8);
(chat.elements.namedItem("body") as HTMLInputElement).value = body;
submit(chat);
await wait(() => !!d.querySelector("#content")?.textContent?.includes(body));
check("whiteboard form saves a local post and renders it as plain text", () =>
  assert.match(d.querySelector("#content")!.textContent!, new RegExp(body)),
);
dismiss();
await sql`UPDATE mto_board_posts SET created_at=now()-interval '1 minute' WHERE author=${ids[0]}::uuid`;
const category = d.querySelector('select[name="category"]') as unknown as {
  value: string;
  form: HTMLFormElement;
};
category.value = "ventures";
const classified = category.form!;
const topicTitle = "UI partners " + crypto.randomUUID().slice(0, 8);
(classified.elements.namedItem("title") as HTMLInputElement).value = topicTitle;
(classified.elements.namedItem("body") as HTMLInputElement).value =
  "Rotherham venture partner wanted";
submit(classified);
await wait(
  () => !!d.querySelector("#content")?.textContent?.includes(topicTitle),
);
check(
  "classified form creates an expandable topic with a working reply form",
  () => {
    const topic = Array.from(d.querySelectorAll("details.board-topic")).find(
      (x) => x.textContent?.includes(topicTitle),
    );
    assert.ok(topic?.querySelector('input[name="parent"]'));
    assert.ok(topic?.querySelector('a[href="#ventures"]'));
  },
);
dom.window.close();
console.log(
  `${passed} empire client workflows passed on verification accounts only.`,
);
