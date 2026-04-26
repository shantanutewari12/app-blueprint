import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import logo from "@/assets/linka-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Linka Meet" },
      { name: "description", content: "Sign in to schedule and host meetings on Linka." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error("Google sign-in failed", {
        description: result.error.message ?? "Try again.",
      });
      return;
    }
    if (!result.redirected) {
      navigate({ to: "/dashboard" });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error("Sign in failed", { description: error.message });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Sign up failed", { description: error.message });
    } else {
      toast.success("Welcome!", { description: "Check your inbox to confirm if needed." });
    }
  };

  return (
    <div className="grid min-h-screen bg-hero lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-call-bg p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary">
            <Video className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Linka</span>
        </Link>
        <div className="relative z-10">
          <h2 className="text-3xl font-semibold leading-tight">
            Bring your team together — in one click.
          </h2>
          <p className="mt-3 max-w-sm text-white/70">
            Host instant or scheduled meetings, share your screen, chat live, and never miss a
            moment.
          </p>
        </div>
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary-glow/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Video className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Linka</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to host meetings and manage your schedule.
          </p>

          <Button
            onClick={handleGoogle}
            variant="outline"
            className="mt-6 h-11 w-full gap-2 bg-card"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or use email
            <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3 pt-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" disabled={loading} className="h-11 w-full bg-gradient-primary text-primary-foreground hover:opacity-95">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="mr-2 h-4 w-4" />Sign in</>}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3 pt-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password-up">Password</Label>
                  <Input id="password-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" disabled={loading} className="h-11 w-full bg-gradient-primary text-primary-foreground hover:opacity-95">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
