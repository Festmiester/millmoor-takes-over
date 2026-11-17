import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  renderCampaign,
  nextCampaign,
  type CampaignState,
} from "../src/campaign";
const status = {
  version: 2,
  current: 1,
  completed: 0,
  legacyCompleted: 6,
  pendingPlayers: [],
  chapters: [
    {
      id: 1,
      title: "Boots <test>",
      lesson: "Learn & play",
      rankRequired: 0,
      rankName: "Sunday League Dreamer",
      current: true,
      ready: false,
      claimed: false,
      goals: [
        {
          metric: "flyers",
          label: "Flyers",
          route: "office",
          progress: 1,
          target: 3,
          complete: false,
        },
      ],
      reward: {
        cash: 100,
        item: { title: "Boots", slot: "feet", power: 3, duplicateCash: 120 },
        player: null,
      },
    },
  ],
} as CampaignState;
test("guided chapter shows actual criteria, navigation, reward and preserved legacy progress", () => {
  const d = new JSDOM(renderCampaign(status)).window.document;
  assert.match(d.body.textContent!, /6 legacy chapter rewards preserved/);
  assert.equal(d.querySelector("progress")?.value, 1);
  assert.equal(d.querySelector('a[href="#office"]')?.textContent, "Go →");
  assert.equal(
    d.querySelector<HTMLButtonElement>('[data-action="chapter"]')?.disabled,
    true,
  );
  assert.equal(d.querySelector("test"), null);
  assert.match(d.body.textContent!, /Boots.*feet power/);
});
test("ready chapter and reserved player use explicit server-validated ids", () => {
  const d = new JSDOM(
    renderCampaign({
      ...status,
      chapters: [{ ...status.chapters[0], ready: true }],
      pendingPlayers: [
        { chapter: 4, asset: { name: "Reserved Player", power: 8 } },
      ],
    }),
  ).window.document;
  assert.equal(
    d.querySelector<HTMLButtonElement>('[data-action="chapter"]')!.disabled,
    false,
  );
  assert.equal(
    d.querySelector('[data-action="chapter"]')!.getAttribute("data-id"),
    "1",
  );
  assert.equal(
    d
      .querySelector('[data-action="claimCampaignPlayer"]')!
      .getAttribute("data-id"),
    "4",
  );
  assert.match(nextCampaign(status), /Open guide/);
});
