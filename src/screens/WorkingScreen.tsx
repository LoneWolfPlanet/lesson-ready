import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import type { WorkStage } from "../api/types";
import { Icon } from "../components/Icon";
import { BottomNav, ErrorMessage, Spinner } from "../components/ui";
import { config } from "../config";
import { usePack } from "../hooks/usePack";
import { useUi } from "../i18n/UiContext";

const ORDER: WorkStage[] = ["planning", "writing", "checking", "done"];

/** Screen 3: a calm progress card instead of a spinner. The teacher may leave. */
export function WorkingScreen() {
  const { id } = useParams();
  const { pack, error, stalled, reload } = usePack(id);
  const { t } = useUi();
  const navigate = useNavigate();

  if (pack && (pack.status === "ready" || pack.status === "check" || pack.status === "reviewed")) {
    return <Navigate to={`/packs/${pack.id}`} replace />;
  }

  if (!pack) {
    return (
      <>
        <main className="screen">{error ? <ErrorMessage error={error} onRetry={reload} /> : <Spinner />}</main>
        <BottomNav />
      </>
    );
  }

  if (pack.status === "failed") {
    const notInLibrary = pack.failureKind === "unavailable";
    return (
      <>
        <main className="screen">
          <div className="card stack gap-lg">
            <span className="icon-badge warn">
              <Icon name="alert" />
            </span>
            <h1 className="title">{notInLibrary ? t.unavailableTitle : t.failedTitle}</h1>
            <p className="sub">{pack.failureReason ?? (notInLibrary ? t.unavailableDefault : t.failedDefault)}</p>
            <button
              type="button"
              className="btn"
              onClick={() =>
                // Not in the library: start fresh with the same grade. Error: retry the same topic.
                navigate("/new", { state: notInLibrary ? { grade: pack.grade } : { topic: pack.topic, grade: pack.grade } })
              }
            >
              {notInLibrary ? t.tryAnotherTopic : t.tryAgain}
            </button>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  const current = ORDER.indexOf(pack.stage);
  const steps = [t.stepPlan, t.stepWrite, t.stepCheck(pack.grade), t.stepReady];
  const percent = Math.round(((current + 0.5) / ORDER.length) * 100);

  return (
    <>
      <main className="screen">
        <p className="sub">
          {pack.topic} · {t.gradeN(pack.grade)}
        </p>
        <div className="card stack gap-lg" aria-live="polite">
          <div className="stack gap-sm">
            <h1 className="title">{t.writingTitle}</h1>
            <p className="sub">{t.aboutMinutes(config.expectedMinutes)}</p>
          </div>
          <div
            className="bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <i style={{ width: `${percent}%` }} />
          </div>
          <ol className="steps">
            {steps.map((label, i) => (
              <li key={label} className={i > current ? "later" : ""}>
                <span className={`st ${i < current ? "done" : i === current ? "now" : ""}`}>
                  {i < current ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>

        {error && <ErrorMessage error={error} />}

        {stalled ? (
          <div className="error-box" role="status">
            <Icon name="alert" />
            <p>{t.takingLong}</p>
            <button type="button" className="btn ghost small" onClick={reload}>
              {t.checkAgain}
            </button>
          </div>
        ) : (
          <p className="hint">{t.canLeave}</p>
        )}
        <div className="spacer" />
        <Link to="/packs" className="btn ghost">
          {t.goToPacks}
        </Link>
      </main>
      <BottomNav />
    </>
  );
}
