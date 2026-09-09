/**
 * POST /api/chat
 * General conversational endpoint — grounded multi-turn chat.
 * Body: { messages: [{role, content}], role?, company? }
 *
 * Token budget:
 *   System prompt (persona + trimmed context) ~600 tokens
 *   Last 6 conversation turns (kept to avoid blowing the window) ~1200 tokens
 *   Output capped at 1800 tokens
 */
const express = require("express");
const router = express.Router();
const { chatCompletion } = require("../lib/graniteClient");
const { retrieveContext } = require("../lib/knowledgeBase");
const { buildSystemPrompt } = require("../lib/promptBuilder");

router.post("/", async (req, res) => {
  try {
    const { messages = [], role = "software engineer", company = "" } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Use last user message as retrieval query
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const query = [lastUserMsg?.content?.slice(0, 300) || "", role, company]
      .filter(Boolean).join(" ");

    const context = await retrieveContext(query, role);
    // Trim context to ~1200 chars to save tokens
    const trimmedContext = context.slice(0, 1200);
    const systemPrompt = buildSystemPrompt(trimmedContext);

    // Keep only the last 6 turns to avoid growing context across a long chat
    const recentMessages = messages
      .filter((m) => m.role !== "system")
      .slice(-6);

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
    ];

    const reply = await chatCompletion(fullMessages, { temperature: 0.7, max_tokens: 1800 });

    res.json({ reply, grounded: true });
  } catch (err) {
    console.error("[/api/chat]", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
