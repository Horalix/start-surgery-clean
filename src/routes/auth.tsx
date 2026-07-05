import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Swords } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();

  // Bounce away if already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/battle" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.invalidate();
        navigate({ to: "/battle" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setLoading(false);
    }
    // On redirected flow, browser navigates away; on iframe flow the auth listener above handles it.
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Swords className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to host and join online Battle Arena matches.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={google}
          disabled={loading}
        >
          Continue with Google
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

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
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
