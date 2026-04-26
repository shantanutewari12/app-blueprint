import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Video, Link2, Calendar, Shield, Sparkles, Users, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "@/lib/room";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateInstant = async () => {
    if (!user) {
      toast.info("Sign in to create a meeting");
      navigate({ to: "/login" });
      return;
    }
    setCreating(true);
    try {
      const roomCode = generateRoomCode();
      const { error } = await supabase.from("meetings").insert({
        room_code: roomCode,
        title: "Instant meeting",
        host_id: user.id,
      });
      if (error) throw error;
      navigate({ to: "/room/$code", params: { code: roomCode } });
    } catch (e) {
      toast.error("Couldn't create meeting", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    const c = normalizeRoomCode(code);
    if (!c) return;
    if (!isValidRoomCode(c) && c.length < 3) {
      toast.error("Enter a valid meeting code");
      return;
    }
    navigate({ to: "/room/$code", params: { code: c } });
  };

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Free, secure & no downloads
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Video meetings that just{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">work</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Spin up a room in one click, share the link, and meet anyone — across any browser, on
              any device.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="lg"
                    disabled={creating}
                    className="h-12 gap-2 bg-gradient-primary px-6 text-primary-foreground shadow-glow hover:opacity-95"
                  >
                    <Video className="h-5 w-5" />
                    New meeting
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onClick={handleCreateInstant}>
                    <Plus className="mr-2 h-4 w-4" />
                    Start an instant meeting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/schedule" })}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule for later
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface p-1.5 shadow-soft sm:w-auto">
                <Link2 className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Enter a code or link"
                  className="h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
                <Button onClick={handleJoin} variant="ghost" size="sm" className="text-primary">
                  Join
                </Button>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              By joining you agree to our terms. Be kind. Don't record without consent.
            </p>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-lg rounded-3xl bg-call-bg p-3 shadow-elevated">
              <div className="grid h-full grid-cols-2 gap-2">
                {[
                  { name: "Aanya", color: "from-pink-400 to-rose-500" },
                  { name: "Rohan", color: "from-blue-400 to-indigo-500" },
                  { name: "Mira", color: "from-emerald-400 to-teal-500" },
                  { name: "Kabir", color: "from-amber-400 to-orange-500" },
                ].map((p, i) => (
                  <div
                    key={p.name}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${p.color}`}
                  >
                    <div className="absolute bottom-2 left-2 rounded-md bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                      {p.name}
                    </div>
                    {i === 0 && (
                      <div className="absolute right-2 top-2 rounded-full bg-success px-2 py-0.5 text-[10px] font-medium text-success-foreground">
                        Speaking
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-0 -bottom-5 mx-auto flex w-max items-center gap-2 rounded-2xl bg-call-control/95 px-3 py-2 shadow-elevated backdrop-blur">
                {["mic", "cam", "share", "chat", "leave"].map((k, i) => (
                  <div
                    key={k}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      i === 4 ? "bg-destructive" : "bg-white/10"
                    }`}
                  >
                    <div className="h-3.5 w-3.5 rounded-sm bg-white/80" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/60 bg-surface/50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "Up to 16 in a grid",
                  desc: "Speaker view auto-highlights whoever's talking.",
                },
                {
                  icon: MessageSquare,
                  title: "Live chat & reactions",
                  desc: "Text, emojis and file shares right inside the call.",
                },
                {
                  icon: Shield,
                  title: "Private rooms",
                  desc: "Add a password or a waiting room when you need it.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Linka Meet</span>
          <span>Made with care · Be present, be kind.</span>
        </div>
      </footer>
    </div>
  );
}
