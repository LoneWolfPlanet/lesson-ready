import type { Pack } from "../../api/types";
import { Icon } from "../../components/Icon";
import type { Strings } from "../../i18n/strings";
import { IssueNotes } from "./IssueNotes";

/** The Lesson tab: overview, goals, parts, activity, key words, and any lesson review notes. */
export function LessonTab({ pack, t }: { pack: Pack; t: Strings }) {
  const lessonIssues = pack.issues.filter((i) => i.section === "lesson");
  return (
    <div className="stack gap-lg">
      {pack.overview && <p className="overview">{pack.overview}</p>}

      {pack.objectives.length > 0 && (
        <div className="card">
          <span className="label">{t.objectives}</span>
          <ul className="objectives">
            {pack.objectives.map((o, i) => (
              <li key={i}>
                <Icon name="check" size={16} strokeWidth={3} />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pack.sections.length > 0 && (
        <ol className="sections">
          {pack.sections.map((sec, i) => (
            <li key={i} className="section">
              <span className="section-n">{i + 1}</span>
              <div>
                <h3>{sec.title}</h3>
                <p>{sec.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pack.activity && (
        <div className="card activity">
          <span className="label">{t.activity}</span>
          <h3>{pack.activity.title}</h3>
          {pack.activity.materials.length > 0 && (
            <>
              <b className="small-head">{t.materials}</b>
              <ul className="materials">
                {pack.activity.materials.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          )}
          <ol className="activity-steps">
            {pack.activity.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
        </div>
      )}

      {pack.vocabulary.length > 0 && (
        <div className="card">
          <span className="label">{t.vocabulary}</span>
          <dl className="vocab">
            {pack.vocabulary.map((v, i) => (
              <div key={i}>
                <dt>{v.term}</dt>
                <dd>{v.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {lessonIssues.length > 0 && <IssueNotes issues={lessonIssues} t={t} />}
    </div>
  );
}
