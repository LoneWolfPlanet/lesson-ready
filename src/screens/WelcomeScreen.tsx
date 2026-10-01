import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { config } from "../config";
import type { SignInProvider } from "../auth/types";
import { GoogleMark, Icon, Logo } from "../components/Icon";
import { LangToggle } from "../components/ui";
import { useUi } from "../i18n/UiContext";

/** Screen 1: says what the teacher gets before asking for anything. */
export function WelcomeScreen() {
  const { status, busy, error, signIn } = useAuth();
  const { t } = useUi();
  const [params] = useSearchParams();

  if (status === "signedIn") return <Navigate to="/new" replace />;

  const failed = error || params.get("signin") === "failed";
  const go = (p: SignInProvider) => () => void signIn(p);

  return (
    <main className="screen welcome">
      <div className="row end">
        <LangToggle />
      </div>

      <Logo />
      <h1 className="title-lg">{t.welcomeTitle}</h1>

      <ul className="benefits">
        {[t.benefitPack, t.benefitChecked, t.benefitOffline].map((b) => (
          <li key={b}>
            <span className="tick">
              <Icon name="check" size={13} strokeWidth={3} />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="spacer" />

      {failed && (
        <p className="error-inline" role="alert">
          {t.signinFailed}
        </p>
      )}

      <div className="stack">
        <button type="button" className="btn" onClick={go("email")} disabled={busy || status === "loading"}>
          <Icon name="mail" size={18} /> {busy ? t.signingIn : t.continueEmail}
        </button>
        {(config.auth.googleEnabled || config.auth.mode === "mock") && (
          <button type="button" className="btn ghost" onClick={go("google")} disabled={busy || status === "loading"}>
            <GoogleMark /> {t.continueGoogle}
          </button>
        )}
      </div>
      <p className="hint center">{t.schoolSoon}</p>
    </main>
  );
}
