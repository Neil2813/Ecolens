/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { useState } from "react";
import { EcoLogo } from "@/components/eco-logo";
import { loginUser, persistAuth } from "@/lib/api/auth";

export const Route = createFileRoute("/auth/signin")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      persistAuth(data);
      navigate({ to: "/map" });
    } catch (err: unknown) {
      // Network error → demo mode; API error → show message
      const isNetworkError = err instanceof TypeError;
      if (isNetworkError) {
        console.warn("Backend offline. Falling back to demo mode.");
        localStorage.setItem("ecolens:auth", "demo");
        navigate({ to: "/map" });
      } else {
        setError((err as Error).message || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 grid-bg">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 backdrop-blur"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <EcoLogo size={36} />
            <h1 className="text-3xl font-bold text-foreground">Ecolens</h1>
          </div>
          <p className="text-sm text-muted-foreground">Precision Environmental Stewardship</p>
        </div>

        <div className="mt-8 space-y-4">
          <Field label="Email" icon={<Mail className="h-4 w-4" />}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@ecolens.net"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              suppressHydrationWarning
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Password
              </span>
              <Link to="/auth/signin" className="font-mono text-xs text-eco-orange">
                Forgot Password?
              </Link>
            </div>
            <Field icon={<Lock className="h-4 w-4" />}>
              <input
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                suppressHydrationWarning
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="text-muted-foreground hover:text-foreground"
                suppressHydrationWarning
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-eco-red/10 px-4 py-2.5 text-xs text-eco-red border border-eco-red/20">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-primary/25"
          suppressHydrationWarning
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign In <LogIn className="h-4 w-4" />
            </>
          )}
        </button>

        <div className="mt-6 border-t border-border pt-5 text-center text-sm">
          <Link to="/auth/signup" className="text-muted-foreground">
            New to Ecolens?{" "}
            <span className="text-eco-orange font-semibold underline decoration-eco-green underline-offset-4">
              Sign Up
            </span>
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-input px-4 py-3">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}
