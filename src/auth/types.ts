export type SignInProvider = "email" | "google";

export interface AuthUser {
  id: string;
  name: string;
  firstName: string;
  email?: string;
}

/** What the rest of the app needs from sign-in. Two implementations: MSAL and mock. */
export interface AuthService {
  /** Finishes any sign-in redirect and returns the signed-in teacher, if any. */
  init(): Promise<AuthUser | null>;
  /** Starts sign-in. For MSAL this leaves the page (redirect). */
  signIn(provider: SignInProvider): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  /** Bearer token for the pack API, or null when the API needs none. */
  getAccessToken(): Promise<string | null>;
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
