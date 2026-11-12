import test from "node:test";
import assert from "node:assert/strict";
import { MAX_HISTORY_REQUEST_BYTES, parseHistoryPayload, normalizeHistoryTimestamp } from "../lib/history/validation.mjs";

test("accepts a valid chats payload", () => {
  const result = parseHistoryPayload(JSON.stringify({ chats: [{ id: "chat-1" }] }));
  assert.equal(result.ok, true);
  assert.equal(result.body.chats.length, 1);
});

test("rejects malformed JSON and invalid payload shapes", () => {
  assert.equal(parseHistoryPayload("{").status, 400);
  assert.equal(parseHistoryPayload(JSON.stringify({ chats: {} })).status, 400);
  assert.equal(parseHistoryPayload(JSON.stringify([])).status, 400);
});

test("rejects oversized history payloads before parsing", () => {
  const oversized = " ".repeat(MAX_HISTORY_REQUEST_BYTES + 1);
  const result = parseHistoryPayload(oversized);
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
});

test("normalizes invalid timestamps using a safe fallback", () => {
  assert.equal(normalizeHistoryTimestamp("not-a-date", 0), new Date(0).toISOString());
  assert.equal(normalizeHistoryTimestamp(1000), new Date(1000).toISOString());
});

test("accepts bounded explicit deleted chat IDs", () => {
  const result = parseHistoryPayload(JSON.stringify({
    chats: [],
    deletedChatIds: ["chat-1", "chat-2"],
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.body.deletedChatIds, ["chat-1", "chat-2"]);
});

test("rejects invalid deleted chat IDs", () => {
  assert.equal(parseHistoryPayload(JSON.stringify({ chats: [], deletedChatIds: "chat-1" })).status, 400);
  assert.equal(parseHistoryPayload(JSON.stringify({ chats: [], deletedChatIds: [""] })).status, 400);
  assert.equal(parseHistoryPayload(JSON.stringify({ chats: [], deletedChatIds: ["x".repeat(101)] })).status, 400);
  assert.equal(parseHistoryPayload(JSON.stringify({ chats: [], deletedChatIds: Array.from({ length: 201 }, (_, i) => String(i)) })).status, 400);
});
