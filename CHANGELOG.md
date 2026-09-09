# InterviewTrainer — Development Changelog

> A full record of every problem encountered during the build of this project, how each was diagnosed, what was changed to fix it, and how each version evolved from the last.

---

## Version History Overview

| Version | Description |
|---|---|
| v1.0 | Initial build — full-stack scaffold, IBM Granite integration, 4-tab SPA |
| v1.1 | UI redesign + question type dropdown (Technical / Behavioral / HR / Evaluation) |
| v1.2 | Gradient background applied, warm cream palette |
| v1.3 | Token truncation fix (two-call split), emoji replaced with inline SVGs |
| v1.4 | Critical bug fixes — missing imports, resume and chat token budget overflows |
| v1.5 | In-memory response cache — token savings on generate, evaluate, and resume routes |

---

## v1.0 — Initial Build

### What was built
- Express.js backend with IBM Granite (`ibm/granite-4-h-small`) integration via `POST /ml/v1/text/chat?version=2023-05-29`
- IBM IAM token authentication with auto-refresh (5-minute safety buffer before expiry)
- Watson Discovery vector index (`Interview_Agent`) query module with built-in fallback knowledge for Software Engineer, Data Scientist, Frontend, Backend roles
- Four REST API endpoints: `/api/chat`, `/api/questions/generate`, `/api/questions/evaluate`, `/api/resume/analyze`
- Single-page front-end with four tabs: Generate Questions, Resume Analyzer, Answer Evaluator, AI Coach Chat
- Dark theme UI (charcoal/navy palette)
- Markdown rendering via `marked.js`
- `package.json` with `express`, `axios`, `cors`, `dotenv`, `multer`, `nodemon`

### Problems in v1.0
- The "Generate Interview Pack" prompt asked for 5 technical questions + 3 behavioral + improvement tips + readiness assessment all in one single API call — too much content for a single output window
- The model consistently stopped mid-way through section 2 (behavioral questions), leaving the response incomplete
- Dark theme felt cold and clinical — did not create a calm, encouraging environment for a stressed job candidate
- No way to choose what type of questions to generate; everything was bundled into one output

---

## v1.1 — UI Redesign + Question Type Dropdown

### Problems identified
1. **Incomplete generation** — The single prompt requesting 5 technical + 3 behavioral + tips + assessment was hitting the `max_new_tokens` ceiling. The model was generating approximately 700 words / ~4900 characters and stopping abruptly mid-sentence inside the behavioral section.
2. **No focus control** — Users had no way to say "I only want HR questions" or "just give me Evaluation / case study questions." Everything was mixed.
3. **UI felt AI-generated** — The dark theme, all-caps labels, and emoji-heavy headers gave the impression of a developer tool, not a coaching product.

### Changes made

#### Front-end (`public/index.html`, `public/style.css`, `public/app.js`)
- Complete palette overhaul — switched from dark (`#0f1117`) to light warm tones (`#f5f4f0`, `#ffffff`, `#f9f8f5`)
- Labels changed from ALL-CAPS to sentence case with subtle weight hierarchy
- Tab navigation redesigned — bordered pill container, active tab shows accent-coloured text instead of filled block
- Panel headers gained an `eyebrow` label (small uppercase category line above the title)
- Result box gained a header bar showing question type badge + role + company context
- Chat bubbles redesigned — assistant messages as white cards, user messages as solid accent blue
- Status bar gained a left-side dot indicator + model info on the right
- **Added Question Type dropdown** to the Generate Questions tab with four options:
  - Technical — coding, data structures, system design
  - Behavioral — STAR format, soft skills, team dynamics
  - HR — salary, culture fit, career goals, motivation
  - Evaluation — case studies, problem-solving, analytical

#### Backend (`server/lib/promptBuilder.js`, `server/routes/questions.js`)
- Replaced the single all-in-one prompt with **four focused per-type prompt templates**, one for each question type
- Each template instructs the model to generate exactly 5 questions in that type's specific format
- Added `IMPORTANT: You must produce all 5 questions completely. Do not truncate or stop early.` instruction
- Route updated to accept `questionType` from the request body
- `max_tokens` raised from 3000 to 4000 in the generate route

### Result
- Users can now choose exactly what to practice
- Each generation is focused on one type, reducing prompt size
- Light UI felt more welcoming — but truncation still occurred at Question 4

---

## v1.2 — Gradient Background

### Problem identified
The flat `#f5f4f0` background was still somewhat clinical. The goal was to give the page a warm, hopeful feeling that reduces a candidate's stress.

### Two gradients were evaluated

