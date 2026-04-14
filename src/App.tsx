import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useSavedOptions } from "@/hooks/useSavedOptions";
import NotFound from "@/pages/NotFound";
import "@/styles/shipsmart.css";

const HomePage = lazy(() => import("@/pages/HomePage"));
const SavedPage = lazy(() => import("@/pages/SavedPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));

const PageLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <div style={{ width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: "#0071e3", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppNav() {
  const { user, displayName, signOut } = useAuth();
  const { savedOptions, savedIds, toggleSave, removeSaved } = useSavedOptions();
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/auth") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="ss-body" style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 22px", background: "rgba(255,255,255,.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,.04)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#0071e3", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>S</div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.5px" }}>ShipSmart</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className={`ss-nav-link ${location.pathname === "/" ? "active" : ""}`} onClick={() => navigate("/")}>Search</button>
          {user && (
            <button className={`ss-nav-link ${location.pathname === "/saved" ? "active" : ""}`} onClick={() => navigate("/saved")}>
              Saved {savedOptions.length > 0 && <span style={{ marginLeft: 4, padding: "1px 6px", borderRadius: 10, background: "#111827", color: "#fff", fontSize: 10, fontWeight: 700 }}>{savedOptions.length}</span>}
            </button>
          )}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#0071e3", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {(displayName || user.email)?.[0]?.toUpperCase()}
              </div>
              <button className="ss-nav-link" onClick={() => { signOut(); navigate("/"); }} style={{ fontSize: 11, color: "#9ca3af" }}>Sign Out</button>
            </div>
          ) : (
            <button className="ss-btn ss-btn-outline ss-btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate("/auth")}>Sign In</button>
          )}
        </div>
      </nav>

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage savedIds={savedIds} onSaveService={toggleSave} />} />
          <Route path="/saved" element={<SavedPage savedServices={savedOptions} onRemove={removeSaved} onNavigateHome={() => navigate("/")} />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppNav />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
