import { verifyFirebaseIdentity } from "../_shared/safety.js";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-wav"
]);

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
    return json({ error: "Only POST requests are supported." }, 405);
  }

  if (!env.AI) {
    return json({ error: "The audio transcription service is not configured." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES + 256 * 1024) {
    return json({ error: "Audio is too large. The limit is 10 MB." }, 413);
  }

  const identity = await verifyFirebaseIdentity(request);
  if (!identity?.uid) {
    return json({ error: "Your sign-in session expired. Please sign in again." }, 401);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "A valid audio upload is required." }, 400);
  }

  const audioFile = form.get("audio");
  if (!(audioFile instanceof File) || audioFile.size < 1) {
    return json({ error: "No microphone audio was received. Please record again." }, 400);
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return json({ error: "Audio is too large. The limit is 10 MB." }, 413);
  }

  const contentType = (audioFile.type || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
    return json({ error: "Unsupported audio format. Please use a browser that can export WebM audio." }, 415);
  }

  try {
    const bytes = new Uint8Array(await audioFile.arrayBuffer());
    const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
      audio: [...bytes],
      task: "transcribe",
      condition_on_previous_text: false
    });

    const text = typeof result?.text === "string"
      ? result.text.trim()
      : typeof result?.transcription_info?.text === "string"
        ? result.transcription_info.text.trim()
        : "";

    return json({
      text: text.slice(0, 16000),
      wordCount: Number.isFinite(result?.word_count) ? result.word_count : null,
      model: "FROSTGPT Audio"
    });
  } catch (error) {
    console.error("FROSTGPT: Audio transcription failed.", error);
    return json({ error: "FROSTGPT could not transcribe the audio. Please try speaking again." }, 502);
  }
}
