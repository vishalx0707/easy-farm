import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { ui } from "@clerk/ui";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Login, Onboarding } from "@/pages/auth";
import { Marketplace, Trace } from "@/pages/marketplace";
import "./styles.css";
const cache = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5000 },
  },
});
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
          <TooltipProvider>{children}</TooltipProvider>
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
    const response = await fetch("/api/auth-config");
    if (!response.ok) throw Error();
    const config = await response.json();
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
