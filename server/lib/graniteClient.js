/**
 * IBM Granite LLM client
 * Handles IAM token refresh and chat completions via
 * POST /ml/v1/text/chat?version=2023-05-29
 */
const axios = require("axios");

const IBM_ML_URL = process.env.IBM_ML_URL || "https://us-south.ml.cloud.ibm.com";
const IBM_API_KEY = process.env.IBM_API_KEY;
const IBM_PROJECT_ID = process.env.IBM_PROJECT_ID;
const IBM_MODEL_ID = process.env.IBM_MODEL_ID || "ibm/granite-4-h-small";
const CHAT_URL = `${IBM_ML_URL}/ml/v1/text/chat?version=2023-05-29`;

let _cachedToken = null;
let _tokenExpiry = 0;

/**
 * Obtain (or return cached) IAM bearer token.
 */
async function getIAMToken() {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiry) return _cachedToken;

  const resp = await axios.post(
    "https://iam.cloud.ibm.com/identity/token",
    new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: IBM_API_KEY,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  _cachedToken = resp.data.access_token;
  // Expire 5 min before actual expiry for safety
  _tokenExpiry = now + (resp.data.expires_in - 300) * 1000;
  return _cachedToken;
}

/**
 * Call IBM Granite chat completion.
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} opts  - temperature, max_new_tokens, etc.
 * @returns {string} assistant reply text
 */
async function chatCompletion(messages, opts = {}) {
  const token = await getIAMToken();

  // granite-4-h-small context window: 8192 total tokens (input + output).
  // Hard-cap output at 2000 to leave headroom for large system prompts.
  const maxNewTokens = Math.min(opts.max_tokens ?? 2000, 2000);

  const payload = {
    model_id: IBM_MODEL_ID,
    project_id: IBM_PROJECT_ID,
    messages,
    parameters: {
      temperature: opts.temperature ?? 0.7,
      max_new_tokens: maxNewTokens,
      repetition_penalty: 1.05,
    },
  };

  const resp = await axios.post(CHAT_URL, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 90000,
  });

  const choice = resp.data?.choices?.[0];
  if (!choice) throw new Error("No choices returned from IBM Granite");
  return choice.message?.content || "";
}

module.exports = { chatCompletion, getIAMToken };
