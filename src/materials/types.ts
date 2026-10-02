// Shared types for the "My materials" feature (phase 2, screens P2·1 to P2·3).

export const SUBJECTS = ["Science", "Math", "English", "Filipino", "AP"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const GRADES = [1, 2, 3, 4, 5, 6] as const;
export type Grade = (typeof GRADES)[number];

/** Server-side status. The API (and the Event Grid function) owns these. */
export type UploadStatus = "uploading" | "indexing" | "ready" | "failed";

export interface Material {
  id: string;
  fileName: string;
  lessonTitle: string;
  subject: Subject;
  grade: Grade;
  sizeBytes: number;
  contentType: string;
  status: UploadStatus;
  /** Plain-language reason when status is "failed", e.g. "Too blurry to read". */
  error?: string;
  createdAt: string;
}

export interface MaterialDetails {
  lessonTitle: string;
  subject: Subject;
  grade: Grade;
}

export interface CreateUploadRequest extends MaterialDetails {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface CreateUploadResponse {
  material: Material;
  /** SAS URL for exactly one blob: teacher-uploads/{oid}/{id}.{ext}. Create + write only. */
  uploadUrl: string;
  expiresAt: string;
}

/** What the screen shows for a file that is still being sent from this device. */
export interface LocalUpload {
  progress: number; // 0..1
  state: "sending" | "error";
  error?: string;
  file: File;
  details: MaterialDetails;
}

export const ACCEPTED_TYPES: Record<string, { label: "PDF" | "DOC" | "IMG"; ext: string }> = {
  "application/pdf": { label: "PDF", ext: "pdf" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "DOC", ext: "docx" },
  "image/jpeg": { label: "IMG", ext: "jpg" },
  "image/png": { label: "IMG", ext: "png" },
};

export const ACCEPT_ATTR = ".pdf,.docx,image/jpeg,image/png";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 120;
