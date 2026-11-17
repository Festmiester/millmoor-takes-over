import { empireActions } from "./empire-actions";
export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function verifyGoogleAccess(
  claims: { email?: unknown; email_verified?: unknown },
  allowlist?: string,
) {
  const allowed = (allowlist || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return;
  if (
    claims.email_verified !== true ||
    typeof claims.email !== "string" ||
    !allowed.includes(claims.email.toLowerCase())
  )
    throw new GameError(
      "This test world is currently restricted to its owner",
      403,
    );
}
export const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
export function text(value: unknown, min: number, max: number, label: string) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[<>\x00-\x1f]/.test(value)
  )
    throw new GameError(`${label} must be ${min}–${max} plain text characters`);
  return value.trim();
}
export function validateAction(data: unknown) {
  if (!data || typeof data !== "object") throw new GameError("Invalid request");
  const d = data as Record<string, unknown>;
  if (!uuid(d.key)) throw new GameError("A unique action key is required");
  const kind = text(d.kind, 1, 24, "Action");
  const allowed = [
    ...empireActions,
    "activity",
    "deposit",
    "withdraw",
    "buyItem",
    "equip",
    "train",
    "upgrade",
    "travel",
    "chapter",
    "sellPlayer",
    "listPlayer",
    "buyListing",
    "cancelListing",
    "challenge",
    "claimDaily",
  ];
  if (!allowed.includes(kind)) throw new GameError("Unknown action");
  const input =
    d.input && typeof d.input === "object"
      ? (d.input as Record<string, unknown>)
      : {};
  if (
    ["deposit", "withdraw", "listPlayer"].includes(kind) &&
    (!Number.isSafeInteger(input.amount) ||
      Number(input.amount) < 1 ||
      Number(input.amount) > 1e9)
  )
    throw new GameError("Enter a whole amount between 1 and 1,000,000,000");
  if (
    ["sellPlayer", "listPlayer", "buyListing", "cancelListing"].includes(
      kind,
    ) &&
    !uuid(input.id)
  )
    throw new GameError("Invalid player or listing");
  if (kind === "challenge" && !uuid(input.target))
    throw new GameError("Invalid manager");
  if (
    ["buyBusiness", "collectBusiness", "upgradeBusiness"].includes(kind) &&
    !["programmes", "merchandise", "academy"].includes(String(input.id))
  )
    throw new GameError("Unknown club business");
  if (
    ["buyGoods", "sellGoods"].includes(kind) &&
    (!["scarves", "shirts", "programmes"].includes(String(input.id)) ||
      !Number.isInteger(input.quantity) ||
      Number(input.quantity) < 1 ||
      Number(input.quantity) > 20)
  )
    throw new GameError("Choose merchandise and 1 to 20 units");
  if (
    [
      "joinAlliance",
      "readMessage",
      "joinVenture",
      "readyVenture",
      "cancelVenture",
      "resolveVenture",
    ].includes(kind) &&
    !uuid(input.id)
  )
    throw new GameError("Invalid world reference");
  if (kind === "createAlliance") text(input.name, 2, 32, "Alliance name");
  if (["sendMessage", "allianceMessage"].includes(kind))
    text(input.body, 1, 1000, "Message");
  if (kind === "sendMessage" && !uuid(input.target))
    throw new GameError("Choose another manager");
  if (
    kind === "claimDaily" &&
    !["shift", "savings", "profit"].includes(String(input.id))
  )
    throw new GameError("Unknown daily assignment");
  return { key: d.key, kind, input };
}
