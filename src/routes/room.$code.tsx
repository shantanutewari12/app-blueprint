import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare,
  Users, Hand, Smile, PhoneOff, Copy, Send, X, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRoomCode } from "@/lib/room";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender_name: string;
  content: string;
  created_at: string;
  sender_id: string | null;
}

interface MeetingRow {
  id: string;
  room_code: string;
  title: string;
  host_id: string | null;
  password: string | null;
  ended_at: string | null;
}

export const Route = createFileRoute("/room/$code")({
  component: RoomPage,
});

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🙌"];

const DEMO_PEERS = [
  { id: "p1", name: "Aanya", color: "from-pink-400 to-rose-500" },
  { id: "p2", name: "Rohan", color: "from-blue-400 to-indigo-500" },
  { id: "p3", name: "Mira", color: "from-emerald-400 to-teal-500" },
];

function RoomPage() {
  const { code } = Route.useParams();
  const roomCode = normalizeRoomCode(code);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [guestName, setGuestName] = useState("");

  // call state
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load meeting
  useEffect(() => {
    (async () => {
      let { data, error } = await supabase
        .from("meetings")
        .select("id, room_code, title, host_id, password, ended_at")
        .eq("room_code", roomCode)
        .maybeSingle();

      // If room doesn't exist, auto-create so any shared link works (guest or signed-in)
      if (!data && !error) {
        const { data: created, error: insErr } = await supabase
          .from("meetings")
          .insert({
            room_code: roomCode,
            title: "Instant meeting",
            host_id: user?.id ?? null,
          })
          .select("id, room_code, title, host_id, password, ended_at")
          .single();
        if (!insErr) data = created;
      }

      if (!data) {
        toast.error("Meeting not found");
        navigate({ to: "/" });
        return;
      }
      setMeeting(data);
      setLoading(false);
    })();
  }, [roomCode, user, navigate]);

  // Fetch chat history + realtime
  useEffect(() => {
    if (!meeting) return;
    (async () => {
      const { data } = await supabase
        .from("meeting_messages")
        .select("*")
        .eq("meeting_id", meeting.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data);
    })();

    const channel = supabase
      .channel(`meeting:${meeting.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_messages",
          filter: `meeting_id=eq.${meeting.id}`,
        },
        (payload) => {
          setMessages((m) => [...m, payload.new as ChatMessage]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting]);

  const senderName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || guestName || "Guest";

  // Camera/mic
  useEffect(() => {
    if (!joined) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // sync mic state
        stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      } catch (e) {
        toast.error("Camera/mic blocked", {
          description: "We'll continue without it. Check browser permissions.",
        });
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  // toggle tracks live
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  const sendMessage = async () => {
    if (!draft.trim() || !meeting) return;
    const content = draft.trim();
    setDraft("");
    const { error } = await supabase.from("meeting_messages").insert({
      meeting_id: meeting.id,
      sender_id: user?.id ?? null,
      sender_name: senderName,
      content,
    });
    if (error) toast.error(error.message);
  };

  const sendReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    setReactions((r) => [...r, { id, emoji }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2400);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  const leave = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate({ to: "/" });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      setScreenSharing(false);
      // restore camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: true });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {}
      return;
    }
    try {
      const screen = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
      }).getDisplayMedia({ video: true });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = screen;
      if (videoRef.current) videoRef.current.srcObject = screen;
      screen.getVideoTracks()[0].onended = () => setScreenSharing(false);
      setScreenSharing(true);
    } catch {
      toast.error("Screen share cancelled");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-call-bg text-white">
        Loading meeting…
      </div>
    );
  }

  // Pre-join lobby
  if (!joined) {
    return (
      <div className="flex min-h-screen flex-col bg-call-bg text-white">
        <header className="flex items-center justify-between p-4">
          <Link to="/" className="text-sm text-white/70 hover:text-white">
            ← Linka
          </Link>
          <button onClick={copyLink} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">
            <Copy className="h-3.5 w-3.5" />
            <span className="font-mono">{roomCode}</span>
          </button>
        </header>

        <div className="grid flex-1 items-center gap-8 px-4 pb-10 lg:grid-cols-2 lg:px-12">
          <div>
            <div className="aspect-video overflow-hidden rounded-3xl bg-call-tile shadow-elevated">
              <LobbyPreview />
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight">{meeting?.title}</h1>
            <p className="mt-2 text-white/60">Ready to join? Check your name and hit join.</p>

            {!user && (
              <div className="mt-6">
                <label className="text-sm text-white/70">Your name</label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1.5 border-white/15 bg-white/5 text-white placeholder:text-white/30"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                disabled={!user && !guestName.trim()}
                onClick={() => setJoined(true)}
                className="h-12 flex-1 bg-gradient-primary text-primary-foreground hover:opacity-95"
              >
                Join now
              </Button>
              {!user && (
                <Button asChild variant="outline" className="h-12 border-white/20 bg-transparent text-white hover:bg-white/10">
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>

            <p className="mt-4 text-xs text-white/40">
              Tip: For real audio/video between participants, connect Daily.co in settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // In-call
  return (
    <div className="flex h-screen flex-col bg-call-bg text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-white/70 hover:text-white">Linka</Link>
          <span className="hidden text-white/40 sm:inline">·</span>
          <span className="hidden truncate text-sm font-medium sm:inline">{meeting?.title}</span>
        </div>
        <button onClick={copyLink} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">
          <Copy className="h-3.5 w-3.5" />
          <span className="font-mono">{roomCode}</span>
        </button>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 p-3">
          <div className="grid h-full gap-2.5 sm:grid-cols-2">
            {/* Local */}
            <Tile name={`${senderName} (You)`} accent="bg-primary">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn("h-full w-full object-cover", !camOn && "hidden")}
              />
              {!camOn && (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-2xl font-semibold">
                    {senderName.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              {!micOn && (
                <div className="absolute right-2 top-2 rounded-full bg-destructive p-1.5">
                  <MicOff className="h-3 w-3" />
                </div>
              )}
              {handRaised && (
                <div className="absolute left-2 top-2 rounded-full bg-warning p-1.5 text-warning-foreground">
                  <Hand className="h-3 w-3" />
                </div>
              )}
            </Tile>

            {DEMO_PEERS.map((p) => (
              <Tile key={p.id} name={p.name}>
                <div className={`h-full w-full bg-gradient-to-br ${p.color}`} />
              </Tile>
            ))}
          </div>

          {/* Floating reactions */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-[float_2.4s_ease-out_forwards] text-4xl"
                style={{ ['--x' as never]: `${(Math.random() - 0.5) * 200}px` }}
              >
                {r.emoji}
              </div>
            ))}
          </div>
        </div>

        {/* Right panels */}
        {(showChat || showPeople) && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-white/5 bg-call-tile/40 md:flex">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <span className="font-medium">{showChat ? "Chat" : "People"}</span>
              <button onClick={() => { setShowChat(false); setShowPeople(false); }} className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {showChat && (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 && (
                    <p className="text-center text-xs text-white/40">No messages yet. Say hi!</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id}>
                      <div className="text-xs font-medium text-white/70">
                        {m.sender_name}
                        <span className="ml-2 text-white/30">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="mt-0.5 break-words text-sm">{m.content}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/5 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Send a message"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                    <Button onClick={sendMessage} size="icon" className="bg-gradient-primary text-primary-foreground hover:opacity-95">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {showPeople && (
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                <PersonRow name={`${senderName} (You)`} host={user?.id === meeting?.host_id} micOn={micOn} />
                {DEMO_PEERS.map((p) => (
                  <PersonRow key={p.id} name={p.name} micOn />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="flex items-center justify-between border-t border-white/5 bg-call-bg/95 px-4 py-3 backdrop-blur">
        <div className="hidden text-xs text-white/40 sm:block">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>

        <div className="mx-auto flex items-center gap-2">
          <ControlBtn active={micOn} onClick={() => setMicOn((v) => !v)} label={micOn ? "Mute" : "Unmute"}>
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </ControlBtn>
          <ControlBtn active={camOn} onClick={() => setCamOn((v) => !v)} label={camOn ? "Stop video" : "Start video"}>
            {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlBtn>
          <ControlBtn active={!screenSharing} onClick={toggleScreenShare} label="Share screen">
            <MonitorUp className="h-5 w-5" />
          </ControlBtn>
          <ControlBtn active={!handRaised} onClick={() => setHandRaised((v) => !v)} label="Raise hand">
            <Hand className="h-5 w-5" />
          </ControlBtn>

          <div className="relative">
            <ControlBtn active onClick={() => {}} label="React" group>
              <Smile className="h-5 w-5" />
            </ControlBtn>
            <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 items-center gap-1 rounded-2xl bg-call-control p-2 shadow-elevated group-hover:flex">
              {REACTIONS.map((r) => (
                <button key={r} onClick={() => sendReaction(r)} className="rounded-lg p-1 text-xl transition hover:scale-125">
                  {r}
                </button>
              ))}
            </div>
          </div>

          <ControlBtn active onClick={() => { setShowChat((v) => !v); setShowPeople(false); }} label="Chat">
            <MessageSquare className="h-5 w-5" />
          </ControlBtn>
          <ControlBtn active onClick={() => { setShowPeople((v) => !v); setShowChat(false); }} label="People">
            <Users className="h-5 w-5" />
          </ControlBtn>

          <button
            onClick={leave}
            className="ml-2 flex items-center gap-2 rounded-2xl bg-destructive px-5 py-2.5 font-medium text-destructive-foreground shadow-soft transition hover:opacity-90"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        <button className="hidden h-10 w-10 items-center justify-center rounded-xl text-white/60 hover:bg-white/5 hover:text-white sm:flex">
          <MoreVertical className="h-5 w-5" />
        </button>
      </footer>

      <style>{`
        @keyframes float {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
          15% { opacity: 1; transform: translate(calc(-50% + var(--x, 0px) * 0.3), -40px) scale(1.1); }
          100% { transform: translate(calc(-50% + var(--x, 0px)), -360px) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Tile({ name, children, accent }: { name: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-call-tile">
      {children}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs font-medium backdrop-blur">
        {accent && <span className={cn("h-1.5 w-1.5 rounded-full", accent)} />}
        {name}
      </div>
    </div>
  );
}

function ControlBtn({
  children, active, onClick, label, group,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void; label: string; group?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-2xl transition",
        active ? "bg-white/10 text-white hover:bg-white/15" : "bg-destructive/90 text-destructive-foreground hover:bg-destructive",
        group && "group",
      )}
    >
      {children}
    </button>
  );
}

function PersonRow({ name, host, micOn = true }: { name: string; host?: boolean; micOn?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 truncate text-sm">{name}{host && <span className="ml-2 text-xs text-white/40">Host</span>}</div>
      {micOn ? <Mic className="h-3.5 w-3.5 text-white/50" /> : <MicOff className="h-3.5 w-3.5 text-destructive" />}
    </div>
  );
}

function LobbyPreview() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let s: MediaStream | undefined;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        s = stream;
        if (ref.current) ref.current.srcObject = stream;
      })
      .catch(() => {});
    return () => s?.getTracks().forEach((t) => t.stop());
  }, []);
  return (
    <video ref={ref} autoPlay playsInline muted className="h-full w-full object-cover" />
  );
}
