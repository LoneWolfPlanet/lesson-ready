import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { packsApi } from "../api/client";
import { asApiError, type ApiError } from "../api/http";
import { offlineCache } from "../api/offlineCache";
import type { PackSummary } from "../api/types";
import { Icon } from "../components/Icon";
import { AccountButton, BottomNav, ErrorMessage, Spinner, StatusPill } from "../components/ui";
import { config } from "../config";
import { isStale, useOnline } from "../hooks/usePack";
import type { Strings } from "../i18n/strings";
import { useUi } from "../i18n/UiContext";

/** Screen 8: every pack, newest first, with plain statuses and an offline marker. */
export function MyPacksScreen() {
  const { t, lang } = useUi();
  const online = useOnline();
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();
  /** The pack whose delete confirmation is open, and whether its delete is in flight. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const h = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(h);
  }, [toast]);

  const remove = async (p: PackSummary, remake: boolean) => {
    setDeleting(true);
    setDeleteError("");
    try {
      await packsApi.remove(p.id);
      setPacks((list) => (list ?? []).filter((x) => x.id !== p.id));
      setConfirmId(null);
      if (remake) navigate("/new", { state: { topic: p.topic, grade: p.grade, subject: p.subject || undefined } });
      else setToast(t.packDeleted);
    } catch (e) {
      const err = asApiError(e);
      setDeleteError(err.kind === "offline" ? t.deleteOffline : err.kind === "signin" ? t.errSignin : t.errServer);
    } finally {
      setDeleting(false);
    }
  };
  // Filters live in the URL, so they are still set when the teacher comes back from a pack.
  const [params, setParams] = useSearchParams();
  const subjectFilter = params.get("subject"); // lower-cased subject, or NO_SUBJECT
  const gradeFilter = params.get("grade");
  const setFilter = (name: "subject" | "grade", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    packsApi
      .list()
      .then((res) => {
        if (!alive) return;
        setPacks(res.packs);
        setFromCache(res.fromCache);
        setError(null);
        // Refresh while something is still being written so its status updates here.
        if (res.packs.some((p) => p.status === "working" && !isStale(p.createdAt))) {
          timer = window.setTimeout(() => setTick((n) => n + 1), config.pollSeconds * 2000);
        }
      })
      .catch((e) => alive && setError(asApiError(e)));
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [tick, online]);

  // Options come from the teacher's own packs, so every choice finds something.
  const { subjects, grades, hasNoSubject } = useMemo(() => {
    const bySubject = new Map<string, string>(); // lower-case key -> first spelling seen
    for (const p of packs ?? []) {
      const s = p.subject.trim();
      if (s && !bySubject.has(s.toLowerCase())) bySubject.set(s.toLowerCase(), s);
    }
    return {
      subjects: [...bySubject.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      grades: [...new Set((packs ?? []).map((p) => p.grade))].sort((a, b) => a - b),
      hasNoSubject: (packs ?? []).some((p) => !p.subject.trim()),
    };
  }, [packs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (packs ?? []).filter((p) => {
      if (subjectFilter) {
        const key = p.subject.trim().toLowerCase();
        if (subjectFilter === NO_SUBJECT ? key !== "" : key !== subjectFilter) return false;
      }
      if (gradeFilter && String(p.grade) !== gradeFilter) return false;
      return (
        !q ||
        p.topic.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        t.gradeN(p.grade).toLowerCase().includes(q) ||
        String(p.grade) === q
      );
    });
  }, [packs, query, subjectFilter, gradeFilter, t]);
  const filtering = !!(subjectFilter || gradeFilter);

  return (
    <>
      <main className="screen">
        <div className="row">
          <h1 className="title">{t.myPacks}</h1>
          <AccountButton />
        </div>

        {packs && packs.length > 0 && (
          <label className="search">
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPacks} type="search" />
          </label>
        )}

        {(subjects.length > 1 || grades.length > 1 || filtering) && (
          <div className="filters">
            <label className="filter">
              <span className="label">{t.filterSubject}</span>
              <select
                id="filter-subject"
                className={subjectFilter ? "on" : ""}
                value={subjectFilter ?? ""}
                onChange={(e) => setFilter("subject", e.target.value)}
              >
                <option value="">{t.allSubjects}</option>
                {subjects.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                {hasNoSubject && subjects.length > 0 && <option value={NO_SUBJECT}>{t.noSubject}</option>}
              </select>
            </label>
            <label className="filter">
              <span className="label">{t.filterGrade}</span>
              <select
                id="filter-grade"
                className={gradeFilter ? "on" : ""}
                value={gradeFilter ?? ""}
                onChange={(e) => setFilter("grade", e.target.value)}
              >
                <option value="">{t.allGrades}</option>
                {grades.map((g) => (
                  <option key={g} value={String(g)}>
                    {t.gradeN(g)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {filtering && packs && (
          <div className="row">
            <span className="hint">{t.showingNofM(shown.length, packs.length)}</span>
            <button type="button" className="link-btn" onClick={() => setParams({}, { replace: true })}>
              <Icon name="close" size={16} /> {t.clearFilters}
            </button>
          </div>
        )}

        {fromCache && <p className="hint">{t.offlineList}</p>}
        {error && !packs && <ErrorMessage error={error} onRetry={() => setTick((n) => n + 1)} />}
        {!packs && !error && <Spinner />}

        {packs && packs.length === 0 && (
          <div className="empty stack gap-lg">
            <p className="sub">{t.noPacks}</p>
            <Link to="/new" className="btn">
              {t.makeFirst}
            </Link>
          </div>
        )}
        {packs && packs.length > 0 && shown.length === 0 && <p className="sub">{t.noMatch}</p>}

        <ul className="pack-list">
          {shown.map((p) => (
            <li key={p.id} className="pack-item">
              {/* The topic link stretches over the whole card; Delete sits above it, so it isn't nested in the link. */}
              <div className={`pack${confirmId === p.id ? " confirming" : ""}`}>
                <div className="row">
                  <Link
                    to={p.status === "working" || p.status === "failed" ? `/packs/${p.id}/working` : `/packs/${p.id}`}
                    className="t pack-link"
                  >
                    {p.topic}
                  </Link>
                  <StatusPill status={p.status} notInLibrary={p.failureKind === "unavailable"} />
                </div>
                <div className="row start gap-sm wrap">
                  <span className="m">
                    {[t.gradeN(p.grade), p.subject.trim(), friendlyDate(p.createdAt, t, lang)].filter(Boolean).join(" · ")}
                  </span>
                  {offlineCache.has(p.id) && (
                    <span className="offline-mark">
                      <Icon name="offline" size={13} /> {t.savedOffline}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="pack-del"
                  aria-label={t.deletePack(p.topic)}
                  title={online ? undefined : t.deleteOffline}
                  aria-expanded={confirmId === p.id}
                  disabled={!online || deleting}
                  onClick={() => {
                    setDeleteError("");
                    setConfirmId(confirmId === p.id ? null : p.id);
                  }}
                >
                  {t.deleteConfirm}
                </button>
              </div>

              {confirmId === p.id && (
                <div className="banner delete-confirm" role="alertdialog" aria-label={t.deleteTitle(p.topic)}>
                  <b>{t.deleteTitle(p.topic)}</b>
                  <span>{p.status === "working" ? t.deleteWorking : t.deleteBody}</span>
                  <div className="q-tools">
                    <button type="button" className="btn small danger" disabled={deleting} onClick={() => remove(p, false)}>
                      {deleting ? t.deleting : t.deleteConfirm}
                    </button>
                    <button type="button" className="btn ghost small" disabled={deleting} onClick={() => remove(p, true)}>
                      {t.deleteAndRemake}
                    </button>
                    <button type="button" className="link-btn" disabled={deleting} onClick={() => setConfirmId(null)}>
                      {t.cancel}
                    </button>
                  </div>
                  {deleteError && (
                    <p className="error-inline" role="alert">
                      {deleteError}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <BottomNav />
    </>
  );
}

/** Filter value for packs made without a subject. Can't clash with a real subject (those are lower-cased words). */
const NO_SUBJECT = "-none-";

function friendlyDate(iso: string, t: Strings, lang: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return t.today;
  if (days === 1) return t.yesterday;
  return d.toLocaleDateString(lang === "fil" ? "fil-PH" : "en-PH", { month: "short", day: "numeric" });
}
