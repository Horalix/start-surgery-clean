import { useEffect, type ReactNode } from "react";
import { hydrate, useHydrated } from "@/lib/study/store";

/**
 * Study data lives in localStorage, so interactive views must render client-side.
 * This gate hydrates the store on mount and shows a calm skeleton until ready,
 * preventing SSR hydration mismatches.
 */
export function ClientGate({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  useEffect(() => {
    hydrate();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm">Loading your study data…</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
