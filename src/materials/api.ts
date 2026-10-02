// Calls to the Lesson API's /uploads endpoints.
// The API reads the teacher's oid from the validated token, so nothing here sends an owner id.

import type { CreateUploadRequest, CreateUploadResponse, Material } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export type TokenGetter = () => Promise<string>;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(getToken: TokenGetter, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    // The API returns { "detail": "..." } (FastAPI default) with a teacher-readable message.
    let message = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function materialsApi(getToken: TokenGetter) {
  return {
    list: () => apiFetch<Material[]>(getToken, "/uploads"),

    /** Checks type, size and quota, creates the record, returns a one-blob SAS URL. */
    create: (req: CreateUploadRequest) =>
      apiFetch<CreateUploadResponse>(getToken, "/uploads", {
        method: "POST",
        body: JSON.stringify(req),
      }),

    /** Tells the API the blob is complete. The API checks the blob exists and sets status "indexing". */
    complete: (id: string) =>
      apiFetch<Material>(getToken, `/uploads/${encodeURIComponent(id)}/complete`, { method: "POST" }),

    remove: (id: string) =>
      apiFetch<void>(getToken, `/uploads/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}

export type MaterialsApi = ReturnType<typeof materialsApi>;
