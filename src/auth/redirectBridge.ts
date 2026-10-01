import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

// Hands the External ID response back to the app page that started sign-in.
broadcastResponseToMainFrame().catch(() => {
  window.location.replace("/welcome?signin=failed");
});
