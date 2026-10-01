import type { AuthService, AuthUser, SignInProvider } from "./types";

const KEY = "lr.mock.user";

/** Fake sign-in for local development (VITE_AUTH_MODE=mock). No network calls. */
export function createMockAuth(): AuthService {
  function load(): AuthUser | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  return {
    async init() {
      return load();
    },
    async signIn(provider: SignInProvider) {
      await new Promise((r) => setTimeout(r, 400));
      const user: AuthUser = {
        id: "mock-teacher-1",
        name: "Liza Santos",
        firstName: "Liza",
        email: provider === "google" ? "liza.santos@gmail.com" : "liza@example.ph",
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(user));
      } catch {
        /* storage blocked: stays signed in for this visit only */
      }
      return user;
    },
    async signOut() {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    },
    async getAccessToken() {
      return "mock-token";
    },
  };
}
