import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  Hand,
  Smile,
  PhoneOff,
  Copy,
  Send,
  X,
  Share2,
  Mail,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRoomCode } from "@/lib/room";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logo from "@/assets/gather-logo.png";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

interface PresenceState {
  peerId: string;
  name: string;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
}

interface RemotePeer {
  peerId: string;
  name: string;
  stream?: MediaStream;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
}

export const Route = createFileRoute("/room/$code")({
  component: RoomPage,
});

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🙌"];
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

function makePeerId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function RoomPage() {
  const { code } = Route.useParams();
  const roomCode = normalizeRoomCode(code);
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [guestName, setGuestName] = useState("");

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);

  const [draft, setDraft] = useState("");
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const peerIdRef = useRef<string>(makePeerId());
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});

  const senderName = useMemo(() => guestName || "Guest", [guestName]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  // Load / auto-create meeting
  useEffect(() => {
    (async () => {
      const { data: existingData, error } = await supabase
        .from("meetings")
        .select("id, room_code, title, host_id, password, ended_at")
        .eq("room_code", roomCode)
        .maybeSingle();

      let data = existingData;

      if (!data && !error) {
        const { data: created, error: insErr } = await supabase
          .from("meetings")
          .insert({
            room_code: roomCode,
            title: "Instant meeting",
            host_id: null,
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
  }, [roomCode, navigate]);

  // Chat history + realtime messages
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

    const ch = supabase
      .channel(`chat:${meeting.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_messages",
          filter: `meeting_id=eq.${meeting.id}`,
        },
        (payload) => setMessages((m) => [...m, payload.new as ChatMessage]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [meeting]);

  const initStream = useCallback(
    async (cancelled = false) => {
      try {
        if (streamRef.current) {
          setLocalStream(streamRef.current);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
        streamRef.current = stream;

        stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
        stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
      } catch (err) {
        console.error("Camera access error:", err);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!cancelled) {
            setLocalStream(audioStream);
            streamRef.current = audioStream;
            setCamOn(false);
          }
        } catch {
          toast.error("Camera/mic blocked", {
            description: "Please allow media permissions in your browser settings.",
          });
        }
      }
    },
    [micOn, camOn],
  );

  useEffect(() => {
    let cancelled = false;
    void initStream(cancelled);

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [initStream]);

  // Sync video element when joined
  useEffect(() => {
    if (joined && videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [joined, localStream]);

  // Sync mic/cam states to stream tracks
  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn, localStream]);

  useEffect(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn, localStream]);

  // WebRTC + Supabase Realtime presence/signaling
  useEffect(() => {
    if (!joined || !meeting) return;
    const myId = peerIdRef.current;

    const createPeer = async (remoteId: string, initiator: boolean) => {
      if (pcsRef.current[remoteId]) return pcsRef.current[remoteId];
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcsRef.current[remoteId] = pc;

      // Add tracks from current stream
      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => {
          pc.addTrack(track, currentStream);
        });
      }

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;
        setPeers((p) => {
          if (p[remoteId]?.stream === remoteStream) return p;
          return {
            ...p,
            [remoteId]: {
              ...(p[remoteId] ?? {
                peerId: remoteId,
                name: "Guest",
                micOn: true,
                camOn: true,
                handRaised: false,
              }),
              stream: remoteStream,
            },
          };
        });
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "ice",
            payload: { from: myId, to: remoteId, candidate: e.candidate.toJSON() },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          delete pcsRef.current[remoteId];
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { from: myId, to: remoteId, sdp: offer },
        });
      }
      return pc;
    };

    const ch = supabase.channel(`room:${meeting.id}`, {
      config: { presence: { key: myId } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, PresenceState[]>;
      const next: Record<string, RemotePeer> = {};
      Object.entries(state).forEach(([key, metas]) => {
        if (key === myId) return;
        const meta = metas[0];
        next[key] = {
          peerId: key,
          name: meta?.name ?? "Guest",
          micOn: meta?.micOn ?? true,
          camOn: meta?.camOn ?? true,
          handRaised: meta?.handRaised ?? false,
          stream: peers[key]?.stream,
        };
      });
      setPeers((prev) => {
        const merged: Record<string, RemotePeer> = {};
        Object.keys(next).forEach((k) => {
          merged[k] = { ...next[k], stream: prev[k]?.stream };
        });
        // drop peers no longer present
        Object.keys(prev).forEach((k) => {
          if (!next[k] && pcsRef.current[k]) {
            pcsRef.current[k].close();
            delete pcsRef.current[k];
          }
        });
        return merged;
      });
    });

    ch.on("presence", { event: "join" }, ({ key }) => {
      if (key === myId) return;
      // If we don't have a stream yet, signaling will be incomplete.
      // But we can still initiate and tracks will be added later if we use transceivers,
      // but here we just wait or re-sync.
      if (myId < key) {
        // small delay to ensure local media is ready
        setTimeout(() => void createPeer(key, true), 500);
      }
    });

    ch.on("presence", { event: "leave" }, ({ key }) => {
      const pc = pcsRef.current[key];
      if (pc) {
        pc.close();
        delete pcsRef.current[key];
      }
      setPeers((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    });

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== myId) return;
      const pc = await createPeer(payload.from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ch.send({
        type: "broadcast",
        event: "answer",
        payload: { from: myId, to: payload.from, sdp: answer },
      });
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== myId) return;
      const pc = pcsRef.current[payload.from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    });

    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== myId) return;
      const pc = pcsRef.current[payload.from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          /* ignore */
        }
      }
    });

    ch.on("broadcast", { event: "reaction" }, ({ payload }) => {
      const id = Date.now() + Math.random();
      setReactions((r) => [...r, { id, emoji: payload.emoji as string }]);
      setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2400);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          peerId: myId,
          name: senderName,
          micOn,
          camOn,
          handRaised,
        } satisfies PresenceState);
      }
    });

    return () => {
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, meeting]);

  // Update presence metadata when toggling state
  useEffect(() => {
    if (!channelRef.current) return;
    void channelRef.current.track({
      peerId: peerIdRef.current,
      name: senderName,
      micOn,
      camOn,
      handRaised,
    } satisfies PresenceState);
  }, [micOn, camOn, handRaised, senderName]);

  const sendMessage = async () => {
    if (!draft.trim() || !meeting) return;
    const content = draft.trim();
    setDraft("");
    const { error } = await supabase.from("meeting_messages").insert({
      meeting_id: meeting.id,
      sender_id: null,
      sender_name: senderName,
      content,
    });
    if (error) toast.error(error.message);
  };

  const sendReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    setReactions((r) => [...r, { id, emoji }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2400);
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
    toast.success("Link copied — share it on any device");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Gather meeting",
          text: `Join my meeting on Gather: ${roomCode}`,
          url: shareUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      setShowShare(true);
    }
  };

  const leave = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    navigate({ to: "/" });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      setScreenSharing(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        replaceLocalStream(stream);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const screen = await (
        navigator.mediaDevices as MediaDevices & {
          getDisplayMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
        }
      ).getDisplayMedia({ video: true });
      // Keep mic from current stream
      const audio = streamRef.current?.getAudioTracks()[0];
      if (audio) screen.addTrack(audio);
      replaceLocalStream(screen);
      screen.getVideoTracks()[0].onended = () => setScreenSharing(false);
      setScreenSharing(true);
    } catch {
      toast.error("Screen share cancelled");
    }
  };

  const replaceLocalStream = (stream: MediaStream) => {
    streamRef.current?.getVideoTracks().forEach((t) => t.stop());
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    const newVideoTrack = stream.getVideoTracks()[0];
    Object.values(pcsRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && newVideoTrack) void sender.replaceTrack(newVideoTrack);
    });
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
          <Link to="/" className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <img src={logo} alt="Gather" width={28} height={28} className="h-7 w-7" />
            Gather
          </Link>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="font-mono">{roomCode}</span>
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-10 px-4 pb-16">
          <div className="w-full max-w-xl">
            <div className="aspect-video overflow-hidden rounded-[2.5rem] border-4 border-white/5 bg-call-tile shadow-2xl ring-1 ring-white/10">
              <LobbyPreview stream={localStream} camOn={camOn} name={senderName} />
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <ControlBtn
                active={micOn}
                onClick={() => setMicOn((v) => !v)}
                label={micOn ? "Mute" : "Unmute"}
              >
                {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
              </ControlBtn>
              <ControlBtn
                active={camOn}
                onClick={() => setCamOn((v) => !v)}
                label={camOn ? "Stop video" : "Start video"}
              >
                {camOn ? <VideoIcon className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </ControlBtn>
            </div>
          </div>

          <div className="w-full max-w-md text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {meeting?.title}
            </h1>
            <p className="mt-4 text-lg text-white/60">
              Meeting ID: <span className="font-mono text-success">{roomCode}</span>
            </p>

            <div className="mt-8 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
              <Input
                readOnly
                value={shareUrl}
                className="border-0 bg-transparent text-sm text-white/80 focus-visible:ring-0"
              />
              <Button
                onClick={copyLink}
                size="sm"
                variant="secondary"
                className="shrink-0 bg-white/10 text-white hover:bg-white/20"
              >
                {linkCopied ? (
                  <Check className="mr-1 h-4 w-4" />
                ) : (
                  <Copy className="mr-1 h-4 w-4" />
                )}
                {linkCopied ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="mt-8 text-left">
              <label className="text-xs font-medium uppercase tracking-wider text-white/40">
                Your name
              </label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="How should we call you?"
                className="mt-2 h-12 border-white/15 bg-white/5 text-lg text-white placeholder:text-white/20 focus:border-primary/50"
              />
            </div>

            <div className="mt-8">
              <Button
                disabled={!guestName.trim()}
                onClick={() => setJoined(true)}
                className="h-14 w-full rounded-2xl bg-gradient-primary text-lg font-semibold text-primary-foreground shadow-glow hover:opacity-95"
              >
                Join meeting
              </Button>
            </div>
          </div>
        </div>

        <ShareDialog open={showShare} onOpenChange={setShowShare} url={shareUrl} code={roomCode} />
      </div>
    );
  }

  const peerList = Object.values(peers);
  const totalTiles = peerList.length + 1;
  const gridCols =
    totalTiles <= 1
      ? "grid-cols-1"
      : totalTiles === 2
        ? "grid-cols-2"
        : totalTiles <= 4
          ? "grid-cols-2"
          : totalTiles <= 9
            ? "grid-cols-2 md:grid-cols-3"
            : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className="flex h-screen flex-col bg-call-bg text-white">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <img src={logo} alt="Gather" width={24} height={24} className="h-6 w-6" />
            Gather
          </Link>
          <span className="hidden text-white/40 sm:inline">·</span>
          <span className="hidden truncate text-sm font-medium sm:inline">{meeting?.title}</span>
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">
            {totalTiles} {totalTiles === 1 ? "person" : "people"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowShare(true)}
            size="sm"
            className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-95"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share invite</span>
          </Button>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="font-mono">{roomCode}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 p-4 overflow-y-auto custom-scrollbar">
          <div className={cn("mx-auto grid max-w-4xl gap-6", gridCols)}>
            <Tile name={`${senderName} (You)`} accent="bg-primary">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-500",
                  !camOn ? "opacity-0" : "opacity-100",
                )}
              />
              {!camOn && <Avatar name={senderName} />}
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

            {peerList.length === 0 && (
              <Tile name="Waiting for others">
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/60">
                  <Users className="h-10 w-10 opacity-40" />
                  <p className="px-4 text-sm">
                    You're the only one here. Share the invite link to let others join.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowShare(true)}
                    className="bg-gradient-primary text-primary-foreground"
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share invite
                  </Button>
                </div>
              </Tile>
            )}

            {peerList.map((p) => (
              <Tile key={p.peerId} name={p.name}>
                <PeerVideo peer={p} />
                {!p.micOn && (
                  <div className="absolute right-2 top-2 rounded-full bg-destructive p-1.5">
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
                {p.handRaised && (
                  <div className="absolute left-2 top-2 rounded-full bg-warning p-1.5 text-warning-foreground">
                    <Hand className="h-3 w-3" />
                  </div>
                )}
              </Tile>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-[float_2.4s_ease-out_forwards] text-4xl"
                style={{ ["--x" as never]: `${(Math.random() - 0.5) * 200}px` }}
              >
                {r.emoji}
              </div>
            ))}
          </div>
        </div>

        {(showChat || showPeople) && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-white/5 bg-call-tile/40 md:flex">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <span className="font-medium">{showChat ? "Chat" : "People"}</span>
              <button
                onClick={() => {
                  setShowChat(false);
                  setShowPeople(false);
                }}
                className="text-white/60 hover:text-white"
              >
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
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
                    <Button
                      onClick={sendMessage}
                      size="icon"
                      className="bg-gradient-primary text-primary-foreground hover:opacity-95"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {showPeople && (
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                <PersonRow name={`${senderName} (You)`} host={false} micOn={micOn} />
                {peerList.map((p) => (
                  <PersonRow key={p.peerId} name={p.name} micOn={p.micOn} />
                ))}
                {peerList.length === 0 && (
                  <p className="px-3 py-2 text-xs text-white/40">Just you so far.</p>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-white/5 bg-call-bg/95 px-4 py-3 backdrop-blur">
        <div className="hidden text-xs text-white/40 sm:block">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="mx-auto flex items-center gap-2">
          <ControlBtn
            active={micOn}
            onClick={() => setMicOn((v) => !v)}
            label={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </ControlBtn>
          <ControlBtn
            active={camOn}
            onClick={() => setCamOn((v) => !v)}
            label={camOn ? "Stop video" : "Start video"}
          >
            {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlBtn>
          <ControlBtn active={!screenSharing} onClick={toggleScreenShare} label="Share screen">
            <MonitorUp className="h-5 w-5" />
          </ControlBtn>
          <ControlBtn
            active={!handRaised}
            onClick={() => setHandRaised((v) => !v)}
            label="Raise hand"
          >
            <Hand className="h-5 w-5" />
          </ControlBtn>

          <div className="group relative">
            <ControlBtn active onClick={() => {}} label="React">
              <Smile className="h-5 w-5" />
            </ControlBtn>
            <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 items-center gap-1 rounded-2xl bg-call-control p-2 shadow-elevated group-hover:flex">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => sendReaction(r)}
                  className="rounded-lg p-1 text-xl transition hover:scale-125"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <ControlBtn
            active
            onClick={() => {
              setShowChat((v) => !v);
              setShowPeople(false);
            }}
            label="Chat"
          >
            <MessageSquare className="h-5 w-5" />
          </ControlBtn>
          <ControlBtn
            active
            onClick={() => {
              setShowPeople((v) => !v);
              setShowChat(false);
            }}
            label="People"
          >
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
        <div className="hidden w-10 sm:block" />
      </footer>

      <ShareDialog open={showShare} onOpenChange={setShowShare} url={shareUrl} code={roomCode} />

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

function Tile({
  name,
  children,
  accent,
}: {
  name: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 shadow-elevated transition-all hover:bg-white/10">
      {children}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur-md border border-white/5">
        {accent && <span className={cn("h-2 w-2 rounded-full animate-pulse", accent)} />}
        {name}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-2xl font-semibold text-primary-foreground">
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

function PeerVideo({ peer }: { peer: RemotePeer }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && peer.stream) {
      ref.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  if (!peer.stream || !peer.camOn) return <Avatar name={peer.name} />;

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="h-full w-full object-cover transition-opacity duration-500"
    />
  );
}

function ControlBtn({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 shadow-soft",
        active
          ? "bg-white/10 text-white hover:bg-white/20 border border-white/10"
          : "bg-destructive text-white hover:bg-destructive/90 border border-destructive/20 shadow-glow",
      )}
    >
      {children}
    </button>
  );
}

function PersonRow({
  name,
  host,
  micOn = true,
}: {
  name: string;
  host?: boolean;
  micOn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 truncate text-sm">
        {name}
        {host && <span className="ml-2 text-xs text-white/40">Host</span>}
      </div>
      {micOn ? (
        <Mic className="h-3.5 w-3.5 text-white/50" />
      ) : (
        <MicOff className="h-3.5 w-3.5 text-destructive" />
      )}
    </div>
  );
}

function ShareDialog({
  open,
  onOpenChange,
  url,
  code,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const message = `Join my Gather meeting (${code}): ${url}`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to your meeting</DialogTitle>
          <DialogDescription>Anyone with this link can join — no signup needed.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2">
            <Input readOnly value={url} className="border-0 bg-transparent focus-visible:ring-0" />
            <Button
              onClick={copy}
              size="sm"
              className="shrink-0 bg-gradient-primary text-primary-foreground"
            >
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1 rounded-xl border p-3 text-xs hover:bg-accent"
            >
              <span className="text-lg">💬</span>
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Join my Gather meeting")}&body=${encodeURIComponent(message)}`}
              className="flex flex-col items-center gap-1 rounded-xl border p-3 text-xs hover:bg-accent"
            >
              <Mail className="h-5 w-5" />
              Email
            </a>
            <a
              href={`sms:?&body=${encodeURIComponent(message)}`}
              className="flex flex-col items-center gap-1 rounded-xl border p-3 text-xs hover:bg-accent"
            >
              <span className="text-lg">📱</span>
              SMS
            </a>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-center">
            <div className="text-xs text-muted-foreground">Meeting code</div>
            <div className="mt-1 font-mono text-lg font-semibold tracking-widest">{code}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LobbyPreview({
  stream,
  camOn,
  name,
}: {
  stream: MediaStream | null;
  camOn: boolean;
  name: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => {});
    }
  }, [stream]);

  if (!camOn || !stream) {
    return <Avatar name={name || "Guest"} />;
  }

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="h-full w-full object-cover transition-opacity duration-500"
    />
  );
}
