import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { packsApi } from "../../api/client";
import type { Pack, ReviewIssue } from "../../api/types";
import { Icon } from "../../components/Icon";
import { ErrorMessage, Spinner, StatusPill } from "../../components/ui";
import { useOnline, usePack } from "../../hooks/usePack";
import type { Strings } from "../../i18n/strings";
import { useUi } from "../../i18n/UiContext";
import { prefs } from "../../prefs";
import { sharePack } from "../../share";
import { EditTools, LessonEditor, NotesEditor } from "./editors";
import { LessonTab } from "./LessonTab";
import { NotesTab } from "./NotesTab";
import { PrintView } from "./PrintView";
import { QuizTab } from "./QuizTab";
import { ReviewControl } from "./ReviewControl";

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
  /** A quiz question (or a new one) is open in its editor. */
  const [quizEditing, setQuizEditing] = useState(false);
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
    setQuizEditing(false);
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
            {[t.gradeN(pack.grade), pack.subject.trim(), t.questionsN(pack.quiz.length)].filter(Boolean).join(" · ")}
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

        {/* What to check comes first, then the sign-off. Once reviewed, the banner goes away. */}
        {shown.issues.length > 0 && <ReviewBanner issues={shown.issues} t={t} onOpen={setTab} />}

        {editing === null && !quizEditing && (
          <ReviewControl pack={pack} t={t} lang={lang} canEdit={canEdit} onSaved={saved} />
        )}

        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? "on" : ""}
              disabled={(editing !== null || quizEditing) && tab !== k}
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
                <LessonTab pack={shown} t={t} />
              </div>
            ))}
          {tab === "quiz" && (
            <QuizTab
              pack={shown}
              t={t}
              canEdit={canEdit}
              onSaved={saved}
              onEditingChange={setQuizEditing}
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
                <NotesTab key={pack.notes.join("\n")} pack={shown} t={t} />
              </div>
            ))}
        </section>
      </main>

      {/* Hidden while editing, so the editor's own Save bar is the only one at the bottom. */}
      {editing === null && !quizEditing && (
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
