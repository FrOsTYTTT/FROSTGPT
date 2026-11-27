(() => {
  "use strict";

  const SUPPORT_MESSAGE =
    "I'm sorry you're feeling this way. Would you like to tell me what's going on? ❤️";

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
      // Keep the support add-on short, natural, and free of unrelated project references.
      if (!/i'm sorry|i am sorry|would you like to talk/i.test(result)) {
        result += "\n\n" + SUPPORT_MESSAGE;
      }
    }

    return result;
  }

  window.FROSTGPTSupport = Object.freeze({
    needsEncouragement,
    formatReply
  });
})();
