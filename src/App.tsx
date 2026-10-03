import { useCallback } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { DemoBanner, OfflineBanner, Spinner } from "./components/ui";
import { MyPacksScreen } from "./screens/MyPacksScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { NewPackScreen } from "./screens/NewPackScreen";
import { PackScreen } from "./screens/PackScreen";
import { QuizModeScreen } from "./screens/QuizModeScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { WorkingScreen } from "./screens/WorkingScreen";
import { MaterialsScreen, type MaterialDetails } from "./materials";

function RequireSignIn() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Spinner />;
  if (status === "signedOut")
    return (
      <Navigate to="/welcome" replace state={{ from: location.pathname }} />
    );
  return <Outlet />;
}

function MaterialsPage() {
  const { getAccessToken } = useAuth();
  const location = useLocation();
  // Prefill from "Use my materials" on the New screen; the key resets the screen on each visit.
  const prefill = (location.state ?? null) as Partial<MaterialDetails> | null;
  const getToken = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("Please sign in again.");
    return token;
  }, [getAccessToken]);
  return <MaterialsScreen key={location.key} getToken={getToken} startAdding={prefill ?? undefined} />;
}

export function App() {
  return (
    <div className="app">
      <DemoBanner />
      <OfflineBanner />
      <Routes>
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route element={<RequireSignIn />}>
          <Route path="/new" element={<NewPackScreen />} />
          <Route path="/packs" element={<MyPacksScreen />} />
          <Route path="/packs/:id" element={<PackScreen />} />
          <Route path="/packs/:id/working" element={<WorkingScreen />} />
          <Route path="/packs/:id/quiz" element={<QuizModeScreen />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/new" replace />} />
      </Routes>
    </div>
  );
}
