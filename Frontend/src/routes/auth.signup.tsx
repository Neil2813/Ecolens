/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { EcoLogo } from "@/components/eco-logo";

export const Route = createFileRoute("/auth/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const useEveryday = localStorage.getItem("ecolens:use_everyday") === "true";
    const commuteDest = localStorage.getItem("ecolens:commute_destination") || null;
    const commuteDestCoords = localStorage.getItem("ecolens:commute_destination_coords") || null;

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          confirm_password: password,
          use_everyday: useEveryday,
          commute_destination: commuteDest,
          commute_destination_coords: commuteDestCoords,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("ecolens:auth", "1");
        localStorage.setItem("ecolens:auth_token", data.token);
        localStorage.setItem("ecolens:user", JSON.stringify(data.user));
        navigate({ to: "/map" });
      } else {
        const data = await response.json();
        console.warn("Backend signup failed, falling back to demo:", data.detail);
        localStorage.setItem("ecolens:auth", "demo");
        navigate({ to: "/map" });
      }
    } catch (err) {
      console.warn("Backend offline. Fallback to local demo mode:", err);
      localStorage.setItem("ecolens:auth", "demo");
      navigate({ to: "/map" });
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-10 grid-bg">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-border bg-card/85 p-8 backdrop-blur"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <EcoLogo size={36} />
          <h1 className="text-2xl font-bold">Create your Ecolens</h1>
          <p className="text-xs text-muted-foreground">Start breathing smarter today</p>
        </div>

        <div className="mt-8 space-y-4">
          <Field label="Full name" icon={<User className="h-4 w-4" />}>
            <input
              required
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              suppressHydrationWarning
            />
          </Field>
          <Field label="Email" icon={<Mail className="h-4 w-4" />}>
            <input
              type="email"
              required
              placeholder="you@ecolens.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              suppressHydrationWarning
            />
          </Field>
          <Field label="Password" icon={<Lock className="h-4 w-4" />}>
            <input
              type={show ? "text" : "password"}
              required
              placeholder="At least 8 characters (with 1 number)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground animate-none"
              suppressHydrationWarning
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="text-muted-foreground"
              suppressHydrationWarning
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </Field>
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] shadow-lg shadow-primary/25"
          suppressHydrationWarning
        >
          Create Account
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>

        <div className="mt-5 border-t border-border pt-4 text-center text-sm">
          <Link to="/auth/signin" className="text-muted-foreground">
            Already have an account?{" "}
            <span className="text-eco-orange font-semibold underline decoration-eco-green underline-offset-4">
              Sign In
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
