/**
 * Dev-only: browser calls same-origin `/qc-api/...` so QuantumChat sign-in
 * works from localhost without waiting on backend CORS allowlist deploy.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

const QUANTUMCHAT_API =
  process.env.REACT_APP_QUANTUMCHAT_API_URL?.trim().replace(/\/$/, "") ||
  "https://quantum-chat-backend-six.vercel.app";

module.exports = function setupProxy(app) {
  app.use(
    "/qc-api",
    createProxyMiddleware({
      target: QUANTUMCHAT_API,
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/qc-api": "" },
    }),
  );
};
