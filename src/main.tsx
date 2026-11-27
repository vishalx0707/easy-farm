import { StrictMode, Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { LeafLoader, OpeningSequence } from "@/components/leaf-loader";
import type { State } from "@/lib/types";
import "./styles.css";

interface AuthConfig {
  provider?: string;
  publishableKey: string;
  google: boolean;
}

const AUTH_CONFIG_CACHE_KEY = "easyfarm:auth-config:v1";
const AUTH_CONFIG_TTL_MS = 5 * 60 * 1000;

const TraceDetails = lazy(async () => {
  const [{ OrderDetails, Empty }, { Brand }] = await Promise.all([
    import("@/components/trade-details"),
    import("@/components/brand"),
  ]);
  function PublicTrace() {
    const [params] = useSearchParams(),
      batch = params.get("batch") || "",
      query = useQuery({
        queryKey: ["trace", batch],
        queryFn: async () => {
          const response = await fetch(
            "/api/trace/" + encodeURIComponent(batch),
          );
          const result = await response.json();
          if (!response.ok) {
            throw new Error(
              result.error || "Could not load this record.",
            );
          }
          return result as State;
        },
        retry: false,
      });
    return (
      <div className="trace-page">
        <header>
          <Brand />
          <a href="/login">Open your workspace</a>
        </header>
        <main>
          {query.data?.orders[0] ? (
            <OrderDetails
              order={query.data.orders[0]}
              data={query.data}
              publicTrace
            />
          ) : query.error ? (
            <Empty title="Trace record unavailable" copy={query.error.message} />
          ) : (
            <p role="status">Opening the saved trace record…</p>
          )}
        </main>
      </div>
    );
  }
  return { default: PublicTrace };
});

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

function isValidAuthConfig(value: unknown): value is AuthConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthConfig>;
  return (
    candidate.google === true &&
    typeof candidate.publishableKey === "string" &&
    candidate.publishableKey.length > 0 &&
    (!candidate.provider || candidate.provider === "clerk")
  );
}

function readCachedAuthConfig(): AuthConfig | null {
  try {
    const raw = window.sessionStorage.getItem(AUTH_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      config?: unknown;
      cachedAt?: number;
    };
    if (
      typeof parsed?.cachedAt === "number" &&
      Date.now() - parsed.cachedAt < AUTH_CONFIG_TTL_MS &&
      isValidAuthConfig(parsed.config)
    ) {
      return parsed.config;
    }
  } catch {
    /* Ignore storage errors in restricted contexts. */
  }
  return null;
}

function writeCachedAuthConfig(config: AuthConfig): void {
  try {
    window.sessionStorage.setItem(
      AUTH_CONFIG_CACHE_KEY,
      JSON.stringify({ config, cachedAt: Date.now() }),
    );
  } catch {
    /* Ignore storage errors in restricted contexts. */
  }
}

async function fetchAuthConfig(): Promise<AuthConfig> {
  const response = await fetch("/api/auth-config", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error();
  const config = await response.json();
  if (!isValidAuthConfig(config)) throw Error();
  writeCachedAuthConfig(config);
  return config;
}

function preloadRouteChunk(pathname: string): void {
  if (pathname.startsWith("/login")) {
    void import("@/pages/auth");
  } else if (pathname.startsWith("/onboarding")) {
    void import("@/pages/onboarding");
  } else {
    void import("@/pages/marketplace");
  }
}

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  const wrap = (children: ReactNode) => (
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={cache}>
          <OpeningSequence />
          <Suspense
            fallback={<LeafLoader overlay label="Opening your workspace" />}
          >
            {children}
          </Suspense>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has("batch")) {
    root.render(
      wrap(
        <BrowserRouter>
          <TraceDetails />
        </BrowserRouter>,
      ),
    );
    return;
  }

  preloadRouteChunk(location.pathname);

  const cachedConfig = readCachedAuthConfig();
  if (!cachedConfig) {
    root.render(<LeafLoader overlay label="Opening EasyFarm" />);
  } else {
    void fetchAuthConfig().catch(() => {});
  }

  try {
    const [config, { ClerkApp }, ui] = await Promise.all([
      cachedConfig ? Promise.resolve(cachedConfig) : fetchAuthConfig(),
      import("./clerk-app"),
      searchParams.has("continue")
        ? import("@clerk/ui").then((m) => m.ui)
        : Promise.resolve(undefined),
    ]);
    root.render(
      wrap(<ClerkApp publishableKey={config.publishableKey} ui={ui} />),
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
