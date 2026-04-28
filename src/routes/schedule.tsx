import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Copy, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/room";
import { toast } from "sonner";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule a meeting — Linka" },
      { name: "description", content: "Plan a meeting and share the invite link in seconds." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [password, setPassword] = useState("");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const scheduledFor = date && time ? new Date(`${date}T${time}`).toISOString() : null;
    const code = generateRoomCode();
    const { error } = await supabase.from("meetings").insert({
      room_code: code,
      title: title.trim() || "Untitled meeting",
      host_id: user.id,
      scheduled_for: scheduledFor,
      duration_minutes: Number(duration),
      waiting_room: waitingRoom,
      password: password || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/room/${code}`;
    setCreatedLink(url);
    toast.success("Meeting scheduled");
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <h1 className="text-3xl font-semibold tracking-tight">Schedule a meeting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a time, share the invite link, and we'll have the room ready.
        </p>

        {createdLink ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-success">
              <Calendar className="h-5 w-5" />
              <span className="font-medium">Meeting created!</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Share this link with your guests:</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted p-2">
              <code className="flex-1 truncate px-2 text-sm">{createdLink}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(createdLink);
                  toast.success("Copied");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
            <div className="mt-5 flex gap-2">
              <Button asChild variant="outline">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
              <Button
                onClick={() => {
                  setCreatedLink(null);
                  setTitle("");
                  setDate("");
                  setTime("");
                  setPassword("");
                }}
              >
                Schedule another
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <div>
              <Label htmlFor="title">Meeting title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly team sync"
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  step={15}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="password">Password (optional)</Label>
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for none"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <div className="font-medium">Waiting room</div>
                <div className="text-xs text-muted-foreground">
                  Approve guests before they join.
                </div>
              </div>
              <Switch checked={waitingRoom} onCheckedChange={setWaitingRoom} />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full bg-gradient-primary text-primary-foreground hover:opacity-95"
            >
              {submitting ? "Creating…" : "Create meeting"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
