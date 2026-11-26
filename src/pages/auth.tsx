import { useState, useEffect, lazy, Suspense } from "react";
import {
  useAuth,
  useClerk,
  useSignIn,
  HandleSSOCallback,
  SignUp,
  SignIn,
} from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShoppingBasket, Sprout, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/brand";
import { Animate } from "@/components/motion";
import { useApi } from "@/lib/api";
import type { User, Role } from "@/lib/types";
const SeedScene = lazy(() => import("@/components/seed-scene"));
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
  const [showScene, setShowScene] = useState(false);
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => setShowScene(true), 4000);
    return () => clearTimeout(timer);
  }, [isLoaded]);
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
        {showScene &&
          !matchMedia("(max-width:760px), (prefers-reduced-motion:reduce)")
            .matches && (
            <Suspense fallback={null}>
              <SeedScene />
            </Suspense>
          )}
        <div className="auth-story-copy">
          <p className="eyebrow">GROWN WITH CARE. TRADED DIRECT.</p>
          <h1>
            Good produce.
            <br />
            Better connections.
          </h1>
          <p>A place for growers and businesses to trade on their own terms.</p>
        </div>
        <small>From your field. To their table.</small>
      </aside>
      <main className="auth-card">
        <div className="mobile-brand">
          <Brand dark />
        </div>
        <Animate identity="login">
          <div className="auth-content">
            <p className="eyebrow">YOUR EASYFARM ACCOUNT</p>
            <h2>Welcome to EasyFarm.</h2>
            <p className="auth-intro">
              Sign in to connect with growers and businesses.
            </p>
            {params.get("continue") === "signin" ? (
              <SignIn
                routing="hash"
                signUpUrl="/login"
                forceRedirectUrl={destination}
              />
            ) : params.has("continue") ? (
              <SignUp
                routing="hash"
                signInUrl="/login"
                forceRedirectUrl={destination}
              />
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
                <p className="auth-status" role="status">
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
            <div className="auth-next">
              <span>
                01 <i /> 02
              </span>
              <p>
                New here? Choose your buyer or grower workspace on the next
                step.
              </p>
            </div>
            <p className="auth-footnote">
              Already have an account? Your Google sign-in opens your existing
              portal.
            </p>
          </div>
        </Animate>
        <footer className="auth-footer">
          <a href="/">Back to EasyFarm</a>
          <span>Good food starts with a connection.</span>
        </footer>
      </main>
    </div>
  );
}
const profileSchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, "Enter your farm or business name.")
    .max(100),
  location: z.string().trim().min(1, "Enter your city or region.").max(100),
});
export function Onboarding() {
  const [params] = useSearchParams(),
    [role, setRole] = useState<Role>(
      params.get("portal") === "grower" ? "grower" : "buyer",
    );
  const { isLoaded, isSignedIn, user, session } = useSession(),
    api = useApi(),
    clerk = useClerk(),
    cache = useQueryClient(),
    [error, setError] = useState("");
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { organization: "", location: "" },
  });
  useEffect(() => {
    document.title = "Set up your workspace · EasyFarm";
  }, []);
  if (isLoaded && !isSignedIn)
    return <Navigate to={"/login?portal=" + role} replace />;
  if (user && user.role !== "pending")
    return <Navigate to={"/" + user.role} replace />;
  async function submit(values: z.infer<typeof profileSchema>) {
    setError("");
    try {
      const result = await api<{ role: Role }>("/api/profile", {
        ...values,
        role,
      });
      cache.clear();
      location.replace("/" + result.role);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="setup-page light-ui">
      <header className="setup-header">
        <Brand dark />
        <div>
          <span className="connected">
            <ShieldCheck size={14} /> Google account connected
          </span>
          <Button
            variant="ghost"
            onClick={() =>
              clerk
                .signOut({ redirectUrl: "/login" })
                .catch(() =>
                  setError(
                    "Could not sign out. Check your connection and try again.",
                  ),
                )
            }
          >
            Change account
          </Button>
        </div>
      </header>
      <main className="setup-main">
        <Animate identity="setup">
          <div className="setup-progress">
            <span>
              <Check size={12} /> Account connected
            </span>
            <i />
            Workspace details
          </div>
          <h1>Make yourself at home.</h1>
          <p className="setup-intro">
            Tell us how you’ll use EasyFarm. We’ll shape your workspace around
            you.
          </p>
          {!user ? (
            <p role="status">
              {session.error
                ? "Could not load your profile. Refresh to try again."
                : "Opening your profile…"}
            </p>
          ) : (
            <form id="profile-form" onSubmit={form.handleSubmit(submit)}>
              <div className="portal-choice" aria-label="Choose your portal">
                {(["buyer", "grower"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    data-portal={r}
                    aria-pressed={role === r}
                    disabled={form.formState.isSubmitting}
                    onClick={() => setRole(r)}
                  >
                    {r === "buyer" ? <ShoppingBasket /> : <Sprout />}
                    <span>
                      <strong>
                        {r === "buyer" ? "I’m buying" : "I’m growing"}
                      </strong>
                      <small>
                        {r === "buyer"
                          ? "Find fresh produce and trade directly with growers."
                          : "List your harvest and connect with business buyers."}
                      </small>
                    </span>
                    {role === r && <Check className="role-check" size={18} />}
                  </button>
                ))}
              </div>
              <div className="profile-fields">
                <div>
                  <Label htmlFor="organization">
                    {role === "grower" ? "Farm name" : "Business name"}
                  </Label>
                  <Input
                    id="organization"
                    autoComplete="organization"
                    placeholder={
                      role === "grower"
                        ? "Your farm’s name"
                        : "Your business’s name"
                    }
                    maxLength={100}
                    {...form.register("organization")}
                  />
                  {form.formState.errors.organization && (
                    <p role="alert">
                      {form.formState.errors.organization.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="location">City or region</Label>
                  <Input
                    id="location"
                    autoComplete="address-level2"
                    placeholder="e.g. Hyderabad, Telangana"
                    maxLength={100}
                    {...form.register("location")}
                  />
                  {form.formState.errors.location && (
                    <p role="alert">{form.formState.errors.location.message}</p>
                  )}
                </div>
              </div>
              {error && (
                <p className="error-box" role="alert">
                  {error}
                </p>
              )}
              <div className="setup-submit-row">
                <p>
                  This Google account will stay connected to your{" "}
                  {role === "grower" ? "grower" : "buyer"} portal.
                </p>
                <Button
                  id="profile-submit"
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting
                    ? "Opening your workspace…"
                    : "Open " + role + " portal"}
                </Button>
              </div>
              <p className="setup-identity">
                <span>{user.name[0]}</span>Signed in as {user.name} ·{" "}
                {user.email}
              </p>
            </form>
          )}
        </Animate>
      </main>
    </div>
  );
}
