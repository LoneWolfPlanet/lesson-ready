// Uploads a file straight to Blob Storage with the SAS URL from POST /uploads.
// Sends the file in 4 MB blocks so a dropped connection only re-sends one block, not the whole file.
// XMLHttpRequest is used for blocks because fetch() has no upload progress events.

const BLOCK_SIZE = 4 * 1024 * 1024;
const MAX_ATTEMPTS = 4;

export interface BlobUploadOptions {
  contentType: string;
  /** Non-secret tags for the indexer (subject, grade, lesson title). The owner always comes from the path. */
  metadata?: Record<string, string>;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

class BlobUploadError extends Error {}

export async function uploadToBlob(sasUrl: string, file: File, opts: BlobUploadOptions): Promise<void> {
  const blockCount = Math.max(1, Math.ceil(file.size / BLOCK_SIZE));
  const blockIds: string[] = [];
  let sentBytes = 0;

  for (let i = 0; i < blockCount; i++) {
    const start = i * BLOCK_SIZE;
    const chunk = file.slice(start, Math.min(start + BLOCK_SIZE, file.size));
    // Block ids must be base64 and the same length for every block in the blob.
    const blockId = btoa(`block-${String(i).padStart(6, "0")}`);
    blockIds.push(blockId);

    const url = `${sasUrl}&comp=block&blockid=${encodeURIComponent(blockId)}`;
    await withRetry(
      () =>
        putWithProgress(url, chunk, opts.signal, (loaded) =>
          opts.onProgress?.(Math.min(0.99, (sentBytes + loaded) / file.size)),
        ),
      opts.signal,
    );
    sentBytes += chunk.size;
  }

  const blockListXml =
    `<?xml version="1.0" encoding="utf-8"?><BlockList>` +
    blockIds.map((id) => `<Latest>${id}</Latest>`).join("") +
    `</BlockList>`;

  const headers: Record<string, string> = {
    "Content-Type": "application/xml",
    "x-ms-blob-content-type": opts.contentType,
  };
  for (const [key, value] of Object.entries(opts.metadata ?? {})) {
    // Metadata values must be ASCII. encodeURIComponent keeps "Señor" and Filipino text safe;
    // decode it in the indexer with the urlDecode field mapping function.
    headers[`x-ms-meta-${key}`] = encodeURIComponent(value);
  }

  await withRetry(async () => {
    const res = await fetch(`${sasUrl}&comp=blocklist`, {
      method: "PUT",
      headers,
      body: blockListXml,
      signal: opts.signal,
    });
    if (!res.ok) throw new HttpError(res.status);
  }, opts.signal);

  opts.onProgress?.(1);
}

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

function putWithProgress(
  url: string,
  body: Blob,
  signal: AbortSignal | undefined,
  onLoaded: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onLoaded(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new HttpError(xhr.status)));
    xhr.onerror = () => reject(new HttpError(0));
    xhr.ontimeout = () => reject(new HttpError(0));
    const abort = () => xhr.abort();
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(body);
  });
}

async function withRetry(fn: () => Promise<void>, signal?: AbortSignal): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      const status = err instanceof HttpError ? err.status : 0;
      // 403 means the SAS expired or doesn't cover this blob; retrying won't help.
      const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) {
        throw new BlobUploadError(
          status === 403
            ? "The upload link expired. Please try again."
            : "The upload didn't finish. Check your signal and try again.",
        );
      }
      await sleep(1000 * 2 ** (attempt - 1), signal); // 1s, 2s, 4s
    }
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Upload cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}
