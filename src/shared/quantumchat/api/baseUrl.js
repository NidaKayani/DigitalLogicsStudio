const LEGACY_PROD_BACKEND = "https://quantum-chat-backend.vercel.app";
const PROD_BACKEND = "https://quantum-chat-backend-six.vercel.app";

function normalizeApiBaseUrl(url) {
  const trimmed = String(url || "")
    .trim()
    .replace(/\/$/, "");
  if (trimmed === LEGACY_PROD_BACKEND) return PROD_BACKEND;
  return trimmed;
}

function isLocalhostUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url);
}

export function getApiBaseUrl() {
  const configured = normalizeApiBaseUrl(
    process.env.REACT_APP_QUANTUMCHAT_API_URL || "",
  );
  if (configured) {
    if (process.env.NODE_ENV === "production" && isLocalhostUrl(configured)) {
      return PROD_BACKEND;
    }
    return configured;
  }
  if (process.env.NODE_ENV !== "production") {
    // Prefer production API in CRA unless explicitly overridden — local QC
    // backend often shares port 5000 with the DLS backend.
    return PROD_BACKEND;
  }
  return PROD_BACKEND;
}

export function getApiUrl() {
  return `${getApiBaseUrl()}/api`;
}
