import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type RedirectRequest,
} from "@azure/msal-browser";
import { config } from "../config";
import { firstNameOf, type AuthService, type AuthUser, type SignInProvider } from "./types";

/**
 * Sign-in with Microsoft Entra External ID (email and Google in phase 1).
 * Uses the redirect flow, which works on phones where pop-ups are blocked.
 */
export function createMsalAuth(): AuthService {
  const origin = window.location.origin;

  const pca = new PublicClientApplication({
    auth: {
      clientId: config.auth.clientId,
      authority: config.auth.authority,
      knownAuthorities: config.auth.knownAuthorities,
      redirectUri: origin + config.auth.redirectPath,
      postLogoutRedirectUri: origin + "/welcome",
    },
    cache: {
      // Keeps teachers signed in between visits. Use "sessionStorage" for shared devices.
      cacheLocation: "localStorage",
    },
  });

  const loginScopes = ["openid", "profile", "offline_access", ...config.api.scopes];
  // MSAL must finish initialising before any other call.
  const ready = pca.initialize();

  function toUser(account: AccountInfo): AuthUser {
    const claims = (account.idTokenClaims ?? {}) as Record<string, unknown>;
    const given = typeof claims.given_name === "string" ? claims.given_name : "";
    const name = account.name || given || account.username || "Teacher";
    return {
      id: account.homeAccountId,
      name,
      firstName: given || firstNameOf(name),
      email: account.username || undefined,
    };
  }

  function currentAccount(): AccountInfo | null {
    return pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
  }

  return {
    async init() {
      await ready;
      const result = await pca.handleRedirectPromise();
      const account = result?.account ?? currentAccount();
      if (!account) return null;
      pca.setActiveAccount(account);
      return toUser(account);
    },

    async signIn(provider: SignInProvider) {
      await ready;
      const request: RedirectRequest = {
        scopes: loginScopes,
        // Where the teacher lands after signing in.
        redirectStartPage: origin + "/new",
      };
      if (provider === "google" && config.auth.googleDomainHint) {
        request.extraQueryParameters = { domain_hint: config.auth.googleDomainHint };
      }
      await pca.loginRedirect(request);
      return null; // the page navigates away
    },

    async signOut() {
      await ready;
      const account = currentAccount();
      await pca.logoutRedirect({ account: account ?? undefined });
    },

    async getAccessToken() {
      if (config.api.scopes.length === 0) return null;
      await ready;
      const account = currentAccount();
      if (!account) return null;
      try {
        const result = await pca.acquireTokenSilent({ scopes: config.api.scopes, account });
        return result.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          // Session expired or consent needed: send the teacher through sign-in again.
          await pca.acquireTokenRedirect({ scopes: config.api.scopes, account });
          return null;
        }
        throw error;
      }
    },
  };
}
