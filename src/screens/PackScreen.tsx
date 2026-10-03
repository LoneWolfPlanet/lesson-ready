import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { packsApi } from "../api/client";
import { asApiError } from "../api/http";
import type { Pack, QuizQuestion, ReviewIssue } from "../api/types";
import { Icon } from "../components/Icon";
import { ErrorMessage, Spinner, StatusPill } from "../components/ui";
import { useOnline, usePack } from "../hooks/usePack";
import type { Strings } from "../i18n/strings";
import { useUi } from "../i18n/UiContext";
import { prefs } from "../prefs";
import { letter, sharePack } from "../share";
import { EditTools, LessonEditor, NotesEditor, ReviewControl, saveErrorText } from "./PackEditors";

type Tab = "lesson" | "quiz" | "notes";
const TABS: Tab[] = ["lesson", "quiz", "notes"];

/** Screens 4, 6 and 7: the pack, laid out for the real schema, with the review banner. */
export function PackScreen() {
  const { id } = useParams();
  const { pack, fromCache, error, reload, replace } = usePack(id);
  const online = useOnline();
  const { t, lang, textSize, setTextSize } = useUi();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  /** The Lesson or Notes tab being edited; tabs and actions wait until it is saved or cancelled. */
  const [editing, setEditing] = useState<"lesson" | "notes" | null>(null);
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "lesson") as Tab;

  // Scroll to a flagged item after its tab has rendered.
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(focusId);
    if (!el) return; // tab not rendered yet; runs again when `tab` changes
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFocusId(null);
  }, [focusId, tab]);

  useEffect(() => {
    if (!toast) return;
    const h = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(h);
  }, [toast]);

  if (!pack) {
    return (
      <main className="screen">
        <BackLink />
        {error ? <ErrorMessage error={error} onRetry={reload} /> : <Spinner />}
      </main>
    );
  }
  if (pack.status === "working" || pack.status === "failed") {
    return <Navigate to={`/packs/${pack.id}/working`} replace />;
  }

  const canEdit = online && !fromCache;
  // Once the teacher has marked it reviewed, review notes are hidden everywhere. Undo brings them back.
  const shown: Pack = pack.status === "reviewed" ? { ...pack, issues: [] } : pack;
  const saved = (next: Pack, message: string) => {
    replace(next);
    setToast(message);
  };
  const setTab = (next: Tab, focus?: string) => {
    setParams({ tab: next }, { replace: true });
    if (focus) setFocusId(focus);
  };

  const onShare = async () => {
    const result = await sharePack(pack, t).catch(() => "cancelled" as const);
    if (result === "copied") setToast(t.shareCopied);
  };

  return (
    <div className="pack-layout">
      <main className="screen no-print">
        <div className="row">
          <BackLink />
          <button
            type="button"
            className="icon-btn"
            aria-pressed={textSize !== "normal"}
            aria-label={t.textSize}
            title={t.textSize}
            onClick={() => setTextSize(textSize === "small" ? "normal" : textSize === "normal" ? "large" : "small")}
          >
            <Icon name="textSize" />
          </button>
        </div>

        <header className="stack gap-sm">
          <h1 className="title">{pack.topic}</h1>
          <p className="sub">
            {t.gradeN(pack.grade)} · {t.questionsN(pack.quiz.length)}
          </p>
          <div className="row start gap-sm wrap">
            <StatusPill status={pack.status} />
            {pack.reviewed && pack.status !== "reviewed" && <span className="reviewed">{t.reviewed}</span>}
            {fromCache && (
              <span className="saved">
                <Icon name="offline" size={14} /> {t.savedOffline}
              </span>
            )}
          </div>
        </header>

        {fromCache && <p className="hint">{t.showingSaved}</p>}

        {editing === null && <ReviewControl pack={pack} t={t} lang={lang} canEdit={canEdit} onSaved={saved} />}

        {/* Once the teacher has signed it off, the notes stay on each item but the banner goes. */}
        {shown.issues.length > 0 && <ReviewBanner issues={shown.issues} t={t} onOpen={setTab} />}

        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? "on" : ""}
              disabled={editing !== null && tab !== k}
              onClick={() => setTab(k)}
            >
              {k === "lesson" ? t.tabLesson : k === "quiz" ? `${t.tabQuiz} · ${pack.quiz.length}` : t.tabNotes}
            </button>
          ))}
        </div>

        <section role="tabpanel">
          {tab === "lesson" &&
            (editing === "lesson" ? (
              <LessonEditor
                pack={pack}
                t={t}
                canSave={canEdit}
                onCancel={() => setEditing(null)}
                onSave={async (draft) => {
                  const next = await packsApi.updateLesson(pack.id, draft);
                  setEditing(null);
                  saved(next, t.lessonSaved);
                }}
              />
            ) : (
              <div className="stack gap-lg">
                <EditTools
                  t={t}
                  checked={pack.lessonChecked}
                  edited={pack.lessonEdited}
                  editLabel={t.editLesson}
                  canEdit={canEdit}
                  onEdit={() => setEditing("lesson")}
                />
                <LessonView pack={shown} t={t} />
              </div>
            ))}
          {tab === "quiz" && (
            <QuizView
              pack={shown}
              t={t}
              canEdit={canEdit}
              onSaved={saved}
            />
          )}
          {tab === "notes" &&
            (editing === "notes" ? (
              <NotesEditor
                pack={pack}
                t={t}
                canSave={canEdit}
                onCancel={() => setEditing(null)}
                onSave={async (notes) => {
                  const next = await packsApi.updateNotes(pack.id, notes);
                  // Ticks are stored by position, so they no longer match once the list changes.
                  if (notes.join("\n") !== pack.notes.join("\n")) prefs.setNotesChecked(pack.id, []);
                  setEditing(null);
                  saved(next, t.notesSaved);
                }}
              />
            ) : (
              <div className="stack gap-lg">
                <EditTools
                  t={t}
                  checked={pack.notesChecked}
                  edited={pack.notesEdited}
                  editLabel={t.editNotes}
                  canEdit={canEdit}
                  onEdit={() => setEditing("notes")}
                />
                <NotesView key={pack.notes.join("\n")} pack={shown} t={t} />
              </div>
            ))}
        </section>
      </main>

      {/* Hidden while editing, so the editor's own Save bar is the only one at the bottom. */}
      {editing === null && (
        <div className="actions no-print">
          <button type="button" className="main" onClick={() => navigate(`/packs/${pack.id}/quiz`)} disabled={!pack.quiz.length}>
            <i>
              <Icon name="play" />
            </i>
            {t.quizMode}
          </button>
          <button type="button" onClick={onShare}>
            <i>
              <Icon name="share" />
            </i>
            {t.share}
          </button>
          <button type="button" onClick={() => window.print()}>
            <i>
              <Icon name="print" />
            </i>
            {t.print}
          </button>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <PrintView pack={pack} t={t} />
    </div>
  );
}

