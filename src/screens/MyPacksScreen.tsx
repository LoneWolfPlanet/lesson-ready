import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { packsApi } from "../api/client";
import { asApiError, type ApiError } from "../api/http";
import { offlineCache } from "../api/offlineCache";
import type { PackSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Icon";
import { BottomNav, ErrorMessage, LangToggle, Spinner, StatusPill } from "../components/ui";
import { config } from "../config";
import { isStale, useOnline } from "../hooks/usePack";
import type { Strings } from "../i18n/strings";
import { useUi } from "../i18n/UiContext";

/** Screen 8: every pack, newest first, with plain statuses and an offline marker. */
export function MyPacksScreen() {
  const { t, lang } = useUi();
  const { user, signOut } = useAuth();
  const online = useOnline();
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [menu, setMenu] = useState(false);

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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (packs ?? []).filter((p) => !q || p.topic.toLowerCase().includes(q) || String(p.grade) === q);
  }, [packs, query]);

  return (
    <>
      <main className="screen">
        <div className="row">
          <h1 className="title">{t.myPacks}</h1>
          <div className="row gap-sm">
            <LangToggle />
            <div className="menu-wrap">
              <button type="button" className="icon-btn" aria-label={user?.name ?? "Account"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                <Icon name="user" />
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <p className="hint">{user?.email ?? user?.name}</p>
                  <button type="button" role="menuitem" onClick={() => void signOut()}>
                    {t.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {packs && packs.length > 0 && (
          <label className="search">
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPacks} type="search" />
          </label>
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
            <li key={p.id}>
              <Link to={p.status === "working" || p.status === "failed" ? `/packs/${p.id}/working` : `/packs/${p.id}`} className="pack">
                <div className="row">
                  <span className="t">{p.topic}</span>
                  <StatusPill status={p.status} />
                </div>
                <div className="row start gap-sm">
                  <span className="m">
                    {t.gradeN(p.grade)} · {friendlyDate(p.createdAt, t, lang)}
                  </span>
                  {offlineCache.has(p.id) && (
                    <span className="offline-mark">
                      <Icon name="offline" size={13} /> {t.savedOffline}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <BottomNav />
    </>
  );
}

function friendlyDate(iso: string, t: Strings, lang: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return t.today;
  if (days === 1) return t.yesterday;
  return d.toLocaleDateString(lang === "fil" ? "fil-PH" : "en-PH", { month: "short", day: "numeric" });
}
