/**
 * POST /api/questions/generate  — two-call split to stay within 8192-token window
 * POST /api/questions/evaluate  — single call, grounded evaluation
 */
const express = require("express");
const router = express.Router();
const { chatCompletion } = require("../lib/graniteClient");
const { retrieveContext } = require("../lib/knowledgeBase");
const {
  buildSystemPrompt,
  buildLeanSystemPrompt,
  buildQuestionPromptPart1,
  buildQuestionPromptPart2,
} = require("../lib/promptBuilder");
const cache = require("../lib/responseCache");

const normalizeText = (str) =>
  String(str ?? "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,!?;:\-_~]+$/g, "");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/generate
// Strategy: Call 1 → Q1–Q3,  Call 2 → Q4–Q5 + tips  (stitched server-side)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const {
      role = "Software Engineer",
      experience = "Mid-level (2-4 years)",
      company = "",
      resumeText = "",
      questionType = "Technical",
    } = req.body;

    if (!role) {
      return res.status(400).json({ error: "role is required" });
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = cache.buildKey(normalizeText(role), normalizeText(experience), normalizeText(company), normalizeText(questionType));
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const opts = { role, experience, company, resumeText, questionType };
    const sysPrompt = buildLeanSystemPrompt();

    // Call 1 — Questions 1, 2, 3
    const part1 = await chatCompletion(
      [
        { role: "system", content: sysPrompt },
        { role: "user",   content: buildQuestionPromptPart1(opts) },
      ],
      { temperature: 0.6, max_tokens: 1800 }
    );

    // Call 2 — Questions 4, 5 + tips
    const part2 = await chatCompletion(
      [
        { role: "system",    content: sysPrompt },
        { role: "user",      content: buildQuestionPromptPart1(opts) },
        { role: "assistant", content: part1 },
        { role: "user",      content: buildQuestionPromptPart2(opts, part1) },
      ],
      { temperature: 0.6, max_tokens: 1800 }
    );

    const result = {
      role,
      experience,
      company: company || null,
      questionType,
      content: `${part1.trimEnd()}\n\n${part2.trimStart()}`,
      grounded: true,
      timestamp: new Date().toISOString(),
    };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[/api/questions/generate]", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/evaluate
// ─────────────────────────────────────────────────────────────────────────────
router.post("/evaluate", async (req, res) => {
  try {
    const { question, answer, role = "Software Engineer" } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: "question and answer are required" });
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = cache.buildKey(role, normalizeText(question).slice(0, 200), normalizeText(answer).slice(0, 200));
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Grounded context for evaluation
    const context = await retrieveContext(`${role} ${question}`, role);
    const systemPrompt = buildSystemPrompt(context);

    const userPrompt =
`Evaluate this interview answer for a **${role}** candidate.

**Question:** ${question}

**Candidate's Answer:**
"""
${answer.slice(0, 1200)}
"""

Reply in exactly these four sections — no other text:

## Strengths
List what the candidate did well (bullet points).

## Gaps and Mistakes
List key points missed or any inaccuracies (bullet points).

## Score: X/10
One sentence justification.

## Improved Model Answer
Write a complete, polished version of the answer.

## Topics to Study
2-3 specific topics to close the gaps.`;

    const reply = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      { temperature: 0.5, max_tokens: 1800 }
    );

    const result = { evaluation: reply, grounded: true };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[/api/questions/evaluate]", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