| Gradient | Verdict |
|---|---|
| `#fdfcfb → #e2d1c3` (warm cream to soft blush) | **Chosen** — barely-there warmth, easy on the eyes, calm and inviting |
| `#d1ac6d → #052857` (gold to navy) | Rejected — high contrast, eye strain after a few minutes, text legibility issues |

### Changes made (`public/style.css`)
- Added `--grad-start: #fdfcfb` and `--grad-end: #e2d1c3` CSS variables
- Applied `linear-gradient(160deg, var(--grad-start) 0%, var(--grad-end) 100%)` with `background-attachment: fixed` to the body — gradient stays fixed while content scrolls, giving the effect of the page sitting inside warm light
- Header changed to `rgba(253,252,251,0.88)` with `backdrop-filter: blur(12px)` — frosted-cream effect so the page gradient shows softly through the header on scroll
- Tab nav background changed to `rgba(226,209,195,0.35)` — transparent tint of the gradient's end colour
- Status bar received the same frosted treatment
- All shadow variables updated to use `rgba(120,90,60,…)` instead of pure black — warm-tinted shadows on a warm background look natural, black shadows on cream look pasted-on
- Border colour nudged to `#e8dfd6` — a touch more blush-leaning to harmonise with the gradient end colour

---

## v1.3 — Token Truncation Fix + Emoji → SVG

### Problem identified (truncation root cause analysis)
User reported: generation stops at Question 4, mid-sentence.

**Diagnosis:**  
`ibm/granite-4-h-small` has an **8192 total token context window — input + output combined**, not 8192 for output alone. The previous setup was spending:

| Component | Approximate tokens |
|---|---|
| System prompt (persona + full knowledge context) | ~600–800 |
| User prompt (role + company + question type template) | ~400–500 |
| Total input | ~1000–1300 |
| Remaining for output | ~1500–1800 |

Five complete question blocks (question + difficulty + concepts + model answer + divider) for types like HR or Behavioral each consume ~350–450 tokens. Five questions = ~1750–2250 tokens of output needed. The remaining budget ran out exactly at Question 4.

### Fix: Two-call split strategy

Instead of one call asking for all 5 questions, the generate endpoint now makes **two sequential calls** and stitches the results:

| Call | Content | Input tokens | Output budget |
|---|---|---|---|
| Call 1 | Questions 1, 2, 3 | ~393 | ~1800 |
| Call 2 | Questions 4, 5 + Tips | ~442 | ~1750 |

Call 2 receives Call 1's output as an `assistant` message so the model knows exactly what was already written. The two responses are joined with `trimEnd() + "\n\n" + trimStart()` on the server.

**Additional token savings:**
- Switched from `buildSystemPrompt(context)` (with full knowledge block) to `buildLeanSystemPrompt()` for generation — the knowledge context was the single biggest token spender and is not needed when role/company is directly in the user prompt
- Prompt templates trimmed — removed verbose instructions, keeping format templates concise
- `max_new_tokens` hard-capped at 2000 in `graniteClient.js` regardless of what routes request, to prevent any route from accidentally asking for more than the window allows
- Timeout raised from 60s to 90s to accommodate the two sequential calls

### Emoji replaced with inline SVGs

All emoji characters in the UI (⚡ 🔍 📊 🤝 🤖 🙋 ⚙️ 🌟 etc.) were replaced with inline Feather-style SVGs because:
- Emoji render differently across operating systems (Windows vs macOS vs mobile)
- Emoji consume 1–2 tokens each when used inside AI prompts — removing them from prompt headers saved ~20–30 tokens per request
- SVGs use `stroke="currentColor"` so they inherit button/badge/avatar colour automatically
- No external font or icon library downloads required

SVG locations:
- Button icons in `index.html` (lightning bolt, search, bar chart)
- Chat avatars in `app.js` (bot icon, user icon) as inline SVG strings in the `ICONS` object
- Type badge icons in `app.js` for the result header (code brackets, people, heart, bar chart)
- Brand logo in the header (`index.html`)

---

## v1.4 — Critical Bug Fixes

### Bug 1: `/api/questions/evaluate` — `retrieveContext is not defined`

**What the user saw:**  
> Something went wrong — retrieveContext is not defined

**Root cause:**  
When the generate route was refactored in v1.3, the imports at the top of `server/routes/questions.js` were rewritten to only include the new lean prompt builder functions. `retrieveContext` and `buildSystemPrompt` — which the evaluate handler still called — were **silently removed** from the `require` statements. JavaScript does not catch this at module load time; it only throws at runtime when the evaluate endpoint is actually called.

**Fix:**  
Added the two missing imports back to `questions.js`:
```js
const { retrieveContext } = require("../lib/knowledgeBase");
const { buildSystemPrompt, buildLeanSystemPrompt, ... } = require("../lib/promptBuilder");
```

---

