import { verifyFirebaseIdentity } from "../_shared/safety.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Pragma": "no-cache"
    }
  });
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function requireUser(request) {
  const identity = await verifyFirebaseIdentity(request);
  return identity?.uid || null;
}

export async function onRequest({ request, env }) {
  if (!env.SAFETY_DB) return json({ error: "Developer key storage is not configured." }, 503);
  const userId = await requireUser(request);
  if (!userId) return json({ error: "Your sign-in session expired. Please sign in again." }, 401);

  if (request.method === "GET") {
    const result = await env.SAFETY_DB.prepare(
      "SELECT id, name, key_prefix, created_at, last_used_at, revoked_at FROM developer_api_keys WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(userId).all();
    return json({ keys: result.results || [] });
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 40) return json({ error: "Enter a key name between 1 and 40 characters." }, 400);

    const count = await env.SAFETY_DB.prepare(
      "SELECT COUNT(*) AS total FROM developer_api_keys WHERE user_id = ? AND revoked_at IS NULL"
    ).bind(userId).first();
    if (Number(count?.total || 0) >= 10) return json({ error: "You can have up to 10 active API keys. Revoke one before creating another." }, 409);

    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const secret = "frost_sk_" + bytesToHex(random);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    const hash = bytesToHex(new Uint8Array(digest));
    const id = crypto.randomUUID();
    const prefix = secret.slice(0, 16);

    await env.SAFETY_DB.prepare(
      "INSERT INTO developer_api_keys (id, user_id, name, key_prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
    ).bind(id, userId, name, prefix, hash).run();

    // The plaintext secret is returned exactly once and is never logged or stored.
    return json({ key: secret, id, name, key_prefix: prefix }, 201);
  }

  if (request.method === "DELETE") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
    if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return json({ error: "A valid API key ID is required." }, 400);
    }
    const result = await env.SAFETY_DB.prepare(
      "UPDATE developer_api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND revoked_at IS NULL"
    ).bind(body.id, userId).run();
    if (!result.meta?.changes) return json({ error: "Active API key not found." }, 404);
    return json({ revoked: true, id: body.id });
  }

  return json({ error: "Method not allowed." }, 405);
}
