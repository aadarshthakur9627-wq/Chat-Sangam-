import test from "node:test";
import assert from "node:assert/strict";
import {
  createProviderOrder,
  normalizeCompareModels,
  shouldRetryWithAnotherProvider,
} from "../lib/ai/routing.mjs";

const config = {
  groqModel: "groq-default",
  geminiModel: "gemini-flash",
  antigravityModel: "antigravity",
  autoModel: "auto-free",
  resolveGroqModel: (model) => model === "groq-vision" ? model : "groq-default",
};

test("auto routing tries configured providers in the established order", () => {
  assert.deepEqual(createProviderOrder("auto-free", config), [
    "groq-default", "gemini-flash", "antigravity",
  ]);
});

test("direct Gemini selection stays first and preserves fallback order", () => {
  assert.deepEqual(createProviderOrder("gemini-flash", config), [
    "gemini-flash", "groq-default", "antigravity",
  ]);
});

test("unknown direct model IDs resolve to the safe default model", () => {
  assert.deepEqual(createProviderOrder("untrusted-model", config), [
    "groq-default", "gemini-flash", "antigravity",
  ]);
});

test("comparison accepts only unique, explicitly catalogued text models", () => {
  const catalog = {
    "groq-a": { kind: "text" },
    "groq-b": { kind: "text" },
    "vision-only": { kind: "vision" },
  };
  assert.deepEqual(
    normalizeCompareModels(["groq-a", "untrusted", "vision-only", "groq-a", "groq-b"], catalog),
    ["groq-a", "groq-b"],
  );
});

test("comparison is bounded to three models and rejects non-arrays", () => {
  const catalog = Object.fromEntries(["a", "b", "c", "d"].map((id) => [id, { kind: "text" }]));
  assert.deepEqual(normalizeCompareModels(["a", "b", "c", "d"], catalog), ["a", "b", "c"]);
  assert.deepEqual(normalizeCompareModels(null, catalog), []);
});

test("retry policy retries transient/provider failures but not ordinary client errors", () => {
  assert.equal(shouldRetryWithAnotherProvider({ status: 429 }), true);
  assert.equal(shouldRetryWithAnotherProvider({ status: 503 }), true);
  assert.equal(shouldRetryWithAnotherProvider({ status: 400 }), false);
  assert.equal(shouldRetryWithAnotherProvider({ code: "tool_use_failed", status: 400 }), true);
});
