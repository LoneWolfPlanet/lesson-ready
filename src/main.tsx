import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/bricolage-grotesque/700.css";
import "./styles/app.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { config, configProblems } from "./config";
import { UiProvider } from "./i18n/UiContext";

const problems = configProblems();
if (problems.length) {
  console.error("LessonReady configuration problems:\n- " + problems.join("\n- "));
}
if (config.auth.mode === "mock" || config.api.mode === "mock") {
  console.info(`LessonReady running with auth=${config.auth.mode}, api=${config.api.mode}`);
}

// Offline app shell. Updates install silently and apply on the next visit.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <UiProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  </StrictMode>,
);
