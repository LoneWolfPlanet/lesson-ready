import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { DemoBanner, OfflineBanner, Spinner } from "./components/ui";
import type { MaterialDetails } from "./materials/types";
import { MyPacksScreen } from "./screens/MyPacksScreen";
import { NewPackScreen } from "./screens/NewPackScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";

// The first screens a teacher sees load with the app; the rest load when first opened.
// The service worker precaches every chunk, so they still open offline.
const PackScreen = lazy(() => import("./screens/pack/PackScreen").then((m) => ({ default: m.PackScreen })));
const WorkingScreen = lazy(() => import("./screens/WorkingScreen").then((m) => ({ default: m.WorkingScreen })));
const QuizModeScreen = lazy(() => import("./screens/QuizModeScreen").then((m) => ({ default: m.QuizModeScreen })));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
const MaterialsScreen = lazy(() => import("./materials/MaterialsScreen").then((m) => ({ default: m.MaterialsScreen })));

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
  const location = useLocation();
  // Prefill from "Use my materials" on the New screen; the key resets the screen on each visit.
  const prefill = (location.state ?? null) as Partial<MaterialDetails> | null;
  return <MaterialsScreen key={location.key} startAdding={prefill ?? undefined} />;
}

export function App() {
  return (
    <div className="app">
      <DemoBanner />
      <OfflineBanner />
      <Suspense fallback={<Spinner />}>
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
      </Suspense>
    </div>
  );
}
