import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { packsApi } from "../api/client";
import { asApiError, type ApiError } from "../api/http";
import { GRADES, type Grade } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { BottomNav, ErrorMessage, LangToggle } from "../components/ui";
import { Icon } from "../components/Icon";
import { SUGGESTIONS } from "../data/suggestions";
import { useUi } from "../i18n/UiContext";
import { prefs } from "../prefs";

interface Prefill {
  topic?: string;
  grade?: Grade;
}

/** Screen 2: one question on screen; the last grade is remembered. */
export function NewPackScreen() {
  const { user } = useAuth();
  const { t, lang } = useUi();
  const navigate = useNavigate();
  const prefill = (useLocation().state ?? {}) as Prefill;

  const [topic, setTopic] = useState(prefill.topic ?? "");
  const [grade, setGrade] = useState<Grade | null>(prefill.grade ?? prefs.lastGrade());
  const [remembered] = useState(() => !prefill.grade && prefs.lastGrade() !== null);
  const [showHow, setShowHow] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [needTopic, setNeedTopic] = useState(false);
  const recent = prefs.recentTopics();

  const hour = new Date().getHours();
  const name = user?.firstName ?? "";
  const greeting = hour < 12 ? t.goodMorning(name) : hour < 18 ? t.goodAfternoon(name) : t.goodEvening(name);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = topic.trim();
    if (!clean || !grade) {
      setNeedTopic(!clean);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const id = await packsApi.create({ topic: clean, grade, language: lang });
      prefs.setLastGrade(grade);
      prefs.addRecentTopic(clean);
      navigate(`/packs/${id}/working`);
    } catch (err) {
      setError(asApiError(err));
      setSending(false);
    }
  }

  const chips = grade ? SUGGESTIONS[grade].filter((s) => !recent.includes(s)) : [];

  return (
    <>
      <main className="screen">
        <div className="row">
          <p className="sub">{greeting}</p>
          <LangToggle />
        </div>

        <form className="stack gap-lg grow" onSubmit={submit} noValidate>
          <label className="stack">
            <span className="title-lg">{t.whatTeaching}</span>
            <input
              className="input"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setNeedTopic(false);
              }}
              placeholder={t.topicPlaceholder}
              maxLength={120}
              enterKeyHint="go"
              aria-invalid={needTopic}
            />
            {needTopic && <span className="error-inline">{t.topicNeeded}</span>}
          </label>

          {recent.length > 0 && (
            <div className="stack">
              <span className="label">{t.recent}</span>
              <div className="chips">
                {recent.map((r) => (
                  <button type="button" key={r} className="chip" onClick={() => setTopic(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="stack">
            <span className="label" id="grade-label">
              {t.grade}
            </span>
            <div className="grades" role="radiogroup" aria-labelledby="grade-label">
              {GRADES.map((g) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={grade === g}
                  key={g}
                  className={grade === g ? "on" : ""}
                  onClick={() => setGrade(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            {remembered && grade && <span className="hint">{t.gradeRemembered(grade)}</span>}
          </div>

          {chips.length > 0 && (
            <div className="stack">
              <span className="label">{t.popularIn(grade!)}</span>
              <div className="chips">
                {chips.map((s) => (
                  <button type="button" key={s} className="chip" onClick={() => setTopic(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="spacer" />

          {error && <ErrorMessage error={error} />}

          <button className="btn" type="submit" disabled={sending || !grade}>
            {sending ? t.loading : t.makePack}
          </button>

          <button type="button" className="link-btn" onClick={() => setShowHow((v) => !v)} aria-expanded={showHow}>
            <Icon name="info" size={16} /> {t.howItWorks}
          </button>
          {showHow && <p className="hint">{t.howItWorksBody}</p>}
        </form>
      </main>
      <BottomNav />
    </>
  );
}
