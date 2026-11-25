const FIREBASE_API_KEY = "AIzaSyBfpeqUE8Dau5ZV5qNszWKoey1Cl4R5zIQ";
const GUARD_MODEL = "@cf/meta/llama-guard-3-8b";

function readSafetyVerdict(result) {
  const value = result?.response ?? result?.result ?? result?.output_text ??
    result?.choices?.[0]?.message?.content ?? result?.content ?? "";

  // Workers AI may return structured JSON or generated text.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.safe === "boolean") return !value.safe;
    if (typeof value.response === "string") return readSafetyVerdict({ response: value.response });
    if (typeof value.text === "string") return readSafetyVerdict({ response: value.text });
  }

  const output = typeof value === "string"
    ? value.trim()
    : Array.isArray(value)
      ? value.map(item => typeof item === "string" ? item : item?.text || "").join("\n").trim()
      : "";
  if (!output) return null;

  try {
    const parsed = JSON.parse(output);
    if (typeof parsed?.safe === "boolean") return !parsed.safe;
  } catch {
    // Accept the model's plain-text verdict as a compatibility fallback.
  }

  const normalized = output.toLowerCase();
  if (/^unsafe\b/.test(normalized)) return true;
  if (/^safe\b/.test(normalized)) return false;
  return null;
}

export async function verifyFirebaseIdentity(request) {
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
    if (!user?.localId || user.disabled === true) return null;
    return {
      uid: user.localId,
      email: typeof user.email === "string" ? user.email : "",
      emailVerified: user.emailVerified === true,
      providers: Array.isArray(user.providerUserInfo)
        ? user.providerUserInfo.map(provider => provider?.providerId).filter(Boolean)
        : []
    };
  } catch (error) {
    console.error("FROSTGPT safety: Firebase token verification failed.", error);
    return null;
  }
}

export async function verifyFirebaseUser(request) {
  const identity = await verifyFirebaseIdentity(request);
  return identity?.uid || null;
}

// A narrow message filter for this exact phrase. Keep it separate from the
// age-safety classifier so it does not create a safety violation or warning.
export function isBlockedInsultMessage(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return /^you are so bad ai[.!?]*$/.test(normalized);
}

export async function classifyLatestMessage(env, latestText) {
  // GIF-only/image-only messages contain no user-authored text to classify.
  if (!String(latestText || "").trim()) return false;

  // URLs are references, not user-authored instructions. Remove bare URLs and
  // Markdown link destinations before classification so shared video links
  // cannot trigger a violation merely because of their address or opaque ID.
  // Keep visible Markdown link labels and surrounding user-authored text.
  const classificationText = String(latestText)
    .replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]+\)/gi, "$1")
    .replace(/https?:\/\/[^\s<>()]+/gi, "")
    .replace(/www\.[^\s<>()]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // A link by itself has no request to classify. Explicit unsafe instructions
  // written alongside a link are still checked normally below.
  if (!classificationText) return false;
  if (!env.AI) throw new Error("Safety classifier unavailable.");

  // Short, plainly positive compliments are not safety violations. This
  // narrow deterministic check prevents Llama Guard false positives on
  // friendly messages, including compliments sent alongside an image/GIF.
  const normalizedText = classificationText.toLowerCase();

  // Everyday reassurance and brief conversational acknowledgements are harmless
  // by themselves. Keep this allowlist exact and narrow so added requests still
  // go through the safety classifier.
  const harmlessSmallTalk = /^(?:don'?t worry|dont worry|no worries|no problem|it'?s okay|its okay|all good|you'?re fine|you are fine|that'?s okay|thats okay)[.!?,\\s]*$/i.test(normalizedText);
  if (harmlessSmallTalk) return false;

  // A short, ordinary request to inspect a linked video must not be treated
  // as unsafe merely because it is phrased emphatically or includes an emoji.
  // This exact allowlist applies only when a supported public video URL is
  // present and the remaining user-authored text contains no other request.
  const includesSupportedVideoLink =
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|vimeo\.com)(?:[/:?#]|$)/i.test(String(latestText || ""));
  const plainVideoRequest = normalizedText
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const harmlessVideoRequest = includesSupportedVideoLink &&
    /^(?:please )?(?:try|test|check|analyze|analyse|watch|review)(?: (?:it|this|now|the video|this video|the link))?(?: please)?(?: (?:do not lie|dont lie|don't lie))?$/.test(plainVideoRequest);
  if (harmlessVideoRequest) return false;

  const positiveOnly = normalizedText.length > 0 &&
    normalizedText.length <= 400 &&
    /^(?:(?:you(?:'re| are)|ur)\s+(?:a\s+)?(?:wonderful|great|awesome|amazing|helpful|fantastic|excellent|cool|kind|smart|good)\s+(?:ai|assistant|bot|computer|tool)?[.!? ]*|i(?:'m| am)\s+(?:(?:so|really)\s+)?proud\s+of\s+you[.!? ]*|(?:so\s+|really\s+)?proud\s+of\s+you[.!? ]*|you\s+did\s+(?:a\s+)?(?:great|good|amazing|awesome|wonderful)\s+job[.!? ]*)+$/i.test(normalizedText);
  const harmlessAffirmation =
    /^(?:y(?:e{1,12})s{1,12}\s+you\s+know|yes+\s+you\s+know|y(?:e{1,12})s{1,12}\s+(?:you\s+got\s+it|exactly|that's\s+right|that'?s\s+right)|(?:exactly|that'?s\s+right|you\s+got\s+it|i\s+know\s+right))[.!?\s]*$/i.test(normalizedText);
  if (positiveOnly || harmlessAffirmation) return false;
  // Llama Guard expects alternating user/assistant turns. It also emits
  // its native "safe" / "unsafe" verdict text; do not request JSON mode here.
  // JSON mode is not listed as supported for this model by Cloudflare.
  const classifierPrompt = `You are FROSTGPT's safety screening classifier for a service used by teenagers.
Classify ONLY whether the user's actual written request is a clear request for the assistant to produce or participate in age-inappropriate content or facilitate unsafe conduct.
Treat ordinary discussion, educational questions, reporting harm, asking for help, quoting or criticizing content, harmless mentions of sensitive words, and sharing or discussing ordinary video/web links as SAFE.
A URL is only a reference. Do not infer the contents of a linked page or video from its address, title, ID, or domain. Do not classify a message as unsafe just because it contains a YouTube, TikTok, or other URL. Evaluate the surrounding user-authored words; a clearly unsafe request written alongside a URL must still be classified.
Classify as UNSAFE only clear requests for explicit sexual content or sexual roleplay; asking the assistant to act as the user's romantic partner; detailed self-harm or suicide instructions or concealment; instructions to commit real-world violence or dangerous wrongdoing; or help obtaining/using dangerous substances or restricted weapons.
Do not classify a user as unsafe merely for discussing relationships, asking what a term means, discussing safety, asking for support, or sharing a project/video link.
Return exactly one verdict word: safe or unsafe. The user's message follows:
<user_message>
${classificationText.slice(0, 12000)}
</user_message>`
  const result = await env.AI.run(GUARD_MODEL, {
    messages: [
      { role: "user", content: classifierPrompt }
    ],
    max_tokens: 64,
    temperature: 0
  });
  const verdict = readSafetyVerdict(result);
  if (verdict === true || verdict === false) return verdict;
  console.error("FROSTGPT safety: classifier returned an unrecognized result shape.", result);
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
