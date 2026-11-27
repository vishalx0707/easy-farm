import { lazy, useEffect, useState, type ComponentProps } from "react";
import { ClerkProvider, useAuth } from "@clerk/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Login = lazy(() =>
  import("@/pages/auth").then((m) => ({ default: m.Login })),
);
const Onboarding = lazy(() =>
  import("@/pages/onboarding").then((m) => ({ default: m.Onboarding })),
);
const Marketplace = lazy(() =>
  import("@/pages/marketplace").then((m) => ({ default: m.Marketplace })),
);

type ClerkUiProp = ComponentProps<typeof ClerkProvider>["ui"];

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

export function ClerkApp({
  publishableKey,
  ui,
}: {
  publishableKey: string;
  ui?: ClerkUiProp;
}) {
  const clerkUiProps = (
    ui ? { ui } : { prefetchUI: false }
  ) as Partial<Pick<ComponentProps<typeof ClerkProvider>, "ui">>;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      {...clerkUiProps}
      signInUrl="/login"
      signUpUrl="/login?continue=1"
      signInFallbackRedirectUrl="/onboarding"
      signUpFallbackRedirectUrl="/onboarding"
      appearance={{
        variables: {
          colorPrimary: "#33492a",
          fontFamily: "Montreal, Arial, sans-serif",
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
    </ClerkProvider>
  );
}
