/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EcoLogo } from "@/components/eco-logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ecolens — See the air you breathe" },
      {
        name: "description",
        content: "Ecolens reveals air quality, heat, and carbon for every street in real time.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const auth = localStorage.getItem("ecolens:auth");
    if (auth) {
      navigate({ to: "/map" });
    } else {
      navigate({ to: "/auth/signin" });
    }
  }, [navigate]);

  return <div className="min-h-screen bg-background" />;
}
