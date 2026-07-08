import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useSavedOptions } from "@/hooks/useSavedOptions";
import NotFound from "@/pages/NotFound";
import "@/styles/shipsmart.css";

const HomePage = lazy(() => import("@/pages/HomePage"));
const SavedPage = lazy(() => import("@/pages/SavedPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));

const PageLoader = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
    }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        border: "3px solid #e5e7eb",
        borderTopColor: "#0071e3",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ShipSmartLogo() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
      }}
    >
      <svg
        width="38"
        height="38"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          display: "block",
          transform: "rotate(-8deg)",
        }}
      >
        <path
          d="M7.5 10.5L41 19.4L18.7 26.4L13.7 39L7.5 10.5Z"
          fill="#4F6FEA"
        />
        <path
          d="M18.7 26.4L41 19.4L22.2 32.8L13.7 39L18.7 26.4Z"
          fill="#315BD8"
        />
      </svg>

      <span
        style={{
          fontSize: 21,
          fontWeight: 900,
          color: "#252525",
          letterSpacing: "-0.55px",
          lineHeight: 1,
        }}
      >
        ShipSmart
      </span>
    </div>
  );
}

function AppHeader() {
  const { user, displayName, signOut } = useAuth();
  const { savedOptions } = useSavedOptions();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      style={{
        width: "100%",
        background: "#ffffff",
        borderBottom: "1px solid rgba(0,0,0,.04)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          height: 86,
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <ShipSmartLogo />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          {user && (
            <button
              className={`ss-nav-link ${
                location.pathname === "/saved" ? "active" : ""
              }`}
              onClick={() => navigate("/saved")}
            >
              Saved
              {savedOptions.length > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "#111827",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {savedOptions.length}
                </span>
              )}
            </button>
          )}

          {user ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {(displayName || user.email)?.[0]?.toUpperCase()}
              </div>

              <button
                type="button"
                onClick={() => {
                  signOut();
                  navigate("/");
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6b7280",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/auth")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#111827",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  padding: 0,
                }}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => navigate("/auth?mode=signup")}
                style={{
                  height: 39,
                  padding: "0 24px",
                  borderRadius: 6,
                  border: "1.5px solid #1d4ed8",
                  background: "#ffffff",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "none",
                }}
              >
                Create a Free account
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function AppNav() {
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
    <div
      className="ss-body"
      style={{
        minHeight: "100vh",
        background: "#ffffff",
      }}
    >
      <AppHeader />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage savedIds={savedIds} onSaveService={toggleSave} />
            }
          />
          <Route
            path="/saved"
            element={
              <SavedPage
                savedServices={savedOptions}
                onRemove={removeSaved}
                onNavigateHome={() => navigate("/")}
              />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <BrowserRouter>
      <AuthProvider>
        <AppNav />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;