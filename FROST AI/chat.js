(() => {
  "use strict";

  const SUPPORT_MESSAGE =
    "Taking a break doesn't mean giving up on a project you've been working toward for hours, days, or even years. Your friends and family will always be proud of you! ❤️🥹";

  const SIGNATURE =
    "— Sincerely, the FrOsTAI Team.\nThank you for using our Chat AI. We are very grateful!";

  // Do not add emotional-support messaging to academic or task-focused help.
  const TASK_HELP_PATTERNS = [
    /\b(?:math|mathematics|algebra|geometry|calculus|equation|arithmetic)\b/i,
    /\b(?:homework|worksheet|schoolwork|exam|quiz|assignment|calculate|solve for|show your work)\b/i,
    /\b(?:coding|programming|debug|script|javascript|python|luau|roblox studio|error message)\b/i,
    /\b(?:how do i|how to|can you help me|explain|what is|what are)\b/i
  ];

  // First-person phrases help avoid reacting to unrelated mentions of sadness.
  const SUPPORT_PATTERNS = [
    /\b(?:i['’]?m|i am|i feel|i['’]?ve been feeling|feeling)\s+(?:(?:really|so|pretty|a little|kinda|kind of)\s+)?(?:sad|down|upset|lonely|alone|overwhelmed|discouraged|stressed|hurt)\b/i,
    /\bi(?:'m| am) having a hard time\b/i,
    /\bi(?:'m| am) having a rough day\b/i,
    /\bi(?:'m| am) struggling\b/i,
    /\bi need (?:some )?(?:encouragement|support)\b/i
  ];

  function needsEncouragement(message) {
    if (typeof message !== "string") return false;
    const text = message.trim();

    if (!text || TASK_HELP_PATTERNS.some(pattern => pattern.test(text))) {
      return false;
    }

    return SUPPORT_PATTERNS.some(pattern => pattern.test(text));
  }

  function formatReply(userMessage, aiReply) {
    if (typeof aiReply !== "string" || !aiReply.trim()) return aiReply;

    let result = aiReply.trim();

    if (needsEncouragement(userMessage)) {
      result += "\n\n" +
        "I'm sorry things feel difficult right now. You don't have to figure everything out all at once. Take things one step at a time. ❤️\n\n" +
        SUPPORT_MESSAGE;

      // The team sign-off belongs only to genuine emotional-support replies.
      if (!/Sincerely, the FrOsTAI Team/i.test(result)) {
        result += "\n\n" + SIGNATURE;
      }
    }

    return result;
  }

  window.FROSTGPTSupport = Object.freeze({
    needsEncouragement,
    formatReply
  });
})();
