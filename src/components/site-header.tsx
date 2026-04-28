import { Link } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
import logo from "@/assets/gather-logo.png";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 rounded-3xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-2xl transition-all duration-300 hover:bg-white/10 sm:px-6">
      <div className="flex h-14 items-center justify-between">
        <Link to="/" className="group flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gradient-primary p-0.5 shadow-lg transition-transform group-hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-background">
              <img src={logo} alt="Gather" className="h-7 w-7 object-contain" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl font-bold tracking-tight text-foreground">Gather</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">Meeting</span>
          </div>
        </Link>

        <nav className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-foreground/80 shadow-inner sm:flex">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            No login required
          </div>
          <Button asChild size="sm" className="h-10 rounded-xl bg-gradient-primary px-5 font-bold text-primary-foreground shadow-glow transition-all hover:scale-105 hover:opacity-95">
            <Link to="/">New room</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
