// One file in "My materials", with the plain-word status pills from the design.

import { useState } from "react";
import { formatBytes } from "./format";
import { ACCEPTED_TYPES, type LocalUpload, type Material } from "./types";

/** A record still "uploading" on the server with no upload running here was interrupted (tab closed, phone slept). */
const STALE_UPLOAD_MS = 15 * 60 * 1000;

interface Props {
  material: Material;
  local?: LocalUpload;
  onRetry: () => void;
  onRemove: () => Promise<void>;
}

type View = { pill: "ok" | "run" | "err"; label: string; detail?: string };

function viewFor(m: Material, local?: LocalUpload): View {
  if (local?.state === "error") return { pill: "err", label: "Didn't upload", detail: local.error };
  if (local?.state === "sending") return { pill: "run", label: "Uploading" };
  switch (m.status) {
    case "ready":
      return { pill: "ok", label: "Ready" };
    case "indexing":
      return { pill: "run", label: "Reading" };
    case "failed":
      return { pill: "err", label: "Couldn't read", detail: m.error ?? "We couldn't read this file." };
    case "uploading": {
      const stale = Date.now() - new Date(m.createdAt).getTime() > STALE_UPLOAD_MS;
      return stale
        ? { pill: "err", label: "Didn't upload", detail: "The upload stopped. Remove it and add the file again." }
        : { pill: "run", label: "Uploading" };
    }
  }
}

export function MaterialRow({ material: m, local, onRetry, onRemove }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const view = viewFor(m, local);
  const typeLabel = ACCEPTED_TYPES[m.contentType]?.label ?? "FILE";

  async function remove() {
    setRemoving(true);
    try {
      await onRemove();
    } catch {
      setRemoving(false);
      setConfirming(false);
    }
  }

  return (
    <li className="mat-file">
      <i className="mat-file-icon">{typeLabel}</i>
      <div className="mat-file-text">
        <div className="mat-file-name">{m.lessonTitle}</div>
        <div className="mat-meta">
          {view.detail ?? `${m.subject} · Grade ${m.grade} · ${formatBytes(m.sizeBytes)}`}
        </div>
        {local?.state === "sending" && (
          <div
            className="mat-upbar"
            role="progressbar"
            aria-label={`Uploading ${m.lessonTitle}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(local.progress * 100)}
          >
            <i style={{ width: `${Math.round(local.progress * 100)}%` }} />
          </div>
        )}
        {view.pill === "err" && !confirming && (
          <div className="mat-row-actions">
            {local?.state === "error" && (
              <button type="button" className="mat-link" onClick={onRetry}>
                Try again
              </button>
            )}
            <button type="button" className="mat-link" onClick={() => setConfirming(true)}>
              Remove
            </button>
          </div>
        )}
        {view.pill !== "err" && !confirming && (
          <div className="mat-row-actions">
            <button type="button" className="mat-link mat-link-quiet" onClick={() => setConfirming(true)}>
              Remove
            </button>
          </div>
        )}
        {confirming && (
          <div className="mat-row-actions">
            <span className="mat-meta">Remove this file?</span>
            <button type="button" className="mat-link mat-link-danger" onClick={remove} disabled={removing}>
              {removing ? "Removing…" : "Yes, remove"}
            </button>
            <button type="button" className="mat-link" onClick={() => setConfirming(false)} disabled={removing}>
              Keep
            </button>
          </div>
        )}
      </div>
      <span className={`mat-pill ${view.pill}`}>{view.label}</span>
    </li>
  );
}
