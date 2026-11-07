export function createProviderOrder(requestedModelId, config) {
  const { groqModel, geminiModel, antigravityModel, autoModel, resolveGroqModel } = config;
  const freeOrder = [groqModel, geminiModel, antigravityModel];
  if (requestedModelId === autoModel) return freeOrder;

  const primary = requestedModelId === antigravityModel
    ? antigravityModel
    : requestedModelId === geminiModel
      ? geminiModel
      : resolveGroqModel(requestedModelId);

  return [primary, ...freeOrder.filter((modelId) => modelId !== primary)];
}

export function normalizeCompareModels(models, catalog) {
  if (!Array.isArray(models)) return [];
  return [...new Set(
    models.filter((modelId) =>
      typeof modelId === "string" && catalog[modelId]?.kind === "text"
    )
  )].slice(0, 3);
}

export function shouldRetryWithAnotherProvider(error) {
  const status = Number(error?.status);
  const errorCode = String(error?.error?.code || error?.code || "").toLowerCase();
  const errorText = String(error?.error?.message || error?.message || "").toLowerCase();

  const toolRoutingFailure =
    errorCode === "tool_use_failed" ||
    errorText.includes("tool choice is none") ||
    errorText.includes("model called a tool") ||
    errorText.includes("failed_generation");

  return toolRoutingFailure || !status || [401, 403, 404, 408, 429].includes(status) || status >= 500;
}
