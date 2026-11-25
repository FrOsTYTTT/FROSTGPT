const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs";

export async function onRequestGet({ request, env }) {
  const apiKey = env.GIPHY_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GIF search is not configured. Add the GIPHY_API_KEY secret in Cloudflare Pages." },
      { status: 503 }
    );
  }

  const requestURL = new URL(request.url);
  const search = (requestURL.searchParams.get("search") || "").trim().slice(0, 50);
  const endpoint = search ? "search" : "trending";
  const upstreamURL = new URL(`${GIPHY_API_BASE}/${endpoint}`);

  upstreamURL.searchParams.set("api_key", apiKey);
  upstreamURL.searchParams.set("limit", "24");
  upstreamURL.searchParams.set("rating", "g");
  if (search) upstreamURL.searchParams.set("q", search);

  try {
    const upstream = await fetch(upstreamURL.toString(), {
      headers: { Accept: "application/json" }
    });
    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok || payload?.meta?.status !== 200) {
      const status = upstream.status || payload?.meta?.status || 502;
      return Response.json(
        { error: "GIPHY request failed.", upstreamStatus: status },
        { status: status === 401 || status === 403 || status === 429 ? status : 502 }
      );
    }

    return Response.json(
      { data: Array.isArray(payload.data) ? payload.data : [] },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch {
    return Response.json(
      { error: "Could not connect to GIPHY. Please try again." },
      { status: 502 }
    );
  }
}
