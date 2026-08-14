import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Grade Lens" },
      { name: "description", content: "Sign in or create your Grade Lens account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<"select" | "student" | "counselor" | "admin">("select");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [matric, setMatric] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup" && portal !== "admin") {
        const metadata: Record<string, any> = { full_name: fullName };
        if (portal === "student") {
          metadata.matric_no = matric.trim().toUpperCase() || null;
        } else if (portal === "counselor") {
          metadata.role = "counselor";
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: metadata,
          },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      let msg = "Something went wrong";
      if (err?.message && err.message !== "{}") {
        msg = err.message;
      } else if (err?.status === 429 || err?.code === "over_email_send_rate_limit") {
        msg = "Too many signup attempts. Please wait a few minutes and try again.";
      } else if (typeof err === "object" && (!err?.message || err.message === "{}")) {
        msg = "Signup temporarily unavailable — email rate limit reached. Please wait a few minutes and try again.";
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav role={null} />
      <main className="mx-auto flex max-w-md flex-col px-4 pb-24 pt-16 md:pt-24">
        {portal === "select" ? (
          <div className="card-elevated rounded-3xl p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Choose your portal</h1>
              <p className="mt-1 text-sm text-muted-foreground">Select how you want to access Grade Lens.</p>
            </div>

            <div className="space-y-4">
              {/* Student Portal Card */}
              <div className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-primary/50 transition">
                <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">Student</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  View your academic performance, CGPA, courses and personalized insights.
                </p>
                <button
                  onClick={() => {
                    setPortal("student");
                    setMode("signin");
                  }}
                  className="mt-4 w-full rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
                >
                  Student Portal
                </button>
              </div>

              {/* Counselor Portal Card */}
              <div className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-primary/50 transition">
                <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">Counsellor</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Monitor assigned students, identify academic risks and manage interventions.
                </p>
                <button
                  onClick={() => {
                    setPortal("counselor");
                    setMode("signin");
                  }}
                  className="mt-4 w-full rounded-full bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-accent transition"
                >
                  Counsellor Portal
                </button>
              </div>

              {/* Admin Portal Card */}
              <div className="rounded-2xl border border-border bg-surface/50 p-5 hover:border-primary/50 transition">
                <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">Administrator</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  View institution-wide analytics, risk distributions and academic insights.
                </p>
                <button
                  onClick={() => {
                    setPortal("admin");
                    setMode("signin");
                  }}
                  className="mt-4 w-full rounded-full bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-accent transition"
                >
                  Admin Portal
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-elevated rounded-3xl p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                {portal === "admin"
                  ? "Admin Login"
                  : mode === "signin"
                  ? `${portal === "student" ? "Student" : "Counsellor"} Login`
                  : `Create ${portal === "student" ? "Student" : "Counsellor"} Account`}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {portal === "admin"
                  ? "Sign in to access institution analytics."
                  : mode === "signin"
                  ? "Sign in to view your record."
                  : portal === "student"
                  ? "Students: enter your matric number to link your record."
                  : "Counsellors: create your administrative account."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <Field
                    label="Full name"
                    value={fullName}
                    onChange={setFullName}
                    required
                    placeholder="Jane Doe"
                  />
                  {portal === "student" && (
                    <Field
                      label="Matric no."
                      value={matric}
                      onChange={setMatric}
                      required
                      placeholder="e.g. CSC/2020/001"
                    />
                  )}
                </>
              )}
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                required
                placeholder="you@example.com"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                required
                placeholder="••••••••"
                minLength={6}
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 text-xs">
              {portal !== "admin" && (
                <div className="text-sm text-muted-foreground">
                  {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  >
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </div>
              )}

              <button
                onClick={() => setPortal("select")}
                className="font-medium text-muted-foreground hover:text-foreground transition underline"
              >
                Choose different portal
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder, minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        className="w-full rounded-xl border border-input bg-surface/70 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-focus"
      />
    </label>
  );
}
