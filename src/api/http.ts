import { authService } from "../auth/AuthContext";
import { config } from "../config";

/** Every failure is reduced to one of these, so screens can show a friendly message. */
export type ApiErrorKind = "offline" | "signin" | "notfound" | "invalid" | "server" | "busy";

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return "signin";
  if (status === 404) return "notfound";
  if (status === 400 || status === 422) return "invalid";
  if (status === 429) return "busy";
  return "server";
}

/**
 * fetch wrapper: adds the bearer token, retries network errors, 429 and 5xx with
 * backoff, and turns failures into ApiError.
 * Pass `retry: false` for requests that must not repeat. POST /lesson-packs uses it,
 * because the API has no idempotency key and a retry could start a second, duplicate pack.
 */
export async function request<T>(path: string, init: RequestInit & { retry?: boolean } = {}): Promise<T> {
  const url = `${config.api.baseUrl}${path}`;
  const { retry = true, ...fetchInit } = init;
  const attempts = retry ? RETRIES : 0;
  let lastError: ApiError = new ApiError("server", "Request failed");

  for (let attempt = 0; attempt <= attempts; attempt++) {
    if (attempt > 0) await sleep(Math.min(8000, 600 * 2 ** (attempt - 1)));

    if (!navigator.onLine) {
      lastError = new ApiError("offline", "No connection");
      continue;
    }

    const headers = new Headers(fetchInit.headers);
    headers.set("Accept", "application/json");
    if (fetchInit.body) headers.set("Content-Type", "application/json");
    const token = await authService.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetch(url, { ...fetchInit, headers });
    } catch {
      lastError = new ApiError("offline", "Network error");
      continue;
    }

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    const kind = kindForStatus(res.status);
    lastError = new ApiError(kind, `HTTP ${res.status}`, res.status);
    if (kind !== "server" && kind !== "busy") break; // retrying won't help
  }
  throw lastError;
}

export function asApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError("server", String(e));
}
