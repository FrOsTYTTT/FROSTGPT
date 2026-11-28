const ALLOWED_HOSTNAMES = new Set([
  "www.frostai.fs.kg",
  "frostai.fs.kg",
  "frostgptai.pages.dev"
]);

export async function onRequestPost({ request, env }) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return Response.json({ success: false, error: "Security verification is not configured." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return Response.json({ success: false, error: "Invalid request." }, {
      status: 415, headers: { "Cache-Control": "no-store" }
    });
  }

  let body;
  try { body = await request.json(); }
  catch {
    return Response.json({ success: false, error: "Invalid request." }, {
      status: 400, headers: { "Cache-Control": "no-store" }
    });
  }

  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || token.length > 2048) {
    return Response.json({ success: false, error: "A valid security token is required." }, {
      status: 400, headers: { "Cache-Control": "no-store" }
    });
  }

  const formData = new FormData();
  formData.append("secret", env.TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) formData.append("remoteip", remoteIp);

  let verification;
  try {
    const upstream = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: formData
    });
    if (!upstream.ok) throw new Error("Turnstile verification request failed.");
    verification = await upstream.json();
  } catch (error) {
    console.error("FROSTGPT: Turnstile service request failed.", error);
    return Response.json({ success: false, error: "Security verification is temporarily unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" }
    });
  }

  const hostname = typeof verification?.hostname === "string" ? verification.hostname.toLowerCase() : "";
  const valid = verification?.success === true && ALLOWED_HOSTNAMES.has(hostname);
  if (!valid) {
    return Response.json({ success: false, error: "Security verification failed." }, {
      status: 403, headers: { "Cache-Control": "no-store" }
    });
  }

  return Response.json({ success: true }, {
    status: 200,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}
