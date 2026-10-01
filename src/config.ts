/**
 * Every environment setting the app reads, in one place.
 * Values come from Vite env files. With no file at all, sign-in and the API both run in mock mode.
 * Precedence (highest first): .env.[mode].local > .env.[mode] > .env.local > .env
 * so never keep a .env.development next to .env.local: it would override it.
 */

type AuthMode = "mock" | "msal";
type ApiMode = "mock" | "http";

function read(name: string, fallback = ""): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value === undefined || value === "" ? fallback : value.trim();
}

function readNumber(name: string, fallback: number): number {
  const n = Number(read(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function knownAuthorities(listed: string, authority: string): string[] {
  const hosts = new Set(listed.split(/[\s,]+/).filter(Boolean));
  try {
    const url = new URL(authority);
    hosts.add(url.host);
    const tenantId = url.pathname.match(GUID)?.[0];
    if (tenantId && url.host.endsWith(".ciamlogin.com")) hosts.add(`${tenantId.toLowerCase()}.ciamlogin.com`);
  } catch {
    /* empty or invalid authority: reported by configProblems() */
  }
  return [...hosts];
}

export const config = {
  auth: {
    mode: (read("VITE_AUTH_MODE", "mock") as AuthMode),
    clientId: read("VITE_AUTH_CLIENT_ID"),
    authority: read("VITE_AUTH_AUTHORITY"),
    /**
     * Hosts MSAL may trust. Accepts a comma/space-separated list. The tenant-ID host
     * (<tenant-id>.ciamlogin.com) is added automatically when the authority contains
     * a tenant ID, because External ID's discovery document issues tokens from that
     * host and MSAL validates the issuer against this list.
     */
    knownAuthorities: knownAuthorities(read("VITE_AUTH_KNOWN_AUTHORITY"), read("VITE_AUTH_AUTHORITY")),
    redirectPath: read("VITE_AUTH_REDIRECT_PATH", "/redirect.html"),
    googleEnabled: read("VITE_AUTH_GOOGLE_ENABLED", "false").toLowerCase() === "true",
    googleDomainHint: read("VITE_AUTH_GOOGLE_DOMAIN_HINT"),
  },
  api: {
    mode: (read("VITE_API_MODE", "mock") as ApiMode),
    baseUrl: read("VITE_API_BASE_URL").replace(/\/+$/, ""),
    scopes: read("VITE_API_SCOPES").split(/\s+/).filter(Boolean),
  },
  expectedMinutes: readNumber("VITE_EXPECTED_MINUTES", 3),
  pollSeconds: readNumber("VITE_POLL_SECONDS", 5),
} as const;

/** Fails loudly at start-up instead of failing quietly at sign-in. */
export function configProblems(): string[] {
  const problems: string[] = [];
  if (config.auth.mode === "msal") {
    if (!config.auth.clientId) problems.push("VITE_AUTH_CLIENT_ID is empty");
    if (!config.auth.authority) problems.push("VITE_AUTH_AUTHORITY is empty");
    else if (!/^https:\/\//i.test(config.auth.authority)) {
      problems.push(`VITE_AUTH_AUTHORITY must start with https:// (got "${config.auth.authority}")`);
    } else if (/ciamlogin\.com/i.test(config.auth.authority) && !GUID.test(config.auth.authority)) {
      problems.push(
        "VITE_AUTH_AUTHORITY has no tenant ID. Use https://<subdomain>.ciamlogin.com/<tenant-id>/ " +
          "or sign-in fails with endpoints_resolution_error (issuer check).",
      );
    }
  }
  if (config.api.mode === "http") {
    if (!config.api.baseUrl) problems.push("VITE_API_BASE_URL is empty");
    if (config.auth.mode === "msal" && config.api.scopes.length === 0) {
      problems.push("VITE_API_SCOPES is empty, so the API will receive no access token");
    }
  }
  return problems;
}
