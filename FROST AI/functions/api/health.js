import { classifyLatestMessage } from "../_shared/safety.js";

const BUILD_ID = "2026-11-25-audit-1";

export async function onRequestGet({ env }) {
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
  const ok = harmlessPhraseBypass &&
    checks.workersAiBindingConfigured &&
    checks.safetyDatabaseBindingConfigured;

  return Response.json(
    { ok, build: BUILD_ID, checks },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
