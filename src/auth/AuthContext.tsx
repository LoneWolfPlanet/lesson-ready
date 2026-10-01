import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { offlineCache, packIndex } from "../api/offlineCache";
import { config } from "../config";
import { createMockAuth } from "./mockAuth";
import { createMsalAuth } from "./msalAuth";
import type { AuthService, AuthUser, SignInProvider } from "./types";

/** One service for the whole app; the API client also uses it for tokens. */
export const authService: AuthService = config.auth.mode === "msal" ? createMsalAuth() : createMockAuth();

// Run init once even though React StrictMode mounts effects twice in development.
let initPromise: Promise<AuthUser | null> | null = null;
const initOnce = () => (initPromise ??= authService.init());

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  user: AuthUser | null;
  busy: boolean;
  error: boolean;
  signIn(provider: SignInProvider): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    initOnce()
      .then((u) => {
        if (!alive) return;
        setUser(u);
        setStatus(u ? "signedIn" : "signedOut");
      })
      .catch((e) => {
        console.error("Sign-in could not finish", e);
        if (!alive) return;
        setError(true);
        setStatus("signedOut");
      });
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (provider: SignInProvider) => {
    setBusy(true);
    setError(false);
    try {
      const u = await authService.signIn(provider);
      if (u) {
        setUser(u);
        setStatus("signedIn");
      }
    } catch (e) {
      console.error("Sign-in failed", e);
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Packs belong to the teacher, not the device: clear them before signing out.
    offlineCache.clear();
    packIndex.clear();
    await authService.signOut();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(
    () => ({ status, user, busy, error, signIn, signOut }),
    [status, user, busy, error, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
