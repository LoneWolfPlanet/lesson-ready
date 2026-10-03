import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Icon";
import { LangToggle, TextSizeToggle, ThemeToggle } from "../components/ui";
import { useUi } from "../i18n/UiContext";

/** Personal settings: who is signed in, language, appearance, text size, sign out. Opened from the account icon. */
export function SettingsScreen() {
  const { t } = useUi();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  // Back to wherever the teacher came from; straight to New if they opened /settings directly.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/new"));

  return (
    <main className="screen settings">
      <div className="row">
        <button type="button" className="back-link" onClick={goBack}>
          <Icon name="back" size={18} /> {t.back}
        </button>
      </div>

      <h1 className="title">{t.settings}</h1>

      <section className="card settings-account" aria-label={t.signedInAs}>
        <span className="settings-avatar" aria-hidden="true">
          <Icon name="user" size={22} />
        </span>
        <div className="settings-who">
          <b>{user?.name ?? ""}</b>
          {user?.email && <span className="hint">{user.email}</span>}
        </div>
      </section>

      <section className="settings-group">
        <div className="settings-row">
          <span className="label">{t.languageLabel}</span>
          <LangToggle />
        </div>
        <div className="settings-row stacked">
          <span className="label">{t.appearance}</span>
          <ThemeToggle />
        </div>
        <div className="settings-row stacked">
          <span className="label">{t.textSize}</span>
          <TextSizeToggle />
        </div>
      </section>

      <div className="spacer" />

      <button
        type="button"
        className="btn ghost settings-signout"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOut();
        }}
      >
        {t.signOut}
      </button>
    </main>
  );
}
