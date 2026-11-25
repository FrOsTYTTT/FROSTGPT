import { verifyFirebaseUser, classifyLatestMessage, recordSafetyViolation } from "../_shared/safety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Only POST requests are supported." }, 405);
  if (!env.SAFETY_DB) return json({ error: "Safety storage is not configured." }, 503);

  const userId = await verifyFirebaseUser(request);
  if (!userId) return json({ error: "Your sign-in session expired. Please sign in again." }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!body || typeof body.message !== "string" || !body.message.trim() ||
      body.message.length > 12000 ||
      typeof body.conversationId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(body.conversationId)) {
    return json({ error: "A valid message and conversation ID are required." }, 400);
  }

  let unsafe;
  try {
    unsafe = await classifyLatestMessage(env, body.message.trim());
  } catch (error) {
    console.error("FROSTGPT: Safety classification failed.", error);
    return json({ error: "The safety check is temporarily unavailable. Please try again." }, 503);
  }

  if (!unsafe) return json({ safe: true });

  let violationCount;
  try {
    violationCount = await recordSafetyViolation(env.SAFETY_DB, userId);
  } catch (error) {
    console.error("FROSTGPT: Safety counter update failed.", error);
    return json({ error: "The safety counter could not be saved. Please try again." }, 503);
  }

  if (violationCount >= 21) {
    return json({
      safe: false,
      action: "delete_conversation",
      violationCount,
      reply: "Your account has reached 21 qualifying safety violations. This conversation will be deleted; your account and other conversations will remain."
    });
  }

  const warning = violationCount === 11
    ? " This is your safety warning: the current conversation will be deleted if the account reaches 21 qualifying violations."
    : "";
  return json({
    safe: false,
    action: "refused",
    violationCount,
    reply: "I can't help with that request. Please keep the conversation safe and appropriate." + warning
  });
}
