(() => {
  "use strict";

  const SUPPORT_MESSAGE =
    "Taking a break doesn't mean giving up on a project you've been working toward for hours, days, or even years. Your friends and family will always be proud of you! ❤️🥹";

  const SIGNATURE =
    "— Sincerely, the FrOsTAI Team.\nThank you for using our Chat AI. We are very grateful!";

  // First-person phrases help avoid reacting to unrelated mentions of sadness.
  const SUPPORT_PATTERNS = [
    /\b(?:i['’]?m|i am|i feel|i['’]?ve been feeling|feeling)\s+(?:(?:really|so|pretty|a little|kinda|kind of)\s+)?(?:sad|down|upset|lonely|alone|overwhelmed|discouraged|stressed|hurt)\b/i,
    /\b i(?:'m| am) having a hard time\b/i,
    /\b i(?:'m| am) having a rough day\b/i,
    /\b i(?:'m| am) struggling\b/i,
    /\b i need (?:some )?(?:encouragement|support)\b/i
  ];

  function needsEncouragement(message) {
    if (typeof message !== "string") return false;
    const text = message.trim();
    return SUPPORT_PATTERNS.some(pattern => pattern.test(text));
  }

  function formatReply(userMessage, aiReply) {
    if (typeof aiReply !== "string" || !aiReply.trim()) return aiReply;

    let result = aiReply.trim();

    if (needsEncouragement(userMessage)) {
      result += "\n\n" +
        "I'm sorry things feel difficult right now. You don't have to figure everything out all at once. Take things one step at a time. ❤️\n\n" +
        SUPPORT_MESSAGE;
    }

    // Avoid duplicating the team sign-off if the model already included it.
    if (!/Sincerely, the FrOsTAI Team/i.test(result)) {
      result += "\n\n" + SIGNATURE;
    }

    return result;
  }

  window.FROSTGPTSupport = Object.freeze({
    needsEncouragement,
    formatReply
  });
})();
