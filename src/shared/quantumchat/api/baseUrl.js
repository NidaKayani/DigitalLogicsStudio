const LEGACY_PROD_BACKEND = "https://quantum-chat-backend.vercel.app";
const PROD_BACKEND = "https://quantum-chat-backend-six.vercel.app";
/** CRA setupProxy.js mounts the QuantumChat API under this path (dev only). */
const DEV_PROXY_BASE = "/qc-api";

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
    // Absolute remote URLs from localhost are blocked by CORS until the
    // QuantumChat-Backend allowlist is deployed — use the CRA proxy instead.
    if (
      process.env.NODE_ENV !== "production" &&
      !isLocalhostUrl(configured) &&
      !configured.startsWith("/")
    ) {
      return DEV_PROXY_BASE;
    }
    return configured;
  }
  if (process.env.NODE_ENV !== "production") {
    return DEV_PROXY_BASE;
  }
  return PROD_BACKEND;
}

export function getApiUrl() {
  return `${getApiBaseUrl()}/api`;
}
