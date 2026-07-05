import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  GraduationCap,
  Zap,
  Dumbbell,
  ClipboardCheck,
  Library,
  NotebookPen,
  BarChart3,
  Swords,
  ShieldCheck,
  Moon,
  Sun,
  Menu,
  X,
  Flame,
  LogIn,
  LogOut,
  Trophy,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, toggleTheme } from "@/lib/study/store";
import { levelProgress, stageForLevel } from "@/lib/study/companion";
import { Companion } from "./Companion";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  core?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Today", icon: Home, core: true },
  { to: "/learn", label: "Learn", icon: GraduationCap, core: true },
  { to: "/rapid", label: "Rapid Recall", icon: Zap, core: true },
  { to: "/drill", label: "Weakness Drill", icon: Dumbbell, core: true },
  { to: "/exam", label: "Exam Simulation", icon: ClipboardCheck, core: true },
  { to: "/bank", label: "Master Bank", icon: Library },
  { to: "/notebook", label: "Mistake Notebook", icon: NotebookPen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/battle", label: "Battle Arena", icon: Swords },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/character", label: "Character", icon: UserCog },
];


function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeOptions={{ exact: item.to === "/" }}
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          activeProps={{
            className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          }}
        >
          <item.icon className="size-4.5 shrink-0" />
          <span>{item.label}</span>
        </Link>
      ))}
      <div className="my-2 h-px bg-border" />
      <Link
        to="/integrity"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
        activeProps={{ className: "bg-accent text-accent-foreground" }}
      >
        <ShieldCheck className="size-4 shrink-0" />
        <span>Content Integrity</span>
      </Link>
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="size-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Surgery I</div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Final Mastery
        </div>
      </div>
    </Link>
  );
}

function AuthChip() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (email === null) {
    return (
      <Link
        to="/auth"
        className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-accent"
      >
        <LogIn className="size-3.5" /> Sign in
      </Link>
    );
  }
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
      }}
      className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-accent"
      title={`Signed in as ${email}`}
    >
      <LogOut className="size-3.5" /> Sign out
    </button>
  );
}

function HeaderStats() {
  const xp = useStore((s) => s.profile.xp);
  const streak = useStore((s) => s.profile.streakDays);
  const theme = useStore((s) => s.settings.theme);
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning-foreground sm:flex">
        <Flame className="size-3.5 text-warning" />
        {streak} day{streak === 1 ? "" : "s"}
      </div>

      <Link
        to="/analytics"
        className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 shadow-sm transition-colors hover:bg-accent"
        title={`${stage.title} · Level ${lp.level}`}
      >
        <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          <Companion level={lp.level} size={30} bob={false} />
        </span>
        <span className="leading-tight">
          <span className="block text-xs font-semibold">Lv {lp.level}</span>
          <span className="block h-1 w-14 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${lp.pct}%` }}
            />
          </span>
        </span>
      </Link>

      <AuthChip />

      <button
        onClick={toggleTheme}
        className="flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Toggle dark mode"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar px-4 py-5 lg:flex">
        <div className="px-1">
          <Brand />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto no-scrollbar">
          <NavLinks />
        </div>
        <CompanionFooter />
      </aside>

      {/* Mobile slide-over */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-pop-in border-r bg-sidebar px-4 py-5 shadow-xl">
            <div className="flex items-center justify-between px-1">
              <Brand />
              <button
                onClick={() => setMenuOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-sm lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </button>
            <div className="lg:hidden">
              <Brand />
            </div>
          </div>
          <HeaderStats />
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t bg-background/95 backdrop-blur-md lg:hidden">
        {NAV.filter((n) => n.core).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <item.icon className="size-5" />
            <span>{item.label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function CompanionFooter() {
  const xp = useStore((s) => s.profile.xp);
  const name = useStore((s) => s.profile.name);
  const lp = levelProgress(xp);
  const stage = stageForLevel(lp.level);
  return (
    <div className="mt-4 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
          <Companion level={lp.level} size={44} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold">{stage.title}</div>
          <div className="text-xs text-muted-foreground">
            {name} · {xp} XP
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${lp.pct}%` }}
        />
      </div>
    </div>
  );
}
