import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ErrorMessage, Spinner } from "../components/ui";
import { usePack } from "../hooks/usePack";
import { useUi } from "../i18n/UiContext";
import { letter } from "../share";

/** Screen 5: one question at a time, large type, for projecting to the class. */
export function QuizModeScreen() {
  const { id } = useParams();
  const { pack, error, reload } = usePack(id);
  const { t } = useUi();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);

  const total = pack?.quiz.length ?? 0;
  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    navigate(`/packs/${id}?tab=quiz`);
  }, [navigate, id]);
  const go = useCallback(
    (d: number) => {
      setShown(false);
      setI((n) => Math.min(total - 1, Math.max(0, n + d)));
    },
    [total],
  );

  // Keyboard / presentation-clicker support: arrows move, space or enter reveals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setShown(true);
      } else if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exit]);

  if (!pack) {
    return <main className="screen quiz-mode">{error ? <ErrorMessage error={error} onRetry={reload} /> : <Spinner />}</main>;
  }
  if (!total) return <Navigate to={`/packs/${pack.id}`} replace />;

  const q = pack.quiz[i];
  const last = i === total - 1;

  return (
    <main className="screen quiz-mode">
      <div className="row">
        <span className="q-count">{t.questionOf(i + 1, total)}</span>
        <div className="row gap-sm">
          {document.fullscreenEnabled && !document.fullscreenElement && (
            <button type="button" className="icon-btn dark" onClick={() => void document.documentElement.requestFullscreen()} aria-label="Fullscreen">
              <Icon name="expand" />
            </button>
          )}
          <button type="button" className="icon-btn dark" onClick={exit} aria-label={t.exit}>
            <Icon name="close" />
          </button>
        </div>
      </div>

      <h1 className="q-big">{q.prompt}</h1>

      <ul className="opts">
        {q.options.map((o, j) => (
          <li key={j} className={shown && j === q.answer ? "right" : ""}>
            <b>{letter(j)}</b>
            <span>{o}</span>
          </li>
        ))}
      </ul>

      {shown && q.explanation && <p className="q-explain">{q.explanation}</p>}

      <div className="spacer" />

      <div className={`q-nav${shown ? " two" : ""}`}>
        <button type="button" onClick={() => go(-1)} disabled={i === 0}>
          {t.prev}
        </button>
        {!shown ? (
          <button type="button" className="go" onClick={() => setShown(true)}>
            {t.showAnswer}
          </button>
        ) : last ? (
          <button type="button" className="go" onClick={exit}>
            {t.finish}
          </button>
        ) : (
          <button type="button" className="go" onClick={() => go(1)}>
            {t.next}
          </button>
        )}
        {/* Skip ahead without revealing; hidden once the answer is shown. */}
        {!shown && (
          <button type="button" onClick={() => go(1)} disabled={last}>
            {t.next}
          </button>
        )}
      </div>
    </main>
  );
}
