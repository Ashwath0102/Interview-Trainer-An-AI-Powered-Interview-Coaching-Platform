/**
 * InterviewTrainer — Front-end Application Logic
 */

const API_BASE = window.location.origin + "/api";

/* =============================================
   TAB NAVIGATION
   ============================================= */
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${target}`).classList.add("active");
  });
});

/* =============================================
   STATUS BAR
   ============================================= */
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

function setStatus(msg, type = "") {
  statusText.textContent = msg;
  statusDot.className = "status-dot " + type;
}

/* =============================================
   MARKDOWN RENDERER
   ============================================= */
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(text);
  }
  return text.replace(/\n/g, "<br>");
}

/* =============================================
   RESULT RENDERING HELPERS
   ============================================= */
// SVG icons used in dynamic UI — stroke-only, 14×14 viewport
const ICONS = {
  technical: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  behavioral:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  hr:        `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  evaluation:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  user:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  bot:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/></svg>`,
};

const TYPE_BADGE = {
  Technical:  { cls: "technical",  label: "Technical",  icon: ICONS.technical },
  Behavioral: { cls: "behavioral", label: "Behavioral", icon: ICONS.behavioral },
  HR:         { cls: "hr",         label: "HR",         icon: ICONS.hr },
  Evaluation: { cls: "evaluation", label: "Evaluation", icon: ICONS.evaluation },
};

function showLoading(container, message = "IBM Granite is thinking…") {
  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      <p class="loading-title">${message}</p>
      <p>Running two passes to ensure all 5 questions are complete…</p>
    </div>`;
}

function showResult(container, markdownContent, headerLabel = "") {
  container.classList.remove("hidden");
  container.innerHTML =
    (headerLabel ? `<div class="result-header">${headerLabel}</div>` : "") +
    `<div class="result-body">${renderMarkdown(markdownContent)}</div>`;
}

function showError(container, message) {
  container.classList.remove("hidden");
  container.innerHTML = `
    <div style="padding:20px;display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:1.2rem;">⚠️</span>
      <div>
        <strong style="color:var(--danger);display:block;margin-bottom:4px;">Something went wrong</strong>
        <span style="font-size:0.88rem;color:var(--muted);">${message}</span>
      </div>
    </div>`;
}

/* =============================================
   API HELPERS
   ============================================= */
async function apiFetch(endpoint, body) {
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

/* =============================================
   TAB 1: GENERATE QUESTIONS
   ============================================= */
const generateForm = document.getElementById("generateForm");
const generateResult = document.getElementById("generateResult");
const generateBtn = document.getElementById("generateBtn");

generateForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const questionType = document.getElementById("gen-qtype").value;
  const role = document.getElementById("gen-role").value.trim();
  const experience = document.getElementById("gen-exp").value;
  const company = document.getElementById("gen-company").value.trim();
  const resumeText = document.getElementById("gen-resume").value.trim();

  generateBtn.disabled = true;
  setStatus(`Generating ${questionType} questions for ${role}…`, "loading");
  showLoading(
    generateResult,
    `Generating 5 ${questionType} questions for <strong>${role}</strong>${company ? ` @ <strong>${company}</strong>` : ""}…`
  );

  try {
    const data = await apiFetch("/questions/generate", { role, experience, company, resumeText, questionType });
    const badge = TYPE_BADGE[questionType] || TYPE_BADGE.Technical;
    const headerLabel =
      `<span class="type-badge ${badge.cls}">${badge.icon} ${badge.label}</span>` +
      `<span class="result-header-label">&nbsp; 5 Questions · ${role}${company ? " · " + company : ""} · ${experience}</span>`;
    showResult(generateResult, data.content, headerLabel);
    setStatus(`✓ ${questionType} questions ready for ${role}${company ? " @ " + company : ""}`, "success");
  } catch (err) {
    showError(generateResult, err.message);
    setStatus("Error: " + err.message, "error");
  } finally {
    generateBtn.disabled = false;
  }
});

/* =============================================
   TAB 2: RESUME ANALYZER
   ============================================= */
const resumeForm = document.getElementById("resumeForm");
const resumeResult = document.getElementById("resumeResult");
const resumeBtn = document.getElementById("resumeBtn");

resumeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const resumeText = document.getElementById("res-text").value.trim();
  const targetRole = document.getElementById("res-role").value.trim();
  const company = document.getElementById("res-company").value.trim();

  if (resumeText.length < 50) {
    showError(resumeResult, "Please paste at least 50 characters of your resume.");
    return;
  }

  resumeBtn.disabled = true;
  setStatus("Analyzing resume…", "loading");
  showLoading(resumeResult, "Analyzing your resume against the knowledge base…");

  try {
    const data = await apiFetch("/resume/analyze", { resumeText, targetRole, company });
    const headerLabel = `Resume Analysis${targetRole ? " · " + targetRole : ""}${company ? " · " + company : ""}`;
    showResult(resumeResult, data.analysis, headerLabel);
    setStatus(`✓ Resume analyzed${targetRole ? " for " + targetRole : ""}`, "success");
  } catch (err) {
    showError(resumeResult, err.message);
    setStatus("Error: " + err.message, "error");
  } finally {
    resumeBtn.disabled = false;
  }
});

/* =============================================
   TAB 3: ANSWER EVALUATOR
   ============================================= */
const evaluateForm = document.getElementById("evaluateForm");
const evaluateResult = document.getElementById("evaluateResult");
const evaluateBtn = document.getElementById("evaluateBtn");

evaluateForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = document.getElementById("eval-question").value.trim();
  const answer = document.getElementById("eval-answer").value.trim();
  const role = document.getElementById("eval-role").value.trim() || "Software Engineer";

  evaluateBtn.disabled = true;
  setStatus("Evaluating your answer…", "loading");
  showLoading(evaluateResult, "Evaluating your answer with IBM Granite…");

  try {
    const data = await apiFetch("/questions/evaluate", { question, answer, role });
    showResult(evaluateResult, data.evaluation, "Answer Evaluation");
    setStatus("✓ Evaluation complete — grounded feedback from Interview_Agent", "success");
  } catch (err) {
    showError(evaluateResult, err.message);
    setStatus("Error: " + err.message, "error");
  } finally {
    evaluateBtn.disabled = false;
  }
});

/* =============================================
   TAB 4: AI COACH CHAT
   ============================================= */
const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

let chatHistory = [];

function appendChatMsg(role, htmlContent) {
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${role}`;
  const avatarIcon = role === "assistant" ? ICONS.bot : ICONS.user;
  msgEl.innerHTML = `
    <div class="msg-avatar">${avatarIcon}</div>
    <div class="msg-content">${htmlContent}</div>`;
  chatWindow.appendChild(msgEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return msgEl;
}

function appendChatLoading() {
  const msgEl = document.createElement("div");
  msgEl.className = "chat-msg assistant";
  msgEl.id = "chatThinking";
  msgEl.innerHTML = `
    <div class="msg-avatar">${ICONS.bot}</div>
    <div class="msg-content" style="display:flex;align-items:center;gap:10px;padding:14px 16px;">
      <div class="spinner" style="width:20px;height:20px;border-width:2px;flex-shrink:0;"></div>
      <span style="font-size:0.82rem;color:var(--muted);">Thinking…</span>
    </div>`;
  chatWindow.appendChild(msgEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  const role = document.getElementById("chat-role").value.trim() || "Software Engineer";
  const company = document.getElementById("chat-company").value.trim();

  chatInput.value = "";
  chatSendBtn.disabled = true;
  setStatus("IBM Granite is responding…", "loading");

  appendChatMsg("user", `<span class="msg-sender">You</span><p>${text.replace(/\n/g, "<br>")}</p>`);
  chatHistory.push({ role: "user", content: text });
  appendChatLoading();

  try {
    const data = await apiFetch("/chat", { messages: chatHistory, role, company });

    const thinking = document.getElementById("chatThinking");
    if (thinking) thinking.remove();

    const renderedReply = renderMarkdown(data.reply);
    appendChatMsg("assistant", `<span class="msg-sender">InterviewTrainer</span>${renderedReply}`);
    chatHistory.push({ role: "assistant", content: data.reply });

    setStatus("✓ Response from IBM Granite", "success");
  } catch (err) {
    const thinking = document.getElementById("chatThinking");
    if (thinking) thinking.remove();
    appendChatMsg("assistant", `<span class="msg-sender">InterviewTrainer</span><p style="color:var(--danger);">⚠️ ${err.message}</p>`);
    setStatus("Error: " + err.message, "error");
  } finally {
    chatSendBtn.disabled = false;
  }
}

chatSendBtn.addEventListener("click", sendChat);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

/* =============================================
   STARTUP HEALTH CHECK
   ============================================= */
(async () => {
  try {
    const resp = await fetch(`${API_BASE}/health`);
    const data = await resp.json();
    if (data.status === "ok") {
      setStatus(`Connected · Model: ${data.model}`, "success");
    }
  } catch {
    setStatus("⚠ Backend unreachable — run: npm start", "error");
  }
})();
