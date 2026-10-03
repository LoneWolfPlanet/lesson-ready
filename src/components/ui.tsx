import { Link, NavLink } from "react-router-dom";
import type { ApiError } from "../api/http";
import type { PackStatus } from "../api/types";
import { useOnline } from "../hooks/usePack";
import { useUi } from "../i18n/UiContext";
import { config } from "../config";
import { Icon } from "./Icon";

export function LangToggle() {
  const { lang, setLang } = useUi();
  return (
    <div className="lang" role="group" aria-label="Language / Wika">
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
      <button type="button" aria-pressed={lang === "fil"} onClick={() => setLang("fil")}>
        FIL
      </button>
    </div>
  );
}

/** Opens the Settings page. Shown in the header of New, My packs and Materials. */
export function AccountButton() {
  const { t } = useUi();
  return (
    <Link to="/settings" className="icon-btn" aria-label={t.settings} title={t.settings}>
      <Icon name="user" />
    </Link>
  );
}

/** Normal / Large reading size, app-wide. */
export function TextSizeToggle() {
  const { t, textSize, setTextSize } = useUi();
  return (
    <div className="lang theme-toggle" role="group" aria-label={t.textSize}>
      {/* Each label is shown in roughly the size it picks, so the choice is visible before tapping. */}
      <button type="button" aria-pressed={textSize === "small"} onClick={() => setTextSize("small")} style={{ fontSize: "0.72rem" }}>
        {t.textSmall}
      </button>
      <button type="button" aria-pressed={textSize === "normal"} onClick={() => setTextSize("normal")}>
        {t.textNormal}
      </button>
      <button type="button" aria-pressed={textSize === "large"} onClick={() => setTextSize("large")} style={{ fontSize: "1rem" }}>
        {t.textLarge}
      </button>
    </div>
  );
}

/** Auto (follow the phone) / Light / Dark. Same segmented style as the language toggle. */
export function ThemeToggle() {
  const { t, theme, setTheme } = useUi();
  const options = [
    ["system", t.themeSystem],
    ["light", t.themeLight],
    ["dark", t.themeDark],
  ] as const;
  return (
    <div className="lang theme-toggle" role="group" aria-label={t.appearance}>
      {options.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status, notInLibrary }: { status: PackStatus; notInLibrary?: boolean }) {
  const { t } = useUi();
  if (status === "failed" && notInLibrary) return <span className="pill fail">{t.statusUnavailable}</span>;
  const map: Record<PackStatus, [string, string]> = {
    ready: ["ok", t.statusReady],
    check: ["warn", t.statusCheck],
    reviewed: ["done", t.statusReviewed],
    working: ["run", t.statusWorking],
    failed: ["fail", t.statusFailed],
  };
  const [cls, label] = map[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function BottomNav() {
  const { t } = useUi();
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/new" className={({ isActive }) => (isActive ? "on" : "")}>
        <Icon name="plus" size={22} />
        <span>{t.navNew}</span>
      </NavLink>
      <NavLink to="/packs" end className={({ isActive }) => (isActive ? "on" : "")}>
        <Icon name="packs" size={22} />
        <span>{t.navPacks}</span>
      </NavLink>
      <NavLink to="/materials" className={({ isActive }) => (isActive ? "on" : "")}>
        <Icon name="materials" size={22} />
        <span>{t.navMaterials}</span>
      </NavLink>
    </nav>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useUi();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="wifiOff" size={16} /> {t.offlineBanner}
    </div>
  );
}

/** One friendly message and one obvious action. Never technical text. */
export function ErrorMessage({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { t } = useUi();
  const text = {
    offline: t.errOffline,
    signin: t.errSignin,
    notfound: t.errNotFound,
    invalid: t.errInvalid,
    conflict: t.errConflict,
    server: t.errServer,
    busy: t.errBusy,
  }[error.kind];
  return (
    <div className="error-box" role="alert">
      <Icon name={error.kind === "offline" ? "wifiOff" : "alert"} />
      <p>{text}</p>
      {onRetry && error.kind !== "offline" && (
        <button type="button" className="btn ghost small" onClick={onRetry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}

export function Spinner() {
  const { t } = useUi();
  return (
    <div className="center-msg" role="status">
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="sr-only">{t.loading}</span>
    </div>
  );
}

/** Shown whenever sign-in or the API is mocked, so a mock build is never mistaken for the real app. */
export function DemoBanner() {
  if (config.auth.mode !== "mock" && config.api.mode !== "mock") return null;
  const parts = [config.auth.mode === "mock" && "sign-in", config.api.mode === "mock" && "packs"].filter(Boolean).join(" + ");
  return (
    <div className="demo-banner" role="note">
      Demo mode · sample data ({parts} mocked)
    </div>
  );
}
