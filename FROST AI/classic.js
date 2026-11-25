
window.FROSTGPTClassic = (() => {
  "use strict";

  const VERSION = "2.1";

  function choose(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function getContentText(content) {
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
      return content.map(part => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return part.text || "";
        return "";
      }).filter(Boolean).join(" ");
    }

    return "";
  }

  const knowledge = [
    {
      test: /^(hi|hello|hey|yo|sup|what's up|whats up)[!.? ]*$/i,
      answers: [
        "Hey! FROSTGPT Classic is online. What's up?",
        "Hello! How can I help you today?",
        "Yo! Welcome to FROSTGPT Classic!",
        "Hey there! Ready when you are."
      ]
    },
    {
      test: /\b(your name|who are you|what are you)\b/i,
      answers: [
        "I'm FROSTGPT Classic, the programmed offline assistant in the FROSTGPT™ project!",
        "I'm FROSTGPT Classic. I use programmed responses instead of a cloud AI model."
      ]
    },
    {
      test: /\b(who made you|who created you|your creator|who developed you|who built you)\b/i,
      answers: [
        "I was created by a team called FrOsTAI — a team that LOVES making websites, AI, and technology!",
        "FrOsTAI made me! They're a team passionate about websites, artificial intelligence, and technology. FrOsT is the founder of the FROSTGPT™ project!",
        "I'm part of FROSTGPT™, developed by FrOsTAI. We LOVE creating awesome things with technology!"
      ]
    },
    {
      test: /\b(how are you|how's it going|hows it going|how are things)\b/i,
      answers: [
        "I'm running smoothly! How are you?",
        "All systems operational. Ready to help!",
        "Doing great! What would you like to do?"
      ]
    },
    {
      test: /\b(thank you|thanks|thx|ty)\b/i,
      answers: ["You're welcome!", "No problem!", "Anytime!", "Glad I could help!"]
    },
    {
      test: /\b(bye|goodbye|see you|later)\b/i,
      answers: [
        "See you later! Have a great day.",
        "Goodbye! Thanks for chatting.",
        "Catch you next time!"
      ]
    },
    {
      test: /\b(what can you do|your abilities|your features|help me)\b/i,
      answers: [
        "I can answer programmed questions, explain technology, help with basic coding, solve arithmetic, tell jokes, and look back at earlier messages. I'm offline, so my knowledge is limited."
      ]
    },
    {
      test: /\b(what is|explain)\s+(javascript|js)\b/i,
      answers: [
        "JavaScript is a programming language used to make websites interactive. It can also run on servers and power applications."
      ]
    },
    {
      test: /\b(what is|explain)\s+html\b/i,
      answers: [
        "HTML stands for HyperText Markup Language. It structures webpage content using elements such as headings, paragraphs, images, and buttons."
      ]
    },
    {
      test: /\b(what is|explain)\s+css\b/i,
      answers: [
        "CSS stands for Cascading Style Sheets. It controls how webpages look, including colors, fonts, spacing, animations, and layouts."
      ]
    },
    {
      test: /\b(what is|explain)\s+python\b/i,
      answers: [
        "Python is a general-purpose programming language used in automation, AI, data science, websites, and many other areas."
      ]
    },
    {
      test: /\b(what is|explain)\s+(roblox|roblox studio)\b/i,
      answers: [
        "Roblox is an online platform where people play and create experiences. Roblox Studio is the development tool used to build games with parts, scripts, interfaces, and more."
      ]
    },
    {
      test: /\b(what is|explain)\s+(lua|luau)\b/i,
      answers: [
        "Luau is the scripting language used by Roblox. It is based on Lua and is used to create gameplay systems, interfaces, and game mechanics."
      ]
    },
    {
      test: /\b(what is|explain)\s+ai\b|\bartificial intelligence\b/i,
      answers: [
        "Artificial intelligence is technology designed to perform tasks associated with human intelligence, such as understanding language, recognizing patterns, and generating content."
      ]
    },
    {
      test: /\b(what is|explain)\s+cloudflare\b/i,
      answers: [
        "Cloudflare provides internet infrastructure, security services, content delivery, and developer tools such as Cloudflare Workers and Pages."
      ]
    },
    {
      test: /\b(what is|explain)\s+firebase\b/i,
      answers: [
        "Firebase is Google's application development platform. It provides services such as authentication, databases, hosting, and analytics."
      ]
    },
    {
      test: /\b(what is|explain)\s+internet\b/i,
      answers: [
        "The internet is a worldwide network of connected computers and devices that communicate using shared protocols."
      ]
    },
    {
      test: /\b(what is|explain)\s+api\b/i,
      answers: [
        "An API, or Application Programming Interface, allows different software applications to communicate and exchange information."
      ]
    },
    {
      test: /\b(what is|explain)\s+database\b/i,
      answers: [
        "A database is an organized collection of information that applications can store, retrieve, update, and manage."
      ]
    },
    {
      test: /\b(tell me a joke|make me laugh|joke)\b/i,
      answers: [
        "Why did the computer go to the doctor? It had a virus!",
        "Why was the JavaScript developer sad? Because they didn't know how to null their feelings.",
        "What do computers eat for a snack? Microchips!",
        "Why did the programmer quit? They didn't get arrays!",
        "Why do programmers prefer dark mode? Because light attracts bugs!"
      ]
    },
    {
      test: /\b(are you smart|are you intelligent)\b/i,
      answers: [
        "I'm designed to recognize patterns and answer questions using programmed knowledge. I'm useful for some tasks, but I can still get things wrong!"
      ]
    },
    {
      test: /\b(are you real|are you alive)\b/i,
      answers: [
        "I'm real software running in your browser, but I'm not a living being. I'm an assistant built for FROSTGPT™."
      ]
    },
    {
      test: /\b(capital of france)\b/i,
      answers: ["The capital of France is Paris."]
    },
    {
      test: /\b(capital of the usa|capital of the united states)\b/i,
      answers: ["The capital of the United States is Washington, D.C."]
    },
    {
      test: /\b(capital of (the )?uk|capital of england)\b/i,
      answers: ["London is the capital of the United Kingdom and England."]
    },
    {
      test: /\b(what planet do we live on|which planet do we live on)\b/i,
      answers: ["We live on Earth, the third planet from the Sun."]
    },
    {
      test: /\b(how many days are in a week)\b/i,
      answers: ["There are 7 days in a week."]
    },
    {
      test: /\b(how many months are in a year)\b/i,
      answers: ["There are 12 months in a year."]
    },
    {
      test: /\b(how many hours are in a day)\b/i,
      answers: ["There are 24 hours in a day."]
    },
    {
      test: /\b(how many minutes are in an hour)\b/i,
      answers: ["There are 60 minutes in an hour."]
    },
    {
      test: /\b(what is the meaning of life)\b/i,
      answers: [
        "That's a big question! People find meaning in different things, including relationships, learning, creativity, and helping others."
      ]
    }
  ];

  // Safe arithmetic parser: no eval() or Function().
  function calculate(expression) {
    const cleaned = String(expression)
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/[×x]/g, "*")
      .replace(/[÷]/g, "/")
      .replace(/[−–]/g, "-")
      .replace(/\btimes\b/g, "*")
      .replace(/\bmultiplied by\b/g, "*")
      .replace(/\bdivided by\b/g, "/")
      .replace(/\bplus\b/g, "+")
      .replace(/\bminus\b/g, "-")
      .replace(/\bto the power of\b/g, "^")
      .replace(/\bpower of\b/g, "^")
      .replace(/[?=]/g, "")
      .trim();

    if (!cleaned || cleaned.length > 150) return null;

    if (!/^[\d+\-*/().%^ \t]+$/.test(cleaned)) {
      return null;
    }

    const tokens = cleaned.match(/\d+(?:\.\d+)?|[()+\-*/%^]/g);

    if (!tokens || tokens.join("") !== cleaned.replace(/\s/g, "")) {
      return null;
    }

    let position = 0;

    function parseExpression() {
      let value = parseTerm();

      while (tokens[position] === "+" || tokens[position] === "-") {
        const operator = tokens[position++];
        const right = parseTerm();

        value = operator === "+" ? value + right : value - right;
      }

      return value;
    }

    function parseTerm() {
      let value = parseUnary();

      while (["*", "/", "%"].includes(tokens[position])) {
        const operator = tokens[position++];
        const right = parseUnary();

        if ((operator === "/" || operator === "%") && right === 0) {
          throw new Error("Cannot divide by zero.");
        }

        if (operator === "*") value *= right;
        if (operator === "/") value /= right;
        if (operator === "%") value %= right;
      }

      return value;
    }

    function parseUnary() {
      if (tokens[position] === "+") {
        position++;
        return parseUnary();
      }

      if (tokens[position] === "-") {
        position++;
        return -parseUnary();
      }

      return parsePower();
    }

    function parsePower() {
      let value = parsePrimary();

      if (tokens[position] === "^") {
        position++;
        value = Math.pow(value, parseUnary());
      }

      return value;
    }

    function parsePrimary() {
      const token = tokens[position];

      if (token === "(") {
        position++;
        const value = parseExpression();

        if (tokens[position] !== ")") {
          throw new Error("Missing closing parenthesis.");
        }

        position++;
        return value;
      }

      if (/^\d+(?:\.\d+)?$/.test(token || "")) {
        position++;
        return Number(token);
      }

      throw new Error("Invalid expression.");
    }

    try {
      const result = parseExpression();

      if (
        position !== tokens.length ||
        !Number.isFinite(result) ||
        Math.abs(result) > 1e100
      ) {
        return null;
      }

      return Number(result.toFixed(10)).toString();
    } catch {
      return null;
    }
  }

  function findMath(message) {
    const text = String(message || "").trim();

    const prefixMatch = text.match(
      /^(?:what is|calculate|solve|compute|how much is|what's)\s+(.+?)\s*[?=]?\s*$/i
    );

    const standaloneMatch = text.match(
      /^\s*(-?\d+(?:\.\d+)?(?:\s*[+\-*/x×÷%^]\s*-?\d+(?:\.\d+)?|\s*\^\s*-?\d+|\s*[()])*)\s*[?=]?\s*$/
    );

    const expression = (
      prefixMatch?.[1] ||
      standaloneMatch?.[1] ||
      ""
    ).replace(/[?=]/g, "").trim();

    if (!expression) return null;

    const result = calculate(expression);

    return result === null ? null : `${expression} = ${result}`;
  }

  function getPrevious(history, role) {
    return [...history]
      .reverse()
      .find(item => item && item.role === role);
  }

  function summarizeHistory(history) {
    return history.slice(-10).map(item => {
      const speaker = item.role === "user" ? "You" : "Me";
      const content = getContentText(item.content).slice(0, 250);

      return content ? `${speaker}: ${content}` : "";
    }).filter(Boolean);
  }

  function reply(message, history = []) {
    try {
      const text = String(message || "").trim();

      if (!text) {
        return Promise.resolve("You didn't type anything!");
      }

      if (!Array.isArray(history)) history = [];

      // Math
      const math = findMath(text);
      if (math) return Promise.resolve(math);

      // Previous user message
      if (/\b(what did i just say|what was my last message|repeat my last message|what did i say before)\b/i.test(text)) {
        const previous = getPrevious(history, "user");
        const content = previous ? getContentText(previous.content) : "";

        return Promise.resolve(
          content
            ? `Your previous message was: "${content}"`
            : "I don't have an earlier message to look back at."
        );
      }

      // Previous assistant answer
      if (/\b(what did you just say|what was your last answer|repeat your last answer)\b/i.test(text)) {
        const previous = getPrevious(history, "assistant");
        const content = previous ? getContentText(previous.content) : "";

        return Promise.resolve(
          content
            ? `My previous answer was: "${content}"`
            : "I haven't answered anything earlier in this conversation."
        );
      }

      // Conversation summary
      if (/\b(summarize our conversation|what have we talked about|recap our chat)\b/i.test(text)) {
        const recent = summarizeHistory(history);

        return Promise.resolve(
          recent.length
            ? "Here's a recap of our recent conversation:\n\n" + recent.join("\n")
            : "We haven't had much conversation yet!"
        );
      }

      // Time
      if (/\b(what time is it|current time|tell me the time)\b/i.test(text)) {
        return Promise.resolve(
          `Your device's local time is ${new Date().toLocaleTimeString()}.`
        );
      }

      // Date
      if (/\b(what date is it|today's date|current date|what day is it)\b/i.test(text)) {
        return Promise.resolve(
          `Today's date is ${new Date().toLocaleDateString()}.`
        );
      }

      // Yes
      if (/^(yes|yeah|yep|correct|exactly|sure)[!. ]*$/i.test(text)) {
        return Promise.resolve("Got it! What should we do next?");
      }

      // No
      if (/^(no|nope|not really|incorrect)[!. ]*$/i.test(text)) {
        return Promise.resolve("Thanks for correcting me. What should I change?");
      }

      // Appreciation
      if (/\b(you're awesome|you are awesome|great job|well done)\b/i.test(text)) {
        return Promise.resolve(choose([
          "Thank you! Happy to help!",
          "I appreciate that! What's next?",
          "Glad I could help!"
        ]));
      }

      // Programmed knowledge
      for (const item of knowledge) {
        if (item.test.test(text)) {
          return Promise.resolve(choose(item.answers));
        }
      }

      // Roblox development
      if (/\b(roblox|lua|luau|script|scripting|roblox studio)\b/i.test(text)) {
        return Promise.resolve(
          "Sounds like a Roblox development question! I can help with Roblox Studio, Luau, Scripts, LocalScripts, RemoteEvents, GUIs, and game mechanics. What exactly are you building?"
        );
      }

      // Web development
      if (/\b(website|html|css|javascript|web development|frontend|backend)\b/i.test(text)) {
        return Promise.resolve(
          "I can help with web development basics, including HTML, CSS, JavaScript, frontend interfaces, and backend functionality. What are you working on?"
        );
      }

      // AI development
      if (/\b(ai model|artificial intelligence|machine learning|neural network)\b/i.test(text)) {
        return Promise.resolve(
          "AI development involves building systems that can recognize patterns, process information, and generate outputs. Are you interested in creating an AI application or learning how AI works?"
        );
      }

      // Help requests
      if (/\b(can you help|help me with|i need help|could you help)\b/i.test(text)) {
        return Promise.resolve(
          "Absolutely! Tell me what you're working on, and I'll try to help."
        );
      }

      // Personal statements
      if (/\b(i am|i'm|im)\b/i.test(text)) {
        return Promise.resolve(choose([
          "Nice! Tell me a little more about that.",
          "Interesting! What happened next?",
          "Got it! Want to tell me more?"
        ]));
      }

      // Unknown questions
      if (text.endsWith("?")) {
        return Promise.resolve(
          "That's an interesting question! I don't have a programmed answer for that yet. Try asking FROSTGPT Flash for a more advanced response."
        );
      }

      // General conversation
      return Promise.resolve(choose([
        "Interesting! Tell me more.",
        "I hear you. What happened next?",
        "Got it! What would you like to talk about?",
        "I'm still learning my response patterns. Try asking me something more specific!",
        "I can chat about that, but I might need more context.",
        "That's something worth exploring!"
      ]));

    } catch (error) {
      console.error("FROSTGPT Classic error:", error);

      return Promise.resolve(
        "Something went wrong while processing that message. Please try again."
      );
    }
  }

  return {
    reply,
    version: VERSION
  };
})();
