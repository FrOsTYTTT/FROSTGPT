import { verifyFirebaseIdentity } from "../_shared/safety.js";
import { analyzeVideoUrl } from "../_shared/video-links.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Only POST requests are supported." }, 405);
  }

  const identity = await verifyFirebaseIdentity(request);
  if (!identity?.uid) {
    return json({ error: "Please sign in again before analyzing a video link." }, 401);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "The video link request is too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Send a valid video-link request." }, 400);
  }

  if (typeof body?.url !== "string" || body.url.length > 2048) {
    return json({ error: "A valid video URL is required." }, 400);
  }

  const result = await analyzeVideoUrl(body.url);
  return result.error ? json({ error: result.error }, 422) : json(result);
}
