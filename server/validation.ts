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
    kind === "claimDaily" &&
    !["shift", "savings", "profit"].includes(String(input.id))
  )
    throw new GameError("Unknown daily assignment");
  return { key: d.key, kind, input };
}
