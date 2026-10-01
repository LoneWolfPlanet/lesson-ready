import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Pack, ReviewIssue } from "../api/types";
import { Icon } from "../components/Icon";
import { ErrorMessage, Spinner, StatusPill } from "../components/ui";
import { usePack } from "../hooks/usePack";
import type { Strings } from "../i18n/strings";
import { useUi } from "../i18n/UiContext";
import { prefs } from "../prefs";
import { letter, sharePack } from "../share";

type Tab = "lesson" | "quiz" | "notes";
const TABS: Tab[] = ["lesson", "quiz", "notes"];

/** Screens 4, 6 and 7: the pack, laid out for the real schema, with the review banner. */
export function PackScreen() {
  const { id } = useParams();
  const { pack, fromCache, error, reload } = usePack(id);
  const { t, textSize, setTextSize } = useUi();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
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
            aria-pressed={textSize === "large"}
            aria-label={t.textSize}
            title={t.textSize}
            onClick={() => setTextSize(textSize === "large" ? "normal" : "large")}
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
            {pack.reviewed && <span className="reviewed">{t.reviewed}</span>}
            {fromCache && (
              <span className="saved">
                <Icon name="offline" size={14} /> {t.savedOffline}
              </span>
            )}
          </div>
        </header>

        {fromCache && <p className="hint">{t.showingSaved}</p>}

        {pack.issues.length > 0 && <ReviewBanner issues={pack.issues} t={t} onOpen={setTab} />}

        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? "on" : ""}
              onClick={() => setTab(k)}
            >
              {k === "lesson" ? t.tabLesson : k === "quiz" ? `${t.tabQuiz} · ${pack.quiz.length}` : t.tabNotes}
            </button>
          ))}
        </div>

        <section role="tabpanel">
          {tab === "lesson" && <LessonView pack={pack} t={t} />}
          {tab === "quiz" && <QuizView pack={pack} t={t} />}
          {tab === "notes" && <NotesView pack={pack} t={t} />}
        </section>
      </main>

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

function QuizView({ pack, t }: { pack: Pack; t: Strings }) {
  return (
    <ol className="quiz-list">
      {pack.quiz.map((q, i) => {
        const issue = pack.issues.find((x) => x.section === "quiz" && x.index === i);
        return (
          <li key={i} id={`q-${i}`} className={`card quiz-item${issue ? " flagged" : ""}`}>
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
          </li>
        );
      })}
    </ol>
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
      <p className="hint">{t.notesHint}</p>
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
