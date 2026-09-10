# 🎯 InterviewTrainer — AI Interview Coach

> Powered by **IBM Granite** (`ibm/granite-4-h-small`) and grounded with the **Interview_Agent** Watson Discovery vector index.

---

## Features

| Feature | Description |
|---|---|
| 🎯 **Generate Interview Pack** | 5 tailored technical questions + 3 STAR behavioral questions with model answers |
| 📋 **Resume Analyzer** | Role fit score, resume-specific questions, vulnerability areas, 30-day prep plan |
| ⭐ **Answer Evaluator** | Score your practice answer, get gaps analysis + polished model answer |
| 💬 **AI Coach Chat** | Multi-turn conversational coach grounded in the knowledge base |
| 🏢 **Company-specific** | TCS, Infosys, Google, Amazon, Microsoft, Meta patterns |

---

## Architecture

```
public/               ← Front-end SPA (HTML + CSS + JS)
server/
  index.js            ← Express app entry point
  routes/
    chat.js           ← POST /api/chat — grounded multi-turn chat
    questions.js      ← POST /api/questions/generate & /evaluate
    resume.js         ← POST /api/resume/analyze
  lib/
    graniteClient.js  ← IBM IAM token + Granite chat completions
    knowledgeBase.js  ← Watson Discovery vector search + fallback knowledge
    promptBuilder.js  ← System prompt + question prompt templates
```
<img width="3600" height="2276" alt="mermaidaiagent interview" src="https://github.com/user-attachments/assets/38fdd47b-473e-40db-8e23-95c034a343ce" />

---

### How Agentic AI Drives Interview Trainer

- RAG: Retrieval-Augmented Generation Before every LLM call, the system queries the Interview_Agent Watson Discovery vector index. Retrieved passages are injected into the system prompt, ensuring the model is grounded in domain knowledge rather than free to hallucinate.
- Cache-Gated Pipeline Before RAG retrieval even begins, the agent checks an in-memory response cache. On a hit, the full result is returned immediately, skipping the Discovery query, system prompt construction, and all Granite calls. The agent observes the incoming request and decides whether the pipeline needs to run at all.
- Multi-Step Sequential Reasoning Chain Call 1 generates Questions 1 through 3, and the output is fed back as assistant context. Call 2 continues with Questions 4 through 5 and tips. The server observes the intermediate output and decides the next prompt, establishing the agentic loop.
- Grounded Persona as Agent Controller The system prompt defines strict rules: use retrieved context only, never fabricate, and prioritise company-specific patterns. The LLM operates within defined boundaries with prompt engineering acting as agent control.
- Multi-Turn Memory AI Coach Chat maintains the last 6 conversation turns, allowing the agent to build on prior context rather than starting fresh each time. Chat is intentionally excluded from caching because responses are stateful and context-dependent.
- Graceful Fallback Strategy If Watson Discovery is unreachable, the agent automatically falls back to built-in domain knowledge so the pipeline never breaks.

Beyond a single prompt, the system functions as a reasoning pipeline that retrieves, observes, caches, continues, and grounds every response. The model does not pick its own tools, but it uses core building blocks including RAG for grounding, a pre-pipeline cache gate for efficiency, multi-step chaining where the output of one step feeds the next, and a controlled reasoning persona.

---

### Data Flow

```
User Input
    │
    ▼
Express Route
    │
    ├─► knowledgeBase.js ──► Watson Discovery /v2/projects/{id}/query
    │                         (Interview_Agent vector index)
    │                         Fallback: built-in knowledge snippets
    │
    ├─► promptBuilder.js ──► System prompt with injected context
    │
    └─► graniteClient.js ──► IBM IAM token → POST /ml/v1/text/chat
                              (ibm/granite-4-h-small)
                                    │
                                    ▼
                              Grounded Response → Front-end
```

---

## Quick Start

### 1. Clone & Install

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
IBM_API_KEY=YOUR_API_KEY_HERE
IBM_ML_URL=https://us-south.ml.cloud.ibm.com
IBM_PROJECT_ID=YOUR_GRANITE-MODEL-PROJ_ID
IBM_MODEL_ID=ibm/granite-4-h-small
WATSON_DISCOVERY_URL=https://api.us-south.discovery.watson.cloud.ibm.com
WATSON_DISCOVERY_VERSION=2023-03-31
WATSON_DISCOVERY_PROJECT_ID=<your_discovery_project_id>
PORT=3000
```

> **Note:** Watson Discovery is optional. If not configured, the app uses built-in knowledge snippets as fallback.

### 3. Run

```bash
npm start          # production
npm run dev        # development (auto-restart with nodemon)
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Reference

### `POST /api/questions/generate`
```json
{
  "role": "Software Engineer",
  "experience": "Mid-level (2-4 years)",
  "company": "Google",
  "resumeText": "Optional resume paste..."
}
```

### `POST /api/questions/evaluate`
```json
{
  "question": "Explain the difference between SQL and NoSQL databases.",
  "answer": "SQL uses structured tables...",
  "role": "Backend Engineer"
}
```

### `POST /api/resume/analyze`
```json
{
  "resumeText": "Full resume text...",
  "targetRole": "ML Engineer",
  "company": "IBM"
}
```

### `POST /api/chat`
```json
{
  "messages": [
    { "role": "user", "content": "Help me prepare for a Google SDE-2 interview" }
  ],
  "role": "Software Engineer",
  "company": "Google"
}
```

---

## IBM Services Used

| Service | Details |
|---|---|
| **IBM Granite** | Model: `ibm/granite-4-h-small`, Endpoint: `POST /ml/v1/text/chat?version=2023-05-29` |
| **IBM IAM** | `https://iam.cloud.ibm.com/identity/token` — API key → Bearer token |
| **Watson Discovery** | Vector index: `Interview_Agent`, Query API: `/v2/projects/{id}/query` |

---

### Future Additions

- Video and Voice-Based Interview Simulator with chat
- Self-Evaluation Loop
- Company based Live knowledge questions

---

## Security Notes

- Never commit `.env` file (it is `.gitignore`d)
- Rotate the IBM API key after sharing this project
- The IAM token is cached and refreshed automatically 5 minutes before expiry
