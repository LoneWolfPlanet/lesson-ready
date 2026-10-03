import type { Pack } from "../../api/types";
import type { Strings } from "../../i18n/strings";
import { letter } from "../../share";

/** Everything on one page, only visible when printing or saving as PDF. */
export function PrintView({ pack, t }: { pack: Pack; t: Strings }) {
  return (
    <article className="print-only">
      <h1>{pack.topic}</h1>
      <p>{t.gradeN(pack.grade)}</p>
      {pack.overview && <p>{pack.overview}</p>}
      {pack.objectives.length > 0 && (
        <>
          <h2>{t.objectives}</h2>
          <ul>
            {pack.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </>
      )}
      <h2>{t.tabLesson}</h2>
      {pack.sections.map((sec, i) => (
        <div key={i}>
          <h3>
            {i + 1}. {sec.title}
          </h3>
          <p>{sec.body}</p>
        </div>
      ))}
      {pack.activity && (
        <>
          <h2>
            {t.activity}: {pack.activity.title}
          </h2>
          {pack.activity.materials.length > 0 && (
            <p>
              <b>{t.materials}:</b> {pack.activity.materials.join(", ")}
            </p>
          )}
          <ol>
            {pack.activity.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
        </>
      )}
      {pack.vocabulary.length > 0 && (
        <>
          <h2>{t.vocabulary}</h2>
          <ul>
            {pack.vocabulary.map((v, i) => (
              <li key={i}>
                <b>{v.term}</b> – {v.definition}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>{t.tabQuiz}</h2>
      <ol>
        {pack.quiz.map((q, i) => (
          <li key={i}>
            {q.prompt}
            <ol type="A">
              {q.options.map((o, j) => (
                <li key={j}>{o}</li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <p>
        <b>{t.answerLabel}:</b> {pack.quiz.map((q, i) => `${i + 1}${letter(q.answer)}`).join("  ")}
      </p>
      {pack.notes.length > 0 && (
        <>
          <h2>{t.tabNotes}</h2>
          <ul>
            {pack.notes.map((n, i) => (
              <li key={i}>☐ {n}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
