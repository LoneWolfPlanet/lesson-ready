import { useState } from "react";
import type { Pack } from "../../api/types";
import type { Strings } from "../../i18n/strings";
import { prefs } from "../../prefs";
import { IssueNotes } from "./IssueNotes";

/** The Notes tab: the teacher's preparation checklist. Ticks stay on this device. */
export function NotesTab({ pack, t }: { pack: Pack; t: Strings }) {
  const [checked, setChecked] = useState<number[]>(() => prefs.notesChecked(pack.id));
  const toggle = (i: number) => {
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    setChecked(next);
    prefs.setNotesChecked(pack.id, next);
  };
  return (
    <div className="stack">
      <p className="hint">{pack.notes.length ? t.notesHint : t.noNotes}</p>
      <ul className="checklist">
        {pack.notes.map((n, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
              <span>{n}</span>
            </label>
          </li>
        ))}
      </ul>
      {pack.issues.some((i) => i.section === "notes") && <IssueNotes issues={pack.issues.filter((i) => i.section === "notes")} t={t} />}
    </div>
  );
}
