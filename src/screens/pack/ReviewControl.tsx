import { useState } from "react";
import { packsApi } from "../../api/client";
import { asApiError } from "../../api/http";
import type { Pack } from "../../api/types";
import { Icon } from "../../components/Icon";
import type { Strings } from "../../i18n/strings";
import { saveErrorText } from "./saveError";

/**
 * The teacher's sign-off. Ready to use / Check before use -> "Mark as reviewed";
 * Reviewed -> the date and "Undo". Asks first when review notes are still open.
 */
export function ReviewControl({
  pack,
  t,
  lang,
  canEdit,
  onSaved,
}: {
  pack: Pack;
  t: Strings;
  lang: string;
  canEdit: boolean;
  onSaved(pack: Pack, message: string): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = async (reviewed: boolean) => {
    setSaving(true);
    setError("");
    try {
      const next = await packsApi.setReviewed(pack.id, reviewed);
      setConfirming(false);
      onSaved(next, reviewed ? t.markedReviewed : t.unmarkedReviewed);
    } catch (e) {
      setError(saveErrorText(asApiError(e), t, t.errServer));
    } finally {
      setSaving(false);
    }
  };

  const errorLine = error && (
    <p className="error-inline" role="alert">
      {error}
    </p>
  );

  if (pack.status === "reviewed") {
    const date = pack.reviewedAt
      ? new Date(pack.reviewedAt).toLocaleDateString(lang === "fil" ? "fil-PH" : "en-PH", { month: "short", day: "numeric", year: "numeric" })
      : "";
    return (
      <div className="review-control">
        <div className="row start gap-sm wrap">
          {date && <span className="hint">{t.reviewedOn(date)}</span>}
          <button type="button" className="link-btn" disabled={!canEdit || saving} onClick={() => set(false)}>
            {saving ? t.saving : t.undoReviewed}
          </button>
        </div>
        {errorLine}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="review-control banner" role="alertdialog" aria-label={t.markReviewed}>
        <span>{t.reviewConfirm(pack.issues.length)}</span>
        <div className="q-tools">
          <button type="button" className="btn small" disabled={!canEdit || saving} onClick={() => set(true)}>
            {saving ? t.saving : t.markReviewed}
          </button>
          <button type="button" className="btn ghost small" disabled={saving} onClick={() => setConfirming(false)}>
            {t.cancel}
          </button>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div className="review-control">
      <button
        type="button"
        className="btn small"
        disabled={!canEdit || saving}
        onClick={() => (pack.issues.length ? setConfirming(true) : set(true))}
      >
        <Icon name="check" size={16} strokeWidth={3} /> {saving ? t.saving : t.markReviewed}
      </button>
      {errorLine}
    </div>
  );
}
