export const MAX_HISTORY_REQUEST_BYTES = 4 * 1024 * 1024;

export function parseHistoryPayload(rawBody) {
  if (typeof rawBody !== "string") {
    return { ok: false, status: 400, error: "Invalid history payload." };
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_HISTORY_REQUEST_BYTES) {
    return { ok: false, status: 413, error: "Chat history is too large to sync. Please reduce the number or size of saved chats." };
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "Invalid history payload." };
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.chats)) {
    return { ok: false, status: 400, error: "A chats array is required." };
  }

  return { ok: true, body };
}

export function normalizeHistoryTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : Date.now();
  const selected = Number.isFinite(timestamp) && Math.abs(timestamp) <= 8640000000000000
    ? timestamp
    : safeFallback;
  const date = new Date(selected);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
