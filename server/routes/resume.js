/**
 * POST /api/resume/analyze
 * Two-call split:
 *   Call 1 → Resume Analysis + Role Fit Score + 5 Resume-Specific Questions
 *   Call 2 → Vulnerability Areas + 30-Day Prep Plan
 * Stitched server-side so the full output is never truncated.
 */
const express = require("express");
const router = express.Router();
const { chatCompletion } = require("../lib/graniteClient");
const { buildLeanSystemPrompt } = require("../lib/promptBuilder");
const cache = require("../lib/responseCache");

const normalizeText = (str) =>
  String(str ?? "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,!?;:\-_~]+$/g, "");

router.post("/analyze", async (req, res) => {
  try {
    const { resumeText, targetRole = "", company = "" } = req.body;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: "resumeText must be at least 50 characters" });
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = cache.buildKey(normalizeText(targetRole), normalizeText(company), normalizeText(resumeText).slice(0, 400));
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Trim resume to keep input tokens low — 1200 chars ~ 300 tokens
    const resume = resumeText.trim().slice(0, 1200);
    const sysPrompt = buildLeanSystemPrompt();

    const roleClause  = targetRole ? `Target Role: **${targetRole}**\n` : "";
    const coClause    = company    ? `Target Company: **${company}**\n`  : "";
    const resumeBlock = `Resume:\n"""\n${resume}\n"""`;

    // ── Call 1: Analysis + Fit Score + 5 Questions ───────────────────────────
    const prompt1 =
`${roleClause}${coClause}${resumeBlock}

Analyze this resume. Reply in exactly these sections:

## Resume Analysis
- Key strengths (bullet points)
- Technology stack / skills detected
- Experience level assessment

## Role Fit Score: X/10
${targetRole ? `How well does this match the **${targetRole}** role?` : "General fit assessment."}
One or two sentences of reasoning.

## 5 Questions Likely Asked From This Resume
For each question write:
**Q1: [question]**
Why asked: [one sentence]
Model Answer: [concise answer]

(Then Q2, Q3, Q4, Q5 in the same format)`;

    const part1 = await chatCompletion(
      [
        { role: "system", content: sysPrompt },
        { role: "user",   content: prompt1 },
      ],
      { temperature: 0.6, max_tokens: 1800 }
    );

    // ── Call 2: Vulnerabilities + 30-Day Plan ────────────────────────────────
    const prompt2 =
`${roleClause}${coClause}${resumeBlock}

Continue the resume analysis. Reply in exactly these two sections:

## Vulnerability Areas
- Topics the candidate may be weak in based on resume gaps (bullet points)
- One preparation suggestion per gap

## 30-Day Prep Plan
Week 1: [focus area + specific tasks]
Week 2: [focus area + specific tasks]
Week 3: [focus area + specific tasks]
Week 4: [mock interviews + review + final tips]`;

    const part2 = await chatCompletion(
      [
        { role: "system",    content: sysPrompt },
        { role: "user",      content: prompt1 },
        { role: "assistant", content: part1 },
        { role: "user",      content: prompt2 },
      ],
      { temperature: 0.6, max_tokens: 1800 }
    );

    const result = {
      analysis: `${part1.trimEnd()}\n\n${part2.trimStart()}`,
      targetRole: targetRole || null,
      company: company || null,
      grounded: true,
      timestamp: new Date().toISOString(),
    };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[/api/resume/analyze]", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
