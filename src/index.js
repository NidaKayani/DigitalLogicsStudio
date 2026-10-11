import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import "./shared/styles/light-theme-overrides.css";
import App from "./app/App";
import { ThemeProvider } from "./shared/context/ThemeContext";
import { AuthProvider } from "./auth/context/AuthContext";
import { QuantumChatAuthProvider } from "./shared/quantumchat/context/QuantumChatAuthContext";
import { ToastProvider } from "./shared/context/ToastContext";
import reportWebVitals from "./app/reportWebVitals";

const rootElement = document.getElementById("root");

const app = (
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <QuantumChatAuthProvider>
            <ToastProvider position="top-right" autoDismiss={5000}>
              <App />
            </ToastProvider>
          </QuantumChatAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  const root = createRoot(rootElement);
  root.render(app);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
