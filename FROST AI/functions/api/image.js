
const MODEL = "@cf/black-forest-labs/flux-1-schnell";

const MAX_BODY_SIZE = 32_000;
const MAX_PROMPT_LENGTH = 2048;

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
  if (request.method !== "POST") {
    return json({
      error: "Only POST requests are supported."
    }, 405);
  }

  if (!env.AI) {
    console.error("Workers AI binding AI is unavailable.");

    return json({
      error: "The image generation service is not configured."
    }, 500);
  }

  const contentLength = Number(
    request.headers.get("content-length") || 0
  );

  if (contentLength > MAX_BODY_SIZE) {
    return json({
      error: "Request is too large."
    }, 413);
  }

  let body;

  try {
    const rawBody = await request.text();

    if (rawBody.length > MAX_BODY_SIZE) {
      return json({
        error: "Request is too large."
      }, 413);
    }

    body = JSON.parse(rawBody);
  } catch {
    return json({
      error: "Request body must be valid JSON."
    }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({
      error: "Invalid request body."
    }, 400);
  }

  if (typeof body.prompt !== "string") {
    return json({
      error: "Please enter an image description."
    }, 400);
  }

  const prompt = body.prompt.trim();

  if (!prompt) {
    return json({
      error: "Please enter an image description."
    }, 400);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({
      error: "Image prompts cannot exceed 2048 characters."
    }, 400);
  }

  try {
    const result = await env.AI.run(MODEL, {
      prompt,
      steps: 4
    });

    if (!result || typeof result.image !== "string" || !result.image) {
      console.error("Unexpected image model response.");

      return json({
        error: "The image model did not return an image."
      }, 502);
    }

    const image = result.image.startsWith("data:image/")
      ? result.image
      : `data:image/jpeg;base64,${result.image}`;

    return json({
      image,
      model: "FROSTGPT Image Generator"
    });

  } catch (error) {
    console.error("Image generation error:", error);

    return json({
      error: "Cloudflare image generation failed. Please try again."
    }, 502);
  }
}
