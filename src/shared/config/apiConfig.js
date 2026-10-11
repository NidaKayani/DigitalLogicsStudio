const LOCAL_API_URL = "http://localhost:5000/api";
const SAME_ORIGIN_API_URL = "/api";
const PRODUCTION_API_URL =
  "https://digital-logics-studio-backend.vercel.app/api";
// The -three deployment is not ours and is stale (missing the newer auth routes).
const LEGACY_PRODUCTION_API_URL =
  "https://digital-logics-studio-backend-three.vercel.app/api";

function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function shouldUseSameOriginProxy(url) {
  const normalized = normalizeUrl(url);
  return (
    normalized === SAME_ORIGIN_API_URL ||
    normalized === normalizeUrl(PRODUCTION_API_URL) ||
    normalized === normalizeUrl(LEGACY_PRODUCTION_API_URL)
  );
}

// A usable API base must carry a path — ours live under /api. A bare origin
// (e.g. REACT_APP_API_URL accidentally set to the frontend site URL via
// swapped Vercel env vars) sends requests to static hosting, which answers
// 405 on POST.
function isUsableApiBase(url) {
  if (url.startsWith("/")) return true; // same-origin path like /api
  try {
    return new URL(url).pathname !== "/";
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl() {
  const configured = process.env.REACT_APP_API_URL?.trim();
  if (configured) {
    if (shouldUseSameOriginProxy(configured)) {
      return SAME_ORIGIN_API_URL;
    }
    const normalized = normalizeUrl(configured);
    if (isUsableApiBase(normalized)) {
      return normalized;
    }
  }
  return process.env.NODE_ENV === "production"
    ? SAME_ORIGIN_API_URL
    : LOCAL_API_URL;
}

export function resolveAiBaseUrl() {
  const configuredAi = process.env.REACT_APP_AI_URL?.trim();
  if (configuredAi) {
    return configuredAi.replace(/\/+$/, "");
  }
  return `${resolveApiBaseUrl()}/ai`;
}

// Circuit generate/hint live on the main DLS backend (/api/ai/...), not the
// BoolMentor chatbot (REACT_APP_AI_URL, often localhost:5100).
export function resolveCircuitAiBaseUrl() {
  return `${resolveApiBaseUrl()}/ai`;
}

const DEFAULT_CIRCUITMIND_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://circuit-mind-two.vercel.app"
    : "http://localhost:8000";

export function resolveCircuitMindBaseUrl() {
  const configured = process.env.REACT_APP_CIRCUITMIND_API_URL?.trim();
  return normalizeUrl(configured || DEFAULT_CIRCUITMIND_API_URL);
}

const DEFAULT_QUANTUMCHAT_URL = "https://chat.quantumlogicslimited.com/chat";

export function resolveQuantumChatUrl() {
  const configured = process.env.REACT_APP_QUANTUMCHAT_URL?.trim();
  return normalizeUrl(configured || DEFAULT_QUANTUMCHAT_URL);
}

// QuantumChat currently ships X-Frame-Options: DENY, so iframe embed is opt-in
// after their CSP allows DLS origins (frame-ancestors).
export function isQuantumChatEmbedEnabled() {
  return process.env.REACT_APP_QUANTUMCHAT_EMBED === "true";
}