### Bug 2: `/api/resume/analyze` — Output truncated mid-response

**What the user saw:**  
Resume analysis stopping before the Vulnerability Areas and 30-Day Prep Plan sections.

**Root cause:**  
Three compounding issues:

| Issue | Token cost |
|---|---|
| `resumeText.slice(0, 3000)` — 3000 characters of resume input | ~750 tokens |
| `buildSystemPrompt(context)` — full knowledge context injected | ~400–800 tokens |
| Emoji in prompt section headers (📋 🎯 ❓ ⚠️ 📅) | ~10–15 tokens |
| **Total input** | **~1200–1600 tokens** |
| **Remaining output budget** | **~400–800 tokens** |

A complete response (analysis + fit score + 5 questions + vulnerability areas + 30-day plan) requires approximately 1500–2000 output tokens. The budget was running out after the 5 questions section.

**Fix — two-call split applied to resume route:**

| Call | Content | Resume input | Output budget |
|---|---|---|---|
| Call 1 | Resume Analysis + Role Fit Score + 5 Questions | 1200 chars (~300 tokens) | ~1800 |
| Call 2 | Vulnerability Areas + 30-Day Prep Plan | 1200 chars (~300 tokens) | ~1800 |

Additional changes:
- Switched to `buildLeanSystemPrompt()` — no knowledge context block
- Resume input trimmed from 3000 characters to 1200 characters
- All emoji removed from prompt section headers
- Call 2 receives Call 1's output as `assistant` context before asking for the continuation

---

### Bug 3: `/api/chat` — Context window growing unbounded across conversation turns

**Root cause:**  
The chat route was sending the **entire conversation history** on every turn with no length limit. After 4–5 exchanges a conversation message array could contain 3000+ tokens of prior messages, leaving almost no room for the model to generate a reply. The chat would appear to respond but give very short or cut-off answers.

