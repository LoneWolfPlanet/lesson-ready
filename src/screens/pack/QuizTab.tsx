import { useState, type FormEvent } from "react";
import { packsApi } from "../../api/client";
import { asApiError } from "../../api/http";
import type { Pack, QuizQuestion } from "../../api/types";
import { Icon } from "../../components/Icon";
import type { Strings } from "../../i18n/strings";
import { letter } from "../../share";
import { IssueNotes } from "./IssueNotes";
import { saveErrorText } from "./saveError";

const MAX_QUESTIONS = 15;

/** The Quiz tab: every question with its answer, plus edit, add, remove and "Looks right". */
export function QuizTab({
  pack,
  t,
  canEdit,
  onSaved,
}: {
  pack: Pack;
  t: Strings;
  /** False offline or when showing the saved copy: edits need the API. */
  canEdit: boolean;
  onSaved(pack: Pack, message: string): void;
}) {
  /** A question index being edited, "new" for the add form, or nothing. */
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [marking, setMarking] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [rowError, setRowError] = useState<{ index: number; text: string } | null>(null);
  const busy = marking !== null || editing !== null || removing;
  const onlyOne = pack.quiz.length <= 1;

  const markCorrect = async (i: number) => {
    setMarking(i);
    setRowError(null);
    try {
      onSaved(await packsApi.updateQuestion(pack.id, pack.quiz[i]), t.questionMarked);
    } catch (e) {
      setRowError({ index: i, text: saveErrorText(asApiError(e), t, t.editInvalid) });
    } finally {
      setMarking(null);
    }
  };

  const remove = async (i: number) => {
    setRemoving(true);
    setRowError(null);
    try {
      const next = await packsApi.removeQuestion(pack.id, pack.quiz[i].id);
      setConfirmRemove(null);
      onSaved(next, t.questionRemoved);
    } catch (e) {
      const err = asApiError(e);
      setRowError({ index: i, text: err.kind === "conflict" ? t.quizNeedsOne : saveErrorText(err, t, t.editInvalid) });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="stack">
      {!canEdit && <p className="hint">{t.editOffline}</p>}
      {pack.issues.some((x) => x.section === "quiz" && x.index === undefined) && (
        <IssueNotes issues={pack.issues.filter((x) => x.section === "quiz" && x.index === undefined)} t={t} />
      )}
      <ol className="quiz-list">
        {pack.quiz.map((q, i) => {
          if (editing === i) {
            return (
              <li key={q.id} id={`q-${i}`} className="card quiz-item editing">
                <QuestionEditor
                  q={q}
                  title={t.editTitle(i + 1)}
                  t={t}
                  canSave={canEdit}
                  onCancel={() => setEditing(null)}
                  onSave={async (next) => {
                    const saved = await packsApi.updateQuestion(pack.id, next);
                    setEditing(null);
                    onSaved(saved, t.questionSaved);
                  }}
                />
              </li>
            );
          }
          const issue = pack.issues.find((x) => x.section === "quiz" && x.index === i);
          return (
            <li key={q.id} id={`q-${i}`} className={`card quiz-item${issue ? " flagged" : ""}`}>
              {issue && (
                <span className="flag-tag">
                  <Icon name="alert" size={14} /> {t.needsLook}: {issue.message}
                </span>
              )}
              <p className="q">
                <span className="qn">{i + 1}.</span> {q.prompt}
              </p>
              <ul className="options">
                {q.options.map((o, j) => (
                  <li key={j} className={j === q.answer ? "right" : ""}>
                    <b>{letter(j)}</b> {o}
                    {j === q.answer && <Icon name="check" size={16} strokeWidth={3} aria-label={t.answerLabel} />}
                  </li>
                ))}
              </ul>
              {q.explanation && <p className="hint">{q.explanation}</p>}

              <div className="q-tools">
                {q.added || q.checked ? (
                  <span className="q-checked">
                    <Icon name="check" size={14} strokeWidth={3} />{" "}
                    {q.added ? t.addedByYou : q.edited ? t.editedByYou : t.checkedByYou}
                  </span>
                ) : (
                  // Only where the review flagged something: it clears that one warning.
                  // Signing off the whole pack is "Mark as reviewed".
                  issue && (
                    <button type="button" className="btn small" disabled={!canEdit || busy} onClick={() => markCorrect(i)}>
                      <Icon name="check" size={16} strokeWidth={3} /> {marking === i ? t.saving : t.markCorrect}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="btn ghost small"
                  disabled={!canEdit || busy}
                  onClick={() => {
                    setRowError(null);
                    setConfirmRemove(null);
                    setEditing(i);
                  }}
                >
                  <Icon name="edit" size={16} /> {t.edit}
                </button>
                {!onlyOne && (
                  <button
                    type="button"
                    className="quiet-link push-right"
                    aria-expanded={confirmRemove === i}
                    disabled={!canEdit || busy}
                    onClick={() => {
                      setRowError(null);
                      setConfirmRemove(confirmRemove === i ? null : i);
                    }}
                  >
                    {t.removeQuestion}
                  </button>
                )}
              </div>

              {confirmRemove === i && (
                <div className="banner delete-confirm" role="alertdialog" aria-label={t.removeQuestionTitle(i + 1)}>
                  <b>{t.removeQuestionTitle(i + 1)}</b>
                  <span>{t.removeQuestionBody}</span>
                  <div className="q-tools">
                    <button type="button" className="btn small danger" disabled={removing} onClick={() => remove(i)}>
                      {removing ? t.deleting : t.removeQuestion}
                    </button>
                    <button type="button" className="link-btn" disabled={removing} onClick={() => setConfirmRemove(null)}>
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
              {rowError?.index === i && (
                <p className="error-inline" role="alert">
                  {rowError.text}
                </p>
              )}
            </li>
          );
        })}

        {editing === "new" && (
          <li className="card quiz-item editing">
            <QuestionEditor
              q={{ id: "new", prompt: "", options: ["", "", "", ""], answer: 0 }}
              title={t.newQuestionTitle}
              t={t}
              canSave={canEdit}
              onCancel={() => setEditing(null)}
              onSave={async (next) => {
                const saved = await packsApi.addQuestion(pack.id, next);
                setEditing(null);
                onSaved(saved, t.questionAdded);
              }}
            />
          </li>
        )}
      </ol>

      {editing !== "new" &&
        (pack.quiz.length < MAX_QUESTIONS ? (
          <button
            type="button"
            className="btn ghost"
            disabled={!canEdit || busy}
            onClick={() => {
              setRowError(null);
              setConfirmRemove(null);
              setEditing("new");
            }}
          >
            <Icon name="plus" size={18} /> {t.addQuestion}
          </button>
        ) : (
          <p className="hint">{t.quizFull}</p>
        ))}
    </div>
  );
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

/** The edit form for one question: wording, 2-4 answers, which one is correct, and why. */
function QuestionEditor({
  q,
  title,
  t,
  canSave,
  onCancel,
  onSave,
}: {
  q: QuizQuestion;
  title: string;
  t: Strings;
  canSave: boolean;
  onCancel(): void;
  /** Throws on failure; the form shows the error and keeps the teacher's text. */
  onSave(q: QuizQuestion): Promise<void>;
}) {
  const [prompt, setPrompt] = useState(q.prompt);
  const [options, setOptions] = useState(q.options);
  const [answer, setAnswer] = useState(Math.max(0, Math.min(q.answer, q.options.length - 1)));
  const [explanation, setExplanation] = useState(q.explanation ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const base = `edit-${q.id}`;

  const setOption = (j: number, value: string) => setOptions(options.map((o, k) => (k === j ? value : o)));
  const removeOption = (j: number) => {
    setOptions(options.filter((_, k) => k !== j));
    if (answer === j) setAnswer(0);
    else if (answer > j) setAnswer(answer - 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Answer boxes left empty are dropped, as long as two answers and the correct one remain.
    const rows = options.map((o, j) => ({ text: o.trim(), correct: j === answer })).filter((r) => r.text);
    if (!prompt.trim() || rows.length < MIN_OPTIONS || !rows.some((r) => r.correct)) return setError(t.editEmpty);
    const trimmed = rows.map((r) => r.text);
    const keys = trimmed.map((o) => o.toLowerCase().replace(/\s+/g, " "));
    if (new Set(keys).size !== keys.length) return setError(t.editDuplicate);

    setSaving(true);
    setError("");
    try {
      await onSave({
        ...q,
        prompt: prompt.trim(),
        options: trimmed,
        answer: rows.findIndex((r) => r.correct),
        explanation: explanation.trim() || undefined,
      });
    } catch (err) {
      setError(saveErrorText(asApiError(err), t, t.editInvalid));
      setSaving(false);
    }
  };

  return (
    <form className="q-editor" onSubmit={submit} noValidate>
      <h3 className="q-editor-title">{title}</h3>

      <label className="field" htmlFor={`${base}-q`}>
        <span className="label">{t.questionField}</span>
        <textarea
          id={`${base}-q`}
          className="input"
          rows={3}
          maxLength={500}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-invalid={!!error && !prompt.trim()}
        />
      </label>

      <fieldset className="field">
        <legend className="label">{t.answersField}</legend>
        <span className="hint">{t.answersHint}</span>
        <ul className="opt-edit-list">
          {options.map((o, j) => (
            <li key={j} className={`opt-edit${j === answer ? " right" : ""}`}>
              <label className="opt-radio" title={t.correctAnswerN(letter(j))}>
                <input
                  type="radio"
                  id={`${base}-correct-${j}`}
                  name={`${base}-correct`}
                  checked={j === answer}
                  onChange={() => setAnswer(j)}
                  aria-label={t.correctAnswerN(letter(j))}
                />
                <b aria-hidden="true">{letter(j)}</b>
              </label>
              <input
                id={`${base}-opt-${j}`}
                className="input"
                maxLength={200}
                value={o}
                onChange={(e) => setOption(j, e.target.value)}
                aria-label={t.answerN(letter(j))}
                aria-invalid={!!error && !o.trim()}
              />
              {options.length > MIN_OPTIONS && (
                <button type="button" className="icon-btn" aria-label={t.removeAnswer(letter(j))} onClick={() => removeOption(j)}>
                  <Icon name="close" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {options.length < MAX_OPTIONS && (
          <button type="button" className="link-btn" onClick={() => setOptions([...options, ""])}>
            <Icon name="plus" size={16} /> {t.addAnswer}
          </button>
        )}
      </fieldset>

      <label className="field" htmlFor={`${base}-why`}>
        <span className="label">
          {t.explanationField} <span className="label-note">{t.optional}</span>
        </span>
        <textarea
          id={`${base}-why`}
          className="input"
          rows={2}
          maxLength={1000}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </label>

      {error && (
        <p className="error-inline" role="alert">
          {error}
        </p>
      )}

      <div className="q-tools">
        <button type="submit" className="btn small" disabled={saving || !canSave}>
          {saving ? t.saving : t.save}
        </button>
        <button type="button" className="btn ghost small" disabled={saving} onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
