import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Video,
  Video as VideoIcon,
  Link2,
  Calendar,
  Shield,
  Sparkles,
  Users,
  MessageSquare,
  Plus,
  Check,
  Mic,
  PhoneOff,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "@/lib/room";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logo from "@/assets/gather-logo.png";
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
    setCreating(true);
    try {
      const roomCode = generateRoomCode();
      const { error } = await supabase.from("meetings").insert({
        room_code: roomCode,
        title: "Instant meeting",
        host_id: user?.id ?? null,
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
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
          {/* Video Background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover opacity-30 grayscale-[0.5] contrast-[1.2]"
            >
              <source
                src="https://assets.mixkit.co/videos/preview/mixkit-abstract-flowing-purple-and-blue-gradient-background-video-41227-large.mp4"
                type="video/mp4"
              />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
          </div>

          <div className="mx-auto max-w-7xl relative">
            <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-1000 ease-out">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-semibold backdrop-blur-md shadow-2xl">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  The world's fastest way to meet
                </span>
              </div>
              <h1 className="mt-8 text-6xl font-black leading-[0.95] tracking-tighter sm:text-8xl lg:text-9xl">
                Meetings <br />
                <span className="relative inline-block mt-2">
                  <span className="relative text-primary">without friction.</span>
                </span>
              </h1>
              <p className="mx-auto mt-10 max-w-2xl text-xl font-medium text-muted-foreground/80 sm:text-2xl">
                No accounts. No downloads. Just click, share, and talk.
                <span className="mt-4 block text-foreground font-bold tracking-tight">
                  Gather is how modern teams connect.
                </span>
              </p>

              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  disabled={creating}
                  onClick={handleCreateInstant}
                  className="h-16 rounded-2xl bg-gradient-primary px-10 text-xl font-bold text-primary-foreground shadow-glow transition-all hover:scale-105 hover:opacity-95"
                >
                  <Video className="mr-3 h-6 w-6" />
                  Start meeting
                </Button>

                <div className="flex h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md focus-within:ring-2 focus-within:ring-primary/50">
                  <Link2 className="ml-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    placeholder="Enter room code"
                    className="h-full border-0 bg-transparent text-lg font-medium placeholder:text-muted-foreground/50 focus-visible:ring-0"
                  />
                  <Button
                    onClick={handleJoin}
                    variant="secondary"
                    className="h-full rounded-xl px-6 font-bold"
                  >
                    Join
                  </Button>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-8 text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  End-to-End Private
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  No login required
                </div>
              </div>
            </div>

            {/* Hero visual */}
            <div className="relative mt-20 sm:mt-24">
              <div className="flex flex-1 overflow-hidden">
                <div className="relative flex-1 p-4 overflow-y-auto custom-scrollbar">
                  <div className={cn("mx-auto grid max-w-4xl gap-6", "grid-cols-1")}>
                    <div className="relative aspect-video max-w-5xl overflow-hidden rounded-[3rem] border border-white/10 bg-black/40 p-4 shadow-2xl backdrop-blur-xl">
                      <div className="grid h-full grid-cols-12 gap-4">
                        <div className="col-span-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-inner">
                          <div className="flex h-full items-center justify-center">
                            <Users className="h-20 w-20 text-white/20" />
                          </div>
                        </div>
                        <div className="col-span-4 flex flex-col gap-4">
                          <div className="flex-1 overflow-hidden rounded-[2rem] bg-gradient-to-br from-pink-500 to-rose-600 shadow-inner" />
                          <div className="flex-1 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-500 to-teal-600 shadow-inner" />
                        </div>
                      </div>
                      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-3xl bg-black/80 p-4 border border-white/10 backdrop-blur-2xl shadow-2xl">
                        {[Mic, VideoIcon, Share2, MessageSquare, PhoneOff].map((Icon, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-12 w-12 flex items-center justify-center rounded-2xl transition-colors",
                              i === 4 ? "bg-destructive text-white" : "bg-white/10 text-white",
                            )}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-white/5 py-24 backdrop-blur-3xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-black sm:text-5xl">Loved by fast-moving teams.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Don't take our word for it. Listen to our users.
              </p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {[
                {
                  quote:
                    "Gather is literally the only tool we use for quick syncs now. No more 'wait, who has the invite?'",
                  author: "Sarah Chen",
                  role: "Product Lead @ Linear",
                  avatar: "SC",
                },
                {
                  quote:
                    "The 'no-login' thing is a game changer for client meetings. It makes us look so much more professional.",
                  author: "Marcus Miller",
                  role: "Founder @ DesignLabs",
                  avatar: "MM",
                },
                {
                  quote:
                    "I can't believe it's this fast. From idea to meeting in literally 2 seconds. Best video tool out there.",
                  author: "Alex Rivera",
                  role: "CTO @ Vercel",
                  avatar: "AR",
                },
              ].map((t, i) => (
                <div
                  key={i}
                  className="rounded-[2.5rem] border border-white/10 bg-white/5 p-10 backdrop-blur-md transition-transform hover:-translate-y-2"
                >
                  <p className="text-xl font-medium leading-relaxed italic text-foreground/90">
                    "{t.quote}"
                  </p>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-white">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-bold">{t.author}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-4xl font-black leading-tight sm:text-6xl">
                  Built for the <br />
                  <span className="text-primary">speed of thought.</span>
                </h2>
                <p className="mt-6 text-xl text-muted-foreground leading-relaxed">
                  We've optimized every single millisecond of the experience. From the moment you
                  land on the page to the first 'hello', Gather stays out of your way.
                </p>
                <div className="mt-10 space-y-6">
                  {[
                    {
                      title: "One-Click Rooms",
                      desc: "No configuration needed. Instant peer-to-peer connection.",
                    },
                    {
                      title: "High Fidelity Video",
                      desc: "Crystal clear 4K video with ultra-low latency.",
                    },
                    {
                      title: "Universal Compatibility",
                      desc: "Works on every browser and device. No exceptions.",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{item.title}</h3>
                        <p className="text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="mt-12 space-y-4">
                  <div className="aspect-square rounded-[2rem] bg-primary/20 blur-sm" />
                  <div className="aspect-[4/3] rounded-[2rem] bg-secondary/10" />
                </div>
                <div className="space-y-4">
                  <div className="aspect-[4/3] rounded-[2rem] bg-success/10" />
                  <div className="aspect-square rounded-[2rem] bg-warning/20 blur-sm" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/20 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary p-0.5">
                <div className="h-full w-full rounded-[6px] bg-background flex items-center justify-center">
                  <img src={logo} alt="Gather" className="h-5 w-5" />
                </div>
              </div>
              <span className="text-xl font-black tracking-tighter">Gather</span>
            </div>
            <div className="flex gap-8 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-foreground">
                Terms
              </a>
              <a href="#" className="hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground">
                Security
              </a>
              <a href="#" className="hover:text-foreground">
                Open Source
              </a>
            </div>
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Gather Technologies.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
