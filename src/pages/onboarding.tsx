import { useState, useEffect } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
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
import type { Role } from "@/lib/types";
import { useSession } from "./auth";

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
