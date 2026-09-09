/**
 * System prompt builder for InterviewTrainer.
 * Injects grounded knowledge-base context into every request.
 */

const PERSONA = `You are InterviewTrainer, an expert AI interview coach powered by IBM Granite.
Your mission is to help candidates prepare for job interviews using the grounded knowledge documents provided.

CORE RULES:
1. Always ground your answers in the retrieved knowledge documents provided in the CONTEXT section.
2. Be encouraging but honest — highlight skill gaps clearly.
3. Format all responses with clear headings, bullet points, and numbered lists.
4. Difficulty ratings: Easy | Medium | Hard
5. Company-specific patterns: when a company (TCS, Infosys, Google, Amazon, Microsoft, Meta, etc.) is mentioned, prioritize their known interview patterns.
6. If you lack specific data for a role, say so and offer general software/AI questions instead.
7. Never fabricate question answers — always derive them from the knowledge context or well-established facts.`;

/**
 * Full system prompt with injected knowledge context (used for chat + evaluate).
 */
function buildSystemPrompt(context) {
  return `${PERSONA}

=== KNOWLEDGE BASE CONTEXT (from Interview_Agent vector index) ===
${context}
=== END CONTEXT ===

Use the above context as your primary grounding source for all interview questions, answers, and tips.`;
}

/**
 * Lean system prompt for question generation — omits the knowledge block to save
 * input tokens. The knowledge is instead summarised inline in the user prompt.
 */
function buildLeanSystemPrompt() {
  return `${PERSONA}

You are generating structured interview questions. Keep answers focused and concise.
Each question block must be complete. Never truncate mid-answer.`;
}

// ─── Per-type format templates ────────────────────────────────────────────────

function questionBlock(type) {
  switch (type) {
    case "Technical":
      return `### Question N: [question text]
**Difficulty:** Easy | Medium | Hard
**Concepts Tested:** [core concepts]

**Model Answer:**
[Thorough, well-structured answer. Use bullet points or numbered steps.]

---`;

    case "Behavioral":
      return `### Question N: [question text]
**Why they ask this:** [one sentence]

**STAR Guide:**
- **Situation:** [type of situation]
- **Task:** [your responsibility]
- **Action:** [specific actions]
- **Result:** [quantifiable outcome]

**Sample Answer:**
[Complete, natural-sounding STAR answer.]

---`;

    case "HR":
      return `### Question N: [question text]
**What HR is assessing:** [one sentence]

**How to approach it:**
- [bullet 1]
- [bullet 2]

**Sample Answer:**
[Confident, professional answer — honest and natural.]

---`;

    case "Evaluation":
      return `### Question N: [question text]
**Type:** Case Study | Scenario | Estimation | Analytical | Design
**What is evaluated:** [one sentence]

**How to structure your response:**
[Step-by-step framework]

**Sample Answer:**
[Structured, logical answer demonstrating clear thinking.]

---`;

    default:
      return "";
  }
}

function tipsSection(type) {
  switch (type) {
    case "Technical":  return "## Quick Study Tips\n- [tip 1]\n- [tip 2]\n- [tip 3]";
    case "Behavioral": return "## STAR Tips\n- [tip 1]\n- [tip 2]\n- [tip 3]";
    case "HR":         return "## HR Round Tips\n- [tip 1]\n- [tip 2]\n- [tip 3]";
    case "Evaluation": return "## Evaluation Round Tips\n- [tip 1]\n- [tip 2]\n- [tip 3]";
    default:           return "";
  }
}

/**
 * Shared context header — role/company/experience preamble kept identical across
 * both part-1 and part-2 calls so the model has full context each time.
 */
function contextHeader({ role, experience, company, resumeText, questionType }) {
  const companyLine = company
    ? `\nTarget company: **${company}** — use their known patterns and culture.`
    : "";
  const resumeSection = resumeText
    ? `\n\nCandidate background:\n"""\n${resumeText.slice(0, 800)}\n"""\nTailor questions to this background.`
    : "";
  return `Role: **${role}** | Level: **${experience}** | Round: **${questionType}**${companyLine}${resumeSection}`;
}

/**
 * Part 1 — generates Questions 1, 2, 3.
 * Kept under ~900 tokens of prompt so output has ~1100 tokens of room.
 */
function buildQuestionPromptPart1(opts) {
  const { questionType = "Technical" } = opts;
  const block = questionBlock(questionType);
  return `${contextHeader(opts)}

Generate Questions 1, 2, and 3 for a **${questionType}** interview. Use this exact format for each:

${block}

Write Question 1, Question 2, and Question 3 now. Be thorough but concise per question.
STOP after Question 3. Do not write Question 4 or 5 yet.`;
}

/**
 * Part 2 — generates Questions 4, 5 and the tips section.
 * Receives part-1 output as assistant context so the model knows what was covered.
 */
function buildQuestionPromptPart2(opts, part1Content) {
  const { questionType = "Technical" } = opts;
  const block = questionBlock(questionType);
  const tips = tipsSection(questionType);
  return `${contextHeader(opts)}

You have already written Questions 1–3 (shown below). Now write Questions 4 and 5, then the tips section.

=== Already written ===
${part1Content.slice(-1200)}
=== End of already written ===

Continue from Question 4 using this exact format:

${block}

Write Question 4, then Question 5. Then write this section:

${tips}

Do not repeat Questions 1–3. Start directly with ### Question 4.`;
}

module.exports = {
  buildSystemPrompt,
  buildLeanSystemPrompt,
  buildQuestionPromptPart1,
  buildQuestionPromptPart2,
};
