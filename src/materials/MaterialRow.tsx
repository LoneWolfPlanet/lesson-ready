// One file in "My materials", with the plain-word status pills from the design.

import { useState } from "react";
import type { Strings } from "../i18n/strings";
import { useUi } from "../i18n/UiContext";
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

function viewFor(m: Material, t: Strings, local?: LocalUpload): View {
  if (local?.state === "error") return { pill: "err", label: t.matDidntUpload, detail: local.error };
  if (local?.state === "sending") return { pill: "run", label: t.matUploading };
  switch (m.status) {
    case "ready":
      return { pill: "ok", label: t.matReady };
    case "indexing":
      return { pill: "run", label: t.matReading };
    case "failed":
      return { pill: "err", label: t.matCouldntRead, detail: m.error ?? t.matReadFailed };
    case "uploading": {
      const stale = Date.now() - new Date(m.createdAt).getTime() > STALE_UPLOAD_MS;
      return stale ? { pill: "err", label: t.matDidntUpload, detail: t.matUploadStopped } : { pill: "run", label: t.matUploading };
    }
  }
}

export function MaterialRow({ material: m, local, onRetry, onRemove }: Props) {
  const { t } = useUi();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const view = viewFor(m, t, local);
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
          {view.detail ?? `${m.subject} · ${t.gradeN(m.grade)} · ${formatBytes(m.sizeBytes)}`}
        </div>
        {local?.state === "sending" && (
          <div
            className="mat-upbar"
            role="progressbar"
            aria-label={t.matUploadingName(m.lessonTitle)}
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
                {t.retry}
              </button>
            )}
            <button type="button" className="mat-link" onClick={() => setConfirming(true)}>
              {t.matRemove}
            </button>
          </div>
        )}
        {view.pill !== "err" && !confirming && (
          <div className="mat-row-actions">
            <button type="button" className="mat-link mat-link-quiet" onClick={() => setConfirming(true)}>
              {t.matRemove}
            </button>
          </div>
        )}
        {confirming && (
          <div className="mat-row-actions">
            <span className="mat-meta">{t.matRemoveConfirm}</span>
            <button type="button" className="mat-link mat-link-danger" onClick={remove} disabled={removing}>
              {removing ? t.deleting : t.matYesRemove}
            </button>
            <button type="button" className="mat-link" onClick={() => setConfirming(false)} disabled={removing}>
              {t.matKeep}
            </button>
          </div>
        )}
      </div>
      <span className={`mat-pill ${view.pill}`}>{view.label}</span>
    </li>
  );
}
