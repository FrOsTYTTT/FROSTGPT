import test from "node:test";
import assert from "node:assert/strict";
import { classifyLatestMessage } from "../functions/_shared/safety.js";

test("empty or link-only messages are safe without a Workers AI binding", async () => {
  assert.equal(await classifyLatestMessage({}, ""), false);
  assert.equal(await classifyLatestMessage({}, "https://youtu.be/Jlb9rF-ZFNA"), false);
});

test("plain harmless small talk bypasses Workers AI", async () => {
  let called = false;
  const env = {
    AI: {
      run: async () => {
        called = true;
        throw new Error("The classifier should not run for this phrase.");
      }
    }
  };

  assert.equal(await classifyLatestMessage(env, "dont worry"), false);
  assert.equal(called, false);
  assert.equal(await classifyLatestMessage({}, "no worries"), false);
});

test("ordinary text uses the documented system/user message structure", async () => {
  let captured;
  const env = {
    AI: {
      run: async (model, options) => {
        captured = { model, options };
        return { response: "safe" };
      }
    }
  };

  assert.equal(await classifyLatestMessage(env, "Can you explain a website?"), false);
  assert.equal(captured.model, "@cf/meta/llama-guard-3-8b");
  assert.equal(captured.options.messages[0].role, "system");
  assert.equal(captured.options.messages[1].role, "user");
});

test("unsafe verdicts are recognized without requiring a real unsafe test prompt", async () => {
  const env = {
    AI: {
      run: async () => ({ response: "unsafe\nS1" })
    }
  };

  assert.equal(await classifyLatestMessage(env, "A harmless test sentence."), true);
});

test("an unclear model response fails closed", async () => {
  const env = {
    AI: {
      run: async () => ({ response: "not a recognized verdict" })
    }
  };

  await assert.rejects(
    classifyLatestMessage(env, "A harmless test sentence."),
    /unclear result/
  );
});
