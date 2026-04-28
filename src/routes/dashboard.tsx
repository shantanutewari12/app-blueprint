import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Copy, Plus, Video, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/room";
import { toast } from "sonner";

interface Meeting {
  id: string;
  room_code: string;
  title: string;
  scheduled_for: string | null;
  created_at: string;
  ended_at: string | null;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My meetings — Linka" },
      { name: "description", content: "Your scheduled and recent meetings." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, room_code, title, scheduled_for, created_at, ended_at")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) toast.error(error.message);
      else setMeetings(data || []);
      setLoading(false);
    })();
  }, [user]);

  const createInstant = async () => {
    if (!user) return;
    const code = generateRoomCode();
    const { error } = await supabase.from("meetings").insert({
      room_code: code,
      title: "Instant meeting",
      host_id: user.id,
    });
    if (error) return toast.error(error.message);
    navigate({ to: "/room/$code", params: { code } });
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMeetings((m) => m.filter((x) => x.id !== id));
    toast.success("Meeting removed");
  };

  if (authLoading || !user) return null;

  const upcoming = meetings.filter(
    (m) => m.scheduled_for && new Date(m.scheduled_for) > new Date(),
  );
  const others = meetings.filter((m) => !upcoming.includes(m));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My meetings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your scheduled and recent rooms, all in one place.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/schedule">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Link>
            </Button>
            <Button
              onClick={createInstant}
              className="bg-gradient-primary text-primary-foreground hover:opacity-95"
            >
              <Plus className="mr-2 h-4 w-4" />
              New meeting
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <Section title="Upcoming" meetings={upcoming} onCopy={copyLink} onRemove={remove} />
            <Section title="Recent" meetings={others} onCopy={copyLink} onRemove={remove} />
            {meetings.length === 0 && (
              <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
                <Video className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No meetings yet. Create your first one!
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  meetings,
  onCopy,
  onRemove,
}: {
  title: string;
  meetings: Meeting[];
  onCopy: (code: string) => void;
  onRemove: (id: string) => void;
}) {
  if (meetings.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
        {meetings.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 p-4 sm:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Video className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.title}</div>
              <div className="text-xs text-muted-foreground">
                {m.scheduled_for
                  ? new Date(m.scheduled_for).toLocaleString()
                  : `Created ${new Date(m.created_at).toLocaleDateString()}`}
                {" · "}
                <span className="font-mono">{m.room_code}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCopy(m.room_code)}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button asChild variant="ghost" size="icon" title="Open">
                <Link to="/room/$code" params={{ code: m.room_code }}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onRemove(m.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