function BackLink() {
  const { t } = useUi();
  return (
    <Link to="/packs" className="back-link">
      <Icon name="back" size={18} /> {t.myPacks}
    </Link>
  );
}

function ReviewBanner({ issues, t, onOpen }: { issues: ReviewIssue[]; t: Strings; onOpen(tab: Tab, focus?: string): void }) {
  return (
    <div className="banner" role="note">
      <b>{t.checkBannerTitle}</b>
      <span>{t.checkBannerBody}</span>
      <ul>
        {issues.map((iss, i) => (
          <li key={i}>
            <button
              type="button"
              className="link-btn"
              onClick={() => onOpen(iss.section, iss.section === "quiz" && iss.index !== undefined ? `q-${iss.index}` : undefined)}
            >
              {iss.section === "quiz" && iss.index !== undefined ? `${t.questionN(iss.index + 1)}: ` : ""}
              {iss.message}
              <Icon name="chevron" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LessonView({ pack, t }: { pack: Pack; t: Strings }) {
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

const MAX_QUESTIONS = 15;

function QuizView({
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

function NotesView({ pack, t }: { pack: Pack; t: Strings }) {
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

function IssueNotes({ issues, t }: { issues: ReviewIssue[]; t: Strings }) {
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

/** Everything on one page, only visible when printing or saving as PDF. */
function PrintView({ pack, t }: { pack: Pack; t: Strings }) {
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
