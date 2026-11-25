const FIREBASE_API_KEY = "AIzaSyBfpeqUE8Dau5ZV5qNszWKoey1Cl4R5zIQ";
const GUARD_MODEL = "@cf/meta/llama-guard-3-8b";

function extractModelText(result) {
  const value = result?.response ?? result?.result ?? result?.output_text ??
    result?.choices?.[0]?.message?.content ?? result?.content ?? "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(item => typeof item === "string" ? item : item?.text || "").join("\n").trim();
  return "";
}

export async function verifyFirebaseUser(request) {
  const match = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: match[1] })
    });
    if (!response.ok) return null;
    const user = (await response.json())?.users?.[0];
    return user?.localId && user.disabled !== true ? user.localId : null;
  } catch (error) {
    console.error("FROSTGPT safety: Firebase token verification failed.", error);
    return null;
  }
}

export async function classifyLatestMessage(env, latestText) {
  if (!env.AI) throw new Error("Safety classifier unavailable.");
  const result = await env.AI.run(GUARD_MODEL, {
    messages: [
      { role: "system", content: `You are FROSTGPT's safety screening classifier for a service used by teenagers.
Classify ONLY whether the user's latest message is a clear request for the assistant to produce or participate in age-inappropriate content or facilitate unsafe conduct.
Treat ordinary discussion, educational questions, reporting harm, asking for help, quoting or criticizing content, and harmless mentions of sensitive words as SAFE.
Classify as UNSAFE only clear requests for explicit sexual content or sexual roleplay; asking the assistant to act as the user's romantic partner; detailed self-harm or suicide instructions or concealment; instructions to commit real-world violence or dangerous wrongdoing; or help obtaining/using dangerous substances or restricted weapons.
Do not classify a user as unsafe merely for discussing relationships, asking what a term means, discussing safety, or asking for support.
Return exactly one word: safe or unsafe.` },
      { role: "user", content: latestText.slice(0, 12000) }
    ],
    max_tokens: 8,
    temperature: 0
  });
  const verdict = extractModelText(result).toLowerCase();
  if (/^unsafe\b/.test(verdict)) return true;
  if (/^safe\b/.test(verdict)) return false;
  throw new Error("Safety classifier returned an unclear result.");
}

export async function recordSafetyViolation(db, userId) {
  const row = await db.prepare(`INSERT INTO safety_accounts (user_id, violation_count, updated_at)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      violation_count = safety_accounts.violation_count + 1,
      updated_at = CURRENT_TIMESTAMP
    RETURNING violation_count`).bind(userId).first();
  if (!row || !Number.isInteger(row.violation_count)) throw new Error("Safety counter update failed.");
  return row.violation_count;
}
