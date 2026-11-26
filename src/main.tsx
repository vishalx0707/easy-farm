import { StrictMode, Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
const Login = lazy(() =>
  import("@/pages/auth").then((m) => ({ default: m.Login })),
);
const Onboarding = lazy(() =>
  import("@/pages/auth").then((m) => ({ default: m.Onboarding })),
);
const Marketplace = lazy(() =>
  import("@/pages/marketplace").then((m) => ({ default: m.Marketplace })),
);
const Trace = lazy(() =>
  import("@/pages/marketplace").then((m) => ({ default: m.Trace })),
);
import "./styles.css";
const cache = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5000 },
  },
});
function AuthRecovery() {
  const { isLoaded } = useAuth();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (isLoaded) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [isLoaded]);
  return slow ? (
    <div className="toast" role="alert">
      Secure sign-in is taking longer than expected.{" "}
      <button onClick={() => location.reload()}>Retry</button>
    </div>
  ) : null;
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="startup">
        <h1>Let’s reconnect.</h1>
        <p>
          Something interrupted the app. Your saved trades are still on the
          server.
        </p>
        <button onClick={() => location.reload()}>Reload EasyFarm</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
async function boot() {
  const root = createRoot(document.getElementById("root")!);
  const wrap = (children: ReactNode) => (
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={cache}>
          <TooltipProvider>
            <Suspense
              fallback={
                <div className="startup" role="status">
                  Opening your workspace…
                </div>
              }
            >
              {children}
            </Suspense>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
  if (new URLSearchParams(location.search).has("batch")) {
    root.render(
      wrap(
        <BrowserRouter>
          <Trace />
        </BrowserRouter>,
      ),
    );
    return;
  }
  root.render(
    <div className="startup" role="status">
      Opening EasyFarm…
    </div>,
  );
  try {
    const response = await fetch("/api/auth-config", {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error();
    const config = await response.json();
    const { ui } = await import("@clerk/ui");
    if (!config.google || !config.publishableKey) throw Error();
    root.render(
      wrap(
        <ClerkProvider
          publishableKey={config.publishableKey}
          ui={ui}
          signInUrl="/login"
          signUpUrl="/login?continue=1"
          signInFallbackRedirectUrl="/onboarding"
          signUpFallbackRedirectUrl="/onboarding"
          appearance={{
            variables: {
              colorPrimary: "#33492a",
              fontFamily: "Geist, Arial, sans-serif",
              borderRadius: "9px",
            },
          }}
        >
          <AuthRecovery />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/login.html" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/onboarding.html" element={<Onboarding />} />
              <Route path="*" element={<Marketplace />} />
            </Routes>
          </BrowserRouter>
        </ClerkProvider>,
      ),
    );
  } catch {
    root.render(
      <div className="startup light-ui">
        <h1>Sign-in is temporarily unavailable.</h1>
        <p>Check your connection and try again.</p>
        <button onClick={() => location.reload()}>Try again</button>
        <a href="/">Back to EasyFarm</a>
      </div>,
    );
  }
}
void boot();
