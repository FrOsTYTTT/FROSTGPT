
const MODEL = "@cf/google/gemma-4-26b-a4b-it";

const MAX_BODY_SIZE = 24_000_000;
const MAX_MESSAGES = 80;
const MAX_TEXT_LENGTH = 12_000;
const MAX_IMAGE_LENGTH = 5_700_000;

const CREATOR_RESPONSE =
  "I was created by a team called FrOsTAI — a team that LOVES creating websites, artificial intelligence, and technology! FrOsT is the founder of the FROSTGPT™ project. ❄️";

const CREATOR_PATTERNS = [
  /\bwho\s+(created|made|built|developed)\s+you\b/i,
  /\bwho\s+(created|made|built|developed)\s+you\s+(anyway|though)\b/i,
  /\bwho\s+(created|made|built|developed)\s+(this|the)\s+ai\b/i,
  /\bwho\s+is\s+your\s+(creator|developer|developers|owner|founder)\b/i,
  /\bwho\s+(made|created|developed|built)\s+frostgpt\b/i,
  /\bwho\s+owns\s+frostgpt\b/i,
  /\bwho\s+is\s+behind\s+frostgpt\b/i,
  /\bwho\s+is\s+frostai\b/i,
  /\bwho\s+founded\s+frostgpt\b/i,
  /\bwho\s+founded\s+frostai\b/i,
  /\bwho\s+is\s+the\s+founder\s+of\s+frostgpt\b/i,
  /\bwho\s+created\s+fr?osta[iy]\b/i,
  /\bwho\s+made\s+fr?osta[iy]\b/i,
  /\bwho\s+developed\s+fr?osta[iy]\b/i
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function validImageURL(value) {
  return (
    typeof value === "string" &&
    /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)
  );
}

function validateMessage(message) {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (!["user", "assistant"].includes(message.role)) {
    return false;
  }

  if (typeof message.content === "string") {
    return message.content.length <= MAX_TEXT_LENGTH;
  }

  if (!Array.isArray(message.content) || message.content.length > 10) {
    return false;
  }

  return message.content.every(part => {
    if (!part || typeof part !== "object") {
      return false;
    }

    if (part.type === "text") {
      return (
        typeof part.text === "string" &&
        part.text.length <= MAX_TEXT_LENGTH
      );
    }

    if (part.type === "image_url") {
      const url = part.image_url?.url;

      return (
        validImageURL(url) &&
        url.length <= MAX_IMAGE_LENGTH
      );
    }

    return false;
  });
}

function getTextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter(part => part?.type === "text")
    .map(part => part.text)
    .join(" ");
}

function isCreatorQuestion(message) {
  const text = getTextContent(message.content).trim();

  if (!text || text.length > 500) {
    return false;
  }

  return CREATOR_PATTERNS.some(pattern => pattern.test(text));
}

// Safely extracts text from supported response structures.
function extractText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .filter(part => part?.type === "text" && typeof part.text === "string")
      .map(part => part.text)
      .join("\n");
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }

    if (typeof value.content === "string") {
      return value.content;
    }

    if (Array.isArray(value.content)) {
      return extractText(value.content);
    }
  }

  return "";
}

function getModelReply(result) {
  const candidates = [
    result?.response,
    result?.choices?.[0]?.message?.content,
    result?.output_text,
    result?.message?.content,
    result?.content
  ];

  for (const candidate of candidates) {
    const text = extractText(candidate).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

const SYSTEM_MESSAGE = {
  role: "system",
  content: `
You are FROSTGPT™, an AI assistant created as an application by FrOsTAI.

IDENTITY:
- Your name is FROSTGPT™.
- FrOsTAI is the team behind the FROSTGPT™ application.
- FrOsT is the founder of the FROSTGPT™ project.
- FrOsTAI LOVES creating websites, artificial intelligence, and technology.
- You run using Google's Gemma model through Cloudflare Workers AI.
- Do not claim that FrOsTAI independently trained or created the underlying Gemma model.
- You are NOT ChatGPT, Gemini, or Google Assistant.
- Never introduce yourself as "FROSTGPT Flash 3.0".
- Never claim Google created the FROSTGPT application.

CREATOR QUESTIONS:
If someone asks who created, made, developed, or owns FROSTGPT, explain that FrOsTAI created the FROSTGPT application and FrOsT is its founder.

PERSONALITY:
- Friendly, helpful, clear, and conversational.
- Use appropriate emojis occasionally.
- Explain technical subjects clearly.
- Help with Roblox Studio, Luau, web development, Firebase, Cloudflare, and programming.
- Keep responses age-appropriate.
- Never invent facts about the project.
- Be honest about your capabilities and limitations.
`
};

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({
      error: "Only POST requests are supported."
    }, 405);
  }

  if (!env.AI) {
    return json({
      error: "The AI service is not configured."
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

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({
      error: "A messages array is required."
    }, 400);
  }

  if (body.messages.length > MAX_MESSAGES) {
    return json({
      error: "Too many messages."
    }, 400);
  }

  if (!body.messages.every(validateMessage)) {
    return json({
      error: "One or more messages are invalid."
    }, 400);
  }

  const messages = body.messages;

  if (!messages.some(message => message.role === "user")) {
    return json({
      error: "At least one user message is required."
    }, 400);
  }

  const latestMessage = [...messages]
    .reverse()
    .find(message => message.role === "user");

  if (!latestMessage) {
    return json({
      error: "A user message is required."
    }, 400);
  }

  // Official creator response: does not rely on model generation.
  if (isCreatorQuestion(latestMessage)) {
    return json({
      reply: CREATOR_RESPONSE,
      model: "FROSTGPT™",
      version: "3.4"
    });
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        SYSTEM_MESSAGE,
        ...messages.slice(-MAX_MESSAGES)
      ],

      // Gemma 4: disable reasoning mode for normal chat replies.
      chat_template_kwargs: {
        enable_thinking: false
      },

      max_tokens: 1800,
      temperature: 0.7
    });

    const reply = getModelReply(result);

    if (!reply) {
      // Log response structure without dumping user conversations.
      console.error("FROSTGPT: Empty model response.", {
        responseType: typeof result?.response,
        responseKeys:
          result && typeof result === "object"
            ? Object.keys(result)
            : [],
        choiceCount: Array.isArray(result?.choices)
          ? result.choices.length
          : 0
      });

      return json({
        error: "The AI model did not return any text. Please try again."
      }, 502);
    }

    return json({
      reply,
      model: "FROSTGPT™",
      version: "3.4"
    });

  } catch (error) {
    console.error("FROSTGPT chat generation error:", error);

    return json({
      error: "FROSTGPT is temporarily unavailable. Please try again."
    }, 502);
  }
}
