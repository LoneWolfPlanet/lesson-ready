import { readJson, removeKey, writeJson } from "../storage";
import type { AuthService, AuthUser, SignInProvider } from "./types";

const KEY = "lr.mock.user";

/** Fake sign-in for local development (VITE_AUTH_MODE=mock). No network calls. */
export function createMockAuth(): AuthService {
  return {
    async init() {
      return readJson<AuthUser | null>(KEY, null);
    },
    async signIn(provider: SignInProvider) {
      await new Promise((r) => setTimeout(r, 400));
      const user: AuthUser = {
        id: "mock-teacher-1",
        name: "Liza Santos",
        firstName: "Liza",
        email: provider === "google" ? "liza.santos@gmail.com" : "liza@example.ph",
      };
      writeJson(KEY, user); // storage blocked: stays signed in for this visit only
      return user;
    },
    async signOut() {
      removeKey(KEY);
    },
    async getAccessToken() {
      return "mock-token";
    },
  };
}
