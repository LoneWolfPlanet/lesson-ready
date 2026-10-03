// Calls to the Lesson API's /uploads endpoints, through the same client as the pack API
// (bearer token, retries, ApiError). The API reads the teacher's oid from the token, so nothing
// here sends an owner id. Errors carry the API's teacher-readable `detail` as their message.

import { request } from "../api/http";
import type { CreateUploadRequest, CreateUploadResponse, Material } from "./types";

const uploadPath = (id: string) => `/uploads/${encodeURIComponent(id)}`;

export const materialsApi = {
  list: () => request<Material[]>("/uploads"),

  /** Checks type, size and quota, creates the record, returns a one-blob SAS URL. Not retried: a repeat would add a second record. */
  create: (req: CreateUploadRequest) =>
    request<CreateUploadResponse>("/uploads", { method: "POST", body: JSON.stringify(req), retry: false }),

  /** Tells the API the blob is complete. The API checks the blob exists and sets status "indexing". */
  complete: (id: string) => request<Material>(`${uploadPath(id)}/complete`, { method: "POST" }),

  remove: (id: string) => request<void>(uploadPath(id), { method: "DELETE" }),
};