**Fix:**
- Conversation history trimmed to the **last 6 turns** before sending to the model
- Knowledge context trimmed to 1200 characters before injection into the system prompt
- Output capped at 1800 tokens (was incorrectly requesting `2048` — which the client's hard cap silently truncated anyway)
- Query for knowledge retrieval trimmed to 300 characters of the last user message

---

## Token Budget Reference (v1.4)

All routes now operate within the 8192-token context window of `ibm/granite-4-h-small`:

| Route | Strategy | Max input tokens | Max output tokens |
|---|---|---|---|
| `/api/questions/generate` | 2-call split | ~400–500 per call | 1800 per call |
| `/api/questions/evaluate` | Single call | ~600–700 | 1800 |
| `/api/resume/analyze` | 2-call split | ~500–600 per call | 1800 per call |
| `/api/chat` | Single call, last 6 turns | ~700–900 | 1800 |

---

## v1.5 — In-Memory Response Cache

### What was added

Every repeated or near-identical request was going through the full pipeline — Watson Discovery query, Granite call(s), and full token spend — even when the inputs were functionally identical. The two highest-cost routes (`/generate` and `/resume/analyze`) each make two sequential Granite calls, burning up to ~3600 output tokens per submission. Users re-submitting the same role/experience combination or the same resume were paying that cost every time.

#### New file: `server/lib/responseCache.js`

A zero-dependency `Map`-backed singleton. No external service, no API key, no new `npm` packages — just a module-level `Map` that lives for the lifetime of the Node.js process.

Three methods:
- **`buildKey(...parts)`** — lowercases, trims, collapses internal whitespace, strips trailing punctuation (`. , ! ? ; : - _ ~`), joins parts with `|`
- **`get(key)`** — returns cached value or `null`; silently evicts entries older than 30 minutes on read
- **`set(key, value)`** — stores value with a `Date.now()` timestamp

TTL is 30 minutes — long enough to cover a full prep session, short enough that stale answers don't persist between sessions.

#### Changes to `server/routes/questions.js`

- `normalizeText` helper added at module scope — lowercases, trims, collapses whitespace, strips trailing punctuation. Applied only to cache key construction; raw inputs are never reassigned.
- **`/generate` cache key:** `buildKey(normalizeText(role), normalizeText(experience), normalizeText(company), normalizeText(questionType))`
  - Cache hit → return stored result + `cached: true`, skip both Granite calls (~3600 output tokens saved)
  - Cache miss → run existing two-call pipeline unchanged, store result before responding
- **`/evaluate` cache key:** `buildKey(role, normalizeText(question).slice(0, 200), normalizeText(answer).slice(0, 200))`
  - Cache hit → return stored result + `cached: true`, skip `retrieveContext` and Granite call (~2400 tokens saved)
  - Cache miss → run existing pipeline unchanged, store result before responding
  - **Fix included:** answer text is normalized before slicing so `"quickly"` and `"quickly..,  "` resolve to the same key

#### Changes to `server/routes/resume.js`

- `cache` singleton and `normalizeText` helper imported at module scope
- **Cache key:** `buildKey(normalizeText(targetRole), normalizeText(company), normalizeText(resumeText).slice(0, 400))`
  - 400-char resume slice used (vs 200 for answers) — resumes are longer and need more content to reliably differentiate them
  - Cache hit → return stored result + `cached: true`, skip both Granite calls (~3600 tokens saved)
  - Cache miss → run existing two-call pipeline unchanged, store result before responding

#### What was deliberately not cached

`/api/chat` — the conversation `messages[]` array grows and changes every turn. Responses are context-dependent on prior turns. Exact-match hits would be near-zero, and a stale cached reply mid-conversation would produce confusing breaks. Chat stays uncached by design.

### Token savings per cache hit

| Route | Granite calls skipped | Approx. tokens saved |
|---|---|---|
| `/api/questions/generate` | 2 | ~3600 output tokens |
| `/api/questions/evaluate` | 1 + Discovery query | ~2400 output tokens |
| `/api/resume/analyze` | 2 | ~3600 output tokens |
| `/api/chat` | not cached — by design | — |

### Files confirmed untouched in v1.5
`server/lib/graniteClient.js`, `server/lib/knowledgeBase.js`, `server/lib/promptBuilder.js`, `server/routes/chat.js`, `server/index.js` — file hashes verified unchanged.

---

## File Change Summary by Version

| File | v1.0 | v1.1 | v1.2 | v1.3 | v1.4 | v1.5 |
|---|---|---|---|---|---|---|
| `public/index.html` | Created | Redesigned + dropdown | — | SVGs added | — | — |
| `public/style.css` | Created | Full redesign | Gradient palette | btn-svg, avatar fixes | — | — |
| `public/app.js` | Created | questionType added | — | ICONS object, SVG avatars | — | — |
| `server/routes/questions.js` | Created | questionType param | — | 2-call split; imports removed (bug) | Missing imports restored | Cache + normalizeText added |
| `server/routes/resume.js` | Created | — | — | — | 2-call split; emoji removed | Cache + normalizeText added |
| `server/routes/chat.js` | Created | — | — | — | Turn limit; context trimmed | — |
| `server/lib/promptBuilder.js` | Created | Per-type specs | — | Lean prompt; Part1/Part2 split | — | — |
| `server/lib/graniteClient.js` | Created | — | — | Hard cap 2000 tokens; 90s timeout | — | — |
| `server/lib/knowledgeBase.js` | Created | — | — | — | — | — |
| `server/lib/responseCache.js` | — | — | — | — | — | Created |

---

## Key Lessons

1. **Always account for the full context window** — `max_new_tokens` is not a standalone budget; it must fit within `total_context_window - input_tokens`. With `granite-4-h-small` at 8192 tokens total, a prompt using 1500 tokens of input leaves only 6692 for output, not 8192.

2. **Split large outputs across multiple calls** — For any response that needs more than ~1500 tokens of output (5 detailed questions, a full resume analysis), break it into two focused calls and stitch server-side. The user sees one seamless result.

3. **Refactoring imports is a silent failure mode** — When rewriting the top of a route file, always audit every symbol used in every handler in that file, not just the handler being changed. JavaScript's `ReferenceError` only surfaces at call time, not at module load.

4. **Lean prompts outperform rich prompts under token constraints** — Removing the knowledge context block from generation calls freed ~400–800 tokens per request. The model performed equally well or better because the user prompt was more direct and less cluttered.

5. **Emoji in prompts costs tokens** — Each emoji character in a system or user prompt costs 1–2 tokens. Five emoji section headers × 4 sections = ~20–40 tokens per request. On a tight budget, this is meaningful.

6. **Warm, calm UI reduces perceived complexity** — A light gradient background, frosted header, and clean SVG icons create a more human and encouraging environment than a dark terminal aesthetic — which matters for a product whose users are stressed job seekers.

7. **Cache keys must be normalized, not just sliced** — Slicing raw input to a fixed length is not enough. Trailing punctuation, extra whitespace, and casing differences all produce different keys for functionally identical inputs. Always normalize before building the key.

8. **Cache at the route layer, not inside the LLM client** — Wrapping the cache check before RAG retrieval and Granite calls maximises savings. Caching only the LLM response would still waste Discovery query tokens on every hit.

9. **Stateful multi-turn routes should not be cached** — The `/chat` endpoint's `messages[]` array changes every turn and responses depend on prior context. Caching it would produce confusing stale replies mid-conversation. Only stateless, parameterised endpoints benefit from response caching.
