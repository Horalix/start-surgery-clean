import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Swords } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox.";
  if (m.includes("user already registered"))
    return "That email is already registered. Try signing in.";
  if (m.includes("password should be")) return "Password must be at least 6 characters.";
  return msg;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  // Redirect once we have a session (single listener, no polling)
  useEffect(() => {
    let unsub = () => {};
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/", replace: true });
      }
    });
    unsub = () => sub.subscription.unsubscribe();
    return unsub;
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. You're signed in.");
        } else {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
          setPassword("");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      } else {
        // forgot
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If that email exists, a reset link is on its way.");
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(friendlyError(msg));
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create your account"
      : mode === "forgot"
        ? "Reset your password"
        : "Welcome back";
  const subtitle =
    mode === "forgot"
      ? "Enter your email and we'll send you a reset link."
      : "Sign in to track progress and join the Battle Arena.";

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Swords className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Shown to opponents"
                maxLength={40}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setMode("forgot");
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}

          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {errorMsg}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "…"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 space-y-1 text-center text-sm text-muted-foreground">
          {mode === "signup" && (
            <div>
              Already have an account?{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  setErrorMsg(null);
                  setMode("signin");
                }}
              >
                Sign in
              </button>
            </div>
          )}
          {mode === "signin" && (
            <div>
              New here?{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  setErrorMsg(null);
                  setMode("signup");
                }}
              >
                Create one
              </button>
            </div>
          )}
          {mode === "forgot" && (
            <div>
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  setErrorMsg(null);
                  setMode("signin");
                }}
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to fair play.{" "}
        <Link to="/integrity" className="underline hover:text-foreground">
          Content integrity
        </Link>
      </p>
    </div>
  );
}
