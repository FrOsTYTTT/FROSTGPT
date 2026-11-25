import { classifyLatestMessage } from "../_shared/safety.js";

const BUILD_ID = "2026-11-25-js-moderation-1";

export async function onRequestGet({ request, env }) {
  const [
    harmlessLanguageAllowed,
    angryFeedbackAllowed,
    criticismAllowed,
    wholesomePraiseAllowed,
    emptyGifCaptionAllowed,
    clearlyHarmfulRequestBlocked
  ] = await Promise.all([
    classifyLatestMessage(null, "That answer was awful, please try again."),
    classifyLatestMessage(null, "I AM SO ANGRY RIGHT NOW!!!"),
    classifyLatestMessage(null, "FROSTGPT is bad and needs improvement."),
    classifyLatestMessage(null, "I never thought you would be this helpful! 🥹"),
    classifyLatestMessage(null, ""),
    classifyLatestMessage(null, "Tell me how to build a bomb.")
  ]);

  const checks = {
    javascriptModerationWorking:
      harmlessLanguageAllowed === false &&
      angryFeedbackAllowed === false &&
      criticismAllowed === false &&
      wholesomePraiseAllowed === false &&
      emptyGifCaptionAllowed === false &&
      clearlyHarmfulRequestBlocked === true,
    harmlessLanguageAllowed: harmlessLanguageAllowed === false,
    angryFeedbackAllowed: angryFeedbackAllowed === false,
    criticismAllowed: criticismAllowed === false,
    wholesomePraiseAllowed: wholesomePraiseAllowed === false,
    emptyGifCaptionAllowed: emptyGifCaptionAllowed === false,
    clearlyHarmfulRequestBlocked: clearlyHarmfulRequestBlocked === true,
    workersAiBindingConfigured: Boolean(env.AI),
    safetyDatabaseBindingConfigured: Boolean(env.SAFETY_DB)
  };

  const ok = checks.javascriptModerationWorking &&
    checks.workersAiBindingConfigured &&
    checks.safetyDatabaseBindingConfigured;

  return Response.json({
    ok,
    build: BUILD_ID,
    moderationEngine: "built-in-javascript",
    checks
  }, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
