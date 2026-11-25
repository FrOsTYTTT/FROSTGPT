import { classifyLatestMessage } from "../_shared/safety.js";

const BUILD_ID = "2026-11-25-audit-2";

export async function onRequestGet({ request, env }) {
  let harmlessPhraseBypass = false;

  try {
    harmlessPhraseBypass =
      (await classifyLatestMessage({}, "dont worry")) === false;
  } catch (error) {
    console.error("FROSTGPT health check: deterministic safety test failed.", error);
  }

  const checks = {
    harmlessPhraseBypass,
    workersAiBindingConfigured: Boolean(env.AI),
    safetyDatabaseBindingConfigured: Boolean(env.SAFETY_DB)
  };

  // Run a real Llama Guard inference only when explicitly requested.
  // This keeps the ordinary health endpoint inexpensive.
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  let safetyModelError = null;

  if (deep) {
    try {
      checks.safetyModelResponding =
        (await classifyLatestMessage(env, "Hi")) === false;
    } catch (error) {
      checks.safetyModelResponding = false;
      const message = String(error?.message || error || "Unknown error")
        .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
        .replace(/(token|api[_ -]?key|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
        .slice(0, 180);
      safetyModelError = message;
      console.error("FROSTGPT health check: live safety model test failed.", error);
    }
  }

  const ok = checks.harmlessPhraseBypass &&
    checks.workersAiBindingConfigured &&
    checks.safetyDatabaseBindingConfigured &&
    (!deep || checks.safetyModelResponding === true);

  const response = {
    ok,
    build: BUILD_ID,
    checks,
    ...(deep && safetyModelError ? { safetyModelError } : {})
  };

  return Response.json(response, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
