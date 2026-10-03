import type { ReviewIssue } from "../../api/types";
import { Icon } from "../../components/Icon";
import type { Strings } from "../../i18n/strings";

/** A "Check this" box listing review notes for one part of the pack. */
export function IssueNotes({ issues, t }: { issues: ReviewIssue[]; t: Strings }) {
  return (
    <div className="card flagged">
      <span className="flag-tag">
        <Icon name="alert" size={14} /> {t.needsLook}
      </span>
      {issues.map((i, k) => (
        <p key={k}>{i.message}</p>
      ))}
    </div>
  );
}
