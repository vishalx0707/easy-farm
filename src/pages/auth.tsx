import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth, useSignIn, HandleSSOCallback } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { Animate } from "@/components/motion";
import { AuthReel } from "@/components/auth-reel";
import { LeafLoader } from "@/components/leaf-loader";
import { useApi } from "@/lib/api";
import type { User } from "@/lib/types";

const ClerkSignIn = lazy(() =>
  import("@clerk/react").then((m) => ({ default: m.SignIn })),
);
const ClerkSignUp = lazy(() =>
  import("@clerk/react").then((m) => ({ default: m.SignUp })),
);

export function useSession() {
  const auth = useAuth(),
    api = useApi();
  const session = useQuery({
    queryKey: ["session", auth.userId],
    queryFn: () => api<{ user: User | null }>("/api/auth/session"),
    enabled: auth.isLoaded && !!auth.isSignedIn,
    retry: 1,
  });
  return { ...auth, session, user: session.data?.user };
}

export function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.2h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.3Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.4 0 10-1.8 13.3-4.9l-6.7-5.2a12.1 12.1 0 0 1-18-6.3H5.7v5.3A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.7a20 20 0 0 0 0 17.8l6.9-5.3Z"
      />
      <path
        fill="#EA4335"
        d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.7 15.1l6.9 5.3A12 12 0 0 1 24 12Z"
      />
    </svg>
  );
}

export function Login() {
  const [params] = useSearchParams(),
    { isLoaded, isSignedIn, user, session } = useSession(),
    { signIn } = useSignIn();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const portal = params.get("portal") === "grower" ? "grower" : "buyer",
    destination = "/onboarding?portal=" + portal;
  useEffect(() => {
    document.title = "Sign in · EasyFarm";
  }, []);
  if (params.has("callback"))
    return (
      <div className="auth-screen">
        <HandleSSOCallback
          navigateToApp={({ decorateUrl }) =>
            window.location.assign(decorateUrl(destination))
          }
          navigateToSignIn={() =>
            window.location.assign("/login?continue=signin&portal=" + portal)
          }
          navigateToSignUp={() =>
            window.location.assign("/login?continue=1&portal=" + portal)
          }
        />
        <p className="callback-label" role="status">
          Finishing your Google sign-in…
        </p>
      </div>
    );
  if (isSignedIn && user)
    return (
      <Navigate
        to={user.role === "pending" ? destination : "/" + user.role}
        replace
      />
    );
  const start = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: location.origin + destination,
        redirectCallbackUrl:
          location.origin + "/login?callback=1&portal=" + portal,
      });
      if (result.error) throw Error(result.error.message);
    } catch {
      setError("We couldn’t connect to Google. Please try again.");
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout light-ui">
      <aside className="auth-story">
        <Brand />
        <AuthReel />
        <div className="auth-story-copy">
          <p className="eyebrow">GROWN WITH CARE. TRADED DIRECT.</p>
          <h1>
            Good produce.
            <br />
            Better connections.
          </h1>
          <p>A place for growers and businesses to trade on their own terms.</p>
        </div>
        <small>Illustrative footage</small>
      </aside>
      <main className="auth-card">
        <div className="mobile-brand">
          <Brand dark />
        </div>
        <Animate identity="login">
          <div className="auth-content">
            <h2>Welcome to EasyFarm.</h2>
            <p className="auth-intro">
              Sign in to connect with growers and businesses.
            </p>
            {params.get("continue") === "signin" ? (
              <Suspense fallback={<LeafLoader label="Opening sign-in" />}>
                <ClerkSignIn
                  routing="hash"
                  signUpUrl="/login"
                  forceRedirectUrl={destination}
                />
              </Suspense>
            ) : params.has("continue") ? (
              <Suspense fallback={<LeafLoader label="Opening sign-up" />}>
                <ClerkSignUp
                  routing="hash"
                  signInUrl="/login"
                  forceRedirectUrl={destination}
                />
              </Suspense>
            ) : (
              <>
                <Button
                  id="google-signin"
                  variant="outline"
                  className="google-button"
                  disabled={!isLoaded || busy || !!isSignedIn}
                  onClick={start}
                >
                  <GoogleIcon />
                  {busy ? "Connecting to Google…" : "Continue with Google"}
                </Button>
                <p className="sr-only" role="status">
                  {!isLoaded
                    ? "Connecting to secure sign-in…"
                    : isSignedIn
                      ? "Opening your workspace…"
                      : "Secure sign-in. No password to remember."}
                </p>
              </>
            )}
            <div id="clerk-captcha" />
            {(error || session.error) && (
              <p role="alert" className="error-box">
                {error || "Could not check your account."}{" "}
                <button onClick={() => location.reload()}>Try again</button>
              </p>
            )}
          </div>
        </Animate>
        <footer className="auth-footer">
          <a href="/">Back to EasyFarm</a>
        </footer>
      </main>
    </div>
  );
}
