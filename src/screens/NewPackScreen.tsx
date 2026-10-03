import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { packsApi } from "../api/client";
import { asApiError, type ApiError } from "../api/http";
import { GRADES, OTHER_GRADES, OTHER_LEVELS, type Grade } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { AccountButton, BottomNav, ErrorMessage, LangToggle } from "../components/ui";
import { Icon } from "../components/Icon";
import { SUGGESTIONS } from "../data/suggestions";
import { SUBJECT_CHIPS, isSuggestedSubject } from "../data/subjects";
import { useUi } from "../i18n/UiContext";
import { prefs } from "../prefs";

interface Prefill {
  topic?: string;
  grade?: Grade;
  subject?: string;
}

const isChip = isSuggestedSubject;

/** Screen 2: one question on screen; the last grade is remembered. */
export function NewPackScreen() {
  const { user } = useAuth();
  const { t, lang } = useUi();
  const navigate = useNavigate();
  const prefill = (useLocation().state ?? {}) as Prefill;

  const [topic, setTopic] = useState(prefill.topic ?? "");
  const [grade, setGrade] = useState<Grade | null>(prefill.grade ?? prefs.lastGrade());
  const [remembered] = useState(() => prefill.grade === undefined && prefs.lastGrade() !== null);
  const [subject, setSubject] = useState(() => prefill.subject ?? prefs.lastSubject());
  const [otherOpen, setOtherOpen] = useState(() => {
    const s = prefill.subject ?? prefs.lastSubject();
    return s !== "" && !isChip(s);
  });
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
    if (!clean || grade === null) {
      setNeedTopic(!clean);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const cleanSubject = subject.trim();
      const id = await packsApi.create({ topic: clean, grade, language: lang, subject: cleanSubject || undefined });
      prefs.setLastGrade(grade);
      prefs.setLastSubject(cleanSubject);
      prefs.addRecentTopic(clean);
      navigate(`/packs/${id}/working`);
    } catch (err) {
      setError(asApiError(err));
      setSending(false);
    }
  }

  const chips = grade !== null ? (SUGGESTIONS[grade] ?? []).filter((s) => !recent.includes(s)) : [];

  return (
    <>
      <main className="screen">
        <div className="row">
          <p className="sub">{greeting}</p>
          <div className="row gap-sm">
            <LangToggle />
            <AccountButton />
          </div>
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
            <span className="label" id="subject-label">
              {t.subject} <span className="label-note">· {t.optional}</span>
            </span>
            <div className="chips" role="radiogroup" aria-labelledby="subject-label">
              {SUBJECT_CHIPS.map((c) => {
                const on = !otherOpen && subject.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    key={c}
                    className={on ? "chip on" : "chip"}
                    onClick={() => {
                      setOtherOpen(false);
                      setSubject(on ? "" : c); // tap again to clear
                    }}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={otherOpen}
                className={otherOpen ? "chip on" : "chip"}
                onClick={() => {
                  if (otherOpen) {
                    setOtherOpen(false);
                    setSubject("");
                  } else {
                    setOtherOpen(true);
                    setSubject(isChip(subject) ? "" : subject);
                  }
                }}
              >
                {t.subjectOther}
              </button>
            </div>
            {otherOpen && (
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t.subjectOtherPlaceholder}
                aria-label={t.subjectOtherLabel}
                maxLength={60}
                autoFocus
                enterKeyHint="done"
              />
            )}
          </div>

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
            <label className="other-grade">
              <span>{t.otherGrade}</span>
              <select
                className={grade !== null && OTHER_GRADES.includes(grade) ? "on" : ""}
                value={grade !== null && OTHER_GRADES.includes(grade) ? String(grade) : ""}
                onChange={(e) => setGrade(e.target.value === "" ? null : (Number(e.target.value) as Grade))}
              >
                <option value="">{t.chooseGrade}</option>
                {OTHER_LEVELS.map(({ group, grades }) => {
                  const label = {
                    kinder: t.levelGroupKinder,
                    jhs: t.levelGroupJhs,
                    shs: t.levelGroupShs,
                    college: t.levelGroupCollege,
                  }[group];
                  const options = grades.map((g) => (
                    <option key={g} value={g}>
                      {t.gradeN(g)}
                    </option>
                  ));
                  return group === "kinder" ? options : (
                    <optgroup key={group} label={label}>
                      {options}
                    </optgroup>
                  );
                })}
              </select>
            </label>
            {remembered && grade !== null && <span className="hint">{t.gradeRemembered(grade)}</span>}
          </div>

          {/* Phase 2 (P2·1): optional; opens My materials with the topic and grade filled in. */}
          <button
            type="button"
            className="attach"
            onClick={() =>
              navigate("/materials", {
                state: {
                  lessonTitle: topic.trim() || undefined,
                  grade: grade ?? undefined,
                  subject: subject.trim() || undefined,
                },
              })
            }
          >
            <Icon name="plus" size={18} />
            <span>{t.useMyMaterials}</span>
            <small>{t.optional}</small>
          </button>

          {chips.length > 0 && (
            <div className="stack">
              <span className="label">{t.popularIn(grade as Grade)}</span>
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

          <button className="btn" type="submit" disabled={sending || grade === null}>
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
