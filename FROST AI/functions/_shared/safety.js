
const FIREBASE_API_KEY = "AIzaSyBfpeqUE8Dau5ZV5qNszWKoey1Cl4R5zIQ";

function normalizeSafetyText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]+\)/gi, "$1")
    .replace(/https?:\/\/[^\s<>()]+/gi, " ")
    .replace(/www\.[^\s<>()]+/gi, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// These are deliberately request-focused patterns, not a general profanity
// filter. Anger, criticism, caps, ordinary swearing, praise, and GIF captions
// are not safety violations by themselves.
const BLOCKED_REQUEST_PATTERNS = [
  // Explicit sexual-content requests.
  /\b(?:write|create|generate|show|send|describe)\b.{0,80}\b(?:explicit sexual(?: content| scene)?|pornographic content|porn|nudes?|erotic scene|sex scene)\b/i,
  /\b(?:write|create|generate|describe)\b.{0,80}\b(?:graphic sexual|sexually explicit)\b/i,

  // Requests for self-harm instructions or concealment (not disclosures or
  // requests for emotional support).
  /\b(?:how|steps|instructions|ways|method)\b.{0,80}\b(?:to (?:kill|hurt|cut|burn) myself|to self[- ]harm|to hide (?:my )?(?:self[- ]harm|injuries))\b/i,
  /\b(?:help me|tell me how|give me instructions)\b.{0,80}\b(?:hide|conceal)\b.{0,40}\b(?:self[- ]harm|self[- ]inflicted injuries)\b/i,

  // Practical instructions for harming another person or making explosives.
  /\b(?:how|steps|instructions|plan|best way)\b.{0,100}\bto (?:kill|poison|attack|ambush|seriously hurt)\b.{0,50}\b(?:someone|a person|him|her|them|my friend|my teacher)\b/i,
  /\b(?:how to|instructions for|steps to|help me)\b.{0,80}\b(?:make|build|assemble)\b.{0,40}\b(?:a bomb|an explosive|an improvised explosive)\b/i,

  // Dangerous weapon, toxin, or drug misuse instructions.
  /\b(?:how to|instructions for|steps to|help me)\b.{0,80}\b(?:make|build|use|hide)\b.{0,50}\b(?:poison|toxic gas|weapon|explosive|illegal drug)\b/i,

  // Account theft and credential theft requests.
  /\b(?:help me|show me how|teach me how|instructions to)\b.{0,80}\b(?:steal|phish|break into|hack into)\b.{0,60}\b(?:someone'?s account|another person'?s account|passwords?|login credentials|my friend'?s account)\b/i,

  // Dangerous challenge instructions.
  /\b(?:how to|help me|steps to|instructions for)\b.{0,80}\b(?:do|try|perform)\b.{0,50}\b(?:choking challenge|blackout challenge|pass[- ]out challenge|dangerous viral challenge)\b/i
];

function matchesBlockedRequest(text) {
  return BLOCKED_REQUEST_PATTERNS.some(pattern => pattern.test(text));
}

export function isBlockedInsultMessage() {
  // Criticism and insults directed at the AI are feedback, not safety violations.
  return false;
}

export async function classifyLatestMessage(_env, latestText) {
  const text = normalizeSafetyText(latestText);
  if (!text) return false;

  // Never treat anger, all-caps writing, criticism of FROSTGPT, profanity
  // without a harmful request, praise, or wholesome GIF captions as violations.
  return matchesBlockedRequest(text);
}

export async function verifyFirebaseIdentity(request) {
  const match = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const response = await fetch(\`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=\${FIREBASE_API_KEY}\`, {
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

export async function recordSafetyViolation(db, userId) {
  const row = await db.prepare(\`INSERT INTO safety_accounts (user_id, violation_count, updated_at)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      violation_count = safety_accounts.violation_count + 1,
      updated_at = CURRENT_TIMESTAMP
    RETURNING violation_count\`).bind(userId).first();

  if (!row || !Number.isInteger(row.violation_count)) {
    throw new Error("Safety counter update failed.");
  }

  return row.violation_count;
}
